# Second Visit (Scenario 11) + Customer No-Show/Access Issue (Scenario 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Scenario 11 (second visit with three entry doors: in-app button, evening deep-link disposition prompt, customer poll 3rd option + NO follow-up) and Scenario 8 (handyman-reported customer no-show / access issue) per `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md`.

**Architecture:** All new coordination rides the existing rails: F2 prompts (`functions/promptService.js` `openPrompt`/`interpretReply`/`markAnswered`), F4 single-writer (`applyScheduleChange` in `functions/index.js:2676`), the sweep ladders (`functions/sweepService.js` + `stuckStateSweep` orchestrator), and the attention queue (`needsAttention`/`attentionNeeded` job fields). Pure domain logic goes in a new `functions/visitService.js` (DI style, unit-tested); `functions/index.js` gets two endpoints, one scheduled function, and three webhook branches (index.js has no test harness — verified via `node --check`, the jest regression suite, and the E2E checklist).

**Tech Stack:** Firebase Functions v1 (Node), Firestore, Twilio WhatsApp (template-first with freeform fallback), React 18 + react-router 6 + Tailwind, Jest 29 (functions only).

## Global Constraints

- Money moves nowhere in this plan — escrow rules (§2b spec) untouched; no changes to release/refund code.
- Schedule fields (`preferredDate`/`preferredTime`/`preferredTiming`) are written ONLY via `applyScheduleChange` / `buildScheduleChangeUpdate` (F4). New `visits[]` mutation on approval rides the same transaction.
- Prompt convention (promptService.js:186): job-state write FIRST, `markAnswered` second, `markAnswered` always wrapped in try/catch that logs and continues.
- Template-first rule: any WhatsApp message to a party who did not just reply goes through `sendTwilioTemplateMessage(to, sid, vars, fallback)`; unset SID env degrades to freeform automatically (index.js:3398-3401). Webhook replies to the sender may use `sendTwilioMessage` freeform.
- Invalid-payload guard: every webhook branch that reads `prompt.payload` must close the prompt with `resultingAction: 'invalid_payload'` and forward to admin if required keys are missing (pattern index.js:2840-2852) — an `undefined` in a Firestore update throws → 500 → Twilio retry loop.
- Server-side deep links use `APP_URL` (index.js:19) and the live route `/job-details/:jobId` — NOT `/jobs/:id` (commented out in `src/App.jsx:89`).
- Dates: `preferredDate` is strict `YYYY-MM-DD`; "today" in Singapore = `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })`.
- Environment (memory notes): never run bare `npm install`; functions tests run with `cd functions && npm test`; there is no `timeout` shell command on this machine; CRA jest under `src/` is broken on Node 22 — frontend has no test harness, do not add one.
- New prompt types introduced here: `second_visit_approval`, `visit_disposition`, `completion_no_followup`, `access_issue_choice`. New attention types: `second_visit_declined`, `second_visit_no_date`, `no_show_reported`, `visit_problem`.
- Scenario 7 is NOT in scope: the poll follow-up's "never came" branch stubs to noShowReports[] + attention + admin email (Scenario 7's choice prompt replaces the stub at stage 5).

---

### Task 1: `functions/visitService.js` — pure domain module

**Files:**
- Create: `functions/visitService.js`
- Test: `functions/__tests__/visitService.test.js`

**Interfaces:**
- Consumes: nothing (pure; `toMs`-style tolerant parsing not needed — all timestamps here are ISO strings we write ourselves).
- Produces (used by Tasks 3–8):
  - `VisitError` — `Error` subclass with `.code`
  - `SECOND_VISIT_REASONS: string[]`, `VISIT_ISSUE_KINDS: string[]`, `MAX_VISIT_NOTE_LENGTH: 300`
  - `validateSecondVisitRequest(job, callerUid, reason, note)` → void, throws `VisitError(code)` with code ∈ `not_found | not_assigned | wrong_status | bad_reason | note_required`
  - `upsertPendingVisit(job, { proposedDate, proposedTime, reason, note, reportedVia, promptId, nowIso })` → `{ visits: Array, visitIndex: number }`
  - `buildVisitScheduledUpdate(job, { visitIndex, nowIso })` → `{ visits: Array }`, throws `VisitError('bad_visit')`
  - `buildVisitDeclinedUpdate(job, { visitIndex, nowIso })` → `{ visits: Array }`, throws `VisitError('bad_visit')`
  - `hasPendingSecondVisit(job)` → boolean (any entry `status === 'pending_schedule'`)
  - `findUnproposedVisitIndex(job)` → number (last entry with `status === 'pending_schedule'` and no `proposedDate`, else −1)
  - `shouldSendDisposition(job, todaySgt)` → boolean
  - `validateVisitIssueReport(job, callerUid, kind, todaySgt)` → void, throws `VisitError(code)` with code ∈ `not_found | not_assigned | wrong_status | bad_kind | not_visit_day`
  - `buildVisitIssueEntry({ kind, note, reportedBy, nowIso })` → accessIssues[] entry object

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/visitService.test.js` (conventions match `scheduleService.test.js`: fixed clock, fixture factory with `over` param, `describe` per export):

```js
/**
 * visitService — Scenario 11 (second visit) + Scenario 8 (visit issue)
 * pure domain logic. See docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md
 */
const {
  VisitError,
  SECOND_VISIT_REASONS,
  VISIT_ISSUE_KINDS,
  validateSecondVisitRequest,
  upsertPendingVisit,
  buildVisitScheduledUpdate,
  buildVisitDeclinedUpdate,
  hasPendingSecondVisit,
  findUnproposedVisitIndex,
  shouldSendDisposition,
  validateVisitIssueReport,
  buildVisitIssueEntry,
} = require('../visitService');

const NOW_ISO = '2026-07-29T11:00:00.000Z';
const TODAY_SGT = '2026-07-29';

const job = (over = {}) => ({
  status: 'in_progress',
  handymanId: 'hm-1',
  preferredTiming: 'Schedule',
  preferredDate: TODAY_SGT,
  preferredTime: '2:00 PM',
  customerPhone: '+6591234567',
  ...over,
});

describe('validateSecondVisitRequest', () => {
  test('accepts a valid request', () => {
    expect(() => validateSecondVisitRequest(job(), 'hm-1', 'parts_materials', '')).not.toThrow();
  });
  test('rejects missing job', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(null, 'hm-1', 'parts_materials', ''); }
    catch (e) { expect(e.code).toBe('not_found'); }
  });
  test('rejects a non-assigned caller', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job(), 'hm-2', 'parts_materials', ''); }
    catch (e) { expect(e.code).toBe('not_assigned'); }
  });
  test('rejects wrong status', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job({ status: 'pending_admin_approval' }), 'hm-1', 'parts_materials', ''); }
    catch (e) { expect(e.code).toBe('wrong_status'); }
  });
  test('rejects unknown reason', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job(), 'hm-1', 'because', ''); }
    catch (e) { expect(e.code).toBe('bad_reason'); }
  });
  test("requires a note for reason 'other'", () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job(), 'hm-1', 'other', '  '); }
    catch (e) { expect(e.code).toBe('note_required'); }
  });
});

describe('upsertPendingVisit', () => {
  test('appends a new entry when none pending', () => {
    const { visits, visitIndex } = upsertPendingVisit(job(), {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'parts_materials', note: '', reportedVia: 'app', promptId: null, nowIso: NOW_ISO,
    });
    expect(visitIndex).toBe(0);
    expect(visits[0]).toMatchObject({
      status: 'pending_schedule', proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'parts_materials', reportedVia: 'app', createdAt: NOW_ISO,
    });
  });
  test('fills an existing unproposed entry instead of appending', () => {
    const j = job({ visits: [{ status: 'pending_schedule', proposedDate: null, reason: null, reportedVia: 'customer_poll', createdAt: '2026-07-28T02:00:00.000Z' }] });
    const { visits, visitIndex } = upsertPendingVisit(j, {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'customer_request', note: 'per customer', reportedVia: 'app', promptId: 'p1', nowIso: NOW_ISO,
    });
    expect(visitIndex).toBe(0);
    expect(visits).toHaveLength(1);
    expect(visits[0].proposedDate).toBe('2026-08-02');
    expect(visits[0].reportedVia).toBe('customer_poll'); // origin preserved
    expect(visits[0].promptId).toBe('p1');
  });
  test('truncates the note to 300 chars and nulls empty notes', () => {
    const { visits } = upsertPendingVisit(job(), {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'other', note: 'x'.repeat(400), reportedVia: 'app', promptId: null, nowIso: NOW_ISO,
    });
    expect(visits[0].note).toHaveLength(300);
  });
});

describe('buildVisitScheduledUpdate / buildVisitDeclinedUpdate', () => {
  const pending = () => job({ visits: [{ status: 'pending_schedule', proposedDate: '2026-08-02', createdAt: NOW_ISO }] });
  test('marks the entry scheduled', () => {
    const { visits } = buildVisitScheduledUpdate(pending(), { visitIndex: 0, nowIso: NOW_ISO });
    expect(visits[0].status).toBe('scheduled');
    expect(visits[0].scheduledAt).toBe(NOW_ISO);
  });
  test('marks the entry declined', () => {
    const { visits } = buildVisitDeclinedUpdate(pending(), { visitIndex: 0, nowIso: NOW_ISO });
    expect(visits[0].status).toBe('declined');
    expect(visits[0].declinedAt).toBe(NOW_ISO);
  });
  test('throws bad_visit when index is stale or entry not pending', () => {
    expect.assertions(2);
    try { buildVisitScheduledUpdate(pending(), { visitIndex: 3, nowIso: NOW_ISO }); }
    catch (e) { expect(e.code).toBe('bad_visit'); }
    const done = job({ visits: [{ status: 'done', createdAt: NOW_ISO }] });
    try { buildVisitScheduledUpdate(done, { visitIndex: 0, nowIso: NOW_ISO }); }
    catch (e) { expect(e.code).toBe('bad_visit'); }
  });
});

describe('hasPendingSecondVisit / findUnproposedVisitIndex', () => {
  test('detects pending entries', () => {
    expect(hasPendingSecondVisit(job())).toBe(false);
    expect(hasPendingSecondVisit(job({ visits: [{ status: 'scheduled' }] }))).toBe(false);
    expect(hasPendingSecondVisit(job({ visits: [{ status: 'pending_schedule' }] }))).toBe(true);
  });
  test('finds only unproposed pending entries', () => {
    expect(findUnproposedVisitIndex(job())).toBe(-1);
    expect(findUnproposedVisitIndex(job({ visits: [{ status: 'pending_schedule', proposedDate: '2026-08-02' }] }))).toBe(-1);
    expect(findUnproposedVisitIndex(job({ visits: [{ status: 'declined' }, { status: 'pending_schedule', proposedDate: null }] }))).toBe(1);
  });
});

