# Handyman No-Show (Scenario 7) + Price Adjustment (Scenario 10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Scenario 10 (post-inspection price adjustment where a Stripe Checkout payment IS the customer's approval) and Scenario 7 (handyman no-show: full report flow replacing the stage-6 stub, with the customer's 3-way choice) per `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` as finalized 2026-07-30.

**Architecture:** Scenario 10 adds a pure domain module (`functions/pricingService.js`), one handyman endpoint that creates a Stripe **Checkout Session** (inline `price_data`, 24h `expires_at`, metadata-tagged), two new `stripeWebhook` cases (`checkout.session.completed` applies the paid delta; `checkout.session.expired` re-issues once then expires the adjustment), delta-aware guards in the existing money webhook cases and `refundPayment`, a second `source_transaction`-pinned transfer in `releaseEscrowSimple`, and gates so a pending adjustment blocks Mark Complete / the poll / the disposition prompt. Scenario 7 replaces the `never_came` stub with a shared `runNoShowReport` path (report + `noShowCount` + handyman notice + customer choice prompt), adds free-text intent detection ahead of the legacy YES/NO regexes, and a `no_show_choice` webhook branch whose three arms reuse F6 links, the attention queue, and the manual-refund machinery.

**Tech Stack:** Firebase Functions v1, Firestore, Stripe SDK 11.18.0 (API 2022-11-15), Twilio WhatsApp (template-first + freeform fallback), React 18 + Tailwind, Jest 29 (functions only).

## Global Constraints

- **Money invariant (spec §1):** money moves only at capture (in), admin release (out to handyman), admin refund (out to customer). The delta is a customer→platform charge (in) held like the original pot; both exit ONLY via `releaseEscrowSimple` / `refundPayment`. No automatic payouts.
- **Stripe house style:** every money-moving call carries a deterministic `idempotencyKey` (`index.js` precedents: `pi-create-${jobId}`, `capture-${pi.id}`, `transfer-${chargeId}`, `refund-${chargeId}`).
- **Field name is `priceAdjustment` (singular object)** — already denied in BOTH rules lists (`firestore.rules:79`, `:129`); do NOT introduce `priceAdjustments[]` (spec prose is amended by the docs task). One adjustment at a time in v1; a new request is allowed only when there is no adjustment or the current one is terminal (`declined`/`expired`/`cancelled_assignment`); a `paid` adjustment blocks further requests.
- `priceAdjustment` statuses: `pending_payment | paid | declined | expired | cancelled_assignment | refunded | released`.
- **Amount semantics:** `estimatedBudget` is the pre-platform-fee service fee (explorer-verified). The handyman enters the delta in service-fee dollars; cap: `estimatedBudget + delta ≤ getServicePriceMax(job.serviceType)` (snapshot as `priceMaxAtRequest`); the customer is charged `delta × 1.10` (same `calculatePlatformFee` convention as booking, `index.js:1178-1180`); on paid, `estimatedBudget += delta`.
- **Delta PI/Session metadata must carry `type: 'price_adjustment_delta'`** — the guard key for `payment_intent.succeeded`, `charge.refunded`, and `refundPayment` branches. Session metadata: `{ type, jobId, adjustmentId }`; `payment_intent_data.metadata`: `{ type, jobId, adjustmentId, customerId, serviceType, platform: 'handyman-platform' }` (customerId enables the existing `refundPayment` auth check).
- Prompt conventions (F2): job-state write FIRST, `markAnswered` second, every `markAnswered` in try/catch that logs and continues; invalid-payload guard on any branch reading `payload`; new prompt types ride the generic expiry ladder unless exempted.
- Template-first rule: business-initiated WhatsApp goes through `sendTwilioTemplateMessage(to, sid, vars, fallback)`; unset SID env degrades to freeform. Replies to a sender who just messaged may use `sendTwilioMessage` freeform.
- New prompt types: `price_adjustment_choice` (decline-only options — paying the link is the approve path), `no_show_choice`. New attention types (free-form strings, render generically in ActiveJobsTable): `no_show_new_handyman`, `no_show_refund_requested`, `adjustment_payment_orphaned`, `adjustment_expired`, `delta_refund_failed`.
- New env vars (read inline at call sites): `TWILIO_TEMPLATE_PRICE_ADJUSTMENT`, `TWILIO_TEMPLATE_ADJUSTMENT_PAID`, `TWILIO_TEMPLATE_NO_SHOW_CHOICE`, `TWILIO_TEMPLATE_NO_SHOW_REPORTED`.
- Environment: never run bare `npm install`; functions tests via `cd functions && npm test` (currently 115/115); `node --check functions/index.js` after every index.js edit; no `timeout` command; frontend has no test harness (build compile is the standard); iCloud protocol — stage only intended files, READ the staged diff before every commit.
- Line-number anchors below were verified 2026-07-30 against master (post second-visit merge); they may drift a few lines — anchor by the quoted code, not the number alone.

---

### Task 1: `functions/pricingService.js` — pure domain module

**Files:**
- Create: `functions/pricingService.js`
- Test: `functions/__tests__/pricingService.test.js`

**Interfaces:**
- Consumes: nothing (pure, DI style like `visitService.js`).
- Produces (used by Tasks 2–7):
  - `PricingError` — Error subclass with `.code`
  - `MAX_ADJUSTMENT_REASON_LENGTH = 300`
  - `validateAdjustmentRequest(job, callerUid, deltaDollars, reason, priceMax)` → void; throws codes `not_found | not_assigned | wrong_status | bad_amount | over_cap | reason_required | adjustment_pending | adjustment_already_paid`
  - `buildAdjustmentEntry({ deltaDollars, reason, note, requestedBy, priceMax, nowIso })` → the `priceAdjustment` object (WITHOUT session fields — Task 2 adds `sessionId`/`checkoutUrl` after Stripe succeeds)
  - `hasPendingPriceAdjustment(job)` → boolean (`status === 'pending_payment'`)
  - `buildAdjustmentTransition(job, { to, stamps })` → `{ priceAdjustment }`; throws `PricingError('bad_transition')` unless current status is `pending_payment` (for `to: 'declined' | 'expired' | 'cancelled_assignment'`) or `paid` (for `to: 'refunded' | 'released'`)
  - `applyPaidAdjustment(job, { nowIso, deltaPaymentIntentId, sessionId })` → `{ priceAdjustment, estimatedBudget }`; throws `PricingError('bad_transition')` unless `pending_payment` AND `sessionId` matches `job.priceAdjustment.sessionId` (stale-session guard)

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/pricingService.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd functions && npx jest __tests__/pricingService.test.js`
Expected: FAIL — `Cannot find module '../pricingService'`

- [ ] **Step 3: Implement `functions/pricingService.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest __tests__/pricingService.test.js`
Expected: PASS. Then `cd functions && npm test` — full suite green (115 + new).

- [ ] **Step 5: Commit**

```bash
git add functions/pricingService.js functions/__tests__/pricingService.test.js
git commit -m "feat(functions): pricingService — approve-by-paying adjustment domain logic"
```

---

### Task 2: `requestPriceAdjustment` endpoint + Checkout Session

**Files:**
- Modify: `functions/index.js` — new require next to the visitService require (~:89); new export after `reportVisitIssue` (ends ~:5100)

**Interfaces:**
- Consumes: `stripe` singleton (:15), `verifyAuthToken` (:225), `checkRateLimit`, `writeAuditLog` (:663), `dollarsToCents` (:681), `getServicePriceMax` (already imported at :54, currently unused), `openPrompt`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`, `supersedeOpenPrompts`, `APP_URL` (:19), Task 1's exports.
- Produces:
  - `POST /requestPriceAdjustment` — body `{ jobId, deltaDollars, reason, note }`, handyman Bearer auth → `{ success: true, promptId }`; PricingError map `{not_found:404, not_assigned:403, wrong_status:409, bad_amount:400, over_cap:400, reason_required:400, adjustment_pending:409, adjustment_already_paid:409, no_customer_phone:400}`.
  - Prompt `type: 'price_adjustment_choice'`, `toRole: 'customer'`, options `PRICE_ADJUSTMENT_CHOICE_OPTIONS`, `payload: { sessionId }` — consumed by Task 4.
  - Job field `priceAdjustment` incl. `sessionId`, `checkoutUrl`.
  - New constant `PRICE_ADJUSTMENT_CHOICE_OPTIONS` (decline-only).

- [ ] **Step 1: Add the require and the options constant**

Extend the visitService require area (~:89) with:

```js
const {
  PricingError,
  validateAdjustmentRequest,
  buildAdjustmentEntry,
  hasPendingPriceAdjustment,
  buildAdjustmentTransition,
  applyPaidAdjustment,
} = require('./pricingService');
```

Below `ACCESS_ISSUE_OPTIONS` (~:163-166) add:

```js
// Scenario 10 — decline-only: paying the Checkout link IS the approval,
// so the prompt has no approve keys (mirrors visit_disposition, whose
// deep link is its answer path).
const PRICE_ADJUSTMENT_CHOICE_OPTIONS = {
  'NO': 'decline', 'DECLINE': 'decline', 'N': 'decline', '2': 'decline',
};
```

