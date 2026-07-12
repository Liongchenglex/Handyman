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

// Project ID. The Cloud Functions runtime injects GCLOUD_PROJECT
// automatically, so this resolves correctly on deploy with no config.
// PROJECT_ID env var allows an explicit override for local tooling /
// the emulator. Everything project-bound (CORS origins, hosting links
// in notifications) is derived from this so switching to a different
// Firebase project requires no code edits — see also
// src/config/firebaseProject.js for the frontend equivalent.
const PROJECT_ID = process.env.PROJECT_ID
  || process.env.GCLOUD_PROJECT
  || process.env.GCP_PROJECT
  || 'eazydone-d06cf';
const HOSTING_URL = process.env.HOSTING_URL || `https://${PROJECT_ID}.web.app`;

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

// Server-side pricing table. The client computes a serviceFee from
// the same data and sends it on createPaymentIntent — the server
// recomputes from this table and rejects any mismatch, so a tampered
// client can never authorise $0.01 for a $120 job.
const {
  getServicePrice,
  getServicePriceMax,
  isKnownServiceType,
} = require('./servicePricing');

// Handyman new-job WhatsApp fan-out. The notifier module owns the
// eligibility query, per-message idempotency and per-handyman rate
// limiting; the Firestore trigger at the bottom of this file is a thin
// wrapper that detects the paid-transition and delegates.
// See docs/features/handyman-job-notifications.md.
const { runFanOut: runHandymanFanOut } = require('./handymanNotifier');
const { NOTIFY_ENABLED } = require('./notificationConfig');

// Job reassignment — cancel-side domain logic (pure validation +
// update-payload construction). See functions/jobReassignment.js and
// docs/superpowers/specs/2026-07-10-job-reassignment-design.md.
const {
  validateCancelRequest,
  buildCancelUpdate,
  CancelError,
} = require('./jobReassignment');

// Booking-time escrow capture decision (job lifecycle Scenario 0).
// See functions/paymentCapture.js and
// docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md.
const { assessCaptureability } = require('./paymentCapture');

// ===================================
// CORS CONFIGURATION (Security Fix Phase 0.1)
// ===================================
// Whitelist approved origins only - prevents unauthorized cross-origin
// requests. The two production origins are derived from PROJECT_ID so
// they track whichever Firebase project this is deployed to.
const allowedOrigins = [
  `https://${PROJECT_ID}.web.app`,
  `https://${PROJECT_ID}.firebaseapp.com`,
  'http://localhost:3000',  // Development - React dev server
  'http://localhost:5000',  // Development - Firebase emulator
  // Production custom domain. The live site is served here (not on the
  // *.web.app default), so without these every browser Cloud Function call
  // is CORS-blocked (405). Both the apex and the www host must be listed:
  // the browser sends the exact Origin the user is on, and there is no
  // www<->apex normalisation at the CORS layer.
  'https://easydonehandyman.sg',
  'https://www.easydonehandyman.sg',
  // Optional per-deploy extras (comma-separated), e.g. Hosting preview
  // channels or a future domain — set CORS_ALLOWED_ORIGINS in the function
  // env to extend without a code change.
  ...(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
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
 * Admin authorization model.
 *
 * Source of truth: Firebase Auth custom claims. A user with the
 * `admin: true` custom claim is an admin everywhere — backend
 * Cloud Functions, Firestore rules, and Storage rules all read the
 * same `request.auth.token.admin` field.
 *
 * Bootstrap path: see scripts/grant-admin.js. Run it once with a
 * service-account key to seed the first admin; after that, admins
 * grant other admins via the setAdminClaim callable below.
 *
 * Transitional email allow-list: kept as a SECONDARY path during the
 * migration so existing admins don't lock themselves out before they
 * run the bootstrap. Remove this constant (and the fallbacks below)
 * once every admin user has the custom claim set.
 */
const ADMIN_EMAILS_FALLBACK = [
  'easydonehandyman@gmail.com',
];

/**
 * Returns true if the decoded ID token carries the admin custom claim
 * OR (transitionally) the caller's email is in the allow-list.
 */
const isAdminToken = (decodedToken) => {
  if (!decodedToken) return false;
  if (decodedToken.admin === true) return true;
  if (decodedToken.email && ADMIN_EMAILS_FALLBACK.includes(decodedToken.email)) {
    // Log so we can see who still relies on the fallback and clear it.
    console.warn(`ℹ️ Admin via email fallback: ${decodedToken.email} (uid=${decodedToken.uid}). Run scripts/grant-admin.js to set the custom claim.`);
    return true;
  }
  return false;
};

/**
 * Throwing variant of isAdminToken. Use inside try/catch handlers that
 * already map "Forbidden" to a 403 response.
 */
const verifyAdminAccess = (decodedToken) => {
  if (!isAdminToken(decodedToken)) {
    console.warn(`🚫 Unauthorized admin access attempt by: ${decodedToken && (decodedToken.email || decodedToken.uid)}`);
    throw new Error('Forbidden: Admin access required');
  }
};

/**
 * setAdminClaim — grants or revokes the `admin: true` custom claim on
 * a target user. Once granted, the target's next ID-token refresh
 * carries `auth.token.admin === true`, which both this backend and the
 * Firestore/Storage rules read as the source of truth for admin auth.
 *
 * Authorization:
 *   - Caller must already be an admin (custom claim OR transitional
 *     email fallback). This means the FIRST admin must be seeded via
 *     scripts/grant-admin.js — a one-time, service-account-authenticated
 *     bootstrap step. After that, admins promote each other through
 *     this endpoint.
 *
 * Body: { targetUid: string, admin: boolean }
 *
 * NOTE: the granted user must sign out and back in (or call
 * user.getIdToken(true) to force-refresh) before the new claim appears
 * on their ID token.
 */
exports.setAdminClaim = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const decodedToken = await verifyAuthToken(req);
      verifyAdminAccess(decodedToken);

      const { targetUid, admin: makeAdmin } = req.body || {};
      if (!targetUid || typeof makeAdmin !== 'boolean') {
        return res.status(400).json({ error: 'Body must include { targetUid: string, admin: boolean }' });
      }

      // Refuse to let the last admin demote themselves — that would
      // strand the platform with no admin at all (only fix: re-run the
      // bootstrap script). Cheap defense: forbid an admin from removing
      // their own claim through this endpoint. Demotions of other
      // admins are allowed.
      if (targetUid === decodedToken.uid && makeAdmin === false) {
        return res.status(400).json({
          error: 'Refusing to remove your own admin claim. Have another admin demote you, or use scripts/grant-admin.js.',
        });
      }

      // Preserve any existing custom claims on the target user (don't
      // clobber unrelated claims if we add others later).
      const targetUser = await admin.auth().getUser(targetUid);
      const existingClaims = targetUser.customClaims || {};
      const nextClaims = { ...existingClaims };
      if (makeAdmin) nextClaims.admin = true;
      else delete nextClaims.admin;

      await admin.auth().setCustomUserClaims(targetUid, nextClaims);

      console.log(`🛡️ Admin claim ${makeAdmin ? 'granted' : 'revoked'}: target=${targetUid} (${targetUser.email}) by=${decodedToken.email || decodedToken.uid}`);

      await writeAuditLog(makeAdmin ? 'admin_grant' : 'admin_revoke', decodedToken, {
        targetUid,
        targetEmail: targetUser.email || null,
        previousClaims: existingClaims,
        nextClaims,
      });

      return res.status(200).json({
        success: true,
        targetUid,
        admin: !!makeAdmin,
        message: 'Target user must refresh their ID token before the new claim takes effect (sign out/in or call getIdToken(true)).',
      });
    } catch (error) {
      console.error('❌ setAdminClaim failed:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }
      return res.status(500).json({ error: 'Failed to set admin claim', message: error.message });
    }
  });
});

// ===================================
// HANDYMAN APPROVAL TOKEN (server-issued JWT)
// ===================================

/**
 * APPROVAL_SECRET is the symmetric HMAC key used to sign handyman-
 * approval JWTs. It lives only in the Cloud Functions environment and
 * is NEVER shipped to the browser. If unset, the code below refuses to
 * sign or verify — failing closed is better than silently issuing
 * unguessable-but-unsigned tokens.
 *
 * Previously the secret was REACT_APP_APPROVAL_SECRET on the frontend
 * (baked into the JS bundle) — see emailService.js history. With the
 * server-issued flow, that variable is no longer used in the bundle.
 */
const APPROVAL_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const APPROVAL_TOKEN_ISSUER = 'eazydone.handyman-approval';

const getApprovalSecret = () => {
  const secret = process.env.APPROVAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Server misconfiguration: APPROVAL_SECRET is missing or too short');
  }
  return secret;
};

/**
 * generateApprovalToken — issues a signed JWT that authorizes approval
 * of a specific handymanId. The token is emailed to the operations
 * team and consumed by processHandymanApproval.
 *
 * Auth model: the registering handyman calls this for their OWN
 * handymanId (so the token can be embedded in the operations email
 * that's sent on registration). An admin can call it for any id.
 *
 * Body: { handymanId: string }
 */
