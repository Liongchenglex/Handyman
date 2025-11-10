import React, { useState, useEffect } from 'react';
import { getJobsByHandyman } from '../../services/firebase';
import JobActionButtons from './JobActionButtons';
import { getStatusColor, getStatusText, formatPhoneForWhatsApp, formatDate } from '../../utils/jobHelpers';

/**
 * MyJobsView Component
 *
 * Displays jobs assigned to the current handyman
 * Shows job details, customer contact, and action buttons
 */
const MyJobsView = ({ user, onViewChange }) => {
  const [myJobs, setMyJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Fetch handyman's jobs
  useEffect(() => {
    const fetchMyJobs = async () => {
      if (user) {
        setLoadingJobs(true);
        try {
          const jobs = await getJobsByHandyman(user.uid);
          setMyJobs(jobs);
        } catch (error) {
          console.error('Error fetching my jobs:', error);
        } finally {
          setLoadingJobs(false);
        }
      }
    };

    fetchMyJobs();
  }, [user]);

  // Refresh jobs list after status change
  const handleJobStatusChange = async () => {
    try {
      const jobs = await getJobsByHandyman(user.uid);
      setMyJobs(jobs);
    } catch (error) {
      console.error('Error refreshing jobs:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Jobs ({myJobs.length})
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Jobs assigned to you
        </p>
      </div>

      {/* Loading State */}
      {loadingJobs ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your jobs...</p>
        </div>
      ) : myJobs.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-gray-400 text-2xl">work</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No jobs yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You haven't been assigned any jobs yet. Check the Available Jobs tab to find work.
          </p>
          <button
            onClick={() => onViewChange('jobs')}
            className="inline-flex items-center gap-2 bg-primary text-gray-900 px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">search</span>
            Browse Available Jobs
          </button>
        </div>
      ) : (
        /* Jobs List */
        <div className="space-y-6">
          {myJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              {/* Job Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {job.serviceType}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {getStatusText(job.status)}
                    </span>
                    {job.urgency === 'urgent' && (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
                        🔥 Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Job ID: {job.id} • Accepted {job.acceptedAt}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Customer: {job.customerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    SGD ${job.estimatedBudget}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Budget
                  </p>
                </div>
              </div>

              {/* Job Description */}
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {job.description}
              </p>

              {/* Job Images Preview */}
              {job.imageUrls && job.imageUrls.length > 0 && (
                <div className="mb-4">
                  <div className="flex gap-2 overflow-x-auto">
                    {job.imageUrls.slice(0, 3).map((imageUrl, index) => (
                      <img
                        key={index}
                        src={imageUrl}
                        alt={`Job preview ${index + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600 flex-shrink-0"
                      />
                    ))}
                    {job.imageUrls.length > 3 && (
                      <div className="h-20 w-20 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          +{job.imageUrls.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Job Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Location</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{job.location}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Scheduled Time</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {job.preferredTiming === 'Schedule'
                      ? `${formatDate(job.preferredDate)} at ${job.preferredTime}`
                      : 'As soon as possible'
                    }
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Materials</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{job.materials}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Site Visit</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{job.siteVisit}</p>
                </div>
              </div>

              {/* Customer Contact */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Customer Contact
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {job.customerName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {job.customerPhone}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${job.customerPhone}`}
                      className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">call</span>
                      Call
                    </a>
                    <a
                      href={`https://wa.me/${formatPhoneForWhatsApp(job.customerPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <JobActionButtons job={job} onStatusChange={handleJobStatusChange} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyJobsView;
