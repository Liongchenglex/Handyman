import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService';
import { callFunction, CloudFunctionError } from '../services/api/cloudFunctions';
import { projectConfig } from '../config/firebaseProject';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * ApproveHandyman Component
 *
 * Handles handyman approval/rejection from operations team email links
 * URL format: /admin/approve-handyman?token=xxx&action=approve|reject
 */
const ApproveHandyman = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading, success, error, invalid
  const [message, setMessage] = useState('');
  const [handymanData, setHandymanData] = useState(null);
  const [action, setAction] = useState(null);

  useEffect(() => {
    // Approval is now performed server-side by the processHandymanApproval
    // Cloud Function. The function:
    //   1. Verifies the operator is an admin (Firebase Auth custom claim).
    //   2. Verifies the JWT in the URL was signed by the server's
    //      APPROVAL_SECRET (which never reaches the browser).
    //   3. Updates the handyman document via the Admin SDK.
    //
    // The frontend's responsibility shrinks to: pass the token through,
    // render the response, and trigger the courtesy approval/rejection
    // email to the handyman. The approval status is authoritative
    // server-side regardless of email-send success/failure.
    const processApproval = async () => {
      try {
        const token = searchParams.get('token');
        const actionParam = searchParams.get('action');

        if (!token || !actionParam) {
          setStatus('error');
          setMessage('Invalid approval link. Missing token or action parameter.');
          return;
        }
        if (actionParam !== 'approve' && actionParam !== 'reject') {
          setStatus('error');
          setMessage('Invalid action. Must be "approve" or "reject".');
          return;
        }

        setAction(actionParam);

        let result;
        try {
          result = await callFunction('processHandymanApproval', {
            token,
            action: actionParam,
          });
        } catch (err) {
          if (err instanceof CloudFunctionError) {
            if (err.status === 401) {
              setStatus('invalid');
              setMessage('This approval link is invalid or has expired (links expire after 30 days). If you believe this is wrong, please sign in to the admin dashboard and process the request manually.');
              return;
            }
            if (err.status === 403) {
              setStatus('error');
              setMessage('You are signed in, but your account does not have admin permissions. Sign in as an admin to process approvals.');
              return;
            }
            if (err.status === 404) {
              setStatus('error');
              setMessage('Handyman not found in database.');
              return;
            }
          }
          throw err;
        }

        const handyman = result.handyman || {};
        setHandymanData(handyman);

        if (result.alreadyProcessed) {
          setStatus('success');
          const dateField = actionParam === 'approve' ? handyman.verifiedAt : handyman.rejectedAt;
          const formatted = dateField ? new Date(dateField).toLocaleDateString() : 'a previous date';
          setMessage(
            actionParam === 'approve'
              ? `This handyman was already approved on ${formatted}.`
              : `This handyman was already rejected on ${formatted}.`
          );
          return;
        }

        // Fire-and-forget courtesy email to the handyman. Approval state
        // is already committed server-side; we don't want to flip the
        // result UI to "error" just because email is down.
        const courtesy = actionParam === 'approve' ? sendApprovalEmail : sendRejectionEmail;
        courtesy({
          uid: result.handymanId,
          name: handyman.name,
          email: handyman.email,
        }).catch((err) => console.error('Courtesy email failed:', err));

        setStatus('success');
        setMessage(
          actionParam === 'approve'
            ? `✅ Handyman "${handyman.name}" has been successfully approved! They can now start accepting jobs.`
            : `Handyman "${handyman.name}" has been rejected. They have been notified.`
        );
      } catch (error) {
        console.error('Error processing approval:', error);
        setStatus('error');
        setMessage(`Error: ${error.message || 'Something went wrong. Please try again or contact support.'}`);
      }
    };

    processApproval();
  }, [searchParams]);

  // Render loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center max-w-md w-full">
          <LoadingSpinner />
          <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium">
            Processing approval request...
          </p>
        </div>
      </div>
    );
  }

  // Render result
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-12">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 max-w-2xl w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {status === 'success' && (
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">
                check_circle
              </span>
            </div>
          )}
          {(status === 'error' || status === 'invalid') && (
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-red-600 dark:text-red-400">
                error
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-4">
          {status === 'success' && action === 'approve' && 'Handyman Approved'}
          {status === 'success' && action === 'reject' && 'Handyman Rejected'}
          {status === 'error' && 'Processing Failed'}
          {status === 'invalid' && 'Invalid Link'}
        </h1>

        {/* Message */}
        <p className="text-gray-700 dark:text-gray-300 text-center mb-8 text-lg">
          {message}
        </p>

        {/* Handyman Details (if available and action was successful) */}
        {handymanData && status === 'success' && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">person</span>
              Handyman Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                <span className="font-medium">{handymanData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="font-medium">{handymanData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                <span className="font-medium">{handymanData.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Services:</span>
                <span className="font-medium">{handymanData.serviceTypes?.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                <span className="font-medium">{handymanData.experienceLevel}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Go to Homepage
          </button>

          {status === 'success' && (
            <a
              href={`${projectConfig.firebaseConsoleUrl}/firestore/data/handymen/${handymanData?.uid || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-primary text-black font-semibold rounded-xl hover:bg-opacity-80 transition-colors text-center"
            >
              View in Firebase Console
            </a>
          )}
        </div>

        {/* Support Info */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Questions or issues? Contact{' '}
            <a href="mailto:support@eazydone.com" className="text-primary hover:underline">
              support@eazydone.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApproveHandyman;
