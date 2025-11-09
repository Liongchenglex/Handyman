import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyApprovalToken } from '../services/emailService';
import { updateDocument, getDocument } from '../services/firebase';
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
    const processApproval = async () => {
      try {
        // Extract token and action from URL
        const token = searchParams.get('token');
        const actionParam = searchParams.get('action'); // 'approve' or 'reject'

        if (!token || !actionParam) {
          setStatus('error');
          setMessage('Invalid approval link. Missing token or action parameter.');
          return;
        }

        setAction(actionParam);

        // Verify the token
        console.log('Verifying approval token...');
        const tokenData = verifyApprovalToken(token);

        if (!tokenData) {
          setStatus('invalid');
          setMessage('This approval link is invalid or has expired (links expire after 30 days).');
          return;
        }

        const { handymanId } = tokenData;

        // Fetch handyman data from Firestore
        console.log('Fetching handyman data for ID:', handymanId);
        const handyman = await getDocument('handymen', handymanId);

        if (!handyman) {
          setStatus('error');
          setMessage('Handyman not found in database.');
          return;
        }

        setHandymanData(handyman);

        // Check if already processed
        if (handyman.status === 'active' && handyman.verified === true) {
          setStatus('success');
          setMessage(`This handyman has already been approved on ${new Date(handyman.verifiedAt).toLocaleDateString()}.`);
          return;
        }

        if (handyman.status === 'rejected') {
          setStatus('error');
          setMessage(`This handyman has already been rejected on ${new Date(handyman.rejectedAt).toLocaleDateString()}.`);
          return;
        }

        // Process the approval/rejection
        if (actionParam === 'approve') {
          console.log('Approving handyman:', handymanId);
          await updateDocument('handymen', handymanId, {
            verified: true,
            verifiedAt: new Date().toISOString(),
            status: 'active',
            updatedAt: new Date().toISOString()
          });

          setStatus('success');
          setMessage(`✅ Handyman "${handyman.name}" has been successfully approved! They can now start accepting jobs.`);

          // TODO: Send confirmation email to handyman
          console.log('TODO: Send approval confirmation email to:', handyman.email);

        } else if (actionParam === 'reject') {
          console.log('Rejecting handyman:', handymanId);
          await updateDocument('handymen', handymanId, {
            verified: false,
            rejectedAt: new Date().toISOString(),
            status: 'rejected',
            rejectedReason: '', // Can be added to UI later
            updatedAt: new Date().toISOString()
          });

          setStatus('success');
          setMessage(`Handyman "${handyman.name}" has been rejected. They have been notified.`);

          // TODO: Send rejection email to handyman
          console.log('TODO: Send rejection notification email to:', handyman.email);

        } else {
          setStatus('error');
          setMessage('Invalid action. Must be "approve" or "reject".');
        }

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
              href={`https://console.firebase.google.com/project/eazydone-d06cf/firestore/data/handymen/${handymanData?.uid || ''}`}
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
