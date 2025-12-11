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
  const { user, isHandyman, loading } = useAuth();

  // Redirect if already logged in as handyman
  useEffect(() => {
    if (!loading && user && isHandyman) {
      console.log('Already logged in as handyman, redirecting to dashboard...');
      navigate('/handyman-dashboard', { replace: true });
    }
  }, [user, isHandyman, loading, navigate]);

  const handleLoginSuccess = (userData) => {
    console.log('Handyman logged in:', userData);
    // Firebase Auth automatically persists the session
    // Navigate to dashboard - use replace to prevent back button issues
    navigate('/handyman-dashboard', { replace: true });
  };

  const handleSignupSuccess = (userData) => {
    console.log('Handyman signup successful:', userData);
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
  if (user && isHandyman) {
    return null;
  }

  return (
    <HandymanAuth
      onLoginSuccess={handleLoginSuccess}
      onSignupSuccess={handleSignupSuccess}
      onBackToHome={handleBackToHome}
    />
  );
};

export default HandymanAuthPage;