# Job Reassignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an assigned handyman cancel a job (with reason), return it to the board with re-notification excluding previous cancellers, and give the admin full reassignment visibility before fund release — which always pays the current handyman.

**Architecture:** A new DI-style domain module `functions/jobReassignment.js` owns cancel validation and the Firestore update payload; a new `cancelJobAssignment` HTTPS Cloud Function wires it to auth/rate-limit/WhatsApp/fan-out. `handymanNotifier.js` gains round-scoped idempotency markers and an exclusion list. Frontend adds a cancel modal on the handyman job surfaces, a date-needed default sort on the job board, and reassignment history on the admin fund-release page.

**Tech Stack:** Firebase Cloud Functions (Node 20, plain JS), Firestore, Twilio REST via existing helpers, React 18 (CRA) + Tailwind, Jest (new in `functions/`, built into CRA for `src/`).

**Spec:** `docs/superpowers/specs/2026-07-10-job-reassignment-design.md` — read it first.

## Global Constraints

- Branch: `feature/job-reassignment` (already exists, rebased on master which includes `handymanNotifier.js`).
- Cancel allowed only when: caller is the assigned handyman, `status === 'in_progress'`, `completionPollSentAt` is not set.
- Cancel reasons (exact keys): `schedule_conflict`, `job_bigger_than_expected`, `location_too_far`, `personal_emergency`, `other` (note required for `other`).
- Rate limit: 5 cancels per handyman per rolling hour (`checkRateLimit(key, 5, 3600)`).
- `paymentStatus` is NEVER touched by cancel — escrow stays held.
- Marker doc IDs: round 0 = `{handymanId}` (backward compatible), round N>0 = `{handymanId}_r{N}`.
- All new job fields (`assignmentHistory`, `previousHandymanIds`, `reassignmentCount`, `cancelledLastBy`, `lastCancelledAt`) are server-written only.
- Testing strategy: TDD with Jest for pure/domain logic (functions modules, board comparator). UI wiring and the HTTPS endpoint are verified via the documented manual steps (this codebase has no UI test harness; do not introduce one in this feature).
- Cloud Functions gotcha: perform ALL side effects (WhatsApp, fan-out, audit) awaited BEFORE sending the HTTP response — background work after `res.json()` may be killed.
- Follow existing code style: heavy explanatory comments, emoji log prefixes, `console.log/warn/error`.

---

### Task 1: Functions test infrastructure + cancel domain module

**Files:**
- Modify: `functions/package.json` (add jest devDependency + test script)
- Create: `functions/jobReassignment.js`
- Test: `functions/__tests__/jobReassignment.test.js`

**Interfaces:**
- Produces: `CANCEL_REASONS` (frozen array of the 5 reason keys), `CancelError` (Error subclass with `.code`), `validateCancelRequest(job, callerUid, reason, note)` (throws `CancelError`, returns undefined), `buildCancelUpdate(job, callerUid, { reason, note, nowIso })` (returns the Firestore update object). Task 3 consumes all of these.

- [ ] **Step 1: Add jest to functions/package.json**

In `functions/package.json`, add to `"scripts"`:

```json
"test": "jest"
```

and add to `"devDependencies"`:

```json
"jest": "^29.7.0"
```

Run: `cd functions && npm install`
Expected: jest installs without errors.

- [ ] **Step 2: Write the failing tests**

Create `functions/__tests__/jobReassignment.test.js`:

