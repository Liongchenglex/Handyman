/**
 * Firebase Cloud Functions for Stripe Integration
 *
 * This file contains all the serverless functions for handling Stripe operations
 * including Connect accounts, payments, transfers, and webhooks.
 */

// Load environment variables from .env file (for local development)
require('dotenv').config();

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Stripe with secret key from environment variable
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken'); // SECURITY FIX (Phase 1.3): JWT for approval tokens

// App URL - used for constructing redirect URLs (Stripe Connect, etc.)
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// SECURITY FIX (Phase 1.2): Import validation utilities
const { validate } = require('./validation/middleware');
const {
  paymentIntentSchema,
  connectedAccountSchema,
  accountLinkSchema,
  accountIdSchema,
  paymentIntentIdSchema,
  escrowReleaseSchema,
  refundSchema,
  accountStatusQuerySchema,
  paymentStatusQuerySchema
} = require('./validation/schemas');

// ===================================
// CORS CONFIGURATION (Security Fix Phase 0.1)
// ===================================
// Whitelist approved origins only - prevents unauthorized cross-origin requests
const allowedOrigins = [
  'https://eazydone-d06cf.web.app',
  'https://eazydone-d06cf.firebaseapp.com',
  'http://localhost:3000',  // Development - React dev server
  'http://localhost:5000',  // Development - Firebase emulator
];

const cors = require('cors')({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 Blocked CORS request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
});

// Initialize Firebase Admin
admin.initializeApp();

// ===================================
// AUTHENTICATION HELPERS (Security Fix Phase 0.4)
// ===================================

/**
 * Verify Firebase ID token from request
 * Prevents unauthorized access to Cloud Functions
 *
 * @param {Object} req - Express request object
 * @returns {Object} Decoded token with uid and other user data
 * @throws {Error} If token is missing or invalid
 */
const verifyAuthToken = async (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing authentication token');
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    throw new Error('Unauthorized: Invalid authentication token');
  }
};

// ===================================
// ADMIN AUTHORIZATION
// ===================================

/**
 * Admin email whitelist
 * Users with these emails can perform admin actions like releasing escrow
 * Consider moving to Firestore or environment config for easier management
 */
const ADMIN_EMAILS = [
  'easydonehandyman@gmail.com',
  // Add more admin emails as needed
];

/**
 * Verify user has admin privileges
 * @param {Object} decodedToken - Decoded Firebase auth token
 * @throws {Error} If user is not an admin
 */
const verifyAdminAccess = (decodedToken) => {
  if (!decodedToken.email || !ADMIN_EMAILS.includes(decodedToken.email)) {
    console.warn(`🚫 Unauthorized admin access attempt by: ${decodedToken.email || decodedToken.uid}`);
    throw new Error('Forbidden: Admin access required');
  }
};

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Convert dollars to cents for Stripe
 */
const dollarsToCents = (dollars) => Math.round(dollars * 100);

/**
 * Convert cents to dollars
 */
const centsToDollars = (cents) => cents / 100;

/**
 * Get platform fee percentage from config or use default
 * Configurable via firebase functions:config:set platform.fee_percentage="0.10"
 * Examples:
 * - "0.10" = 10%
 * - "0.05" = 5%
 * - "0.15" = 15%
 * @returns {number} Platform fee percentage (decimal)
 */
const getPlatformFeePercentage = () => {
  const configPercentage = functions.config().platform?.fee_percentage;
  if (configPercentage) {
    const percentage = parseFloat(configPercentage);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 1) {
      return percentage;
    }
  }
  return 0.10; // Default 10%
};

/**
 * Calculate platform fee based on service fee
 * @param {number} serviceFee - Service fee in SGD
 * @returns {number} Platform fee amount
 */
const calculatePlatformFee = (serviceFee) => {
  return serviceFee * getPlatformFeePercentage();
};

/**
 * Calculate payment splits
 * - Handyman gets 100% of service fee
 * - Platform fee (configurable %) is split 50/50 between cofounder and operator
 *
 * @param {number} serviceFee - Service fee in SGD
 * @param {number} [platformFee] - Optional platform fee override (calculated if not provided)
 * @returns {Object} Split breakdown
 */
const calculateSplits = (serviceFee, platformFee = null) => {
  const actualPlatformFee = platformFee !== null ? platformFee : calculatePlatformFee(serviceFee);
  const handymanShare = serviceFee; // 100% of service fee
  const cofounderShare = actualPlatformFee / 2; // 50% of platform fee
  const operatorShare = actualPlatformFee / 2; // 50% of platform fee

  return {
    cofounder: cofounderShare,
    operator: operatorShare,
    handyman: handymanShare,
    platformFee: actualPlatformFee,
    platformFeePercentage: getPlatformFeePercentage(),
    totalCollected: serviceFee + actualPlatformFee
  };
};

// ===================================
// STRIPE CONNECT ENDPOINTS
// ===================================

/**
 * Create a Stripe Connect account for a handyman
 * POST /createConnectedAccount
 * Body: { email, name, phone, uid }
 */