- [ ] **Step 2: Add the endpoint** (scaffold cloned from `requestSecondVisit` at :4899 — cors wrap, 405 guard, auth, error mapping):

```js
// ===================================
// PRICE ADJUSTMENT — Scenario 10 (approve-by-paying). Creates a Stripe
// Checkout Session for the delta; the customer's payment IS the
// approval (webhook Task 3 applies it). Decline is the only reply.
// Money: delta lands in the platform balance as a second held pot —
// released/refunded only by the existing admin paths.
// ===================================
exports.requestPriceAdjustment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const decodedToken = await verifyAuthToken(req);
      const { jobId, deltaDollars, reason, note } = req.body || {};
      if (!jobId) return res.status(400).json({ error: 'jobId is required', code: 'bad_request' });

      const rl = await checkRateLimit(`price_adjust_${decodedToken.uid}`, 5, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many requests', retryAfterSeconds: rl.retryAfterSeconds });
      }

      const db = admin.firestore();
      const nowIso = new Date().toISOString();

      // Validate against a fresh read BEFORE creating any Stripe object
      // (no orphan sessions for requests that would fail validation).
      const preSnap = await db.collection('jobs').doc(jobId).get();
      const preJob = preSnap.exists ? preSnap.data() : null;
      const priceMax = preJob ? getServicePriceMax(preJob.serviceType) : 0;
      try {
        validateAdjustmentRequest(preJob, decodedToken.uid, deltaDollars, reason, priceMax);
        if (!preJob.customerPhone) throw new PricingError('no_customer_phone', 'Job has no customer phone on file');
      } catch (pricingErr) {
        if (pricingErr.name === 'PricingError') {
          const statusMap = { not_found: 404, not_assigned: 403, wrong_status: 409, bad_amount: 400, over_cap: 400, reason_required: 400, adjustment_pending: 409, adjustment_already_paid: 409, no_customer_phone: 400 };
          return res.status(statusMap[pricingErr.code] || 400).json({ error: pricingErr.message, code: pricingErr.code });
        }
        throw pricingErr;
      }

      const entry = buildAdjustmentEntry({ deltaDollars, reason, note, requestedBy: decodedToken.uid, priceMax, nowIso });
      const adjustmentId = db.collection('_ids').doc().id; // firestore auto-id as an opaque unique token
      const jobShortId = jobId.slice(-6);
      const deltaChargeCents = dollarsToCents(entry.deltaServiceFee * (1 + getPlatformFeePercentage()));

      // Checkout Session (not a Payment Link: this SDK/API version has no
      // inline price_data on Payment Links, and sessions.expire() is the
      // natural decline semantic). 24h expiry; Task 3 re-issues once.
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'sgd',
            unit_amount: deltaChargeCents,
            product_data: {
              name: `Price adjustment — ${preJob.serviceType} job #${jobShortId}`,
              description: entry.reason.slice(0, 200),
            },
          },
          quantity: 1,
        }],
        client_reference_id: jobId,
        metadata: { type: 'price_adjustment_delta', jobId, adjustmentId },
        payment_intent_data: {
          description: `Price adjustment for ${preJob.serviceType} - Job #${jobId}`,
          metadata: {
            type: 'price_adjustment_delta', jobId, adjustmentId,
            customerId: preJob.customerId || '', serviceType: preJob.serviceType || '',
            platform: 'handyman-platform',
          },
        },
        expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
        success_url: `${APP_URL}/?adjustment=paid&job=${jobShortId}`,
        cancel_url: `${APP_URL}/?adjustment=cancelled&job=${jobShortId}`,
      }, { idempotencyKey: `adjsession-${jobId}-${adjustmentId}` });

      // Transactional write with a re-validation against fresh data (the
      // pre-read above only prevented pointless Stripe calls).
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(db.collection('jobs').doc(jobId));
          const job = snap.exists ? snap.data() : null;
          validateAdjustmentRequest(job, decodedToken.uid, deltaDollars, reason, priceMax);
          tx.update(snap.ref, {
            priceAdjustment: { ...entry, adjustmentId, sessionId: session.id, checkoutUrl: session.url },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
      } catch (txErr) {
        // Lost the race (e.g. double-submit): kill the fresh session so no
        // payable orphan link survives, then surface the domain error.
        try { await stripe.checkout.sessions.expire(session.id); } catch (e) { console.error('⚠️ orphan session expire failed:', e); }
        if (txErr.name === 'PricingError') {
          const statusMap = { not_found: 404, not_assigned: 403, wrong_status: 409, bad_amount: 400, over_cap: 400, reason_required: 400, adjustment_pending: 409, adjustment_already_paid: 409 };
          return res.status(statusMap[txErr.code] || 400).json({ error: txErr.message, code: txErr.code });
        }
        throw txErr;
      }

      // A price talk answers the evening "how did it go?" question.
      try { await supersedeOpenPrompts(db, jobId, ['visit_disposition']); }
      catch (e) { console.error('⚠️ supersedeOpenPrompts failed (continuing):', e); }

      const totalDisplay = (entry.deltaServiceFee * (1 + getPlatformFeePercentage())).toFixed(2);
      const fallback = `💰 Your handyman has requested a price adjustment of +S$${totalDisplay} for Job #${jobShortId}.\n\nReason: ${entry.reason}\n\n👉 Pay here to approve (valid 24h):\n${session.url}\n\n👉 Reply *NO* to decline`;
      const sendResult = await sendTwilioTemplateMessage(
        formatPhoneToWhatsApp(preJob.customerPhone),
        process.env.TWILIO_TEMPLATE_PRICE_ADJUSTMENT,
        { '1': totalDisplay, '2': entry.reason.slice(0, 150), '3': jobShortId, '4': session.url },
        fallback
      );
      if (!sendResult.success) {
        console.error('❌ price-adjustment send failed:', sendResult.error);
        return res.status(502).json({ error: 'Failed to send the WhatsApp request to the customer. Please try again.', code: 'send_failed' });
      }

      const { promptId } = await openPrompt({
        db, jobId, type: 'price_adjustment_choice',
        toPhone: preJob.customerPhone, toRole: 'customer',
        question: `Pay +S$${totalDisplay} adjustment for Job #${jobShortId}, or decline?`,
        options: PRICE_ADJUSTMENT_CHOICE_OPTIONS,
        payload: { sessionId: session.id },
      });

      await writeAuditLog('price_adjustment_requested', decodedToken, { jobId, deltaServiceFee: entry.deltaServiceFee, sessionId: session.id });
      return res.status(200).json({ success: true, promptId });
    } catch (error) {
      console.error('❌ requestPriceAdjustment error:', error);
      if (error.message && error.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' });
      return res.status(500).json({ error: 'Failed to request price adjustment' });
    }
  });
});
```

- [ ] **Step 3: Verify + commit**

Run: `cd functions && node --check index.js && npm test` — clean, suite green.

```bash
git add functions/index.js
git commit -m "feat(functions): requestPriceAdjustment — Checkout Session, decline-only prompt"
```

---

### Task 3: Webhook money cases — apply, re-issue/expire, delta guards

**Files:**
- Modify: `functions/index.js` — `stripeWebhook` (:2097-2415): dedup condition (:2141), new cases after `payment_intent.succeeded` closes (:2303), guards inside `payment_intent.succeeded` (:2258) and `charge.refunded` (:2333)

**Interfaces:**
- Consumes: `applyPaidAdjustment`, `buildAdjustmentTransition`, `hasPendingPriceAdjustment` (Task 1), `supersedeOpenPrompts`, `buildAttentionUpdate` (sweepService), `sendAdminEmail`, `escapeHtml`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`.
- Produces: paid deltas applied exactly once; expired sessions re-issued once then terminal `expired`; delta events never clobber the job's own payment state. New env var read inline: `TWILIO_TEMPLATE_ADJUSTMENT_PAID`.

- [ ] **Step 1: Extend the deferred-dedup condition** (:2141) — a crash mid-apply must not be swallowed as a duplicate on Stripe's retry:

```js
    const deferDedupWrite = event.type === 'payment_intent.amount_capturable_updated'
      || event.type === 'checkout.session.completed';
```

- [ ] **Step 2: Guard the two existing cases.** At the top of `case 'payment_intent.succeeded':` (first lines inside, ~:2259):

```js
        // Scenario 10: delta charges have their own lifecycle — the
        // checkout.session.completed case owns them. Without this guard the
        // delta PI (which carries metadata.jobId) would re-run the booking
        // paymentStatus writer.
        if (paymentIntent.metadata && paymentIntent.metadata.type === 'price_adjustment_delta') {
          console.log(`ℹ️ delta PI succeeded for job ${paymentIntent.metadata.jobId} — handled via checkout.session.completed`);
          break;
        }
```

At the top of `case 'charge.refunded':` (~:2334), after the charge/jobId extraction lines, add:

```js
        // Scenario 10: a refunded DELTA charge must mark only the
        // adjustment — a fully-refunded delta would otherwise compute
        // fullyRefunded=true and stamp paymentStatus:'refunded' on a job
        // whose original escrow is untouched.
        const refundMeta = charge.metadata && charge.metadata.type ? charge.metadata : (paymentIntentForCharge && paymentIntentForCharge.metadata) || {};
```

