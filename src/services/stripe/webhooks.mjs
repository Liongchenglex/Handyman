/**
 * Stripe Webhook Service
 *
 * Handles webhook events from Stripe including:
 * - Payment intent status changes
 * - Connected account updates
 * - Transfer events
 * - Payout events
 *
 * IMPORTANT: This file should only be used server-side
 */

import stripe, { STRIPE_CONFIG } from './config.mjs';
import { syncAccountStatus } from './connect.mjs';

/**
 * Verify webhook signature
 *
 * This ensures the webhook actually came from Stripe
 * and wasn't tampered with
 *
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe-Signature header
 * @returns {Object} Verified event object
 */
export const verifyWebhookSignature = (payload, signature) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );

    console.log(`✅ Webhook signature verified: ${event.type}`);

    return event;
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
};

/**
 * Handle webhook events
 *
 * @param {Object} event - Stripe event object
 * @returns {Promise<Object>} Handler result
 */
export const handleWebhookEvent = async (event) => {
  try {
    console.log(`📨 Processing webhook: ${event.type}`);

    // Route to appropriate handler based on event type
    switch (event.type) {
      // Payment Intent Events
      case 'payment_intent.succeeded':
        return await handlePaymentIntentSucceeded(event);

      case 'payment_intent.payment_failed':
        return await handlePaymentIntentFailed(event);

      case 'payment_intent.canceled':
        return await handlePaymentIntentCanceled(event);

      // Connected Account Events
      case 'account.updated':
        return await handleAccountUpdated(event);

      case 'account.application.deauthorized':
        return await handleAccountDeauthorized(event);

      // Transfer Events
      case 'transfer.created':
        return await handleTransferCreated(event);

      case 'transfer.paid':
        return await handleTransferPaid(event);

      case 'transfer.failed':
        return await handleTransferFailed(event);

      case 'transfer.reversed':
        return await handleTransferReversed(event);

      // Payout Events
      case 'payout.paid':
        return await handlePayoutPaid(event);

      case 'payout.failed':
        return await handlePayoutFailed(event);

      // Default: Log unhandled events
      default:
        console.log(`ℹ️  Unhandled webhook event: ${event.type}`);
        return {
          success: true,
          handled: false,
          message: `Event type ${event.type} not handled`
        };
    }
  } catch (error) {
    console.error(`❌ Error handling webhook event:`, error);
    throw error;
  }
};

/**
 * Handle payment_intent.succeeded event
 *
 * Triggered when customer successfully completes payment
 */
const handlePaymentIntentSucceeded = async (event) => {
  const paymentIntent = event.data.object;

  console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
  console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
  console.log(`   Job ID: ${paymentIntent.metadata.jobId}`);

  // TODO: Update job payment status in Firestore
  // await updateJobPaymentStatus(paymentIntent.metadata.jobId, 'held');

  return {
    success: true,
    handled: true,
    paymentIntentId: paymentIntent.id
  };
};

/**
 * Handle payment_intent.payment_failed event
 */
const handlePaymentIntentFailed = async (event) => {
  const paymentIntent = event.data.object;

  console.log(`❌ Payment failed: ${paymentIntent.id}`);
  console.log(`   Job ID: ${paymentIntent.metadata.jobId}`);
  console.log(`   Failure reason: ${paymentIntent.last_payment_error?.message}`);

  // TODO: Update job payment status and notify customer
  // await updateJobPaymentStatus(paymentIntent.metadata.jobId, 'failed');

  return {
    success: true,
    handled: true,
    paymentIntentId: paymentIntent.id
  };
};

/**
 * Handle payment_intent.canceled event
 */
const handlePaymentIntentCanceled = async (event) => {
  const paymentIntent = event.data.object;

  console.log(`🚫 Payment canceled: ${paymentIntent.id}`);
  console.log(`   Job ID: ${paymentIntent.metadata.jobId}`);

  // TODO: Update job payment status
  // await updateJobPaymentStatus(paymentIntent.metadata.jobId, 'canceled');

  return {
    success: true,
    handled: true,
    paymentIntentId: paymentIntent.id
  };
};