exports.createConnectedAccount = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 0.4): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      // SECURITY FIX (Phase 1.2): Validate and sanitize input
      const validatedData = validate(connectedAccountSchema)(req.body);
      const { email, name, phone, uid } = validatedData;

      // SECURITY FIX (Phase 0.4): Verify user can only create account for themselves
      if (decodedToken.uid !== uid) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to create account for ${uid}`);
        return res.status(403).json({ error: 'Forbidden: Cannot create account for another user' });
      }

      // Split name into first and last
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Create Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'SG',
        email: email,
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          product_description: 'Handyman services',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'daily',
            },
          },
        },
        metadata: {
          firebaseUid: uid,
          platform: 'handyman-platform',
          accountType: 'handyman',
        },
      });

      // Update or create handyman document in Firestore (use set with merge)
      await admin.firestore().collection('handymen').doc(uid).set({
        stripeConnectedAccountId: account.id,
        stripeAccountStatus: 'pending',
        stripeOnboardingCompleted: false,
        stripeDetailsSubmitted: false,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeChargesEnabled: account.charges_enabled,
        stripeConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({
        success: true,
        accountId: account.id,
      });
    } catch (error) {
      console.error('Error creating connected account:', error);

      // SECURITY FIX (Phase 1.2): Handle validation errors
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({ error: 'Invalid input', message: error.message });
      }

      // SECURITY FIX (Phase 0.4): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to create connected account',
        message: error.message
      });
    }
  });
});

/**
 * Generate account onboarding link
 * POST /createAccountLink
 * Body: { accountId }
 */
exports.createAccountLink = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 1.1): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      // SECURITY FIX (Phase 1.2): Validate and sanitize input
      const validatedData = validate(accountLinkSchema)(req.body);
      const { accountId, refreshUrl, returnUrl } = validatedData;

      // SECURITY FIX (Phase 1.1): Verify user owns this Stripe account
      const handymanDoc = await admin.firestore().collection('handymen').doc(decodedToken.uid).get();
      if (!handymanDoc.exists || handymanDoc.data().stripeConnectedAccountId !== accountId) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to create link for account ${accountId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot create link for another user\'s account' });
      }

      // Use provided URLs or fallback to defaults (constructed from APP_URL)
      const refresh_url = refreshUrl || `${APP_URL}/handyman-dashboard?stripe_refresh=true`;
      const return_url = returnUrl || `${APP_URL}/handyman-dashboard?stripe_onboarding=complete`;

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refresh_url,
        return_url: return_url,
        type: 'account_onboarding',
      });

      return res.status(200).json({
        success: true,
        url: accountLink.url,
        expiresAt: accountLink.expires_at,
      });
    } catch (error) {
      console.error('Error creating account link:', error);

      // SECURITY FIX (Phase 1.1): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to create account link',
        message: error.message
      });
    }
  });
});

/**
 * Get account status
 * GET /getAccountStatus?accountId=xxx
 */
exports.getAccountStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 1.1): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      const accountId = req.query.accountId;

      if (!accountId) {
        return res.status(400).json({ error: 'Missing accountId parameter' });
      }

      // SECURITY FIX (Phase 1.1): Verify user owns this Stripe account
      const handymanDoc = await admin.firestore().collection('handymen').doc(decodedToken.uid).get();
      if (!handymanDoc.exists || handymanDoc.data().stripeConnectedAccountId !== accountId) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to access account ${accountId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s account' });
      }

      const account = await stripe.accounts.retrieve(accountId);

      const status = {
        accountId: account.id,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirementsCurrentlyDue: account.requirements?.currently_due || [],
        requirementsEventuallyDue: account.requirements?.eventually_due || [],
        requirementsPastDue: account.requirements?.past_due || [],
        onboardingComplete: account.details_submitted &&
                            account.charges_enabled &&
                            account.payouts_enabled &&
                            (account.requirements?.currently_due?.length === 0),
        type: account.type,
        country: account.country,
        email: account.email,
      };

      return res.status(200).json({
        success: true,
        status: status,
      });
    } catch (error) {
      console.error('Error fetching account status:', error);

      // SECURITY FIX (Phase 1.1): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to fetch account status',
        message: error.message
      });
    }
  });
});

/**
 * Create login link for handyman to access Stripe dashboard
 * POST /createLoginLink
 * Body: { accountId }
 */
exports.createLoginLink = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 1.1): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      const { accountId } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: 'Missing accountId' });
      }

      // SECURITY FIX (Phase 1.1): Verify user owns this Stripe account
      const handymanDoc = await admin.firestore().collection('handymen').doc(decodedToken.uid).get();
      if (!handymanDoc.exists || handymanDoc.data().stripeConnectedAccountId !== accountId) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to create login link for account ${accountId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot create login link for another user\'s account' });
      }

      const loginLink = await stripe.accounts.createLoginLink(accountId);

      return res.status(200).json({
        success: true,
        url: loginLink.url,
        created: loginLink.created,
      });
    } catch (error) {
      console.error('Error creating login link:', error);

      // SECURITY FIX (Phase 1.1): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to create login link',
        message: error.message
      });
    }
  });
});

// ===================================
// PAYMENT ENDPOINTS
// ===================================

/**
 * Create payment intent
 * POST /createPaymentIntent
 * Body: { jobId, customerId, handymanId, serviceFee, serviceType, customerEmail }
 */
exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 0.4): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      // SECURITY FIX (Phase 1.2): Validate and sanitize input
      const validatedData = validate(paymentIntentSchema)(req.body);
      const {
        jobId,
        customerId,
        handymanId = null,  // Optional - will be null for new jobs, assigned later
        serviceFee,
        serviceType,
        customerEmail
      } = validatedData;

      // SECURITY FIX (Phase 0.4): Verify the requesting user owns this transaction
      if (decodedToken.uid !== customerId) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to create payment for customer ${customerId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot create payment for another user' });
      }

      // Calculate total (service fee + configurable platform fee %)
      const platformFeePercentage = getPlatformFeePercentage();
      const platformFee = calculatePlatformFee(serviceFee);
      const totalAmount = serviceFee + platformFee;
      const amountInCents = dollarsToCents(totalAmount);

      // Use Firestore transaction to prevent race conditions
      // This ensures atomic check-and-set of payment intent ID
      const jobRef = admin.firestore().collection('jobs').doc(jobId);
      let paymentIntent;
      let shouldCreateNewIntent = false;

      try {
        await admin.firestore().runTransaction(async (transaction) => {
          const jobDoc = await transaction.get(jobRef);

          if (jobDoc.exists && jobDoc.data().paymentIntentId) {
            // Job already has a payment intent - retrieve and return it
            const existingPaymentIntentId = jobDoc.data().paymentIntentId;

            // Note: We can't return from here directly, so we'll set a flag
            paymentIntent = { id: existingPaymentIntentId, isExisting: true };
          } else {
            // Mark that we need to create a new payment intent
            // Reserve this job by setting a temporary flag in the transaction
            shouldCreateNewIntent = true;

            if (jobDoc.exists) {
              transaction.update(jobRef, {
                paymentIntentCreating: true,
                paymentIntentReservedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }
        });

        // If an existing payment intent was found, retrieve it from Stripe
        if (paymentIntent && paymentIntent.isExisting) {
          const existingPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);

          return res.status(200).json({
            success: true,
            paymentIntentId: existingPaymentIntent.id,
            clientSecret: existingPaymentIntent.client_secret,
            amount: existingPaymentIntent.amount / 100,
            currency: existingPaymentIntent.currency,
            status: existingPaymentIntent.status,
            message: 'Using existing payment intent'
          });
        }

        // Create new payment intent if needed
        if (shouldCreateNewIntent) {

          // Create NEW payment intent with manual capture (for escrow)
          paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'sgd',
            payment_method_types: ['card'],
            capture_method: 'manual', // Hold funds until manually captured
            receipt_email: customerEmail || null,
            description: `${serviceType} service - Job #${jobId}`,
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
            statement_descriptor: 'HANDYMAN SVC',
            statement_descriptor_suffix: serviceType.substring(0, 10),
          });

          // Update job document with the actual payment intent ID
          try {
            const jobDoc = await jobRef.get();

            if (jobDoc.exists) {
              await jobRef.update({
                paymentIntentId: paymentIntent.id,
                paymentStatus: 'pending',
                paymentCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
                paymentIntentCreating: admin.firestore.FieldValue.delete(), // Remove temporary flag
              });
            }
          } catch (firestoreError) {
            console.warn(`⚠️ Could not update job document: ${firestoreError.message}`);
            // Don't fail the entire request if Firestore update fails
          }
        }
      } catch (transactionError) {
        console.error('❌ Transaction error:', transactionError);
        throw new Error(`Failed to check/create payment intent: ${transactionError.message}`);
      }

      return res.status(200).json({
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        currency: 'sgd',
        status: paymentIntent.status,
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);

      // SECURITY FIX (Phase 0.4): Handle auth errors with appropriate status codes
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
      }

      if (error.message.includes('Forbidden')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: error.message
        });
      }

      return res.status(500).json({
        error: 'Failed to create payment intent',
        message: error.message
      });
    }
  });
});