describe('shouldSendDisposition', () => {
  test('true for a silent visit-day job', () => {
    expect(shouldSendDisposition(job(), TODAY_SGT)).toBe(true);
  });
  test.each([
    ['wrong day', job({ preferredDate: '2026-07-28' })],
    ['no date', job({ preferredDate: null })],
    ['ASAP timing', job({ preferredTiming: 'Immediate' })],
    ['not in_progress', job({ status: 'pending_confirmation' })],
    ['no handyman', job({ handymanId: null })],
    ['poll already sent', job({ completionPollSentAt: NOW_ISO })],
    ['second visit already pending', job({ visits: [{ status: 'pending_schedule' }] })],
    ['already sent for this date', job({ visitDispositionSentFor: TODAY_SGT })],
  ])('false when %s', (_label, j) => {
    expect(shouldSendDisposition(j, TODAY_SGT)).toBe(false);
  });
});

describe('validateVisitIssueReport', () => {
  test('no_access allowed on the visit day', () => {
    expect(() => validateVisitIssueReport(job(), 'hm-1', 'no_access', TODAY_SGT)).not.toThrow();
  });
  test('no_access rejected before the visit day', () => {
    expect.assertions(1);
    try { validateVisitIssueReport(job({ preferredDate: '2026-07-30' }), 'hm-1', 'no_access', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('not_visit_day'); }
  });
  test('cannot_finish allowed on or after the visit day', () => {
    expect(() => validateVisitIssueReport(job({ preferredDate: '2026-07-28' }), 'hm-1', 'cannot_finish', TODAY_SGT)).not.toThrow();
  });
  test('rejects unknown kind', () => {
    expect.assertions(1);
    try { validateVisitIssueReport(job(), 'hm-1', 'meteor', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('bad_kind'); }
  });
  test('rejects non-assigned caller and wrong status', () => {
    expect.assertions(2);
    try { validateVisitIssueReport(job(), 'hm-2', 'no_access', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('not_assigned'); }
    try { validateVisitIssueReport(job({ status: 'completed' }), 'hm-1', 'no_access', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('wrong_status'); }
  });
});

describe('buildVisitIssueEntry', () => {
  test('builds a trimmed entry', () => {
    expect(buildVisitIssueEntry({ kind: 'no_access', note: '  locked gate  ', reportedBy: 'hm-1', nowIso: NOW_ISO }))
      .toEqual({ kind: 'no_access', note: 'locked gate', reportedBy: 'hm-1', reportedAt: NOW_ISO });
  });
  test('nulls an empty note', () => {
    expect(buildVisitIssueEntry({ kind: 'cannot_finish', note: '', reportedBy: 'hm-1', nowIso: NOW_ISO }).note).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest __tests__/visitService.test.js`
Expected: FAIL — `Cannot find module '../visitService'`

- [ ] **Step 3: Implement `functions/visitService.js`**

```js
/**
 * visitService.js — pure domain logic for Scenario 11 (second visit)
 * and Scenario 8 (customer no-show / access issue).
 *
 * No Firestore imports: callers pass job data in and write the returned
 * update objects inside their own transactions, mirroring
 * jobReassignment.js / scheduleService.js.
 *
 * visits[] entry shape (spec §Scenario 11 data model):
 *   { proposedDate: 'YYYY-MM-DD'|null, proposedTime: string|null,
 *     status: 'pending_schedule'|'scheduled'|'declined'|'done',
 *     reason: string|null, note: string|null,
 *     reportedVia: 'app'|'disposition_link'|'customer_poll'|'admin',
 *     createdAt: ISO, promptId: string|null,
 *     scheduledAt?: ISO, declinedAt?: ISO }
 */

const SECOND_VISIT_REASONS = Object.freeze([
  'parts_materials',
  'job_bigger_than_expected',
  'customer_request',
  'other',
]);

const VISIT_ISSUE_KINDS = Object.freeze(['no_access', 'cannot_finish']);

const MAX_VISIT_NOTE_LENGTH = 300;

class VisitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VisitError';
    this.code = code;
  }
}

function cleanNote(note) {
  const trimmed = String(note || '').trim().slice(0, MAX_VISIT_NOTE_LENGTH);
  return trimmed || null;
}

function visitsOf(job) {
  return Array.isArray(job && job.visits) ? job.visits : [];
}

function validateSecondVisitRequest(job, callerUid, reason, note) {
  if (!job) throw new VisitError('not_found', 'Job not found');
  if (job.handymanId !== callerUid) throw new VisitError('not_assigned', 'You are not assigned to this job');
  if (job.status !== 'in_progress') throw new VisitError('wrong_status', 'Job is not in progress');
  if (!SECOND_VISIT_REASONS.includes(reason)) throw new VisitError('bad_reason', 'Unknown reason');
  if (reason === 'other' && !String(note || '').trim()) throw new VisitError('note_required', 'Please describe the reason');
}

function hasPendingSecondVisit(job) {
  return visitsOf(job).some((v) => v && v.status === 'pending_schedule');
}

function findUnproposedVisitIndex(job) {
  const visits = visitsOf(job);
  for (let i = visits.length - 1; i >= 0; i--) {
    const v = visits[i];
    if (v && v.status === 'pending_schedule' && !v.proposedDate) return i;
  }
  return -1;
}

/**
 * Create or fill the pending second-visit entry. A customer-initiated
 * intent (poll option 3) creates a dateless pending entry; when the
 * handyman later proposes, we FILL that entry rather than append —
 * `reportedVia` keeps recording who first raised the visit.
 */
function upsertPendingVisit(job, { proposedDate, proposedTime, reason, note, reportedVia, promptId, nowIso }) {
  const visits = visitsOf(job).slice();
  const existingIdx = findUnproposedVisitIndex(job);
  if (existingIdx >= 0) {
    visits[existingIdx] = {
      ...visits[existingIdx],
      proposedDate: proposedDate || null,
      proposedTime: proposedTime || null,
      reason: reason || visits[existingIdx].reason || null,
      note: cleanNote(note) || visits[existingIdx].note || null,
      promptId: promptId || null,
    };
    return { visits, visitIndex: existingIdx };
  }
  visits.push({
    proposedDate: proposedDate || null,
    proposedTime: proposedTime || null,
    status: 'pending_schedule',
    reason: reason || null,
    note: cleanNote(note),
    reportedVia,
    createdAt: nowIso,
    promptId: promptId || null,
  });
  return { visits, visitIndex: visits.length - 1 };
}

function transitionVisit(job, visitIndex, toStatus, stampField, nowIso) {
  const visits = visitsOf(job).slice();
  const entry = visits[visitIndex];
  if (!entry || entry.status !== 'pending_schedule') {
    throw new VisitError('bad_visit', 'Second-visit entry missing or no longer pending');
  }
  visits[visitIndex] = { ...entry, status: toStatus, [stampField]: nowIso };
  return { visits };
}

function buildVisitScheduledUpdate(job, { visitIndex, nowIso }) {
  return transitionVisit(job, visitIndex, 'scheduled', 'scheduledAt', nowIso);
}

function buildVisitDeclinedUpdate(job, { visitIndex, nowIso }) {
  return transitionVisit(job, visitIndex, 'declined', 'declinedAt', nowIso);
}

/**
 * Door 2 candidate check: visit day ended with the handyman silent.
 * `todaySgt` is 'YYYY-MM-DD' in Asia/Singapore, computed by the caller.
 * `visitDispositionSentFor` makes the evening send idempotent per
 * (job, preferredDate) — a reschedule re-arms it for the new date.
 */
function shouldSendDisposition(job, todaySgt) {
  if (!job || job.status !== 'in_progress') return false;
  if (!job.handymanId) return false;
  if (job.preferredTiming !== 'Schedule') return false;
  if (!job.preferredDate || job.preferredDate !== todaySgt) return false;
  if (job.completionPollSentAt) return false;
  if (hasPendingSecondVisit(job)) return false;
  if (job.visitDispositionSentFor === job.preferredDate) return false;
  return true;
}

/**
 * Scenario 8 gate. 'no_access' is a visit-day-only report ("I'm at the
 * door"); 'cannot_finish' may also be filed after the visit day (the
 * problem often surfaces once parts/scope are checked at home).
 * String comparison is safe: strict YYYY-MM-DD both sides.
 */
function validateVisitIssueReport(job, callerUid, kind, todaySgt) {
  if (!job) throw new VisitError('not_found', 'Job not found');
  if (job.handymanId !== callerUid) throw new VisitError('not_assigned', 'You are not assigned to this job');
  if (job.status !== 'in_progress') throw new VisitError('wrong_status', 'Job is not in progress');
  if (!VISIT_ISSUE_KINDS.includes(kind)) throw new VisitError('bad_kind', 'Unknown issue kind');
  if (!job.preferredDate) throw new VisitError('not_visit_day', 'No visit date is set for this job yet');
  if (kind === 'no_access' && job.preferredDate !== todaySgt) {
    throw new VisitError('not_visit_day', 'Access issues can only be reported on the visit day');
  }
  if (kind === 'cannot_finish' && job.preferredDate > todaySgt) {
    throw new VisitError('not_visit_day', 'This can only be reported on or after the visit day');
  }
}

function buildVisitIssueEntry({ kind, note, reportedBy, nowIso }) {
  return { kind, note: cleanNote(note), reportedBy, reportedAt: nowIso };
}

module.exports = {
  VisitError,
  SECOND_VISIT_REASONS,
  VISIT_ISSUE_KINDS,
  MAX_VISIT_NOTE_LENGTH,
  validateSecondVisitRequest,
  upsertPendingVisit,
  buildVisitScheduledUpdate,
  buildVisitDeclinedUpdate,
  hasPendingSecondVisit,
  findUnproposedVisitIndex,
  shouldSendDisposition,
  validateVisitIssueReport,
  buildVisitIssueEntry,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest __tests__/visitService.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add functions/visitService.js functions/__tests__/visitService.test.js
git commit -m "feat(functions): visitService — pure domain logic for second visits and visit issues"
```

---

### Task 2: Sweep detectors — second-visit ladder + silent disposition expiry

**Files:**
- Modify: `functions/sweepService.js`
- Test: `functions/__tests__/sweepService.test.js` (append)

**Interfaces:**
- Consumes: `SWEEP` thresholds object, `toMs(v)` (both already in sweepService.js), `evaluatePrompt(prompt, nowMs)` (sweepService.js:41).
- Produces:
  - `SWEEP.SECOND_VISIT_NUDGE_HOURS = 24`, `SWEEP.SECOND_VISIT_ESCALATE_HOURS = 48` (spec ladder row "Second visit needed, no date")
  - `evaluateSecondVisit(job, nowMs)` → `'ok' | 'nudge' | 'escalate'` — used by Task 8's orchestrator ladder
  - `evaluatePrompt` gains a new return value `'expire_silent'` for `type === 'visit_disposition'` prompts past expiry (spec: "none extra — the next-morning customer poll IS the backstop")

- [ ] **Step 1: Write the failing tests** (append to `functions/__tests__/sweepService.test.js`, reusing its `NOW_MS`/`hoursAgo` helpers)

```js
describe('evaluateSecondVisit', () => {
  const jobWithVisit = (over = {}, visitOver = {}) => ({
    status: 'in_progress',
    visits: [{ status: 'pending_schedule', proposedDate: null, createdAt: new Date(hoursAgo(30)).toISOString(), ...visitOver }],
    ...over,
  });
  test('ok when no pending dateless visit', () => {
    expect(evaluateSecondVisit({ status: 'in_progress' }, NOW_MS)).toBe('ok');
    expect(evaluateSecondVisit(jobWithVisit({}, { proposedDate: '2026-08-02' }), NOW_MS)).toBe('ok');
    expect(evaluateSecondVisit(jobWithVisit({}, { status: 'scheduled' }), NOW_MS)).toBe('ok');
  });
  test('ok under 24h', () => {
    expect(evaluateSecondVisit(jobWithVisit({}, { createdAt: new Date(hoursAgo(10)).toISOString() }), NOW_MS)).toBe('ok');
  });
  test('nudge between 24h and 48h when not yet nudged', () => {
    expect(evaluateSecondVisit(jobWithVisit(), NOW_MS)).toBe('nudge');
  });
  test('ok between 24h and 48h when already nudged', () => {
    expect(evaluateSecondVisit(jobWithVisit({ sweepNudges: { second_visit_no_date: new Date(hoursAgo(5)).toISOString() } }), NOW_MS)).toBe('ok');
  });
  test('escalate past 48h', () => {
    expect(evaluateSecondVisit(jobWithVisit({}, { createdAt: new Date(hoursAgo(50)).toISOString() }), NOW_MS)).toBe('escalate');
  });
});

describe('evaluatePrompt — visit_disposition', () => {
  test('expires silently instead of nudging', () => {
    const p = { type: 'visit_disposition', status: 'open', expiresAt: new Date(hoursAgo(1)).toISOString() };
    expect(evaluatePrompt(p, NOW_MS)).toBe('expire_silent');
  });
  test('still ok before expiry', () => {
    const p = { type: 'visit_disposition', status: 'open', expiresAt: new Date(NOW_MS + 3600000).toISOString() };
    expect(evaluatePrompt(p, NOW_MS)).toBe('ok');
  });
});
```

Add `evaluateSecondVisit` to the `require('../sweepService')` destructure at the top of the test file.

- [ ] **Step 2: Run to verify failure**

Run: `cd functions && npx jest __tests__/sweepService.test.js`
Expected: FAIL — `evaluateSecondVisit is not a function` / `expire_silent` expectation fails.

- [ ] **Step 3: Implement in `functions/sweepService.js`**

Add to the frozen `SWEEP` object (sweepService.js:12-20):

```js
  SECOND_VISIT_NUDGE_HOURS: 24,
  SECOND_VISIT_ESCALATE_HOURS: 48,
```

In `evaluatePrompt` (sweepService.js:41), before the existing expired/nudged logic, add:

```js
  // visit_disposition prompts have their own backstop (the next-morning
  // completion poll) — never nudge or escalate, just close them out.
  if (prompt.type === 'visit_disposition') {
    const exp = toMs(prompt.expiresAt);
    return exp != null && exp <= nowMs ? 'expire_silent' : 'ok';
  }
```

Add the new detector (alongside `evaluateAsapJob`) and export it:

```js
/**
 * Scenario 11 ladder — a second visit was flagged (poll option 3 or a
 * declined-then-reset proposal) but the handyman has not proposed a
 * date. 24h → nudge once, 48h → attention queue.
 */
function evaluateSecondVisit(job, nowMs) {
  const visits = Array.isArray(job.visits) ? job.visits : [];
  let entry = null;
  for (let i = visits.length - 1; i >= 0; i--) {
    const v = visits[i];
    if (v && v.status === 'pending_schedule' && !v.proposedDate) { entry = v; break; }
  }
  if (!entry) return 'ok';
  const created = toMs(entry.createdAt);
  if (created == null) return 'ok';
  const ageHours = (nowMs - created) / 3600000;
  if (ageHours >= SWEEP.SECOND_VISIT_ESCALATE_HOURS) return 'escalate';
  if (ageHours < SWEEP.SECOND_VISIT_NUDGE_HOURS) return 'ok';
  const nudged = job.sweepNudges && job.sweepNudges.second_visit_no_date;
  return nudged ? 'ok' : 'nudge';
}
```

- [ ] **Step 4: Run the full functions suite**

Run: `cd functions && npm test`
Expected: PASS — new tests green, no regressions (existing `evaluatePrompt` tests unaffected because none use `type: 'visit_disposition'`).

- [ ] **Step 5: Commit**

```bash
git add functions/sweepService.js functions/__tests__/sweepService.test.js
git commit -m "feat(sweep): second-visit no-date ladder + silent visit_disposition expiry"
```

---

### Task 3: Backend — `requestSecondVisit` endpoint (Door 1)

**Files:**
- Modify: `functions/index.js` (new constants near line 135; new export after `proposeSchedule` ~line 4520; small helper near the other prompt helpers)

**Interfaces:**
- Consumes: `verifyAuthToken` (index.js:194), `checkRateLimit` (:591), `writeAuditLog` (:632), `validateScheduleProposal`/`ScheduleError` (scheduleService), `openPrompt` (promptService), `sendTwilioTemplateMessage` (:3396), `formatPhoneToWhatsApp` (:3458), `SCHEDULE_APPROVAL_OPTIONS` (:132), Task 1's `validateSecondVisitRequest`/`upsertPendingVisit`.
- Produces:
  - `POST /requestSecondVisit` — body `{ jobId, proposedDate, proposedTime, reason, note }`, Bearer handyman auth, returns `{ success: true, promptId }`; errors `{ error, code }` with codes from Task 1 mapped to `{not_found:404, not_assigned:403, wrong_status:409, bad_reason:400, note_required:400}` + ScheduleError codes → 400.
  - Helper `supersedeOpenPrompts(db, jobId, types)` → number superseded (reused by Tasks 5, 6, 7).
  - Opens prompt `type: 'second_visit_approval'`, `toRole: 'customer'`, `options: SCHEDULE_APPROVAL_OPTIONS`, `payload: { proposedDate, proposedTime, visitIndex, reason }` — consumed by Task 4's webhook branch.
  - New env var read inline: `TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL`.

- [ ] **Step 1: Add the shared helper** (place next to the other prompt utilities, after `applyCompletionAnswer` ~index.js:2665)

```js
/**
 * Close every open prompt of the given types on a job (e.g. an open
 * completion poll or the evening disposition link once the handyman
 * has acted through another door). Best-effort: callers treat failures
 * as non-fatal because the job-state write has already committed.
 */
async function supersedeOpenPrompts(db, jobId, types) {
  let count = 0;
  const col = db.collection('jobs').doc(jobId).collection('prompts');
  for (const type of types) {
    const snap = await col.where('type', '==', type).where('status', '==', 'open').get();
    for (const doc of snap.docs) {
      await doc.ref.update({ status: 'superseded', supersededAt: new Date().toISOString() });
      count++;
    }
  }
  return count;
}
```

- [ ] **Step 2: Add the requires and the endpoint**

At the top of index.js, next to the existing `require('./scheduleService')` line, add:

```js
const {
  VisitError, SECOND_VISIT_REASONS, VISIT_ISSUE_KINDS,
  validateSecondVisitRequest, upsertPendingVisit,
  buildVisitScheduledUpdate, buildVisitDeclinedUpdate,
  hasPendingSecondVisit, shouldSendDisposition,
  validateVisitIssueReport, buildVisitIssueEntry,
} = require('./visitService');
```

New export (model it line-for-line on `proposeSchedule` at index.js:4368 — cors wrap, 405 guard, auth, error mapping):

```js
// ===================================
// SECOND VISIT — Scenario 11 Door 1 (and the disposition sheet's
// "Needs another visit"). Opens a second_visit_approval prompt to the
// customer; the schedule only moves when they approve (Task 4 branch).
// ===================================
exports.requestSecondVisit = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const decodedToken = await verifyAuthToken(req);
      const { jobId, proposedDate, proposedTime, reason, note } = req.body || {};
      if (!jobId) return res.status(400).json({ error: 'jobId is required', code: 'bad_request' });

      const rl = await checkRateLimit(`second_visit_${decodedToken.uid}`, 10, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many requests', retryAfterSeconds: rl.retryAfterSeconds });
      }

      try {
        validateScheduleProposal({ date: proposedDate, time: proposedTime });
      } catch (schedErr) {
        if (schedErr.name === 'ScheduleError') return res.status(400).json({ error: schedErr.message, code: schedErr.code });
        throw schedErr;
      }

      const db = admin.firestore();
      const nowIso = new Date().toISOString();
      let visitIndex;
      let jobData;
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(db.collection('jobs').doc(jobId));
          const job = snap.exists ? snap.data() : null;
          validateSecondVisitRequest(job, decodedToken.uid, reason, note);
          const result = upsertPendingVisit(job, {
            proposedDate, proposedTime: String(proposedTime), reason, note,
            reportedVia: 'app', promptId: null, nowIso,
          });
          visitIndex = result.visitIndex;
          jobData = job;
          tx.update(snap.ref, { visits: result.visits, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
      } catch (visitErr) {
        if (visitErr.name === 'VisitError') {
          const statusMap = { not_found: 404, not_assigned: 403, wrong_status: 409, bad_reason: 400, note_required: 400 };
          return res.status(statusMap[visitErr.code] || 400).json({ error: visitErr.message, code: visitErr.code });
        }
        throw visitErr;
      }

      // The visit request answers both "how did the visit go?" and any
      // not-yet-answered completion poll — close them so a later customer
      // reply can't race the new proposal. Best-effort after the commit.
      try {
        await supersedeOpenPrompts(db, jobId, ['visit_disposition', 'completion_confirmation']);
      } catch (supErr) {
        console.error('⚠️ supersedeOpenPrompts failed (continuing):', supErr);
      }

      // Customer approval ask — template-first (business may be outside
      // the 24h session window), freeform fallback until T13 is approved.
      const jobShortId = jobId.slice(-6);
      const displayDate = new Date(proposedDate).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' });
      const handymanName = (jobData.acceptedBy && jobData.acceptedBy.name) || 'Your handyman';
      const fallback = `🔁 ${handymanName} says another visit is needed for Job #${jobShortId} and proposes ${displayDate}, ${proposedTime}.\n\n👉 Reply *YES* to approve\n👉 Reply *NO* to decline`;
      await sendTwilioTemplateMessage(
        formatPhoneToWhatsApp(jobData.customerPhone),
        process.env.TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL,
        { '1': handymanName, '2': jobShortId, '3': displayDate, '4': String(proposedTime) },
        fallback
      );

      const { promptId } = await openPrompt({
        db, jobId, type: 'second_visit_approval',
        toPhone: jobData.customerPhone, toRole: 'customer',
        question: `Approve a second visit on ${displayDate}, ${proposedTime}? (Job #${jobShortId})`,
        options: SCHEDULE_APPROVAL_OPTIONS,
        payload: { proposedDate, proposedTime: String(proposedTime), visitIndex, reason },
      });

      // Spec: >2 visits alerts the admin (repeatable but admin-visible).
      // visits[] holds RETURN visits; visitIndex >= 1 means this is at
      // least the 3rd visit overall (booking + 2 returns).
      if (visitIndex >= 1) {
        await sendAdminEmail(
          `👀 Visit ${visitIndex + 2} requested — Job #${jobShortId}`,
          `<p>Job <b>${escapeHtml(jobId)}</b> is on return visit #${visitIndex + 1} (visit ${visitIndex + 2} overall). Worth a look — repeated visits often mean a scope problem (Scenario 10).</p>`
        );
      }

      await writeAuditLog('second_visit_requested', decodedToken, { jobId, proposedDate, reason });
      return res.status(200).json({ success: true, promptId });
    } catch (error) {
      console.error('❌ requestSecondVisit error:', error);
      if (error.message && error.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' });
      return res.status(500).json({ error: 'Failed to request second visit' });
    }
  });
});
```

- [ ] **Step 3: Syntax check + regression suite**

Run: `cd functions && node --check index.js && npm test`
Expected: no syntax errors; all existing tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/index.js
git commit -m "feat(functions): requestSecondVisit endpoint — Scenario 11 Door 1"
```

---

### Task 4: Webhook — `second_visit_approval` branch + `applyScheduleChange` extension

**Files:**
- Modify: `functions/index.js` — `applyScheduleChange` (:2676) and the webhook dispatch chain (insert branch after the `schedule_pick_approval` block ends at ~:3126, before the unknown-type fallback at :3128)

**Interfaces:**
- Consumes: prompt `payload { proposedDate, proposedTime, visitIndex, reason }` from Task 3; `buildVisitScheduledUpdate`/`buildVisitDeclinedUpdate` (Task 1); `buildAttentionUpdate` (sweepService.js:96); `sendAdminEmail` (:3474); `escapeHtml` (:3507); `TWILIO_TEMPLATE_SCHEDULE_CONFIRMED` confirmation pattern (:2909-2914, :3058-3063).
- Produces: `applyScheduleChange` gains an optional `extraUpdateFn(jobData) → object` merged into the transactional update — the ONLY way `visits[]` flips to `scheduled` atomically with the date move.

- [ ] **Step 1: Extend `applyScheduleChange`** (index.js:2676) — add the optional param and merge:

```js
async function applyScheduleChange({ db, jobId, newDate, newTime, actor, via, note, promptId, extraUpdateFn }) {
```

Inside the transaction, after `const update = buildScheduleChangeUpdate(job, {...})`, add:

```js
      // Optional rider for callers that must mutate other job fields in
      // the SAME transaction as the schedule move (e.g. flipping a
      // visits[] entry to 'scheduled'). May throw (e.g. VisitError) to
      // abort the change.
      if (extraUpdateFn) Object.assign(update, extraUpdateFn(job));
```

No other call sites change (the param is optional).

- [ ] **Step 2: Add the webhook branch** — insert after the `schedule_pick_approval` block, following the exact shape of the `schedule_approval` branch (:2830). Full code:

```js
        if (verdict.prompt.type === 'second_visit_approval') {
          const p = verdict.prompt.payload || {};
          const jobShortId = verdict.prompt.jobId.slice(-6);
          // Invalid-payload guard (see schedule_approval at 2840) — a
          // malformed prompt must not 500 the webhook into Twilio retries.
          if (!p.proposedDate || !p.proposedTime || typeof p.visitIndex !== 'number') {
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'invalid_payload' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await forwardUnmatchedInbound({ from: From, body: Body, mediaUrls, reason: 'unmatched_reply' });
            return res.status(200).json({ received: true, processed: false, reason: 'invalid second_visit payload' });
          }

          if (verdict.action === 'approve') {
            let changeResult;
            try {
              changeResult = await applyScheduleChange({
                db: admin.firestore(), jobId: verdict.prompt.jobId,
                newDate: p.proposedDate, newTime: p.proposedTime,
                actor: senderKey, via: 'whatsapp_reply',
                note: `second visit (${p.reason || 'unspecified'})`,
                promptId: verdict.prompt.id,
                extraUpdateFn: (job) => buildVisitScheduledUpdate(job, { visitIndex: p.visitIndex, nowIso: new Date().toISOString() }),
              });
            } catch (err) {
              if (err.name === 'VisitError' || (err.message && err.message.includes('WRONG_STATUS'))) {
                try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'wrong_status' }); }
                catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
                await sendTwilioMessage(From, `ℹ️ Job #${jobShortId} is no longer awaiting this approval — our team will follow up if anything is needed.`);
                return res.status(200).json({ received: true, processed: false, reason: 'second visit approve on wrong state' });
              }
              throw err;
            }
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'applied' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }

            const displayDate = new Date(p.proposedDate).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' });
            await sendTwilioMessage(From, `✅ Second visit confirmed for Job #${jobShortId}: ${displayDate}, ${p.proposedTime}. See you then!`);
            // Handyman did not just reply → template-first confirmation.
            try {
              const hmSnap = await admin.firestore().collection('handymen').doc(changeResult.job.handymanId).get();
              const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
              if (hmPhone) {
                await sendTwilioTemplateMessage(
                  formatPhoneToWhatsApp(hmPhone),
                  process.env.TWILIO_TEMPLATE_SCHEDULE_CONFIRMED,
                  { '1': jobShortId, '2': displayDate, '3': String(p.proposedTime) },
                  `✅ Second visit approved — Job #${jobShortId} is now scheduled for ${displayDate}, ${p.proposedTime}.`
                );
              }
            } catch (notifyErr) {
              console.error('⚠️ Handyman second-visit confirmation failed:', notifyErr);
            }
            return res.status(200).json({ received: true, processed: true, action: 'second_visit_scheduled', via: 'prompt' });
          }

          if (verdict.action === 'decline') {
            // Spec: Decline → F3/admin mediates (often becomes price talk
            // or a cancel). Mark entry declined + flag attention; NO
            // automated renegotiation round.
            const db = admin.firestore();
            const nowIso = new Date().toISOString();
            try {
              await db.runTransaction(async (tx) => {
                const snap = await tx.get(db.collection('jobs').doc(verdict.prompt.jobId));
                if (!snap.exists) return;
                const upd = buildVisitDeclinedUpdate(snap.data(), { visitIndex: p.visitIndex, nowIso });
                Object.assign(upd, buildAttentionUpdate('second_visit_declined', { detail: `reason: ${p.reason || 'unspecified'}`, promptId: verdict.prompt.id, nowIso }));
                tx.update(snap.ref, upd);
              });
            } catch (txErr) {
              console.error('⚠️ second-visit decline write failed (admin email still goes out):', txErr);
            }
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'declined' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await sendAdminEmail(
              `🔁 Second visit declined — Job #${jobShortId}`,
              `<p>The customer declined a second visit for job <b>${escapeHtml(verdict.prompt.jobId)}</b> (proposed ${escapeHtml(p.proposedDate)}, ${escapeHtml(String(p.proposedTime))}; reason: ${escapeHtml(p.reason || 'unspecified')}). Please mediate — this often becomes a price discussion or a cancellation.</p>`
            );
            await sendTwilioMessage(From, `👍 Understood — no second visit is booked for Job #${jobShortId}. Our team will contact you shortly to sort out next steps.`);
            return res.status(200).json({ received: true, processed: true, action: 'second_visit_declined', via: 'prompt' });
          }
        }
