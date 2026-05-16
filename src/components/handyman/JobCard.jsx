import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getJob } from '../../services/firebase';
import ExpressInterestButton from './ExpressInterestButton';
import JobActionButtons from './JobActionButtons';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatDate, getUrgencyBadge } from '../../utils/jobHelpers';

/**
 * JobCard Component
 *
 * Displays detailed view of a specific job with full information
 * Context-aware: Shows "Express Interest" for available jobs or "Mark Complete" for handyman's own jobs
 * Follows established design patterns and styling of the project
 */
const JobCard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { user } = useAuth();

  // A job can arrive two ways:
  //  1. Via navigation state — the fast path when coming from the job
  //     board (the job object is already in hand, no fetch needed).
  //  2. Via the /job-details/:jobId URL directly — a page refresh, a
  //     shared link, or the post-express-interest redirect. There's
  //     no state then, so we fetch the job by its ID. Previously this
  //     case always showed "Job not found".
  const [job, setJob] = useState(location.state?.job || null);
  const [loading, setLoading] = useState(!location.state?.job && !!jobId);

  useEffect(() => {
    if (job || !jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const fetched = await getJob(jobId);
        if (!cancelled) setJob(fetched);
      } catch (err) {
        // getJob throws 'Document not found' for a missing job —
        // leaving job null renders the not-found view below.
        console.error('Failed to load job', jobId, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, job]);

  // Check if this job belongs to the current handyman
  const isMyJob = job?.handymanId === user?.uid;

  // While fetching a job opened directly by URL.
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Handle case where no job data is available
  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-gray-400 text-2xl">error</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Job not found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The job details could not be loaded.
          </p>
          <button
            onClick={() => navigate('/handyman-dashboard')}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleBackToJobs = () => {
    navigate('/handyman-dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleBackToJobs}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Details</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Review the complete job information
            </p>
          </div>
        </div>

        {/* Main Job Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Job Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white break-words">
                    {job.serviceType}
                  </h2>
                  {getUrgencyBadge(job.urgency)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                  Job ID: {job.id} • Posted {job.postedAt}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-primary">
                  SGD ${job.estimatedBudget}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Estimated Budget
                </p>
              </div>
            </div>
          </div>

          {/* Job Content */}
          <div className="p-6">
            {/* Job Description */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Job Description
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {job.description}
              </p>
            </div>

            {/* Job Images Gallery */}
            {job.imageUrls && job.imageUrls.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  Job Images
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {job.imageUrls.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative group overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 aspect-square"
                    >
                      <img
                        src={imageUrl}
                        alt={`Job reference ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      {/* Tap/click anywhere on the image to enlarge. The
                          overlay button stays visible on touch screens
                          (no hover) and reveals on hover for pointer devices. */}
                      <button
                        type="button"
                        onClick={() => window.open(imageUrl, '_blank')}
                        aria-label={`View job reference image ${index + 1} full size`}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors"
                      >
                        <span className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-4 py-2 rounded-lg font-medium text-sm shadow">
                          View Full Size
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Job Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Location & Timing */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Location & Timing</h4>

                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">location_on</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Location</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{job.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">schedule</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Timing</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {job.preferredTiming === 'Schedule'
                        ? `${formatDate(job.preferredDate)} at ${job.preferredTime}`
                        : 'As soon as possible'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Job Requirements */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Requirements</h4>

                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">inventory</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Materials</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{job.materials}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">visibility</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Site Visit</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {job.siteVisit === 'Yes' ? 'Site visit required' : 'No site visit needed'}
                    </p>
                  </div>
                </div>

                {job.images && job.images > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">image</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Images</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {job.images} image{job.images !== 1 ? 's' : ''} uploaded
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-2">
                  <span className="material-symbols-outlined text-primary text-sm">person</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{job.customerName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Contact details will be shared after job acceptance
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons - Context-aware based on job ownership */}
            {isMyJob ? (
              // Show Mark Complete button for handyman's own jobs
              <JobActionButtons
                job={job}
                variant="full"
                showViewDetails={false}
              />
            ) : (
              // Show Express Interest button for available jobs
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <ExpressInterestButton
                  job={job}
                  buttonStyle="full-width"
                  onSuccess={() => navigate('/handyman-dashboard')}
                />

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  Customer will be notified via WhatsApp if you express interest
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
