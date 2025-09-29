import React from 'react';
import { useNavigate } from 'react-router-dom';
import HandymanRegistration from '../components/handyman/HandymanRegistration';

/**
 * HandymanRegistration Page
 *
 * Page wrapper for the handyman registration component
 */
const HandymanRegistrationPage = () => {
  const navigate = useNavigate();

  // Get temporary user data from signup
  const getTempUserData = () => {
    const tempData = localStorage.getItem('tempHandymanUser');
    return tempData ? JSON.parse(tempData) : {};
  };

  const handleRegistrationComplete = (registrationData) => {
    console.log('Handyman registration completed:', registrationData);

    // Clear temporary data
    localStorage.removeItem('tempHandymanUser');

    // Store complete handyman profile
    const completeUserData = {
      ...registrationData,
      handymanId: 'hm_' + Date.now(),
      isAuthenticated: true,
      profileComplete: true
    };

    localStorage.setItem('handymanUser', JSON.stringify(completeUserData));

    // Show success message and navigate to dashboard
    alert('Registration completed successfully! Welcome to HandySG.');
    navigate('/handyman-dashboard');
  };

  const handleBackToAuth = () => {
    navigate('/handyman-auth');
  };

  return (
    <HandymanRegistration
      initialData={getTempUserData()}
      onRegistrationComplete={handleRegistrationComplete}
      onBackToAuth={handleBackToAuth}
    />
  );
};

export default HandymanRegistrationPage;