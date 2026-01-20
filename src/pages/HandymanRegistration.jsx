import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HandymanRegistration from '../components/handyman/HandymanRegistration';

/**
 * HandymanRegistration Page
 *
 * Page wrapper for the handyman registration component
 * Gets initial data from navigation state (no localStorage)
 */
const HandymanRegistrationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get email/password from navigation state
  const initialData = location.state || {};

  const handleRegistrationComplete = async (registrationData) => {
    // Firebase Auth already handles the session persistence
    alert('Registration completed successfully! Welcome to HandySG. Please check your email to verify your account.');

    // Small delay to ensure Firestore write has propagated
    // Then reload to trigger fresh AuthContext initialization
    await new Promise(resolve => setTimeout(resolve, 500));

    // Force page reload to ensure AuthContext fetches the newly created handyman profile
    window.location.href = '/handyman-auth';
  };

  const handleBackToAuth = () => {
    navigate('/handyman-auth');
  };

  return (
    <HandymanRegistration
      initialData={initialData}
      onRegistrationComplete={handleRegistrationComplete}
      onBackToAuth={handleBackToAuth}
    />
  );
};

export default HandymanRegistrationPage;