```js
const {
  CANCEL_REASONS,
  CancelError,
  validateCancelRequest,
  buildCancelUpdate,
} = require('../jobReassignment');

const baseJob = () => ({
  handymanId: 'hm_1',
  status: 'in_progress',
  customerId: 'cust_1',
  customerPhone: '+6591234567',
  serviceType: 'Plumbing',
  acceptedAt: '2026-07-01T02:00:00.000Z',
  acceptedBy: { uid: 'hm_1', name: 'Ah Seng', email: 'seng@x.com' },
});

describe('validateCancelRequest', () => {
  test('accepts a valid cancel', () => {
    expect(() =>
      validateCancelRequest(baseJob(), 'hm_1', 'schedule_conflict', ''),
    ).not.toThrow();
  });

  test('rejects missing job', () => {
    expect(() => validateCancelRequest(null, 'hm_1', 'other', 'x'))
      .toThrow(CancelError);
    try { validateCancelRequest(null, 'hm_1', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('not_found');
    }
  });

  test('rejects caller who is not the assigned handyman', () => {
    try { validateCancelRequest(baseJob(), 'hm_2', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('not_assigned');
    }
    expect.assertions(1);
  });

  test('rejects when status is not in_progress', () => {
    const job = { ...baseJob(), status: 'pending_confirmation' };
    try { validateCancelRequest(job, 'hm_1', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('wrong_status');
    }
    expect.assertions(1);
  });

  test('rejects after completion poll was sent', () => {
    const job = { ...baseJob(), completionPollSentAt: '2026-07-09T01:00:00.000Z' };
    try { validateCancelRequest(job, 'hm_1', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('completion_poll_sent');
    }
    expect.assertions(1);
  });

  test('rejects unknown reason', () => {
    try { validateCancelRequest(baseJob(), 'hm_1', 'because', ''); } catch (e) {
      expect(e.code).toBe('bad_reason');
    }
    expect.assertions(1);
  });

  test("rejects reason 'other' without a note", () => {
    try { validateCancelRequest(baseJob(), 'hm_1', 'other', '  '); } catch (e) {
      expect(e.code).toBe('note_required');
    }
    expect.assertions(1);
  });
});

describe('buildCancelUpdate', () => {
  const NOW = '2026-07-10T05:00:00.000Z';

  test('appends a closed history entry and resets the job', () => {
    const update = buildCancelUpdate(baseJob(), 'hm_1', {
      reason: 'location_too_far', note: '', nowIso: NOW,
    });

    expect(update.status).toBe('pending');
    expect(update.handymanId).toBeNull();
    expect(update.reassignmentCount).toBe(1);
    expect(update.previousHandymanIds).toEqual(['hm_1']);
    expect(update.cancelledLastBy).toBe('hm_1');
    expect(update.lastCancelledAt).toBe(NOW);
    expect(update.assignmentHistory).toEqual([{
      handymanId: 'hm_1',
      handymanName: 'Ah Seng',
      assignedAt: '2026-07-01T02:00:00.000Z',
      endedAt: NOW,
      endReason: 'cancelled',
      cancelReason: 'location_too_far',
      cancelNote: null,
    }]);
    // Accept-flow fields are cleared with Firestore delete sentinels.
    expect(update.acceptedAt).toBeDefined();
    expect(update.acceptedBy).toBeDefined();
    expect(update.completionPollSentAt).toBeDefined();
    expect(update.completionPollSentBy).toBeDefined();
    // paymentStatus must never appear in the update.
    expect(update).not.toHaveProperty('paymentStatus');
  });

  test('second cancel round appends, dedupes previousHandymanIds, bumps count', () => {
    const job = {
      ...baseJob(),
      handymanId: 'hm_2',
      acceptedBy: { uid: 'hm_2', name: 'Bala' },
      acceptedAt: '2026-07-05T02:00:00.000Z',
      reassignmentCount: 1,
      previousHandymanIds: ['hm_1'],
      assignmentHistory: [{
        handymanId: 'hm_1', handymanName: 'Ah Seng',
        assignedAt: '2026-07-01T02:00:00.000Z', endedAt: '2026-07-04T02:00:00.000Z',
        endReason: 'cancelled', cancelReason: 'schedule_conflict', cancelNote: null,
      }],
    };
    const update = buildCancelUpdate(job, 'hm_2', {
      reason: 'other', note: 'Customer address is a construction site', nowIso: NOW,
    });

    expect(update.reassignmentCount).toBe(2);
    expect(update.previousHandymanIds).toEqual(['hm_1', 'hm_2']);
    expect(update.assignmentHistory).toHaveLength(2);
    expect(update.assignmentHistory[1].cancelNote)
      .toBe('Customer address is a construction site');
  });

  test('truncates the note to 500 chars', () => {
    const update = buildCancelUpdate(baseJob(), 'hm_1', {
      reason: 'other', note: 'x'.repeat(600), nowIso: NOW,
    });
    expect(update.assignmentHistory[0].cancelNote).toHaveLength(500);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd functions && npx jest __tests__/jobReassignment.test.js`
Expected: FAIL — `Cannot find module '../jobReassignment'`

- [ ] **Step 4: Implement the module**

Create `functions/jobReassignment.js`:

```js
/**
 * Job reassignment — cancel-side domain logic.
 *
 * Pure validation + update-payload construction for a handyman
 * cancelling their assignment. The HTTPS endpoint in functions/index.js
 * is a thin wrapper: it authenticates, rate-limits, runs the Firestore
 * transaction with these helpers, then fires side effects (customer
 * WhatsApp, fan-out re-notification, audit log).
 *
 * Kept separate from index.js so the state machine is unit-testable
 * without Firestore. See docs/superpowers/specs/2026-07-10-job-reassignment-design.md.
 */

const admin = require('firebase-admin');

// Reason picklist shown in the handyman cancel modal. Keys are stored on
// the assignment history entry; the frontend owns the display labels.
const CANCEL_REASONS = Object.freeze([
  'schedule_conflict',
  'job_bigger_than_expected',
  'location_too_far',
  'personal_emergency',
  'other',
]);

/**
 * Typed error so the endpoint can map validation failures to precise
 * HTTP statuses and the frontend can show actionable messages.
 */
class CancelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CancelError';
    this.code = code;
  }
}

/**
 * Throws CancelError unless `callerUid` may cancel `job` right now.
 *
 * The cancel window (spec §5): assigned handyman, job still
 * 'in_progress', completion poll not yet sent. Once the poll is out the
 * customer has been asked to confirm — bailing at that point must go
 * through support, not self-service.
 */
function validateCancelRequest(job, callerUid, reason, note) {
  if (!job) {
    throw new CancelError('not_found', 'Job not found');
  }
  if (job.handymanId !== callerUid) {
    throw new CancelError('not_assigned', 'You are not the assigned handyman for this job');
  }
  if (job.status !== 'in_progress') {
    throw new CancelError('wrong_status', `This job can no longer be cancelled (status: ${job.status})`);
  }
  if (job.completionPollSentAt) {
    throw new CancelError('completion_poll_sent', 'The customer has already been asked to confirm completion — contact support to make changes');
  }
  if (!CANCEL_REASONS.includes(reason)) {
    throw new CancelError('bad_reason', 'Please pick a cancellation reason');
  }
  if (reason === 'other' && !(note && String(note).trim())) {
    throw new CancelError('note_required', "Please describe why you're cancelling");
  }
}

/**
 * Build the Firestore update that cancels the current assignment and
 * puts the job back on the board.
 *
 * - History entry is created lazily here from acceptedBy/acceptedAt
 *   (the accept flow is untouched by this feature).
 * - paymentStatus is deliberately absent: escrow stays held.
 * - Accept-flow fields are cleared with FieldValue.delete() so a
 *   re-claiming handyman starts from a clean slate.
 */
function buildCancelUpdate(job, callerUid, { reason, note, nowIso }) {
  const history = Array.isArray(job.assignmentHistory) ? [...job.assignmentHistory] : [];
  const trimmedNote = String(note || '').trim().slice(0, 500);
  history.push({
    handymanId: callerUid,
    handymanName: (job.acceptedBy && job.acceptedBy.name) || null,
    assignedAt: job.acceptedAt || null,
    endedAt: nowIso,
    endReason: 'cancelled',
    cancelReason: reason,
    cancelNote: trimmedNote || null,
  });

  const prev = Array.isArray(job.previousHandymanIds) ? job.previousHandymanIds : [];

  return {
    assignmentHistory: history,
    previousHandymanIds: prev.includes(callerUid) ? prev : [...prev, callerUid],
    reassignmentCount: (job.reassignmentCount || 0) + 1,
    status: 'pending',
    handymanId: null,
    acceptedAt: admin.firestore.FieldValue.delete(),
    acceptedBy: admin.firestore.FieldValue.delete(),
    completionPollSentAt: admin.firestore.FieldValue.delete(),
    completionPollSentBy: admin.firestore.FieldValue.delete(),
    cancelledLastBy: callerUid,
    lastCancelledAt: nowIso,
  };
}

module.exports = {
  CANCEL_REASONS,
  CancelError,
  validateCancelRequest,
  buildCancelUpdate,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd functions && npx jest __tests__/jobReassignment.test.js`