/**
 * Confirm and capture payment
 * POST /confirmPayment
 * Body: { paymentIntentId }
 */
exports.confirmPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 1.1): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      // SECURITY FIX (Phase 1.2): Validate and sanitize input
      const validatedData = validate(paymentIntentIdSchema)(req.body);
      const { paymentIntentId } = validatedData;

      // Retrieve payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // SECURITY FIX (Phase 1.1): Verify user owns this payment
      if (paymentIntent.metadata.customerId !== decodedToken.uid) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to confirm payment ${paymentIntentId} belonging to ${paymentIntent.metadata.customerId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot confirm another user\'s payment' });
      }

      // If already succeeded, return success
      if (paymentIntent.status === 'succeeded') {
        return res.status(200).json({
          success: true,
          status: 'succeeded',
        });
      }

      // If requires_capture, capture it
      if (paymentIntent.status === 'requires_capture') {
        const captured = await stripe.paymentIntents.capture(paymentIntentId);

        // Update job document
        await admin.firestore().collection('jobs').doc(paymentIntent.metadata.jobId).update({
          paymentStatus: 'captured',
          paymentCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          status: captured.status,
          amountCaptured: centsToDollars(captured.amount),
        });
      }

      // Other statuses
      return res.status(400).json({
        success: false,
        error: `Payment not ready for capture. Status: ${paymentIntent.status}`,
        status: paymentIntent.status,
      });
    } catch (error) {
      console.error('Error confirming payment:', error);

      // SECURITY FIX (Phase 1.1): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to confirm payment',
        message: error.message
      });
    }
  });
});

/**
 * Get payment status
 * GET /getPaymentStatus?paymentIntentId=xxx
 */
exports.getPaymentStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 1.1): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      const paymentIntentId = req.query.paymentIntentId;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing paymentIntentId parameter' });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // SECURITY FIX (Phase 1.1): Verify user is involved in this payment (either customer or handyman)
      const customerId = paymentIntent.metadata?.customerId;
      const handymanId = paymentIntent.metadata?.handymanId;

      if (decodedToken.uid !== customerId && decodedToken.uid !== handymanId) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to access payment ${paymentIntentId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot access payment details for another user' });
      }

      const status = {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: centsToDollars(paymentIntent.amount),
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        jobId: paymentIntent.metadata?.jobId,
        customerId: paymentIntent.metadata?.customerId,
        handymanId: paymentIntent.metadata?.handymanId,
        chargeId: paymentIntent.charges?.data?.[0]?.id || null,
        receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url || null,
      };

      return res.status(200).json({
        success: true,
        status: status,
      });
    } catch (error) {
      console.error('Error fetching payment status:', error);

      // SECURITY FIX (Phase 1.1): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to fetch payment status',
        message: error.message
      });
    }
  });
});