NOTE to implementer: read the actual variable names in that case first — it retrieves the PI as a fallback for jobId (:2337-2340); reuse whatever local holds it. Then, before the existing job write:

```js
        if (refundMeta.type === 'price_adjustment_delta') {
          const adjJobId = refundMeta.jobId;
          if (adjJobId) {
            await admin.firestore().runTransaction(async (tx) => {
              const snap = await tx.get(admin.firestore().collection('jobs').doc(adjJobId));
              if (!snap.exists) return;
              try {
                const upd = buildAdjustmentTransition(snap.data(), { to: 'refunded', stamps: { refundedAt: new Date().toISOString(), refundId: charge.refunds && charge.refunds.data && charge.refunds.data[0] ? charge.refunds.data[0].id : null } });
                tx.update(snap.ref, upd);
              } catch (e) {
                if (e.name !== 'PricingError') throw e; // already refunded/other state: no-op
              }
            });
          }
          break; // never touch the job's own paymentStatus for a delta charge
        }
```

- [ ] **Step 3: Add the two new cases** immediately after `payment_intent.succeeded`'s block closes (:2303):

```js
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};
        if (meta.type !== 'price_adjustment_delta' || !meta.jobId) break; // not ours

        const nowIso = new Date().toISOString();
        let applied = false;
        let appliedDelta = 0;
        await admin.firestore().runTransaction(async (tx) => {
          applied = false; // reset per attempt (Firestore retries re-run this)
          const snap = await tx.get(admin.firestore().collection('jobs').doc(meta.jobId));
          if (!snap.exists) return;
          const job = snap.data();
          try {
            const result = applyPaidAdjustment(job, {
              nowIso,
              deltaPaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent && session.payment_intent.id) || null,
              sessionId: session.id,
            });
            // Money arrived but the job left in_progress (cancelled/completed
            // meanwhile): don't apply — flag for a manual delta refund.
            if (job.status !== 'in_progress') throw new PricingError('bad_transition', 'job no longer in progress');
            appliedDelta = job.priceAdjustment.deltaServiceFee;
            tx.update(snap.ref, { ...result, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            applied = true;
          } catch (e) {
            if (e.name !== 'PricingError') throw e;
            tx.update(snap.ref, buildAttentionUpdate('adjustment_payment_orphaned', {
              detail: `payment received for session ${session.id} but no matching pending adjustment / job inactive — refund the delta`,
              promptId: null, nowIso,
            }));
          }
        });

        if (applied) {
          try { await supersedeOpenPrompts(admin.firestore(), meta.jobId, ['price_adjustment_choice']); }
          catch (e) { console.error('⚠️ adjustment prompt supersede failed (continuing):', e); }
          // Confirm both parties (business-initiated → template-first).
          try {
            const jobSnap = await admin.firestore().collection('jobs').doc(meta.jobId).get();
            const jobData = jobSnap.exists ? jobSnap.data() : null;
            const shortId = meta.jobId.slice(-6);
            const amountDisplay = (appliedDelta * (1 + getPlatformFeePercentage())).toFixed(2);
            if (jobData && jobData.customerPhone) {
              await sendTwilioTemplateMessage(formatPhoneToWhatsApp(jobData.customerPhone),
                process.env.TWILIO_TEMPLATE_ADJUSTMENT_PAID,
                { '1': amountDisplay, '2': shortId },
                `✅ Payment received — the +S$${amountDisplay} adjustment for Job #${shortId} is confirmed. Thank you!`);
            }
            const hmSnap = jobData && jobData.handymanId ? await admin.firestore().collection('handymen').doc(jobData.handymanId).get() : null;
            const hmPhone = hmSnap && hmSnap.exists ? hmSnap.data().phone : null;
            if (hmPhone) {
              await sendTwilioTemplateMessage(formatPhoneToWhatsApp(hmPhone),
                process.env.TWILIO_TEMPLATE_ADJUSTMENT_PAID,
                { '1': amountDisplay, '2': shortId },
                `✅ The customer paid the +S$${amountDisplay} adjustment for Job #${shortId} — you're clear to proceed.`);
            }
          } catch (notifyErr) {
            console.error('⚠️ adjustment-paid notifications failed (continuing):', notifyErr);
          }
          await sendAdminEmail(`💰 Price adjustment paid — Job #${meta.jobId.slice(-6)}`,
            `<p>Delta paid for job <b>${escapeHtml(meta.jobId)}</b> (session ${escapeHtml(session.id)}). Held with the original pot until release.</p>`);
        } else {
          await sendAdminEmail(`🚨 Orphaned adjustment payment — Job #${meta.jobId.slice(-6)}`,
            `<p>A delta payment arrived for job <b>${escapeHtml(meta.jobId)}</b> but no matching pending adjustment (stale session or job closed). Refund it via refundPayment with the delta PaymentIntent.</p>`);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const meta = session.metadata || {};
        if (meta.type !== 'price_adjustment_delta' || !meta.jobId) break;

        const nowIso = new Date().toISOString();
        const db = admin.firestore();
        const jobRef = db.collection('jobs').doc(meta.jobId);
        const snap = await jobRef.get();
        if (!snap.exists) break;
        const job = snap.data();
        const adj = job.priceAdjustment;
        // Only act on the CURRENT pending session — stale sessions expire silently.
        if (!adj || adj.status !== 'pending_payment' || adj.sessionId !== session.id) break;

        if (!adj.reissued && job.status === 'in_progress' && job.customerPhone) {
          // One automated re-issue = the F5 nudge for this flow.
          const shortId = meta.jobId.slice(-6);
          const totalDisplay = (adj.deltaServiceFee * (1 + getPlatformFeePercentage())).toFixed(2);
          const fresh = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{ price_data: { currency: 'sgd', unit_amount: dollarsToCents(adj.deltaServiceFee * (1 + getPlatformFeePercentage())), product_data: { name: `Price adjustment — ${job.serviceType} job #${shortId}`, description: (adj.reason || '').slice(0, 200) } }, quantity: 1 }],
            client_reference_id: meta.jobId,
            metadata: { type: 'price_adjustment_delta', jobId: meta.jobId, adjustmentId: adj.adjustmentId || '' },
            payment_intent_data: { description: `Price adjustment for ${job.serviceType} - Job #${meta.jobId}`, metadata: { type: 'price_adjustment_delta', jobId: meta.jobId, adjustmentId: adj.adjustmentId || '', customerId: job.customerId || '', serviceType: job.serviceType || '', platform: 'handyman-platform' } },
            expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
            success_url: `${APP_URL}/?adjustment=paid&job=${shortId}`,
            cancel_url: `${APP_URL}/?adjustment=cancelled&job=${shortId}`,
          }, { idempotencyKey: `adjsession-reissue-${meta.jobId}-${session.id}` });
          await jobRef.update({
            'priceAdjustment.sessionId': fresh.id,
            'priceAdjustment.checkoutUrl': fresh.url,
            'priceAdjustment.reissued': true,
          });
          await sendTwilioTemplateMessage(formatPhoneToWhatsApp(job.customerPhone),
            process.env.TWILIO_TEMPLATE_PRICE_ADJUSTMENT,
            { '1': totalDisplay, '2': (adj.reason || '').slice(0, 150), '3': shortId, '4': fresh.url },
            `⏰ Reminder — the +S$${totalDisplay} adjustment for Job #${shortId} is still awaiting your decision.\n\n👉 Pay here to approve (fresh link, valid 24h):\n${fresh.url}\n\n👉 Reply *NO* to decline`);
        } else {
          // Second expiry (or job inactive): terminal. Unwedges the
          // Mark-Complete/poll gates deterministically.
          try {
            const upd = buildAdjustmentTransition(job, { to: 'expired', stamps: { expiredAt: nowIso } });
            Object.assign(upd, buildAttentionUpdate('adjustment_expired', { detail: `customer never paid or declined (+S$${adj.deltaServiceFee})`, promptId: null, nowIso }));
            await jobRef.update(upd);
          } catch (e) {
            if (e.name !== 'PricingError') throw e;
          }
          try { await supersedeOpenPrompts(db, meta.jobId, ['price_adjustment_choice']); }
          catch (e) { console.error('⚠️ prompt supersede failed (continuing):', e); }
          try {
            const hmSnap = job.handymanId ? await db.collection('handymen').doc(job.handymanId).get() : null;
            const hmPhone = hmSnap && hmSnap.exists ? hmSnap.data().phone : null;
            if (hmPhone) {
              await sendTwilioMessage(formatPhoneToWhatsApp(hmPhone),
                `ℹ️ The customer didn't respond to the +S$${adj.deltaServiceFee} adjustment for Job #${meta.jobId.slice(-6)}. You can proceed at the original scope, or cancel the job from the app. Our team has been notified.`);
            }
          } catch (e) { console.error('⚠️ handyman expiry notice failed (continuing):', e); }
          await sendAdminEmail(`⏳ Price adjustment expired — Job #${meta.jobId.slice(-6)}`,
            `<p>Adjustment on job <b>${escapeHtml(meta.jobId)}</b> expired unanswered after a re-issue. Handyman told to proceed or cancel.</p>`);
        }
        break;
      }