Expected: PASS (11 tests)

- [ ] **Step 6: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/jobReassignment.js functions/__tests__/jobReassignment.test.js
git commit -m "feat(reassignment): add cancel domain module with jest infra"
```

---

### Task 2: Round-scoped markers + exclusions in the fan-out notifier

**Files:**
- Modify: `functions/handymanNotifier.js`
- Test: `functions/__tests__/handymanNotifier.test.js` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `notificationMarkerId(handymanId, round)` → string; `pickEligibleHandymen(job, db, cap, excludeIds = [])`; `sendJobNotification({ ..., round = 0 })`; `runFanOut({ ..., round = 0, excludeIds = [] })`. Task 3 calls `runFanOut` with `round` and `excludeIds`. The existing caller `onJobPaymentSucceeded` in index.js passes neither (defaults keep round-0 behavior bit-identical).

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/handymanNotifier.test.js`:

```js
const {
  notificationMarkerId,
  pickEligibleHandymen,
} = require('../handymanNotifier');

/**
 * Minimal chainable fake for db.collection('handymen').where(...).limit(n).get().
 * Returns the provided docs regardless of filters — we're testing the JS
 * post-filtering (opt-out + exclusions), not Firestore's query engine.
 */
function fakeDb(handymen) {
  const query = {
    where: () => query,
    limit: () => query,
    get: async () => ({
      docs: handymen.map((h) => ({ id: h.id, data: () => h })),
    }),
  };
  return { collection: () => query };
}

describe('notificationMarkerId', () => {
  test('round 0 keeps the bare handyman id (backward compatible)', () => {
    expect(notificationMarkerId('hm_1', 0)).toBe('hm_1');
    expect(notificationMarkerId('hm_1', undefined)).toBe('hm_1');
  });

  test('later rounds get a round suffix', () => {
    expect(notificationMarkerId('hm_1', 1)).toBe('hm_1_r1');
    expect(notificationMarkerId('hm_1', 3)).toBe('hm_1_r3');
  });
});

describe('pickEligibleHandymen exclusions', () => {
  const job = { serviceType: 'Plumbing' };
  const handymen = [
    { id: 'hm_1', phone: '+65...', notifyOnNewJob: true },
    { id: 'hm_2', phone: '+65...' },
    { id: 'hm_3', phone: '+65...', notifyOnNewJob: false },
  ];

  test('no exclusions: returns opted-in handymen', async () => {
    const picked = await pickEligibleHandymen(job, fakeDb(handymen), 20);
    expect(picked.map((h) => h.id)).toEqual(['hm_1', 'hm_2']);
  });

  test('excludeIds removes previous cancellers', async () => {
    const picked = await pickEligibleHandymen(job, fakeDb(handymen), 20, ['hm_1']);
    expect(picked.map((h) => h.id)).toEqual(['hm_2']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest __tests__/handymanNotifier.test.js`
Expected: FAIL — `notificationMarkerId` is not exported.

- [ ] **Step 3: Implement the notifier changes**

In `functions/handymanNotifier.js`:

(a) Add after the `NOTIFICATION_STATUS` block:

```js
/**
 * Marker doc ID for the (job, handyman, round) idempotency key.
 *
 * Round 0 stays the bare handyman id so markers written before the
 * reassignment feature shipped keep suppressing round-0 duplicates.
 * Each reassignment bumps the job's reassignmentCount, giving the next
 * fan-out a fresh namespace — round 1 sends are not suppressed by
 * round 0 markers, and every round's audit trail is preserved.
 */
function notificationMarkerId(handymanId, round) {
  return round ? `${handymanId}_r${round}` : handymanId;
}
```

(b) Change `pickEligibleHandymen` signature and final filter:

```js
async function pickEligibleHandymen(job, db, cap = NOTIFY_FANOUT_CAP, excludeIds = []) {
  const snapshot = await db.collection('handymen')
    .where('status', '==', 'active')
    .where('verified', '==', true)
    .where('stripeOnboardingCompleted', '==', true)
    .where('serviceTypes', 'array-contains', job.serviceType)
    .limit(cap)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((h) => h.notifyOnNewJob !== false)
    // Handymen who previously cancelled this job never get re-notified
    // about it (reassignment spec §6).
    .filter((h) => !excludeIds.includes(h.id));
}
```

