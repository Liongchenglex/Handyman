/**
 * Firebase Cloud Functions for Stripe Integration
 *
 * This file contains all the serverless functions for handling Stripe operations
 * including Connect accounts, payments, transfers, and webhooks.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.secret_key);
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

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
 * Calculate payment splits
 * - Handyman gets 100% of service fee
 * - Platform fee ($5) is split 50/50 between cofounder and operator
 */
const calculateSplits = (serviceFee, platformFee = 5) => {
  const handymanShare = serviceFee; // 100% of service fee
  const cofounderShare = platformFee / 2; // 50% of platform fee
  const operatorShare = platformFee / 2; // 50% of platform fee

  return {
    cofounder: cofounderShare,
    operator: operatorShare,
    handyman: handymanShare,
    platformFee: platformFee,
    totalCollected: serviceFee + platformFee
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
      const { email, name, phone, uid } = req.body;

      if (!email || !name || !uid) {
        return res.status(400).json({ error: 'Missing required fields: email, name, uid' });
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

      // Update handyman document in Firestore
      await admin.firestore().collection('handymen').doc(uid).update({
        stripeConnectedAccountId: account.id,
        stripeAccountStatus: 'pending',
        stripeOnboardingCompleted: false,
        stripeDetailsSubmitted: false,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeChargesEnabled: account.charges_enabled,
        stripeConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Created Stripe account: ${account.id}`);

      return res.status(200).json({
        success: true,
        accountId: account.id,
      });
    } catch (error) {
      console.error('Error creating connected account:', error);
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
      const { accountId, refreshUrl, returnUrl } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: 'Missing accountId' });
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
      const accountId = req.query.accountId;

      if (!accountId) {
        return res.status(400).json({ error: 'Missing accountId parameter' });
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
      const { accountId } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: 'Missing accountId' });
      }

      const loginLink = await stripe.accounts.createLoginLink(accountId);

      return res.status(200).json({
        success: true,
        url: loginLink.url,
        created: loginLink.created,
      });
    } catch (error) {
      console.error('Error creating login link:', error);
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
      const {
        jobId,
        customerId,
        handymanId,
        serviceFee,
        serviceType,
        customerEmail
      } = req.body;

      if (!jobId || !customerId || !handymanId || !serviceFee || !serviceType) {
        return res.status(400).json({
          error: 'Missing required fields: jobId, customerId, handymanId, serviceFee, serviceType'
        });
      }

      console.log(`Creating payment intent for job: ${jobId}`);

      // Calculate total (service fee + 10% platform fee) - needed for all code paths
      const platformFeePercentage = 0.10;
      const platformFee = serviceFee * platformFeePercentage;
      const totalAmount = serviceFee + platformFee;
      const amountInCents = dollarsToCents(totalAmount);

      console.log(`Service Fee: $${serviceFee}, Platform Fee (10%): $${platformFee}, Total: $${totalAmount}`);

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
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing paymentIntentId' });
      }

      console.log(`Confirming payment intent: ${paymentIntentId}`);

      // Retrieve payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

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
      const paymentIntentId = req.query.paymentIntentId;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing paymentIntentId parameter' });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

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
      const {
        paymentIntentId,
        jobId,
        serviceFee,
        platformFee = 5,
        handymanAccountId,
        cofounderAccountId,
        operatorAccountId
      } = req.body;

      if (!paymentIntentId || !jobId || !serviceFee || !handymanAccountId || !cofounderAccountId || !operatorAccountId) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

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
      const { paymentIntentId, reason } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing paymentIntentId' });
      }

      console.log(`Refunding payment: ${paymentIntentId}`);

      // Get payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

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
