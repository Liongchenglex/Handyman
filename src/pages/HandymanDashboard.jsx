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
    if (!loading) {
      if (!user) {
        console.log('No user found, redirecting to handyman-auth');
        navigate('/handyman-auth', { replace: true });
      } else if (!isHandyman && userProfile) {
        // Only redirect if we have userProfile loaded and it's not a handyman
        console.log('User is not a handyman, redirecting to handyman-auth');
        navigate('/handyman-auth', { replace: true });
      }
    }
  }, [user, isHandyman, userProfile, loading, navigate]);

  // Handle Stripe onboarding return URL
  useEffect(() => {
    const handleStripeReturn = async () => {
      const onboardingParam = searchParams.get('stripe_onboarding');
      if (onboardingParam === 'complete' && user && userProfile?.handyman?.stripeConnectedAccountId) {
        console.log('🔄 Handyman returned from Stripe - verifying completion...');

        try {
          const { getAccountStatus } = await import('../services/stripe/stripeApi');
          const accountId = userProfile.handyman.stripeConnectedAccountId;

          // CRITICAL: Verify with Stripe that onboarding is actually complete
          const accountStatus = await getAccountStatus(accountId);

          console.log('📊 Stripe account status:', accountStatus);

          // Only mark as complete if Stripe confirms detailsSubmitted and chargesEnabled
          // Note: Backend returns camelCase fields
          if (accountStatus.detailsSubmitted && accountStatus.chargesEnabled) {
            console.log('✅ Stripe onboarding verified as complete');

            await updateHandyman(user.uid, {
              stripeOnboardingCompleted: true,
              stripeAccountStatus: 'complete',
              stripeChargesEnabled: true,
              stripePayoutsEnabled: accountStatus.payoutsEnabled || false,
              updatedAt: new Date().toISOString()
            });

            console.log('✅ Firestore updated, reloading page...');
            window.location.href = '/handyman-dashboard';
          } else {
            console.log('⚠️ Stripe onboarding NOT complete - handyman must finish setup');
            // Remove the query param but don't mark as complete
            window.location.href = '/handyman-dashboard';
          }
        } catch (error) {
          console.error('Error verifying Stripe onboarding:', error);
          // On error, remove query param and let user try again
          window.location.href = '/handyman-dashboard';
        }
      }
    };

    if (user && userProfile) {
      handleStripeReturn();
    }
  }, [user, userProfile, searchParams]);

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

  // CRITICAL: Stripe onboarding is REQUIRED for active, verified handymen
  // Check if handyman has completed Stripe onboarding
  const hasCompletedStripeOnboarding = handymanProfile?.stripeOnboardingCompleted === true;

  console.log('  ➡️ hasCompletedStripeOnboarding:', hasCompletedStripeOnboarding);
  console.log('  ➡️ stripeConnectedAccountId:', handymanProfile?.stripeConnectedAccountId);

  // ALWAYS show Stripe onboarding prompt if not completed, regardless of navigation
  if (!hasCompletedStripeOnboarding) {
    console.log('  🚫 Stripe onboarding required - blocking dashboard access');
    return <StripeOnboardingPrompt handyman={handymanProfile} />;
  }

  // Active handyman with Stripe onboarding complete - show full dashboard
  console.log('  ✅ All requirements met - showing full dashboard');
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