/**
 * Release escrow and split payment
 * - Handyman gets 100% of service fee
 * - Platform fee is split 50/50 between cofounder and operator
 *
 * POST /releaseEscrowAndSplit
 * Body: { paymentIntentId, jobId, serviceFee, platformFee, handymanAccountId, cofounderAccountId, operatorAccountId }
 */
exports.releaseEscrowAndSplit = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 0.4): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      // SECURITY FIX (Phase 1.2): Validate and sanitize input
      const validatedData = validate(escrowReleaseSchema)(req.body);
      const {
        paymentIntentId,
        jobId,
        serviceFee,
        platformFee,
        handymanAccountId,
        cofounderAccountId,
        operatorAccountId
      } = validatedData;

      // TODO (Phase 1): Add role-based authorization - only handyman or admin should release escrow

      // Calculate splits
      const splits = calculateSplits(serviceFee, platformFee);

      // Create transfers to all three parties
      const [cofounderTransfer, operatorTransfer, handymanTransfer] = await Promise.all([
        stripe.transfers.create({
          amount: dollarsToCents(splits.cofounder),
          currency: 'sgd',
          destination: cofounderAccountId,
          description: `Cofounder platform fee share for job #${jobId}`,
          metadata: {
            jobId: jobId,
            recipient: 'cofounder',
            share: '50% of platform fee',
            platformFee: platformFee.toString(),
          },
        }),
        stripe.transfers.create({
          amount: dollarsToCents(splits.operator),
          currency: 'sgd',
          destination: operatorAccountId,
          description: `Operator platform fee share for job #${jobId}`,
          metadata: {
            jobId: jobId,
            recipient: 'operator',
            share: '50% of platform fee',
            platformFee: platformFee.toString(),
          },
        }),
        stripe.transfers.create({
          amount: dollarsToCents(splits.handyman),
          currency: 'sgd',
          destination: handymanAccountId,
          description: `Handyman payment for job #${jobId}`,
          metadata: {
            jobId: jobId,
            recipient: 'handyman',
            share: '100% of service fee',
            serviceFee: serviceFee.toString(),
          },
        })
      ]);

      // Update job document
      await admin.firestore().collection('jobs').doc(jobId).update({
        paymentStatus: 'released',
        paymentReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
        transferIds: {
          cofounder: cofounderTransfer.id,
          operator: operatorTransfer.id,
          handyman: handymanTransfer.id,
        },
        splits: {
          cofounder: splits.cofounder,
          operator: splits.operator,
          handyman: splits.handyman,
        },
      });

      return res.status(200).json({
        success: true,
        transfers: {
          cofounder: {
            id: cofounderTransfer.id,
            amount: splits.cofounder,
          },
          operator: {
            id: operatorTransfer.id,
            amount: splits.operator,
          },
          handyman: {
            id: handymanTransfer.id,
            amount: splits.handyman,
          },
        },
      });
    } catch (error) {
      console.error('Error releasing escrow:', error);

      // SECURITY FIX (Phase 0.4): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to release escrow',
        message: error.message
      });
    }
  });
});

/**
 * Release Escrow (Simplified)
 *
 * Releases payment to handyman after admin approval.
 * - Captures payment if not already captured
 * - Transfers service fee to handyman's connected Stripe account
 * - Platform fee stays in platform account (manual split later)
 *
 * POST /releaseEscrowSimple
 * Body: { jobId }
 */