```

NOTE to implementer: `sendTwilioMessage` to the handyman in the expiry branch is business-initiated — acceptable here as fallback-grade (handymen keep app visibility); if you prefer strict template-first, reuse `TWILIO_TEMPLATE_PROMPT_NUDGE` with its established two-var shape. Choose one and note it in your report.

- [ ] **Step 4: Verify + commit**

Run: `cd functions && node --check index.js && npm test` — clean, green.

```bash
git add functions/index.js
git commit -m "feat(webhook): checkout.session completed/expired for adjustment deltas + delta guards"
```

---

### Task 4: Decline branch + refund integration

**Files:**
- Modify: `functions/index.js` — new webhook prompt branch after `access_issue_choice` ends (~:3030); `refundPayment` (:1915-2068)

**Interfaces:**
- Consumes: prompt `payload { sessionId }` (Task 2), `buildAdjustmentTransition`, `stripe.checkout.sessions.expire`, `stripe.refunds.create` house pattern (:2006-2018).
- Produces: decline → terminal + session dead + handyman notified; `refundPayment` handles (a) a delta PI directly (adjustment-scoped side-effects) and (b) cascading the delta refund when the ORIGINAL PI of a job with a paid adjustment is refunded.

- [ ] **Step 1: Webhook branch** (insert after the `access_issue_choice` block, before `schedule_approval`; in-scope vars `From`, `Body`, `mediaUrls`, `senderKey`, `verdict`):

```js
        if (verdict.prompt.type === 'price_adjustment_choice') {
          const jobShortId = verdict.prompt.jobId.slice(-6);
          if (verdict.action === 'decline') {
            const db = admin.firestore();
            const nowIso = new Date().toISOString();
            let declined = false;
            let deltaAmount = 0;
            let sessionToExpire = null;
            await db.runTransaction(async (tx) => {
              declined = false;
              const snap = await tx.get(db.collection('jobs').doc(verdict.prompt.jobId));
              if (!snap.exists) return;
              const job = snap.data();
              try {
                const upd = buildAdjustmentTransition(job, { to: 'declined', stamps: { declinedAt: nowIso } });
                deltaAmount = job.priceAdjustment.deltaServiceFee;
                sessionToExpire = job.priceAdjustment.sessionId || null;
                tx.update(snap.ref, { ...upd, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                declined = true;
              } catch (e) {
                if (e.name !== 'PricingError') throw e; // already paid/terminal → race, handled below
              }
            });
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: declined ? 'declined' : 'already_processed' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }

            if (!declined) {
              await sendTwilioMessage(From, `ℹ️ The adjustment for Job #${jobShortId} has already been settled — no changes were made. Contact easydonehandyman@gmail.com if something looks wrong.`);
              return res.status(200).json({ received: true, processed: false, reason: 'decline on non-pending adjustment' });
            }
            // Kill the payable link so a decline can't be "un-declined" by paying.
            if (sessionToExpire) {
              try { await stripe.checkout.sessions.expire(sessionToExpire); }
              catch (e) { console.error('⚠️ session expire on decline failed (webhook guard still protects):', e); }
            }
            await sendTwilioMessage(From, `👍 Understood — the +S$${deltaAmount} adjustment for Job #${jobShortId} is declined. Your handyman will continue at the original price, or our team will help sort out next steps.`);
            try {
              const jobSnap = await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).get();
              const hmId = jobSnap.exists ? jobSnap.data().handymanId : null;
              const hmSnap = hmId ? await admin.firestore().collection('handymen').doc(hmId).get() : null;
              const hmPhone = hmSnap && hmSnap.exists ? hmSnap.data().phone : null;
              if (hmPhone) {
                await sendTwilioMessage(formatPhoneToWhatsApp(hmPhone),
                  `ℹ️ The customer declined the +S$${deltaAmount} adjustment for Job #${jobShortId}. You can proceed at the original scope, or cancel the job from the app if it's not viable.`);
              }
            } catch (e) { console.error('⚠️ handyman decline notice failed (continuing):', e); }
            await sendAdminEmail(`💬 Price adjustment declined — Job #${jobShortId}`,
              `<p>Customer declined +S$${deltaAmount} on job <b>${escapeHtml(verdict.prompt.jobId)}</b>. Handyman told: proceed at original scope or cancel. Often becomes a Scenario 2 cancel — keep an eye out.</p>`);
            return res.status(200).json({ received: true, processed: true, action: 'adjustment_declined', via: 'prompt' });
          }
        }
```

(Decline is the only action in the options map; no other arms needed. The payload's `sessionId` is intentionally not required here — the transaction reads the authoritative one off the job — so no invalid-payload guard is necessary; note this in the code comment.)

- [ ] **Step 2: `refundPayment` delta handling.** Two insertions:

(a) After the PI retrieve + auth checks (~:1946), add a delta-PI branch BEFORE the transfer-reversal logic:

```js
    // ── Scenario 10: refunding a DELTA PaymentIntent directly.
    // Side-effects scope to priceAdjustment; the job's own paymentStatus
    // and the original escrow are untouched.
    if (paymentIntent.metadata && paymentIntent.metadata.type === 'price_adjustment_delta') {
      const adjJobId = paymentIntent.metadata.jobId;
      const adjChargeId = paymentIntent.latest_charge || (paymentIntent.charges && paymentIntent.charges.data[0] && paymentIntent.charges.data[0].id);
      if (!adjChargeId) return res.status(400).json({ error: 'No charge found on this PaymentIntent' });
      const adjJobSnap = adjJobId ? await admin.firestore().collection('jobs').doc(adjJobId).get() : null;
      const adjData = adjJobSnap && adjJobSnap.exists ? adjJobSnap.data() : null;
      // If the delta was already released to the handyman, reverse that
      // transfer first (mirrors the original-pot ordering below).
      if (adjData && adjData.priceAdjustment && adjData.priceAdjustment.status === 'released' && adjData.priceAdjustment.transferId) {
        try {
          await stripe.transfers.createReversal(adjData.priceAdjustment.transferId, { metadata: { jobId: adjJobId, reason: 'delta_refund' } }, { idempotencyKey: `reversal-${adjData.priceAdjustment.transferId}` });
        } catch (revErr) {
          console.error('❌ delta transfer reversal failed:', revErr);
          return res.status(409).json({ error: 'Delta transfer reversal failed — manual review required', requiresManualReview: true });
        }
      }
      const refund = await stripe.refunds.create(
        { charge: adjChargeId, reason: reason || 'requested_by_customer', metadata: { jobId: adjJobId || '', type: 'price_adjustment_delta', refundedBy: 'platform' } },
        { idempotencyKey: `refund-${adjChargeId}` }
      );
      // Job-side stamp is best-effort; the charge.refunded webhook (Task 3)
      // is the durable writer of the adjustment's refunded state.
      if (adjJobSnap && adjJobSnap.exists) {
        try {
          const upd = buildAdjustmentTransition(adjJobSnap.data(), { to: 'refunded', stamps: { refundedAt: new Date().toISOString(), refundId: refund.id } });
          await adjJobSnap.ref.update(upd);
        } catch (e) { if (e.name !== 'PricingError') console.error('⚠️ adjustment refund stamp failed (webhook will catch up):', e); }
      }
      await writeAuditLog('refund_price_adjustment', decodedToken, { jobId: adjJobId, paymentIntentId, refundId: refund.id });
      return res.status(200).json({ success: true, refundId: refund.id, scope: 'price_adjustment_delta' });
    }
```

(b) In the ORIGINAL-PI path, after the existing refund succeeds and the job doc write (~:2022-2030), cascade the paid delta so the admin's one Refund button never orphans it:

```js
    // ── Scenario 10 cascade: a full job refund must return the delta too.
    if (jobData && jobData.priceAdjustment && ['paid', 'released'].includes(jobData.priceAdjustment.status) && jobData.priceAdjustment.deltaPaymentIntentId) {
      try {
        const deltaPi = await stripe.paymentIntents.retrieve(jobData.priceAdjustment.deltaPaymentIntentId);
        const deltaChargeId = deltaPi.latest_charge || (deltaPi.charges && deltaPi.charges.data[0] && deltaPi.charges.data[0].id);
        if (jobData.priceAdjustment.status === 'released' && jobData.priceAdjustment.transferId) {
          await stripe.transfers.createReversal(jobData.priceAdjustment.transferId, { metadata: { jobId, reason: 'cascade_delta_refund' } }, { idempotencyKey: `reversal-${jobData.priceAdjustment.transferId}` });
        }
        if (deltaChargeId) {
          await stripe.refunds.create(
            { charge: deltaChargeId, reason: reason || 'requested_by_customer', metadata: { jobId, type: 'price_adjustment_delta', refundedBy: 'platform' } },
            { idempotencyKey: `refund-${deltaChargeId}` }
          );
        }
      } catch (cascadeErr) {
        console.error('❌ delta cascade refund failed — flagging admin:', cascadeErr);
        try {
          await admin.firestore().collection('jobs').doc(jobId).update(
            buildAttentionUpdate('delta_refund_failed', { detail: 'original refunded but the paid delta refund failed — refund the delta PI manually', promptId: null, nowIso: new Date().toISOString() })
          );
        } catch (e) { console.error('⚠️ attention flag failed:', e); }
        await sendAdminEmail(`🚨 Delta refund failed — Job #${jobId.slice(-6)}`, `<p>The original charge for job <b>${escapeHtml(jobId)}</b> was refunded but the +S$ delta refund failed. Refund the delta PaymentIntent manually in Stripe.</p>`);
      }
    }
