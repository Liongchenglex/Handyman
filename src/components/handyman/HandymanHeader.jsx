import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';
import UserMenu from '../common/UserMenu';

/**
 * HandymanHeader Component
 *
 * Custom header for authenticated handymen with integrated navigation tabs.
 * Displays user profile and logout functionality.
 *
 * Shares the BrandLogo and UserMenu primitives with the public Header so the
 * brand mark and account-dropdown behaviour are defined in one place.
 */
const HandymanHeader = ({ currentView, onViewChange }) => {
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();

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
        <div className="flex items-center justify-between gap-2 h-16">
          {/* Logo */}
          <BrandLogo to="/" subtitle="Handyman Portal" />

          {/* User Menu */}
          <UserMenu
            panelClassName="w-64"
            triggerClassName="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            trigger={
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {userProfile?.name || user?.displayName || 'Handyman'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userProfile?.serviceTypes?.[0] || 'Professional'}
                  </p>
                </div>
                {userProfile?.profileImageUrl ? (
                  <img
                    src={userProfile.profileImageUrl}
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
              </>
            }
          >
            {(close) => (
              <>
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {userProfile?.name || user?.displayName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {user?.email}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {userProfile?.verified ? (
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
                      close();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="material-symbols-outlined text-lg">person</span>
                    My Profile
                  </button>
                  <Link
                    to="/"
                    onClick={close}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="material-symbols-outlined text-lg">home</span>
                    Back to Home
                  </Link>
                  <button
                    onClick={() => {
                      close();
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </UserMenu>
        </div>

        {/* Navigation Tabs — horizontally scrollable on mobile so the tabs
            never overflow or wrap; buttons keep their labels and full tap
            height. `whitespace-nowrap` + `shrink-0` keep each tab intact. */}
        <div className="flex items-center gap-1 -mb-px overflow-x-auto">
          <button
            onClick={() => onViewChange('jobs')}
            className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
            className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
            className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