```

Note: `buildAttentionUpdate` must be added to the existing `require('./sweepService')` destructure at the top of index.js if not already imported there (the sweep orchestrator uses it — check the existing require line and extend it rather than adding a second require).

- [ ] **Step 3: Syntax check + regression suite**

Run: `cd functions && node --check index.js && npm test`
Expected: clean check, suite PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/index.js
git commit -m "feat(webhook): second_visit_approval branch; applyScheduleChange extraUpdateFn rider"
```

---

### Task 5: Door 3 — poll 3rd option, NO follow-up, coming-back handler

**Files:**
- Modify: `functions/index.js` — `COMPLETION_PROMPT_OPTIONS` (:123), new `COMPLETION_NO_FOLLOWUP_OPTIONS` constant, the `completion_confirmation` webhook branch (:2784-2828), new `completion_no_followup` branch, poll copy in `autoTriggerCompletionPoll` (:3827-3838) and in `sendWhatsAppNotification`'s `job_completion` case (:2543-2551)

**Interfaces:**
- Consumes: `applyCompletionAnswer` (:2615 — unchanged), `upsertPendingVisit`/`hasPendingSecondVisit` (Task 1), `buildAttentionUpdate` (sweepService), `supersedeOpenPrompts` (Task 3), `openPrompt`, `APP_URL` (:19).
- Produces:
  - `COMPLETION_PROMPT_OPTIONS` gains `coming_back` action + numeric keys — the poll's contract with the router.
  - Prompt type `completion_no_followup` (24h expiry) with `COMPLETION_NO_FOLLOWUP_OPTIONS` → actions `problem | never_came`.
  - Job fields: `noShowReports[]` entries `{ reportedAt, via: 'poll_followup', promptId }`; visits[] dateless pending entry via `coming_back`.
  - New env var read inline: `TWILIO_TEMPLATE_SECOND_VISIT_NEEDED` (handyman "propose a return time" ping; freeform fallback).

