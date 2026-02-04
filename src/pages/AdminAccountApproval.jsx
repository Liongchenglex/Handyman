import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * AdminAccountApproval Component
 *
 * Admin page for reviewing and approving/rejecting handyman registrations
 * Only accessible by authorized admin emails
 */
const AdminAccountApproval = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('pending');

  // Pending handymen state
  const [pendingHandymen, setPendingHandymen] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // Processed handymen state (approved/rejected)
  const [processedHandymen, setProcessedHandymen] = useState([]);
  const [loadingProcessed, setLoadingProcessed] = useState(false);
  const [processedFetched, setProcessedFetched] = useState(false);

  // Stripe onboarding state
  const [stripeHandymen, setStripeHandymen] = useState({ onboarded: [], notOnboarded: [] });
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [stripeFetched, setStripeFetched] = useState(false);

  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Admin emails - must match AdminFundRelease.jsx and AdminDashboard.jsx
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

  // Fetch pending handymen
  useEffect(() => {
    const fetchPendingHandymen = async () => {
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
        const handymenRef = collection(db, 'handymen');
        const q = query(
          handymenRef,
          where('status', '==', 'pending')
        );

        const snapshot = await getDocs(q);
        const handymenData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by registration date (newest first)
        handymenData.sort((a, b) => {
          const dateA = a.registeredAt ? new Date(a.registeredAt) : new Date(0);
          const dateB = b.registeredAt ? new Date(b.registeredAt) : new Date(0);
          return dateB - dateA;
        });

        setPendingHandymen(handymenData);
      } catch (error) {
        console.error('Error fetching pending handymen:', error);
        setError('Failed to fetch pending handymen');
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPendingHandymen();
  }, [authLoading, user, isAdmin]);

  // Fetch processed handymen when tab is switched
  useEffect(() => {
    const fetchProcessedHandymen = async () => {
      if (activeTab !== 'processed' || processedFetched || !isAdmin) return;

      try {
        setLoadingProcessed(true);
        const handymenRef = collection(db, 'handymen');
        const q = query(
          handymenRef,
          where('status', 'in', ['active', 'rejected'])
        );

        const snapshot = await getDocs(q);
        const handymenData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by processed date (newest first)
        handymenData.sort((a, b) => {
          const dateA = a.verifiedAt || a.rejectedAt ? new Date(a.verifiedAt || a.rejectedAt) : new Date(0);
          const dateB = b.verifiedAt || b.rejectedAt ? new Date(b.verifiedAt || b.rejectedAt) : new Date(0);
          return dateB - dateA;
        });

        setProcessedHandymen(handymenData);
        setProcessedFetched(true);
      } catch (error) {
        console.error('Error fetching processed handymen:', error);
      } finally {
        setLoadingProcessed(false);
      }
    };

    fetchProcessedHandymen();
  }, [activeTab, processedFetched, isAdmin]);

  // Fetch Stripe onboarding status when tab is switched
  useEffect(() => {
    const fetchStripeStatus = async () => {
      if (activeTab !== 'stripe' || stripeFetched || !isAdmin) return;

      try {
        setLoadingStripe(true);
        const handymenRef = collection(db, 'handymen');
        // Get all active handymen to check their Stripe status
        const q = query(
          handymenRef,
          where('status', '==', 'active')
        );

        const snapshot = await getDocs(q);
        const handymenData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Separate into onboarded and not onboarded
        // Uses stripeOnboardingCompleted field (set when handyman completes Stripe onboarding)
        const onboarded = handymenData.filter(h => h.stripeOnboardingCompleted === true);
        const notOnboarded = handymenData.filter(h => !h.stripeOnboardingCompleted);

        // Sort by name
        onboarded.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        notOnboarded.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setStripeHandymen({ onboarded, notOnboarded });
        setStripeFetched(true);
      } catch (error) {
        console.error('Error fetching Stripe status:', error);
      } finally {
        setLoadingStripe(false);
      }
    };

    fetchStripeStatus();
  }, [activeTab, stripeFetched, isAdmin]);

  // Approve handyman
  const handleApprove = async (handyman) => {
    if (!window.confirm(`Approve ${handyman.name} as a handyman?`)) return;

    try {
      setProcessingId(handyman.id);
      const handymanRef = doc(db, 'handymen', handyman.id);

      await updateDoc(handymanRef, {
        verified: true,
        verifiedAt: new Date().toISOString(),
        status: 'active',
        updatedAt: new Date().toISOString()
      });

      // Remove from pending list
      setPendingHandymen(prev => prev.filter(h => h.id !== handyman.id));

      // Add to processed list if already fetched
      if (processedFetched) {
        setProcessedHandymen(prev => [{
          ...handyman,
          verified: true,
          verifiedAt: new Date().toISOString(),
          status: 'active'
        }, ...prev]);
      }

      alert(`${handyman.name} has been approved successfully!`);
    } catch (error) {
      console.error('Error approving handyman:', error);
      alert(`Error approving handyman: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject handyman
  const handleReject = async (handyman) => {
    const reason = window.prompt(`Reason for rejecting ${handyman.name}? (optional)`);
    if (reason === null) return; // User cancelled

    try {
      setProcessingId(handyman.id);
      const handymanRef = doc(db, 'handymen', handyman.id);

      await updateDoc(handymanRef, {
        verified: false,
        rejectedAt: new Date().toISOString(),
        rejectedReason: reason || '',
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });

      // Remove from pending list
      setPendingHandymen(prev => prev.filter(h => h.id !== handyman.id));

      // Add to processed list if already fetched
      if (processedFetched) {
        setProcessedHandymen(prev => [{
          ...handyman,
          verified: false,
          rejectedAt: new Date().toISOString(),
          rejectedReason: reason || '',
          status: 'rejected'
        }, ...prev]);
      }

      alert(`${handyman.name} has been rejected.`);
    } catch (error) {
      console.error('Error rejecting handyman:', error);
      alert(`Error rejecting handyman: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">
              lock
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-4">Login Required</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please log in with an admin account to access this page.
          </p>
          <Link
            to="/handyman-auth"
            className="inline-block px-6 py-3 bg-primary text-black font-semibold rounded-xl hover:bg-opacity-80 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Not an admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">
              block
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            You do not have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Logged in as: {user.email}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Logout
            </button>
            <Link
              to="/"
              className="px-6 py-3 bg-primary text-black font-semibold rounded-xl hover:bg-opacity-80 transition-colors"
            >
              Go to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render handyman card
  const renderHandymanCard = (handyman, showActions = true) => (
    <div
      key={handyman.id}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {handyman.profileImageUrl ? (
            <img
              src={handyman.profileImageUrl}
              alt={handyman.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-gray-500">person</span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{handyman.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{handyman.email}</p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
          handyman.status === 'active'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : handyman.status === 'rejected'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        }`}>
          {handyman.status === 'active' ? 'Approved' : handyman.status === 'rejected' ? 'Rejected' : 'Pending'}
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Phone:</span>
          <p className="font-medium text-gray-900 dark:text-white">{handyman.phone}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Experience:</span>
          <p className="font-medium text-gray-900 dark:text-white">{handyman.experienceLevel}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Hourly Rate:</span>
          <p className="font-medium text-gray-900 dark:text-white">${handyman.hourlyRate}/hr</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Registered:</span>
          <p className="font-medium text-gray-900 dark:text-white">{formatDate(handyman.registeredAt)}</p>
        </div>
      </div>

      {/* Services */}
      <div className="mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">Services:</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {handyman.serviceTypes?.map((service, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md"
            >
              {service}
            </span>
          ))}
        </div>
      </div>

      {/* Service Areas */}
      <div className="mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">Service Areas:</span>
        <p className="text-sm text-gray-900 dark:text-white mt-1">
          {handyman.serviceAreas?.join(', ') || 'Not specified'}
        </p>
      </div>

      {/* Description */}
      {handyman.description && (
        <div className="mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">Description:</span>
          <p className="text-sm text-gray-900 dark:text-white mt-1 line-clamp-2">
            {handyman.description}
          </p>
        </div>
      )}

      {/* Documents */}
      {handyman.workExperienceUrls && handyman.workExperienceUrls.length > 0 && (
        <div className="mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">Documents:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {handyman.workExperienceUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">description</span>
                Doc {index + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Rejection reason (if rejected) */}
      {handyman.status === 'rejected' && handyman.rejectedReason && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <span className="text-sm text-red-600 dark:text-red-400 font-medium">Rejection Reason:</span>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{handyman.rejectedReason}</p>
        </div>
      )}

      {/* Actions */}
      {showActions && handyman.status === 'pending' && (
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleApprove(handyman)}
            disabled={processingId === handyman.id}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processingId === handyman.id ? (
              <LoadingSpinner />
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Approve
              </>
            )}
          </button>
          <button
            onClick={() => handleReject(handyman)}
            disabled={processingId === handyman.id}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processingId === handyman.id ? (
              <LoadingSpinner />
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">cancel</span>
                Reject
              </>
            )}
          </button>
        </div>
      )}

      {/* Firebase link */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href={`https://console.firebase.google.com/project/eazydone-d06cf/firestore/data/handymen/${handyman.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
        >
          View in Firebase Console →
        </a>
      </div>
    </div>
  );

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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account Approvals</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Review handyman registrations</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                {user.email}
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
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-primary text-black'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Pending ({pendingHandymen.length})
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'processed'
                ? 'bg-primary text-black'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Processed
          </button>
          <button
            onClick={() => setActiveTab('stripe')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'stripe'
                ? 'bg-primary text-black'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Stripe Onboarding
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <>
            {loadingPending ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : pendingHandymen.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-gray-400">check_circle</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">All caught up!</h3>
                <p className="text-gray-500 dark:text-gray-400">No pending handyman registrations to review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {pendingHandymen.map(handyman => renderHandymanCard(handyman, true))}
              </div>
            )}
          </>
        )}

        {/* Processed Tab */}
        {activeTab === 'processed' && (
          <>
            {loadingProcessed ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : processedHandymen.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-gray-400">history</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No history yet</h3>
                <p className="text-gray-500 dark:text-gray-400">Processed handyman registrations will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {processedHandymen.map(handyman => renderHandymanCard(handyman, false))}
              </div>
            )}
          </>
        )}

        {/* Stripe Onboarding Tab */}
        {activeTab === 'stripe' && (
          <>
            {loadingStripe ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Not Onboarded Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500">warning</span>
                    Not Onboarded ({stripeHandymen.notOnboarded.length})
                  </h3>
                  {stripeHandymen.notOnboarded.length === 0 ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
                      <span className="material-symbols-outlined text-3xl text-green-600 dark:text-green-400 mb-2">check_circle</span>
                      <p className="text-green-700 dark:text-green-300">All active handymen have completed Stripe onboarding!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stripeHandymen.notOnboarded.map(handyman => (
                        <div
                          key={handyman.id}
                          className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            {handyman.profileImageUrl ? (
                              <img
                                src={handyman.profileImageUrl}
                                alt={handyman.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-gray-500">person</span>
                              </div>
                            )}
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">{handyman.name}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{handyman.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-xs">
                              Not Completed
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">{handyman.phone}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Onboarded Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500">verified</span>
                    Onboarded ({stripeHandymen.onboarded.length})
                  </h3>
                  {stripeHandymen.onboarded.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                      <span className="material-symbols-outlined text-3xl text-gray-400 mb-2">credit_card_off</span>
                      <p className="text-gray-500 dark:text-gray-400">No handymen have completed Stripe onboarding yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stripeHandymen.onboarded.map(handyman => (
                        <div
                          key={handyman.id}
                          className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 p-4"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            {handyman.profileImageUrl ? (
                              <img
                                src={handyman.profileImageUrl}
                                alt={handyman.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-gray-500">person</span>
                              </div>
                            )}
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">{handyman.name}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{handyman.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs">
                              Complete
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">{handyman.phone}</span>
                          </div>
                          {handyman.stripeAccountStatus && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Status: {handyman.stripeAccountStatus}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdminAccountApproval;
