import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useAuth } from '../context/AuthContext';
import { releaseEscrow } from '../services/stripe/stripeApi';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * AdminFundRelease Component
 *
 * Admin dashboard for reviewing and approving fund releases
 * Shows jobs that customers have confirmed via WhatsApp poll
 * Status: pending_admin_approval -> completed (after admin approves)
 */
const AdminFundRelease = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('pending');

  // Pending jobs state
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // Completed jobs state
  const [completedJobs, setCompletedJobs] = useState([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [completedJobsFetched, setCompletedJobsFetched] = useState(false);

  const [error, setError] = useState(null);
  const [processingJobId, setProcessingJobId] = useState(null);

  // Admin emails - can be moved to Firebase config later
  const ADMIN_EMAILS = [
    'easydonehandyman@gmail.com',
    // Add more admin emails as needed
  ];

  // Check if current user is admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Fetch jobs pending admin approval
  useEffect(() => {
    const fetchPendingJobs = async () => {
      if (authLoading) return;

      if (!user) {
        setError('Please log in to access this page');
        setLoadingPending(false);
        return;
      }

      if (!isAdmin) {
        setError('You do not have permission to access this page');
        setLoadingPending(false);
        return;
      }

      try {
        setLoadingPending(true);
        const jobsRef = collection(db, 'jobs');
        const q = query(
          jobsRef,
          where('status', '==', 'pending_admin_approval')
        );

        const snapshot = await getDocs(q);
        const jobsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setPendingJobs(jobsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching pending jobs:', err);
        setError('Failed to load pending jobs. Please try again.');
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPendingJobs();
  }, [user, authLoading, isAdmin]);

  // Fetch completed jobs when tab is clicked
  const fetchCompletedJobs = async () => {
    if (completedJobsFetched) return;

    try {
      setLoadingCompleted(true);
      const jobsRef = collection(db, 'jobs');
      const q = query(
        jobsRef,
        where('status', '==', 'completed'),
        where('paymentStatus', '==', 'released'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const jobsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by paymentReleasedAt descending (most recent first)
      jobsData.sort((a, b) => {
        const dateA = a.paymentReleasedAt?.toDate?.() || new Date(a.paymentReleasedAt) || new Date(0);
        const dateB = b.paymentReleasedAt?.toDate?.() || new Date(b.paymentReleasedAt) || new Date(0);
        return dateB - dateA;
      });

      setCompletedJobs(jobsData);
      setCompletedJobsFetched(true);
    } catch (err) {
      console.error('Error fetching completed jobs:', err);
    } finally {
      setLoadingCompleted(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'completed' && !completedJobsFetched) {
      fetchCompletedJobs();
    }
  };

  // Handle fund release approval
  const handleApprove = async (job) => {
    if (!window.confirm(`Are you sure you want to release funds for job "${job.serviceType}"?\n\nAmount: $${job.estimatedBudget}\nCustomer: ${job.customerName}\n\nThis will transfer the service fee to the handyman's Stripe account.`)) {
      return;
    }

    setProcessingJobId(job.id);

    try {
      const result = await releaseEscrow(job.id);

      // Remove from pending list and add to completed
      setPendingJobs(pendingJobs.filter(j => j.id !== job.id));

      // Add to completed jobs list with updated data
      const completedJob = {
        ...job,
        status: 'completed',
        paymentStatus: 'released',
        paymentReleasedAt: new Date(),
        paymentBreakdown: result.paymentBreakdown,
        transferId: result.transferId,
      };
      setCompletedJobs([completedJob, ...completedJobs]);

      alert(`Funds released successfully!\n\nHandyman Payout: $${result.serviceFee?.toFixed(2)}\nTransfer ID: ${result.transferId}`);
    } catch (err) {
      console.error('Error releasing escrow:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
      alert(`Failed to release funds: ${errorMessage}\n\nPlease check the job details and try again.`);
    } finally {
      setProcessingJobId(null);
    }
  };

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    // Handle Firestore Timestamp
    const date = dateValue?.toDate?.() || new Date(dateValue);
    return date.toLocaleString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (authLoading || loadingPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">
              error
            </span>
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary text-black font-semibold rounded-xl hover:bg-opacity-80 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
              </svg>
              <span className="text-xl font-bold text-gray-900 dark:text-white">EasyDoneHandyman</span>
              <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded">
                Admin
              </span>
            </Link>

            {/* User Info & Logout */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Fund Release Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Review and approve customer-confirmed job completions
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => handleTabChange('pending')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'pending'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="material-symbols-outlined text-lg">pending</span>
              Pending
              {pendingJobs.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                  {pendingJobs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('completed')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'completed'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Completed
              {completedJobs.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                  {completedJobs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Pending Tab Content */}
        {activeTab === 'pending' && (
          <>
            {pendingJobs.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">
                    check_circle
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">All Clear!</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No jobs pending fund release approval.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Job Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {job.serviceType}
                          </h3>
                          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                            Pending Approval
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Job ID:</span>
                            <p className="font-medium text-gray-900 dark:text-white truncate">{job.id}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{job.customerName}</p>
                            <p className="text-gray-500 dark:text-gray-400 text-xs">{job.customerPhone}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Handyman:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{job.handymanName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">
                              ${job.estimatedBudget}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Completed: {formatDate(job.completedAt)}</span>
                          <span>Customer Confirmed: {formatDate(job.customerConfirmedAt)}</span>
                          <span>Via: {job.confirmedVia || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        <button
                          onClick={() => handleApprove(job)}
                          disabled={processingJobId === job.id}
                          className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {processingJobId === job.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-sm">payments</span>
                              Release Funds
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How this works:</h4>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Handyman marks job as complete</li>
                <li>Customer receives WhatsApp poll to confirm</li>
                <li>Customer confirms via poll (vote is locked)</li>
                <li>Job appears here for admin review</li>
                <li>Admin approves → funds released to handyman</li>
              </ol>
            </div>
          </>
        )}

        {/* Completed Tab Content */}
        {activeTab === 'completed' && (
          <>
            {loadingCompleted ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : completedJobs.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-gray-400">
                    history
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">No Completed Jobs</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Completed jobs with released funds will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Job Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {job.serviceType}
                          </h3>
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                            Completed
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Job ID:</span>
                            <p className="font-medium text-gray-900 dark:text-white truncate">{job.id}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{job.customerName}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Handyman:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{job.handymanName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Gross Amount:</span>
                            <p className="font-bold text-lg text-gray-900 dark:text-white">
                              ${job.estimatedBudget}
                            </p>
                          </div>
                        </div>

                        {/* Payment Breakdown */}
                        {job.paymentBreakdown && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Payment Breakdown</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Gross:</span>
                                <p className="font-medium">${job.paymentBreakdown.grossAmount?.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Stripe Fee:</span>
                                <p className="font-medium text-red-600">-${job.paymentBreakdown.stripeFee?.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Net:</span>
                                <p className="font-medium">${job.paymentBreakdown.netAmount?.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Handyman:</span>
                                <p className="font-medium text-green-600">${job.paymentBreakdown.handymanPayout?.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Platform:</span>
                                <p className="font-medium text-blue-600">${job.paymentBreakdown.platformFee?.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Released: {formatDate(job.paymentReleasedAt)}</span>
                          <span>Released By: {job.paymentReleasedBy || 'N/A'}</span>
                          {job.transferId && (
                            <span className="font-mono">Transfer: {job.transferId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminFundRelease;