```

NOTE to implementer: read the surrounding handler first — reuse its actual local names (`jobData`, `jobId`, `reason`) and confirm the insertion point sits after the job-doc write and before the audit log.

- [ ] **Step 3: Verify + commit**

Run: `cd functions && node --check index.js && npm test` — clean, green.

```bash
git add functions/index.js
git commit -m "feat(payments): adjustment decline branch; delta-aware refundPayment with cascade"
```

---

### Task 5: Gates — poll, disposition, cancel-path cleanup

**Files:**
- Modify: `functions/index.js` (`autoTriggerCompletionPoll` skip block ~:4099), `functions/visitService.js` (`shouldSendDisposition` :147-156), `functions/jobReassignment.js` (`buildCancelUpdate` :72-130)
- Test: `functions/__tests__/visitService.test.js`, `functions/__tests__/jobReassignment.test.js` (append)

**Interfaces:**
- Consumes: `hasPendingPriceAdjustment` (Task 1).
- Produces: `shouldSendDisposition(job, todaySgt, { hasPendingAdjustment })` — NO: keep the signature stable instead. Decision: `visitService` must not import `pricingService` (module independence); `shouldSendDisposition` gains the check inline via a duplicated one-liner is worse. Resolution: `shouldSendDisposition` checks `job.priceAdjustment && job.priceAdjustment.status === 'pending_payment'` directly (a read of the job shape, not a cross-module import — mirror how it already reads `visits[]` via `hasPendingSecondVisit` in the same file; add the equivalent tiny local helper `hasPendingAdjustment(job)` PRIVATE to visitService). `buildCancelUpdate` transitions a `pending_payment` adjustment to `cancelled_assignment`.

- [ ] **Step 1: Failing tests.** Append to `functions/__tests__/visitService.test.js` (in the `shouldSendDisposition` describe's `test.each` false-cases table):

```js
    ['price adjustment pending', job({ priceAdjustment: { status: 'pending_payment' } })],
```

And a positive guard: `shouldSendDisposition(job({ priceAdjustment: { status: 'declined' } }), TODAY_SGT)` → `true` (terminal adjustments don't block).

Append to `functions/__tests__/jobReassignment.test.js`:

```js
  test('voids a pending price adjustment on cancel', () => {
    const jobWithAdj = { ...baseJob(), priceAdjustment: { status: 'pending_payment', deltaServiceFee: 30 } };
    const update = buildCancelUpdate(jobWithAdj, 'hm-1', { reason: 'personal_emergency', note: '', nowIso: NOW_ISO });
    expect(update.priceAdjustment.status).toBe('cancelled_assignment');
    expect(update.priceAdjustment.cancelledAt).toBe(NOW_ISO);
  });
  test('leaves a paid adjustment untouched on cancel', () => {
    const jobWithPaid = { ...baseJob(), priceAdjustment: { status: 'paid', deltaServiceFee: 30 } };
    const update = buildCancelUpdate(jobWithPaid, 'hm-1', { reason: 'personal_emergency', note: '', nowIso: NOW_ISO });
    expect(update.priceAdjustment).toBeUndefined(); // key absent — no write
  });
```

(Use the test file's existing job fixture factory name — read it first; `baseJob()` above is illustrative.)

- [ ] **Step 2: Run to verify failures**, then implement:

In `functions/visitService.js`, add a private helper above `shouldSendDisposition` and the check inside it:

```js
// Scenario 10: a job mid-price-talk must not be asked "how did it go?" —
// the pending adjustment already owns the conversation. Local check on
// the job shape (visitService stays independent of pricingService).
function hasPendingAdjustment(job) {
  return !!(job && job.priceAdjustment && job.priceAdjustment.status === 'pending_payment');
}
```

Inside `shouldSendDisposition`, after the `hasPendingSecondVisit(job)` line:

```js
  if (hasPendingAdjustment(job)) return false;
```

In `functions/index.js` `autoTriggerCompletionPoll`, next to the `hasPendingSecondVisit` skip (~:4099):

```js
        // Scenario 10: pending adjustment — the job is knowingly mid-price-talk.
        if (hasPendingPriceAdjustment(job)) { skipped++; continue; }
```

In `functions/jobReassignment.js` `buildCancelUpdate`, next to the visits[] voiding block (:118-129):

```js
  // Scenario 10: a pending adjustment must not survive the assignment —
  // it would wedge the NEXT handyman's Mark-Complete/poll gates, and its
  // Checkout link belongs to a conversation that no longer exists. (A
  // PAID adjustment survives: the money is real and releases/refunds
  // with the job regardless of who finishes it.) The endpoint (index.js
  // cancelJobAssignment) expires the Stripe session post-transaction.
  if (job.priceAdjustment && job.priceAdjustment.status === 'pending_payment') {
    update.priceAdjustment = { ...job.priceAdjustment, status: 'cancelled_assignment', cancelledAt: nowIso };
  }
```

And in `functions/index.js` `cancelJobAssignment` (post-transaction, next to the existing supersede-prompts step ~:4699): if the pre-cancel job had a `pending_payment` adjustment with a `sessionId`, best-effort `await stripe.checkout.sessions.expire(sessionId)` in a try/catch (the webhook's sessionId guard already protects if this fails — say so in the comment). NOTE: the transaction must capture `sessionId` into a local before it commits (read the endpoint's existing structure; it already reads the job inside the transaction).

- [ ] **Step 3: Run tests + verify + commit**

Run: `cd functions && npm test && node --check index.js` — green.

```bash
git add functions/visitService.js functions/index.js functions/jobReassignment.js functions/__tests__/visitService.test.js functions/__tests__/jobReassignment.test.js
git commit -m "feat(gates): pending adjustment blocks poll/disposition; cancel voids pending adjustment + expires session"
```

---

### Task 6: `releaseEscrowSimple` delta transfer + admin fund-release UI

**Files:**
- Modify: `functions/index.js` (`releaseEscrowSimple` :1563-1908 — delta block between the original transfer (:1760-1778) and the final write (:1803-1835))
- Modify: `src/pages/AdminFundRelease.jsx` (amount cell :467-472, confirm dialog :233, completed-tab breakdown :582-608)

**Interfaces:**
- Consumes: `buildAdjustmentTransition` (Task 1); the handler's existing locals (`handymanAccountId`, `platformFeePercentage`, `jobData`, `jobId`).
- Produces: on release of a job with a `paid` adjustment — a second transfer `source_transaction`-pinned to the delta charge (per-charge fee math), `priceAdjustment.status: 'released'` + `transferId`, `paymentBreakdown` delta fields.

- [ ] **Step 1: Backend.** Insert AFTER the original `stripe.transfers.create` succeeds (:1778) and BEFORE the final job write (:1803) — inside the same try so failure hits the existing `release_failed` path (:1779-1798), which is retry-safe because both transfers carry deterministic idempotency keys:

```js
    // ── Scenario 10: pay out a PAID delta as a second transfer. The
    // original transfer is source_transaction-pinned to the original
    // charge, so the delta MUST ride its own charge (Stripe caps a
    // pinned transfer at that charge's balance) — two deposits for the
    // handyman, each with correct per-charge fee math.
    let deltaTransfer = null;
    let deltaBreakdown = null;
    const paidAdjustment = jobData.priceAdjustment && jobData.priceAdjustment.status === 'paid' ? jobData.priceAdjustment : null;
    if (paidAdjustment && paidAdjustment.deltaPaymentIntentId) {
      const deltaPi = await stripe.paymentIntents.retrieve(paidAdjustment.deltaPaymentIntentId);
      const deltaChargeId = deltaPi.latest_charge;
      const deltaCharge = await stripe.charges.retrieve(deltaChargeId);
      const deltaBt = await stripe.balanceTransactions.retrieve(deltaCharge.balance_transaction);
      const deltaNet = deltaBt.net / 100;
      const deltaStripeFee = deltaBt.fee / 100;
      const deltaPlatformFee = deltaNet * platformFeePercentage / (1 + platformFeePercentage);
      const deltaPayout = deltaNet - deltaPlatformFee;
      deltaTransfer = await stripe.transfers.create({
        amount: Math.round(deltaPayout * 100),
        currency: 'sgd',
        destination: handymanAccountId,
        source_transaction: deltaChargeId,
        description: `Price adjustment payout for job #${jobId}`,
        metadata: { jobId, type: 'price_adjustment_delta', deltaServiceFee: String(paidAdjustment.deltaServiceFee) },
      }, { idempotencyKey: `transfer-delta-${deltaChargeId}` });
      deltaBreakdown = { deltaGross: paidAdjustment.deltaServiceFee, deltaStripeFee, deltaNet, deltaPayout };
    }
```

In the final job write (:1803-1835), add alongside the existing fields:

```js
      ...(deltaTransfer ? {
        priceAdjustment: buildAdjustmentTransition(jobData, { to: 'released', stamps: { releasedAt: new Date().toISOString(), transferId: deltaTransfer.id } }).priceAdjustment,
      } : {}),
