import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendJobCompletionNotification } from '../../services/whatsappService';

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
      }
    } else {
      // Direct completion flow (for job lists)
      try {
        const { updateJob } = await import('../../services/firebase');
        await updateJob(job.id, { status: 'completed' });

        // Notify parent component to refresh jobs list
        if (onStatusChange) {
          onStatusChange();
        }

        alert('Job marked as completed!');
      } catch (error) {
        console.error('Error updating job:', error);
        alert('Failed to update job status. Please try again.');
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
          disabled={isProcessing || job.status === 'pending_confirmation' || !dateReached}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-xl hover:bg-green-700 transition-colors font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Marking Complete...
            </>
          ) : job.status === 'pending_confirmation' ? (
            <>
              <span className="material-symbols-outlined">schedule</span>
              Awaiting Customer Confirmation
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
      </div>
    );
  }

  // Compact variant for job lists
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Mark Complete button - shown when job is in progress */}
      {job.status === 'in_progress' && (
        <button
          onClick={handleMarkCompleted}
          disabled={!dateReached}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
            dateReached
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!dateReached ? `Scheduled for ${formatPreferredDate()}` : 'Mark this job as complete'}
        >
          <span className="material-symbols-outlined text-sm">
            {dateReached ? 'check_circle' : 'event_busy'}
          </span>
          {dateReached ? 'Mark Complete' : `Scheduled: ${formatPreferredDate()}`}
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
    </div>
  );
};

export default JobActionButtons;
