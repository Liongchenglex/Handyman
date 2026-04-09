import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * AdminDashboard Component
 *
 * Main admin hub page with links to admin sub-pages
 * Only accessible by authorized admin emails
 */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();

  const [stats, setStats] = useState({
    pendingHandymen: 0,
    pendingFundReleases: 0,
    activeDisputes: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Admin emails - must match AdminFundRelease.jsx
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

  // Fetch stats for dashboard cards
  useEffect(() => {
    const fetchStats = async () => {
      if (authLoading || !user || !isAdmin) {
        setLoadingStats(false);
        return;
      }

      try {
        setLoadingStats(true);

        // Count pending handymen
        const handymenRef = collection(db, 'handymen');
        const pendingHandymenQuery = query(
          handymenRef,
          where('status', '==', 'pending')
        );
        const handymenSnapshot = await getDocs(pendingHandymenQuery);
        const pendingHandymenCount = handymenSnapshot.size;

        // Count pending fund releases
        const jobsRef = collection(db, 'jobs');
        const pendingJobsQuery = query(
          jobsRef,
          where('status', '==', 'pending_admin_approval')
        );
        const jobsSnapshot = await getDocs(pendingJobsQuery);
        const pendingFundReleasesCount = jobsSnapshot.size;

        // Count active disputes
        const disputedJobsQuery = query(
          jobsRef,
          where('status', '==', 'disputed')
        );
        const disputedSnapshot = await getDocs(disputedJobsQuery);
        const activeDisputesCount = disputedSnapshot.size;

        setStats({
          pendingHandymen: pendingHandymenCount,
          pendingFundReleases: pendingFundReleasesCount,
          activeDisputes: activeDisputesCount
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [authLoading, user, isAdmin]);

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
            You do not have permission to access the admin dashboard.
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

  // Admin dashboard
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-black">admin_panel_settings</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">EazyDone Operations</p>
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, Admin
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage handyman approvals and fund releases from here.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Pending Handymen Card */}
          <Link
            to="/admin/account-approval"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400">
                  person_add
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Account Approvals
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Review and approve handyman registrations
            </p>
            {loadingStats ? (
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${stats.pendingHandymen > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                  {stats.pendingHandymen}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">pending</span>
              </div>
            )}
          </Link>

          {/* Pending Fund Releases Card */}
          <Link
            to="/admin/fund-release"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-green-600 dark:text-green-400">
                  payments
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Fund Releases
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Approve payments to handymen
            </p>
            {loadingStats ? (
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${stats.pendingFundReleases > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                  {stats.pendingFundReleases}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">pending</span>
              </div>
            )}
          </Link>

          {/* Disputed Jobs Card */}
          <Link
            to="/admin/disputed-jobs"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400">
                  gavel
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Disputed Jobs
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Review and resolve job disputes
            </p>
            {loadingStats ? (
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${stats.activeDisputes > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                  {stats.activeDisputes}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">active</span>
              </div>
            )}
          </Link>

          {/* Quick Links Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-purple-600 dark:text-purple-400">
                  link
                </span>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Quick Links
            </h3>
            <div className="space-y-2">
              <a
                href="https://console.firebase.google.com/project/eazydone-d06cf/firestore"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">database</span>
                Firebase Console
              </a>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">credit_card</span>
                Stripe Dashboard
              </a>
              <a
                href="https://dashboard.emailjs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                EmailJS Dashboard
              </a>
              <Link
                to="/"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">home</span>
                View Website
              </Link>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Admin Guide</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• <strong>Account Approvals:</strong> Review new handyman registrations and approve/reject them</li>
                <li>• <strong>Fund Releases:</strong> Release payments to handymen after job completion is confirmed</li>
                <li>• <strong>Disputed Jobs:</strong> Review and resolve disputes between customers and handymen</li>
                <li>• Approval links from emails will also work when you're logged in</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