exports.releaseEscrowSimple = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Verify authentication
      const decodedToken = await verifyAuthToken(req);

      // Verify admin authorization - only admins can release escrow
      verifyAdminAccess(decodedToken);

      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId' });
      }

      // Get job data from Firestore
      const jobDoc = await admin.firestore().collection('jobs').doc(jobId).get();
      if (!jobDoc.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const jobData = jobDoc.data();
      const { paymentIntentId, estimatedBudget, handymanId } = jobData;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'No payment intent found for this job' });
      }

      if (!handymanId) {
        return res.status(400).json({ error: 'No handyman assigned to this job' });
      }

      // Get handyman's Stripe connected account
      const handymanDoc = await admin.firestore().collection('handymen').doc(handymanId).get();
      if (!handymanDoc.exists) {
        return res.status(404).json({ error: 'Handyman not found' });
      }

      const handymanData = handymanDoc.data();
      const handymanAccountId = handymanData.stripeConnectedAccountId;

      if (!handymanAccountId) {
        return res.status(400).json({
          error: 'Handyman has not completed Stripe onboarding',
          message: 'The handyman needs to complete Stripe Connect setup before receiving payments.'
        });
      }

      // Check if Stripe account is ready for transfers
      const stripeAccount = await stripe.accounts.retrieve(handymanAccountId);
      if (!stripeAccount.charges_enabled || !stripeAccount.payouts_enabled) {
        return res.status(400).json({
          error: 'Handyman Stripe account not ready',
          message: 'The handyman Stripe account is not fully set up for receiving payments.'
        });
      }

      // Calculate amounts
      const platformFeePercentage = getPlatformFeePercentage();
      const totalAmount = parseFloat(estimatedBudget);
      const serviceFee = totalAmount / (1 + platformFeePercentage); // Reverse calculate service fee
      const platformFee = totalAmount - serviceFee;

      // Get payment intent with expanded charge data
      let paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Capture payment if it's still in requires_capture state
      if (paymentIntent.status === 'requires_capture') {
        paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      } else if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          error: `Cannot release payment with status: ${paymentIntent.status}`,
          message: 'Payment must be authorized or captured before release.'
        });
      }

      // Get the charge ID from the payment intent (needed for source_transaction)
      const chargeId = paymentIntent.latest_charge;
      if (!chargeId) {
        return res.status(400).json({
          error: 'No charge found for this payment',
          message: 'Payment must have a successful charge before transfer.'
        });
      }

      // Get charge details to see actual amount after Stripe fees
      const charge = await stripe.charges.retrieve(chargeId);
      const balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction);

      // Net amount after Stripe fees (in cents)
      const netAmountCents = balanceTransaction.net;
      const stripeFee = balanceTransaction.fee / 100; // Convert to dollars
      const netAmount = netAmountCents / 100; // Convert to dollars

      // Recalculate based on net amount
      // Platform keeps: platformFeePercentage of net amount
      // Handyman gets: remaining net amount
      const platformFeeFromNet = netAmount * platformFeePercentage / (1 + platformFeePercentage);
      const handymanPayout = netAmount - platformFeeFromNet;

      // Transfer to handyman using source_transaction to use funds from this specific charge
      const transfer = await stripe.transfers.create({
        amount: Math.round(handymanPayout * 100), // Convert to cents
        currency: 'sgd',
        destination: handymanAccountId,
        source_transaction: chargeId, // Links transfer to specific charge - allows immediate transfer
        description: `Payment for job #${jobId} - ${jobData.serviceType}`,
        metadata: {
          jobId: jobId,
          serviceType: jobData.serviceType,
          customerName: jobData.customerName,
          grossAmount: totalAmount.toFixed(2),
          stripeFee: stripeFee.toFixed(2),
          netAmount: netAmount.toFixed(2),
          handymanPayout: handymanPayout.toFixed(2),
          platformFee: platformFeeFromNet.toFixed(2),
        },
      });

      // Update job document with detailed payment breakdown
      await admin.firestore().collection('jobs').doc(jobId).update({
        status: 'completed',
        paymentStatus: 'released',
        paymentReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentReleasedBy: decodedToken.email,
        transferId: transfer.id,
        chargeId: chargeId,
        paymentBreakdown: {
          grossAmount: totalAmount,
          stripeFee: stripeFee,
          netAmount: netAmount,
          handymanPayout: handymanPayout,
          platformFee: platformFeeFromNet,
        },
      });

      return res.status(200).json({
        success: true,
        jobId: jobId,
        serviceFee: handymanPayout,
        transfer: {
          id: transfer.id,
          amount: handymanPayout,
          currency: 'sgd',
          destination: handymanAccountId,
        },
        transferId: transfer.id,
        paymentBreakdown: {
          grossAmount: totalAmount,
          stripeFee: stripeFee,
          netAmount: netAmount,
          handymanPayout: handymanPayout,
          platformFee: platformFeeFromNet,
        },
        message: `Successfully transferred $${handymanPayout.toFixed(2)} to handyman. Platform fee of $${platformFeeFromNet.toFixed(2)} retained. Stripe fee was $${stripeFee.toFixed(2)}.`
      });

    } catch (error) {
      console.error('❌ Error releasing escrow:', error);

      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }

      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to release escrow',
        message: error.message
      });
    }
  });
});

/**
 * Refund payment
 * POST /refundPayment
 * Body: { paymentIntentId, reason }
 */
exports.refundPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // SECURITY FIX (Phase 1.1): Verify authentication
      const decodedToken = await verifyAuthToken(req);

      const { paymentIntentId, reason } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing paymentIntentId' });
      }

      // Get payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // SECURITY FIX (Phase 1.1): Only customer or handyman can request refund
      const customerId = paymentIntent.metadata?.customerId;
      const handymanId = paymentIntent.metadata?.handymanId;

      if (decodedToken.uid !== customerId && decodedToken.uid !== handymanId) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to refund payment ${paymentIntentId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot refund another user\'s payment' });
      }

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          error: `Cannot refund payment with status: ${paymentIntent.status}`
        });
      }

      // Get charge ID
      const chargeId = paymentIntent.charges?.data?.[0]?.id;

      if (!chargeId) {
        return res.status(400).json({ error: 'No charge found for this payment' });
      }

      // Create refund
      const refund = await stripe.refunds.create({
        charge: chargeId,
        reason: reason || 'requested_by_customer',
        metadata: {
          jobId: paymentIntent.metadata?.jobId,
          refundedBy: 'platform',
        },
      });

      // Update job document
      await admin.firestore().collection('jobs').doc(paymentIntent.metadata.jobId).update({
        paymentStatus: 'refunded',
        paymentRefundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundId: refund.id,
      });

      return res.status(200).json({
        success: true,
        refundId: refund.id,
        amount: centsToDollars(refund.amount),
        status: refund.status,
      });
    } catch (error) {
      console.error('Error refunding payment:', error);

      // SECURITY FIX (Phase 1.1): Handle auth errors
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }

      return res.status(500).json({
        error: 'Failed to refund payment',
        message: error.message
      });
    }
  });
});

// ===================================
// WEBHOOK ENDPOINT
// ===================================

