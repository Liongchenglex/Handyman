import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * AdminDisputedJobs Component
 *
 * Admin page for viewing and managing disputed jobs.
 * Displays all jobs with status 'disputed' and allows admins to
 * resolve disputes by either refunding the customer or releasing funds to the handyman.
 *
 * Tabs:
 *  - Active Disputes: Jobs currently in dispute
 *  - Resolved: Previously resolved dispute cases
 */
const AdminDisputedJobs = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('active');

  // Active disputes state
  const [activeDisputes, setActiveDisputes] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);

  // Resolved disputes state
  const [resolvedDisputes, setResolvedDisputes] = useState([]);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [resolvedFetched, setResolvedFetched] = useState(false);

  // Processing state for actions
  const [processingJobId, setProcessingJobId] = useState(null);

  // Expanded card state for viewing full details
  const [expandedJobId, setExpandedJobId] = useState(null);

  const [error, setError] = useState(null);

  // Admin emails - must match other admin pages
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

  /**
   * Enrich jobs with handyman and customer names where missing
   */
  const enrichJobsWithNames = async (jobs) => {
    return Promise.all(
      jobs.map(async (job) => {
        const enriched = { ...job };

        // Fetch handyman name if missing
        if (job.handymanId && !job.handymanName) {
          try {
            const handymanDoc = await getDoc(doc(db, 'handymen', job.handymanId));
            if (handymanDoc.exists()) {
              enriched.handymanName = handymanDoc.data().name;
            }
          } catch (err) {
            console.error('Error fetching handyman:', err);
          }
        }

        return enriched;
      })
    );
  };

  // Fetch active disputes on mount
  useEffect(() => {
    const fetchActiveDisputes = async () => {
      if (authLoading) return;

      if (!user) {
        setError('Please log in to access this page');
        setLoadingActive(false);
        return;
      }

      if (!isAdmin) {
        setError('You do not have permission to access this page');
        setLoadingActive(false);
        return;
      }

      try {
        setLoadingActive(true);
        const jobsRef = collection(db, 'jobs');
        const q = query(
          jobsRef,
          where('status', '==', 'disputed')
        );

        const snapshot = await getDocs(q);
        let jobsData = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        // Enrich with names
        jobsData = await enrichJobsWithNames(jobsData);

        // Sort by disputedAt descending (most recent first)
        jobsData.sort((a, b) => {
          const dateA = a.disputedAt?.toDate?.() || new Date(a.disputedAt) || new Date(0);
          const dateB = b.disputedAt?.toDate?.() || new Date(b.disputedAt) || new Date(0);
          return dateB - dateA;
        });

        setActiveDisputes(jobsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching disputed jobs:', err);
        setError('Failed to load disputed jobs. Please try again.');
      } finally {
        setLoadingActive(false);
      }
    };

    fetchActiveDisputes();
  }, [user, authLoading, isAdmin]);

  // Fetch resolved disputes when tab is clicked (lazy load)
  const fetchResolvedDisputes = async () => {
    if (resolvedFetched) return;

    try {
      setLoadingResolved(true);
      const jobsRef = collection(db, 'jobs');
      const q = query(
        jobsRef,
        where('disputeResolution', '!=', null)
      );

      const snapshot = await getDocs(q);
      let jobsData = snapshot.docs
        .map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
        // Only show jobs that were resolved (not still actively disputed)
        .filter(job => job.status !== 'disputed');

      // Enrich with names
      jobsData = await enrichJobsWithNames(jobsData);

      // Sort by resolution date descending
      jobsData.sort((a, b) => {
        const dateA = a.disputeResolvedAt?.toDate?.() || new Date(a.disputeResolvedAt) || new Date(0);
        const dateB = b.disputeResolvedAt?.toDate?.() || new Date(b.disputeResolvedAt) || new Date(0);
        return dateB - dateA;
      });

      setResolvedDisputes(jobsData);
      setResolvedFetched(true);
    } catch (err) {
      console.error('Error fetching resolved disputes:', err);
    } finally {
      setLoadingResolved(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'resolved' && !resolvedFetched) {
      fetchResolvedDisputes();
    }
  };

  /**
   * Resolve a dispute by refunding the customer
   * Updates job status to 'cancelled' with dispute resolution details
   */
  const handleRefundCustomer = async (job) => {
    const reason = window.prompt(
      `Refund customer for job "${job.serviceType}"?\n\nThis will mark the job as cancelled and initiate a refund.\n\nPlease enter a resolution note:`
    );

    if (reason === null) return; // User cancelled the prompt

    setProcessingJobId(job.id);

    try {
      const jobRef = doc(db, 'jobs', job.id);
      await updateDoc(jobRef, {
        status: 'cancelled',
        disputeResolution: 'refunded',
        disputeResolutionNote: reason || 'Refund issued to customer',
        disputeResolvedAt: new Date(),
        disputeResolvedBy: user.email,
      });

      // Move from active to resolved
      setActiveDisputes(prev => prev.filter(j => j.id !== job.id));
      setResolvedDisputes(prev => [{
        ...job,
        status: 'cancelled',
        disputeResolution: 'refunded',
        disputeResolutionNote: reason || 'Refund issued to customer',
        disputeResolvedAt: new Date(),
        disputeResolvedBy: user.email,
      }, ...prev]);

      alert('Dispute resolved — customer refund initiated.');
    } catch (err) {
      console.error('Error resolving dispute (refund):', err);
      alert('Failed to resolve dispute. Please try again.');
    } finally {
      setProcessingJobId(null);
    }
  };

  /**
   * Resolve a dispute by releasing funds to the handyman
   * Updates job status to 'pending_admin_approval' so it flows through fund release
   */
  const handleReleaseToHandyman = async (job) => {
    const reason = window.prompt(
      `Release funds to handyman for job "${job.serviceType}"?\n\nThis will move the job to the Fund Release queue for payment processing.\n\nPlease enter a resolution note:`
    );

    if (reason === null) return; // User cancelled the prompt

    setProcessingJobId(job.id);

    try {
      const jobRef = doc(db, 'jobs', job.id);
      await updateDoc(jobRef, {
        status: 'pending_admin_approval',
        disputeResolution: 'released_to_handyman',
        disputeResolutionNote: reason || 'Funds released to handyman after review',
        disputeResolvedAt: new Date(),
        disputeResolvedBy: user.email,
      });

      // Move from active to resolved
      setActiveDisputes(prev => prev.filter(j => j.id !== job.id));
      setResolvedDisputes(prev => [{
        ...job,
        status: 'pending_admin_approval',
        disputeResolution: 'released_to_handyman',
        disputeResolutionNote: reason || 'Funds released to handyman after review',
        disputeResolvedAt: new Date(),
        disputeResolvedBy: user.email,
      }, ...prev]);

      alert('Dispute resolved — job moved to Fund Release queue.');
    } catch (err) {
      console.error('Error resolving dispute (release):', err);
      alert('Failed to resolve dispute. Please try again.');
    } finally {
      setProcessingJobId(null);
    }
  };

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const date = dateValue?.toDate?.() || new Date(dateValue);
    return date.toLocaleString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Get badge styling for dispute resolution type
   */
  const getResolutionBadge = (resolution) => {
    switch (resolution) {
      case 'refunded':
        return {
          text: 'Refunded',
          className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
        };
      case 'released_to_handyman':
        return {
          text: 'Released to Handyman',
          className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
        };
      default:
        return {
          text: 'Resolved',
          className: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
        };
    }
  };

  // Loading state
  if (authLoading || loadingActive) {
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
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">arrow_back</span>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Disputed Jobs</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Review and resolve job disputes</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleTabChange('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-primary text-black'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Active Disputes ({activeDisputes.length})
          </button>
          <button
            onClick={() => handleTabChange('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'resolved'
                ? 'bg-primary text-black'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Resolved ({resolvedDisputes.length})
          </button>
        </div>

        {/* Active Disputes Tab */}
        {activeTab === 'active' && (
          <>
            {activeDisputes.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">
                    check_circle
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Disputes</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  There are no jobs currently in dispute. All clear!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDisputes.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
                  >
                    {/* Job Header */}
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        {/* Title & Status Badge */}
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {job.serviceType}
                          </h3>
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                            Disputed
                          </span>
                        </div>

                        {/* Key Details Grid */}
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
                            <p className="font-bold text-lg text-red-600 dark:text-red-400">
                              ${job.estimatedBudget}
                            </p>
                          </div>
                        </div>

                        {/* Dispute Reason */}
                        {job.disputeReason && (
                          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                            <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">report</span>
                              Dispute Reason
                            </h4>
                            <p className="text-sm text-red-800 dark:text-red-200">{job.disputeReason}</p>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Created: {formatDate(job.createdAt)}</span>
                          <span>Disputed: {formatDate(job.disputedAt)}</span>
                          {job.completedAt && <span>Completed: {formatDate(job.completedAt)}</span>}
                        </div>

                        {/* Expandable Details */}
                        <button
                          onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                          className="mt-3 text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {expandedJobId === job.id ? 'expand_less' : 'expand_more'}
                          </span>
                          {expandedJobId === job.id ? 'Hide Details' : 'View Full Details'}
                        </button>

                        {expandedJobId === job.id && (
                          <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                            {job.description && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Job Description:</span>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">{job.description}</p>
                              </div>
                            )}
                            {job.address && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Location:</span>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">{job.address}</p>
                              </div>
                            )}
                            {job.preferredDate && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Preferred Date:</span>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">{formatDate(job.preferredDate)}</p>
                              </div>
                            )}
                            {job.customerEmail && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Customer Email:</span>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">{job.customerEmail}</p>
                              </div>
                            )}
                            {/* WhatsApp Contact Links */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              {job.customerPhone && (
                                <a
                                  href={`https://wa.me/${job.customerPhone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-sm">chat</span>
                                  WhatsApp Customer
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 lg:min-w-[180px]">
                        <button
                          onClick={() => handleRefundCustomer(job)}
                          disabled={processingJobId === job.id}
                          className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                          {processingJobId === job.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <span className="material-symbols-outlined text-sm">undo</span>
                          )}
                          Refund Customer
                        </button>
                        <button
                          onClick={() => handleReleaseToHandyman(job)}
                          disabled={processingJobId === job.id}
                          className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                          {processingJobId === job.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <span className="material-symbols-outlined text-sm">payments</span>
                          )}
                          Release to Handyman
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info Legend */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Dispute Resolution Guide:</h4>
              <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• <strong>Refund Customer:</strong> Cancels the job and initiates a refund to the customer</li>
                <li>• <strong>Release to Handyman:</strong> Moves the job to the Fund Release queue for payment to the handyman</li>
                <li>• Review the dispute reason and contact both parties before making a decision</li>
                <li>• Use the WhatsApp links to communicate directly with the customer or handyman</li>
              </ul>
            </div>
          </>
        )}

        {/* Resolved Disputes Tab */}
        {activeTab === 'resolved' && (
          <>
            {loadingResolved ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : resolvedDisputes.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-gray-400">
                    history
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">No Resolved Disputes</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Resolved dispute cases will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {resolvedDisputes.map((job) => {
                  const badge = getResolutionBadge(job.disputeResolution);
                  return (
                    <div
                      key={job.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1">
                          {/* Title & Resolution Badge */}
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                              {job.serviceType}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                              {badge.text}
                            </span>
                          </div>

                          {/* Key Details Grid */}
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
                              <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                              <p className="font-bold text-lg text-gray-900 dark:text-white">
                                ${job.estimatedBudget}
                              </p>
                            </div>
                          </div>

                          {/* Resolution Note */}
                          {job.disputeResolutionNote && (
                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Resolution Note</h4>
                              <p className="text-sm text-gray-900 dark:text-white">{job.disputeResolutionNote}</p>
                            </div>
                          )}

                          {/* Dispute Reason */}
                          {job.disputeReason && (
                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                              <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Original Dispute Reason</h4>
                              <p className="text-sm text-red-800 dark:text-red-200">{job.disputeReason}</p>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Disputed: {formatDate(job.disputedAt)}</span>
                            <span>Resolved: {formatDate(job.disputeResolvedAt)}</span>
                            <span>Resolved By: {job.disputeResolvedBy || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDisputedJobs;
