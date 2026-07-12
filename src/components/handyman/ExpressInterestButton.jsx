import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateJob } from '../../services/firebase';
import LoadingSpinner from '../common/LoadingSpinner';
import { sendJobAcceptanceNotification } from '../../services/whatsappService';
import { proposeSchedule } from '../../services/api/jobSchedule';

/**
 * ExpressInterestButton Component
 *
 * Shared component for expressing interest in jobs with confirmation modal
 * Includes penalty warnings and professional commitment messaging
 * Used by both JobBoard and JobCard components
 *
 * @param {Object} job - Job object containing job details
 * @param {Function} onJobSelect - Optional callback when job is selected
 * @param {string} buttonStyle - Style variant: 'full-width' | 'inline'
 * @param {Function} onSuccess - Optional callback after successful interest expression
 */
const ExpressInterestButton = ({
  job,
  onJobSelect,
  buttonStyle = 'full-width',
  onSuccess
}) => {
  const { user, isHandyman } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Tracks a successful submission so the button shows a terminal state
  // immediately, even before the parent list refreshes or navigation happens.
  const [expressed, setExpressed] = useState(false);

  // Synchronous re-entrancy guard. React state updates (e.g. setIsLoading) are
  // asynchronous, so a fast double-click can fire the submit handler twice
  // before the disabled state re-renders. A ref flips synchronously and blocks
  // the duplicate call, preventing duplicate Firebase writes.
  const submittingRef = useRef(false);

  // ASAP jobs must carry a proposed visit time WITH the claim
  // (lifecycle spec Scenario 4): the accept modal requires it, so an
  // accepted ASAP job can never sit timeless.
  const isAsapJob = job.preferredTiming !== 'Schedule';
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');

  // A job can only be claimed while it is still open ('pending') and unassigned.
  // If it already has a handymanId / a non-pending status, interest was already
  // expressed (possibly by this user on a previous click), so the button must
  // not allow another submission.
  const alreadyClaimed = expressed || job.status !== 'pending' || !!job.handymanId;

  // A handyman who cancelled this job cannot re-claim it. Firestore
  // rules enforce this server-side; this flag just explains it in the UI
  // instead of letting the claim fail opaquely.
  const blockedFromReclaim = !!(
    user &&
    Array.isArray(job.previousHandymanIds) &&
    job.previousHandymanIds.includes(user.uid)
  );

  const handleExpressInterest = () => {
    if (blockedFromReclaim) return;
    if (alreadyClaimed) return;

    // Deep-link case: an unauthenticated visitor (typical WhatsApp
    // recipient tapping the notification on a device they've never
    // logged in on) or a signed-in non-handyman (customer with an
    // anonymous session who was forwarded the link) cannot claim the
    // job — the Firestore rules gate it on isHandyman() anyway. Send
    // them to handyman auth with a `next=` hint so they land back on
    // this exact job after signing in, instead of the generic
    // dashboard.
    if (!user || !isHandyman) {
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      navigate(`/handyman-auth?next=${next}`);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmInterest = async () => {
    // Block re-entry: guards against rapid double-clicks on the confirm button
    // firing duplicate writes before React re-renders the disabled state.
    if (submittingRef.current) return;
    submittingRef.current = true;

    // ASAP claim requires a proposed visit time (Scenario 4).
    if (isAsapJob && (!proposedDate || !proposedTime.trim())) {
      alert('Please pick a proposed visit date and time first.');
      submittingRef.current = false;
      return;
    }

    setIsLoading(true);
    setShowConfirmModal(false);

    try {
      // Update job in Firebase to link with handyman
      // Update job status directly to 'in_progress' and assign to handyman
      await updateJob(job.id, {
        handymanId: user.uid,
        status: 'in_progress',
        acceptedAt: new Date().toISOString(),
        acceptedBy: {
          uid: user.uid,
          name: user.displayName || user.email,
          email: user.email
        }
      });

      // Mark as expressed so the button locks into its terminal state right away.
      setExpressed(true);

      console.log('Successfully expressed interest in job:', job.id);

      // Send WhatsApp notification to customer
      if (job.customerPhone) {
        try {
          console.log('Sending job acceptance WhatsApp notification...');

          // Prepare handyman info for notification
          const handymanInfo = {
            name: user.displayName || user.email,
            phone: user.phoneNumber || '',
            email: user.email
          };

          const whatsappResult = await sendJobAcceptanceNotification(job, handymanInfo);

          if (whatsappResult.success) {
            console.log('✅ WhatsApp notification sent to customer');
          } else if (whatsappResult.fallback) {
            console.log('⚠️ WhatsApp not configured - notification logged to console');
          } else {
            console.error('❌ Failed to send WhatsApp notification:', whatsappResult.error);
          }
        } catch (whatsappError) {
          console.error('Error sending WhatsApp notification:', whatsappError);
          // Don't block the flow if WhatsApp fails
        }
      }

      // Scenario 4: submit the visit-time proposal the modal required.
      // Server-side it messages the customer and opens the approval
      // prompt. A failure here never un-claims the job — the job page's
      // "Set visit time" button is the retry path.
      if (isAsapJob) {
        try {
          const proposalResult = await proposeSchedule(job.id, proposedDate, proposedTime.trim(), '');
          if (!proposalResult.success) {
            console.error('❌ Visit-time proposal failed (retry from job page):', proposalResult.error);
          }
        } catch (proposalErr) {
          console.error('❌ Visit-time proposal failed (retry from job page):', proposalErr);
        }
      }

      alert(`Interest expressed! Job ${job.id} has been assigned to you. Customer will be notified via WhatsApp!`);

      // Execute callbacks (board/card cleanup) before navigating away.
      if (onJobSelect) {
        onJobSelect(job);
      }
      if (onSuccess) {
        onSuccess();
      }

      setIsLoading(false);

      // Take the handyman straight to the job they just picked up.
      navigate(`/job-details/${job.id}`);
    } catch (error) {
      console.error('Error expressing interest:', error);
      alert('Failed to express interest. Please try again.');
      setIsLoading(false);
    } finally {
      // Release the re-entrancy lock once the attempt settles.
      submittingRef.current = false;
    }
  };

  // Button style variants
  const getButtonClasses = () => {
    const baseClasses = "bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

    switch (buttonStyle) {
      case 'full-width':
        return `w-full py-4 px-6 ${baseClasses}`;
      case 'inline':
        return `py-3 px-4 ${baseClasses}`;
      default:
        return `w-full py-3 px-4 ${baseClasses}`;
    }
  };

  // Confirmation Modal Component
  const ConfirmationModal = () => (
    showConfirmModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2">
              <span className="material-symbols-outlined text-orange-600 dark:text-orange-400">warning</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Confirm Interest
            </h3>
          </div>

          {/* Modal Content */}
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You are about to express interest in this job. Please note:
            </p>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                ⚠️ Important Penalties
              </h4>
              <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                <li>• Cancelling after acceptance: <strong>$20 penalty</strong></li>
                <li>• No-show without 2 hours notice: <strong>$50 penalty</strong></li>
                <li>• Multiple cancellations may result in account suspension</li>
              </ul>
            </div>

            {isAsapJob && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  This is an ASAP job — propose your visit time <span className="text-red-500">*</span>
                </p>
                <label htmlFor="asap-date" className="sr-only">Visit date</label>
                <input
                  id="asap-date"
                  type="date"
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="w-full mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
                />
                <label htmlFor="asap-time" className="sr-only">Visit time</label>
                <input
                  id="asap-time"
                  type="text"
                  maxLength={20}
                  placeholder="Time, e.g. 2:00 PM"
                  value={proposedTime}
                  onChange={(e) => setProposedTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The customer will be asked to approve this time on WhatsApp.
                </p>
              </div>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-400">
              By expressing interest, you commit to providing professional service if selected by the customer.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmInterest}
              disabled={isLoading || (isAsapJob && (!proposedDate || !proposedTime.trim()))}
              className="flex-1 bg-primary text-black font-bold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Confirm Interest'}
            </button>
          </div>
        </div>
      </div>
    )
  );

  return (
    <>
      <button
        onClick={handleExpressInterest}
        disabled={isLoading || alreadyClaimed || blockedFromReclaim}
        className={getButtonClasses()}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="small" />
            Expressing Interest...
          </>
        ) : blockedFromReclaim ? (
          <>
            <span className="material-symbols-outlined">block</span>
            You previously cancelled this job
          </>
        ) : alreadyClaimed ? (
          <>
            <span className="material-symbols-outlined">check_circle</span>
            Interest Expressed
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">work</span>
            Express Interest
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      <ConfirmationModal />
    </>
  );
};

export default ExpressInterestButton;