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
import { callFunction } from '../services/api/cloudFunctions';

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

  // Lock the UI to a stable "finalizing" screen the moment we land on the
  // post-Stripe return URL — initialised from the query param so the very
  // first paint is the spinner, NOT the onboarding prompt. Without this,
  // AuthContext is still serving the stale `stripeOnboardingCompleted: false`
  // (the server-side sync hasn't run yet), so the dashboard router would
  // briefly mount StripeOnboardingPrompt before the post-sync hard reload —
  // the "back to the onboarding screen" flicker. Stays true until the reload
  // in the return-URL effect below replaces the entire page.
  const [isFinalizingStripe] = useState(
    () => searchParams.get('stripe_onboarding') === 'complete'
  );

  // Redirect if not authenticated or not a handyman
  useEffect(() => {
    if (!loading && (!user || !isHandyman)) {
      navigate('/handyman-auth');
    }
  }, [user, isHandyman, loading, navigate]);

  // Handle Stripe onboarding return URL.
  //
  // SECURITY: Stripe sends the user to `return_url` whenever they LEAVE the
  // onboarding flow — including when they abandon it half-way and click
  // "Return to EasyDoneHandyman". The `?stripe_onboarding=complete` param is
  // therefore NOT proof of completion, and the client must not be the one to
  // decide. We call the server function `syncStripeOnboardingStatus`, which
  // verifies the real account state with Stripe and writes the authoritative
  // `stripeOnboardingCompleted` flag via the Admin SDK. The client can no
  // longer write that flag (locked in firestore.rules), so a handyman cannot
  // bypass onboarding by faking the redirect or editing their own doc. If the
  // account isn't genuinely complete, the dashboard re-shows the prompt.
  useEffect(() => {
    const handleStripeReturn = async () => {
      const onboardingComplete = searchParams.get('stripe_onboarding');
      if (onboardingComplete !== 'complete' || !user) return;

      try {
        const result = await callFunction('syncStripeOnboardingStatus', {}, { requireAuth: true });
        // Stash the sync result so StripeOnboardingPrompt can tell the
        // handyman exactly what Stripe still needs — instead of silently
        // bouncing them back to the generic prompt with no explanation.
        // Skipped when fully onboarded since the prompt won't render then.
        if (result?.onboardingComplete) {
          sessionStorage.removeItem('stripeSyncResult');
        } else {
          sessionStorage.setItem('stripeSyncResult', JSON.stringify(result || {}));
        }
      } catch (error) {
        // Fail closed: on error we do NOT grant access; the server leaves the
        // flag unset and the prompt stays. We DO surface the error to the
        // prompt so the handyman knows something went wrong rather than
        // silently looking at the same screen.
        console.error('Error syncing Stripe onboarding status:', error);
        sessionStorage.setItem(
          'stripeSyncResult',
          JSON.stringify({ error: error.message || 'Failed to verify Stripe status. Please try again.' })
        );
      } finally {
        // Reload to refresh AuthContext (picks up the server-written flag) and
        // strip the query param so this effect doesn't re-run.
        window.location.href = '/handyman-dashboard';
      }
    };

    handleStripeReturn();
  }, [user, searchParams]);

  const handleJobSelect = (job) => {
    // After expressing interest, switch to My Jobs tab to see the accepted job
    setCurrentView('my-jobs');
  };

  // Stripe return-URL finalizing screen. MUST be checked before any other
  // routing because AuthContext's userProfile is still the pre-sync snapshot
  // here (sync runs in the effect above and triggers a hard reload). Without
  // this guard the dashboard would briefly mount StripeOnboardingPrompt on
  // top of stale data, producing the "bounces back to onboarding" flicker.
  if (isFinalizingStripe) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Finalizing your Stripe setup
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Verifying your account with Stripe and preparing your dashboard. This usually takes a few seconds…
          </p>
        </div>
      </div>
    );
  }

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
  // After DRY refactor: userProfile IS the handyman profile (not nested)
  const handymanStatus = userProfile?.status || 'pending';
  const handymanVerified = userProfile?.verified || false;
  const handymanProfile = userProfile;

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
