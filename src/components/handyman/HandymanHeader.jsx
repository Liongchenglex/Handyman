import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * HandymanHeader Component
 *
 * Custom header for authenticated handymen with integrated navigation tabs
 * Displays user profile and logout functionality
 */
const HandymanHeader = ({ currentView, onViewChange }) => {
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
            </svg>
            <div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">HandySG</span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Handyman Portal</span>
            </div>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {userProfile?.name || user?.displayName || 'Handyman'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userProfile?.handyman?.serviceTypes?.[0] || 'Professional'}
                </p>
              </div>
              {userProfile?.handyman?.profileImageUrl ? (
                <img
                  src={userProfile.handyman.profileImageUrl}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary/30"
                />
              ) : (
                <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-2">
                  <span className="material-symbols-outlined text-primary text-xl">
                    engineering
                  </span>
                </div>
              )}
              <span className="material-symbols-outlined text-gray-400 text-sm">
                expand_more
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                {/* Menu */}
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {userProfile?.name || user?.displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user?.email}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {userProfile?.handyman?.verified ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                          ⚠ Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onViewChange('profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="material-symbols-outlined text-lg">person</span>
                      My Profile
                    </button>
                    <Link
                      to="/"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="material-symbols-outlined text-lg">home</span>
                      Back to Home
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 -mb-px">
          <button
            onClick={() => onViewChange('jobs')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              currentView === 'jobs'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-lg">work</span>
            Available Jobs
          </button>
          <button
            onClick={() => onViewChange('my-jobs')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              currentView === 'my-jobs'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-lg">checklist</span>
            My Jobs
          </button>
          <button
            onClick={() => onViewChange('profile')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              currentView === 'profile'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-lg">person</span>
            Profile
          </button>
        </div>
      </div>
    </header>
  );
};

export default HandymanHeader;