(c) In `sendJobNotification`, add `round = 0` to the destructured params and change the marker ref line to:

```js
  const markerRef = db.collection('jobs').doc(jobId)
    .collection('notifications').doc(notificationMarkerId(handyman.id, round));
```

(d) In `runFanOut`, add `round = 0, excludeIds = []` to the destructured params, pass them through:

```js
  const handymen = await pickEligibleHandymen(job, db, NOTIFY_FANOUT_CAP, excludeIds);

  logger.log(`[handyman-notify] job=${jobId} category=${job.serviceType} round=${round} eligible=${handymen.length} excluded=${excludeIds.length} cap=${NOTIFY_FANOUT_CAP}`);
```

and inside the `Promise.all` map, pass `round` into `sendJobNotification({ job, jobId, handyman: h, db, sendTwilioTemplateMessage, checkRateLimit, round })`.

(e) Add `notificationMarkerId` to `module.exports`.

- [ ] **Step 4: Run the full functions test suite**

Run: `cd functions && npx jest`
Expected: PASS (both test files; Task 1 tests still green)

- [ ] **Step 5: Commit**

```bash
git add functions/handymanNotifier.js functions/__tests__/handymanNotifier.test.js
git commit -m "feat(reassignment): round-scoped notification markers and canceller exclusion"
```

---

### Task 3: `cancelJobAssignment` HTTPS endpoint

**Files:**
- Modify: `functions/index.js` (append near the other job endpoints, after `onJobPaymentSucceeded` at the file end)

**Interfaces:**
- Consumes: `validateCancelRequest`, `buildCancelUpdate`, `CancelError` (Task 1); `runFanOut` with `{ round, excludeIds }` (Task 2); existing helpers `verifyAuthToken`, `checkRateLimit`, `writeAuditLog`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`, `cors`.
- Produces: `POST /cancelJobAssignment` — body `{ jobId, reason, note? }`, Bearer ID token. 200 `{ success: true, jobId, reassignmentCount }`; errors 400/403/404/405/409/429 as mapped below. Task 6's frontend service consumes this contract.

- [ ] **Step 1: Add the require at the top of functions/index.js**

Next to the existing `runHandymanFanOut` require (search for `handymanNotifier`), add:

```js
const {
  validateCancelRequest,
  buildCancelUpdate,
  CancelError,
} = require('./jobReassignment');
```

(If the notifier is required as `const { runFanOut: runHandymanFanOut } = require('./handymanNotifier');` keep that name — the code below uses `runHandymanFanOut`.)

- [ ] **Step 2: Implement the endpoint**

Append to `functions/index.js`:

```js
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
```

- [ ] **Step 3: Verify the functions bundle loads and tests still pass**

Run: `cd functions && node -e "require('./jobReassignment'); console.log('modules OK')" && npx jest`
Expected: `modules OK`, all tests PASS.

- [ ] **Step 4: Manual smoke test against the emulator**

Run: `cd functions && npx firebase emulators:start --only functions,firestore` (in a second terminal). Then exercise the validation surface without auth:

Run: `curl -s -X POST http://localhost:5001/<projectId>/us-central1/cancelJobAssignment -H "Content-Type: application/json" -d '{"jobId":"x"}'`
Expected: `{"error":"Unauthorized: Missing authentication token"}` (verifies routing + CORS wrapper). Full authenticated-path verification happens in the Task 11 E2E checklist.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat(reassignment): add cancelJobAssignment endpoint with re-notification"
```

---

### Task 4: Firestore rules — block re-claim, protect reassignment fields

**Files:**
- Modify: `firestore.rules:61-79` (jobSystemFields) and `firestore.rules:134-144` (job update rule)

**Interfaces:**
- Produces: rule behavior consumed by Task 8's UI (the UI mirrors what the rules enforce).

- [ ] **Step 1: Add reassignment fields to jobSystemFields**

In the `jobSystemFields()` list (after `'refundedAmount'`), add:

```
        'refundedAmount',
        'assignmentHistory',
        'previousHandymanIds',
        'reassignmentCount',
        'cancelledLastBy',
        'lastCancelledAt'
```

Also update the comment above the function to mention that the reassignment audit fields are Cloud-Function-only for the same forgery reasons.

- [ ] **Step 2: Block previous cancellers from re-claiming**

Change the claim branch (currently line 141):

```
            (resource.data.handymanId == null && isHandyman() && request.resource.data.handymanId == request.auth.uid)
```

to:

```
            (
              resource.data.handymanId == null &&
              isHandyman() &&
              request.resource.data.handymanId == request.auth.uid &&
              // A handyman who cancelled this job cannot re-claim it
              // (reassignment spec §6). previousHandymanIds is written
              // only by cancelJobAssignment via the Admin SDK.
              !(request.auth.uid in resource.data.get('previousHandymanIds', []))
            )
```

- [ ] **Step 3: Verify rules compile**

Run: `npx firebase deploy --only firestore:rules --dry-run 2>&1 | tail -3` (or `npx firebase emulators:start --only firestore` and confirm clean startup, Ctrl+C).
Expected: rules compile with no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): protect reassignment fields and block canceller re-claim"
```

---

### Task 5: Date-needed board sort

**Files:**
- Modify: `src/utils/jobHelpers.js` (add comparator)
- Modify: `src/components/handyman/JobBoard.jsx:30,104-149`
- Test: `src/utils/jobHelpers.test.js` (new)

**Interfaces:**
- Produces: `compareByDateNeeded(a, b)` exported from `src/utils/jobHelpers.js`. JobBoard consumes it; nothing else does.

- [ ] **Step 1: Write the failing test**