/**
 * Handle Stripe webhooks
 * POST /stripeWebhook
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await admin.firestore().collection('jobs').doc(paymentIntent.metadata.jobId).update({
          paymentStatus: 'succeeded',
          paymentSucceededAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        break;

      case 'account.updated':
        const account = event.data.object;
        const firebaseUid = account.metadata.firebaseUid;
        if (firebaseUid) {
          await admin.firestore().collection('handymen').doc(firebaseUid).update({
            stripeAccountStatus: account.details_submitted ? 'complete' : 'pending',
            stripeOnboardingCompleted: account.details_submitted &&
                                       account.charges_enabled &&
                                       account.payouts_enabled,
            stripeDetailsSubmitted: account.details_submitted,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeChargesEnabled: account.charges_enabled,
            stripeLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        break;

      case 'transfer.created':
        // Transfer created - no additional action needed
        break;

      default:
        // Unhandled event type
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ===================================
// WHATSAPP WEBHOOK (Twilio)
// ===================================

/**
 * WhatsApp Webhook Handler (Twilio)
 *
 * Handles incoming WhatsApp messages from Twilio.
 * Customers reply with "YES" or "NO" to confirm job completion.
 *
 * Customer Replies:
 * - "YES" → Updates job status to 'pending_admin_approval', sends follow-up message
 * - "NO"  → Updates job status to 'disputed', sends follow-up message
 *
 * Twilio Webhook Documentation: https://www.twilio.com/docs/messaging/guides/webhook-request
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // Twilio sends form-encoded POST data
    const { From, Body } = req.body;

    if (!From || !Body) {
      console.warn('⚠️ Missing From or Body in Twilio webhook');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract customer phone from Twilio format (whatsapp:+6591234567)
    const customerPhone = From.replace('whatsapp:', '').replace('+', '');
    const messageText = Body.trim().toUpperCase();

    console.log(`📱 Incoming WhatsApp from ${customerPhone}: "${Body.trim()}"`);

    // Only process YES or NO replies for job confirmation
    const isConfirm = messageText === 'YES' || messageText === 'Y';
    const isReject = messageText === 'NO' || messageText === 'N';

    if (!isConfirm && !isReject) {
      // Not a confirmation reply — ignore or send help message
      console.log('ℹ️ Non-confirmation message received, ignoring');
      return res.status(200).json({ received: true, processed: false, reason: 'Not a confirmation reply' });
    }

    // Try multiple phone formats since customer might have stored different format
    const phoneFormats = [
      customerPhone,
      `+${customerPhone}`,
      customerPhone.startsWith('65') ? customerPhone.substring(2) : customerPhone
    ];

    // STEP 1: Check if there's already a locked job (response already processed)
    let lockedJobSnapshot = null;
    for (const phoneFormat of phoneFormats) {
      const snapshot = await admin.firestore().collection('jobs')
        .where('customerPhone', '==', phoneFormat)
        .where('pollVoteLocked', '==', true)
        .orderBy('customerConfirmedAt', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        lockedJobSnapshot = snapshot;
        break;
      }
    }

    // If response already recorded, notify customer
    if (lockedJobSnapshot && !lockedJobSnapshot.empty) {
      const lockedJob = lockedJobSnapshot.docs[0];
      const lockedJobId = lockedJob.id;
      const lockedJobData = lockedJob.data();

      await sendTwilioMessage(
        From,
        `ℹ️ Your response has already been recorded.\n\nYour previous response: ${lockedJobData.status === 'pending_admin_approval' ? '✅ Confirmed' : '⚠️ Issue Reported'}\n\nIf you need to change your response, please contact our support team.\n\nJob ID: ${lockedJobId}`
      );
      return res.status(200).json({
        received: true,
        processed: false,
        reason: 'Response already locked'
      });
    }

    // STEP 2: Look for jobs pending confirmation
    let jobsSnapshot = null;
    for (const phoneFormat of phoneFormats) {
      const snapshot = await admin.firestore().collection('jobs')
        .where('customerPhone', '==', phoneFormat)
        .where('status', '==', 'pending_confirmation')
        .orderBy('completedAt', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        jobsSnapshot = snapshot;
        break;
      }
    }

    if (!jobsSnapshot || jobsSnapshot.empty) {
      console.warn('⚠️ No pending job found for customer:', customerPhone);
      return res.status(200).json({
        received: true,
        processed: false,
        reason: 'No pending job found'
      });
    }

    const jobDoc = jobsSnapshot.docs[0];
    const jobId = jobDoc.id;
    const jobData = jobDoc.data();

    // Handle customer response
    if (isConfirm) {
      // Customer confirmed job completion
      await admin.firestore().collection('jobs').doc(jobId).update({
        status: 'pending_admin_approval',
        customerConfirmedAt: new Date().toISOString(),
        confirmedVia: 'whatsapp_reply',
        pollVoteLocked: true
      });

      // Send admin notification email
      await sendAdminNotificationEmail(jobData, jobId);

      // Send follow-up confirmation message
      await sendTwilioMessage(
        From,
        `✅ Thank you for confirming!\n\nOur team will process the payment and email you the receipt.\n\nJob ID: ${jobId}\n\nWe hope to serve you again! 🔧`
      );

      return res.status(200).json({ received: true, processed: true, action: 'pending_admin_approval' });

    } else if (isReject) {
      // Customer reported an issue
      await admin.firestore().collection('jobs').doc(jobId).update({
        status: 'disputed',
        disputedAt: new Date().toISOString(),
        disputedVia: 'whatsapp_reply',
        disputeReason: 'Customer reported issue via WhatsApp reply',
        pollVoteLocked: true
      });

      // Send follow-up dispute message
      await sendTwilioMessage(
        From,
        `⚠️ We're sorry to hear that.\n\nOur team will contact you with regard to this dispute.\n\nJob ID: ${jobId}\n\nWe take every feedback seriously and will resolve this promptly.`
      );

      return res.status(200).json({ received: true, processed: true, action: 'disputed' });
    }

  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Helper function to send a WhatsApp message via Twilio
 * Used by webhook and scheduled functions to send messages from the backend.
 *
 * Reads from environment variables (functions/.env):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM (e.g., whatsapp:+14155238886)
 *
 * @param {string} to - Recipient in Twilio format (whatsapp:+6591234567) or raw phone number
 * @param {string} message - Message text to send
 * @returns {Promise<object>} - API response
 */