- [ ] **Step 1: Replace the options constant** (index.js:123-127) and add the follow-up constant below it:

```js
const COMPLETION_PROMPT_OPTIONS = {
  'YES': 'confirm', 'CONFIRM COMPLETE': 'confirm', 'CONFIRM': 'confirm',
  'Y': 'confirm', '1': 'confirm',
  'NO': 'reject', 'REPORT ISSUE': 'reject', 'REPORT': 'reject', 'ISSUE': 'reject',
  'N': 'reject', '2': 'reject',
  // Scenario 11 Door 3 — third quick-reply button. NO now routes to a
  // follow-up prompt (below) instead of straight to 'disputed'.
  'COMING BACK': 'coming_back', "HE'S COMING BACK": 'coming_back',
  'ANOTHER VISIT': 'coming_back', 'RETURNING': 'coming_back', '3': 'coming_back',
};

// Scenario 11 Door 3 — disambiguates a bare NO. Opened by the webhook
// right after a 'reject' answer; rides the customer's session window.
const COMPLETION_NO_FOLLOWUP_OPTIONS = {
  '1': 'problem', 'PROBLEM': 'problem', 'ISSUE': 'problem',
  '2': 'never_came', 'NEVER CAME': 'never_came', 'NEVER': 'never_came',
  'NO SHOW': 'never_came', 'NOSHOW': 'never_came', "DIDN'T COME": 'never_came',
};
```

