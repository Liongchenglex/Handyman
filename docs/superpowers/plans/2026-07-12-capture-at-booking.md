# Capture Escrow at Booking (Scenario 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the customer's payment into the platform Stripe balance at booking time (instead of at admin fund release), eliminating the ~7-day authorization-expiry loss and making the `paymentStatus: 'succeeded'` fan-out trigger fire at booking as designed.

**Architecture:** The card is still authorized with `capture_method: 'manual'` by the existing `createPaymentIntent`; the change is a new `payment_intent.amount_capturable_updated` case in the existing `stripeWebhook` that captures the PaymentIntent server-side as soon as the customer's card confirmation lands. The capture emits `payment_intent.succeeded`, whose existing handler already sets `paymentStatus: 'succeeded'` (single writer preserved) and thereby fires `onJobPaymentSucceeded`. A small pure helper module owns the "should we capture this PI?" decision so it is unit-testable.

**Tech Stack:** Firebase Cloud Functions (Node 20, plain JS), Stripe REST via the `stripe` v11 SDK already initialized in `functions/index.js`, Jest (already set up in `functions/`).

**Spec:** `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` §4 Scenario 0. Branch: `feature/job-lifecycle-flows` (already checked out).

## Global Constraints

- No change to `createPaymentIntent` (manual capture + `pi-create-${jobId}` idempotency stays), no change to the `payment_intent.succeeded` handler, no change to `releaseEscrowSimple` — its `requires_capture` branch remains as a legacy safety net for pre-deploy jobs.
- Capture idempotency key: exactly `capture-${paymentIntent.id}`.
- `paymentStatus` is NOT written by the new webhook case — the `payment_intent.succeeded` event remains the single writer.
- Capture failures must not 500 the webhook (Stripe retry would fail identically); mark the job (`captureError`, `captureFailedAt`) and log instead.
- Only PaymentIntents carrying `metadata.jobId` are captured (protects unrelated PIs on a shared Stripe account).
- ANTI-iCLOUD PROTOCOL (mandatory for every commit in this repo): stage only the named files, read `git diff --staged` hunk-by-hunk before committing, re-grep a distinctive string after committing.
- Verification commands: `cd functions && node --check index.js && npx jest` (frontend untouched; no build needed).

---

### Task 1: Capture-decision helper module

**Files:**
- Create: `functions/paymentCapture.js`
- Test: `functions/__tests__/paymentCapture.test.js`

**Interfaces:**
- Produces: `assessCaptureability(paymentIntent)` → `{ shouldCapture: boolean, reason: 'capture' | 'no_intent' | 'wrong_status' | 'no_job_id' | 'nothing_capturable' }`. Task 2 consumes it.

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/paymentCapture.test.js`:

```js
const { assessCaptureability } = require('../paymentCapture');

const capturablePI = () => ({
  id: 'pi_123',
  status: 'requires_capture',
  amount_capturable: 12000,
  metadata: { jobId: 'job_abc', platform: 'handyman-platform' },
});