```

and extend `paymentBreakdown` with `...(deltaBreakdown || {})`.

- [ ] **Step 2: Frontend.** In `AdminFundRelease.jsx`:
  - Amount cell (:467-472): keep `${job.estimatedBudget}` as the headline (it already includes the delta once paid — `estimatedBudget` was incremented on apply); beneath it, when `job.priceAdjustment?.status === 'paid'` (or `'released'` on the completed tab), render:
    ```jsx
                {['paid', 'released'].includes(job.priceAdjustment?.status) && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    includes +${job.priceAdjustment.deltaServiceFee} adjustment — {job.priceAdjustment.reason}
                  </p>
                )}
    ```
  - Confirm dialog (:233): append to the template string: `` + (job.priceAdjustment?.status === 'paid' ? `\n(includes a +$${job.priceAdjustment.deltaServiceFee} paid adjustment — two transfers will be sent)` : '') ``
  - Completed-tab breakdown strip (:582-608): after the existing five columns, conditionally render two more when `job.paymentBreakdown?.deltaPayout != null`: "Delta Net" (`deltaNet`) and "Delta Payout" (`deltaPayout`), same cell markup as the neighbors.

- [ ] **Step 3: Verify + commit**

Run: `cd functions && node --check index.js && npm test`; then `CI=true npx react-scripts build 2>&1 | tail -5` — compiles, no new errors.

```bash
git add functions/index.js src/pages/AdminFundRelease.jsx
git commit -m "feat(release): second transfer for paid delta; admin fund-release shows adjustment"
```

---

### Task 7: Frontend — request modal, buttons, Mark-Complete gate

**Files:**
- Create: `src/services/api/jobPricing.js`, `src/components/handyman/RequestAdjustmentModal.jsx`
- Modify: `src/components/handyman/JobActionButtons.jsx`

**Interfaces:**
- Consumes: `post()` wrapper pattern (`src/services/api/jobVisits.js:23-41` — clone verbatim into the new module), modal skeleton (`VisitIssueModal.jsx` — the closest sibling: reason/amount/note + submit, no picker), `getServicePriceRange` from `src/config/servicePricing.js`.
- Produces: `requestPriceAdjustment(jobId, deltaDollars, reason, note='')` → `{success, error?, code?}` never throws; `RequestAdjustmentModal` props `{ job, isOpen, onClose, onRequested }`; Mark-Complete gate + status copy.

- [ ] **Step 1: `src/services/api/jobPricing.js`** — clone jobVisits.js's header comment style, imports, and `post()` helper verbatim, then:

```js
/** Ask the customer to approve a price adjustment by paying the delta. */
export const requestPriceAdjustment = (jobId, deltaDollars, reason, note = '') =>
  post('requestPriceAdjustment', { jobId, deltaDollars, reason, note },
    'Could not send the adjustment request. Please try again.');
```

- [ ] **Step 2: `RequestAdjustmentModal.jsx`.** Clone `VisitIssueModal.jsx`'s skeleton (null-when-closed after hooks, reset effect keyed `[isOpen, job.id]`, `submittingRef`, inline error, overlay/card/footer classes, dark-mode everywhere). Blue icon chip (`bg-blue-100 dark:bg-blue-900/30`), Material icon `request_quote`, title "Request price adjustment". Fields:
  - Amount: `<input type="number" min="1" step="1">` labeled "Additional amount (S$, before platform fee)". Under it, a live hint: `` Range for {job.serviceType}: up to S$${max} total — current S$${job.estimatedBudget}, so max +S$${Math.max(0, max - job.estimatedBudget)} `` using `const { max } = getServicePriceRange(job.serviceType);`
  - Reason: `<textarea maxLength={300}>`, required.
  - Body note: "The customer approves by paying the additional amount through a secure Stripe link — you'll be notified when it's paid. If they decline, you can continue at the original price or cancel the job."
  - `canSubmit = Number(amount) > 0 && reason.trim() && !isSubmitting` (server enforces the cap authoritatively; the hint is advisory).
  - Submit: `const result = await requestPriceAdjustment(job.id, Number(amount), reason.trim(), note.trim());` — on success `alert('Request sent — the customer has been asked to approve by paying.')`, `onRequested?.()`, `onClose()`; on failure render `result.error` inline (the server's `over_cap` message names the cap).

- [ ] **Step 3: `JobActionButtons.jsx` wiring.**
  - State: `const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);`
  - Gate: `const adjustmentPending = job.priceAdjustment?.status === 'pending_payment';` and `const canRequestAdjustment = job.status === 'in_progress' && dateReached && !isCompleted && !adjustmentPending;`
  - **Mark-Complete guard** — in `handleMarkCompleted`, immediately after the date gate (:141-145):
    ```jsx
    if (job.priceAdjustment?.status === 'pending_payment') {
      alert('A price adjustment is awaiting the customer\'s decision. You can mark the job complete once it\'s paid or declined.');
      return;
    }
    ```
  - Mark-Complete button (:305) disabled expression gains `|| adjustmentPending`; the label chain (:310-328) and helper `<p>` (:331-337) gain an `adjustmentPending` arm: "Awaiting customer's price decision".
  - New button in BOTH variants (full ~:348, compact mirror): `{canRequestAdjustment && (...)}` — blue outline style matching the "Customer not home" button's shape, icon `request_quote`, label "Request price adjustment" → `setShowAdjustmentModal(true)`.
  - Mount `<RequestAdjustmentModal job={job} isOpen={showAdjustmentModal} onClose={() => setShowAdjustmentModal(false)} onRequested={onStatusChange} />` alongside the other always-mounted modals in BOTH variants.
  - Also add the option to the disposition sheet? NO — YAGNI: the sheet's "Problem — can't finish" already routes problems; price talk is initiated deliberately from the job page.

- [ ] **Step 4: Build + commit**

Run: `CI=true npx react-scripts build 2>&1 | tail -5` — compiles, no new errors.

```bash
git add src/services/api/jobPricing.js src/components/handyman/RequestAdjustmentModal.jsx src/components/handyman/JobActionButtons.jsx
git commit -m "feat(ui): RequestAdjustmentModal + adjustment gates on Mark Complete"
```

---

### Task 8: Scenario 7 — `runNoShowReport` + stub replacement + rules

**Files:**
- Modify: `functions/index.js` — new constant (~:167), new helper next to `supersedeOpenPrompts`, replace the `never_came` stub (:2969-2991)
- Modify: `firestore.rules` — handymen update deny list (:282-288)

**Interfaces:**
- Consumes: `openPrompt`, `markAnswered`, `sendTwilioTemplateMessage`, `sendTwilioMessage`, `sendAdminEmail`, `escapeHtml`, `formatPhoneToWhatsApp`, `admin.firestore.FieldValue.increment` (cancellationCount precedent :4711-4717).
- Produces:
  - `NO_SHOW_CHOICE_OPTIONS` constant
  - `runNoShowReport({ db, jobId, via, promptId })` → `{ reported: boolean, promptId: string|null }` — shared by the stub replacement (this task) and free-text entry (Task 9)
  - New env vars read inline: `TWILIO_TEMPLATE_NO_SHOW_REPORTED`, `TWILIO_TEMPLATE_NO_SHOW_CHOICE`

- [ ] **Step 1: Constant** (below `PRICE_ADJUSTMENT_CHOICE_OPTIONS`):

```js
// Scenario 7 — customer's three-way choice after reporting a no-show.
const NO_SHOW_CHOICE_OPTIONS = {
  '1': 'reschedule', 'RESCHEDULE': 'reschedule',
  '2': 'new_handyman', 'NEW HANDYMAN': 'new_handyman', 'NEW': 'new_handyman',
  '3': 'cancel_refund', 'CANCEL': 'cancel_refund', 'REFUND': 'cancel_refund',
};
```

- [ ] **Step 2: Shared helper** (place after `supersedeOpenPrompts`):

```js
/**
 * Scenario 7 — record a handyman no-show and open the customer's
 * choice prompt. Shared by the poll follow-up branch and the free-text
 * intent path; `via` distinguishes them in the report entry.
 * Returns { reported:false } when the job is missing or not in a
 * reportable state (callers ack accordingly).
 */
