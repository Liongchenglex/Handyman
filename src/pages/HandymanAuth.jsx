import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HandymanAuth from '../components/handyman/HandymanAuth';

/**
 * HandymanAuth Page
 *
 * Page wrapper for the handyman authentication component
 * Uses Firebase Auth - no localStorage needed (Firebase persists automatically)
 * Redirects to dashboard if already logged in
 */
const HandymanAuthPage = () => {
  const navigate = useNavigate();
  const { user, isHandyman, isAdmin, loading, sessionExpired, clearSessionExpired } = useAuth();

  // Redirect an already-signed-in user to where they belong:
  // admins → the admin dashboard, handymen → the handyman dashboard.
  // Admins have no handyman profile, so they're matched on isAdmin first.
  useEffect(() => {
    if (loading || !user) return;
    if (isAdmin) {
      navigate('/admin', { replace: true });
    } else if (isHandyman) {
      navigate('/handyman-dashboard', { replace: true });
    }
  }, [user, isHandyman, isAdmin, loading, navigate]);

  const handleLoginSuccess = (userData) => {
    // Don't navigate here - let the useEffect handle it once AuthContext updates
    // This ensures userProfile is loaded and isHandyman is true before redirecting
  };

  const handleSignupSuccess = (userData) => {
    // Pass email/password to registration page via navigation state
    navigate('/handyman-registration', {
      state: {
        email: userData.email,
        password: userData.password
      }
    });
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't show auth form if already logged in (useEffect will redirect)
  if (user && (isHandyman || isAdmin)) {
    return null;
  }

  return (
    <>
      {/* Session expired notification banner */}
      {sessionExpired && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-3">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Your session has expired for security. Please sign in again.
              </p>
            </div>
            <button
              onClick={clearSessionExpired}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 ml-2"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <HandymanAuth
        onLoginSuccess={handleLoginSuccess}
        onSignupSuccess={handleSignupSuccess}
        onBackToHome={handleBackToHome}
      />
    </>
  );
};

export default HandymanAuthPage;