Create `src/utils/jobHelpers.test.js`:

```js
import { compareByDateNeeded } from './jobHelpers';

const asap = (createdAt) => ({ preferredTiming: 'Immediate', createdAt });
const scheduled = (preferredDate) => ({ preferredTiming: 'Schedule', preferredDate, createdAt: '2026-07-01' });

describe('compareByDateNeeded', () => {
  test('ASAP jobs come before scheduled jobs', () => {
    const jobs = [scheduled('2026-07-12'), asap('2026-07-01')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredTiming).toBe('Immediate');
  });

  test('ASAP jobs order newest-posted first', () => {
    const jobs = [asap('2026-07-01T10:00:00Z'), asap('2026-07-02T10:00:00Z')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].createdAt).toBe('2026-07-02T10:00:00Z');
  });

  test('scheduled jobs order soonest date first', () => {
    const jobs = [scheduled('2026-07-20'), scheduled('2026-07-12')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredDate).toBe('2026-07-12');
  });

  test('scheduled job with missing date sinks to the end', () => {
    const jobs = [scheduled(undefined), scheduled('2026-07-30'), asap('2026-07-01')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredTiming).toBe('Immediate');
    expect(jobs[1].preferredDate).toBe('2026-07-30');
    expect(jobs[2].preferredDate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false jobHelpers`
Expected: FAIL — `compareByDateNeeded` is not exported.

- [ ] **Step 3: Implement the comparator**

Append to `src/utils/jobHelpers.js`:

```js
/**
 * Job board "Date Needed" comparator (default board sort).
 *
 * Ordering (reassignment spec §7):
 *   1. ASAP/Immediate jobs first, newest-posted first among them —
 *      anything that isn't explicitly scheduled counts as ASAP.
 *   2. Scheduled jobs by soonest preferredDate.
 *   3. Scheduled jobs missing a date sink to the very end (unknown
 *      urgency shouldn't outrank a known near date).
 */
export const compareByDateNeeded = (a, b) => {
  const isAsap = (job) => job.preferredTiming !== 'Schedule';

  if (isAsap(a) && isAsap(b)) {
    return new Date(b.createdAt || b.postedAt || 0) - new Date(a.createdAt || a.postedAt || 0);
  }
  if (isAsap(a)) return -1;
  if (isAsap(b)) return 1;

  const aTime = a.preferredDate ? new Date(a.preferredDate).getTime() : Infinity;
  const bTime = b.preferredDate ? new Date(b.preferredDate).getTime() : Infinity;
  return aTime - bTime;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false jobHelpers`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire into JobBoard**

In `src/components/handyman/JobBoard.jsx`:

