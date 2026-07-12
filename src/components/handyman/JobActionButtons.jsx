import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendJobCompletionNotification } from '../../services/whatsappService';
import CancelJobModal from './CancelJobModal';
import ProposeTimeModal from './ProposeTimeModal';

/**
 * JobActionButtons Component
 *
 * Centralized job action management for all job-related operations
 * Handles: Start Work, Mark Complete, View Details
 * Supports different completion flows (direct complete vs pending confirmation)
 *
 * Date Gate Logic:
 * - If the job has a scheduled preferredDate, the "Mark Complete" button is
 *   blocked before that date to prevent premature completion.
 * - ASAP/Immediate jobs have no date restriction.
 */
const JobActionButtons = ({
  job,
  onStatusChange,
  variant = 'compact',  // 'compact' for lists, 'full' for detail pages
  showViewDetails = true,
  completionFlow = 'pending_confirmation' // 'pending_confirmation' (sends WhatsApp) or 'direct' (no notification)
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  // Tracks a successful completion so the button locks into its terminal
  // "Marked as Completed" state immediately, before the parent list refetches.
  const [justCompleted, setJustCompleted] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);

  // Synchronous re-entrancy guard. React state updates (setIsProcessing) are
  // asynchronous, so a rapid double-click can fire two completion writes before
  // the disabled state re-renders. A ref flips synchronously to block the
  // duplicate call.
  const completingRef = useRef(false);

  // The completion action is "done" once the job has moved past 'in_progress'
  // (either to 'pending_confirmation' awaiting the customer, or 'completed'),
  // or once we have optimistically marked it complete in this session.
  const isCompleted =
    justCompleted ||
    job.status === 'pending_confirmation' ||
    job.status === 'completed';

  // Cancel is available in the same window the server enforces:
  // assigned job still in progress, completion poll not yet sent.
  const canCancel = job.status === 'in_progress' && !job.completionPollSentAt && !isCompleted;

  // Same window as cancel: an in-progress job whose completion poll
  // hasn't gone out yet can have its time re-proposed (F4/Scenario 3).
  const canPropose = canCancel;

  const handleProposed = () => {
    setShowProposeModal(false);
    alert('Proposal sent! The customer has been asked to approve the new time on WhatsApp.');
    if (onStatusChange) onStatusChange();
  };

  const handleCancelled = () => {
    setShowCancelModal(false);
    alert('Job cancelled. It has been returned to the job board and the customer has been notified.');
    if (variant === 'full') {
      navigate('/handyman-dashboard');
    } else if (onStatusChange) {
      onStatusChange();
    }
  };

  /**
   * Check if the job's scheduled date has arrived.
   * Returns true if the job can be marked complete (date gate passes).
   * ASAP/Immediate jobs always pass. Scheduled jobs must be on or after preferredDate.
   */
  const isJobDateReached = () => {
    // ASAP/Immediate jobs — no date gate
    if (!job.preferredDate || job.preferredTiming === 'Immediate' || job.preferredTiming === 'ASAP') {
      return true;
    }

    // Compare today's date (start of day) with the preferred date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const preferredDate = new Date(job.preferredDate);
    preferredDate.setHours(0, 0, 0, 0);

    return today >= preferredDate;
  };

  /**
   * Format the preferred date for display in the date gate message.
   */
  const formatPreferredDate = () => {
    if (!job.preferredDate) return '';
    return new Date(job.preferredDate).toLocaleDateString('en-SG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleMarkCompleted = async () => {
    // Re-entrancy guard: block a second (rapid) click while a completion is
    // already in flight, before React re-renders the disabled button.
    if (completingRef.current || isProcessing) {
      return;
    }

    // Idempotency guard: if the job is no longer 'in_progress' it has already
    // been marked complete — don't submit again.
    if (isCompleted || job.status !== 'in_progress') {
      return;
    }

    // Date gate: block completion before the scheduled preferred date
    if (!isJobDateReached()) {
      alert(`This job is scheduled for ${formatPreferredDate()}. You cannot mark it as complete before the appointment date.`);
      return;
    }

    // Different completion flows based on variant
    if (completionFlow === 'pending_confirmation') {
      // Job detail page flow - requires customer confirmation
      if (!window.confirm('Are you sure you want to mark this job as complete? The customer will be notified to confirm completion.')) {
        return;
      }

      // Acquire the lock only after the user confirms (so cancelling leaves the
      // button usable).
      completingRef.current = true;
      setIsProcessing(true);

      try {
        const { updateJob } = await import('../../services/firebase');

        // Check if a completion poll was already sent (e.g. by the auto-trigger).
        // If so, skip the WhatsApp send to avoid duplicate messages.
        const pollAlreadySent = !!job.completionPollSentAt;

        // Update job status to pending confirmation
        const updateData = {
          status: 'pending_confirmation',
          completedAt: new Date().toISOString(),
          completedBy: {
            uid: user.uid,
            name: user.displayName || user.email,
            email: user.email
          }
        };

        // Only set completionPollSentAt if we're about to send the poll
        if (!pollAlreadySent && job.customerPhone) {
          updateData.completionPollSentAt = new Date().toISOString();
          updateData.completionPollSentBy = 'handyman';
        }

        await updateJob(job.id, updateData);

        // Lock the button into its terminal state immediately.
        setJustCompleted(true);

        console.log('Job marked as complete, awaiting customer confirmation');

        // Send WhatsApp notification to customer (only if poll not already sent)
        if (!pollAlreadySent && job.customerPhone) {
          const handymanInfo = {
            name: user.displayName || user.email,
            uid: user.uid
          };

          const whatsappResult = await sendJobCompletionNotification(job, handymanInfo);

          if (whatsappResult.success) {
            console.log('✅ WhatsApp notification sent to customer');
          } else if (whatsappResult.fallback) {
            console.log('⚠️ WhatsApp not configured - notification logged to console');
          } else {
            console.error('❌ Failed to send WhatsApp notification:', whatsappResult.error);
          }
        } else if (pollAlreadySent) {
          console.log('ℹ️ Completion poll already sent — skipping duplicate WhatsApp message');
        }

        const alertMessage = pollAlreadySent
          ? 'Job marked as complete! Customer was already notified via WhatsApp.'
          : 'Job marked as complete! Customer has been notified via WhatsApp.';
        alert(alertMessage);

        // Navigate back to dashboard if on detail page
        if (variant === 'full') {
          navigate('/handyman-dashboard');
        } else if (onStatusChange) {
          onStatusChange();
        }
      } catch (error) {
        console.error('Error marking job as complete:', error);
        alert('Failed to mark job as complete. Please try again.');
      } finally {
        setIsProcessing(false);
        completingRef.current = false;
      }
    } else {
      // Direct completion flow (for job lists)
      completingRef.current = true;
      setIsProcessing(true);

      try {
        const { updateJob } = await import('../../services/firebase');
        await updateJob(job.id, { status: 'completed' });

        // Lock the button into its terminal state immediately.
        setJustCompleted(true);

        // Notify parent component to refresh jobs list
        if (onStatusChange) {
          onStatusChange();
        }

        alert('Job marked as completed!');
      } catch (error) {
        console.error('Error updating job:', error);
        alert('Failed to update job status. Please try again.');
      } finally {
        setIsProcessing(false);
        completingRef.current = false;
      }
    }
  };

  const handleViewDetails = () => {
    navigate(`/job-details/${job.id}`, { state: { job } });
  };

  // Determine if the date gate blocks completion
  const dateReached = isJobDateReached();

  // Full width variant for job detail pages
  if (variant === 'full') {
    return (
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleMarkCompleted}
          disabled={isProcessing || isCompleted || !dateReached}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-xl hover:bg-green-700 transition-colors font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Marking Complete...
            </>
          ) : isCompleted ? (
            <>
              <span className="material-symbols-outlined">check_circle</span>
              Marked as Completed
            </>
          ) : !dateReached ? (
            <>
              <span className="material-symbols-outlined">event_busy</span>
              Scheduled for {formatPreferredDate()}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">check_circle</span>
              Mark Complete
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
          {job.status === 'pending_confirmation'
            ? 'Customer has been notified to confirm job completion'
            : !dateReached
            ? `You can mark this job as complete on or after ${formatPreferredDate()}`
            : 'Mark this job as complete to notify the customer'}
        </p>

        {canPropose && (
          <button
            onClick={() => setShowProposeModal(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-6 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">event</span>
            {job.preferredTiming === 'Schedule' ? 'Propose new time' : 'Set visit time'}
          </button>
        )}

        <ProposeTimeModal
          job={job}
          isOpen={showProposeModal}
          onClose={() => setShowProposeModal(false)}
          onProposed={handleProposed}
        />

        {canCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-6 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">event_busy</span>
            Can't do this job? Cancel it
          </button>
        )}

        <CancelJobModal
          job={job}
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onCancelled={handleCancelled}
        />
      </div>
    );
  }

  // Compact variant for job lists
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Mark Complete button - shown while in progress, then locks into a
          terminal "Marked as Completed" state once the action succeeds. */}
      {(job.status === 'in_progress' || isCompleted) && (
        <button
          onClick={handleMarkCompleted}
          disabled={!dateReached || isProcessing || isCompleted}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium disabled:cursor-not-allowed ${
            isCompleted
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : dateReached
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={
            isCompleted
              ? 'This job has already been marked as completed'
              : !dateReached
              ? `Scheduled for ${formatPreferredDate()}`
              : 'Mark this job as complete'
          }
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              Marking Complete...
            </>
          ) : isCompleted ? (
            <>
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Marked as Completed
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">
                {dateReached ? 'check_circle' : 'event_busy'}
              </span>
              {dateReached ? 'Mark Complete' : `Scheduled: ${formatPreferredDate()}`}
            </>
          )}
        </button>
      )}

      {/* View Details button - conditionally shown */}
      {showViewDetails && (
        <button
          onClick={handleViewDetails}
          className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">description</span>
          View Job Details
        </button>
      )}

      {canPropose && (
        <button
          onClick={() => setShowProposeModal(true)}
          className="flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">event</span>
          {job.preferredTiming === 'Schedule' ? 'New time' : 'Set time'}
        </button>
      )}

      <ProposeTimeModal
        job={job}
        isOpen={showProposeModal}
        onClose={() => setShowProposeModal(false)}
        onProposed={handleProposed}
      />

      {canCancel && (
        <button
          onClick={() => setShowCancelModal(true)}
          className="flex items-center justify-center gap-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">event_busy</span>
          Cancel Job
        </button>
      )}

      <CancelJobModal
        job={job}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onCancelled={handleCancelled}
      />
    </div>
  );
};

export default JobActionButtons;
