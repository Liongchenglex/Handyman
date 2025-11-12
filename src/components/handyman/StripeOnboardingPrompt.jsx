import React, { useState } from 'react';
import { createConnectedAccount, createAccountLink } from '../../services/stripe/stripeApi';
import { updateHandyman } from '../../services/firebase/collections';

/**
 * StripeOnboardingPrompt Component
 *
 * Displays when a verified handyman hasn't completed Stripe Connect onboarding
 * Handles the Stripe Express account creation and onboarding flow
 */
const StripeOnboardingPrompt = ({ handyman }) => {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState(null);

  const handleStartOnboarding = async () => {
    setIsCreatingAccount(true);
    setError(null);

    try {
      console.log('Starting Stripe Connect onboarding for handyman:', handyman.handymanId);

      // Step 1: Create connected account if not exists
      let accountId = handyman.stripeConnectedAccountId;

      if (!accountId) {
        console.log('Creating new Stripe Connected Account...');
        const accountResult = await createConnectedAccount({
          uid: handyman.handymanId,
          email: handyman.email,
          name: handyman.fullName || handyman.name,
          phone: handyman.phone
        });

        if (!accountResult.success) {
          throw new Error(accountResult.message || 'Failed to create Stripe account');
        }

        accountId = accountResult.accountId;
        console.log('✅ Stripe Connected Account created:', accountId);

        // Store account ID in Firestore
        await updateHandyman(handyman.handymanId, {
          stripeConnectedAccountId: accountId,
          stripeAccountStatus: 'pending',
          updatedAt: new Date().toISOString()
        });
        console.log('✅ Account ID stored in Firestore');
      } else {
        console.log('Using existing Stripe Connected Account:', accountId);
      }

      // Step 2: Create account link for onboarding
      console.log('Creating Stripe onboarding link...');
      const linkResult = await createAccountLink({
        accountId: accountId,
        refreshUrl: `${window.location.origin}/handyman-dashboard?stripe_refresh=true`,
        returnUrl: `${window.location.origin}/handyman-dashboard?stripe_onboarding=complete`
      });

      if (!linkResult.success) {
        throw new Error(linkResult.message || 'Failed to create onboarding link');
      }

      console.log('✅ Redirecting to Stripe onboarding...');

      // Redirect to Stripe onboarding
      window.location.href = linkResult.url;

    } catch (err) {
      console.error('❌ Error starting Stripe onboarding:', err);
      setError(err.message || 'Failed to start onboarding. Please try again.');
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
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

            {/* What to Expect */}
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
                  <span>Setting up your account...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">account_balance</span>
                  <span>Set Up Payment Account</span>
                </>
              )}
            </button>

            {/* Help Text */}
            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Need help? Contact us at{' '}
                <a
                  href="mailto:support@handysg.com"
                  className="text-primary hover:underline font-medium"
                >
                  support@handysg.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeOnboardingPrompt;
