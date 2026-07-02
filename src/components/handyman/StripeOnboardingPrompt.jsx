import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createConnectedAccount, createAccountLink } from '../../services/stripe/stripeApi';
import { useAuth } from '../../context/AuthContext';

// Human-readable labels for Stripe's `requirements.currently_due` field
// codes. The raw codes (e.g. "representative.dob.day") leak Stripe's
// schema and confuse the handyman — we surface a friendly label instead.
// Several codes map to the same label on purpose (e.g. first_name and
// last_name both collapse to "Full name") and are deduped before display.
const REQUIREMENT_LABELS = {
  'business_profile.mcc': 'Business category',
  'business_type': 'Business type',
  'external_account': 'Bank account details',
  'tos_acceptance.date': "Accept Stripe's Terms of Service",
  'tos_acceptance.ip': "Accept Stripe's Terms of Service",
  'representative.first_name': 'Full name',
  'representative.last_name': 'Full name',
  'representative.email': 'Email address',
  'representative.phone': 'Phone number',
  'representative.id_number': 'NRIC / ID number',
  'representative.nationality': 'Nationality',
  'representative.full_name_aliases': 'Other names (if applicable)',
};

const humanizeRequirement = (req) => {
  if (REQUIREMENT_LABELS[req]) return REQUIREMENT_LABELS[req];
  if (req.startsWith('representative.address.')) return 'Home address';
  if (req.startsWith('representative.dob.')) return 'Date of birth';
  if (req.startsWith('representative.verification.document')) return 'Photo ID document';
  if (req.startsWith('representative.verification.proof_of_liveness')) return 'Identity selfie verification';
  // Fallback: best-effort humanization of an unknown code so we never
  // show raw Stripe field paths to the handyman.
  return req.replace(/_/g, ' ').replace(/\./g, ' → ');
};

