/**
 * Booking-time capture decision (job lifecycle Scenario 0).
 *
 * The customer's card is authorized with capture_method:'manual' at
 * booking. Authorizations self-expire after ~7 days, so we capture into
 * the platform balance as soon as the card confirmation lands (the
 * payment_intent.amount_capturable_updated webhook). This module owns
 * ONLY the pure "should this PaymentIntent be captured?" decision so it
 * is unit-testable; the Stripe call lives in the webhook handler in
 * functions/index.js.
 *
 * See docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md §4.0.
 */

/**
 * Decide whether a PaymentIntent from a webhook event should be
 * captured at booking.
 *
 * Guards, in order:
 *  - a real PI object (defensive against malformed events)
 *  - status 'requires_capture' (anything else: already captured,
 *    canceled, or not yet confirmed — nothing to do)
 *  - metadata.jobId present (only OUR job payments; protects unrelated
 *    PaymentIntents if the Stripe account is ever shared)
 *  - amount_capturable > 0 (zero means nothing to pull)
 *
 * @param {object|null} paymentIntent - event.data.object from Stripe
 * @returns {{shouldCapture: boolean, reason: string}}
 */
function assessCaptureability(paymentIntent) {
  if (!paymentIntent || typeof paymentIntent !== 'object') {
    return { shouldCapture: false, reason: 'no_intent' };
  }
  if (paymentIntent.status !== 'requires_capture') {
    return { shouldCapture: false, reason: 'wrong_status' };
  }
  if (!paymentIntent.metadata || !paymentIntent.metadata.jobId) {
    return { shouldCapture: false, reason: 'no_job_id' };
  }
  if (!(paymentIntent.amount_capturable > 0)) {
    return { shouldCapture: false, reason: 'nothing_capturable' };
  }
  return { shouldCapture: true, reason: 'capture' };
}

/**
 * Is this capture error Stripe telling us the PI wasn't in
 * 'requires_capture'? That single error code covers BOTH the benign
 * case (another path already captured it — a race with the legacy
 * release-time capture) and the bad case (the authorization expired or
 * was canceled). Callers must retrieve the PI's current status to tell
 * them apart: 'succeeded' → benign, anything else → real failure.
 *
 * The message regex is a fallback for SDK versions/errors that don't
 * carry the code — never rely on prose alone for the happy call.
 *
 * @param {object|null} err - error thrown by stripe.paymentIntents.capture
 * @returns {boolean}
 */
function isUnexpectedStateError(err) {
  if (!err) return false;
  if (err.code === 'payment_intent_unexpected_state') return true;
  return /already been captured|already captured/i.test(String(err.message || ''));
}

module.exports = { assessCaptureability, isUnexpectedStateError };