exports.generateApprovalToken = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const decodedToken = await verifyAuthToken(req);
      const { handymanId } = req.body || {};
      if (!handymanId || typeof handymanId !== 'string') {
        return res.status(400).json({ error: 'Body must include { handymanId: string }' });
      }
      // Restrict who can mint a token: the registering handyman (for
      // their own id) or any admin. Anonymous customers do NOT need
      // this endpoint, so we don't carve out an exception for them.
      if (decodedToken.uid !== handymanId && !isAdminToken(decodedToken)) {
        console.warn(`🚫 generateApprovalToken denied: ${decodedToken.uid} tried to mint token for ${handymanId}`);
        return res.status(403).json({ error: 'Forbidden: can only mint approval tokens for your own handymanId' });
      }

      const token = jwt.sign(
        { handymanId, purpose: 'handyman_approval' },
        getApprovalSecret(),
        {
          algorithm: 'HS256',
          expiresIn: APPROVAL_TOKEN_TTL_SECONDS,
          issuer: APPROVAL_TOKEN_ISSUER,
        }
      );

      return res.status(200).json({ token, expiresInSeconds: APPROVAL_TOKEN_TTL_SECONDS });
    } catch (error) {
      console.error('❌ generateApprovalToken failed:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Server misconfiguration')) {
        return res.status(500).json({ error: 'Server misconfiguration', message: 'APPROVAL_SECRET not configured' });
      }
      return res.status(500).json({ error: 'Failed to mint approval token', message: error.message });
    }
  });
});

/**
 * processHandymanApproval — verifies a server-signed approval JWT and
 * applies the requested action ('approve' or 'reject') to the handyman
 * document. Uses the Admin SDK so it bypasses Firestore rules — the
 * combination of (signed JWT + admin auth) is the entire authorization.
 *
 * Both must be present:
 *   1. A valid, unexpired JWT signed by APPROVAL_SECRET.
 *   2. The caller's Firebase ID token carries the `admin` claim.
 *
 * Defence-in-depth: the token alone used to be sufficient (the old
 * client-decoded scheme). Requiring admin auth on top means a leaked
 * link can't be redeemed by a non-admin even before token expiry.
 *
 * Body: { token: string, action: 'approve' | 'reject', reason?: string }
 */
exports.processHandymanApproval = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const decodedToken = await verifyAuthToken(req);
      verifyAdminAccess(decodedToken);

      const { token, action, reason } = req.body || {};
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Missing token' });
      }
      if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
      }

      let payload;
      try {
        payload = jwt.verify(token, getApprovalSecret(), {
          algorithms: ['HS256'],
          issuer: APPROVAL_TOKEN_ISSUER,
        });
      } catch (verifyErr) {
        // jsonwebtoken throws specific error classes for expired vs
        // tampered vs unknown-issuer. We don't differentiate to the
        // caller to avoid giving an attacker a "you're close" signal.
        console.warn(`🚫 Approval token rejected (${verifyErr.name}): ${verifyErr.message}`);
        return res.status(401).json({ error: 'Invalid or expired approval token' });
      }

      if (payload.purpose !== 'handyman_approval' || !payload.handymanId) {
        return res.status(400).json({ error: 'Approval token payload is malformed' });
      }

      const handymanRef = admin.firestore().collection('handymen').doc(payload.handymanId);
      const handymanSnap = await handymanRef.get();
      if (!handymanSnap.exists) {
        return res.status(404).json({ error: 'Handyman not found' });
      }
      const handyman = handymanSnap.data();

      // Idempotent re-handling: if the handyman was already processed
      // via the same action, return success so duplicate clicks (e.g.
      // a refresh on the result page) don't surface an error.
      if (action === 'approve' && handyman.status === 'active' && handyman.verified === true) {
        return res.status(200).json({ success: true, alreadyProcessed: true, action: 'approve', handyman });
      }
      if (action === 'reject' && handyman.status === 'rejected') {
        return res.status(200).json({ success: true, alreadyProcessed: true, action: 'reject', handyman });
      }

      const nowIso = new Date().toISOString();
      const update = action === 'approve'
        ? { verified: true, status: 'active', verifiedAt: nowIso, verifiedBy: decodedToken.email || decodedToken.uid, updatedAt: nowIso }
        : { verified: false, status: 'rejected', rejectedAt: nowIso, rejectedBy: decodedToken.email || decodedToken.uid, rejectedReason: reason || '', updatedAt: nowIso };

      await handymanRef.update(update);

      await writeAuditLog(action === 'approve' ? 'handyman_approve' : 'handyman_reject', decodedToken, {
        targetId: payload.handymanId,
        targetEmail: handyman.email || null,
        targetName: handyman.name || null,
        reason: action === 'reject' ? (reason || '') : null,
        previousStatus: handyman.status || null,
        newStatus: update.status,
      });

      return res.status(200).json({
        success: true,
        action,
        handymanId: payload.handymanId,
        handyman: { ...handyman, ...update },
      });
    } catch (error) {
      console.error('❌ processHandymanApproval failed:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }
      if (error.message.includes('Server misconfiguration')) {
        return res.status(500).json({ error: 'Server misconfiguration', message: 'APPROVAL_SECRET not configured' });
      }
      return res.status(500).json({ error: 'Failed to process approval', message: error.message });
    }
  });
});

/**
 * checkEmailExists — reports whether a Firebase Auth user already exists
 * for a given email. Called by the handyman signup screen so a
 * duplicate registration is caught immediately, instead of after the
 * applicant has filled out the entire multi-step profile form (where
 * createUserWithEmailAndPassword would finally reject it).
 *
 * Unauthenticated by design — the signup screen has no user yet. This
 * does technically allow email enumeration, but the registration flow
 * ALREADY reveals the same fact ("This email is already registered")
 * at final submit, so this endpoint exposes nothing new. It only
 * returns a boolean — never any user data.
 *
 * Body: { email: string }  ->  { exists: boolean }
 */
exports.checkEmailExists = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Missing email' });
    }
    try {
      await admin.auth().getUserByEmail(email.trim().toLowerCase());
      return res.status(200).json({ exists: true });
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        return res.status(200).json({ exists: false });
      }
      // auth/invalid-email or anything else — don't block signup on an
      // infra hiccup; the final createUserWithEmailAndPassword is still
      // the hard gate. Report the failure so the client can decide.
      console.error('checkEmailExists lookup failed:', err.code || err.message);
      return res.status(500).json({ error: 'Email lookup failed' });
    }
  });
});

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Sliding-window rate limit backed by a Firestore document at
 * `rateLimits/{key}`. Wrapped in a transaction so concurrent callers
 * can't both decide they're under the cap on the same request.
 *
 * The window is enforced by storing recent request timestamps (ms) and
 * filtering anything older than now - windowSeconds*1000. The doc is
 * idempotent to recreate; we don't TTL-expire it explicitly because
 * the stored array is bounded by `maxRequests` and gets trimmed on
 * every check.
 *
 * @param {string} key - Stable identifier (e.g. `whatsapp_send_${uid}`).
 * @param {number} maxRequests - Cap within the window.
 * @param {number} windowSeconds - Sliding window size in seconds.
 * @returns {Promise<{allowed: boolean, retryAfterSeconds?: number, remaining?: number}>}
 */
const checkRateLimit = async (key, maxRequests, windowSeconds) => {
  const docRef = admin.firestore().collection('rateLimits').doc(key);
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const previous = (snap.exists && Array.isArray(snap.data().requests)) ? snap.data().requests : [];
    const fresh = previous.filter((t) => typeof t === 'number' && t > windowStart);

    if (fresh.length >= maxRequests) {
      const oldest = fresh[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowSeconds * 1000 - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    fresh.push(now);
    tx.set(docRef, {
      requests: fresh,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      windowSeconds,
      maxRequests,
    });
    return { allowed: true, remaining: maxRequests - fresh.length };
  });
};

/**
 * Append an audit-log entry. Money-movement and admin actions call
 * this on success so we have an immutable record (write-only via
 * Admin SDK; clients can't write, admins can read).
 *
 * Failures here are NEVER allowed to bubble up and fail the caller's
 * operation — losing an audit entry is bad, but it's much worse to
 * roll back a successful Stripe transfer because we couldn't write
 * a log row. Errors are logged to Cloud Logging instead so they're
 * still observable.
 *
 * @param {string} action - e.g. 'fund_release', 'refund', 'admin_grant'
 * @param {object} decodedToken - the caller's decoded ID token
 * @param {object} fields - action-specific payload (targetId, amount, etc)
 */
const writeAuditLog = async (action, decodedToken, fields = {}) => {
  try {
    await admin.firestore().collection('auditLog').add({
      action,
      actorUid: (decodedToken && decodedToken.uid) || null,
      actorEmail: (decodedToken && decodedToken.email) || null,
      actorIsAdmin: isAdminToken(decodedToken),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ...fields,
    });
  } catch (err) {
    console.error(`⚠️ writeAuditLog(${action}) failed:`, err);
  }
};

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
 * POST /syncStripeOnboardingStatus
 *
 * Server-authoritative onboarding-completion check + persist.
 *
 * The dashboard gate keys off `stripeOnboardingCompleted` on the handyman
 * doc. That flag must NEVER be set by the client: Stripe redirects to the
 * onboarding `return_url` even when the user abandons the flow, so trusting
 * the redirect (or letting the browser write the flag) lets a handyman
 * bypass onboarding. Firestore rules now forbid the client from writing any
 * of the stripe* capability fields; only this function (Admin SDK, which
 * bypasses rules) and the account.updated webhook may set them.
 *
 * Auth: the caller's Firebase ID token identifies the handyman. We read the
 * connected-account id from THEIR server-side doc — never from the request —
 * so a caller can only ever sync their own account. Returns the resolved
 * status and whether onboarding is genuinely complete.
 */