describe('assessCaptureability', () => {
  test('captures a requires_capture PI with a jobId and capturable amount', () => {
    expect(assessCaptureability(capturablePI()))
      .toEqual({ shouldCapture: true, reason: 'capture' });
  });

  test('rejects a missing/null intent', () => {
    expect(assessCaptureability(null))
      .toEqual({ shouldCapture: false, reason: 'no_intent' });
  });

  test('rejects statuses other than requires_capture (already captured, canceled, ...)', () => {
    for (const status of ['succeeded', 'canceled', 'processing', 'requires_payment_method']) {
      expect(assessCaptureability({ ...capturablePI(), status }))
        .toEqual({ shouldCapture: false, reason: 'wrong_status' });
    }
  });

  test('rejects a PI without our jobId metadata (unrelated product on the account)', () => {
    expect(assessCaptureability({ ...capturablePI(), metadata: {} }))
      .toEqual({ shouldCapture: false, reason: 'no_job_id' });
    expect(assessCaptureability({ ...capturablePI(), metadata: undefined }))
      .toEqual({ shouldCapture: false, reason: 'no_job_id' });
  });

  test('rejects a PI with nothing capturable', () => {
    expect(assessCaptureability({ ...capturablePI(), amount_capturable: 0 }))
      .toEqual({ shouldCapture: false, reason: 'nothing_capturable' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest __tests__/paymentCapture.test.js`
Expected: FAIL — `Cannot find module '../paymentCapture'`

- [ ] **Step 3: Implement the module**

Create `functions/paymentCapture.js`:

```js
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

module.exports = { assessCaptureability };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest __tests__/paymentCapture.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit (anti-iCloud protocol)**

```bash
git add functions/paymentCapture.js functions/__tests__/paymentCapture.test.js
git diff --staged   # read every hunk — must be exactly the two new files
git commit -m "feat(payments): add booking-time capture decision helper"
grep -c "assessCaptureability" functions/paymentCapture.js   # expect ≥ 2
```

---

### Task 2: Webhook case — capture on `amount_capturable_updated`

**Files:**
- Modify: `functions/index.js` — (a) one require near the other local requires (search for `require('./jobReassignment')`), (b) one new `case` in the `stripeWebhook` switch, inserted immediately BEFORE `case 'payment_intent.succeeded':` (at ~line 2049; locate by content).

**Interfaces:**
- Consumes: `assessCaptureability` (Task 1); existing `stripe` client and `admin` from index.js.
- Produces: booking-time capture behavior; no new exports.

- [ ] **Step 1: Add the require**

Next to the existing `require('./jobReassignment')` line at the top of `functions/index.js`, add:

```js
const { assessCaptureability } = require('./paymentCapture');
```

- [ ] **Step 2: Add the webhook case**

Inside the `switch (event.type)` in `stripeWebhook`, immediately before `case 'payment_intent.succeeded': {`, insert:

```js
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
          console.log(`ℹ️ Skipping booking-time capture for ${capturablePI?.id}: ${verdict.reason}`);
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
```

- [ ] **Step 3: Verify bundle and full suite**

Run: `cd functions && node --check index.js && npx jest`
Expected: clean parse; all suites green (19 tests: 10 reassignment + 4 notifier + 5 capture).

- [ ] **Step 4: Commit (anti-iCloud protocol)**

```bash
git add functions/index.js
git diff --staged   # read every hunk — must be exactly the require + the new case
git commit -m "feat(payments): capture escrow at booking via amount_capturable_updated webhook"
grep -c "amount_capturable_updated" functions/index.js   # expect ≥ 1 after commit
```

---

### Task 3: Deployment/ops checklist (owner-run; document-only for the implementer)

No code. These steps gate the deploy and are executed by the owner:

- [ ] **Stripe Dashboard (BOTH dev and prod webhook endpoints):** add `payment_intent.amount_capturable_updated` to the endpoint's subscribed events (Developers → Webhooks → the `stripeWebhook` endpoint → "Listen to" events). Without this the new case never receives the event and behavior silently stays as today.
- [ ] Deploy functions to the dev project.
- [ ] **E2E in Stripe test mode:** book + pay a job with a test card, then verify — (1) Stripe Dashboard shows the PaymentIntent as `Succeeded` (captured) within seconds of payment, not `Uncaptured`; (2) the job's `paymentStatus` in Firestore flips to `'succeeded'`; (3) `jobs/{jobId}/notifications/*` fan-out markers appear and eligible handymen receive the WhatsApp fan-out (this simultaneously verifies the fan-out-never-fired suspicion); (4) admin fund release still works (release path now skips its `requires_capture` branch — transfer only); (5) admin refund of a captured-but-unreleased job returns the money to the test card.
- [ ] Watch Cloud Logging for `Skipping booking-time capture` / `capture failed` lines during the first days.

## Self-review notes (applied)

- Spec §4.0 requirements → Task 1 (guarded decision), Task 2 (webhook capture, idempotency key `capture-${paymentIntent.id}`, no paymentStatus write, no-500 failure marking), Task 3 (Stripe event subscription + E2E incl. fan-out verification). `releaseEscrowSimple` untouched per spec ("legacy safety net").
- Names consistent: `assessCaptureability`, reasons enum, `capturablePI`/`captureJobId` (chosen to avoid shadowing `paymentIntent`/`jobId` declared in the adjacent `payment_intent.succeeded` case — the switch shares one scope).
- No placeholders; all code complete.
