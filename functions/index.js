/**
 * Firebase Cloud Functions for Stripe Integration
 *
 * This file contains all the serverless functions for handling Stripe operations
 * including Connect accounts, payments, transfers, and webhooks.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.secret_key);
const jwt = require('jsonwebtoken'); // SECURITY FIX (Phase 1.3): JWT for approval tokens

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
    console.log(`✅ Authenticated user: ${decodedToken.uid}`);
    return decodedToken;
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    throw new Error('Unauthorized: Invalid authentication token');
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

      console.log(`Creating Stripe Connect account for: ${name} (${email})`);

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

      console.log(`✅ Created Stripe account: ${account.id}`);

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

      // Use provided URLs or fallback to defaults
      const refresh_url = refreshUrl || 'http://localhost:3000/handyman-dashboard?stripe_refresh=true';
      const return_url = returnUrl || 'http://localhost:3000/handyman-dashboard?stripe_onboarding=complete';

      console.log(`Creating account link for account: ${accountId}`);
      console.log(`Return URL: ${return_url}`);

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

      console.log(`Creating payment intent for job: ${jobId}`);
      if (handymanId) {
        console.log(`Handyman already assigned: ${handymanId}`);
      } else {
        console.log(`No handyman assigned yet - will be assigned after payment authorization`);
      }

      // Calculate total (service fee + configurable platform fee %)
      const platformFeePercentage = getPlatformFeePercentage();
      const platformFee = calculatePlatformFee(serviceFee);
      const totalAmount = serviceFee + platformFee;
      const amountInCents = dollarsToCents(totalAmount);

      console.log(`Service Fee: $${serviceFee}, Platform Fee: $${platformFee} (${platformFeePercentage * 100}%), Total: $${totalAmount}`);

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
            console.log(`⚠️ Job already has payment intent: ${existingPaymentIntentId}`);

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
              console.log(`✅ Updated job document ${jobId} with payment intent`);
            } else {
              console.log(`⚠️ Job document ${jobId} does not exist yet (using temporary ID for testing)`);
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

      console.log(`✅ Payment intent created: ${paymentIntent.id}`);

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

      console.log(`Confirming payment intent: ${paymentIntentId}`);

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

      console.log(`Releasing escrow and splitting payment for job: ${jobId}`);

      // Calculate splits
      const splits = calculateSplits(serviceFee, platformFee);

      console.log(`Split breakdown: Handyman: $${splits.handyman} (100% service fee), Cofounder: $${splits.cofounder} (50% platform fee), Operator: $${splits.operator} (50% platform fee)`);

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

      console.log(`✅ Payment split and released successfully`);

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

      console.log(`Refunding payment: ${paymentIntentId}`);

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

      console.log(`✅ Refund created: ${refund.id}`);

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
  const webhookSecret = functions.config().stripe.webhook_secret;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await admin.firestore().collection('jobs').doc(paymentIntent.metadata.jobId).update({
          paymentStatus: 'succeeded',
          paymentSucceededAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Payment succeeded for job: ${paymentIntent.metadata.jobId}`);
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
          console.log(`✅ Account updated for handyman: ${firebaseUid}, Status: ${account.details_submitted ? 'complete' : 'pending'}`);
        }
        break;

      case 'transfer.created':
        const transfer = event.data.object;
        console.log(`Transfer created: ${transfer.id} for job ${transfer.metadata.jobId}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ===================================
// WHATSAPP WEBHOOK (Green-API)
// ===================================

/**
 * WhatsApp Webhook Handler (Green-API)
 *
 * Handles incoming WhatsApp messages and poll responses from Green-API
 * Used for processing poll votes from job completion notifications
 *
 * Poll Options:
 * - "✅ Yes, Confirm Complete" → Updates job status to 'completed', releases payment
 * - "⚠️ No, Report Issue" → Updates job status to 'disputed', notifies support
 *
 * Green-API Webhook Documentation: https://green-api.com/en/docs/api/receiving/
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  try {
    console.log('📱 WhatsApp webhook received (Green-API)');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Only handle POST requests
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const webhookData = req.body;

    // Check if this is a valid Green-API webhook
    if (!webhookData.typeWebhook) {
      console.warn('⚠️ Invalid webhook format - missing typeWebhook');
      return res.status(400).json({ error: 'Invalid webhook format' });
    }

    // Only process incoming messages
    if (webhookData.typeWebhook !== 'incomingMessageReceived') {
      console.log(`ℹ️ Ignoring webhook type: ${webhookData.typeWebhook}`);
      return res.status(200).json({ received: true, processed: false });
    }

    const messageData = webhookData.messageData;
    const senderData = webhookData.senderData;

    if (!messageData || !senderData) {
      console.warn('⚠️ Missing messageData or senderData');
      return res.status(400).json({ error: 'Missing required data' });
    }

    // Extract customer phone from chatId (format: 6591234567@c.us)
    const chatId = senderData.chatId || senderData.sender;
    const customerPhone = chatId.replace('@c.us', '');
    console.log(`Customer: ${customerPhone}`);
    console.log(`Message Type: ${messageData.typeMessage}`);

    // Handle poll vote updates
    if (messageData.typeMessage === 'pollUpdateMessage') {
      console.log('📊 Processing poll vote...');

      const pollData = messageData.pollMessageData;
      if (!pollData || !pollData.votes) {
        console.warn('⚠️ Invalid poll data');
        return res.status(400).json({ error: 'Invalid poll data' });
      }

      // Find which option was selected (has voters)
      let selectedOption = null;
      for (const vote of pollData.votes) {
        if (vote.optionVoters && vote.optionVoters.length > 0) {
          selectedOption = vote.optionName;
          break;
        }
      }

      console.log(`Selected option: ${selectedOption}`);

      if (!selectedOption) {
        console.warn('⚠️ No option selected in poll');
        return res.status(200).json({ received: true, processed: false });
      }

      // Find the most recent pending_confirmation job for this customer
      // Try multiple phone formats since customer might have stored different format
      const phoneFormats = [
        customerPhone,
        `+${customerPhone}`,
        customerPhone.startsWith('65') ? customerPhone.substring(2) : customerPhone
      ];

      let jobsSnapshot = null;
      for (const phoneFormat of phoneFormats) {
        const snapshot = await db.collection('jobs')
          .where('customerPhone', '==', phoneFormat)
          .where('status', '==', 'pending_confirmation')
          .orderBy('completedAt', 'desc')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          jobsSnapshot = snapshot;
          console.log(`Found job with phone format: ${phoneFormat}`);
          break;
        }
      }

      if (!jobsSnapshot || jobsSnapshot.empty) {
        console.warn('⚠️ No pending job found for customer:', customerPhone);
        // Could send a message back via Green-API here if needed
        return res.status(200).json({
          received: true,
          processed: false,
          reason: 'No pending job found'
        });
      }

      const jobDoc = jobsSnapshot.docs[0];
      const jobId = jobDoc.id;
      const jobData = jobDoc.data();

      console.log(`Found job: ${jobId}`);

      // Handle poll response
      if (selectedOption.includes('Confirm') || selectedOption.includes('Yes') || selectedOption.includes('✅')) {
        // Customer confirmed job completion
        console.log('✅ Customer confirmed job completion via poll');

        // Update job status to completed
        await db.collection('jobs').doc(jobId).update({
          status: 'completed',
          customerConfirmedAt: new Date().toISOString(),
          confirmedVia: 'whatsapp_poll'
        });

        // Log payment release info
        console.log('💰 Payment release required');
        console.log(`Job ID: ${jobId}`);
        if (jobData.paymentIntentId) {
          console.log(`Payment Intent ID: ${jobData.paymentIntentId}`);
        }
        console.log(`Amount: $${jobData.estimatedBudget}`);

        // Send confirmation message via Green-API
        await sendGreenApiMessage(
          chatId,
          `✅ Thank you for confirming!\n\nYour payment of $${jobData.estimatedBudget} has been released to the handyman.\n\nWe hope to serve you again! 🔧`
        );

        console.log('✅ Job confirmed and payment logged for release');
        return res.status(200).json({ received: true, processed: true, action: 'confirmed' });

      } else if (selectedOption.includes('Report') || selectedOption.includes('Issue') || selectedOption.includes('No') || selectedOption.includes('⚠️')) {
        // Customer reported an issue
        console.log('⚠️ Customer reported an issue via poll');

        // Update job status to disputed
        await db.collection('jobs').doc(jobId).update({
          status: 'disputed',
          disputedAt: new Date().toISOString(),
          disputedVia: 'whatsapp_poll',
          disputeReason: 'Customer reported issue via WhatsApp poll'
        });

        // TODO: Send notification to support team
        console.log('📧 Support team should be notified about dispute');

        // Send confirmation message
        await sendGreenApiMessage(
          chatId,
          `⚠️ We've received your report.\n\nOur support team will contact you shortly to resolve the issue.\n\nJob ID: ${jobId}`
        );

        console.log('⚠️ Job marked as disputed');
        return res.status(200).json({ received: true, processed: true, action: 'disputed' });

      } else {
        console.warn('Unknown poll option selected:', selectedOption);
        return res.status(200).json({ received: true, processed: false, reason: 'Unknown option' });
      }

    } else if (messageData.typeMessage === 'textMessage') {
      // Handle text message (could be used for support replies)
      console.log('💬 Text message received:', messageData.textMessageData?.textMessage);
      // For now, just acknowledge receipt
      return res.status(200).json({ received: true, processed: false, type: 'text' });

    } else {
      // Other message types (images, files, etc.)
      console.log(`ℹ️ Ignoring message type: ${messageData.typeMessage}`);
      return res.status(200).json({ received: true, processed: false });
    }

  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Helper function to send a message via Green-API
 * Used by webhook to send confirmation messages
 */
