/**
 * pricingService.js — pure domain logic for Scenario 10 (post-inspection
 * price adjustment, approve-by-paying).
 *
 * The customer's Stripe Checkout payment IS the approval: there is no
 * separate "approved" state, so an approved-but-unpaid limbo cannot
 * exist. Money rules: the paid delta is a second held pot in the
 * platform balance — released to the handyman only by admin release,
 * refundable before that (spec §1 golden rule, §2b row 10).
 *
 * No Firestore imports: callers pass job data in and write the returned
 * objects inside their own transactions (same DI style as visitService).
 *
 * priceAdjustment object shape (job.priceAdjustment — singular; the
 * field name is already client-write-denied in firestore.rules):
 *   { status: 'pending_payment'|'paid'|'declined'|'expired'|
 *             'cancelled_assignment'|'refunded'|'released',
 *     deltaServiceFee: number (pre-platform-fee dollars),
 *     reason, note, requestedBy, requestedAt: ISO,
 *     priceMaxAtRequest: number, reissued: boolean,
 *     sessionId?, checkoutUrl?, deltaPaymentIntentId?,
 *     paidAt?, declinedAt?, expiredAt?, refundedAt?, refundId?,
 *     transferId?, releasedAt? }
 */

const MAX_ADJUSTMENT_REASON_LENGTH = 300;

class PricingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
  }
}

function clean(text) {
  const trimmed = String(text || '').trim().slice(0, MAX_ADJUSTMENT_REASON_LENGTH);
  return trimmed || null;
}

function validateAdjustmentRequest(job, callerUid, deltaDollars, reason, priceMax) {
  if (!job) throw new PricingError('not_found', 'Job not found');
  if (job.handymanId !== callerUid) throw new PricingError('not_assigned', 'You are not assigned to this job');
  if (job.status !== 'in_progress') throw new PricingError('wrong_status', 'Job is not in progress');
  const delta = Number(deltaDollars);
  if (!Number.isFinite(delta) || delta <= 0) throw new PricingError('bad_amount', 'Adjustment must be a positive amount');
  const current = Number(job.estimatedBudget) || 0;
  if (current + delta > priceMax) {
    throw new PricingError('over_cap', `Total would exceed the published maximum of $${priceMax} for this service`);
  }
  if (!String(reason || '').trim()) throw new PricingError('reason_required', 'A reason is required');
  const existing = job.priceAdjustment;
  if (existing && existing.status === 'pending_payment') throw new PricingError('adjustment_pending', 'An adjustment is already awaiting the customer');
  if (existing && ['paid', 'refunded', 'released'].includes(existing.status)) {
    throw new PricingError('adjustment_already_paid', 'This job already has a paid adjustment — contact support for further changes');
  }
}

function buildAdjustmentEntry({ deltaDollars, reason, note, requestedBy, priceMax, nowIso }) {
  return {
    status: 'pending_payment',
    deltaServiceFee: Number(deltaDollars),
    reason: clean(reason),
    note: clean(note),
    requestedBy,
    requestedAt: nowIso,
    priceMaxAtRequest: priceMax,
    reissued: false,
  };
}

function hasPendingPriceAdjustment(job) {
  return !!(job && job.priceAdjustment && job.priceAdjustment.status === 'pending_payment');
}

const TRANSITIONS = {
  declined: 'pending_payment',
  expired: 'pending_payment',
  cancelled_assignment: 'pending_payment',
  refunded: 'paid',
  released: 'paid',
};

function buildAdjustmentTransition(job, { to, stamps }) {
  const current = job && job.priceAdjustment;
  const requiredFrom = TRANSITIONS[to];
  if (!current || !requiredFrom || current.status !== requiredFrom) {
    throw new PricingError('bad_transition', `Cannot move adjustment to '${to}' from '${current ? current.status : 'none'}'`);
  }
  return { priceAdjustment: { ...current, status: to, ...(stamps || {}) } };
}

/**
 * Webhook apply. The sessionId match rejects payments from stale or
 * orphaned Checkout Sessions (e.g. a link created by a failed earlier
 * request attempt); the pending_payment requirement makes redelivered
 * webhook events no-ops at the domain level.
 */
function applyPaidAdjustment(job, { nowIso, deltaPaymentIntentId, sessionId }) {
  const current = job && job.priceAdjustment;
  if (!current || current.status !== 'pending_payment' || current.sessionId !== sessionId) {
    throw new PricingError('bad_transition', 'No matching pending adjustment for this payment');
  }
  return {
    priceAdjustment: { ...current, status: 'paid', paidAt: nowIso, deltaPaymentIntentId },
    estimatedBudget: (Number(job.estimatedBudget) || 0) + current.deltaServiceFee,
  };
}

module.exports = {
  PricingError,
  MAX_ADJUSTMENT_REASON_LENGTH,
  validateAdjustmentRequest,
  buildAdjustmentEntry,
  hasPendingPriceAdjustment,
  buildAdjustmentTransition,
  applyPaidAdjustment,
};
