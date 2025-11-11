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
 */
const JobActionButtons = ({
  job,
  onStatusChange,
  variant = 'compact',  // 'compact' for lists, 'full' for detail pages
  showViewDetails = true,
  completionFlow = 'direct' // 'direct' or 'pending_confirmation'
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMarkInProgress = async () => {
    try {
      const { updateJob } = await import('../../services/firebase');
      await updateJob(job.id, { status: 'in_progress' });

      // Notify parent component to refresh jobs list
      if (onStatusChange) {
        onStatusChange();
      }

      alert('Job marked as in progress!');
    } catch (error) {
      console.error('Error updating job:', error);
      alert('Failed to update job status. Please try again.');
    }
  };

  const handleMarkCompleted = async () => {
    // Different completion flows based on variant
    if (completionFlow === 'pending_confirmation') {
      // Job detail page flow - requires customer confirmation
      if (!window.confirm('Are you sure you want to mark this job as complete? The customer will be notified to confirm completion.')) {
        return;
      }

      setIsProcessing(true);

      try {
        const { updateJob } = await import('../../services/firebase');

        // Update job status to pending confirmation
        await updateJob(job.id, {
          status: 'pending_confirmation',
          completedAt: new Date().toISOString(),
          completedBy: {
            uid: user.uid,
            name: user.displayName || user.email,
            email: user.email
          }
        });

        console.log('Job marked as complete, awaiting customer confirmation');

        // Send WhatsApp notification to customer
        if (job.customerPhone) {
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
        }

        alert('Job marked as complete! Customer has been notified via WhatsApp.');

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

  // Full width variant for job detail pages
  if (variant === 'full') {
    return (
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleMarkCompleted}
          disabled={isProcessing || job.status === 'pending_confirmation'}
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
            : 'Mark this job as complete to notify the customer'}
        </p>
      </div>
    );
  }

  // Compact variant for job lists
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Start Work button - shown when job is accepted */}
      {job.status === 'accepted' && (
        <button
          onClick={handleMarkInProgress}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">play_arrow</span>
          Start Work
        </button>
      )}

      {/* Mark Complete button - shown when job is in progress */}
      {job.status === 'in_progress' && (
        <button
          onClick={handleMarkCompleted}
          className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          Mark Complete
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