/**
 * Handle account.updated event
 *
 * Triggered when connected account status changes
 * (e.g., onboarding completed, verification status changed)
 */
const handleAccountUpdated = async (event) => {
  const account = event.data.object;

  console.log(`🔄 Account updated: ${account.id}`);
  console.log(`   Charges enabled: ${account.charges_enabled}`);
  console.log(`   Payouts enabled: ${account.payouts_enabled}`);
  console.log(`   Details submitted: ${account.details_submitted}`);

  // Sync account status to Firestore
  const firebaseUid = account.metadata.firebaseUid;

  if (firebaseUid) {
    try {
      await syncAccountStatus(account.id, firebaseUid);
      console.log(`✅ Account status synced to Firestore`);
    } catch (error) {
      console.error(`❌ Error syncing account status:`, error);
    }
  } else {
    console.warn(`⚠️  No Firebase UID in account metadata`);
  }

  return {
    success: true,
    handled: true,
    accountId: account.id
  };
};

/**
 * Handle account.application.deauthorized event
 */
const handleAccountDeauthorized = async (event) => {
  const account = event.data.object;

  console.log(`⚠️  Account deauthorized: ${account.id}`);

  // TODO: Handle account deauthorization
  // - Update handyman status
  // - Prevent new jobs
  // - Notify operations team

  return {
    success: true,
    handled: true,
    accountId: account.id
  };
};

/**
 * Handle transfer.created event
 */
const handleTransferCreated = async (event) => {
  const transfer = event.data.object;

  console.log(`💸 Transfer created: ${transfer.id}`);
  console.log(`   Amount: ${transfer.amount / 100} ${transfer.currency}`);
  console.log(`   Destination: ${transfer.destination}`);
  console.log(`   Job ID: ${transfer.metadata.jobId}`);

  return {
    success: true,
    handled: true,
    transferId: transfer.id
  };
};

/**
 * Handle transfer.paid event
 */
const handleTransferPaid = async (event) => {
  const transfer = event.data.object;

  console.log(`✅ Transfer paid: ${transfer.id}`);
  console.log(`   Recipient: ${transfer.metadata.recipient}`);

  // TODO: Update payment record in Firestore
  // await updateTransferStatus(transfer.id, 'paid');

  return {
    success: true,
    handled: true,
    transferId: transfer.id
  };
};

/**
 * Handle transfer.failed event
 */
const handleTransferFailed = async (event) => {
  const transfer = event.data.object;

  console.log(`❌ Transfer failed: ${transfer.id}`);
  console.log(`   Job ID: ${transfer.metadata.jobId}`);

  // TODO: Handle transfer failure
  // - Notify operations team
  // - Attempt retry or reversal
  // - Update payment record

  return {
    success: true,
    handled: true,
    transferId: transfer.id
  };
};

/**
 * Handle transfer.reversed event
 */
const handleTransferReversed = async (event) => {
  const transfer = event.data.object;

  console.log(`↩️  Transfer reversed: ${transfer.id}`);

  // TODO: Update payment record
  // await updateTransferStatus(transfer.id, 'reversed');

  return {
    success: true,
    handled: true,
    transferId: transfer.id
  };
};

/**
 * Handle payout.paid event
 */
const handlePayoutPaid = async (event) => {
  const payout = event.data.object;

  console.log(`💰 Payout paid: ${payout.id}`);
  console.log(`   Amount: ${payout.amount / 100} ${payout.currency}`);
  console.log(`   Destination: ${payout.destination}`);

  // This confirms money has been sent to handyman's bank account

  return {
    success: true,
    handled: true,
    payoutId: payout.id
  };
};

/**
 * Handle payout.failed event
 */
const handlePayoutFailed = async (event) => {
  const payout = event.data.object;

  console.log(`❌ Payout failed: ${payout.id}`);
  console.log(`   Failure code: ${payout.failure_code}`);
  console.log(`   Failure message: ${payout.failure_message}`);

  // TODO: Handle payout failure
  // - Notify handyman
  // - Request updated bank details
  // - Retry payout

  return {
    success: true,
    handled: true,
    payoutId: payout.id
  };
};
