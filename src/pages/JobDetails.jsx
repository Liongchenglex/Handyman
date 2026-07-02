import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobById, acceptJob, updateJobStatus } from '../services/api/jobs';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

/**
 * JobDetails
 *
 * Full-detail view for a single job. Mobile-first Tailwind layout:
 *  - Base styles target small screens (single column, stacked sidebar).
 *  - `lg:` breakpoints introduce the two-column main/sidebar layout once
 *    there is enough horizontal room.
 *  - All buttons are full-width on mobile and use >=44px tall tap targets.
 */
const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [error, setError] = useState(null);

  // Synchronous re-entrancy guard for completion. React state updates are async,
  // so without this a rapid double-click would fire two status updates before
  // the button re-renders as disabled.
  const completingRef = useRef(false);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const jobData = await getJobById(id);
        setJob(jobData);
      } catch (err) {
        console.error('Error loading job:', err);
        setError('Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [id]);

  const handleAcceptJob = async () => {
    if (!user) {
      alert('Please sign in to accept jobs');
      return;
    }

    setIsAccepting(true);
    try {
      await acceptJob(job.id, user.uid);
      setJob((prev) => ({ ...prev, status: 'in_progress', handymanId: user.uid }));
      setShowContactModal(true);
    } catch (err) {
      console.error('Error accepting job:', err);
      alert('Failed to accept job. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleMarkCompleted = async () => {
    // Block re-entry and stale clicks: ignore if a completion is already in
    // flight or the job is no longer in progress.
    if (completingRef.current || isCompleting || job.status !== 'in_progress') {
      return;
    }
    completingRef.current = true;
    setIsCompleting(true);

    try {
      await updateJobStatus(job.id, 'completed');
      setJob((prev) => ({ ...prev, status: 'completed' }));
      alert('Job marked as completed! Payment will be processed.');
    } catch (err) {
      console.error('Error updating job status:', err);
      alert('Failed to update job status. Please try again.');
    } finally {
      setIsCompleting(false);
      completingRef.current = false;
    }
  };

  // Tailwind classes for each job status badge.
  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
    return classes[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const formatDate = (date) => {
    if (!date) return 'Flexible';
    return new Date(date).toLocaleDateString('en-SG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading job details..." />;
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            Job Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'The job you are looking for does not exist.'}
          </p>
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center justify-center min-h-[44px] bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Back to Job Board
          </button>
        </div>
      </div>
    );
  }

  const isJobOwner = user && (user.uid === job.customerId || user.uid === job.handymanId);
  const canAccept = job.status === 'pending' && user && user.uid !== job.customerId;
  const canMarkCompleted = job.status === 'in_progress' && user && user.uid === job.handymanId;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back
          </button>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(job.status)}`}
          >
            {job.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Main / sidebar — single column on mobile, two columns from lg up */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
              {job.serviceType} Service Required
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-600 dark:text-gray-400">
              <span>
                <span className="font-medium text-gray-900 dark:text-white">Posted: </span>
                {new Date(job.createdAt).toLocaleDateString('en-SG')}
              </span>
              <span className="break-all">
                <span className="font-medium text-gray-900 dark:text-white">Job ID: </span>
                {job.id}
              </span>
            </div>

            {/* Budget */}
            <div className="mt-4 bg-primary/10 dark:bg-primary/20 rounded-lg px-4 py-3">
              <p className="text-lg font-bold text-primary">
                Budget: SGD ${job.estimatedBudget}
              </p>
            </div>

            {/* Description */}
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Job Description
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                {job.description}
              </p>
            </div>

            {/* Location & timing */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                Location &amp; Timing
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 flex-shrink-0">
                    location_on
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">Location</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                      {job.location}
                    </p>
                  </div>
                </div>

                {job.preferredDate && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 flex-shrink-0">
                      calendar_today
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">Preferred Date</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(job.preferredDate)}
                      </p>
                    </div>
                  </div>
                )}

                {job.preferredTime && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 flex-shrink-0">
                      schedule
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">Preferred Time</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {job.preferredTime}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned handyman */}
            {job.handymanId && (
              <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Assigned Handyman
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This job has been accepted by a qualified handyman.
                </p>
                {isJobOwner && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    You will be contacted via WhatsApp to coordinate the service.
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 space-y-3">
              {canAccept && (
                <button
                  onClick={handleAcceptJob}
                  disabled={isAccepting}
                  className="w-full inline-flex items-center justify-center min-h-[48px] bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-60"
                >
                  {isAccepting ? <LoadingSpinner size="small" /> : 'Accept This Job'}
                </button>
              )}

              {canMarkCompleted && (
                <button
                  onClick={handleMarkCompleted}
                  disabled={isCompleting}
                  className="w-full inline-flex items-center justify-center min-h-[48px] bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCompleting ? 'Marking as Completed...' : 'Mark as Completed'}
                </button>
              )}

              {job.status === 'pending' && !canAccept && (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  This job is available for handymen to accept.
                </p>
              )}

              {job.status === 'in_progress' && !canMarkCompleted && (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  This job is currently in progress.
                </p>
              )}

              {job.status === 'completed' && (
                <p className="text-sm font-medium text-green-700 dark:text-green-400 text-center">
                  ✅ This job has been completed successfully!
                </p>
              )}
            </div>
          </div>

          {/* Sidebar — stacks under the main content on mobile */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                Payment Protection
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>💳 Payment secured in escrow</li>
                <li>🛡️ Funds released after completion</li>
                <li>⭐ Rate your experience</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                Need Help?
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="break-words">📱 WhatsApp: +65 6123 4567</li>
                <li className="break-all">📧 easydonehandyman@gmail.com</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Job accepted confirmation */}
      <Modal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Job Accepted Successfully!"
        size="medium"
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Congratulations!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            You have successfully accepted this job.
          </p>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
            What happens next?
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>The customer will be notified via WhatsApp</li>
            <li>You&apos;ll receive the customer&apos;s contact details</li>
            <li>Coordinate timing and final details via WhatsApp</li>
            <li>Complete the job and mark it as finished</li>
            <li>Receive payment once customer confirms completion</li>
          </ol>
        </div>

        <button
          onClick={() => setShowContactModal(false)}
          className="w-full mt-6 inline-flex items-center justify-center min-h-[48px] bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold"
        >
          Got it, thanks!
        </button>
      </Modal>
    </div>
  );
};

export default JobDetails;