- [ ] **Step 2: Rework the `completion_confirmation` branch** (:2784-2828). The `confirm` path is untouched. Replace the tail so `reject` opens the follow-up and `coming_back` records intent:

After the existing `if (answerResult.outcome === 'confirmed') {...}` block, the current code falls through to the disputed ack — restructure to:

```js
          // ── action 'reject': open the NO follow-up instead of disputing.
          // (applyCompletionAnswer was NOT called for reject — see below.)
```

Concretely, change the top of the branch: only call `applyCompletionAnswer` when `verdict.action === 'confirm'`. New branch body (replacing :2785-2827):

```js
          if (verdict.action === 'confirm') {
            const answerResult = await applyCompletionAnswer({ db: admin.firestore(), jobId: verdict.prompt.jobId, isConfirm: true });
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: answerResult.outcome }); }
            catch (e) { console.error(`⚠️ markAnswered failed for job ${verdict.prompt.jobId} (prompt stays open):`, e); }
            if (answerResult.outcome === 'already_processed') {
              await sendTwilioMessage(From, `ℹ️ Your confirmation for Job #${verdict.prompt.jobId} did not go through — this job has already been recorded as: ${answerResult.recordedAs}.\n\nThe outcome cannot be changed here. If it was a mistake, please contact easydonehandyman@gmail.com as soon as possible.`);
              return res.status(200).json({ received: true, processed: false, reason: 'Prompt answer on already-processed job' });
            }
            await sendAdminNotificationEmail(answerResult.jobData, verdict.prompt.jobId);
            await sendTwilioMessage(From, `✅ Thank you for confirming!\n\nOur team will process the payment and email you the receipt.\n\nJob ID: ${verdict.prompt.jobId}\n\nIf you confirmed by mistake, please contact easydonehandyman@gmail.com as soon as possible.\n\nWe hope to serve you again! 🔧`);
            return res.status(200).json({ received: true, processed: true, action: 'pending_admin_approval', via: 'prompt' });
          }

          if (verdict.action === 'reject') {
            // Scenario 11 Door 3: a bare NO is ambiguous (problem? no-show?
            // half-done job?). Close the poll, ask which — the job state is
            // untouched until the follow-up lands.
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'followup_opened' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            const { promptId } = await openPrompt({
              db: admin.firestore(), jobId: verdict.prompt.jobId,
              type: 'completion_no_followup',
              toPhone: verdict.prompt.toPhone, toRole: 'customer',
              question: `What happened with Job #${verdict.prompt.jobId.slice(-6)}?`,
              options: COMPLETION_NO_FOLLOWUP_OPTIONS,
              payload: null,
              expiresInHours: 24,
            });
            await sendTwilioMessage(From, `Sorry to hear that. What happened?\n\n👉 Reply *1* — there's a problem with the work\n👉 Reply *2* — the handyman never came`);
            return res.status(200).json({ received: true, processed: true, action: 'no_followup_opened', via: 'prompt', promptId });
          }

          if (verdict.action === 'coming_back') {
            // Scenario 11 Door 3 option 3: record second-visit intent from
            // the customer side; the handyman owes a date (F5 ladder).
            // completionPollSentAt is deliberately KEPT so the auto-poll
            // doesn't re-fire tomorrow; the eventual scheduleChange clears it.
            const db = admin.firestore();
            const nowIso = new Date().toISOString();
            let hadCompletionClaim = false;
            await db.runTransaction(async (tx) => {
              const snap = await tx.get(db.collection('jobs').doc(verdict.prompt.jobId));
              if (!snap.exists) return;
              const jobData = snap.data();
              if (!['in_progress', 'pending_confirmation'].includes(jobData.status)) return;
              hadCompletionClaim = jobData.status === 'pending_confirmation';
              const { visits } = upsertPendingVisit(jobData, {
                proposedDate: null, proposedTime: null, reason: null,
                note: hadCompletionClaim ? 'customer expects a return visit after handyman marked complete' : null,
                reportedVia: 'customer_poll', promptId: verdict.prompt.id, nowIso,
              });
              const upd = { visits, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
              if (hadCompletionClaim) upd.status = 'in_progress'; // soft conflict: completion claim withdrawn pending the visit
              tx.update(snap.ref, upd);
            });
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'second_visit_intent' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }

            // Ping the handyman for a date — business-initiated, template-first.
            try {
              const jobSnap = await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).get();
              const hmId = jobSnap.exists ? jobSnap.data().handymanId : null;
              const hmSnap = hmId ? await admin.firestore().collection('handymen').doc(hmId).get() : null;
              const hmPhone = hmSnap && hmSnap.exists ? hmSnap.data().phone : null;
              if (hmPhone) {
                const link = `${APP_URL}/job-details/${verdict.prompt.jobId}?action=disposition`;
                await sendTwilioTemplateMessage(
                  formatPhoneToWhatsApp(hmPhone),
                  process.env.TWILIO_TEMPLATE_SECOND_VISIT_NEEDED,
                  { '1': verdict.prompt.jobId.slice(-6), '2': link },
                  `🔁 The customer says Job #${verdict.prompt.jobId.slice(-6)} needs another visit${hadCompletionClaim ? ' (they answered this after your Mark Complete — if you believe the job IS complete, contact easydonehandyman@gmail.com)' : ''}. Propose the return time here:\n${link}`
                );
              }
            } catch (notifyErr) {
              console.error('⚠️ second-visit handyman ping failed (sweep ladder will catch it):', notifyErr);
            }
            await sendTwilioMessage(From, `👍 Got it — we've asked your handyman to schedule the return visit for Job #${verdict.prompt.jobId.slice(-6)}. You'll get a confirmation once the time is set.`);
            return res.status(200).json({ received: true, processed: true, action: 'second_visit_intent', via: 'prompt' });
          }
```

- [ ] **Step 3: Add the `completion_no_followup` branch** (immediately after the `completion_confirmation` block):

```js
        if (verdict.prompt.type === 'completion_no_followup') {
          const jobShortId = verdict.prompt.jobId.slice(-6);
          if (verdict.action === 'problem') {
            const answerResult = await applyCompletionAnswer({ db: admin.firestore(), jobId: verdict.prompt.jobId, isConfirm: false });
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: answerResult.outcome }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await sendTwilioMessage(From, `⚠️ We're sorry to hear that.\n\nOur team will contact you with regard to this dispute.\n\nJob ID: ${verdict.prompt.jobId}\n\nIf you reported this by mistake, please contact easydonehandyman@gmail.com as soon as possible.\n\nWe take every feedback seriously and will resolve this promptly.`);
            return res.status(200).json({ received: true, processed: true, action: 'disputed', via: 'prompt' });
          }
          if (verdict.action === 'never_came') {
            // Scenario 7 stub (full no-show choice flow ships at stage 5):
            // record the report, flag the queue, email the admin.
            const db = admin.firestore();
            const nowIso = new Date().toISOString();
            await db.runTransaction(async (tx) => {
              const snap = await tx.get(db.collection('jobs').doc(verdict.prompt.jobId));
              if (!snap.exists) return;
              const reports = Array.isArray(snap.data().noShowReports) ? snap.data().noShowReports.slice() : [];
              reports.push({ reportedAt: nowIso, via: 'poll_followup', promptId: verdict.prompt.id });
              const upd = { noShowReports: reports, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
              Object.assign(upd, buildAttentionUpdate('no_show_reported', { detail: 'customer replied "never came" on the poll follow-up', promptId: verdict.prompt.id, nowIso }));
              tx.update(snap.ref, upd);
            });
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'no_show_reported' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await sendAdminEmail(
              `🚨 No-show reported — Job #${jobShortId}`,
              `<p>The customer reports the handyman never came for job <b>${escapeHtml(verdict.prompt.jobId)}</b>. Money is held; please call both parties and resolve (reschedule / reassign / refund).</p>`
            );
            await sendTwilioMessage(From, `😔 We're very sorry about that. Our team has been alerted and will contact you shortly to make this right (Job #${jobShortId}).`);
            return res.status(200).json({ received: true, processed: true, action: 'no_show_reported', via: 'prompt' });
          }
        }
```

- [ ] **Step 4: Update the poll copy + arm the new option in both poll senders**

In `autoTriggerCompletionPoll` — replace the freeform fallback body (:3827-3838) with:

```js
      const fallbackMessage = `Hello ${job.customerName}! 👋\n\nHas ${handymanName} completed the ${job.serviceType} job?\n\n👉 Reply *1* — Yes, all done\n👉 Reply *2* — No\n👉 Reply *3* — He's coming back for another visit\n\nJob ID: ${jobId}`;
```

(The `sendTwilioTemplateMessage(... process.env.TWILIO_TEMPLATE_JOB_COMPLETION ...)` call is unchanged — the owner swaps that env var's SID to the approved 3-button v2 template; until then the fallback carries all three options only when the SID is unset. This is the existing template-migration pattern.)

Also in `autoTriggerCompletionPoll`, add two skip conditions in the per-doc loop next to the existing `completionPollSentAt` skip (:3795):

```js
      // Scenario 11: a pending second visit means the job is knowingly
      // incomplete — polling "is it done?" would be nonsense.
      if (hasPendingSecondVisit(job)) { skipped++; continue; }
```

And immediately after the poll is successfully sent + prompt opened (after :3877), supersede any leftover evening prompt:

```js
      // The customer poll is now the live question; retire the handyman's
      // unanswered evening disposition link (Door 2 → Door 3 hand-off).
      try { await supersedeOpenPrompts(admin.firestore(), jobId, ['visit_disposition']); }
      catch (e) { console.error('⚠️ visit_disposition supersede failed (continuing):', e); }
```

In `sendWhatsAppNotification`'s `case 'job_completion'` (:2522-2573): after the existing `openPrompt` call, add the same `supersedeOpenPrompts(db, jobId, ['visit_disposition'])` best-effort block (Mark Complete via the app also answers the evening question). Update its fallback copy the same way as above if a freeform fallback string exists in that case.

- [ ] **Step 5: Syntax check + regression suite**

Run: `cd functions && node --check index.js && npm test`
Expected: clean; PASS. (promptService tests are unaffected — `matchOptions` already handles multi-word keys and numeric keys.)

- [ ] **Step 6: Commit**

```bash
git add functions/index.js
git commit -m "feat(poll): 3rd option 'coming back', NO follow-up prompt, no-show stub — Scenario 11 Door 3"
```

---

### Task 6: Door 2 — `eveningVisitDisposition` scheduled function

**Files:**
- Modify: `functions/index.js` — new scheduled export next to `autoTriggerCompletionPoll` (:3762)

**Interfaces:**
- Consumes: `shouldSendDisposition` (Task 1), `openPrompt`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`, `APP_URL`.
- Produces: job field `visitDispositionSentFor: 'YYYY-MM-DD'`; prompt `type: 'visit_disposition'` (`options: {}` — any text reply falls through to F3 by design; the deep link is the answer path), `expiresInHours: 17` (19:00 → noon next day; the 10:00 poll supersedes it first in the normal path). New env var read inline: `TWILIO_TEMPLATE_VISIT_DISPOSITION`.

