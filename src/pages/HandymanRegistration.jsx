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

  const handleRegistrationComplete = (registrationData) => {
    console.log('Handyman registration completed:', registrationData);

    // Firebase Auth already handles the session persistence
    // Just show success message and navigate to dashboard
    alert('Registration completed successfully! Welcome to HandySG. Please check your email to verify your account.');
    navigate('/handyman-dashboard');
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