async function runNoShowReport({ db, jobId, via, promptId }) {
  const nowIso = new Date().toISOString();
  let jobData = null;
  await db.runTransaction(async (tx) => {
    jobData = null;
    const snap = await tx.get(db.collection('jobs').doc(jobId));
    if (!snap.exists) return;
    const job = snap.data();
    if (!['in_progress', 'pending_confirmation'].includes(job.status)) return;
    const reports = Array.isArray(job.noShowReports) ? job.noShowReports.slice() : [];
    reports.push({ reportedAt: nowIso, via, promptId: promptId || null });
    tx.update(snap.ref, { noShowReports: reports, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    jobData = job;
  });
  if (!jobData) return { reported: false, promptId: null };

  const jobShortId = jobId.slice(-6);
  const displayDate = jobData.preferredDate
    ? new Date(jobData.preferredDate).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'the scheduled date';

  // Repeat-offender signal (display-only, mirrors cancellationCount).
  if (jobData.handymanId) {
    try {
      await admin.firestore().collection('handymen').doc(jobData.handymanId)
        .update({ noShowCount: admin.firestore.FieldValue.increment(1) });
    } catch (err) {
      console.error(`⚠️ noShowCount increment failed for ${jobData.handymanId}:`, err);
    }
    // Notify the handyman — they can dispute by replying (F3 → admin).
    try {
      const hmSnap = await admin.firestore().collection('handymen').doc(jobData.handymanId).get();
      const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
      if (hmPhone) {
        await sendTwilioTemplateMessage(formatPhoneToWhatsApp(hmPhone),
          process.env.TWILIO_TEMPLATE_NO_SHOW_REPORTED,
          { '1': jobShortId, '2': displayDate },
          `⚠️ The customer reported that nobody arrived for Job #${jobShortId} (${displayDate}). If this was reported in error, reply here and our team will look into it.`);
      }
    } catch (notifyErr) {
      console.error('⚠️ no-show handyman notice failed (continuing):', notifyErr);
    }
  }

  await sendAdminEmail(`🚨 No-show reported — Job #${jobShortId}`,
    `<p>Customer reports the handyman never came for job <b>${escapeHtml(jobId)}</b> (via ${escapeHtml(via)}). They've been offered reschedule / new handyman / refund — watch the queue for their pick.</p>`);

  // Choice prompt. Both entry points are customer replies, so the
  // question itself may ride the session window; the template covers
  // robustness if this is ever called outside one.
  let choicePromptId = null;
  if (jobData.customerPhone) {
    await sendTwilioTemplateMessage(formatPhoneToWhatsApp(jobData.customerPhone),
      process.env.TWILIO_TEMPLATE_NO_SHOW_CHOICE,
      { '1': jobShortId, '2': displayDate },
      `😔 We're very sorry — we've recorded that your handyman didn't turn up for Job #${jobShortId} (${displayDate}). How would you like to proceed?\n\n👉 Reply *1* — Reschedule with the same handyman\n👉 Reply *2* — Get a new handyman\n👉 Reply *3* — Cancel and get a refund`);
    const opened = await openPrompt({
      db, jobId, type: 'no_show_choice',
      toPhone: jobData.customerPhone, toRole: 'customer',
      question: `No-show on Job #${jobShortId}: 1 reschedule / 2 new handyman / 3 cancel & refund`,
      options: NO_SHOW_CHOICE_OPTIONS,
      payload: null,
    });
    choicePromptId = opened.promptId;
  }
  return { reported: true, promptId: choicePromptId };
}
```

- [ ] **Step 3: Replace the stub** (:2969-2991). The `never_came` branch of `completion_no_followup` becomes:

```js
          if (verdict.action === 'never_came') {
            const result = await runNoShowReport({
              db: admin.firestore(), jobId: verdict.prompt.jobId,
              via: 'poll_followup', promptId: verdict.prompt.id,
            });
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: result.reported ? 'no_show_reported' : 'already_processed' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            if (!result.reported) {
              await sendTwilioMessage(From, `ℹ️ Job #${jobShortId} has already been handled separately. If something still needs fixing, please contact easydonehandyman@gmail.com.`);
              return res.status(200).json({ received: true, processed: false, reason: 'no-show on inactive job' });
            }
            // The choice prompt (sent inside runNoShowReport) IS the reply.
            return res.status(200).json({ received: true, processed: true, action: 'no_show_reported', via: 'prompt' });
          }
```

(The stub's `buildAttentionUpdate('no_show_reported')` is deliberately dropped: the open choice prompt now owns the next step, and its generic expiry ladder escalates silence. Attention flags return on choices 2/3 — Task 10.)

- [ ] **Step 4: Rules.** In `firestore.rules`, handymen update deny list (:282-288), extend the array:

```
        'verified', 'status', 'stripeConnectedAccountId', 'stripeOnboardingCompleted',
        'stripeAccountStatus', 'stripeDetailsSubmitted', 'stripeChargesEnabled',
        'stripePayoutsEnabled', 'cancellationCount', 'noShowCount'
```

(`cancellationCount` closes a pre-existing self-reset hole the explorer found; `noShowCount` would inherit it otherwise.) Verify: `firebase deploy --only firestore:rules --dry-run` → compiles.

- [ ] **Step 5: Verify + commit**

Run: `cd functions && node --check index.js && npm test` — clean, green.

```bash
git add functions/index.js firestore.rules
git commit -m "feat(no-show): runNoShowReport + choice prompt replaces stub; counter rules hardened"
```

---

### Task 9: Free-text no-show intent (legacy path)

**Files:**
- Modify: `functions/index.js` — legacy no-prompt path, BEFORE the `isConfirm`/`isReject` regexes at :3453 (critical: "NO SHOW" matches `\bNO\b`, so a later placement would be shadowed)

**Interfaces:**
- Consumes: `runNoShowReport` (Task 8), the path's existing `phoneFormats` fan (:3470-3474 — hoist or duplicate the small array construction as needed; read the surrounding code first), `forwardUnmatchedInbound` (:3817).
- Produces: free-text reports route to the same flow as the poll entry.

- [ ] **Step 1: Implement.** Insert after `messageText` is derived and before :3453:

```js
      // ── Scenario 7: free-text no-show intent ("no show", "never came",
      // "didn't come"). MUST run before the YES/NO regexes — "NO SHOW"
      // contains \bNO\b and would otherwise be misread as a completion
      // rejection.
      const NO_SHOW_INTENT_RE = /\b(no[\s-]?show|never (came|showed|arrived|turned up)|did\s?n[o']?t (come|show|arrive|turn up)|nobody (came|arrived|showed))\b/i;
      if (NO_SHOW_INTENT_RE.test(Body)) {
        const todaySgt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
        // in_progress jobs by phone: the customerPhone+createdAt index with
        // an in-memory status filter (same trick as forwardUnmatchedInbound)
        // — no new composite index needed.
        const noShowCandidates = [];
        const phoneFormatsNS = [customerPhone, `+${customerPhone}`, customerPhone.startsWith('65') ? customerPhone.substring(2) : customerPhone];
        for (const pf of phoneFormatsNS) {
          const snap = await admin.firestore().collection('jobs')
            .where('customerPhone', '==', pf)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
          for (const doc of snap.docs) {
            const j = doc.data();
            if (['in_progress', 'pending_confirmation'].includes(j.status)
                && j.preferredDate && j.preferredDate <= todaySgt
                && !noShowCandidates.some((c) => c.id === doc.id)) {
              noShowCandidates.push({ id: doc.id, data: j });
            }
          }
        }
        if (noShowCandidates.length > 0) {
          // Most recent eligible job. Multi-job customers are rare; the ack
          // names the job id so a mismatch is immediately visible, and the
          // admin email (inside runNoShowReport) carries the full context.
          const target = noShowCandidates[0];
          const result = await runNoShowReport({ db: admin.firestore(), jobId: target.id, via: 'freetext', promptId: null });
          if (result.reported) {
            return res.status(200).json({ received: true, processed: true, action: 'no_show_reported', via: 'freetext' });
          }
        }
        // Intent matched but no eligible job → F3 with the raw message.
        await forwardUnmatchedInbound({ from: From, body: Body, mediaUrls, reason: 'no_open_prompt' });
        return res.status(200).json({ received: true, processed: false, reason: 'no-show intent, no eligible job — forwarded' });
      }
```

NOTE to implementer: check what the local customer-phone variable is actually called at this point in the path (`customerPhone` per explorer at :3470; confirm) and whether `messageText`/`Body` casing matters (the regex is case-insensitive against the raw `Body`).

- [ ] **Step 2: Verify + commit**

Run: `cd functions && node --check index.js && npm test` — clean, green.

```bash
git add functions/index.js
git commit -m "feat(no-show): free-text intent detection ahead of legacy YES/NO regexes"
```

---

### Task 10: `no_show_choice` webhook branch

**Files:**
- Modify: `functions/index.js` — new branch after `price_adjustment_choice` (Task 4's), before `schedule_approval`

**Interfaces:**
- Consumes: `issueScheduleLink` (`scheduleLinkService.js:74`, `{db, jobId, customerPhone, createdBy}` → `{token}`), `buildAttentionUpdate`, `APP_URL`; the access_issue_choice reschedule arm (~:2993-3010) is the structural model — clone its link-issue try/catch shape exactly.
- Produces: the three arms per spec — reschedule → F6 link; new_handyman → attention `no_show_new_handyman`; cancel_refund → attention `no_show_refund_requested`.

- [ ] **Step 1: Implement**

```js
        if (verdict.prompt.type === 'no_show_choice') {
          const jobShortId = verdict.prompt.jobId.slice(-6);
          if (verdict.action === 'reschedule') {
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'link_sent' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            try {
              const { token } = await issueScheduleLink({
                db: admin.firestore(), jobId: verdict.prompt.jobId,
                customerPhone: verdict.prompt.toPhone, createdBy: 'system_no_show',
              });
              await sendTwilioMessage(From, `👍 Let's find a new time — pick one that works for you here (valid 72 hours):\n${APP_URL}/pick-time?t=${token}\n\nYour handyman will confirm the time you choose (Job #${jobShortId}).`);
            } catch (linkErr) {
              console.error('⚠️ no-show reschedule link failed:', linkErr);
              await sendTwilioMessage(From, `👍 Our team will arrange a new time with you shortly (Job #${jobShortId}).`);
              await sendAdminEmail(`⚠️ No-show reschedule link failed — Job #${jobShortId}`, `<p>Send a schedule link manually for job <b>${escapeHtml(verdict.prompt.jobId)}</b>.</p>`);
            }
            return res.status(200).json({ received: true, processed: true, action: 'no_show_reschedule_link', via: 'prompt' });
          }
          if (verdict.action === 'new_handyman') {
            // Spec §6.4 (resolved): one WhatsApp reply never strips a job —
            // the admin confirms via the existing force-unassign queue action.
            const nowIso = new Date().toISOString();
            try {
              await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).update(
                buildAttentionUpdate('no_show_new_handyman', { detail: 'customer requested a replacement after a no-show — confirm force-unassign', promptId: verdict.prompt.id, nowIso })
              );
            } catch (e) { console.error('⚠️ attention flag failed (admin email still goes out):', e); }
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'new_handyman_requested' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await sendAdminEmail(`🔁 No-show → new handyman requested — Job #${jobShortId}`,
              `<p>Customer wants a replacement on job <b>${escapeHtml(verdict.prompt.jobId)}</b>. Use the queue's force-unassign to confirm — the job then re-releases to the board.</p>`);
            await sendTwilioMessage(From, `👍 Understood — we're finding you a new handyman for Job #${jobShortId}. Our team will confirm shortly and the new handyman will arrange the visit time with you.`);
            return res.status(200).json({ received: true, processed: true, action: 'no_show_new_handyman', via: 'prompt' });
          }
          if (verdict.action === 'cancel_refund') {
            // Scenario 9 is deferred-manual: flag the queue; the admin
            // executes via the existing Refund button.
            const nowIso = new Date().toISOString();
            try {
              await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).update(
                buildAttentionUpdate('no_show_refund_requested', { detail: 'customer chose cancel & refund after a no-show — execute via the queue Refund button', promptId: verdict.prompt.id, nowIso })
              );
            } catch (e) { console.error('⚠️ attention flag failed (admin email still goes out):', e); }
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'refund_requested' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await sendAdminEmail(`💸 No-show → refund requested — Job #${jobShortId}`,
              `<p>Customer chose cancel &amp; refund on job <b>${escapeHtml(verdict.prompt.jobId)}</b>. Execute via the attention queue's Refund button (refund-then-cancel).</p>`);
            await sendTwilioMessage(From, `👍 Understood — our team will process your refund for Job #${jobShortId} shortly. You'll get a confirmation once it's done (refunds take 5–10 business days to reach your card).`);
            return res.status(200).json({ received: true, processed: true, action: 'no_show_refund_requested', via: 'prompt' });
          }
        }
```

- [ ] **Step 2: Verify + commit**

Run: `cd functions && node --check index.js && npm test` — clean, green.

```bash
git add functions/index.js
git commit -m "feat(no-show): choice branch — F6 reschedule, admin-confirmed swap, manual-refund routing"
```

---

### Task 11: Docs, templates, env, spec, E2E

**Files:**
- Modify: `WHATSAPP_TEMPLATES.md`, `.env.local.example`, `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md`, `docs/features/e2e-test-plan-job-lifecycle.md`, `docs/setup/scenario-11-8-twilio-templates.md` (or a sibling runbook)

- [ ] **Step 1: WHATSAPP_TEMPLATES.md.** Verify every template's `contentVariables` against the code you shipped (grep the send sites) — the doc records code-as-shipped:
  - **T6 `no_show_choice`**: rewrite to 2 vars `{{1}}` job short id · `{{2}}` display date, body = Task 8's freeform fallback converted; note buttons exceed the 3-button quick-reply cap is FALSE here (exactly 3: Reschedule / New handyman / Cancel & refund) — keep 3 quick replies matching `NO_SHOW_CHOICE_OPTIONS` keys, and add the ⚠️ corrected-from-4-var note.
  - **T7 `no_show_reported`**: 2 vars (job short id, display date), body = Task 8's fallback; ⚠️ corrected note (handyman name var dropped).
  - **T12 `price_adjustment_approval`** → rename heading to `price_adjustment` and rewrite for approve-by-paying: 4 vars `{{1}}` total amount · `{{2}}` reason · `{{3}}` job short id · `{{4}}` checkout URL; ONE quick reply (**Decline**); note the URL-ending caveat + CTA-button escape hatch (same as T17/T18).
  - Add **T20 `price_adjustment_paid`**: 2 vars (amount, job short id), used for both parties, bodies = Task 3's fallbacks.
  - Update the footer status line.
- [ ] **Step 2: `.env.local.example`** — add with placeholder SIDs + the freeform-fallback comment: `TWILIO_TEMPLATE_PRICE_ADJUSTMENT`, `TWILIO_TEMPLATE_ADJUSTMENT_PAID`, `TWILIO_TEMPLATE_NO_SHOW_CHOICE`, `TWILIO_TEMPLATE_NO_SHOW_REPORTED`. (Check `git diff .env.local.example` FIRST for iCloud drift; discard any stale revert before editing, as happened on 2026-07-30.)
- [ ] **Step 3: Spec updates** (`2026-07-12-job-lifecycle-scenarios-design.md`):
  - Scenario 10 data-model wording: `priceAdjustments[]` → `priceAdjustment` (singular object; matches the pre-provisioned rules deny-lists) — one-line note "(plan 2026-07-30: singular, one adjustment at a time in v1)".
  - Catalog rows 7 and 10 → `✅ DONE <date> (plan 2026-07-30-no-show-and-price-adjustment.md)`.
  - §7 build order: stage 5 row → Scenario 7 done (5 still open); stage 6 row → Scenario 10 done (stage complete).
- [ ] **Step 4: E2E checklist** — append to `docs/features/e2e-test-plan-job-lifecycle.md`:

```markdown
## No-show + price adjustment (plan 2026-07-30)
- [ ] Adjustment happy path: handyman requests +$X (within cap) → customer gets WA with Checkout link → pays → job estimatedBudget += X, priceAdjustment.status='paid', both parties confirmed, prompt superseded
- [ ] Cap enforced: request putting total above priceMax → 400 over_cap with the cap named
- [ ] Second request blocked while one is pending (409) and after one is paid (409)
- [ ] Decline: customer replies NO → adjustment 'declined', session no longer payable, handyman notified
- [ ] Session expiry: no action 24h → fresh link re-sent once; second 24h → adjustment 'expired', handyman told to proceed/cancel, attention flag
- [ ] Gates: pending adjustment blocks Mark Complete (app), auto-poll skips, evening disposition skips; all release after paid/declined/expired
- [ ] Cancel with pending adjustment → adjustment 'cancelled_assignment', session dead, next handyman unwedged
- [ ] Release with paid adjustment → TWO transfers (original + delta), priceAdjustment 'released' + transferId, breakdown shows delta columns
- [ ] Admin full refund on a job with a paid delta → BOTH charges refunded (cascade); delta-only refund via refundPayment(deltaPI) touches only the adjustment
- [ ] Stripe events: delta PI succeeded does NOT rewrite job paymentStatus; delta charge.refunded does NOT mark the job refunded
- [ ] No-show via poll: NO → follow-up 2 → report recorded, noShowCount+1, handyman notified, customer gets 3-way choice
- [ ] No-show via free text ("he never came") on/after visit date → same flow; "no show" NOT misread as a completion NO
- [ ] Choice 1 → pick-time link → handyman approves pick (Scenario 3 rails)
- [ ] Choice 2 → attention 'no_show_new_handyman' → admin force-unassign re-releases
- [ ] Choice 3 → attention 'no_show_refund_requested' → admin Refund button works
- [ ] Handyman cannot write his own noShowCount/cancellationCount (rules)
- [ ] Choice prompt ignored 48h → nudge → admin queue (generic ladder)
```

- [ ] **Step 5: Twilio runbook** — append a "Scenario 7 + 10" section to `docs/setup/scenario-11-8-twilio-templates.md` (or create `docs/setup/scenario-7-10-twilio-templates.md` following its exact format) covering the 4 new templates with bodies/vars/buttons/env names from Steps 1-2. **Owner gate reminder block**: subscribe `checkout.session.completed` + `checkout.session.expired` on BOTH Stripe webhook endpoints (same console step as the capture events), set the 4 template env vars, deploy functions + rules together.

- [ ] **Step 6: Commit**

```bash
git add WHATSAPP_TEMPLATES.md .env.local.example docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md docs/features/e2e-test-plan-job-lifecycle.md docs/setup/
git commit -m "docs: templates, env, spec status, E2E checklist for no-show + price adjustment"
```

---

## Owner gates before go-live (not code tasks)

1. **Stripe Dashboard:** subscribe `checkout.session.completed` and `checkout.session.expired` on BOTH webhook endpoints (the same place `payment_intent.amount_capturable_updated` was added).
2. Submit Meta templates: `price_adjustment` (4 vars + Decline button), `price_adjustment_paid`, `no_show_choice` (3 buttons), `no_show_reported`; set the 4 env vars per environment. Freeform fallback covers the gap.
3. Deploy functions + rules together.
4. Run the new E2E section (Task 11 Step 4) on the test project with Stripe test mode.
