# Schedule Flows (Stage 3: Reschedule + ASAP Time-Fixing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A handyman can propose a new visit time (Scenario 3) and MUST propose one when accepting an ASAP job (Scenario 4); the customer approves/declines over WhatsApp via the Stage-2 prompt rail; all schedule writes flow through one server-side `applyScheduleChange` (F4) that keeps the completion poll and date gate honest.

**Architecture:** A new DI-style `functions/scheduleService.js` owns proposal validation and the schedule-change update payload (pure, TDD'd). A `proposeSchedule` HTTPS endpoint (assigned-handyman-only) sends the customer a WhatsApp proposal and opens a `schedule_approval` prompt carrying the proposal as a `payload` (small `openPrompt` extension). The webhook's prompt dispatch gains a `schedule_approval` branch: approve → `applyScheduleChange` transaction (writes `preferredDate`/`preferredTime`, marks `scheduledFromAsapAt` for ASAP jobs, clears the poll marker, appends `scheduleHistory`) → both parties notified; decline → handyman told to re-propose. Frontend: a `ProposeTimeModal` behind a "Propose new time" action on the handyman's job surfaces, and the ASAP accept modal in `ExpressInterestButton` gains a required date/time picker so claim + proposal submit together. Rules enforce F4: schedule fields become server-only on UPDATE (booking create untouched).

**Tech Stack:** Firebase Cloud Functions (Node 20, plain JS), Firestore, Twilio via existing helpers, Stage-2 `promptService`, React 18 (CRA) + Tailwind, Jest in `functions/`.

**Spec:** `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` §3 (F4, F5), §4 Scenarios 3 + 4. Branch: `feature/job-lifecycle-flows` (checked out).

## Global Constraints

- **F4 single writer:** after booking, `preferredDate`/`preferredTime`/`preferredTiming` change ONLY via `applyScheduleChange` (Cloud Function). Enforced in rules by adding `preferredDate`, `preferredTime`, `preferredTiming`, `scheduleHistory`, `scheduledFromAsapAt` to `jobSystemFields()` (update-deny). The booking CREATE flow legitimately writes the first three — they must NOT be added to `jobCreateDeniedFields()`.
- `applyScheduleChange` must: require `status === 'in_progress'`, clear `completionPollSentAt`/`completionPollSentBy` (FieldValue.delete), set `preferredTiming: 'Schedule'`, set `scheduledFromAsapAt` when the job previously had `preferredTiming !== 'Schedule'`, append a `scheduleHistory` entry `{ changedAt, changedBy, via, fromDate, fromTime, toDate, toTime, note, promptId }`, and never touch `paymentStatus` or money fields.
- Prompt type: exactly `schedule_approval`. Options map exactly: `{ 'YES': 'approve', 'Y': 'approve', 'APPROVE': 'approve', 'OK': 'approve', 'NO': 'decline', 'N': 'decline', 'DECLINE': 'decline' }` (constant `SCHEDULE_APPROVAL_OPTIONS` in index.js).
- Proposal validation: date must parse, be today or later, and within 90 days; time is a required non-empty string ≤ 20 chars.
- Job-state writes BEFORE `markAnswered` (Stage-2 invariant). Side effects awaited before the HTTP response; failures caught individually.
- Rate limit on `proposeSchedule`: `checkRateLimit('schedule_propose_' + uid, 10, 3600)`.
- Endpoint template env: `TWILIO_TEMPLATE_SCHEDULE_PROPOSAL` (freeform fallback until approved, existing pattern).
- Out of scope (Stage 4 / Scenario 12): the 24h/48h nudge sweeps and admin attention queue; admin-as-actor endpoint. Nothing in this stage may block on them.
- ANTI-iCLOUD PROTOCOL every commit: stage only named files; read `git diff --staged` hunk-by-hunk; re-grep a distinctive string post-commit. Frontend verification: `CI=true npx react-scripts build` (CRA jest unrunnable on this Node). Backend: `cd functions && node --check index.js && npx jest`.
- Line numbers drift — locate by quoted content.

---

### Task 1: `scheduleService.js` — proposal validation + change payload (TDD)

**Files:**
- Create: `functions/scheduleService.js`
- Test: `functions/__tests__/scheduleService.test.js`

**Interfaces:**
- Produces: `ScheduleError` (Error with `.code`); `validateScheduleProposal({ date, time, nowMs })` (throws `ScheduleError`; codes `bad_date`, `date_past`, `date_too_far`, `bad_time`); `buildScheduleChangeUpdate(job, { newDate, newTime, actor, via, note, promptId, nowIso })` → Firestore update object. Tasks 3–4 consume both.

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/scheduleService.test.js`:

```js
const {
  ScheduleError,
  validateScheduleProposal,
  buildScheduleChangeUpdate,
} = require('../scheduleService');

// Fixed clock: 2026-07-12T04:00:00Z
const NOW_MS = Date.UTC(2026, 6, 12, 4, 0, 0);

const asapJob = () => ({
  status: 'in_progress',
  preferredTiming: 'Immediate',
  preferredDate: undefined,
  preferredTime: undefined,
  handymanId: 'hm_1',
});

const scheduledJob = () => ({
  status: 'in_progress',
  preferredTiming: 'Schedule',
  preferredDate: '2026-07-20',
  preferredTime: '10:00 AM',
  handymanId: 'hm_1',
});

describe('validateScheduleProposal', () => {
  test('accepts a near-future date with a time', () => {
    expect(() => validateScheduleProposal({ date: '2026-07-15', time: '2:00 PM', nowMs: NOW_MS }))
      .not.toThrow();
  });

  test('accepts today', () => {
    expect(() => validateScheduleProposal({ date: '2026-07-12', time: '6:00 PM', nowMs: NOW_MS }))
      .not.toThrow();
  });

  test('rejects unparseable dates', () => {
    expect(() => validateScheduleProposal({ date: 'next tuesday', time: '2 PM', nowMs: NOW_MS }))
      .toThrow(ScheduleError);
    try { validateScheduleProposal({ date: 'next tuesday', time: '2 PM', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('bad_date');
    }
  });

  test('rejects past dates', () => {
    try { validateScheduleProposal({ date: '2026-07-10', time: '2 PM', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('date_past');
    }
    expect.assertions(1);
  });

  test('rejects dates beyond 90 days', () => {
    try { validateScheduleProposal({ date: '2026-11-15', time: '2 PM', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('date_too_far');
    }
    expect.assertions(1);
  });

  test('rejects a missing or overlong time', () => {
    try { validateScheduleProposal({ date: '2026-07-15', time: '', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('bad_time');
    }
    try { validateScheduleProposal({ date: '2026-07-15', time: 'x'.repeat(30), nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('bad_time');
    }
    expect.assertions(2);
  });
});

describe('buildScheduleChangeUpdate', () => {
  const NOW_ISO = '2026-07-12T04:00:00.000Z';

  test('reschedules a scheduled job: new date/time, history entry, poll cleared', () => {
    const update = buildScheduleChangeUpdate(scheduledJob(), {
      newDate: '2026-07-22', newTime: '3:00 PM',
      actor: 'cust_1', via: 'whatsapp_reply', note: '', promptId: 'p1', nowIso: NOW_ISO,
    });

    expect(update.preferredDate).toBe('2026-07-22');
    expect(update.preferredTime).toBe('3:00 PM');
    expect(update.preferredTiming).toBe('Schedule');
    // Not previously ASAP → no scheduledFromAsapAt
    expect(update).not.toHaveProperty('scheduledFromAsapAt');
    // Poll marker cleared with delete sentinels
    expect(update.completionPollSentAt).toBeDefined();
    expect(update.completionPollSentBy).toBeDefined();
    expect(update.scheduleHistory).toEqual([{
      changedAt: NOW_ISO,
      changedBy: 'cust_1',
      via: 'whatsapp_reply',
      fromDate: '2026-07-20',
      fromTime: '10:00 AM',
      toDate: '2026-07-22',
      toTime: '3:00 PM',
      note: null,
      promptId: 'p1',
    }]);
    expect(update).not.toHaveProperty('paymentStatus');
  });

  test('fixing an ASAP job stamps scheduledFromAsapAt and appends to existing history', () => {
    const job = { ...asapJob(), scheduleHistory: [{ changedAt: 'earlier' }] };
    const update = buildScheduleChangeUpdate(job, {
      newDate: '2026-07-14', newTime: '9:00 AM',
      actor: 'cust_1', via: 'whatsapp_reply', note: 'morning ok', promptId: 'p2', nowIso: NOW_ISO,
    });

    expect(update.scheduledFromAsapAt).toBe(NOW_ISO);
    expect(update.preferredTiming).toBe('Schedule');
    expect(update.scheduleHistory).toHaveLength(2);
    expect(update.scheduleHistory[1]).toMatchObject({
      fromDate: null, fromTime: null, toDate: '2026-07-14', note: 'morning ok',
    });
  });

  test('truncates the note to 300 chars', () => {
    const update = buildScheduleChangeUpdate(scheduledJob(), {
      newDate: '2026-07-22', newTime: '3:00 PM',
      actor: 'hm_1', via: 'admin', note: 'x'.repeat(400), promptId: null, nowIso: NOW_ISO,
    });
    expect(update.scheduleHistory[0].note).toHaveLength(300);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest __tests__/scheduleService.test.js`
Expected: FAIL — `Cannot find module '../scheduleService'`

- [ ] **Step 3: Implement the module**

Create `functions/scheduleService.js`:

```js
/**
 * Schedule-change domain logic (job lifecycle spec §3 F4, Scenarios 3+4).
 *
 * F4's rule: after booking, preferredDate/preferredTime/preferredTiming
 * change ONLY through the applyScheduleChange transaction in
 * functions/index.js — because the completion poll and the Mark-Complete
 * date gate both key off preferredDate, an unrecorded change would poll
 * the customer about a job that hasn't happened yet.
 *
 * This module owns the pure parts (proposal validation, update-payload
 * construction) so they're unit-testable; Firestore access stays in
 * index.js, in the same DI style as jobReassignment.js.
 */

const admin = require('firebase-admin');

/** Proposals may be at most this many days out. */
const MAX_HORIZON_DAYS = 90;

/**
 * Typed error so the endpoint can map validation failures to precise
 * HTTP statuses and actionable messages.
 */
class ScheduleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScheduleError';
    this.code = code;
  }
}

/**
 * Validate a proposed visit date/time.
 *
 * Dates compare at day granularity (a proposal for "today" is fine —
 * same-day ASAP visits are the product's bread and butter). Time is a
 * display string (the booking form's own preferredTime is free-text,
 * e.g. "2:00 PM"), so we only bound its length.
 */
function validateScheduleProposal({ date, time, nowMs = Date.now() }) {
  const parsed = new Date(date);
  if (!date || Number.isNaN(parsed.getTime())) {
    throw new ScheduleError('bad_date', 'Please pick a valid date');
  }
  const dayStart = (ms) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const proposedDay = dayStart(parsed.getTime());
  const today = dayStart(nowMs);
  if (proposedDay < today) {
    throw new ScheduleError('date_past', 'The proposed date is in the past');
  }
  if (proposedDay > today + MAX_HORIZON_DAYS * 24 * 3600 * 1000) {
    throw new ScheduleError('date_too_far', `Please pick a date within ${MAX_HORIZON_DAYS} days`);
  }
  const timeStr = String(time || '').trim();
  if (!timeStr || timeStr.length > 20) {
    throw new ScheduleError('bad_time', 'Please pick a valid time');
  }
}

/**
 * Build the Firestore update that applies an approved schedule change.
 *
 * - History entry records who changed what, from→to, and through which
 *   channel (F5 admin-as-actor writes land here with via 'admin').
 * - scheduledFromAsapAt is stamped the first time an ASAP job gets a
 *   concrete date — from then on the completion poll and date gate
 *   treat it as a normal scheduled job.
 * - completionPollSentAt/By are cleared so the poll re-arms for the
 *   new date (the auto-poll skips jobs whose marker is set).
 * - Money fields are deliberately untouched (spec §2b: schedule changes
 *   never move escrow).
 */
function buildScheduleChangeUpdate(job, { newDate, newTime, actor, via, note, promptId, nowIso }) {
  const history = Array.isArray(job.scheduleHistory) ? [...job.scheduleHistory] : [];
  const trimmedNote = String(note || '').trim().slice(0, 300);
  history.push({
    changedAt: nowIso,
    changedBy: actor,
    via,
    fromDate: job.preferredDate || null,
    fromTime: job.preferredTime || null,
    toDate: newDate,
    toTime: newTime,
    note: trimmedNote || null,
    promptId: promptId || null,
  });

  const update = {
    preferredDate: newDate,
    preferredTime: newTime,
    preferredTiming: 'Schedule',
    scheduleHistory: history,
    completionPollSentAt: admin.firestore.FieldValue.delete(),
    completionPollSentBy: admin.firestore.FieldValue.delete(),
  };

  if (job.preferredTiming !== 'Schedule') {
    update.scheduledFromAsapAt = nowIso;
  }

  return update;
}

module.exports = {
  ScheduleError,
  validateScheduleProposal,
  buildScheduleChangeUpdate,
  MAX_HORIZON_DAYS,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest __tests__/scheduleService.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit (anti-iCloud protocol)**

```bash
git add functions/scheduleService.js functions/__tests__/scheduleService.test.js
git diff --staged   # read every hunk
git commit -m "feat(schedule): schedule-change domain module (F4)"
grep -c "buildScheduleChangeUpdate" functions/scheduleService.js   # expect ≥ 2
```

---

### Task 2: `openPrompt` gains a `payload` field

**Files:**
- Modify: `functions/promptService.js` (the `openPrompt` function + its doc comment)
- Test: `functions/__tests__/promptService.test.js` (extend the `openPrompt` describe block)

**Interfaces:**
- Produces: `openPrompt({ ..., payload })` — optional plain object stored verbatim on the prompt doc as `payload` (null when omitted). The webhook dispatch (Task 4) reads `verdict.prompt.payload`.

- [ ] **Step 1: Extend the failing test**

In `functions/__tests__/promptService.test.js`, inside `describe('openPrompt', ...)`, add:

```js
  test('stores an optional payload verbatim (null when omitted)', async () => {
    const db = fakeDb([]);
    await openPrompt({
      db,
      jobId: 'job_aaa111',
      type: 'schedule_approval',
      toPhone: '+6591234567',
      toRole: 'customer',
      question: 'Approve the new time?',
      options: { YES: 'approve', NO: 'decline' },
      payload: { proposedDate: '2026-07-15', proposedTime: '2:00 PM' },
      nowMs: 1_700_000_000_000,
    });
    expect(db.writes.set[0].payload)
      .toEqual({ proposedDate: '2026-07-15', proposedTime: '2:00 PM' });

    const db2 = fakeDb([]);
    await openPrompt({
      db: db2, jobId: 'j', type: 't', toPhone: '91234567', toRole: 'customer',
      question: 'q', options: { YES: 'x' }, nowMs: 1,
    });
    expect(db2.writes.set[0].payload).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd functions && npx jest __tests__/promptService.test.js`
Expected: FAIL — `payload` is `undefined`, not the object / null.

- [ ] **Step 3: Implement**

In `functions/promptService.js`, `openPrompt`: add `payload = null,` to the destructured params (after `options,`), and add `payload,` to the `docRef.set({...})` object (after `options,`). Extend the function's doc comment with one line: `Optional payload (e.g. a schedule proposal) is stored verbatim for the dispatcher to act on when the prompt is answered.`

- [ ] **Step 4: Run the full functions suite**

Run: `cd functions && npx jest`
Expected: PASS (44 total: 34 existing + 9 Task 1 + 1 this task).

- [ ] **Step 5: Commit (anti-iCloud protocol)**

```bash
git add functions/promptService.js functions/__tests__/promptService.test.js
git diff --staged
git commit -m "feat(prompts): optional payload stored on prompt docs"
grep -c "payload" functions/promptService.js   # expect ≥ 3
```

---

### Task 3: `applyScheduleChange` + `proposeSchedule` endpoint

**Files:**
- Modify: `functions/index.js` — (a) require next to `require('./jobReassignment')`; (b) `SCHEDULE_APPROVAL_OPTIONS` constant next to `COMPLETION_PROMPT_OPTIONS`; (c) module-level `applyScheduleChange`; (d) new `proposeSchedule` endpoint appended after `cancelJobAssignment`.

**Interfaces:**
- Consumes: Task 1's `validateScheduleProposal`/`buildScheduleChangeUpdate`/`ScheduleError`; Task 2's `openPrompt` payload; existing `verifyAuthToken`, `checkRateLimit`, `writeAuditLog`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`, `cors`.
- Produces: `applyScheduleChange({ db, jobId, newDate, newTime, actor, via, note, promptId })` → `{ outcome: 'applied' | 'wrong_status', job? }` (Task 4 consumes); `POST /proposeSchedule` body `{ jobId, proposedDate, proposedTime, note? }` → 200 `{ success: true, promptId }`; errors 400/401/403/404/405/409/429 (Task 5's frontend service consumes).

- [ ] **Step 1: Requires + constant**

Next to the jobReassignment require block:

```js
// Schedule-change domain logic (F4 single writer). See
// functions/scheduleService.js and the lifecycle spec §3/§4.3-4.4.
const {
  ScheduleError,
  validateScheduleProposal,
  buildScheduleChangeUpdate,
} = require('./scheduleService');
```

Next to `COMPLETION_PROMPT_OPTIONS`:

```js
// Reply options for schedule-approval prompts (reschedule + ASAP
// time-fixing). Keys mirror quick-reply button texts plus terse
// replies; values are the dispatcher actions.
const SCHEDULE_APPROVAL_OPTIONS = {
  'YES': 'approve', 'Y': 'approve', 'APPROVE': 'approve', 'OK': 'approve',
  'NO': 'decline', 'N': 'decline', 'DECLINE': 'decline',
};
```

- [ ] **Step 2: Module-level `applyScheduleChange`**

Insert above `exports.whatsappWebhook` (next to `applyCompletionAnswer`):

```js
/**
 * Apply a schedule change to a job, atomically (F4 single writer).
 *
 * Used by the webhook's schedule_approval dispatch (customer approved
 * over WhatsApp) and, later, by admin-as-actor tooling (Scenario 12).
 * The transaction re-checks status so a change can never land on a job
 * that was cancelled or completed between proposal and approval.
 *
 * @returns {{outcome: 'applied'|'wrong_status', job?: object}}
 */
async function applyScheduleChange({ db, jobId, newDate, newTime, actor, via, note, promptId }) {
  const jobRef = db.collection('jobs').doc(jobId);
  let jobData;
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists || snap.data().status !== 'in_progress') {
        throw new Error('WRONG_STATUS');
      }
      jobData = snap.data();
      const update = buildScheduleChangeUpdate(jobData, {
        newDate, newTime, actor, via, note, promptId,
        nowIso: new Date().toISOString(),
      });
      tx.update(jobRef, update);
    });
  } catch (err) {
    if (err.message === 'WRONG_STATUS') {
      return { outcome: 'wrong_status' };
    }
    throw err;
  }
  return { outcome: 'applied', job: jobData };
}
```

- [ ] **Step 3: The `proposeSchedule` endpoint**

Append after the `cancelJobAssignment` endpoint:

```js
/**
 * proposeSchedule — the assigned handyman proposes a (new) visit time.
 *
 * Two triggers share this endpoint (lifecycle spec Scenarios 3 + 4):
 * a reschedule of an already-scheduled job, and the mandatory
 * time-fixing proposal submitted together with an ASAP job's claim.
 * Either way: validate → WhatsApp the customer → open a
 * schedule_approval prompt carrying the proposal as payload. The
 * schedule itself changes ONLY when the customer approves (F4 — the
 * webhook dispatch calls applyScheduleChange).
 *
 * POST body: { jobId, proposedDate, proposedTime, note? }
 */
exports.proposeSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const decodedToken = await verifyAuthToken(req);
      const { jobId, proposedDate, proposedTime, note } = req.body || {};
      if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId' });
      }

      try {
        validateScheduleProposal({ date: proposedDate, time: proposedTime });
      } catch (err) {
        if (err instanceof ScheduleError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }

      const rl = await checkRateLimit(`schedule_propose_${decodedToken.uid}`, 10, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many proposals — please slow down', retryAfterSeconds: rl.retryAfterSeconds });
      }

      const jobSnap = await admin.firestore().collection('jobs').doc(jobId).get();
      if (!jobSnap.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      const job = jobSnap.data();
      if (job.handymanId !== decodedToken.uid) {
        return res.status(403).json({ error: 'Only the assigned handyman can propose a time' });
      }
      if (job.status !== 'in_progress') {
        return res.status(409).json({ error: `This job can no longer be rescheduled (status: ${job.status})` });
      }
      if (!job.customerPhone) {
        return res.status(400).json({ error: 'Job has no customer phone on record' });
      }

      const handymanName = (job.acceptedBy && job.acceptedBy.name) || 'Your handyman';
      const displayDate = new Date(proposedDate).toLocaleDateString('en-SG', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const isFirstTime = job.preferredTiming !== 'Schedule';
      const trimmedNote = String(note || '').trim().slice(0, 300);

      // WhatsApp the customer. Business-initiated → template with
      // freeform fallback (sandbox / pre-approval), existing pattern.
      const fallback = isFirstTime
        ? `📅 ${handymanName} proposes to visit on *${displayDate}* at *${proposedTime}* for your ${job.serviceType || 'job'} (Job #${jobId.slice(-6)}).${trimmedNote ? `\n\nNote: ${trimmedNote}` : ''}\n\n👉 Reply *YES* to confirm this time\n👉 Reply *NO* to ask for another`
        : `📅 ${handymanName} proposes a NEW time for your ${job.serviceType || 'job'} (Job #${jobId.slice(-6)}): *${displayDate}* at *${proposedTime}*.${trimmedNote ? `\n\nNote: ${trimmedNote}` : ''}\n\n👉 Reply *YES* to approve\n👉 Reply *NO* to keep the original time`;

      const sendResult = await sendTwilioTemplateMessage(
        formatPhoneToWhatsApp(job.customerPhone),
        process.env.TWILIO_TEMPLATE_SCHEDULE_PROPOSAL,
        { '1': handymanName, '2': displayDate, '3': String(proposedTime), '4': jobId.slice(-6) },
        fallback,
      );
      if (!sendResult.success) {
        return res.status(502).json({ error: 'Could not reach the customer on WhatsApp — please try again' });
      }

      // F2: the prompt carries the proposal so the reply dispatcher can
      // apply exactly what was asked, even if a newer proposal replaces
      // this one (supersede) before the customer answers.
      const { promptId } = await openPrompt({
        db: admin.firestore(),
        jobId,
        type: 'schedule_approval',
        toPhone: job.customerPhone,
        toRole: 'customer',
        question: `Approve ${handymanName}'s proposed time: ${displayDate} at ${proposedTime}?`,
        options: SCHEDULE_APPROVAL_OPTIONS,
        payload: {
          proposedDate,
          proposedTime: String(proposedTime),
          proposedBy: decodedToken.uid,
          note: trimmedNote || null,
          isFirstTime,
        },
      });

      await writeAuditLog('schedule_proposed', decodedToken, {
        jobId, proposedDate, proposedTime: String(proposedTime), promptId, isFirstTime,
      });

      console.log(`📅 Schedule proposal for job ${jobId} by ${decodedToken.uid}: ${proposedDate} ${proposedTime} (prompt ${promptId})`);
      return res.status(200).json({ success: true, promptId });
    } catch (error) {
      console.error('❌ Error in proposeSchedule:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to propose schedule' });
    }
  });
});
```

- [ ] **Step 4: Verify + commit (anti-iCloud protocol)**

Run: `cd functions && node --check index.js && npx jest`
Expected: clean; 44 green.

```bash
git add functions/index.js
git diff --staged   # read every hunk: require, constant, applyScheduleChange, endpoint — nothing else
git commit -m "feat(schedule): proposeSchedule endpoint and applyScheduleChange transaction"
grep -c "SCHEDULE_APPROVAL_OPTIONS" functions/index.js   # expect 2 (definition + endpoint use; Task 4 adds no more)
```

---

### Task 4: Webhook dispatch for `schedule_approval`

**Files:**
- Modify: `functions/index.js` — inside `whatsappWebhook`'s prompt path, the `if (verdict.kind === 'answer') {` block (locate `if (verdict.prompt.type === 'completion_confirmation') {` and the `Unknown prompt type` branch below it).

**Interfaces:**
- Consumes: Task 3's `applyScheduleChange`; Task 2's `verdict.prompt.payload`; Stage-2 `markAnswered`, `forwardUnmatchedInbound`, `sendTwilioMessage`.

- [ ] **Step 1: Insert the branch**

Between the end of the `completion_confirmation` block (its closing `}` before the `Unknown prompt type` console.warn) and the unknown-type branch, insert:

```js
        if (verdict.prompt.type === 'schedule_approval') {
          const proposal = verdict.prompt.payload || {};
          const jobShortId = String(verdict.prompt.jobId).slice(-6);

          if (verdict.action === 'approve') {
            const changeResult = await applyScheduleChange({
              db: admin.firestore(),
              jobId: verdict.prompt.jobId,
              newDate: proposal.proposedDate,
              newTime: proposal.proposedTime,
              actor: senderKey,
              via: 'whatsapp_reply',
              note: proposal.note,
              promptId: verdict.prompt.id,
            });

            try {
              await markAnswered(verdict.prompt.ref, {
                answer: verdict.answerText,
                resultingAction: changeResult.outcome,
              });
            } catch (markErr) {
              console.error('⚠️ markAnswered failed (continuing):', markErr);
            }

            if (changeResult.outcome === 'wrong_status') {
              await sendTwilioMessage(
                From,
                `ℹ️ This job's schedule can no longer be changed (Job #${jobShortId}). If something looks wrong, contact easydonehandyman@gmail.com.`
              );
              return res.status(200).json({ received: true, processed: false, reason: 'Schedule approval on non-in_progress job' });
            }

            // Confirm to the customer...
            const displayDate = new Date(proposal.proposedDate).toLocaleDateString('en-SG', {
              weekday: 'long', day: 'numeric', month: 'long',
            });
            await sendTwilioMessage(
              From,
              `✅ Confirmed! Your visit for Job #${jobShortId} is set for *${displayDate}* at *${proposal.proposedTime}*.\n\nSee you then! 🔧`
            );

            // ...and tell the handyman their proposal was accepted.
            try {
              const job = changeResult.job;
              if (job && job.handymanId) {
                const hmSnap = await admin.firestore().collection('handymen').doc(job.handymanId).get();
                const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
                if (hmPhone) {
                  await sendTwilioMessage(
                    formatPhoneToWhatsApp(hmPhone),
                    `✅ Customer confirmed: Job #${jobShortId} is set for ${displayDate} at ${proposal.proposedTime}.`
                  );
                }
              }
            } catch (notifyErr) {
              console.error('⚠️ Handyman schedule-confirmation notice failed:', notifyErr);
            }

            return res.status(200).json({ received: true, processed: true, action: 'schedule_applied', via: 'prompt' });
          }

          // Decline: schedule unchanged; handyman must re-propose (or the
          // F5 ladder / Scenario 12 sweep escalates the stall later).
          try {
            await markAnswered(verdict.prompt.ref, {
              answer: verdict.answerText,
              resultingAction: 'declined',
            });
          } catch (markErr) {
            console.error('⚠️ markAnswered failed (continuing):', markErr);
          }

          await sendTwilioMessage(
            From,
            proposal.isFirstTime
              ? `👍 No problem — your handyman will propose another time for Job #${jobShortId}.`
              : `👍 No problem — the original time for Job #${jobShortId} stays. Your handyman may propose another option.`
          );

          try {
            const jobSnap = await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).get();
            const hmId = jobSnap.exists ? jobSnap.data().handymanId : null;
            if (hmId) {
              const hmSnap = await admin.firestore().collection('handymen').doc(hmId).get();
              const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
              if (hmPhone) {
                await sendTwilioMessage(
                  formatPhoneToWhatsApp(hmPhone),
                  `ℹ️ The customer declined your proposed time for Job #${jobShortId}. Please propose another time from the job page.`
                );
              }
            }
          } catch (notifyErr) {
            console.error('⚠️ Handyman decline notice failed:', notifyErr);
          }

          return res.status(200).json({ received: true, processed: true, action: 'schedule_declined', via: 'prompt' });
        }
```

Note: unlike the completion flow, `markAnswered` here runs immediately after (or without) the job write in each branch — on approve the transaction has already committed before `markAnswered`; on decline there is no job write at all. The Stage-2 ordering invariant holds.

- [ ] **Step 2: Verify + commit (anti-iCloud protocol)**

Run: `cd functions && node --check index.js && npx jest`
Expected: clean; 44 green.

```bash
git add functions/index.js
git diff --staged   # exactly one inserted branch
git commit -m "feat(webhook): schedule_approval dispatch — approve applies F4 change, decline notifies handyman"
grep -c "schedule_approval" functions/index.js   # expect ≥ 2
```

---

### Task 5: Frontend — schedule service + ProposeTimeModal + job-page action

**Files:**
- Create: `src/services/api/jobSchedule.js`
- Create: `src/components/handyman/ProposeTimeModal.jsx`
- Modify: `src/components/handyman/JobActionButtons.jsx`

**Interfaces:**
- Consumes: `POST /proposeSchedule` (Task 3 contract); patterns from `src/services/api/jobAssignment.js` and `CancelJobModal.jsx`.
- Produces: `proposeSchedule(jobId, proposedDate, proposedTime, note)` → `{ success, error?, code?, promptId? }`; `<ProposeTimeModal job isOpen onClose onProposed />`. Task 6 reuses the service.

- [ ] **Step 1: The service**

Create `src/services/api/jobSchedule.js`:

```js
/**
 * Job schedule service — handyman-side time proposals.
 *
 * Proposals go through the proposeSchedule Cloud Function (never a
 * direct Firestore write): the server owns the customer WhatsApp
 * prompt and the F4 single-writer schedule change that keeps the
 * completion poll and date gate honest. See the lifecycle spec §3/§4.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/**
 * Propose a (new) visit time for a job the current handyman owns.
 *
 * @param {string} jobId
 * @param {string} proposedDate - ISO date (yyyy-mm-dd)
 * @param {string} proposedTime - display time string, e.g. "2:00 PM"
 * @param {string} note - optional, shown to the customer
 * @returns {Promise<{success: boolean, error?: string, code?: string, promptId?: string}>}
 */
export const proposeSchedule = async (jobId, proposedDate, proposedTime, note = '') => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/proposeSchedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId, proposedDate, proposedTime, note }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Could not send the proposal. Please try again.', code: result.code };
    }
    return { success: true, promptId: result.promptId };
  } catch (error) {
    console.error('❌ Error proposing schedule:', error);
    return { success: false, error: 'Could not send the proposal. Please check your connection and try again.' };
  }
};
```

- [ ] **Step 2: The modal**

Create `src/components/handyman/ProposeTimeModal.jsx`:

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { proposeSchedule } from '../../services/api/jobSchedule';

/**
 * ProposeTimeModal
 *
 * Handyman proposes a (new) visit date/time. The customer approves or
 * declines over WhatsApp; nothing changes until they approve (F4).
 * Mirrors CancelJobModal's mount-and-toggle pattern: parent keeps it
 * mounted, state resets on every open.
 *
 * Props:
 *   job        - job object (needs .id; .preferredDate/.preferredTime shown as current)
 *   isOpen     - render toggle
 *   onClose    - back out
 *   onProposed - called after the proposal was sent successfully
 */
const ProposeTimeModal = ({ job, isOpen, onClose, onProposed }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setDate('');
      setTime('');
      setNote('');
      setError(null);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [isOpen, job.id]);

  if (!isOpen) return null;

  const canSubmit = date && time.trim();

  const handleConfirm = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await proposeSchedule(job.id, date, time.trim(), note.trim());
    if (result.success) {
      onProposed();
    } else {
      setError(result.error || 'Failed to send the proposal. Please try again.');
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const hasCurrent = job.preferredTiming === 'Schedule' && job.preferredDate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">event</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {hasCurrent ? 'Propose a new time' : 'Set the visit time'}
          </h3>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          {hasCurrent
            ? `Current: ${new Date(job.preferredDate).toLocaleDateString('en-SG')} at ${job.preferredTime || '—'}. The customer must approve the new time before it takes effect.`
            : 'The customer must approve this time before it takes effect. They are notified on WhatsApp right away.'}
        </p>

        <label htmlFor="propose-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          id="propose-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        <label htmlFor="propose-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Time <span className="text-red-500">*</span>
        </label>
        <input
          id="propose-time"
          type="text"
          maxLength={20}
          placeholder="e.g. 2:00 PM"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        <label htmlFor="propose-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Note to customer <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="propose-note"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Traffic on my earlier job — sorry!"
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Send to customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProposeTimeModal;
```

- [ ] **Step 3: Wire into JobActionButtons**

In `src/components/handyman/JobActionButtons.jsx`:

(a) Import next to the CancelJobModal import:

```js
import ProposeTimeModal from './ProposeTimeModal';
```

(b) State next to `showCancelModal`:

```js
  const [showProposeModal, setShowProposeModal] = useState(false);
```

(c) Below the `canCancel` computation:

```js
  // Same window as cancel: an in-progress job whose completion poll
  // hasn't gone out yet can have its time re-proposed (F4/Scenario 3).
  const canPropose = canCancel;

  const handleProposed = () => {
    setShowProposeModal(false);
    alert('Proposal sent! The customer has been asked to approve the new time on WhatsApp.');
    if (onStatusChange) onStatusChange();
  };
```

(d) In the `variant === 'full'` return, directly ABOVE the cancel button, add:

```jsx
        {canPropose && (
          <button
            onClick={() => setShowProposeModal(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-6 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">event</span>
            {job.preferredTiming === 'Schedule' ? 'Propose new time' : 'Set visit time'}
          </button>
        )}

        <ProposeTimeModal
          job={job}
          isOpen={showProposeModal}
          onClose={() => setShowProposeModal(false)}
          onProposed={handleProposed}
        />
```

(e) In the compact-variant return, next to the Cancel Job button, add:

```jsx
      {canPropose && (
        <button
          onClick={() => setShowProposeModal(true)}
          className="flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-sm">event</span>
          {job.preferredTiming === 'Schedule' ? 'New time' : 'Set time'}
        </button>
      )}

      <ProposeTimeModal
        job={job}
        isOpen={showProposeModal}
        onClose={() => setShowProposeModal(false)}
        onProposed={handleProposed}
      />
```

- [ ] **Step 4: Build check + commit (anti-iCloud protocol)**

Run: `CI=true npx react-scripts build 2>&1 | tail -3`
Expected: "Compiled successfully."

```bash
git add src/services/api/jobSchedule.js src/components/handyman/ProposeTimeModal.jsx src/components/handyman/JobActionButtons.jsx
git diff --staged
git commit -m "feat(schedule): propose-time modal and job-page actions"
grep -c "ProposeTimeModal" src/components/handyman/JobActionButtons.jsx   # expect ≥ 3
```

---

### Task 6: ASAP accept modal requires a proposed time

**Files:**
- Modify: `src/components/handyman/ExpressInterestButton.jsx`

**Interfaces:**
- Consumes: Task 5's `proposeSchedule(jobId, proposedDate, proposedTime, note)`.

- [ ] **Step 1: Imports and state**

Add import:

```js
import { proposeSchedule } from '../../services/api/jobSchedule';
```

Inside the component, next to existing state:

```js
  // ASAP jobs must carry a proposed visit time WITH the claim
  // (lifecycle spec Scenario 4): the accept modal requires it, so an
  // accepted ASAP job can never sit timeless.
  const isAsapJob = job.preferredTiming !== 'Schedule';
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
```

- [ ] **Step 2: Require the fields in the confirm handler**

At the top of `handleConfirmInterest` (after the `submittingRef` guard lines), add:

```js
    // ASAP claim requires a proposed visit time (Scenario 4).
    if (isAsapJob && (!proposedDate || !proposedTime.trim())) {
      alert('Please pick a proposed visit date and time first.');
      submittingRef.current = false;
      return;
    }
```

(Note: place AFTER `submittingRef.current = true;` — reset the ref before returning, as shown.)

- [ ] **Step 3: Send the proposal after the claim + acceptance notification**

Inside `handleConfirmInterest`, AFTER the existing WhatsApp acceptance-notification block (the `if (job.customerPhone) { ... }` try/catch) and BEFORE the `alert(...)` success line, add:

```js
      // Scenario 4: submit the visit-time proposal the modal required.
      // Server-side it messages the customer and opens the approval
      // prompt. A failure here never un-claims the job — the job page's
      // "Set visit time" button is the retry path.
      if (isAsapJob) {
        try {
          const proposalResult = await proposeSchedule(job.id, proposedDate, proposedTime.trim(), '');
          if (!proposalResult.success) {
            console.error('❌ Visit-time proposal failed (retry from job page):', proposalResult.error);
          }
        } catch (proposalErr) {
          console.error('❌ Visit-time proposal failed (retry from job page):', proposalErr);
        }
      }
```

- [ ] **Step 4: Add the picker to the confirmation modal**

In the `ConfirmationModal` JSX, after the penalties info box (`</div>` closing the orange box) and before the `<p className="text-sm text-gray-600 ...">` commitment line, add:

```jsx
            {isAsapJob && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  This is an ASAP job — propose your visit time <span className="text-red-500">*</span>
                </p>
                <label htmlFor="asap-date" className="sr-only">Visit date</label>
                <input
                  id="asap-date"
                  type="date"
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="w-full mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
                />
                <label htmlFor="asap-time" className="sr-only">Visit time</label>
                <input
                  id="asap-time"
                  type="text"
                  maxLength={20}
                  placeholder="Time, e.g. 2:00 PM"
                  value={proposedTime}
                  onChange={(e) => setProposedTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The customer will be asked to approve this time on WhatsApp.
                </p>
              </div>
            )}
```

Also disable the modal's Confirm Interest button when the ASAP fields are empty — change its `disabled={isLoading}` to:

```jsx
              disabled={isLoading || (isAsapJob && (!proposedDate || !proposedTime.trim()))}
```

- [ ] **Step 5: Build check + commit (anti-iCloud protocol)**

Run: `CI=true npx react-scripts build 2>&1 | tail -3`
Expected: "Compiled successfully."

```bash
git add src/components/handyman/ExpressInterestButton.jsx
git diff --staged
git commit -m "feat(schedule): ASAP accept modal requires a proposed visit time"
grep -c "isAsapJob" src/components/handyman/ExpressInterestButton.jsx   # expect ≥ 4
```

---

### Task 7: Rules — F4 enforcement (schedule fields server-only on update)

**Files:**
- Modify: `firestore.rules` — `jobSystemFields()` list and its comment.

- [ ] **Step 1: Extend jobSystemFields**

In `jobSystemFields()`, after `'lastCancelledAt'`, add:

```
        'lastCancelledAt',
        'preferredDate',
        'preferredTime',
        'preferredTiming',
        'scheduleHistory',
        'scheduledFromAsapAt'
```

Also add `'scheduleHistory'` and `'scheduledFromAsapAt'` to `jobCreateDeniedFields()` (after `'lastCancelledAt'`) — audit fields must not be seedable at create, consistent with the reassignment fields. `preferredDate`/`preferredTime`/`preferredTiming` stay OUT of the create-deny list: the booking flow legitimately writes them at CREATE; F4 governs changes *after* booking, which is exactly what the update-deny enforces.

Update the comment above `jobSystemFields()` to mention: schedule fields are single-writer via applyScheduleChange (F4) — an unrecorded client-side reschedule would desync the completion poll and date gate.

- [ ] **Step 2: Verify rules compile**

Start `/Users/liongchenglex/.npm-global/bin/firebase emulators:start --only firestore` in the background with output to a file (no `timeout` on this Mac; `npx firebase` hangs — use the global binary), wait for "All emulators ready", then `pkill -f "emulators:start --only firestore"`.
Expected: rules load with no errors.

- [ ] **Step 3: Self-review the write matrix**

Confirm no legitimate client write breaks: booking CREATE writes preferredDate/Time/Timing (create rule doesn't consult jobSystemFields — OK); ExpressInterestButton claim writes handymanId/status/acceptedAt/acceptedBy (none denied); JobActionButtons completion writes status/completedAt/completedBy/completionPollSentAt/completionPollSentBy (none denied); admin branch unaffected. Server-side writers (scheduleChange, cancelJobAssignment, releaseEscrowSimple) use the Admin SDK and bypass rules.

- [ ] **Step 4: Commit (anti-iCloud protocol)**

```bash
git add firestore.rules
git diff --staged
git commit -m "feat(rules): schedule fields are server-only on update (F4 single writer)"
grep -c "scheduledFromAsapAt" firestore.rules   # expect 2 (both lists)
```

---

### Task 8: Ops/E2E checklist (owner-run; no code)

- [ ] Submit the `schedule_proposal` Utility template to Meta (vars: 1 handyman name, 2 display date, 3 time, 4 job short-id); set `TWILIO_TEMPLATE_SCHEDULE_PROPOSAL` when approved (freeform fallback until then).
- [ ] Deploy functions + rules to dev.
- [ ] **Scenario 3 E2E:** in-progress scheduled job → handyman taps "Propose new time" → customer gets the proposal → reply YES → `preferredDate/Time` updated, `scheduleHistory` entry present, `completionPollSentAt` cleared, both parties get confirmations; reply NO on a second proposal → schedule unchanged, handyman notified.
- [ ] **Scenario 4 E2E:** ASAP job → accept modal demands date/time → claim + proposal land together (customer gets accepted-message then proposal) → YES → job behaves as scheduled (`scheduledFromAsapAt` set); decline → handyman sees "propose another" notice; verify "Set visit time" button on the job page as the retry path.
- [ ] **F4 rules check:** from the browser console as a handyman, attempt a direct Firestore update of `preferredDate` on an owned job → must be rejected by rules.
- [ ] **Regression:** completion poll fires for the NEW date only (not the old one); Mark Complete's date gate follows the new date; cancel flow still works alongside the new buttons.

## Self-review notes (applied)

- Spec §4.3: both entry paths implemented (handyman-initiated Task 5; customer-requested lands in F3/admin — admin-as-actor tooling is Stage 4/Scenario 12, marked out of scope). Decline branch keeps original time and notifies handyman: Task 4. Supersede-on-new-proposal: free via Stage-2 `openPrompt`.
- Spec §4.4: proposal required at accept (Task 6); `scheduledFromAsapAt` + poll/date-gate normalization (Tasks 1/3); post-decline stall handling deferred to Scenario 12 per spec build order.
- Spec §3 F4: single writer (Tasks 1/3), rules enforcement (Task 7), scheduleHistory with actor/via (Task 1), poll re-arm (Task 1).
- Type consistency: `SCHEDULE_APPROVAL_OPTIONS` actions ('approve'/'decline') match Task 4's dispatch; `applyScheduleChange` outcomes ('applied'/'wrong_status') consistent; payload keys (`proposedDate`, `proposedTime`, `note`, `isFirstTime`) match between Tasks 3 and 4; `proposeSchedule` service signature matches Tasks 5/6.
- Money invariant: `buildScheduleChangeUpdate` never touches paymentStatus (tested).