- [ ] **Step 1: Implement the scheduled function**

```js
// ===================================
// EVENING VISIT DISPOSITION — Scenario 11 Door 2. On the evening of the
// visit day, ask any silent handyman how it went via a deep link into
// the app's disposition sheet. Runs 19:00 SGT; the 10:00 completion
// poll next morning is the customer-side backstop for continued silence.
// ===================================
exports.eveningVisitDisposition = functions.pubsub
  .schedule('every day 19:00')
  .timeZone('Asia/Singapore')
  .onRun(async () => {
    const db = admin.firestore();
    const todaySgt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
    let sent = 0; let skipped = 0;

    const snapshot = await db.collection('jobs')
      .where('status', '==', 'in_progress')
      .where('preferredTiming', '==', 'Schedule')
      .limit(300)
      .get();
    if (snapshot.size === 300) console.warn('⚠️ eveningVisitDisposition hit the 300-job cap — some jobs not inspected');

    for (const doc of snapshot.docs) {
      try {
        const job = doc.data();
        if (!shouldSendDisposition(job, todaySgt)) { skipped++; continue; }

        const hmSnap = await db.collection('handymen').doc(job.handymanId).get();
        const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
        if (!hmPhone) { skipped++; continue; }

        const jobShortId = doc.id.slice(-6);
        const link = `${APP_URL}/job-details/${doc.id}?action=disposition`;
        const sendResult = await sendTwilioTemplateMessage(
          formatPhoneToWhatsApp(hmPhone),
          process.env.TWILIO_TEMPLATE_VISIT_DISPOSITION,
          { '1': job.serviceType || 'job', '2': jobShortId, '3': link },
          `👷 How did today's job go — ${job.serviceType || 'job'} (#${jobShortId})?\n\nTap to update (done / needs another visit / problem):\n${link}`
        );
        if (!sendResult.success) { console.error(`⚠️ disposition send failed for ${doc.id}:`, sendResult.error); skipped++; continue; }

        // Prompt record for audit + sweep visibility. No reply options:
        // the link is the answer path; text replies fall through to F3.
        await openPrompt({
          db, jobId: doc.id, type: 'visit_disposition',
          toPhone: hmPhone, toRole: 'handyman',
          question: `How did today's visit go? (#${jobShortId})`,
          options: {},
          payload: { link },
          expiresInHours: 17,
        });
        await doc.ref.update({ visitDispositionSentFor: job.preferredDate });
        sent++;
      } catch (docErr) {
        console.error(`❌ eveningVisitDisposition failed for ${doc.id} (continuing):`, docErr);
      }
    }
    console.log(`🌆 eveningVisitDisposition: ${sent} sent, ${skipped} skipped`);
    return null;
  });
```

- [ ] **Step 2: Syntax check + regression suite**

Run: `cd functions && node --check index.js && npm test`
Expected: clean; PASS.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat(functions): eveningVisitDisposition scheduled prompt — Scenario 11 Door 2"
```

---

### Task 7: Scenario 8 — `reportVisitIssue` endpoint + `access_issue_choice` branch

**Files:**
- Modify: `functions/index.js` — new constant next to the other OPTIONS maps (:135), new export next to `requestSecondVisit`, new webhook branch after `completion_no_followup`

**Interfaces:**
- Consumes: `validateVisitIssueReport`/`buildVisitIssueEntry` (Task 1), `issueScheduleLink` (used at :2942 — same signature `{db, jobId, customerPhone, createdBy}` → `{token}`), `supersedeOpenPrompts` (Task 3), `buildAttentionUpdate`, `sendAdminEmail`, `escapeHtml`.
- Produces:
  - `POST /reportVisitIssue` — body `{ jobId, kind: 'no_access' | 'cannot_finish', note }`, Bearer handyman auth → `{ success: true }`; VisitError codes map `{not_found:404, not_assigned:403, wrong_status:409, bad_kind:400, not_visit_day:409}`.
  - Job field `accessIssues[]` (entries from `buildVisitIssueEntry`).
  - Prompt `type: 'access_issue_choice'` (customer; only for `kind: 'no_access'`) with `ACCESS_ISSUE_OPTIONS` → actions `reschedule | support`.
  - New env vars read inline: `TWILIO_TEMPLATE_ACCESS_ISSUE`, `TWILIO_TEMPLATE_VISIT_PROBLEM`.

- [ ] **Step 1: Add the options constant** (below `SCHEDULE_APPROVAL_OPTIONS`):

```js
// Scenario 8 — customer prompt after a handyman "no access" report.
const ACCESS_ISSUE_OPTIONS = {
  '1': 'reschedule', 'RESCHEDULE': 'reschedule',
  '2': 'support', 'SUPPORT': 'support', 'CONTACT SUPPORT': 'support', 'HELP': 'support',
};
```

- [ ] **Step 2: Add the endpoint** (same scaffold as Task 3):

```js
// ===================================
// VISIT ISSUE — Scenario 8 (customer not home / no access) and the
// disposition sheet's "Problem — can't finish". Logged on the job,
// admin alerted; no_access additionally prompts the customer
// (reschedule / support). No fees in v1.
// ===================================
exports.reportVisitIssue = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const decodedToken = await verifyAuthToken(req);
      const { jobId, kind, note } = req.body || {};
      if (!jobId) return res.status(400).json({ error: 'jobId is required', code: 'bad_request' });

      const rl = await checkRateLimit(`visit_issue_${decodedToken.uid}`, 5, 86400);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many reports today', retryAfterSeconds: rl.retryAfterSeconds });
      }

      const db = admin.firestore();
      const nowIso = new Date().toISOString();
      const todaySgt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
      let jobData;
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(db.collection('jobs').doc(jobId));
          const job = snap.exists ? snap.data() : null;
          validateVisitIssueReport(job, decodedToken.uid, kind, todaySgt);
          jobData = job;
          const issues = Array.isArray(job.accessIssues) ? job.accessIssues.slice() : [];
          issues.push(buildVisitIssueEntry({ kind, note, reportedBy: decodedToken.uid, nowIso }));
          const upd = { accessIssues: issues, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
          if (kind === 'cannot_finish') {
            Object.assign(upd, buildAttentionUpdate('visit_problem', { detail: String(note || '').slice(0, 200) || 'handyman reported a problem', promptId: null, nowIso }));
          }
          tx.update(snap.ref, upd);
        });
      } catch (visitErr) {
        if (visitErr.name === 'VisitError') {
          const statusMap = { not_found: 404, not_assigned: 403, wrong_status: 409, bad_kind: 400, not_visit_day: 409 };
          return res.status(statusMap[visitErr.code] || 400).json({ error: visitErr.message, code: visitErr.code });
        }
        throw visitErr;
      }

      try { await supersedeOpenPrompts(db, jobId, ['visit_disposition']); }
      catch (e) { console.error('⚠️ supersedeOpenPrompts failed (continuing):', e); }

      const jobShortId = jobId.slice(-6);
      const handymanName = (jobData.acceptedBy && jobData.acceptedBy.name) || 'Your handyman';
      await sendAdminEmail(
        kind === 'no_access' ? `🚪 Access issue — Job #${jobShortId}` : `⚠️ Visit problem — Job #${jobShortId}`,
        `<p>Handyman <b>${escapeHtml(handymanName)}</b> reported <b>${escapeHtml(kind)}</b> on job <b>${escapeHtml(jobId)}</b>.</p><p>Note: ${escapeHtml(String(note || '(none)'))}</p>`
      );

      if (kind === 'no_access') {
        const fallback = `😕 ${handymanName} couldn't reach you today for Job #${jobShortId}.\n\n👉 Reply *1* — Reschedule the visit\n👉 Reply *2* — Contact support`;
        await sendTwilioTemplateMessage(
          formatPhoneToWhatsApp(jobData.customerPhone),
          process.env.TWILIO_TEMPLATE_ACCESS_ISSUE,
          { '1': handymanName, '2': jobShortId },
          fallback
        );
        await openPrompt({
          db, jobId, type: 'access_issue_choice',
          toPhone: jobData.customerPhone, toRole: 'customer',
          question: `${handymanName} couldn't reach you — reschedule or contact support? (Job #${jobShortId})`,
          options: ACCESS_ISSUE_OPTIONS,
          payload: null,
        });
      } else {
        // cannot_finish: customer gets a holding notice; admin mediates
        // (often becomes Scenario 6 swap or Scenario 10 price talk).
        await sendTwilioTemplateMessage(
          formatPhoneToWhatsApp(jobData.customerPhone),
          process.env.TWILIO_TEMPLATE_VISIT_PROBLEM,
          { '1': jobShortId },
          `ℹ️ There's a snag with Job #${jobShortId} — our team is looking into it and will contact you shortly. Your payment stays protected.`
        );
      }

      await writeAuditLog('visit_issue_reported', decodedToken, { jobId, kind });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ reportVisitIssue error:', error);
      if (error.message && error.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' });
      return res.status(500).json({ error: 'Failed to report visit issue' });
    }
  });
});
```

- [ ] **Step 3: Add the `access_issue_choice` webhook branch** (after `completion_no_followup`; the reschedule arm reuses the decline→link pattern verbatim from :2940-2963):

```js
        if (verdict.prompt.type === 'access_issue_choice') {
          const jobShortId = verdict.prompt.jobId.slice(-6);
          if (verdict.action === 'reschedule') {
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'link_sent' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            try {
              const { token } = await issueScheduleLink({
                db: admin.firestore(), jobId: verdict.prompt.jobId,
                customerPhone: verdict.prompt.toPhone, createdBy: 'system_access_issue',
              });
              await sendTwilioMessage(From, `👍 No problem — pick a new time that works for you here (valid 72 hours):\n${APP_URL}/pick-time?t=${token}\n\nYour handyman will confirm the time you choose (Job #${jobShortId}).`);
            } catch (linkErr) {
              console.error('⚠️ access-issue link send failed:', linkErr);
              await sendTwilioMessage(From, `👍 Our team will arrange a new time with you shortly (Job #${jobShortId}).`);
              await sendAdminEmail(`⚠️ Access-issue reschedule link failed — Job #${jobShortId}`, `<p>Send a schedule link manually for job <b>${escapeHtml(verdict.prompt.jobId)}</b>.</p>`);
            }
            return res.status(200).json({ received: true, processed: true, action: 'access_reschedule_link', via: 'prompt' });
          }
          if (verdict.action === 'support') {
            try { await markAnswered(verdict.prompt.ref, { answer: verdict.answerText, resultingAction: 'support_requested' }); }
            catch (e) { console.error('⚠️ markAnswered failed (continuing):', e); }
            await sendAdminEmail(`☎️ Support requested — Job #${jobShortId}`, `<p>The customer asked for support after an access issue on job <b>${escapeHtml(verdict.prompt.jobId)}</b>. Please contact them.</p>`);
            await sendTwilioMessage(From, `👍 Our team will contact you shortly about Job #${jobShortId}.`);
            return res.status(200).json({ received: true, processed: true, action: 'access_support', via: 'prompt' });
          }
        }
