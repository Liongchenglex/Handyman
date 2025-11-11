/**
 * Stripe Payment Service
 *
 * Handles all payment operations including:
 * - Creating payment intents (customer pays)
 * - Confirming payments (holding in escrow)
 * - Retrieving payment status
 * - Refunding payments
 *
 * IMPORTANT: This file should only be used server-side
 */

import stripe, { STRIPE_CONFIG, dollarsToCents, centsToDollars } from './config.mjs';

/**
 * Create a payment intent for a job
 *
 * This creates a Stripe payment intent that holds funds on the customer's card
 * but doesn't charge them yet (we charge when payment is confirmed)
 *
 * @param {Object} paymentData - Payment information
 * @param {string} paymentData.jobId - Job ID from Firestore
 * @param {string} paymentData.customerId - Customer ID
 * @param {string} paymentData.handymanId - Handyman ID
 * @param {number} paymentData.serviceFee - Service fee in dollars
 * @param {string} paymentData.serviceType - Type of service
 * @param {string} [paymentData.customerEmail] - Customer email (optional, for receipt)
 * @returns {Promise<Object>} Payment intent with client secret
 */
export const createPaymentIntent = async (paymentData) => {
  try {
    const {
      jobId,
      customerId,
      handymanId,
      serviceFee,
      serviceType,
      customerEmail
    } = paymentData;

    console.log(`💳 Creating payment intent for job: ${jobId}`);
    console.log(`   Service Fee: $${serviceFee}`);

    // Calculate total amount (service fee + platform fee)
    const platformFee = STRIPE_CONFIG.platformFee;
    const totalAmount = serviceFee + platformFee;
    const amountInCents = dollarsToCents(totalAmount);

    console.log(`   Platform Fee: $${platformFee}`);
    console.log(`   Total Amount: $${totalAmount} (${amountInCents} cents)`);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: STRIPE_CONFIG.currency,

      // Payment method types
      payment_method_types: ['card'], // Cards support manual capture for escrow // Singapore payment methods

      // Capture method: manual means we hold the funds until we manually capture
      // This is perfect for escrow - funds are authorized but not yet charged
      capture_method: 'manual',

      // Receipt email
      receipt_email: customerEmail || null,

      // Description for the payment
      description: `${serviceType} service - Job #${jobId}`,

      // Metadata for tracking
      metadata: {
        jobId: jobId,
        customerId: customerId,
        handymanId: handymanId,
        serviceFee: serviceFee.toString(),
        platformFee: platformFee.toString(),
        totalAmount: totalAmount.toString(),
        serviceType: serviceType,
        platform: 'handyman-platform',
      },

      // Statement descriptor (shows on customer's card statement)
      statement_descriptor: 'HANDYMAN SVC',
      statement_descriptor_suffix: serviceType.substring(0, 10),
    });

    console.log(`✅ Payment intent created: ${paymentIntent.id}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Client Secret: ${paymentIntent.client_secret.substring(0, 20)}...`);

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      currency: STRIPE_CONFIG.currency,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
};

/**
 * Confirm and capture a payment intent
 *
 * This actually charges the customer's card and holds the funds in escrow
 * on your platform account until you're ready to release them
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Confirmed payment intent
 */