(a) Import: add `compareByDateNeeded` to the existing `../../utils/jobHelpers` import (or add the import if JobBoard doesn't have one).

(b) Line 30 — default sort:

```js
    sortBy: 'date-needed'
```

(c) `sortOptions` (line 104) — new first entry:

```js
  const sortOptions = [
    { label: 'Date Needed', value: 'date-needed' },
    { label: 'Newest First', value: 'newest' },
    { label: 'Highest Budget', value: 'budget-high' },
    { label: 'Lowest Budget', value: 'budget-low' },
    { label: 'Urgent First', value: 'urgent' }
  ];
```

(d) Sort switch (line 138) — new case above `'budget-high'`:

```js
      case 'date-needed':
        return compareByDateNeeded(a, b);
```

(e) The filter-reset handler around line 348 sets `sortBy: 'newest'` — change it to `sortBy: 'date-needed'` so "reset" returns to the new default.

- [ ] **Step 6: Manual verification**

Run: `npm start`, sign in as a handyman, open the job board.
Expected: default dropdown shows "Date Needed"; ASAP jobs listed above scheduled ones; scheduled ones soonest-first.

- [ ] **Step 7: Commit**

```bash
git add src/utils/jobHelpers.js src/utils/jobHelpers.test.js src/components/handyman/JobBoard.jsx
git commit -m "feat(board): default date-needed sort, ASAP first"
```

---

### Task 6: Frontend cancel service + CancelJobModal

**Files:**
- Create: `src/services/api/jobAssignment.js`
- Create: `src/components/handyman/CancelJobModal.jsx`

**Interfaces:**
- Consumes: `POST /cancelJobAssignment` (Task 3 contract).
- Produces: `cancelJobAssignment(jobId, reason, note)` → `{ success, error?, code?, reassignmentCount? }`; `<CancelJobModal job isOpen onClose onCancelled />`. Task 7 consumes both.

- [ ] **Step 1: Implement the service**

Create `src/services/api/jobAssignment.js`:

```js
/**
 * Job assignment service — handyman-side cancel.
 *
 * Cancelling goes through the cancelJobAssignment Cloud Function (never
 * a direct Firestore write): the server owns the assignment-history
 * audit trail, the customer WhatsApp notice, and the re-notification
 * fan-out. See docs/superpowers/specs/2026-07-10-job-reassignment-design.md.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/**
 * Reason picklist — keys MUST match CANCEL_REASONS in
 * functions/jobReassignment.js; labels are display-only.
 */
export const CANCEL_REASON_OPTIONS = [
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'job_bigger_than_expected', label: 'Job is bigger than expected' },
  { value: 'location_too_far', label: 'Location is too far' },
  { value: 'personal_emergency', label: 'Personal emergency' },
  { value: 'other', label: 'Other (please describe)' },
];

/**
 * Cancel the current user's assignment on a job.
 *
 * @param {string} jobId
 * @param {string} reason - a CANCEL_REASON_OPTIONS value
 * @param {string} note - required when reason is 'other'
 * @returns {Promise<{success: boolean, error?: string, code?: string, reassignmentCount?: number}>}
 */
export const cancelJobAssignment = async (jobId, reason, note = '') => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/cancelJobAssignment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId, reason, note }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Cancellation failed', code: result.code };
    }
    return { success: true, reassignmentCount: result.reassignmentCount };
  } catch (error) {
    console.error('❌ Error cancelling job assignment:', error);
    return { success: false, error: error.message };
  }
};
```

- [ ] **Step 2: Implement the modal**

Create `src/components/handyman/CancelJobModal.jsx`:

```jsx
import React, { useState, useRef } from 'react';
import { cancelJobAssignment, CANCEL_REASON_OPTIONS } from '../../services/api/jobAssignment';

/**
 * CancelJobModal
 *
 * Shared cancel dialog used by JobActionButtons (job details) and
 * MyJobsView. Collects a mandatory reason (+ note when 'other'),
 * explains the consequence, and calls the cancelJobAssignment Cloud
 * Function. Mobile-first, mirrors the ConfirmationModal pattern in
 * ExpressInterestButton.jsx.
 *
 * Props:
 *   job         - the job object (needs .id, .serviceType)
 *   isOpen      - render toggle
 *   onClose     - called when the user backs out
 *   onCancelled - called after a successful cancel (navigate/refresh)
 */
const CancelJobModal = ({ job, isOpen, onClose, onCancelled }) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entrancy guard (same pattern as ExpressInterestButton).
  const submittingRef = useRef(false);

  if (!isOpen) return null;

  const noteRequired = reason === 'other';
  const canSubmit = reason && (!noteRequired || note.trim());

  const handleConfirm = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await cancelJobAssignment(job.id, reason, note.trim());

    if (result.success) {
      onCancelled();
    } else {
      setError(result.error || 'Failed to cancel. Please try again.');
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400">event_busy</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Cancel this job?
          </h3>
        </div>

        {/* Consequence copy */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          The job returns to the job board for another handyman, and the
          customer will be notified. You won't be able to take this job again.
        </p>

        {/* Reason picklist */}
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Why are you cancelling? <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        >
          <option value="">Select a reason…</option>
          {CANCEL_REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Optional / required note */}
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Details {noteRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Anything the team should know"
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Keep Job
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Cancelling…' : 'Cancel Job'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelJobModal;
```

- [ ] **Step 3: Verify the app compiles**

Run: `CI=true npx react-scripts build 2>&1 | tail -5` (or `npm start` and check for compile errors)
Expected: compiles cleanly (component not yet rendered anywhere).

- [ ] **Step 4: Commit**

```bash
git add src/services/api/jobAssignment.js src/components/handyman/CancelJobModal.jsx
git commit -m "feat(reassignment): cancel service and shared cancel modal"
```

---

### Task 7: Cancel action in JobActionButtons + MyJobsView

**Files:**
- Modify: `src/components/handyman/JobActionButtons.jsx`

**Interfaces:**
- Consumes: `CancelJobModal` (Task 6).
- Produces: cancel button on both the `full` (job details) and `compact` (MyJobsView list) variants. MyJobsView needs no change — it already renders `<JobActionButtons job={job} onStatusChange={...} />` (`MyJobsView.jsx:178`), and the compact variant carries the new button to it.

- [ ] **Step 1: Add imports and state to JobActionButtons.jsx**

At the top:

```js
import CancelJobModal from './CancelJobModal';
```

Inside the component, next to the existing state:

```js
  const [showCancelModal, setShowCancelModal] = useState(false);
```

Below the `isCompleted` computation:

```js
  // Cancel is available in the same window the server enforces:
  // assigned job still in progress, completion poll not yet sent.
  const canCancel = job.status === 'in_progress' && !job.completionPollSentAt && !isCompleted;

  const handleCancelled = () => {
    setShowCancelModal(false);
    alert('Job cancelled. It has been returned to the job board and the customer has been notified.');
    if (variant === 'full') {
      navigate('/handyman-dashboard');
    } else if (onStatusChange) {
      onStatusChange();
    }
  };
```

- [ ] **Step 2: Render the cancel button + modal in the `full` variant**

In the `variant === 'full'` return, after the Mark Complete button's explanatory `<p>` (line ~252), add:

```jsx
        {canCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-6 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">event_busy</span>
            Can't do this job? Cancel it
          </button>
        )}

        <CancelJobModal
          job={job}
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onCancelled={handleCancelled}
        />
```

- [ ] **Step 3: Render in the compact variant**

In the compact-variant return, after the View Details button (line ~311), add inside the flex container:

```jsx
      {canCancel && (
        <button
          onClick={() => setShowCancelModal(true)}
          className="flex items-center justify-center gap-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">event_busy</span>
          Cancel Job
        </button>
      )}

      <CancelJobModal
        job={job}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onCancelled={handleCancelled}
      />
```

- [ ] **Step 4: Manual verification**

Run: `npm start`. As a handyman with an in-progress job: job details shows the red-outline cancel button below Mark Complete; My Jobs list shows "Cancel Job"; the modal requires a reason; "Other" requires a note; after a completion poll is sent the button disappears.
Expected: all of the above (actual cancel round-trip is exercised in Task 11 against dev).

- [ ] **Step 5: Commit**

```bash
git add src/components/handyman/JobActionButtons.jsx
git commit -m "feat(reassignment): cancel action on job details and my-jobs list"
```

---

### Task 8: Block canceller re-claim in ExpressInterestButton

**Files:**
- Modify: `src/components/handyman/ExpressInterestButton.jsx`

**Interfaces:**
- Consumes: `job.previousHandymanIds` (written by Task 3; enforced by Task 4's rules — this task is the UX mirror).

- [ ] **Step 1: Compute the blocked state**

Inside the component, next to the existing `alreadyClaimed` logic, add:

```js
  // A handyman who cancelled this job cannot re-claim it. Firestore
  // rules enforce this server-side; this flag just explains it in the UI
  // instead of letting the claim fail opaquely.
  const blockedFromReclaim = !!(
    user &&
    Array.isArray(job.previousHandymanIds) &&
    job.previousHandymanIds.includes(user.uid)
  );
```

And guard the click handler — first line of `handleExpressInterest` (before the auth redirect logic):

```js
    if (blockedFromReclaim) return;
```

- [ ] **Step 2: Reflect it on the button (line ~220)**

```jsx
      <button
        onClick={handleExpressInterest}
        disabled={isLoading || alreadyClaimed || blockedFromReclaim}
        className={getButtonClasses()}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="small" />
            Expressing Interest...
          </>
        ) : blockedFromReclaim ? (
          <>
            <span className="material-symbols-outlined">block</span>
            You previously cancelled this job
          </>
        ) : alreadyClaimed ? (
          <>
            <span className="material-symbols-outlined">check_circle</span>
            Interest Expressed
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">work</span>
            Express Interest
          </>
        )}
      </button>
```

- [ ] **Step 3: Manual verification**

Run: `npm start`. Craft a job doc in the dev Firestore console with `previousHandymanIds: [<your handyman uid>]`, `status: 'pending'`, `handymanId: null`; open its `/job-details/:jobId`.
Expected: button disabled with "You previously cancelled this job".

- [ ] **Step 4: Commit**

```bash
git add src/components/handyman/ExpressInterestButton.jsx
git commit -m "feat(reassignment): block previous canceller from re-claiming in UI"
```

---

### Task 9: releaseEscrowSimple — reassignment-aware guard, history close, audit

**Files:**
- Modify: `functions/index.js:1562-1565` (null-handyman guard), `functions/index.js:1689-1716` (final write + audit + response)

**Interfaces:**
- Consumes: `assignmentHistory` / `reassignmentCount` / `previousHandymanIds` (Task 3). No payout-logic change.
- Produces: response gains `payee: { handymanId, name }` and `reassignmentCount` — Task 10's UI may display the confirmation message as-is.

- [ ] **Step 1: Make the null-handyman guard reassignment-aware**

Replace (line ~1562):

```js
      if (!handymanId) {
        await releaseLock('No handyman assigned to this job');
        return res.status(400).json({ error: 'No handyman assigned to this job' });
      }
```

with:

```js
      if (!handymanId) {
        const wasCancelled = Array.isArray(jobData.previousHandymanIds) && jobData.previousHandymanIds.length > 0;
        const msg = wasCancelled
          ? 'Job has no assigned handyman — it was cancelled and has not been re-claimed'
          : 'No handyman assigned to this job';
        await releaseLock(msg);
        return res.status(400).json({ error: msg });
      }
```

- [ ] **Step 2: Close the assignment history on release**

In the final state write (the `await jobRef.update({ status: 'completed', ... })` block at line ~1689), add these fields to the update object:

```js
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
```

- [ ] **Step 3: Enrich audit log and response**

In the `writeAuditLog('fund_release', ...)` fields object add:

```js
        payeeName: handymanData.name || null,
        reassignmentCount: jobData.reassignmentCount || 0,
```

In the success `res.status(200).json({...})` payload add:

```js
        payee: { handymanId, name: handymanData.name || null },
        reassignmentCount: jobData.reassignmentCount || 0,
```

- [ ] **Step 4: Verify tests and bundle still pass**

Run: `cd functions && npx jest && node -e "console.log('bundle OK')"`
Expected: PASS / `bundle OK`.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat(reassignment): close assignment history and surface payee at fund release"
```

---

### Task 10: Admin fund-release visibility

**Files:**
- Modify: `src/pages/AdminFundRelease.jsx` (confirm dialog line ~174; pending-card handyman block line ~398)

**Interfaces:**
- Consumes: `assignmentHistory`, `reassignmentCount` on the job docs the page already fetches.

- [ ] **Step 1: Add a reassignment history component inside AdminFundRelease.jsx**

Above the page component (module scope), add:

```jsx
/**
 * Reassignment badge + expandable round-by-round history for a job.
 * Renders nothing for jobs that were never reassigned (the common case)
 * so the pending-release cards stay clean.
 */
const ReassignmentHistory = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const rounds = Array.isArray(job.assignmentHistory) ? job.assignmentHistory : [];
  const count = job.reassignmentCount || 0;

  if (count === 0) return null;

  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const reasonLabels = {
    schedule_conflict: 'Schedule conflict',
    job_bigger_than_expected: 'Job bigger than expected',
    location_too_far: 'Location too far',
    personal_emergency: 'Personal emergency',
    other: 'Other',
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">history</span>
        Reassigned ×{count}
        <span className="material-symbols-outlined text-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {expanded && (
        <ul className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-300 border-l-2 border-amber-300 dark:border-amber-700 pl-3">
          {rounds.map((r, i) => (
            <li key={i}>
              <span className="font-medium text-gray-900 dark:text-white">{r.handymanName || r.handymanId}</span>
              {' — '}{formatDate(r.assignedAt)} → {formatDate(r.endedAt)}
              {r.endReason === 'cancelled' ? (
                <span className="text-red-600 dark:text-red-400">
                  {' '}· cancelled ({reasonLabels[r.cancelReason] || r.cancelReason || 'no reason'})
                  {r.cancelNote ? ` — “${r.cancelNote}”` : ''}
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400"> · completed</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

(Ensure `useState` is already imported from React at the top of the file — it is.)

- [ ] **Step 2: Render it on the pending-release card and add the payee line**

At the handyman display in the pending-jobs card (line ~398):

```jsx
                            <p className="font-medium text-gray-900 dark:text-white">{job.handymanName || 'N/A'}</p>
```

replace with:

```jsx
                            <p className="font-medium text-gray-900 dark:text-white">
                              Releasing to: {job.handymanName || 'N/A'}
                              {job.acceptedAt && (
                                <span className="font-normal text-gray-500 dark:text-gray-400">
                                  {' '}(assigned {new Date(job.acceptedAt).toLocaleDateString('en-SG')})
                                </span>
                              )}
                            </p>
                            <ReassignmentHistory job={job} />
```

- [ ] **Step 3: Make the confirm dialog name the payee and reassignments**

Replace the `window.confirm` template (line ~174):

```js
    if (!window.confirm(`Are you sure you want to release funds for job "${job.serviceType}"?\n\nAmount: $${job.estimatedBudget}\nCustomer: ${job.customerName}\n\nThis will transfer the service fee to the handyman's Stripe account.`)) {
```

with:

```js
    const reassignedNote = (job.reassignmentCount || 0) > 0
      ? `\n⚠️ This job was reassigned ${job.reassignmentCount} time(s) — check the history before releasing.`
      : '';
    if (!window.confirm(`Are you sure you want to release funds for job "${job.serviceType}"?\n\nAmount: $${job.estimatedBudget}\nCustomer: ${job.customerName}\nReleasing to: ${job.handymanName || 'N/A'}${reassignedNote}\n\nThis will transfer the service fee to the handyman's Stripe account.`)) {
```

- [ ] **Step 4: Manual verification**

Run: `npm start`, sign in as admin, open `/admin/fund-release`. Seed a pending job in dev Firestore with `reassignmentCount: 1` and a two-entry `assignmentHistory`.
Expected: amber "Reassigned ×1" badge expands to the round history; card reads "Releasing to: {name}"; confirm dialog shows the payee and the reassignment warning.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminFundRelease.jsx
git commit -m "feat(reassignment): admin fund-release shows payee and reassignment history"
```

---

### Task 11: Dead-code removal + E2E checklist

**Files:**
- Modify: `src/services/stripe/stripeApi.js:103-110` (delete `releaseEscrowAndSplit`)

- [ ] **Step 1: Delete the orphaned release wrapper**

In `src/services/stripe/stripeApi.js`, delete the entire `releaseEscrowAndSplit` export (lines ~103-110 — the function calling `${BASE_URL}/releaseEscrowAndSplit`) and remove it from any export list at the bottom of the file. Its backend endpoint is commented out; grep first to confirm it's still uncalled:

Run: `grep -rn "releaseEscrowAndSplit" src/ | grep -v stripeApi.js`
Expected: no output. Then delete.

- [ ] **Step 2: Verify build + all tests**

Run: `CI=true npx react-scripts test --watchAll=false && CI=true npx react-scripts build 2>&1 | tail -3 && cd functions && npx jest`
Expected: all PASS, build clean.

- [ ] **Step 3: Commit**

```bash
git add src/services/stripe/stripeApi.js
git commit -m "chore: remove dead releaseEscrowAndSplit frontend wrapper"
```

- [ ] **Step 4: Full E2E checklist on the dev Firebase project (manual)**

Deploy: `npm run deploy:dev` (hosting + functions + rules). Optional env: set `TWILIO_TEMPLATE_HANDYMAN_CANCELLED` in `functions/.env.<devProjectId>` once the template is approved — until then the freeform fallback sends (sandbox).

1. Customer books + pays a job (Stripe test card) → fan-out round 0 fires.
2. Handyman A accepts → customer gets the accepted message.
3. Handyman A opens job details → cancels with reason "Location too far".
   - Customer receives the cancel notice on WhatsApp.
   - Job reappears on the board (status pending), sorted per date-needed.
   - Fan-out round 1 fires; A gets nothing; markers `*_r1` visible in Firestore.
   - A's Express Interest button shows "You previously cancelled this job"; a forced client write to claim it is rejected by rules.
4. Handyman B accepts → customer gets accepted message with B's name.
5. B marks complete → customer confirms YES → job hits `/admin/fund-release`.
6. Admin sees "Reassigned ×1", expands history (A's round, cancelled + reason; B current), confirm dialog names B.
7. Release funds → Stripe test dashboard shows the transfer to B's connected account; job's `assignmentHistory` gains B's `completed` entry; auditLog has `job_cancelled_by_handyman` + enriched `fund_release`.
8. Regression: a fresh never-cancelled job books → accepts → completes → releases with no badge and unchanged behavior.

Record any deviation as a bug before merging.

---

## Self-review notes (already applied)

- Spec §5 “increment cancellationCount” → Task 3 step 2 side-effect 1. Spec §7 default sort → Task 5. Spec §8 payee/badge/history → Tasks 9–10. Spec §2 dead code → Task 11. Spec §6 three blocking layers → Tasks 2 (fan-out), 4 (rules), 8 (UI). All spec sections covered.
- Known copy conflict (flagged, deliberately NOT changed here): `ExpressInterestButton.jsx`'s confirm modal warns of a "$20 penalty" for cancelling — the spec implements no penalties. Product copy decision belongs to the owner; see plan follow-ups.
- Type consistency: `CancelError.code` values match the endpoint's `statusByCode` map and Task 1 tests; `runFanOut({ round, excludeIds })` matches Tasks 2/3; `CANCEL_REASON_OPTIONS` values match `CANCEL_REASONS`.