```

Check that `issueScheduleLink`'s `createdBy` accepts arbitrary strings (it stores `'system_decline' | admin uid` today per `scheduleLinkService.js`) — if it validates against a whitelist, add `'system_access_issue'` to it.

- [ ] **Step 4: Syntax check + regression suite, commit**

Run: `cd functions && node --check index.js && npm test` — expected clean/PASS.

```bash
git add functions/index.js functions/scheduleLinkService.js
git commit -m "feat(functions): reportVisitIssue endpoint + access_issue_choice flow — Scenario 8"
```

---

### Task 8: Sweep orchestrator wiring — second-visit ladder + silent expiry

**Files:**
- Modify: `functions/index.js` — `stuckStateSweep` (:3906-4137)

**Interfaces:**
- Consumes: `evaluateSecondVisit`, the `'expire_silent'` verdict (Task 2), the existing `escalate()` closure (:3922), `ONCE_ONLY_TYPES` (:3920), in-progress-jobs query loop of ladder 2b (:4047).

- [ ] **Step 1: Handle `'expire_silent'` in ladder 1** (:3952-3996). Where the per-prompt verdict is switched, add before the nudge/escalate handling:

```js
        if (verdictP === 'expire_silent') {
          await doc.ref.update({ status: 'expired', expiredAt: nowIso });
          continue; // Door 2 prompts: the morning poll is the backstop — no nudge, no escalation
        }
```

- [ ] **Step 2: Add the second-visit ladder inside the existing in-progress loop** (ladder 2b iterates `status=='in_progress'` jobs at :4047-4087 — extend that same loop body rather than re-querying). First extend the existing `require('./sweepService')` destructure at the top of index.js with `evaluateSecondVisit` (Task 4 already added `buildAttentionUpdate` there if it was missing):

```js
        // Ladder 2c — Scenario 11: second visit flagged, no date proposed.
        const svVerdict = evaluateSecondVisit(job, nowMs);
        if (svVerdict === 'nudge') {
          try {
            const hmSnap = await db.collection('handymen').doc(job.handymanId).get();
            const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
            if (hmPhone) {
              const link = `${APP_URL}/job-details/${doc.id}?action=disposition`;
              await sendTwilioTemplateMessage(
                formatPhoneToWhatsApp(hmPhone),
                process.env.TWILIO_TEMPLATE_PROMPT_NUDGE,
                { '1': `Job #${doc.id.slice(-6)} still needs a return-visit time`, '2': link },
                `⏰ Reminder: Job #${doc.id.slice(-6)} needs a second visit but no time is set. Propose one here:\n${link}`
              );
            }
            await doc.ref.update({ 'sweepNudges.second_visit_no_date': nowIso });
          } catch (nudgeErr) {
            console.error(`⚠️ second-visit nudge failed for ${doc.id}:`, nudgeErr);
          }
        } else if (svVerdict === 'escalate') {
          await escalate(doc, job, 'second_visit_no_date', 'second visit flagged but no date proposed for 48h+');
        }
```

(Match the real `escalate()` signature at :3922 when implementing — pass whatever argument shape the existing ladders use.) Check the `TWILIO_TEMPLATE_PROMPT_NUDGE` variable count against an existing nudge call in ladder 1 and mirror it — if it takes different vars, reuse that exact shape with this copy.

- [ ] **Step 3: Add `'second_visit_no_date'` to `ONCE_ONLY_TYPES`** (:3920):

```js
const ONCE_ONLY_TYPES = ['asap_no_time', 'unclaimed', 'reclaim_stalled', 'second_visit_no_date'];
```

- [ ] **Step 4: Syntax check + regression suite, commit**

Run: `cd functions && node --check index.js && npm test` — expected clean/PASS.

```bash
git add functions/index.js
git commit -m "feat(sweep): wire second-visit ladder + silent disposition expiry into stuckStateSweep"
```

---

### Task 9: Firestore rules — deny client writes to the new server-owned fields

**Files:**
- Modify: `firestore.rules` — `jobSystemFields()` (:68-99) and `jobCreateDeniedFields()` (:115-142)

- [ ] **Step 1:** Add to BOTH lists (same style as the existing entries — these fields are written only by Cloud Functions):

```
'visits', 'accessIssues', 'noShowReports', 'visitDispositionSentFor',
```

- [ ] **Step 2: Validate rules compile**

Run: `firebase deploy --only firestore:rules --dry-run 2>/dev/null || firebase emulators:exec --only firestore "echo rules ok"` — if neither is available in this environment, at minimum re-read the diff to confirm both functions list the four fields and commas/quotes are balanced. (Per project memory: use the global `firebase` binary.)

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "chore(rules): deny client writes to visits/accessIssues/noShowReports/visitDispositionSentFor"
```

---

### Task 10: Frontend API wrappers

**Files:**
- Create: `src/services/api/jobVisits.js`

**Interfaces:**
- Produces (consumed by Tasks 11–13):
  - `SECOND_VISIT_REASON_OPTIONS: [{value,label}]` (values MUST match `SECOND_VISIT_REASONS` in functions/visitService.js)
  - `requestSecondVisit(jobId, proposedDate, proposedTime, reason, note='')` → `{success, error?, code?, promptId?}` — never throws
  - `reportVisitIssue(jobId, kind, note='')` → `{success, error?, code?}` — never throws

- [ ] **Step 1: Implement** (clone the `jobAssignment.js` pattern exactly — Bearer token, `response.json().catch(() => ({}))`, never throw):

```js
/**
 * Second-visit + visit-issue service — Scenario 11 / Scenario 8.
 *
 * Both actions go through Cloud Functions (never direct Firestore
 * writes): the server owns visits[]/accessIssues[], the customer
 * WhatsApp prompts, and the attention-queue flags. See
 * docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/** Values MUST match SECOND_VISIT_REASONS in functions/visitService.js. */
export const SECOND_VISIT_REASON_OPTIONS = [
  { value: 'parts_materials', label: 'Waiting on parts / materials' },
  { value: 'job_bigger_than_expected', label: 'Job is bigger than expected' },
  { value: 'customer_request', label: 'Customer asked for another visit' },
  { value: 'other', label: 'Other (please describe)' },
];

const post = async (path, body, failMessage) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not authenticated' };
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || failMessage, code: result.code };
    }
    return result;
  } catch (error) {
    console.error(`❌ ${path} failed:`, error);
    return { success: false, error: 'Request failed. Please check your connection and try again.' };
  }
};

/** Ask the customer to approve a return visit (opens a WhatsApp prompt). */
export const requestSecondVisit = (jobId, proposedDate, proposedTime, reason, note = '') =>
  post('requestSecondVisit', { jobId, proposedDate, proposedTime, reason, note },
    'Could not send the second-visit request. Please try again.');

/** Report no access / cannot finish. kind: 'no_access' | 'cannot_finish'. */
export const reportVisitIssue = (jobId, kind, note = '') =>
  post('reportVisitIssue', { jobId, kind, note },
    'Could not send the report. Please try again.');
```

- [ ] **Step 2: Commit**

```bash
git add src/services/api/jobVisits.js
git commit -m "feat(api): jobVisits wrappers — requestSecondVisit, reportVisitIssue"
```

---

### Task 11: Frontend — `SecondVisitModal`

**Files:**
- Create: `src/components/handyman/SecondVisitModal.jsx`

**Interfaces:**
- Props: `{ job, isOpen, onClose, onRequested }` (same contract as `CancelJobModal.jsx:19`). Parent keeps it mounted and toggles `isOpen`; state resets on open via the `[isOpen, job.id]` effect (mandatory — see `ProposeTimeModal.jsx:27-36`).
- Consumes: `requestSecondVisit`, `SECOND_VISIT_REASON_OPTIONS` (Task 10); the date/slot picker trio from `ProposeTimeModal.jsx:93-118` (`getProposalDateBounds` from `src/services/api/jobSchedule.js`, `TIME_SLOTS`/`isSlotInPastForDate`/`firstAvailableSlot` from wherever ProposeTimeModal imports them — copy its exact import lines).

- [ ] **Step 1: Implement.** Structure = `CancelJobModal` (reason `<select>` from `SECOND_VISIT_REASON_OPTIONS`, note `<textarea maxLength={300}>` required when reason is `other`) + `ProposeTimeModal`'s date input, slot select, and slot-snapping effect. Header: orange icon chip (`ExpressInterestButton.jsx:242-244` style) with Material icon `event_repeat`, title "Needs another visit". Overlay/card/footer classes copied verbatim from `ProposeTimeModal.jsx:73-74, 135-150`. Submit handler:

```jsx
  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    const result = await requestSecondVisit(job.id, date, time.trim(), reason, note.trim());
    submittingRef.current = false;
    setSubmitting(false);
    if (!result.success) { setError(result.error); return; }
    onRequested?.();
    onClose();
  };
```

`canSubmit = date && time.trim() && reason && (reason !== 'other' || note.trim())`. Copy note under the header: "The customer will be asked on WhatsApp to approve the new visit time. The job stays open until the final visit is done."

- [ ] **Step 2: Commit**

```bash
git add src/components/handyman/SecondVisitModal.jsx
git commit -m "feat(ui): SecondVisitModal — reason + proposed return time"
```

---

### Task 12: Frontend — `VisitIssueModal`

**Files:**
- Create: `src/components/handyman/VisitIssueModal.jsx`

**Interfaces:**
- Props: `{ job, kind, isOpen, onClose, onReported }` — `kind: 'no_access' | 'cannot_finish'` decides the copy; note optional for `no_access`, required for `cannot_finish` (the admin needs to know what the problem is).
- Consumes: `reportVisitIssue` (Task 10).

- [ ] **Step 1: Implement.** Clone `CancelJobModal`'s skeleton (red icon chip, `report_problem` icon). Copy per kind:
  - `no_access` — title "Customer not home / no access"; body "We'll let the customer know and ask them to reschedule or contact support. Add any details below (optional)."
  - `cannot_finish` — title "Problem — can't finish this job"; body "Describe what's blocking the job. Our team will step in — the customer will be told we're looking into it."
  - Submit calls `reportVisitIssue(job.id, kind, note.trim())`; same `submittingRef` + inline error pattern as Task 11. `canSubmit = kind === 'no_access' || note.trim()`.