async function sendGreenApiMessage(chatId, message) {
  const apiUrl = functions.config().greenapi?.apiurl || 'https://api.green-api.com';
  const idInstance = functions.config().greenapi?.idinstance;
  const apiToken = functions.config().greenapi?.apitoken;

  if (!idInstance || !apiToken) {
    console.warn('⚠️ Green-API not configured in Firebase functions config');
    return { success: false, error: 'Green-API not configured' };
  }

  try {
    const response = await fetch(
      `${apiUrl}/waInstance${idInstance}/sendMessage/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      }
    );

    const data = await response.json();
    console.log('📱 Green-API response:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error sending Green-API message:', error);
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
      console.log('🧹 Starting cleanup of abandoned jobs...');

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
        console.log('✅ No abandoned jobs found');
        return null;
      }

      console.log(`Found ${abandonedJobsSnapshot.size} abandoned jobs to delete`);

      // Delete abandoned jobs in batch
      const batch = admin.firestore().batch();
      const deletedJobIds = [];

      abandonedJobsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedJobIds.push(doc.id);
        console.log(`Deleting abandoned job: ${doc.id}`);
      });

      await batch.commit();

      console.log(`✅ Successfully deleted ${deletedJobIds.length} abandoned jobs`);
      console.log('Deleted job IDs:', deletedJobIds);

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