exports.syncStripeOnboardingStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const decodedToken = await verifyAuthToken(req);
      const uid = decodedToken.uid;

      const handymanRef = admin.firestore().collection('handymen').doc(uid);
      const handymanDoc = await handymanRef.get();
      if (!handymanDoc.exists) {
        return res.status(404).json({ error: 'Handyman profile not found' });
      }

      const accountId = handymanDoc.data().stripeConnectedAccountId;

      // No connected account yet → definitively not onboarded. Persist false
      // so the dashboard keeps showing the onboarding prompt.
      if (!accountId) {
        await handymanRef.update({
          stripeOnboardingCompleted: false,
          stripeAccountStatus: 'pending',
          updatedAt: new Date().toISOString(),
        });
        return res.status(200).json({ success: true, onboardingComplete: false });
      }

      const account = await stripe.accounts.retrieve(accountId);
      const onboardingComplete = !!(
        account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled &&
        (account.requirements?.currently_due?.length === 0)
      );

      await handymanRef.update({
        stripeOnboardingCompleted: onboardingComplete,
        stripeAccountStatus: onboardingComplete ? 'complete' : 'pending',
        stripeDetailsSubmitted: !!account.details_submitted,
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        onboardingComplete,
        status: {
          detailsSubmitted: !!account.details_submitted,
          chargesEnabled: !!account.charges_enabled,
          payoutsEnabled: !!account.payouts_enabled,
          requirementsCurrentlyDue: account.requirements?.currently_due || [],
        },
      });
    } catch (error) {
      console.error('Error syncing Stripe onboarding status:', error);
      if (error.message && error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
      }
      return res.status(500).json({
        error: 'Failed to sync onboarding status',
        message: error.message,
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

      // Server-side amount derivation. Previously the client could
      // submit any `serviceFee` value and we'd charge it — meaning a
      // tampered checkout could authorise $0.01 for a $120 job and
      // the platform would only discover the under-charge after the
      // handyman did the work. We now look up the published price
      // for the serviceType and reject if the client-sent fee
      // doesn't match.
      //
      // Tolerance: we allow a 1-cent epsilon to accommodate floating-
      // point representation differences when the frontend computes
      // and serialises the amount. Anything larger is a tamper signal.
      if (!isKnownServiceType(serviceType)) {
        console.warn(`🚫 Payment rejected: unknown serviceType "${serviceType}" from ${decodedToken.uid}`);
        return res.status(400).json({
          error: `Unknown serviceType: ${serviceType}`,
          message: 'Service type must be one of the published service categories.',
        });
      }
      const expectedServiceFee = getServicePrice(serviceType);
      if (Math.abs(serviceFee - expectedServiceFee) > 0.01) {
        console.warn(`🚫 Payment rejected: ${decodedToken.uid} sent serviceFee=${serviceFee} for ${serviceType}, expected ${expectedServiceFee}`);
        return res.status(400).json({
          error: 'Amount mismatch',
          message: `The expected service fee for ${serviceType} is $${expectedServiceFee.toFixed(2)}. Refresh the page and try again.`,
        });
      }

      // From here on the server-computed values are authoritative for
      // the amount we actually charge — we never multiply by the
      // client-supplied serviceFee again.
      const platformFee = calculatePlatformFee(expectedServiceFee);
      const totalAmount = expectedServiceFee + platformFee;
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

          // Create NEW payment intent with manual capture (for escrow).
          // Idempotency key is keyed on jobId so a network-level retry of this
          // request cannot create a second PaymentIntent for the same job. The
          // Firestore transaction above guards against the same client racing,
          // and this guards against retries at the HTTP layer.
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
              // Persist the server-validated amounts (not the client-
              // supplied values). Downstream reads — escrow release,
              // refund, audit — should trust this metadata.
              serviceFee: expectedServiceFee.toString(),
              platformFee: platformFee.toString(),
              totalAmount: totalAmount.toString(),
              serviceType: serviceType,
              platform: 'handyman-platform',
            },
            statement_descriptor: 'HANDYMAN SVC',
            statement_descriptor_suffix: serviceType.substring(0, 10),
          }, {
            idempotencyKey: `pi-create-${jobId}`,
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

      // Authorization: the caller must be the customer who owns the
      // payment. We check this TWICE — once against the paymentIntent
      // metadata (the recorded payer at intent creation) and once
      // against the job document's customerId (the recorded owner of
      // the work). The two should always agree; if they don't, treat
      // it as a sign of tampered metadata and refuse.
      const metadataCustomerId = paymentIntent.metadata && paymentIntent.metadata.customerId;
      if (metadataCustomerId !== decodedToken.uid) {
        console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to confirm payment ${paymentIntentId} (metadata customer=${metadataCustomerId})`);
        return res.status(403).json({ error: 'Forbidden: Cannot confirm another user\'s payment' });
      }

      const metadataJobId = paymentIntent.metadata && paymentIntent.metadata.jobId;
      if (metadataJobId) {
        const jobSnap = await admin.firestore().collection('jobs').doc(metadataJobId).get();
        if (jobSnap.exists) {
          const jobCustomerId = jobSnap.data().customerId;
          if (jobCustomerId && jobCustomerId !== decodedToken.uid) {
            console.warn(`🚫 Authorization failed: customerId mismatch — caller=${decodedToken.uid}, job.customerId=${jobCustomerId}, pi.metadata.customerId=${metadataCustomerId} (pi=${paymentIntentId}, job=${metadataJobId})`);
            return res.status(403).json({ error: 'Forbidden: payment/job customer mismatch' });
          }
        }
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
 * Release escrow and split payment (CURRENTLY UNUSED)
 *
 * Commented out — the app uses releaseEscrowSimple instead.
 * Kept for future reference when multi-party splits are needed.
 *
 * - Handyman gets 100% of service fee
 * - Platform fee is split 50/50 between cofounder and operator
 *
 * POST /releaseEscrowAndSplit
 * Body: { paymentIntentId, jobId, serviceFee, platformFee, handymanAccountId, cofounderAccountId, operatorAccountId }
 */
// exports.releaseEscrowAndSplit = functions.https.onRequest((req, res) => {
//   cors(req, res, async () => {
//     if (req.method !== 'POST') {
//       return res.status(405).json({ error: 'Method not allowed' });
//     }
//     try {
//       const decodedToken = await verifyAuthToken(req);
//       const validatedData = validate(escrowReleaseSchema)(req.body);
//       const {
//         paymentIntentId, jobId, serviceFee, platformFee,
//         handymanAccountId, cofounderAccountId, operatorAccountId
//       } = validatedData;
//       const splits = calculateSplits(serviceFee, platformFee);
//       const [cofounderTransfer, operatorTransfer, handymanTransfer] = await Promise.all([
//         stripe.transfers.create({
//           amount: dollarsToCents(splits.cofounder), currency: 'sgd',
//           destination: cofounderAccountId,
//           description: `Cofounder platform fee share for job #${jobId}`,
//           metadata: { jobId, recipient: 'cofounder', share: '50% of platform fee', platformFee: platformFee.toString() },
//         }),
//         stripe.transfers.create({
//           amount: dollarsToCents(splits.operator), currency: 'sgd',
//           destination: operatorAccountId,
//           description: `Operator platform fee share for job #${jobId}`,
//           metadata: { jobId, recipient: 'operator', share: '50% of platform fee', platformFee: platformFee.toString() },
//         }),
//         stripe.transfers.create({
//           amount: dollarsToCents(splits.handyman), currency: 'sgd',
//           destination: handymanAccountId,
//           description: `Handyman payment for job #${jobId}`,
//           metadata: { jobId, recipient: 'handyman', share: '100% of service fee', serviceFee: serviceFee.toString() },
//         })
//       ]);
//       await admin.firestore().collection('jobs').doc(jobId).update({
//         paymentStatus: 'released',
//         paymentReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
//         transferIds: { cofounder: cofounderTransfer.id, operator: operatorTransfer.id, handyman: handymanTransfer.id },
//         splits: { cofounder: splits.cofounder, operator: splits.operator, handyman: splits.handyman },
//       });
//       return res.status(200).json({
//         success: true,
//         transfers: {
//           cofounder: { id: cofounderTransfer.id, amount: splits.cofounder },
//           operator: { id: operatorTransfer.id, amount: splits.operator },
//           handyman: { id: handymanTransfer.id, amount: splits.handyman },
//         },
//       });
//     } catch (error) {
//       console.error('Error releasing escrow:', error);
//       if (error.message.includes('Unauthorized')) {
//         return res.status(401).json({ error: 'Unauthorized', message: error.message });
//       }
//       if (error.message.includes('Forbidden')) {
//         return res.status(403).json({ error: 'Forbidden', message: error.message });
//       }
//       return res.status(500).json({ error: 'Failed to release escrow', message: error.message });
//     }
//   });
// });

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

      // Pre-flight: claim a Firestore transaction lock on the job before
      // touching Stripe. Two parallel admin clicks would otherwise both
      // pass the same paymentStatus check and both attempt to transfer.
      // The Stripe idempotency key dedups the second TRANSFER, but the
      // surrounding Firestore writes could still race and leave the job
      // in an inconsistent state.
      //
      // Stale-lock recovery: if a previous attempt crashed mid-flight
      // (e.g. the function timed out between Stripe success and the
      // final Firestore write), the lock would block all future
      // attempts indefinitely. We treat a 'release_pending' lock older
      // than RELEASE_LOCK_STALE_MS as stale and re-acquire it. The
      // underlying Stripe call is idempotent, so re-running on a stale
      // lock is safe — it returns the original transfer.
      const RELEASE_LOCK_STALE_MS = 2 * 60 * 1000;
      const jobRef = admin.firestore().collection('jobs').doc(jobId);

      let jobData;
      let lockResult;
      try {
        lockResult = await admin.firestore().runTransaction(async (tx) => {
          const snap = await tx.get(jobRef);
          if (!snap.exists) {
            return { ok: false, status: 404, error: 'Job not found' };
          }
          const data = snap.data();

          if (data.paymentStatus === 'released') {
            return { ok: false, status: 409, error: 'Payment already released for this job' };
          }

          if (data.paymentStatus === 'release_pending') {
            const lockedAt = data.releaseLockedAt && data.releaseLockedAt.toMillis
              ? data.releaseLockedAt.toMillis()
              : 0;
            const ageMs = Date.now() - lockedAt;
            if (ageMs < RELEASE_LOCK_STALE_MS) {
              return {
                ok: false,
                status: 409,
                error: 'A release for this job is already in progress',
              };
            }
            console.warn(`🔓 Re-acquiring stale release lock for job ${jobId} (age=${ageMs}ms)`);
          }

          tx.update(jobRef, {
            paymentStatus: 'release_pending',
            releaseLockedAt: admin.firestore.FieldValue.serverTimestamp(),
            releaseLockedBy: decodedToken.email || decodedToken.uid,
          });
          return { ok: true, data };
        });
      } catch (txErr) {
        console.error(`❌ Release lock transaction failed for job ${jobId}:`, txErr);
        return res.status(500).json({ error: 'Failed to acquire release lock', message: txErr.message });
      }

      if (!lockResult.ok) {
        return res.status(lockResult.status).json({ error: lockResult.error });
      }

      jobData = lockResult.data;
      const { estimatedBudget, handymanId } = jobData;
      // Read payment intent ID from paymentResult (single source of truth)
      // Structure: paymentResult.paymentIntent.id
      const paymentIntentId = jobData.paymentResult?.paymentIntent?.id;

      // Helper used by every early-exit path below to release the lock
      // when we bail before reaching the final state-write. Without
      // this, validation failures (missing paymentIntent, handyman not
      // onboarded, etc.) would strand the job in 'release_pending'.
      const releaseLock = async (reason) => {
        try {
          await jobRef.update({
            paymentStatus: jobData.paymentStatus || 'pending_admin_approval',
            releaseLockedAt: admin.firestore.FieldValue.delete(),
            releaseLockedBy: admin.firestore.FieldValue.delete(),
            paymentReleaseError: reason || null,
          });
        } catch (clearErr) {
          console.error(`⚠️ Failed to clear release lock for job ${jobId}:`, clearErr);
        }
      };

      if (!paymentIntentId) {
        await releaseLock('No payment intent found for this job');
        return res.status(400).json({ error: 'No payment intent found for this job' });
      }

      if (!handymanId) {
        const wasCancelled = Array.isArray(jobData.previousHandymanIds) && jobData.previousHandymanIds.length > 0;
        const msg = wasCancelled
          ? 'Job has no assigned handyman — it was cancelled and has not been re-claimed'
          : 'No handyman assigned to this job';
        await releaseLock(msg);
        return res.status(400).json({ error: msg });
      }

      // Get handyman's Stripe connected account
      const handymanDoc = await admin.firestore().collection('handymen').doc(handymanId).get();
      if (!handymanDoc.exists) {
        await releaseLock('Handyman not found');
        return res.status(404).json({ error: 'Handyman not found' });
      }

      const handymanData = handymanDoc.data();
      const handymanAccountId = handymanData.stripeConnectedAccountId;

      if (!handymanAccountId) {
        await releaseLock('Handyman has not completed Stripe onboarding');
        return res.status(400).json({
          error: 'Handyman has not completed Stripe onboarding',
          message: 'The handyman needs to complete Stripe Connect setup before receiving payments.'
        });
      }

      // Check if Stripe account is ready for transfers
      const stripeAccount = await stripe.accounts.retrieve(handymanAccountId);
      if (!stripeAccount.charges_enabled || !stripeAccount.payouts_enabled) {
        await releaseLock('Handyman Stripe account not ready');
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
        await releaseLock(`Cannot release payment with status: ${paymentIntent.status}`);
        return res.status(400).json({
          error: `Cannot release payment with status: ${paymentIntent.status}`,
          message: 'Payment must be authorized or captured before release.'
        });
      }

      // Get the charge ID from the payment intent (needed for source_transaction)
      const chargeId = paymentIntent.latest_charge;
      if (!chargeId) {
        await releaseLock('No charge found for this payment');
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

      // Transfer to handyman using source_transaction to use funds from this
      // specific charge. Idempotency key is keyed on the charge so a retry
      // can never produce a second transfer for the same charge — Stripe
      // will return the original transfer instead of creating a duplicate.
      let transfer;
      try {
        transfer = await stripe.transfers.create({
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
        }, {
          idempotencyKey: `transfer-${chargeId}`,
        });
      } catch (transferErr) {
        // If the transfer call fails, mark the job so an admin can see it
        // needs manual intervention rather than letting it sit in an
        // ambiguous state. The catch above for the whole handler will
        // still surface the 500 to the caller. We also clear the
        // release_pending lock so it shows the actionable failed state.
        console.error('❌ Stripe transfer failed for job', jobId, transferErr);
        try {
          await jobRef.update({
            paymentStatus: 'release_failed',
            paymentReleaseError: transferErr.message || 'Transfer failed',
            paymentReleaseFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            releaseLockedAt: admin.firestore.FieldValue.delete(),
            releaseLockedBy: admin.firestore.FieldValue.delete(),
          });
        } catch (markErr) {
          console.error('Failed to mark job release_failed:', markErr);
        }
        throw transferErr;
      }

      // Final state write: flip the lock to 'released' and record the
      // payout breakdown. This is the only path that transitions a
      // 'release_pending' job to 'released'.
      await jobRef.update({
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
        releaseLockedAt: admin.firestore.FieldValue.delete(),
        releaseLockedBy: admin.firestore.FieldValue.delete(),
        // Close the reassignment audit trail: the paid handyman's round
        // ends as 'completed'. Never-reassigned jobs get their first and
        // only entry here (entries are created lazily — see
        // docs/superpowers/specs/2026-07-10-job-reassignment-design.md §4).
        assignmentHistory: [
          ...(Array.isArray(jobData.assignmentHistory) ? jobData.assignmentHistory : []),
          {
            handymanId,
            handymanName: handymanData.name || null,
            assignedAt: jobData.acceptedAt || null,
            endedAt: new Date().toISOString(),
            endReason: 'completed',
            cancelReason: null,
            cancelNote: null,
          },
        ],
      });

      await writeAuditLog('fund_release', decodedToken, {
        jobId,
        handymanId,
        chargeId,
        transferId: transfer.id,
        amountTransferred: handymanPayout,
        platformFee: platformFeeFromNet,
        stripeFee,
        grossAmount: totalAmount,
        payeeName: handymanData.name || null,
        reassignmentCount: jobData.reassignmentCount || 0,
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
        payee: { handymanId, name: handymanData.name || null },
        reassignmentCount: jobData.reassignmentCount || 0,
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
      const decodedToken = await verifyAuthToken(req);

      const { paymentIntentId, reason } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing paymentIntentId' });
      }

      // Get payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Authorization: only the customer who paid, or a platform admin,
      // can initiate a refund. Handymen MUST NOT be able to refund —
      // doing so would let a malicious handyman cancel a job they're
      // already assigned to and force a chargeback against the customer.
      const customerId = paymentIntent.metadata?.customerId;
      const callerIsCustomer = decodedToken.uid === customerId;
      const callerIsAdmin = isAdminToken(decodedToken);

      if (!callerIsCustomer && !callerIsAdmin) {
        console.warn(`🚫 Refund denied: ${decodedToken.uid} (admin=${callerIsAdmin}) tried to refund ${paymentIntentId} owned by ${customerId}`);
        return res.status(403).json({ error: 'Forbidden: Only the paying customer or an admin can issue a refund' });
      }

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          error: `Cannot refund payment with status: ${paymentIntent.status}`
        });
      }

      // Get charge ID. Newer Stripe SDKs don't populate `paymentIntent.charges`
      // by default; `latest_charge` is the canonical field. Fall back to
      // the legacy charges array for older SDK versions.
      const chargeId = paymentIntent.latest_charge || paymentIntent.charges?.data?.[0]?.id;

      if (!chargeId) {
        return res.status(400).json({ error: 'No charge found for this payment' });
      }

      // If escrow has already been released to the handyman, we MUST
      // reverse the transfer BEFORE refunding the charge. Otherwise the
      // platform's Stripe balance gets debited the refund amount while
      // the payout to the handyman stands — the platform absorbs the
      // entire loss (and Stripe's processing fee on top). See
      // docs/features/stripe-payment.md for the original documented gap.
      const jobId = paymentIntent.metadata?.jobId;
      const jobRef = jobId ? admin.firestore().collection('jobs').doc(jobId) : null;
      const jobSnapshot = jobRef ? await jobRef.get() : null;
      const jobData = jobSnapshot && jobSnapshot.exists ? jobSnapshot.data() : null;

      let transferReversalId = null;
      if (jobData && jobData.paymentStatus === 'released' && jobData.transferId) {
        try {
          const reversal = await stripe.transfers.createReversal(jobData.transferId, {
            description: `Refund reversal for job #${jobId}`,
            metadata: {
              jobId: jobId || '',
              refundReason: reason || 'requested_by_customer',
              initiatedBy: decodedToken.uid,
              callerRole: callerIsAdmin ? 'admin' : 'customer',
            },
          }, {
            idempotencyKey: `reversal-${jobData.transferId}`,
          });
          transferReversalId = reversal.id;
          console.log(`↩️ Reversed transfer ${jobData.transferId} for job ${jobId} → reversal ${reversal.id}`);
        } catch (reversalErr) {
          // If the reversal fails (e.g. the handyman has already withdrawn
          // the payout from their Stripe balance), the platform cannot
          // safely refund — doing so would create the exact loss we're
          // trying to prevent. Surface the failure so an admin can handle
          // it manually via Stripe Dashboard (which supports chargeback
          // workflows that pull funds back from the connected account).
          console.error(`❌ Transfer reversal failed for job ${jobId}:`, reversalErr.message);
          return res.status(409).json({
            error: 'Cannot refund: handyman payout was already disbursed and the transfer reversal failed.',
            message: reversalErr.message,
            requiresManualReview: true,
          });
        }
      }

      // Create refund. Idempotency key is keyed on the charge so a retry
      // returns the original refund object rather than issuing a second one.
      const refund = await stripe.refunds.create({
        charge: chargeId,
        reason: reason || 'requested_by_customer',
        metadata: {
          jobId: jobId || '',
          refundedBy: 'platform',
          initiatedBy: decodedToken.uid,
          callerRole: callerIsAdmin ? 'admin' : 'customer',
          transferReversalId: transferReversalId || '',
        },
      }, {
        idempotencyKey: `refund-${chargeId}`,
      });

      // Update job document. Include transferReversalId when present so
      // the job history reflects that the handyman payout was clawed back.
      if (jobRef) {
        const update = {
          paymentStatus: 'refunded',
          paymentRefundedAt: admin.firestore.FieldValue.serverTimestamp(),
          refundId: refund.id,
        };
        if (transferReversalId) update.transferReversalId = transferReversalId;
        await jobRef.update(update);
      }

      await writeAuditLog('refund', decodedToken, {
        jobId: jobId || null,
        paymentIntentId,
        chargeId,
        refundId: refund.id,
        amountRefunded: centsToDollars(refund.amount),
        reason: reason || 'requested_by_customer',
        callerRole: callerIsAdmin ? 'admin' : 'customer',
        transferReversalId: transferReversalId || null,
        previousPaymentStatus: jobData ? jobData.paymentStatus : null,
      });

      return res.status(200).json({
        success: true,
        refundId: refund.id,
        amount: centsToDollars(refund.amount),
        status: refund.status,
        transferReversalId,
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
 * Handle Stripe webhooks.
 *
 * POST /stripeWebhook
 *
 * Signature verification relies on the raw, unparsed request body
 * because Stripe's HMAC is computed over the exact bytes that were
 * sent. Firebase Functions onRequest handlers expose this on
 * `req.rawBody` (a Buffer); the guard below fails closed if it's
 * missing, instead of passing `undefined` to constructEvent and
 * surfacing an ambiguous parse error. If you ever wrap this handler
 * in middleware that parses the body before constructEvent runs,
 * `req.rawBody` will still be the original bytes — but a bodyParser
 * higher up in the chain that consumes the stream will break the
 * signature check; preserve the raw stream.
 *
 * Quick smoke test for the rejection path:
 *   curl -X POST https://<your-fn-url>/stripeWebhook \
 *     -H 'stripe-signature: t=0,v1=deadbeef' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"id":"evt_test"}'
 *   # → expect HTTP 400 "Webhook Error: ..."
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Fail-closed config guard: a missing webhook secret would otherwise
  // surface as a confusing parse error from constructEvent. Calling
  // this out explicitly so a misconfigured environment is obvious in
  // the Cloud Logging stream.
  if (!webhookSecret) {
    console.error('Webhook misconfigured: STRIPE_WEBHOOK_SECRET is not set.');
    return res.status(500).send('Webhook misconfigured');
  }
  if (!sig) {
    console.warn('Webhook rejected: missing Stripe-Signature header.');
    return res.status(400).send('Missing Stripe-Signature header');
  }
  if (!req.rawBody) {
    // This should never happen on Firebase Functions onRequest — the
    // runtime injects req.rawBody for us. If it ever does, we want
    // a loud, specific error rather than the generic "No matching
    // signatures found" that constructEvent emits when passed undefined.
    console.error('Webhook rejected: req.rawBody is missing — check that no upstream middleware is consuming the raw stream.');
    return res.status(400).send('Webhook Error: raw request body unavailable');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Event-level idempotency. Stripe retries webhooks (e.g. on a 5xx or
  // timeout), so we record each processed event.id and short-circuit on
  // re-delivery. We use a Firestore transaction on /stripeEvents/{id} so
  // two concurrent deliveries can't both decide they're the "first".
  const eventRef = admin.firestore().collection('stripeEvents').doc(event.id);
  try {
    const isFirstDelivery = await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(eventRef);
      if (snap.exists) return false;
      tx.set(eventRef, {
        type: event.type,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!isFirstDelivery) {
      // Already handled — acknowledge so Stripe stops retrying.
      return res.json({ received: true, duplicate: true });
    }
  } catch (dedupErr) {
    // If the dedup write itself fails we'd rather process than drop, so
    // we log and continue. Worst case is double-processing, which the
    // downstream updates are mostly idempotent against anyway.
    console.error('Webhook dedup write failed (continuing):', dedupErr);
  }

  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        // Booking-time capture (job lifecycle Scenario 0). The customer's
        // card confirmation just landed (manual-capture PI is now
        // 'requires_capture'). Capture immediately so the money moves to
        // the platform balance — an uncaptured authorization silently
        // expires after ~7 days, which loses the escrow on any job whose
        // lifecycle stretches (reschedules, second visits, swaps).
        //
        // We deliberately do NOT write paymentStatus here: the capture
        // makes Stripe emit payment_intent.succeeded, whose handler below
        // is the single writer of paymentStatus='succeeded' (and thereby
        // the handyman fan-out trigger).
        const capturablePI = event.data.object;
        const verdict = assessCaptureability(capturablePI);
        if (!verdict.shouldCapture) {
          console.log(`ℹ️ Skipping booking-time capture for ${capturablePI && capturablePI.id}: ${verdict.reason}`);
          break;
        }

        const captureJobId = capturablePI.metadata.jobId;
        try {
          // Idempotency key means a webhook redelivery (or a race with the
          // legacy release-time capture) can never double-capture.
          await stripe.paymentIntents.capture(capturablePI.id, {}, {
            idempotencyKey: `capture-${capturablePI.id}`,
          });
          console.log(`✅ Captured payment at booking for job ${captureJobId} (${capturablePI.id})`);
        } catch (captureErr) {
          const msg = String(captureErr.message || '');
          if (/already been captured|already captured/i.test(msg)) {
            // Benign: something else (legacy release path) captured first.
            console.log(`ℹ️ PaymentIntent ${capturablePI.id} already captured — nothing to do`);
            break;
          }
          // Permanent failures (expired/canceled auth) would fail a Stripe
          // retry identically, so we do NOT 500. Mark the job so the admin
          // (and the future Scenario 12 sweep) can see it and act.
          console.error(`❌ Booking-time capture failed for job ${captureJobId}:`, captureErr);
          try {
            await admin.firestore().collection('jobs').doc(captureJobId).update({
              captureError: msg.slice(0, 500) || 'capture failed',
              captureFailedAt: new Date().toISOString(),
            });
          } catch (markErr) {
            console.error(`⚠️ Could not mark capture failure on job ${captureJobId}:`, markErr);
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const jobId = paymentIntent.metadata?.jobId;
        if (jobId) {
          const jobRef = admin.firestore().collection('jobs').doc(jobId);
          // Conditional update. releaseEscrowSimple CAPTURES the
          // PaymentIntent, and a capture makes Stripe fire
          // payment_intent.succeeded. If we blindly wrote
          // paymentStatus:'succeeded' here, it would clobber the
          // 'released' status the escrow-release flow just set —
          // making the job vanish from the admin "Completed" tab
          // (which queries paymentStatus == 'released'). So only
          // advance a job that is still in an early payment state;
          // never downgrade one that has already been released,
          // is mid-release, or has been refunded.
          await admin.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(jobRef);
            if (!snap.exists) return;
            const current = snap.data().paymentStatus;
            const laterStates = [
              'released',
              'release_pending',
              'release_failed',
              'refunded',
              'partially_refunded',
            ];
            if (laterStates.includes(current)) return;
            tx.update(jobRef, {
              paymentStatus: 'succeeded',
              paymentSucceededAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        const firebaseUid = account.metadata?.firebaseUid;
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
      }

      case 'transfer.created':
        // Transfer created - no additional action needed
        break;

      // ===== Refund / dispute events =====
      // These cover the cases where money moves OUT of the platform via the
      // Stripe dashboard (manual refunds), or where a customer files a
      // chargeback. The job state needs to reflect that so admins can see
      // it and we don't release escrow on a job that's been refunded.

      case 'charge.refunded': {
        // Fired whenever a charge is refunded (full or partial), including
        // refunds initiated manually from the Stripe Dashboard.
        const charge = event.data.object;
        const jobId = charge.metadata?.jobId
          || (charge.payment_intent
            ? (await stripe.paymentIntents.retrieve(charge.payment_intent)).metadata?.jobId
            : null);
        if (jobId) {
          const fullyRefunded = charge.amount_refunded >= charge.amount;
          await admin.firestore().collection('jobs').doc(jobId).update({
            paymentStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
            paymentRefundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundedAmount: charge.amount_refunded / 100,
          });
        }
        break;
      }

      case 'charge.dispute.created': {
        // Customer filed a chargeback. Flag the job so admins can respond
        // and so we don't release escrow on disputed funds.
        const dispute = event.data.object;
        const charge = await stripe.charges.retrieve(dispute.charge);
        const jobId = charge.metadata?.jobId
          || (charge.payment_intent
            ? (await stripe.paymentIntents.retrieve(charge.payment_intent)).metadata?.jobId
            : null);
        if (jobId) {
          await admin.firestore().collection('jobs').doc(jobId).update({
            paymentStatus: 'disputed',
            disputeId: dispute.id,
            disputeReason: dispute.reason,
            disputeStatus: dispute.status,
            disputeAmount: dispute.amount / 100,
            disputeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        break;
      }

      case 'charge.dispute.closed': {
        // Dispute resolved — could be won, lost, or warning_closed.
        const dispute = event.data.object;
        const charge = await stripe.charges.retrieve(dispute.charge);
        const jobId = charge.metadata?.jobId
          || (charge.payment_intent
            ? (await stripe.paymentIntents.retrieve(charge.payment_intent)).metadata?.jobId
            : null);
        if (jobId) {
          await admin.firestore().collection('jobs').doc(jobId).update({
            disputeStatus: dispute.status, // 'won', 'lost', etc.
            disputeClosedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        break;
      }

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
// WHATSAPP NOTIFICATION PROXY
// ===================================

/**
 * Send WhatsApp Notification (Proxy Cloud Function)
 *
 * The frontend calls this function instead of Twilio directly because:
 * 1. Twilio's REST API doesn't support CORS (browser calls are blocked)
 * 2. Keeps Twilio credentials server-side only (more secure)
 *
 * Supports three notification types:
 * - job_created: After customer completes payment
 * - job_accepted: After handyman expresses interest
 * - job_completion: After handyman marks job complete
 *
 * Each type sends the corresponding Twilio Content Template if configured,
 * or falls back to a freeform text message (sandbox mode).
 *
 * Request body: { type: string, data: object }
 * Requires Firebase Auth token.
 */
exports.sendWhatsAppNotification = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      // Verify authenticated user
      const decodedToken = await verifyAuthToken(req);

      const { type, data } = req.body;

      if (!type || !data) {
        return res.status(400).json({ error: 'Missing type or data' });
      }

      if (!data.customerPhone) {
        return res.status(400).json({ error: 'Missing customerPhone' });
      }

      // Per-user rate limit: 10 sends per hour. Prevents an authenticated
      // user (or compromised account) from spamming arbitrary phone
      // numbers via this proxy. Admins are exempt because they may
      // legitimately re-send notifications during dispute handling.
      if (!isAdminToken(decodedToken)) {
        const rl = await checkRateLimit(`whatsapp_send_${decodedToken.uid}`, 10, 3600);
        if (!rl.allowed) {
          console.warn(`🚫 WhatsApp send rate-limited for ${decodedToken.uid} — retry in ${rl.retryAfterSeconds}s`);
          res.set('Retry-After', String(rl.retryAfterSeconds));
          return res.status(429).json({
            error: 'Too many WhatsApp notifications',
            retryAfterSeconds: rl.retryAfterSeconds,
          });
        }
      }

      // Phone-ownership check: the requesting user can only trigger
      // notifications to a phone number they're actually a party on
      // (the customer of a job they own, or the handyman assigned to
      // a job whose customer's phone matches). Without this guard, an
      // authenticated user could spam arbitrary numbers by guessing
      // them. Admins skip the check (they handle disputes).
      if (!isAdminToken(decodedToken)) {
        const phoneNormalized = String(data.customerPhone).replace(/\D/g, '');
        let phoneAuthorized = false;
        try {
          const jobsRef = admin.firestore().collection('jobs');
          const candidateQueries = [
            jobsRef.where('customerId', '==', decodedToken.uid).limit(50),
            jobsRef.where('handymanId', '==', decodedToken.uid).limit(50),
          ];
          for (const q of candidateQueries) {
            const snap = await q.get();
            for (const doc of snap.docs) {
              const jobPhone = String(doc.data().customerPhone || '').replace(/\D/g, '');
              if (jobPhone && (jobPhone === phoneNormalized || phoneNormalized.endsWith(jobPhone) || jobPhone.endsWith(phoneNormalized))) {
                phoneAuthorized = true;
                break;
              }
            }
            if (phoneAuthorized) break;
          }
        } catch (lookupErr) {
          // Conservatively allow the send if the lookup itself fails —
          // it's an availability concern but doesn't open the abuse
          // path (rate limit still caps total volume). Log so we can
          // detect index issues.
          console.warn('Phone-ownership lookup failed (allowing):', lookupErr.message);
          phoneAuthorized = true;
        }
        if (!phoneAuthorized) {
          console.warn(`🚫 WhatsApp send blocked: ${decodedToken.uid} tried to message unrelated phone ${phoneNormalized.slice(-4)}`);
          return res.status(403).json({ error: 'Forbidden: target phone not associated with a job you participate in' });
        }
      }

      const toWhatsApp = formatPhoneToWhatsApp(data.customerPhone);
      let result;

      switch (type) {
        case 'job_created': {
          const timingText = data.preferredTiming === 'Schedule'
            ? `${new Date(data.preferredDate).toLocaleDateString()} at ${data.preferredTime}`
            : 'As soon as possible';

          const templateSid = process.env.TWILIO_TEMPLATE_JOB_CREATED;
          const fallback = `Hi ${data.customerName}! 👋\n\nYour job request has been posted successfully! ✅\n\n📋 *Service:* ${data.serviceType}\n💰 *Service Fee:* $${data.estimatedBudget}\n🔖 *Job ID:* ${data.jobId || 'Pending'}\n📅 *Timing:* ${timingText}\n\nA qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.\n\nThank you for using EazyDone! 🔧`;

          result = await sendTwilioTemplateMessage(
            toWhatsApp,
            templateSid,
            { '1': data.customerName, '2': data.serviceType, '3': `${data.estimatedBudget}`, '4': data.jobId || 'Pending', '5': timingText },
            fallback
          );
          break;
        }

        case 'job_accepted': {
          const scheduledTime = data.preferredTiming === 'Schedule'
            ? `${new Date(data.preferredDate).toLocaleDateString()} at ${data.preferredTime}`
            : 'As soon as possible';

          const templateSid = process.env.TWILIO_TEMPLATE_JOB_ACCEPTED;
          const fallback = `Your job has been accepted by "${data.handymanName}"\n\nService Fee: $${data.estimatedBudget}\nJob ID: ${data.jobId}\nScheduled Time: ${scheduledTime}\n\nImportant:\nIf the handyman does not show up at the scheduled appointment time, please contact us at easydonehandyman@gmail.com.`;

          result = await sendTwilioTemplateMessage(
            toWhatsApp,
            templateSid,
            { '1': data.handymanName, '2': `${data.estimatedBudget}`, '3': data.jobId, '4': scheduledTime },
            fallback
          );
          break;
        }

        case 'job_completion': {
          const templateSid = process.env.TWILIO_TEMPLATE_JOB_COMPLETION;
          const fallback = `Hello ${data.customerName}! 👋\n\nYour handyman *${data.handymanName}* has marked the following job as complete:\n\n📋 *Service:* ${data.serviceType}\n🔖 *Job ID:* ${data.jobId}\n\nPlease confirm if the work has been completed to your satisfaction.\n\n👉 Reply *YES* to confirm completion\n👉 Reply *NO* to report an issue`;

          result = await sendTwilioTemplateMessage(
            toWhatsApp,
            templateSid,
            { '1': data.customerName, '2': data.handymanName, '3': data.serviceType, '4': data.jobId },
            fallback
          );
          break;
        }

        default:
          return res.status(400).json({ error: `Unknown notification type: ${type}` });
      }

      if (result.success) {
        console.log(`✅ WhatsApp ${type} notification sent to ${data.customerPhone}`);
        return res.status(200).json({ success: true, sid: result.sid });
      } else {
        console.error(`❌ Failed to send ${type} notification:`, result.error);
        return res.status(500).json({ success: false, error: result.error });
      }

    } catch (error) {
      console.error('❌ Error in sendWhatsAppNotification:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to send notification' });
    }
  });
});

// ===================================
// WHATSAPP WEBHOOK (Twilio)
// ===================================

/**
 * WhatsApp Webhook Handler (Twilio)
 *
 * Handles incoming WhatsApp messages from Twilio.
 * Supports both text replies (YES/NO) and quick reply button taps
 * (e.g., "Confirm Complete" / "Report Issue").
 *
 * Customer Replies:
 * - "YES", "Confirm Complete", etc. → Updates job to 'pending_admin_approval'
 * - "NO", "Report Issue", etc. → Updates job to 'disputed'
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
    // Log the full body for debugging
    console.log('📥 Webhook body keys:', Object.keys(req.body || {}));

    const From = req.body.From;
    const Body = req.body.Body;

    // Per-phone rate limit on incoming customer replies. Twilio retries
    // on 5xx, so we acknowledge with 200 (don't make Twilio retry) but
    // skip processing once a phone has hit the cap. 30/hour leaves
    // plenty of headroom for legitimate confirmation flows while
    // capping enumeration / spam if a phone is hijacked.
    if (From) {
      const phoneKey = String(From).replace(/\D/g, '').slice(-12) || 'unknown';
      const rl = await checkRateLimit(`whatsapp_webhook_${phoneKey}`, 30, 3600);
      if (!rl.allowed) {
        console.warn(`🚫 WhatsApp webhook rate-limited for ${phoneKey} — retry in ${rl.retryAfterSeconds}s`);
        return res.status(200).send('Rate limited');
      }
    }

    // Twilio also sends status callbacks (delivery receipts) that don't have Body.
    // These have a MessageStatus field instead — ignore them gracefully.
    if (!From || !Body) {
      const status = req.body.MessageStatus || req.body.SmsStatus;
      if (status) {
        // This is a delivery status callback, not an incoming message
        console.log(`📋 Delivery status update: ${status}`);
        return res.status(200).json({ received: true, processed: false, type: 'status_callback' });
      }
      console.warn('⚠️ Missing From or Body in Twilio webhook');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract customer phone from Twilio format (whatsapp:+6591234567)
    const customerPhone = From.replace('whatsapp:', '').replace('+', '');
    const messageText = Body.trim().toUpperCase();

    console.log(`📱 Incoming WhatsApp from ${customerPhone}: "${Body.trim()}"`);

    // Process confirmation replies — supports both text replies (YES/NO)
    // and quick reply button taps (e.g., "Confirm Complete", "Report Issue")
    // Intent detection. Word-boundary matches so a disambiguation
    // reply like "1 YES" / "2 NO" (used when several jobs await
    // confirmation) is still recognised as confirm/reject.
    const isConfirm = /\bYES\b/.test(messageText) || /\bY\b/.test(messageText)
      || messageText.includes('CONFIRM') || messageText.includes('COMPLETE');
    const isReject = /\bNO\b/.test(messageText) || /\bN\b/.test(messageText)
      || messageText.includes('REPORT') || messageText.includes('ISSUE')
      || messageText.includes('REJECT');
    // Optional leading job selector ("1 YES" → job #1) for the
    // multi-job disambiguation flow further below.
    const selectorMatch = messageText.match(/\b([1-9])\b/);
    const selectorIndex = selectorMatch ? parseInt(selectorMatch[1], 10) : null;

    if (!isConfirm && !isReject) {
      // Not a confirmation reply — ignore
      console.log(`ℹ️ Non-confirmation message received: "${Body.trim()}", ignoring`);
      return res.status(200).json({ received: true, processed: false, reason: 'Not a confirmation reply' });
    }

    // Try multiple phone formats since customer might have stored different format
    const phoneFormats = [
      customerPhone,
      `+${customerPhone}`,
      customerPhone.startsWith('65') ? customerPhone.substring(2) : customerPhone
    ];

    // Collect ALL jobs awaiting confirmation for this customer.
    // Scoping by per-job status (rather than a per-phone lock) keeps
    // each job independent: confirming one job never blocks another.
    const pendingByJobId = new Map();
    for (const phoneFormat of phoneFormats) {
      const snapshot = await admin.firestore().collection('jobs')
        .where('customerPhone', '==', phoneFormat)
        .where('status', '==', 'pending_confirmation')
        .orderBy('completedAt', 'desc')
        .limit(20)
        .get();
      snapshot.docs.forEach((d) => pendingByJobId.set(d.id, d));
    }
    const pendingDocs = Array.from(pendingByJobId.values()).sort((a, b) => {
      const ta = a.data().completedAt ? new Date(a.data().completedAt).getTime() : 0;
      const tb = b.data().completedAt ? new Date(b.data().completedAt).getTime() : 0;
      return tb - ta;
    });

    let pendingJobRef = null;

    if (pendingDocs.length === 1) {
      // Unambiguous — exactly one job is awaiting confirmation.
      pendingJobRef = pendingDocs[0].ref;
    } else if (pendingDocs.length > 1) {
      // Several jobs await confirmation. A bare YES/NO cannot be
      // safely attributed to a specific job — applying it to the
      // wrong one would let a reply meant for job A silently
      // confirm/reject job B. Require the customer to pick by number.
      if (selectorIndex && selectorIndex <= pendingDocs.length) {
        pendingJobRef = pendingDocs[selectorIndex - 1].ref;
      } else {
        const list = pendingDocs
          .map((d, i) => `${i + 1}. ${d.data().serviceType || 'Job'} (#${d.id.slice(-6)})`)
          .join('\n');
        await sendTwilioMessage(
          From,
          `You have ${pendingDocs.length} jobs awaiting confirmation:\n\n${list}\n\n` +
          `Please reply with the job number and YES or NO — e.g. "1 YES" to confirm job 1, or "2 NO" to report an issue with job 2.`
        );
        return res.status(200).json({
          received: true,
          processed: false,
          reason: 'Multiple jobs pending — asked customer to disambiguate'
        });
      }
    }

    // No job is currently awaiting confirmation. If the customer's
    // recent job was already responded to, tell them it's locked —
    // this is what stops a job that was confirmed from later being
    // rejected (or vice versa) in the same WhatsApp thread. Each
    // job's status leaves 'pending_confirmation' once answered, and
    // the transaction below re-checks it, so a second reply can never
    // flip an already-decided job.
    if (!pendingJobRef) {
      let alreadyResponded = null;
      for (const phoneFormat of phoneFormats) {
        const snapshot = await admin.firestore().collection('jobs')
          .where('customerPhone', '==', phoneFormat)
          .orderBy('completedAt', 'desc')
          .limit(5)
          .get();

        const found = snapshot.docs.find((doc) => {
          const s = doc.data().status;
          return s === 'pending_admin_approval' || s === 'disputed';
        });
        if (found) {
          alreadyResponded = found;
          break;
        }
      }

      if (alreadyResponded) {
        const previousAction = alreadyResponded.data().status === 'pending_admin_approval'
          ? '✅ Confirmed'
          : '⚠️ Issue Reported';
        await sendTwilioMessage(
          From,
          `ℹ️ Your response for Job #${alreadyResponded.id} has already been recorded as: ${previousAction}.\n\nThis cannot be changed here. If it was a mistake, please contact easydonehandyman@gmail.com as soon as possible.`
        );
        return res.status(200).json({
          received: true,
          processed: false,
          reason: 'Response already recorded for previous job'
        });
      }

      console.warn('⚠️ No pending job found for customer:', customerPhone);
      return res.status(200).json({
        received: true,
        processed: false,
        reason: 'No pending job found'
      });
    }

    // Atomically verify the job is still pending_confirmation, then write the response.
    // The transaction protects against a double-tap race where two webhooks for the
    // same button arrive near-simultaneously and both try to process the same job.
    const jobId = pendingJobRef.id;
    let action;
    let jobData;
    try {
      await admin.firestore().runTransaction(async (tx) => {
        const fresh = await tx.get(pendingJobRef);
        if (!fresh.exists || fresh.data().status !== 'pending_confirmation') {
          throw new Error('ALREADY_PROCESSED');
        }

        jobData = fresh.data();

        if (isConfirm) {
          tx.update(pendingJobRef, {
            status: 'pending_admin_approval',
            customerConfirmedAt: new Date().toISOString(),
            confirmedVia: 'whatsapp_reply'
          });
          action = 'confirm';
        } else {
          tx.update(pendingJobRef, {
            status: 'disputed',
            disputedAt: new Date().toISOString(),
            disputedVia: 'whatsapp_reply',
            disputeReason: 'Customer reported issue via WhatsApp reply'
          });
          action = 'reject';
        }
      });
    } catch (txError) {
      if (txError.message === 'ALREADY_PROCESSED') {
        // The job was already answered between the lookup and the
        // transaction — typically the customer tapped both buttons
        // (Confirm then Report, or the reverse) and this is the
        // second tap. Tell them explicitly that this response did
        // NOT change the outcome, rather than acknowledging silently.
        let recordedAs = 'already recorded';
        try {
          const snap = await pendingJobRef.get();
          const s = snap.exists ? snap.data().status : null;
          if (s === 'pending_admin_approval') recordedAs = '✅ Confirmed';
          else if (s === 'disputed') recordedAs = '⚠️ Issue Reported';
        } catch (readErr) {
          console.error('Could not read job status after ALREADY_PROCESSED:', readErr);
        }
        await sendTwilioMessage(
          From,
          `ℹ️ Your ${isConfirm ? 'confirmation' : 'report'} for Job #${jobId} did not go through — this job has already been recorded as: ${recordedAs}.\n\nThe outcome cannot be changed here. If it was a mistake, please contact easydonehandyman@gmail.com as soon as possible.`
        );
        return res.status(200).json({
          received: true,
          processed: false,
          reason: 'Job already processed — customer notified'
        });
      }
      throw txError;
    }

    if (action === 'confirm') {
      await sendAdminNotificationEmail(jobData, jobId);

      await sendTwilioMessage(
        From,
        `✅ Thank you for confirming!\n\nOur team will process the payment and email you the receipt.\n\nJob ID: ${jobId}\n\nIf you confirmed by mistake, please contact easydonehandyman@gmail.com as soon as possible.\n\nWe hope to serve you again! 🔧`
      );

      return res.status(200).json({ received: true, processed: true, action: 'pending_admin_approval' });
    }

    await sendTwilioMessage(
      From,
      `⚠️ We're sorry to hear that.\n\nOur team will contact you with regard to this dispute.\n\nJob ID: ${jobId}\n\nIf you reported this by mistake, please contact easydonehandyman@gmail.com as soon as possible.\n\nWe take every feedback seriously and will resolve this promptly.`
    );

    return res.status(200).json({ received: true, processed: true, action: 'disputed' });

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

    const adminUrl = `${HOSTING_URL}/admin/fund-release`;

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

// ===================================
// HANDYMAN NEW-JOB NOTIFICATION TRIGGER
// ===================================

/**
 * Fan out a WhatsApp message to matching handymen when a job's payment
 * lands. Fires on ANY write to a job doc; the paid-transition guard
 * makes it a no-op for every write except the one that flips
 * paymentStatus to 'succeeded'.
 *
 * onWrite (not onCreate) is deliberate: the customer's flow creates
 * the job doc BEFORE payment is captured, and paymentStatus becomes
 * 'succeeded' asynchronously via the Stripe webhook — so the trigger
 * point is a later update, not the initial create.
 *
 * Idempotency lives per-(job, handyman) inside handymanNotifier via
 * the notifications subcollection marker doc. Firestore may retry the
 * trigger on transient errors; retries safely skip already-claimed
 * pairs and only send Twilio messages for pairs that never got one.
 *
 * See docs/features/handyman-job-notifications.md.
 */
exports.onJobPaymentSucceeded = functions.firestore
  .document('jobs/{jobId}')
  .onWrite(async (change, context) => {
    if (!NOTIFY_ENABLED) {
      // Kill switch flipped in env. No marker writes, no Twilio calls.
      return null;
    }

    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;                                    // job deleted
    if (after.paymentStatus !== 'succeeded') return null;       // not paid (yet)

    const before = change.before.exists ? change.before.data() : null;
    if (before && before.paymentStatus === 'succeeded') return null; // already fired

    const { jobId } = context.params;
    console.log(`[handyman-notify] trigger job=${jobId} category=${after.serviceType} prevStatus=${before ? before.paymentStatus : 'new'}`);

    try {
      return await runHandymanFanOut({
        job: after,
        jobId,
        db: admin.firestore(),
        sendTwilioTemplateMessage,
        checkRateLimit,
        logger: console,
      });
    } catch (err) {
      console.error(`[handyman-notify] fan-out failed job=${jobId}:`, err);
      // Re-throw so Firestore trigger backs off + retries. sendJobNotification
      // is idempotent per-handyman, so retries won't duplicate messages for
      // pairs whose marker already exists.
      throw err;
    }
  });

// ===================================
// JOB REASSIGNMENT — HANDYMAN CANCEL
// ===================================

/**
 * cancelJobAssignment — the assigned handyman cancels a job they can
 * no longer do. The job returns to the board (status 'pending',
 * handymanId null) and the fan-out re-notifies eligible handymen,
 * excluding anyone who previously cancelled this job.
 *
 * Escrow note: paymentStatus is untouched. Held funds stay on the
 * platform account; releaseEscrowSimple always pays the job's CURRENT
 * handymanId at release time, so a reassigned job pays the replacement
 * handyman with no Stripe changes.
 *
 * Side-effect ordering: everything is awaited BEFORE the response —
 * Cloud Functions may kill work that runs after res is sent. Failures
 * of side effects (WhatsApp, fan-out) never roll back the cancel; the
 * transaction is the source of truth.
 *
 * POST body: { jobId: string, reason: CANCEL_REASONS key, note?: string }
 * See docs/superpowers/specs/2026-07-10-job-reassignment-design.md §5.
 */
exports.cancelJobAssignment = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const decodedToken = await verifyAuthToken(req);
      const { jobId, reason, note } = req.body || {};

      if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId' });
      }

      // Caller must be a handyman (profile doc is the source of truth,
      // same check the login flow uses).
      const handymanDoc = await admin.firestore()
        .collection('handymen').doc(decodedToken.uid).get();
      if (!handymanDoc.exists) {
        return res.status(403).json({ error: 'Only handymen can cancel job assignments' });
      }

      // Anti-churn rate limit: 5 cancels per rolling hour per handyman.
      const rl = await checkRateLimit(`job_cancel_${decodedToken.uid}`, 5, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({
          error: 'Too many cancellations — please contact support',
          retryAfterSeconds: rl.retryAfterSeconds,
        });
      }

      const jobRef = admin.firestore().collection('jobs').doc(jobId);
      const nowIso = new Date().toISOString();
      let jobData;
      let updatePayload;

      try {
        await admin.firestore().runTransaction(async (tx) => {
          const snap = await tx.get(jobRef);
          const job = snap.exists ? snap.data() : null;
          // Throws CancelError on any violation — mapped to HTTP below.
          validateCancelRequest(job, decodedToken.uid, reason, note);
          jobData = job;
          updatePayload = buildCancelUpdate(job, decodedToken.uid, { reason, note, nowIso });
          tx.update(jobRef, updatePayload);
        });
      } catch (err) {
        if (err instanceof CancelError) {
          const statusByCode = {
            not_found: 404,
            not_assigned: 403,
            wrong_status: 409,
            completion_poll_sent: 409,
            bad_reason: 400,
            note_required: 400,
          };
          return res.status(statusByCode[err.code] || 400)
            .json({ error: err.message, code: err.code });
        }
        throw err;
      }

      console.log(`🔁 Job ${jobId} cancelled by handyman ${decodedToken.uid} (reason=${reason}, round=${updatePayload.reassignmentCount})`);

      // ---- Side effects: best-effort, awaited, individually caught ----

      // 1. Repeat-canceller signal on the handyman profile (display only).
      try {
        await admin.firestore().collection('handymen').doc(decodedToken.uid)
          .update({ cancellationCount: admin.firestore.FieldValue.increment(1) });
      } catch (err) {
        console.error(`⚠️ cancellationCount increment failed for ${decodedToken.uid}:`, err);
      }

      // 2. Tell the customer we're finding a replacement.
      if (jobData.customerPhone) {
        try {
          const shortId = jobId.slice(-6);
          const fallback =
            `Update on Job #${shortId} (${jobData.serviceType}):\n\n` +
            `Your handyman is no longer available. We're finding you a new one — ` +
            `no action needed, and your payment stays protected.\n\n` +
            `Questions? Contact easydonehandyman@gmail.com`;
          await sendTwilioTemplateMessage(
            formatPhoneToWhatsApp(jobData.customerPhone),
            process.env.TWILIO_TEMPLATE_HANDYMAN_CANCELLED,
            { '1': jobData.customerName || 'there', '2': shortId, '3': jobData.serviceType || 'your job' },
            fallback,
          );
        } catch (err) {
          console.error(`⚠️ Customer cancel notice failed for job ${jobId}:`, err);
        }
      }

      // 3. Re-notify eligible handymen for the new round, excluding
      //    everyone who previously cancelled this job.
      try {
        await runHandymanFanOut({
          job: { ...jobData, ...updatePayload, handymanId: null, status: 'pending' },
          jobId,
          db: admin.firestore(),
          sendTwilioTemplateMessage,
          checkRateLimit,
          logger: console,
          round: updatePayload.reassignmentCount,
          excludeIds: updatePayload.previousHandymanIds,
        });
      } catch (err) {
        console.error(`⚠️ Reassignment fan-out failed for job ${jobId}:`, err);
      }

      // 4. Audit trail.
      await writeAuditLog('job_cancelled_by_handyman', decodedToken, {
        jobId,
        reason,
        note: String(note || '').slice(0, 500) || null,
        reassignmentCount: updatePayload.reassignmentCount,
      });

      return res.status(200).json({
        success: true,
        jobId,
        reassignmentCount: updatePayload.reassignmentCount,
      });
    } catch (error) {
      console.error('❌ Error in cancelJobAssignment:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to cancel job assignment' });
    }
  });
});