- [ ] **Step 2: Commit**

```bash
git add src/components/handyman/VisitIssueModal.jsx
git commit -m "feat(ui): VisitIssueModal — no-access and cannot-finish reports"
```

---

### Task 13: Frontend — disposition sheet, action buttons, deep link

**Files:**
- Modify: `src/components/handyman/JobActionButtons.jsx`
- Modify: `src/components/handyman/JobCard.jsx` (:20 params, :285-289 props)

**Interfaces:**
- `JobActionButtons` gains prop `initialAction` (string, optional). When `initialAction === 'disposition'` and the job is actionable (`status === 'in_progress'`), the disposition sheet opens once on mount.
- Consumes: `SecondVisitModal` (Task 11), `VisitIssueModal` (Task 12), `Modal` from `src/components/common/Modal.jsx` (props `{isOpen, onClose, title, children, size}` — the mobile bottom-sheet base), existing `handleMarkCompleted` (:107) and `isJobDateReached` (:79).

- [ ] **Step 1: Add state + helpers to JobActionButtons**

```jsx
  const [showSecondVisitModal, setShowSecondVisitModal] = useState(false);
  const [visitIssueKind, setVisitIssueKind] = useState(null); // null | 'no_access' | 'cannot_finish'
  const [showDisposition, setShowDisposition] = useState(
    () => initialAction === 'disposition' && job.status === 'in_progress'
  );
```

Visit-day helper next to `isJobDateReached` (:79) — exact-day, local time, mirroring its midnight-normalization:

```jsx
  // Exact-day check for the "Customer not home" report — you can only be
  // standing at the door ON the visit day (isJobDateReached is >=, which
  // is right for Mark Complete but too loose here).
  const isVisitDay = () => {
    if (!job.preferredDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const visit = new Date(job.preferredDate); visit.setHours(0, 0, 0, 0);
    return today.getTime() === visit.getTime();
  };
```

Gates: `canSecondVisit = job.status === 'in_progress' && dateReached && !isCompleted`.

- [ ] **Step 2: Add the buttons to the full variant** (in the stacked block at :275-348, after Mark Complete): "🔁 Needs another visit" (`bg-orange-500 hover:bg-orange-600`, shown when `canSecondVisit`) → `setShowSecondVisitModal(true)`; "🚪 Customer not home" (secondary gray style, shown when `job.status === 'in_progress' && isVisitDay()`) → `setVisitIssueKind('no_access')`. Same buttons in the compact variant's row (:353) with the existing compact styling.

- [ ] **Step 3: Add the disposition sheet** (rendered alongside the other always-mounted modals):

```jsx
      <Modal isOpen={showDisposition} onClose={() => setShowDisposition(false)} title="How did today's visit go?" size="small">
        <div className="flex flex-col gap-3 p-1">
          <button
            onClick={() => { setShowDisposition(false); handleMarkCompleted(); }}
            className="w-full flex items-center gap-3 bg-primary/10 hover:bg-primary/20 text-gray-900 dark:text-white font-bold py-4 px-4 rounded-xl text-left"
          >
            <span className="material-symbols-outlined text-primary">check_circle</span>
            <span>Job's done<span className="block text-sm font-normal text-gray-500 dark:text-gray-400">Mark complete — the customer confirms on WhatsApp</span></span>
          </button>
          <button
            onClick={() => { setShowDisposition(false); setShowSecondVisitModal(true); }}
            className="w-full flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 text-gray-900 dark:text-white font-bold py-4 px-4 rounded-xl text-left"
          >
            <span className="material-symbols-outlined text-orange-500">event_repeat</span>
            <span>Needs another visit<span className="block text-sm font-normal text-gray-500 dark:text-gray-400">Propose a return time for the customer to approve</span></span>
          </button>
          <button
            onClick={() => { setShowDisposition(false); setVisitIssueKind('cannot_finish'); }}
            className="w-full flex items-center gap-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-gray-900 dark:text-white font-bold py-4 px-4 rounded-xl text-left"
          >
            <span className="material-symbols-outlined text-red-500">report_problem</span>
            <span>Problem — can't finish<span className="block text-sm font-normal text-gray-500 dark:text-gray-400">Tell us what's wrong; our team steps in</span></span>
          </button>
        </div>
      </Modal>

      <SecondVisitModal job={job} isOpen={showSecondVisitModal}
        onClose={() => setShowSecondVisitModal(false)} onRequested={onStatusChange} />
      <VisitIssueModal job={job} kind={visitIssueKind || 'no_access'} isOpen={!!visitIssueKind}
        onClose={() => setVisitIssueKind(null)} onReported={onStatusChange} />
```

Success feedback matches the file's existing idiom (`alert(...)`) — e.g. `alert('Request sent — the customer will confirm on WhatsApp.')` inside the modals' success paths if not already surfaced by `onRequested`.

- [ ] **Step 4: Wire the deep link in JobCard.** Add `useSearchParams` to the router import (:2), then:

```jsx
  const [searchParams] = useSearchParams();
  // Read once (lazy init) so the sheet doesn't reopen on re-renders —
  // same pattern as HandymanDashboard.jsx:28.
  const [initialAction] = useState(() => searchParams.get('action'));
```

Pass it through at :285-289:

```jsx
              <JobActionButtons
                job={job}
                variant="full"
                showViewDetails={false}
                initialAction={initialAction}
              />
```

(`JobCard`'s existing auth bounce at :40-45 already preserves `?action=disposition` through login via `?next=`.)

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: compiles with no errors (CRA build also runs eslint; warnings pre-existing in the repo are acceptable, new errors are not).

- [ ] **Step 6: Commit**

```bash
git add src/components/handyman/JobActionButtons.jsx src/components/handyman/JobCard.jsx
git commit -m "feat(ui): disposition sheet + second-visit/no-access buttons + ?action=disposition deep link"
```

---

### Task 14: Docs, env, spec tick, E2E checklist

**Files:**
- Modify: `WHATSAPP_TEMPLATES.md`, `.env.local.example`, `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` (§7 build order), `docs/features/e2e-test-plan-job-lifecycle.md`

- [ ] **Step 1: WHATSAPP_TEMPLATES.md.** Fix T5 v2's third button to match the shipped options: `🔁 He's coming back` (currently drafted as `🚫 Handyman never came` — that reply now lives in the NO follow-up, not a button). Verify T8 (`access_issue_choice`) and T13 (`second_visit_proposal`) variable lists match the `contentVariables` sent in Tasks 3/7 — edit whichever side is cheaper (the draft, since nothing is submitted yet). Add drafts for `visit_disposition` (vars: 1 service type, 2 job short id, 3 link), `second_visit_needed` (vars: 1 job short id, 2 link), `visit_problem` (vars: 1 job short id), body copy = the freeform fallbacks from Tasks 5–7.

- [ ] **Step 2: Env examples.** Add to `.env.local.example` (functions section) with placeholder SIDs and a comment that unset = freeform fallback:

```
TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL=
TWILIO_TEMPLATE_SECOND_VISIT_NEEDED=
TWILIO_TEMPLATE_VISIT_DISPOSITION=
TWILIO_TEMPLATE_ACCESS_ISSUE=
TWILIO_TEMPLATE_VISIT_PROBLEM=
# TWILIO_TEMPLATE_JOB_COMPLETION: swap SID to the 3-button v2 template once Meta approves it
```

- [ ] **Step 3: Spec build order** (§7 table): stage 6 row → `Scenario 11 ✅ DONE <date> (this plan); Scenario 10 not started`; stage 5 row → `Scenario 8 ✅ DONE <date> (this plan); Scenarios 7 + 5 not started`. Add the plan filename to the row.

- [ ] **Step 4: E2E checklist.** Append a "Second visit + access issue" section to `docs/features/e2e-test-plan-job-lifecycle.md`:

```markdown
## Second visit + access issue (plan 2026-07-29)
- [ ] Door 1: handyman taps "Needs another visit" → customer gets proposal on WA → YES → both confirmed, preferredDate moved, visits[0].status='scheduled', poll re-armed (completionPollSentAt cleared)
- [ ] Door 1 decline: customer NO → visits[0].status='declined', job flagged needsAttention (second_visit_declined), admin email received, customer acked
- [ ] Door 2: job with preferredDate=today, no action by 19:00 SGT → handyman gets deep-link WA; link opens /job-details/{id}?action=disposition with the sheet auto-open (incl. after login bounce)
- [ ] Sheet → Job's done = existing Mark Complete flow; sheet → Problem = admin email + customer holding notice + attention flag
- [ ] Door 3: poll shows 3 options; reply 3 → visits[] pending entry, handyman pinged with link; reply 3 after handyman marked complete → status back to in_progress
- [ ] Poll reply 2 → follow-up question; follow-up 1 → disputed (unchanged tail); follow-up 2 → noShowReports[] + attention (no_show_reported) + admin email
- [ ] Sweep: pending second visit with no date >24h → handyman nudged once; >48h → attention queue (second_visit_no_date), only once
- [ ] Sweep: unanswered visit_disposition prompt past expiry → marked expired, NO nudge sent
- [ ] Morning poll on a job with an open visit_disposition prompt → disposition prompt superseded
- [ ] Scenario 8: "Customer not home" visible only on the visit day → customer gets 1/2 choice; reply 1 → pick-time link (single-use, revokes priors); pick → handyman schedule_pick_approval (Scenario 3 rails); reply 2 → admin email + ack
- [ ] reportVisitIssue rejected: wrong handyman (403), not visit day (409), job not in_progress (409)
- [ ] Rules: client write to visits/accessIssues/noShowReports/visitDispositionSentFor denied for the assigned handyman
```

- [ ] **Step 5: Commit**

```bash
git add WHATSAPP_TEMPLATES.md .env.local.example docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md docs/features/e2e-test-plan-job-lifecycle.md
git commit -m "docs: templates, env vars, spec status, E2E checklist for second-visit + access-issue"
```

---

## Owner gates before go-live (not code tasks)

1. Submit Meta templates: `job_completion_request_v2` (3 buttons, third = "🔁 He's coming back"), `second_visit_proposal` (T13), `access_issue_choice` (T8), `visit_disposition`, `second_visit_needed`, `visit_problem`. Freeform fallback covers the gap.
2. Set the new `TWILIO_TEMPLATE_*` env vars per environment once approved; swap `TWILIO_TEMPLATE_JOB_COMPLETION` to the v2 SID.
3. Deploy functions + rules together (`firebase deploy --only functions,firestore:rules` — global firebase binary).
4. Run the E2E checklist section from Task 14 on the test project.