async function sendTwilioMessage(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    console.warn('⚠️ Twilio not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to functions/.env');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    // Ensure 'to' is in Twilio WhatsApp format
    const toFormatted = to.startsWith('whatsapp:') ? to : formatPhoneToWhatsApp(to);

    // Use Twilio REST API directly (avoids heavy SDK dependency)
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({
      From: whatsappFrom,
      To: toFormatted,
      Body: message
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok || data.code) {
      console.error('❌ Twilio Error:', data);
      throw new Error(data.message || 'Failed to send WhatsApp message');
    }

    console.log(`✅ Twilio message sent: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('❌ Error sending Twilio message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to send a WhatsApp template message via Twilio.
 * Used for business-initiated messages outside the 24-hour session window.
 * Falls back to freeform text if no template SID is provided (sandbox mode).
 *
 * @param {string} to - Recipient in Twilio format or raw phone number
 * @param {string} contentSid - Twilio Content Template SID (HXxxxxx)
 * @param {object} contentVariables - Template variable values
 * @param {string} fallbackMessage - Freeform message if no template configured
 * @returns {Promise<object>} - API response
 */
async function sendTwilioTemplateMessage(to, contentSid, contentVariables, fallbackMessage) {
  // Fall back to freeform if no template SID (sandbox mode)
  if (!contentSid) {
    console.warn('⚠️ No template SID — sending freeform message (sandbox mode)');
    return await sendTwilioMessage(to, fallbackMessage);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    console.warn('⚠️ Twilio not configured.');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const toFormatted = to.startsWith('whatsapp:') ? to : formatPhoneToWhatsApp(to);

    // Use Twilio REST API directly (avoids heavy SDK dependency)
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({
      From: whatsappFrom,
      To: toFormatted,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(contentVariables)
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok || data.code) {
      console.error('❌ Twilio Error:', data);
      throw new Error(data.message || 'Failed to send WhatsApp template message');
    }

    console.log(`✅ Twilio template message sent: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('❌ Error sending Twilio template message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format a phone number to Twilio WhatsApp format.
 * Strips non-digit characters, adds Singapore country code (65) if needed,
 * and prepends whatsapp:+ prefix.
 *
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted Twilio WhatsApp number (e.g., whatsapp:+6591234567)
 */
function formatPhoneToWhatsApp(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    cleaned = `65${cleaned}`;
  }
  cleaned = cleaned.replace(/^0+/, '');
  return `whatsapp:+${cleaned}`;
}

/**
 * Helper function to send admin notification email
 * Used when a job status changes to pending_admin_approval
 *
 * Reads from environment variables (functions/.env):
 * - ADMIN_EMAIL - Email address to receive notifications
 * - SMTP_HOST - SMTP server host (e.g., smtp.gmail.com)
 * - SMTP_PORT - SMTP port (e.g., 587)
 * - SMTP_USER - SMTP username/email
 * - SMTP_PASS - SMTP password or app password
 */
async function sendAdminNotificationEmail(jobData, jobId) {
  const nodemailer = require('nodemailer');

  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!adminEmail || !smtpHost || !smtpUser || !smtpPass) {
    console.warn('⚠️ Email not configured. Add ADMIN_EMAIL, SMTP_HOST, SMTP_USER, SMTP_PASS to functions/.env');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const adminUrl = 'https://eazydone-d06cf.web.app/admin/fund-release';

    const mailOptions = {
      from: `"EazyDone System" <${smtpUser}>`,
      to: adminEmail,
      subject: `💰 Fund Release Required: ${jobData.serviceType} - $${jobData.estimatedBudget}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #FFD60A; padding: 20px; text-align: center;">
            <h1 style="margin: 0; color: #000;">Fund Release Required</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px;">
            <p>A customer has confirmed job completion. Please review and approve the fund release.</p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Job Details</h3>
              <p><strong>Job ID:</strong> ${jobId}</p>
              <p><strong>Service:</strong> ${jobData.serviceType}</p>
              <p><strong>Customer:</strong> ${jobData.customerName}</p>
              <p><strong>Phone:</strong> ${jobData.customerPhone}</p>
              <p><strong>Amount:</strong> <span style="color: green; font-size: 1.2em; font-weight: bold;">$${jobData.estimatedBudget}</span></p>
              <p><strong>Confirmed Via:</strong> WhatsApp</p>
              <p><strong>Confirmed At:</strong> ${new Date().toLocaleString('en-SG')}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${adminUrl}" style="display: inline-block; padding: 15px 30px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Review & Approve Fund Release
              </a>
            </div>

            <p style="color: #666; font-size: 12px;">
              This is an automated notification from EazyDone.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending admin email:', error);
    return { success: false, error: error.message };
  }
}

// ===================================
// SCHEDULED FUNCTIONS
// ===================================

/**
 * Cleanup Abandoned Jobs
 *
 * Runs every hour to delete jobs that have been in 'awaiting_payment' status
 * for more than 30 minutes. These are jobs where the customer started the
 * payment process but never completed it (closed browser, card declined, etc.)
 *
 * This prevents unpaid jobs from cluttering the database and ensures
 * handymen only see jobs with authorized payments.
 */
exports.cleanupAbandonedJobs = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('Asia/Singapore')
  .onRun(async () => {
    try {
      // Calculate cutoff time (30 minutes ago)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const cutoffTime = admin.firestore.Timestamp.fromDate(thirtyMinutesAgo);

      // Query jobs in 'awaiting_payment' status older than 30 minutes
      const abandonedJobsSnapshot = await admin.firestore()
        .collection('jobs')
        .where('status', '==', 'awaiting_payment')
        .where('createdAt', '<', cutoffTime.toDate().toISOString())
        .get();

      if (abandonedJobsSnapshot.empty) {
        return null;
      }

      // Delete abandoned jobs in batch
      const batch = admin.firestore().batch();
      const deletedJobIds = [];

      abandonedJobsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedJobIds.push(doc.id);
      });

      await batch.commit();

      return {
        success: true,
        deletedCount: deletedJobIds.length,
        deletedJobIds: deletedJobIds
      };
    } catch (error) {
      console.error('❌ Error cleaning up abandoned jobs:', error);
      throw error;
    }
  });

/**
 * Auto-Trigger Completion Confirmation
 *
 * Runs daily at 10:00 AM SGT to automatically send WhatsApp completion
 * confirmation messages to customers whose job's scheduled date has passed.
 *
 * This ensures customers are prompted to confirm job completion even if the
 * handyman forgets to click "Mark Complete". It also prevents premature
 * completion notifications — the poll is only sent the day AFTER the preferred date.
 *
 * Logic:
 * - Finds jobs where: status is 'in_progress', preferredDate < today,
 *   and completionPollSentAt is not yet set.
 * - Sends a WhatsApp confirmation message asking customer to reply YES/NO.
 * - Sets completionPollSentAt and completionPollSentBy on the job document.
 * - Does NOT change the job status — the handyman can still click "Mark Complete"
 *   which will update the status without re-sending the poll.
 *
 * Race condition handling:
 * - If the handyman already clicked "Mark Complete" and set completionPollSentAt,
 *   this function skips that job.
 * - If this function sends the poll first and the handyman clicks "Mark Complete" later,
 *   the frontend checks completionPollSentAt and skips the WhatsApp send.
 */
exports.autoTriggerCompletionPoll = functions.pubsub
  .schedule('every day 10:00')
  .timeZone('Asia/Singapore')
  .onRun(async () => {
    try {
      // Get today's date at start of day (SGT)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0]; // e.g., "2026-04-09"

      console.log(`🔄 Running auto-trigger completion poll check for date: ${todayISO}`);

      // Query all in_progress jobs with a scheduled preferred date
      // We filter for preferredTiming === 'Schedule' to skip ASAP jobs
      const jobsSnapshot = await admin.firestore()
        .collection('jobs')
        .where('status', '==', 'in_progress')
        .where('preferredTiming', '==', 'Schedule')
        .get();

      if (jobsSnapshot.empty) {
        console.log('ℹ️ No in_progress scheduled jobs found');
        return null;
      }

      let pollsSent = 0;
      let skipped = 0;

      for (const doc of jobsSnapshot.docs) {
        const job = doc.data();
        const jobId = doc.id;

        // Skip if completion poll was already sent (by handyman or previous auto-trigger)
        if (job.completionPollSentAt) {
          skipped++;
          continue;
        }

        // Skip if no preferred date set
        if (!job.preferredDate) {
          continue;
        }

        // Check if the preferred date is before today (job should have been done by now)
        // We send the poll the day AFTER the preferred date
        const preferredDate = new Date(job.preferredDate);
        preferredDate.setHours(0, 0, 0, 0);

        if (preferredDate >= today) {
          // Preferred date is today or in the future — not yet due
          continue;
        }

        // Skip if no customer phone number
        if (!job.customerPhone) {
          console.warn(`⚠️ Job ${jobId} has no customerPhone — skipping`);
          continue;
        }

        // Send the WhatsApp completion confirmation via Twilio template
        // Reuses the same job_completion template as the handyman "Mark Complete" path
        const toWhatsApp = formatPhoneToWhatsApp(job.customerPhone);
        const templateSid = process.env.TWILIO_TEMPLATE_JOB_COMPLETION;

        // Fallback freeform message for sandbox testing
        const fallbackMessage = `Hello ${job.customerName}! 👋

Your scheduled job has passed its appointment date:

📋 *Service:* ${job.serviceType}
🔖 *Job ID:* ${jobId}
📅 *Scheduled Date:* ${new Date(job.preferredDate).toLocaleDateString('en-SG')}

Please confirm if the work has been completed to your satisfaction.

👉 Reply *YES* to confirm completion
👉 Reply *NO* to report an issue`;

        // Template variables: {{1}} customerName, {{2}} handymanName, {{3}} serviceType, {{4}} jobId
        // For auto-trigger, handyman name comes from the job's acceptedBy field
        const handymanName = (job.completedBy && job.completedBy.name)
          || (job.acceptedBy && job.acceptedBy.name)
          || 'your handyman';

        const sendResult = await sendTwilioTemplateMessage(
          toWhatsApp,
          templateSid,
          { '1': job.customerName, '2': handymanName, '3': job.serviceType, '4': jobId },
          fallbackMessage
        );

        if (!sendResult.success) {
          console.error(`❌ Failed to send message for job ${jobId}:`, sendResult.error);
          continue;
        }

        // Mark the poll as sent to prevent duplicates
        await admin.firestore().collection('jobs').doc(jobId).update({
          completionPollSentAt: new Date().toISOString(),
          completionPollSentBy: 'auto_trigger'
        });

        pollsSent++;
        console.log(`✅ Completion poll sent for job ${jobId} (customer: ${job.customerName})`);
      }

      console.log(`🔄 Auto-trigger complete: ${pollsSent} polls sent, ${skipped} skipped (already sent)`);

      return {
        success: true,
        pollsSent,
        skipped
      };
    } catch (error) {
      console.error('❌ Error in auto-trigger completion poll:', error);
      throw error;
    }
  });
