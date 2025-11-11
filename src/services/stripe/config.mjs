/**
 * Stripe Configuration
 *
 * Centralizes all Stripe configuration including API initialization,
 * payment splits, and platform settings.
 *
 * SECURITY NOTE:
 * - This file uses server-side API keys (STRIPE_SECRET_KEY)
 * - NEVER import this file in client-side code
 * - Only use in backend/API routes
 */

import Stripe from 'stripe';

// Initialize Stripe with secret key
// This should only be used on the server-side
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Use consistent API version
  typescript: true,
});

/**
 * Platform Configuration
 *
 * These values control how payments are processed and split
 * Values are loaded from environment variables for easy updates
 */
export const STRIPE_CONFIG = {
  // Platform fee charged on top of service fee (in dollars)
  platformFee: parseFloat(process.env.PLATFORM_FEE || '5'),

  // Payment splits
  // - Handyman gets 100% of service fee
  // - Platform fee is split 50/50 between cofounder and operator
  splits: {
    cofounderPlatformShare: 0.50, // 50% of platform fee
    operatorPlatformShare: 0.50,  // 50% of platform fee
    handymanServiceShare: 1.00    // 100% of service fee
  },

  // Escrow auto-release period (in working days)
  escrowAutoReleaseDays: parseInt(process.env.ESCROW_AUTO_RELEASE_DAYS || '3', 10),

  // Payout schedule for handymen
  payoutSchedule: process.env.PAYOUT_SCHEDULE || 'daily', // 'daily' or 'instant'

  // Connected account IDs (for cofounder and operator)
  connectedAccounts: {
    cofounder: process.env.STRIPE_COFOUNDER_ACCOUNT_ID || null,
    operator: process.env.STRIPE_OPERATOR_ACCOUNT_ID || null
  },

  // Stripe Connect URLs
  connect: {
    returnUrl: process.env.STRIPE_CONNECT_RETURN_URL || 'http://localhost:3000/handyman/stripe/success',
    refreshUrl: process.env.STRIPE_CONNECT_REFRESH_URL || 'http://localhost:3000/handyman/stripe/refresh'
  },

  // Currency (Singapore Dollars)
  currency: 'sgd',

  // Country code
  country: 'SG'
};

/**
 * Validate that platform fee splits add up to 1.0 (100%)
 */
const validateSplits = () => {
  const { cofounderPlatformShare, operatorPlatformShare } = STRIPE_CONFIG.splits;
  const platformSplitTotal = cofounderPlatformShare + operatorPlatformShare;

  if (Math.abs(platformSplitTotal - 1.0) > 0.01) {
    console.warn(
      `⚠️  Platform fee splits don't add up to 100%: ${platformSplitTotal * 100}%\n` +
      `   Cofounder: ${cofounderPlatformShare * 100}%\n` +
      `   Operator: ${operatorPlatformShare * 100}%`
    );
  }
};

// Run validation on initialization
validateSplits();

/**
 * Helper function to calculate payment splits
 * - Handyman gets 100% of service fee
 * - Platform fee is split 50/50 between cofounder and operator
 *
 * @param {number} serviceFee - The service fee amount (before platform fee)
 * @param {number} platformFee - The platform fee amount (default: $5)
 * @returns {Object} Split amounts for each party
 */
export const calculateSplits = (serviceFee, platformFee = STRIPE_CONFIG.platformFee) => {
  const { cofounderPlatformShare, operatorPlatformShare } = STRIPE_CONFIG.splits;

  // Handyman gets 100% of service fee
  const handymanShare = serviceFee;

  // Cofounder and operator split the platform fee
  const cofounderShare = platformFee * cofounderPlatformShare;
  const operatorShare = platformFee * operatorPlatformShare;

  return {
    cofounder: cofounderShare,
    operator: operatorShare,
    handyman: handymanShare,
    platformFee: platformFee,
    totalCollected: serviceFee + platformFee
  };
};

/**
 * Helper function to calculate total amount (service fee + platform fee)
 *
 * @param {number} serviceFee - The service fee amount
 * @returns {number} Total amount to charge customer
 */
export const calculateTotalAmount = (serviceFee) => {
  return serviceFee + STRIPE_CONFIG.platformFee;
};

/**
 * Helper function to convert dollars to cents (Stripe uses cents)
 *
 * @param {number} dollars - Amount in dollars
 * @returns {number} Amount in cents
 */
export const dollarsToCents = (dollars) => {
  return Math.round(dollars * 100);
};

/**
 * Helper function to convert cents to dollars
 *
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
export const centsToDollars = (cents) => {
  return cents / 100;
};

/**
 * Check if all required connected accounts are set up
 *
 * @returns {boolean} True if all accounts are configured
 */
export const areConnectedAccountsConfigured = () => {
  const { cofounder, operator } = STRIPE_CONFIG.connectedAccounts;
  return !!(cofounder && operator);
};

/**
 * Log configuration status on startup (for debugging)
 */
console.log('🔧 Stripe Configuration Loaded:');
console.log(`   Platform Fee: $${STRIPE_CONFIG.platformFee}`);
console.log(`   Split Logic:`);
console.log(`     - Handyman: 100% of service fee`);
console.log(`     - Cofounder: 50% of platform fee ($${STRIPE_CONFIG.platformFee * STRIPE_CONFIG.splits.cofounderPlatformShare})`);
console.log(`     - Operator: 50% of platform fee ($${STRIPE_CONFIG.platformFee * STRIPE_CONFIG.splits.operatorPlatformShare})`);
console.log(`   Escrow Auto-Release: ${STRIPE_CONFIG.escrowAutoReleaseDays} working days`);
console.log(`   Payout Schedule: ${STRIPE_CONFIG.payoutSchedule}`);
console.log(`   Currency: ${STRIPE_CONFIG.currency.toUpperCase()}`);
console.log(`   Connected Accounts Configured: ${areConnectedAccountsConfigured() ? 'Yes ✅' : 'No ⚠️  (will need to create)'}`);

export default stripe;
