import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJobsByHandyman } from '../services/firebase';
import HandymanHeader from '../components/handyman/HandymanHeader';
import JobBoard from '../components/handyman/JobBoard';

/**
 * HandymanDashboard Page
 *
 * Main dashboard for authenticated handymen
 * Shows job board and handyman profile/stats
 * Uses Firebase AuthContext for user data
 */
const HandymanDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile, isHandyman, loading } = useAuth();
  const [currentView, setCurrentView] = useState('jobs'); // 'jobs', 'my-jobs', 'profile'
  const [myJobs, setMyJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Redirect if not authenticated or not a handyman
  useEffect(() => {
    if (!loading && (!user || !isHandyman)) {
      navigate('/handyman-auth');
    }
  }, [user, isHandyman, loading, navigate]);

  // Fetch handyman's jobs when viewing My Jobs
  useEffect(() => {
    const fetchMyJobs = async () => {
      if (user && isHandyman && currentView === 'my-jobs') {
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
  }, [user, isHandyman, currentView]);

  const handleJobSelect = (job) => {
    console.log('Job selected after expressing interest:', job);
    // After expressing interest, switch to My Jobs tab to see the accepted job
    setCurrentView('my-jobs');
  };

  // Show loading state while checking authentication
  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Get handyman status from profile
  const handymanStatus = userProfile?.handyman?.status || 'pending';
  const handymanVerified = userProfile?.handyman?.verified || false;

  // PENDING STATUS VIEW - Application under review
  const PendingStatusView = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader currentView="profile" onViewChange={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-yellow-600 dark:text-yellow-400">
                pending
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Application Under Review
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Thank you for registering with EazyDone! Our operations team is currently reviewing your application.
          </p>

          {/* Timeline */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3 text-left">
              <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 mt-0.5">
                schedule
              </span>
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  What's Next?
                </h3>
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  Our team typically reviews applications within <strong>1-2 business days</strong>.
                  We'll send you an email notification once your account has been approved.
                </p>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
              Your Registration Details
            </h3>
            <div className="space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                <span className="font-medium text-gray-900 dark:text-white">{userProfile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="font-medium text-gray-900 dark:text-white">{userProfile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Services:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {userProfile.handyman?.serviceTypes?.join(', ') || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">Pending Review</span>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Have questions about your application?
            </p>
            <a
              href="mailto:support@eazydone.com"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <span className="material-symbols-outlined text-sm">email</span>
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  // REJECTED STATUS VIEW - Application not approved
  const RejectedStatusView = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader currentView="profile" onViewChange={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-red-600 dark:text-red-400">
                cancel
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Application Not Approved
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Unfortunately, we are unable to approve your handyman application at this time.
          </p>

          {/* Reason (if provided) */}
          {userProfile.handyman?.rejectedReason && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5">
                  info
                </span>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                    Reason for Rejection
                  </h3>
                  <p className="text-red-800 dark:text-red-300 text-sm">
                    {userProfile.handyman.rejectedReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Appeal Option */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3 text-left">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
                support_agent
              </span>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Want to Appeal?
                </h3>
                <p className="text-blue-800 dark:text-blue-300 text-sm mb-4">
                  If you believe this decision was made in error or you have additional information to provide,
                  you can contact our operations team to appeal this decision.
                </p>
                <a
                  href="mailto:operations@eazydone.com?subject=Handyman%20Application%20Appeal%20-%20${userProfile.name}&body=Hi%20EazyDone%20Team,%0A%0AI%20would%20like%20to%20appeal%20the%20rejection%20of%20my%20handyman%20application.%0A%0AName:%20${userProfile.name}%0AEmail:%20${userProfile.email}%0A%0AReason%20for%20appeal:%0A[Please%20explain%20why%20you%20believe%20your%20application%20should%20be%20reconsidered]"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-sm">email</span>
                  Email Operations Team
                </a>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
              Application Details
            </h3>
            <div className="space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                <span className="font-medium text-gray-900 dark:text-white">{userProfile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="font-medium text-gray-900 dark:text-white">{userProfile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className="font-medium text-red-600 dark:text-red-400">Rejected</span>
              </div>
              {userProfile.handyman?.rejectedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Rejected On:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(userProfile.handyman.rejectedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Support */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For any questions, contact us at{' '}
              <a href="mailto:support@eazydone.com" className="text-primary hover:underline font-medium">
                support@eazydone.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // SUSPENDED STATUS VIEW - Account suspended (future feature)
  const SuspendedStatusView = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader currentView="profile" onViewChange={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-orange-600 dark:text-orange-400">
                block
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Account Suspended
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Your handyman account has been temporarily suspended.
          </p>
          {userProfile.handyman?.suspendedReason && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                Reason: {userProfile.handyman.suspendedReason}
              </h3>
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please contact support to resolve this issue.
          </p>
          <a
            href="mailto:support@eazydone.com"
            className="inline-flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-sm">email</span>
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );

  // Check handyman status and show appropriate view
  if (handymanStatus === 'pending') {
    return <PendingStatusView />;
  }

  if (handymanStatus === 'rejected') {
    return <RejectedStatusView />;
  }

  if (handymanStatus === 'suspended') {
    return <SuspendedStatusView />;
  }

  // Only show full dashboard if status is 'active' and verified
  if (handymanStatus !== 'active' || !handymanVerified) {
    return <PendingStatusView />;
  }


  // My Jobs View - Shows jobs assigned to this handyman from Firebase
  const MyJobsView = () => {

    const getStatusColor = (status) => {
      switch (status) {
        case 'pending':
          return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'in_progress':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        case 'completed':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'cancelled':
          return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'pending':
          return 'Pending';
        case 'in_progress':
          return 'In Progress';
        case 'completed':
          return 'Completed';
        case 'cancelled':
          return 'Cancelled';
        default:
          return 'Unknown';
      }
    };

    const handleMarkInProgress = async (jobId) => {
      try {
        const { updateJob } = await import('../services/firebase');
        await updateJob(jobId, { status: 'in_progress' });
        // Refresh jobs list
        const jobs = await getJobsByHandyman(user.uid);
        setMyJobs(jobs);
        alert('Job marked as in progress!');
      } catch (error) {
        console.error('Error updating job:', error);
        alert('Failed to update job status. Please try again.');
      }
    };

    const handleMarkCompleted = async (jobId) => {
      try {
        const { updateJob } = await import('../services/firebase');
        await updateJob(jobId, { status: 'completed' });
        // Refresh jobs list
        const jobs = await getJobsByHandyman(user.uid);
        setMyJobs(jobs);
        alert('Job marked as completed!');
      } catch (error) {
        console.error('Error updating job:', error);
        alert('Failed to update job status. Please try again.');
      }
    };

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Jobs ({myJobs.length})
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Jobs assigned to you
          </p>
        </div>

        {loadingJobs ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading your jobs...</p>
          </div>
        ) : myJobs.length === 0 ? (
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
              onClick={() => setCurrentView('jobs')}
              className="inline-flex items-center gap-2 bg-primary text-gray-900 px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <span className="material-symbols-outlined">search</span>
              Browse Available Jobs
            </button>
          </div>
        ) : (
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
                      {job.scheduledDate} at {job.scheduledTime}
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
                        href={`https://wa.me/${job.customerPhone.replace(/[^0-9]/g, '')}`}
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
                <div className="flex flex-col sm:flex-row gap-3">
                  {job.status === 'accepted' && (
                    <button
                      onClick={() => handleMarkInProgress(job.id)}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Start Work
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      onClick={() => handleMarkCompleted(job.id)}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Mark Complete
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/job-details/${job.id}`, { state: { job } })}
                    className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-sm">description</span>
                    View Job Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Profile View - Using Firebase data from AuthContext
  const ProfileView = () => {
    const handymanProfile = userProfile?.handyman || {};

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center gap-4 mb-8">
            {handymanProfile.profileImageUrl ? (
              <img
                src={handymanProfile.profileImageUrl}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-4 border-primary/30"
              />
            ) : (
              <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-4">
                <span className="material-symbols-outlined text-primary text-2xl">engineering</span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {userProfile.name || user.displayName || 'Handyman Profile'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
                Contact Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {userProfile.email || user.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Phone</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {userProfile.phone || handymanProfile.phone || 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Email Verified</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.emailVerified ? (
                      <span className="text-green-600">✓ Verified</span>
                    ) : (
                      <span className="text-yellow-600">⚠ Not verified</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
                Professional Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Service Types</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {handymanProfile.serviceTypes && handymanProfile.serviceTypes.length > 0 ? (
                      handymanProfile.serviceTypes.map(service => (
                        <span
                          key={service}
                          className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium"
                        >
                          {service}
                        </span>
                      ))
                    ) : (
                      <p className="font-medium text-gray-500">Not specified</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Experience Level</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {handymanProfile.experience || 'Not specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Verification Status</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {handymanProfile.verified ? (
                      <span className="text-green-600">✓ Verified Handyman</span>
                    ) : (
                      <span className="text-yellow-600">⚠ Pending Verification</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Availability</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {handymanProfile.isAvailable ? (
                      <span className="text-green-600">✓ Available</span>
                    ) : (
                      <span className="text-red-600">✗ Not Available</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          {handymanProfile.bio && (
            <div className="mt-8">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">About Me</h3>
              <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                {handymanProfile.bio}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {handymanProfile.totalJobs || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Jobs Completed</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {myJobs.filter(j => j.status === 'in_progress').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {handymanProfile.rating || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Average Rating</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <main>
        {currentView === 'jobs' && (
          <JobBoard
            onJobSelect={handleJobSelect}
          />
        )}
        {currentView === 'my-jobs' && <MyJobsView />}
        {currentView === 'profile' && <ProfileView />}
      </main>
    </div>
  );
};

export default HandymanDashboard;