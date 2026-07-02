/**
 * Handyman job-notification fan-out.
 *
 * Pure business logic for pushing a WhatsApp message to every eligible
 * handyman when a new job is paid for. The Firestore trigger in
 * functions/index.js is a thin wrapper around runFanOut() here — this
 * module owns the eligibility query, per-message idempotency, and the
 * per-handyman rate-limit gate.
 *
 * Dependency-inject the Twilio sender and rate limiter (rather than
 * require them at the top) so this module stays testable without
 * touching functions/index.js.
 *
 * See docs/features/handyman-job-notifications.md for the design.
 */

const admin = require('firebase-admin');
const {
  NOTIFY_FANOUT_CAP,
  NOTIFY_MAX_PER_HANDYMAN_PER_HOUR,
} = require('./notificationConfig');

const NOTIFICATION_STATUS = Object.freeze({
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED_RATE_LIMITED: 'skipped_rate_limited',
  ALREADY_CLAIMED: 'already_claimed',
  ERROR: 'error',
});

/**
 * Return up to `cap` handymen eligible to be notified about `job`.
 *
 * Filters at the Firestore query level for the strict criteria (active,
 * verified, Stripe-ready, category match). The `notifyOnNewJob` opt-out
 * is applied in JS afterwards — Firestore `!=` excludes docs where the
 * field is missing, and handymen registered before this feature shipped
 * won't have the field set. Applying it in JS treats "field missing" as
 * "opted in" (the default), which is the intended behaviour.
 *
 * Consequence: if some handymen inside the fetched batch have opted
 * out, the actual notified count is < cap. Under Phase 1 opt-out
 * rates this is negligible; a Phase 2 tuning knob (over-fetch factor)
 * can compensate if we ever need it.
 */
async function pickEligibleHandymen(job, db, cap = NOTIFY_FANOUT_CAP) {
  const snapshot = await db.collection('handymen')
    .where('status', '==', 'active')
    .where('verified', '==', true)
    .where('stripeOnboardingCompleted', '==', true)
    .where('serviceTypes', 'array-contains', job.serviceType)
    .limit(cap)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((h) => h.notifyOnNewJob !== false);
}

/**
 * Extract Singapore postal district (first 2 digits of the 6-digit
 * postal code) from a free-text address. Returns null when no postal
 * code is present — the caller falls back to a generic label.
 *
 * We deliberately only expose district, not the full postcode: the
 * pre-accept notification is visible before we know the handyman
 * even wants the job, so we minimise what we reveal about the
 * customer's exact location.
 */
function extractDistrict(addressLike) {
  if (!addressLike) return null;
  // Match exactly six digits bounded by non-digits on both sides.
  // \b(\d{6})\b is subtly wrong for common SG formats: in "S408600" the
  // 'S' and '4' are both word chars, so \b doesn't fire and the postcode
  // is missed. Non-digit boundaries handle "S408600", "Singapore 408600"
  // and "#10-01 408600" identically while still rejecting a run like
  // "12345678" (no valid postcode inside).
  const match = String(addressLike).match(/(?:^|\D)(\d{6})(?:\D|$)/);
  return match ? match[1].slice(0, 2) : null;
}

/**
 * Compose the WhatsApp payload for a single job. Returns both the
 * template-variable map (used when the approved template SID is set)
 * and a plain-text fallback (used in sandbox or before template
 * approval lands). Keep the two in sync when the template body changes.
 */
function composeMessage(job, jobId) {
  const timing = job.preferredTiming === 'Schedule' && job.preferredDate
    ? `${job.preferredDate}${job.preferredTime ? ` at ${job.preferredTime}` : ''}`
    : 'As soon as possible';

  const district = extractDistrict(job.address || job.location);
  const districtLabel = district ? `District ${district}` : 'Singapore';

  const baseUrl = process.env.HANDYMAN_APP_BASE_URL || 'https://easydonehandyman.com';
  const deepLink = `${baseUrl.replace(/\/$/, '')}/job-details/${jobId}`;

  const fallback =
    `📋 New job available!\n\n` +
    `Service: ${job.serviceType}\n` +
    `Fee: $${job.estimatedBudget}\n` +
    `When: ${timing}\n` +
    `Area: ${districtLabel}\n\n` +
    `Tap to view and accept:\n${deepLink}`;

  return {
    variables: {
      '1': String(job.serviceType || ''),
      '2': String(job.estimatedBudget || ''),
      '3': timing,
      '4': districtLabel,
      '5': deepLink,
    },
    fallback,
    deepLink,
  };
}

/**
 * Send exactly one handyman one notification about one job, atomically.
 *
 * The marker doc at jobs/{jobId}/notifications/{handymanId} is the
 * idempotency key. Firestore create() fails with ALREADY_EXISTS if a
 * concurrent invocation (or a Firestore trigger retry) already claimed
 * the pair — we return early instead of double-sending.
 *
 * If Twilio fails, the marker is updated to `failed` (not deleted),
 * so retries don't re-attempt via the same code path. Anything more
 * sophisticated (retry queue, exponential backoff) is deferred.
 */
