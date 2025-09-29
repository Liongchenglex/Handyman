import React from 'react';
import { useNavigate } from 'react-router-dom';
import HandymanAuth from '../components/handyman/HandymanAuth';

/**
 * HandymanAuth Page
 *
 * Page wrapper for the handyman authentication component
 */
const HandymanAuthPage = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = (userData) => {
    console.log('Handyman logged in:', userData);
    // Store user data in localStorage for demo
    localStorage.setItem('handymanUser', JSON.stringify(userData));
    // Navigate to dashboard
    navigate('/handyman-dashboard');
  };

  const handleSignupSuccess = (userData) => {
    console.log('Handyman signup successful:', userData);
    // Store temporary user data
    localStorage.setItem('tempHandymanUser', JSON.stringify(userData));
    // Navigate to registration form
    navigate('/handyman-registration');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <HandymanAuth
      onLoginSuccess={handleLoginSuccess}
      onSignupSuccess={handleSignupSuccess}
      onBackToHome={handleBackToHome}
    />
  );
};

export default HandymanAuthPage;