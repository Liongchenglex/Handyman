import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HandymanRegistration from '../components/handyman/HandymanRegistration';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * HandymanRegistration Page
 *
 * Page wrapper for the handyman registration component
 * Gets initial data from navigation state (no localStorage)
 */
const HandymanRegistrationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isHandyman, loading } = useAuth();

  // Guard: a user who is already a registered handyman has no business
  // on the registration form — send them to their dashboard. This
  // mirrors the guard on the /handyman-auth page. (An anonymous
  // customer is allowed through — a customer may legitimately register
  // as a handyman.)
  useEffect(() => {
    if (!loading && user && isHandyman) {
      navigate('/handyman-dashboard', { replace: true });
    }
  }, [user, isHandyman, loading, navigate]);

  // Get email/password from navigation state
  const initialData = location.state || {};

  const handleRegistrationComplete = async (registrationData) => {
    // Firebase Auth already handles the session persistence
    alert('Registration completed successfully! Welcome to EasyDoneHandyman. Please check your email to verify your account.');

    // Small delay to ensure Firestore write has propagated
    // Then reload to trigger fresh AuthContext initialization
    await new Promise(resolve => setTimeout(resolve, 500));

    // Force page reload to ensure AuthContext fetches the newly created handyman profile
    window.location.href = '/handyman-auth';
  };

  const handleBackToAuth = () => {
    navigate('/handyman-auth');
  };

  // While auth state resolves, or if the guard above is about to
  // redirect an already-registered handyman, don't flash the form.
  if (loading || (user && isHandyman)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <HandymanRegistration
      initialData={initialData}
      onRegistrationComplete={handleRegistrationComplete}
      onBackToAuth={handleBackToAuth}
    />
  );
};

export default HandymanRegistrationPage;