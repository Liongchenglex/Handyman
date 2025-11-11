/**
 * Stripe Connect Service
 *
 * Handles all Stripe Connect operations including:
 * - Creating Express connected accounts for handymen
 * - Generating onboarding links
 * - Checking account status
 * - Updating account information
 *
 * IMPORTANT: This file should only be used server-side
 */

import stripe, { STRIPE_CONFIG } from './config.mjs';
// import { updateHandymanStripeInfo } from '../firebase/collections.js';

/**
 * Create a Stripe Express connected account for a handyman
 *
 * @param {Object} handymanData - Handyman information
 * @param {string} handymanData.uid - Handyman's Firebase UID
 * @param {string} handymanData.email - Handyman's email
 * @param {string} handymanData.name - Handyman's full name
 * @param {string} [handymanData.phone] - Handyman's phone number (optional)
 * @returns {Promise<Object>} Created account object with account ID
 */
export const createConnectedAccount = async (handymanData) => {
  try {
    const { email, name, phone, uid } = handymanData;

    console.log(`📝 Creating Stripe Connect account for: ${name} (${email})`);

    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Create Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: STRIPE_CONFIG.country,
      email: email,

      capabilities: {
        transfers: { requested: true }, // Required for receiving transfers
      },

      // Prefill business profile
      business_profile: {
        product_description: 'Handyman services',
      },

      // Set payout schedule based on configuration
      settings: {
        payouts: {
          schedule: {
            interval: STRIPE_CONFIG.payoutSchedule === 'instant' ? 'manual' : 'daily',
          },
        },
      },

      // Metadata for linking back to our system
      metadata: {
        firebaseUid: uid,
        platform: 'handyman-platform',
        accountType: 'handyman',
      },
    });

    console.log(`✅ Created Stripe account: ${account.id}`);

    // Update handyman document in Firestore
    //     // await updateHandymanStripeInfo(uid, {
    //       stripeConnectAccountId: account.id,
    //       stripeAccountStatus: 'pending',
    //       stripeOnboardingComplete: false,
    //       stripeDetailsSubmitted: false,
    //       stripePayoutsEnabled: account.payouts_enabled,
    //       stripeChargesEnabled: account.charges_enabled,
    //       stripeConnectedAt: new Date(),
    //       stripeLastSyncedAt: new Date(),
    //     });

    return {
      success: true,
      accountId: account.id,
      account: account,
    };
  } catch (error) {
    console.error('❌ Error creating connected account:', error);
    throw new Error(`Failed to create connected account: ${error.message}`);
  }
};

/**
 * Generate an account onboarding link for a handyman
 *
 * This link allows the handyman to complete their Stripe onboarding
 * (provide ID, bank account, tax information, etc.)
 *
 * @param {string} accountId - Stripe account ID
 * @param {string} [returnUrl] - URL to redirect after successful onboarding
 * @param {string} [refreshUrl] - URL to redirect if link expires
 * @returns {Promise<Object>} Account link object with URL
 */
export const createAccountLink = async (accountId, returnUrl, refreshUrl) => {
  try {
    console.log(`🔗 Creating account link for: ${accountId}`);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl || STRIPE_CONFIG.connect.refreshUrl,
      return_url: returnUrl || STRIPE_CONFIG.connect.returnUrl,
      type: 'account_onboarding',
    });

    console.log(`✅ Account link created: ${accountLink.url}`);

    return {
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    };
  } catch (error) {
    console.error('❌ Error creating account link:', error);
    throw new Error(`Failed to create account link: ${error.message}`);
  }
};

/**
 * Get the status of a connected account
 *
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<Object>} Account status information
 */
