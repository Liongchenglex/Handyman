import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, isAuthenticated, isHandyman, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
            </svg>
            <span className="text-xl font-bold text-gray-900 dark:text-white">HandySG</span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Help Button */}
            <Link
              to="/help"
              className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-lg">help</span>
              <span className="hidden md:inline">Help</span>
            </Link>

            {/* Contact Us Button - Auto-scroll to contact section */}
            <Link
              to="/contact#contact"
              className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              <span className="hidden md:inline">Contact</span>
            </Link>

            {/* Authenticated User Menu */}
            {isAuthenticated && userProfile ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors rounded-lg"
                >
                  <span className="material-symbols-outlined text-lg">
                    {isHandyman ? 'engineering' : 'person'}
                  </span>
                  <span className="hidden md:inline">{userProfile.name || user.email}</span>
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    {/* Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
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
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="material-symbols-outlined text-lg">dashboard</span>
                            Dashboard
                          </Link>
                        )}
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
            ) : (
              /* Handyman Sign In */
              <Link
                to="/handyman-auth"
                className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors rounded-lg"
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