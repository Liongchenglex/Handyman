import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HandymanHeader from '../components/handyman/HandymanHeader';
import JobBoard from '../components/handyman/JobBoard';
import PendingStatusView from '../components/handyman/status-views/PendingStatusView';
import RejectedStatusView from '../components/handyman/status-views/RejectedStatusView';
import SuspendedStatusView from '../components/handyman/status-views/SuspendedStatusView';
import MyJobsView from '../components/handyman/MyJobsView';
import ProfileView from '../components/handyman/ProfileView';
import StripeOnboardingPrompt from '../components/handyman/StripeOnboardingPrompt';
import { updateHandyman, getHandyman } from '../services/firebase/collections';

/**
 * HandymanDashboard Page
 *
 * Main dashboard for authenticated handymen
 * Shows different views based on handyman status:
 * - Pending: Application under review
 * - Rejected: Application not approved
 * - Suspended: Account suspended
 * - Active: Full dashboard with job board
 *
 * Uses Firebase AuthContext for user data and role checking
 */
const HandymanDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, isHandyman, loading } = useAuth();
  const [currentView, setCurrentView] = useState('jobs'); // 'jobs', 'my-jobs', 'profile'

  // Redirect if not authenticated or not a handyman
  useEffect(() => {
    if (!loading && (!user || !isHandyman)) {
      navigate('/handyman-auth');
    }
  }, [user, isHandyman, loading, navigate]);

  // Handle Stripe onboarding return URL
  useEffect(() => {
    const handleStripeReturn = async () => {
      const onboardingComplete = searchParams.get('stripe_onboarding');
      if (onboardingComplete === 'complete' && user) {
        console.log('✅ Handyman returned from Stripe onboarding');

        try {
          // Update handyman document
          await updateHandyman(user.uid, {
            stripeOnboardingCompleted: true,
            stripeAccountStatus: 'pending',
            updatedAt: new Date().toISOString()
          });

          console.log('✅ Firestore updated, reloading page...');

          // Reload the page to refresh AuthContext and remove query param
          // This ensures the UI updates with the new data
          window.location.href = '/handyman-dashboard';
        } catch (error) {
          console.error('Error updating handyman after Stripe onboarding:', error);
        }
      }
    };

    if (user) {
      handleStripeReturn();
    }
  }, [user, searchParams]);

  const handleJobSelect = (job) => {
    console.log('Job selected after expressing interest:', job);
    // After expressing interest, switch to My Jobs tab to see the accepted job
    setCurrentView('my-jobs');
  };

  // Show loading state while checking authentication
  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Get handyman status from profile
  const handymanStatus = userProfile?.handyman?.status || 'pending';
  const handymanVerified = userProfile?.handyman?.verified || false;
  const handymanProfile = userProfile?.handyman;

  console.log('🔍 [HandymanDashboard] Handyman profile:', handymanProfile);
  console.log('  - status:', handymanStatus);
  console.log('  - verified:', handymanVerified);
  console.log('  - stripeOnboardingCompleted:', handymanProfile?.stripeOnboardingCompleted);

  // Check handyman status and show appropriate view
  // Priority order: pending → rejected → suspended → active
  if (handymanStatus === 'pending') {
    return <PendingStatusView userProfile={userProfile} />;
  }

  if (handymanStatus === 'rejected') {
    return <RejectedStatusView userProfile={userProfile} />;
  }

  if (handymanStatus === 'suspended') {
    return <SuspendedStatusView userProfile={userProfile} />;
  }

  // Only show full dashboard if status is 'active' and verified
  if (handymanStatus !== 'active' || !handymanVerified) {
    return <PendingStatusView userProfile={userProfile} />;
  }

  // Check if handyman needs Stripe onboarding
  // Show onboarding if: verified + active + no Stripe onboarding completed
  const needsStripeOnboarding =
    handymanStatus === 'active' &&
    handymanVerified === true &&
    !handymanProfile?.stripeOnboardingCompleted;

  console.log('  ➡️ needsStripeOnboarding:', needsStripeOnboarding);

  if (needsStripeOnboarding) {
    return <StripeOnboardingPrompt handyman={handymanProfile} />;
  }

  // Active handyman with Stripe onboarding complete - show full dashboard
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <main>
        {currentView === 'jobs' && (
          <JobBoard onJobSelect={handleJobSelect} />
        )}
        {currentView === 'my-jobs' && (
          <MyJobsView user={user} onViewChange={setCurrentView} />
        )}
        {currentView === 'profile' && (
          <ProfileView user={user} userProfile={userProfile} />
        )}
      </main>
    </div>
  );
};

export default HandymanDashboard;