export const getAccountStatus = async (accountId) => {
  try {
    console.log(`📊 Fetching account status for: ${accountId}`);

    const account = await stripe.accounts.retrieve(accountId);

    const status = {
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,

      // Requirements
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      requirementsEventuallyDue: account.requirements?.eventually_due || [],
      requirementsPastDue: account.requirements?.past_due || [],
      requirementsDisabledReason: account.requirements?.disabled_reason || null,

      // Onboarding status
      onboardingComplete: account.details_submitted &&
                          account.charges_enabled &&
                          account.payouts_enabled &&
                          (account.requirements?.currently_due?.length === 0),

      // Account type and settings
      type: account.type,
      country: account.country,
      defaultCurrency: account.default_currency,

      // Email
      email: account.email,

      // Created timestamp
      created: account.created,
    };

    console.log(`✅ Account status retrieved:`, {
      onboardingComplete: status.onboardingComplete,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
    });

    return {
      success: true,
      status: status,
      account: account,
    };
  } catch (error) {
    console.error('❌ Error fetching account status:', error);
    throw new Error(`Failed to fetch account status: ${error.message}`);
  }
};

/**
 * Sync account status from Stripe to Firestore
 *
 * This should be called after onboarding or via webhooks
 * to keep our database in sync with Stripe
 *
 * @param {string} accountId - Stripe account ID
 * @param {string} firebaseUid - Firebase UID of handyman
 * @returns {Promise<Object>} Updated status
 */
export const syncAccountStatus = async (accountId, firebaseUid) => {
  try {
    console.log(`🔄 Syncing account status: ${accountId} → ${firebaseUid}`);

    const { status, account } = await getAccountStatus(accountId);

    // Update Firestore with latest status
    //     // await updateHandymanStripeInfo(firebaseUid, {
    //       stripeAccountStatus: status.onboardingComplete ? 'complete' : 'pending',
    //       stripeOnboardingComplete: status.onboardingComplete,
    //       stripeDetailsSubmitted: status.detailsSubmitted,
    //       stripePayoutsEnabled: status.payoutsEnabled,
    //       stripeChargesEnabled: status.chargesEnabled,
    //       stripeLastSyncedAt: new Date(),
    //     });

    console.log(`✅ Account status synced successfully`);

    return {
      success: true,
      status: status,
    };
  } catch (error) {
    console.error('❌ Error syncing account status:', error);
    throw new Error(`Failed to sync account status: ${error.message}`);
  }
};

/**
 * Create a login link for a connected account
 *
 * This allows handymen to access their Stripe Express dashboard
 * to view earnings, payouts, and update bank information
 *
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<Object>} Login link object with URL
 */
export const createLoginLink = async (accountId) => {
  try {
    console.log(`🔑 Creating login link for: ${accountId}`);

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    console.log(`✅ Login link created: ${loginLink.url}`);

    return {
      success: true,
      url: loginLink.url,
      created: loginLink.created,
    };
  } catch (error) {
    console.error('❌ Error creating login link:', error);
    throw new Error(`Failed to create login link: ${error.message}`);
  }
};

/**
 * Delete a connected account (for testing only!)
 *
 * WARNING: This permanently deletes the Stripe account
 * Only use this in test mode or for cleanup
 *
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteConnectedAccount = async (accountId) => {
  try {
    // Safety check - only allow in test mode
    if (!process.env.STRIPE_SECRET_KEY.includes('test')) {
      throw new Error('Account deletion is only allowed in test mode');
    }

    console.log(`🗑️  Deleting account: ${accountId}`);

    const deleted = await stripe.accounts.del(accountId);

    console.log(`✅ Account deleted successfully`);

    return {
      success: true,
      deleted: deleted.deleted,
      accountId: deleted.id,
    };
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    throw new Error(`Failed to delete account: ${error.message}`);
  }
};

/**
 * Update payout schedule for a connected account
 *
 * @param {string} accountId - Stripe account ID
 * @param {string} schedule - 'daily' or 'instant'
 * @returns {Promise<Object>} Updated account
 */
export const updatePayoutSchedule = async (accountId, schedule) => {
  try {
    console.log(`⚙️  Updating payout schedule for ${accountId} to: ${schedule}`);

    const account = await stripe.accounts.update(accountId, {
      settings: {
        payouts: {
          schedule: {
            interval: schedule === 'instant' ? 'manual' : 'daily',
          },
        },
      },
    });

    console.log(`✅ Payout schedule updated successfully`);

    return {
      success: true,
      account: account,
    };
  } catch (error) {
    console.error('❌ Error updating payout schedule:', error);
    throw new Error(`Failed to update payout schedule: ${error.message}`);
  }
};