export const confirmPayment = async (paymentIntentId) => {
  try {
    console.log(`🔒 Confirming payment intent: ${paymentIntentId}`);

    // Retrieve the payment intent first to check status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log(`   Current status: ${paymentIntent.status}`);

    // If already succeeded, just return it
    if (paymentIntent.status === 'succeeded') {
      console.log(`✅ Payment already confirmed`);
      return {
        success: true,
        paymentIntent: paymentIntent,
        status: 'succeeded',
      };
    }

    // If requires_capture, capture it (this happens after customer confirms payment)
    if (paymentIntent.status === 'requires_capture') {
      console.log(`💰 Capturing payment...`);

      const captured = await stripe.paymentIntents.capture(paymentIntentId);

      console.log(`✅ Payment captured successfully`);
      console.log(`   Amount: ${centsToDollars(captured.amount)} ${captured.currency.toUpperCase()}`);

      return {
        success: true,
        paymentIntent: captured,
        status: captured.status,
        amountCaptured: centsToDollars(captured.amount),
      };
    }

    // If requires_payment_method or requires_confirmation, customer hasn't completed payment yet
    if (paymentIntent.status === 'requires_payment_method' ||
        paymentIntent.status === 'requires_confirmation') {
      console.log(`⏳ Payment not yet completed by customer`);
      return {
        success: false,
        error: 'Payment not yet completed by customer',
        status: paymentIntent.status,
      };
    }

    // Other statuses
    console.log(`⚠️  Unexpected payment status: ${paymentIntent.status}`);
    return {
      success: false,
      error: `Unexpected payment status: ${paymentIntent.status}`,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    throw new Error(`Failed to confirm payment: ${error.message}`);
  }
};

/**
 * Get payment intent status
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Payment intent status
 */
export const getPaymentStatus = async (paymentIntentId) => {
  try {
    console.log(`📊 Fetching payment status: ${paymentIntentId}`);

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const status = {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: centsToDollars(paymentIntent.amount),
      currency: paymentIntent.currency,
      created: paymentIntent.created,

      // Metadata
      jobId: paymentIntent.metadata?.jobId,
      customerId: paymentIntent.metadata?.customerId,
      handymanId: paymentIntent.metadata?.handymanId,

      // Charge information (if captured)
      chargeId: paymentIntent.charges?.data?.[0]?.id || null,
      receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url || null,

      // Payment method
      paymentMethodId: paymentIntent.payment_method,

      // Cancellation reason (if cancelled)
      cancellationReason: paymentIntent.cancellation_reason,
    };

    console.log(`✅ Payment status: ${status.status}`);

    return {
      success: true,
      status: status,
      paymentIntent: paymentIntent,
    };
  } catch (error) {
    console.error('❌ Error fetching payment status:', error);
    throw new Error(`Failed to fetch payment status: ${error.message}`);
  }
};

/**
 * Refund a payment
 *
 * This refunds the full amount to the customer
 * Use this if job is cancelled before completion
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} [reason] - Reason for refund
 * @returns {Promise<Object>} Refund object
 */
export const refundPayment = async (paymentIntentId, reason = 'requested_by_customer') => {
  try {
    console.log(`💸 Refunding payment: ${paymentIntentId}`);
    console.log(`   Reason: ${reason}`);

    // Get the payment intent to find the charge
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Cannot refund payment with status: ${paymentIntent.status}`);
    }

    // Get the charge ID
    const chargeId = paymentIntent.charges?.data?.[0]?.id;

    if (!chargeId) {
      throw new Error('No charge found for this payment intent');
    }

    // Create refund
    const refund = await stripe.refunds.create({
      charge: chargeId,
      reason: reason, // 'duplicate', 'fraudulent', or 'requested_by_customer'
      metadata: {
        jobId: paymentIntent.metadata?.jobId,
        refundedBy: 'platform',
        refundDate: new Date().toISOString(),
      },
    });

    console.log(`✅ Refund created: ${refund.id}`);
    console.log(`   Amount: ${centsToDollars(refund.amount)} ${refund.currency.toUpperCase()}`);
    console.log(`   Status: ${refund.status}`);

    return {
      success: true,
      refund: refund,
      refundId: refund.id,
      amount: centsToDollars(refund.amount),
      status: refund.status,
    };
  } catch (error) {
    console.error('❌ Error refunding payment:', error);
    throw new Error(`Failed to refund payment: ${error.message}`);
  }
};

/**
 * Cancel a payment intent (before it's captured)
 *
 * Use this if customer cancels before payment is completed
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} [reason] - Cancellation reason
 * @returns {Promise<Object>} Cancelled payment intent
 */
export const cancelPayment = async (paymentIntentId, reason = 'requested_by_customer') => {
  try {
    console.log(`🚫 Cancelling payment intent: ${paymentIntentId}`);

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: reason, // 'duplicate', 'fraudulent', 'requested_by_customer', 'abandoned'
    });

    console.log(`✅ Payment intent cancelled`);
    console.log(`   Status: ${paymentIntent.status}`);

    return {
      success: true,
      paymentIntent: paymentIntent,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('❌ Error cancelling payment intent:', error);
    throw new Error(`Failed to cancel payment intent: ${error.message}`);
  }
};

/**
 * Get payment receipt URL
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Receipt URL
 */
export const getReceiptUrl = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const receiptUrl = paymentIntent.charges?.data?.[0]?.receipt_url;

    if (!receiptUrl) {
      throw new Error('No receipt available for this payment');
    }

    return {
      success: true,
      receiptUrl: receiptUrl,
    };
  } catch (error) {
    console.error('❌ Error getting receipt URL:', error);
    throw new Error(`Failed to get receipt URL: ${error.message}`);
  }
};