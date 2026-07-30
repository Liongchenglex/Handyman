/**
 * pricingService — Scenario 10 (approve-by-paying price adjustment)
 * pure domain logic. Spec: 2026-07-12-job-lifecycle-scenarios-design.md
 * Scenario 10 (rev 2026-07-30).
 */
const {
  PricingError,
  validateAdjustmentRequest,
  buildAdjustmentEntry,
  hasPendingPriceAdjustment,
  buildAdjustmentTransition,
  applyPaidAdjustment,
} = require('../pricingService');

const NOW_ISO = '2026-07-30T11:00:00.000Z';

const job = (over = {}) => ({
  status: 'in_progress',
  handymanId: 'hm-1',
  serviceType: 'Plumbing',
  estimatedBudget: 120,
  customerPhone: '+6591234567',
  ...over,
});

describe('validateAdjustmentRequest', () => {
  test('accepts a valid request', () => {
    expect(() => validateAdjustmentRequest(job(), 'hm-1', 30, 'corroded pipe', 160)).not.toThrow();
  });
  test.each([
    ['not_found', null, 'hm-1', 30, 'r', 160],
    ['not_assigned', job(), 'hm-2', 30, 'r', 160],
    ['wrong_status', job({ status: 'pending_confirmation' }), 'hm-1', 30, 'r', 160],
    ['bad_amount', job(), 'hm-1', 0, 'r', 160],
    ['bad_amount', job(), 'hm-1', -5, 'r', 160],
    ['bad_amount', job(), 'hm-1', 'abc', 'r', 160],
    ['over_cap', job(), 'hm-1', 41, 'r', 160], // 120 + 41 > 160
    ['reason_required', job(), 'hm-1', 30, '   ', 160],
    ['adjustment_pending', job({ priceAdjustment: { status: 'pending_payment' } }), 'hm-1', 30, 'r', 160],
    ['adjustment_already_paid', job({ priceAdjustment: { status: 'paid' } }), 'hm-1', 30, 'r', 160],
  ])('throws %s', (code, j, uid, delta, reason, cap) => {
    expect.assertions(1);
    try { validateAdjustmentRequest(j, uid, delta, reason, cap); }
    catch (e) { expect(e.code).toBe(code); }
  });
  test('allows a new request after a terminal adjustment', () => {
    for (const status of ['declined', 'expired', 'cancelled_assignment']) {
      expect(() => validateAdjustmentRequest(job({ priceAdjustment: { status } }), 'hm-1', 30, 'r', 160)).not.toThrow();
    }
  });
  test('boundary: exactly at the cap is allowed', () => {
    expect(() => validateAdjustmentRequest(job(), 'hm-1', 40, 'r', 160)).not.toThrow(); // 120 + 40 === 160
  });
});

describe('buildAdjustmentEntry', () => {
  test('builds a pending entry with trimmed fields', () => {
    const entry = buildAdjustmentEntry({ deltaDollars: 30, reason: '  corroded pipe  ', note: '', requestedBy: 'hm-1', priceMax: 160, nowIso: NOW_ISO });
    expect(entry).toEqual({
      status: 'pending_payment',
      deltaServiceFee: 30,
      reason: 'corroded pipe',
      note: null,
      requestedBy: 'hm-1',
      requestedAt: NOW_ISO,
      priceMaxAtRequest: 160,
      reissued: false,
    });
  });
  test('truncates reason to 300 chars', () => {
    const entry = buildAdjustmentEntry({ deltaDollars: 30, reason: 'x'.repeat(400), note: 'y'.repeat(400), requestedBy: 'hm-1', priceMax: 160, nowIso: NOW_ISO });
    expect(entry.reason).toHaveLength(300);
    expect(entry.note).toHaveLength(300);
  });
});

describe('hasPendingPriceAdjustment', () => {
  test('detects only pending_payment', () => {
    expect(hasPendingPriceAdjustment(job())).toBe(false);
    expect(hasPendingPriceAdjustment(job({ priceAdjustment: { status: 'paid' } }))).toBe(false);
    expect(hasPendingPriceAdjustment(job({ priceAdjustment: { status: 'pending_payment' } }))).toBe(true);
  });
});

describe('buildAdjustmentTransition', () => {
  const pending = () => job({ priceAdjustment: { status: 'pending_payment', deltaServiceFee: 30 } });
  const paid = () => job({ priceAdjustment: { status: 'paid', deltaServiceFee: 30 } });
  test('pending → declined with stamps', () => {
    const { priceAdjustment } = buildAdjustmentTransition(pending(), { to: 'declined', stamps: { declinedAt: NOW_ISO } });
    expect(priceAdjustment.status).toBe('declined');
    expect(priceAdjustment.declinedAt).toBe(NOW_ISO);
    expect(priceAdjustment.deltaServiceFee).toBe(30); // fields preserved
  });
  test('pending → expired and → cancelled_assignment allowed', () => {
    expect(buildAdjustmentTransition(pending(), { to: 'expired', stamps: {} }).priceAdjustment.status).toBe('expired');
    expect(buildAdjustmentTransition(pending(), { to: 'cancelled_assignment', stamps: {} }).priceAdjustment.status).toBe('cancelled_assignment');
  });
  test('paid → refunded and → released allowed; pending → refunded is not', () => {
    expect(buildAdjustmentTransition(paid(), { to: 'refunded', stamps: {} }).priceAdjustment.status).toBe('refunded');
    expect(buildAdjustmentTransition(paid(), { to: 'released', stamps: {} }).priceAdjustment.status).toBe('released');
    expect.assertions(3);
    try { buildAdjustmentTransition(pending(), { to: 'refunded', stamps: {} }); }
    catch (e) { expect(e.code).toBe('bad_transition'); }
  });
  test('throws bad_transition when no adjustment exists', () => {
    expect.assertions(1);
    try { buildAdjustmentTransition(job(), { to: 'declined', stamps: {} }); }
    catch (e) { expect(e.code).toBe('bad_transition'); }
  });
});

describe('applyPaidAdjustment', () => {
  const pending = (over = {}) => job({
    estimatedBudget: 120,
    priceAdjustment: { status: 'pending_payment', deltaServiceFee: 30, sessionId: 'cs_123', ...over },
  });
  test('applies: paid status, PI recorded, estimatedBudget increased', () => {
    const result = applyPaidAdjustment(pending(), { nowIso: NOW_ISO, deltaPaymentIntentId: 'pi_9', sessionId: 'cs_123' });
    expect(result.priceAdjustment.status).toBe('paid');
    expect(result.priceAdjustment.paidAt).toBe(NOW_ISO);
    expect(result.priceAdjustment.deltaPaymentIntentId).toBe('pi_9');
    expect(result.estimatedBudget).toBe(150);
  });
  test('throws bad_transition on session mismatch (stale/orphan session)', () => {
    expect.assertions(1);
    try { applyPaidAdjustment(pending(), { nowIso: NOW_ISO, deltaPaymentIntentId: 'pi_9', sessionId: 'cs_OTHER' }); }
    catch (e) { expect(e.code).toBe('bad_transition'); }
  });
  test('throws bad_transition when not pending (idempotent for webhook retries)', () => {
    expect.assertions(1);
    try { applyPaidAdjustment(pending({ status: 'paid' }), { nowIso: NOW_ISO, deltaPaymentIntentId: 'pi_9', sessionId: 'cs_123' }); }
    catch (e) { expect(e.code).toBe('bad_transition'); }
  });
});