const dedupeRequirementLabels = (items = []) => {
  const seen = new Set();
  const labels = [];
  for (const item of items) {
    const label = humanizeRequirement(item);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
};

/**
 * StripeOnboardingPrompt Component
 *
 * Displays when a verified handyman hasn't completed Stripe Connect onboarding
 * Handles the Stripe Express account creation and onboarding flow.
 *
 * Also surfaces post-return diagnostics: when the handyman comes back from
 * Stripe without finishing (the most common failure mode), HandymanDashboard
 * writes the sync result to sessionStorage under `stripeSyncResult` before
 * reloading. We pick it up here and show an amber banner listing exactly
 * what Stripe still needs, plus a "Resume Onboarding" CTA — so the handyman
 * never silently bounces back to the generic intro with no explanation.
 */
const StripeOnboardingPrompt = ({ handyman }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  // Read (and clear) the sync result handoff from HandymanDashboard's
  // return-URL handler. We clear immediately so a later visit without a
  // fresh sync doesn't redisplay a stale banner.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('stripeSyncResult');
      if (raw) {
        sessionStorage.removeItem('stripeSyncResult');
        setSyncResult(JSON.parse(raw));
      }
    } catch (_) {
      sessionStorage.removeItem('stripeSyncResult');
    }
  }, []);

  const pendingLabels = useMemo(
    () => dedupeRequirementLabels(syncResult?.status?.requirementsCurrentlyDue),
    [syncResult]
  );
  const hasSyncError = !!syncResult?.error;
  const showPendingBanner = pendingLabels.length > 0;
  const isResuming = !!handyman?.stripeConnectedAccountId;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleStartOnboarding = async () => {
    setIsCreatingAccount(true);
    setError(null);

    try {
      // Step 1: Create connected account if not exists
      let accountId = handyman.stripeConnectedAccountId;

      if (!accountId) {
        // Format phone number to include +65 if not already present
        let formattedPhone = handyman.phone;
        if (formattedPhone && !formattedPhone.startsWith('+')) {
          formattedPhone = `+65${formattedPhone}`;
        }

        const requestData = {
          uid: handyman.handymanId,
          email: handyman.email,
          name: handyman.fullName || handyman.name,
          phone: formattedPhone
        };

        const accountResult = await createConnectedAccount(requestData);

        if (!accountResult.success) {
          throw new Error(accountResult.message || 'Failed to create Stripe account');
        }

        accountId = accountResult.accountId;
        // No client-side Firestore write here: createConnectedAccount already
        // persists stripeConnectedAccountId + the initial stripe* status fields
        // server-side (Admin SDK). Those fields are now locked against client
        // writes in firestore.rules, so writing them here would be denied.
      }

      // Step 2: Create account link for onboarding
      const linkResult = await createAccountLink({
        accountId: accountId,
        refreshUrl: `${window.location.origin}/handyman-dashboard?stripe_refresh=true`,
        returnUrl: `${window.location.origin}/handyman-dashboard?stripe_onboarding=complete`
      });

      if (!linkResult.success) {
        throw new Error(linkResult.message || 'Failed to create onboarding link');
      }

      // Redirect to Stripe onboarding
      window.location.href = linkResult.url;

    } catch (err) {
      console.error('❌ Error starting Stripe onboarding:', err);
      setError(err.message || 'Failed to start onboarding. Please try again.');
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Simple Header with Logout */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">
              handyman
            </span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              EasyDoneHandyman
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Status Banner */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-8 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-primary/20 rounded-full p-3">
                <span className="material-symbols-outlined text-primary text-4xl">
                  account_balance
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  One More Step!
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Set up your payment account to start accepting jobs
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">

            {/* Sync-error banner: only shown if syncStripeOnboardingStatus
                threw on return from Stripe. Previously the handyman just
                saw the same generic prompt with no clue what went wrong. */}
            {hasSyncError && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-8">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">
                    warning
                  </span>
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      We couldn't verify your Stripe status
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 text-sm">
                      {syncResult.error}
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 text-sm mt-2">
                      Try the button below to start (or resume) onboarding. If this keeps happening, please contact us.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending-requirements banner: Stripe returned a non-empty
                currently_due list, meaning the handyman exited the flow
                before submitting everything. Show exactly what's left. */}
            {showPendingBanner && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-8">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">
                    pending_actions
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Stripe still needs a bit more from you
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 text-sm mb-3">
                      You'll be returned to the same secure Stripe page. Your previous answers are saved — just continue from where you left off.
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-100 text-sm">
                      {pendingLabels.slice(0, 8).map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                      {pendingLabels.length > 8 && (
                        <li className="italic">
                          …and {pendingLabels.length - 8} more
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Success */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-3xl">
                  check_circle
                </span>
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-200 text-lg mb-2">
                    Your Account is Verified! 🎉
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    Our operations team has approved your handyman account.
                    You're almost ready to start receiving jobs!
                  </p>
                </div>
              </div>
            </div>

            {/* Why Stripe */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Why do I need to set up payments?
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">
                    payments
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Get Paid Securely
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Receive payments directly to your bank account through Stripe,
                      a secure and trusted payment platform used worldwide.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">
                    security
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Protected Transactions
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Customer payments are held securely until you complete the job,
                      ensuring fair payment for your work.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">
                    shield_check
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Verified & Compliant
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Stripe handles all banking regulations and compliance requirements,
                      so you can focus on your work.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* What to Expect — first-time only. Skipped whenever the
                handyman already has a connected account (the steps are
                stale — they've done some of them — and the button below
                reads "Resume Onboarding", not "Set Up Payment Account"). */}
            {!isResuming && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                  What happens next?
                </h3>
                <ol className="space-y-2 text-blue-700 dark:text-blue-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Click "Set Up Payment Account" below</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>You'll be redirected to Stripe's secure onboarding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Provide your bank details and identity verification (5-10 minutes)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Return to this dashboard and start accepting jobs!</span>
                  </li>
                </ol>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400">
                    error
                  </span>
                  <div>
                    <p className="text-red-600 dark:text-red-400 font-medium">
                      Failed to start onboarding
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleStartOnboarding}
              disabled={isCreatingAccount}
              className="w-full bg-primary hover:bg-primary/90 text-gray-900 font-bold py-4 px-6 rounded-xl
                       transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50
                       disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isCreatingAccount ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                  <span>{isResuming ? 'Opening Stripe…' : 'Setting up your account...'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">account_balance</span>
                  <span>{isResuming ? 'Resume Onboarding' : 'Set Up Payment Account'}</span>
                </>
              )}
            </button>

            {/* Help Text */}
            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Need help? Contact us at{' '}
                <a
                  href="mailto:easydonehandyman@gmail.com"
                  className="text-primary hover:underline font-medium"
                >
                  easydonehandyman@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default StripeOnboardingPrompt;