async function sendJobNotification({
  job,
  jobId,
  handyman,
  db,
  sendTwilioTemplateMessage,
  checkRateLimit,
}) {
  const markerRef = db.collection('jobs').doc(jobId)
    .collection('notifications').doc(handyman.id);

  try {
    await markerRef.create({
      status: 'claimed',
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      attemptCount: 1,
    });
  } catch (err) {
    // gRPC status 6 = ALREADY_EXISTS. Some SDK versions also surface it
    // as the string; hedge both to survive future firebase-admin upgrades.
    const alreadyExists = err.code === 6
      || err.code === 'already-exists'
      || err.code === 'ALREADY_EXISTS'
      || /already exists/i.test(err.message || '');
    if (alreadyExists) {
      return { status: NOTIFICATION_STATUS.ALREADY_CLAIMED, handymanId: handyman.id };
    }
    throw err;
  }

  const rl = await checkRateLimit(
    `whatsapp_handyman_new_job_${handyman.id}`,
    NOTIFY_MAX_PER_HANDYMAN_PER_HOUR,
    3600,
  );
  if (!rl.allowed) {
    await markerRef.set({
      status: NOTIFICATION_STATUS.SKIPPED_RATE_LIMITED,
      skippedAt: admin.firestore.FieldValue.serverTimestamp(),
      retryAfterSeconds: rl.retryAfterSeconds || null,
    }, { merge: true });
    return {
      status: NOTIFICATION_STATUS.SKIPPED_RATE_LIMITED,
      handymanId: handyman.id,
      retryAfterSeconds: rl.retryAfterSeconds || null,
    };
  }

  const { variables, fallback } = composeMessage(job, jobId);
  const templateSid = process.env.TWILIO_TEMPLATE_HANDYMAN_NEW_JOB;

  const result = await sendTwilioTemplateMessage(
    handyman.phone,
    templateSid,
    variables,
    fallback,
  );

  if (result && result.success) {
    await markerRef.set({
      status: NOTIFICATION_STATUS.SENT,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      twilioSid: result.sid || null,
    }, { merge: true });
    return { status: NOTIFICATION_STATUS.SENT, handymanId: handyman.id, twilioSid: result.sid || null };
  }

  const errMsg = String((result && result.error) || 'unknown Twilio error').slice(0, 500);
  await markerRef.set({
    status: NOTIFICATION_STATUS.FAILED,
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: errMsg,
  }, { merge: true });
  return { status: NOTIFICATION_STATUS.FAILED, handymanId: handyman.id, error: errMsg };
}

/**
 * Orchestrate the full fan-out for a single paid job. Concurrent send
 * across handymen (Promise.all), each independently idempotent via its
 * marker doc. Individual failures are absorbed into the summary so one
 * bad handyman send doesn't abort the rest.
 */
async function runFanOut({
  job,
  jobId,
  db,
  sendTwilioTemplateMessage,
  checkRateLimit,
  logger = console,
}) {
  const handymen = await pickEligibleHandymen(job, db, NOTIFY_FANOUT_CAP);

  logger.log(`[handyman-notify] job=${jobId} category=${job.serviceType} eligible=${handymen.length} cap=${NOTIFY_FANOUT_CAP}`);

  if (handymen.length === 0) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, alreadyClaimed: 0, results: [] };
  }

  const results = await Promise.all(handymen.map((h) =>
    sendJobNotification({ job, jobId, handyman: h, db, sendTwilioTemplateMessage, checkRateLimit })
      .catch((err) => ({
        status: NOTIFICATION_STATUS.ERROR,
        handymanId: h.id,
        error: String(err.message || err).slice(0, 500),
      })),
  ));

  const summary = {
    attempted: handymen.length,
    sent: results.filter((r) => r.status === NOTIFICATION_STATUS.SENT).length,
    skipped: results.filter((r) => r.status === NOTIFICATION_STATUS.SKIPPED_RATE_LIMITED).length,
    failed: results.filter((r) => r.status === NOTIFICATION_STATUS.FAILED || r.status === NOTIFICATION_STATUS.ERROR).length,
    alreadyClaimed: results.filter((r) => r.status === NOTIFICATION_STATUS.ALREADY_CLAIMED).length,
    results,
  };

  logger.log(`[handyman-notify] job=${jobId} done: sent=${summary.sent} skipped=${summary.skipped} failed=${summary.failed} already=${summary.alreadyClaimed}`);
  return summary;
}

module.exports = {
  NOTIFICATION_STATUS,
  pickEligibleHandymen,
  extractDistrict,
  composeMessage,
  sendJobNotification,
  runFanOut,
};
