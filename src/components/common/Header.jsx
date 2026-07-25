import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from './BrandLogo';
import UserMenu from './UserMenu';

/**
 * Header
 *
 * Public, site-wide header. Uses the shared BrandLogo and UserMenu primitives
 * so the brand mark and the account-dropdown behaviour are defined once.
 */
const Header = () => {
  const navigate = useNavigate();
  const { user, userProfile, isAuthenticated, isHandyman, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-14">
          {/* Logo */}
          <BrandLogo to="/" />

          {/* Navigation — shrink-0 keeps the action buttons at full size */}
          <div className="flex items-center shrink-0 gap-1 sm:gap-2">
            {/* Help Button */}
            <Link
              to="/help"
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 min-w-[44px] min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-lg">help</span>
              <span className="hidden md:inline">Help</span>
            </Link>

            {/* Contact Us Button - Auto-scroll to contact section */}
            <Link
              to="/contact#contact"
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 min-w-[44px] min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              <span className="hidden md:inline">Contact</span>
            </Link>

            {/* Authenticated User Menu */}
            {isAuthenticated && userProfile ? (
              <UserMenu
                triggerClassName="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 min-h-[44px] text-sm font-medium bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors rounded-lg"
                trigger={
                  <>
                    <span className="material-symbols-outlined text-lg">
                      {isHandyman ? 'engineering' : 'person'}
                    </span>
                    <span className="hidden md:inline truncate max-w-[160px]">
                      {userProfile.name || user.email}
                    </span>
                    <span className="material-symbols-outlined text-sm shrink-0">expand_more</span>
                  </>
                }
              >
                {(close) => (
                  <>
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {userProfile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {user.email}
                      </p>
                      <p className="text-xs text-primary mt-1 capitalize">
                        {userProfile.role}
                      </p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      {isHandyman && (
                        <Link
                          to="/handyman-dashboard"
                          onClick={close}
                          className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span className="material-symbols-outlined text-lg">dashboard</span>
                          Dashboard
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          close();
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </UserMenu>
            ) : (
              /* Handyman Sign In */
              <Link
                to="/handyman-auth"
                className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 min-w-[44px] min-h-[44px] text-sm font-medium bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">engineering</span>
                <span className="hidden md:inline">Portal</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
