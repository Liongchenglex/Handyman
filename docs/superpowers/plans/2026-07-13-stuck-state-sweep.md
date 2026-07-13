# Stage 4: Stuck-State Sweep + Admin Attention Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily sweep that nudges (once) and then escalates every stuck job into an admin attention queue with four resolution actions — plus the fix that makes YES to an auto-fired completion poll actually count.

**Architecture:** Pure detectors in a new `functions/sweepService.js` (DI style, unit-tested under fixed clocks); a `stuckStateSweep` scheduled function orchestrates queries/sends in `functions/index.js`; three new admin endpoints (`resolveAttention`, `adminSetSchedule`, `adminUnassignJob`) reuse the existing F4/reassignment machinery; `ActiveJobsTable` grows into the queue UI. Escalation state on jobs: `needsAttention: true` + `attentionNeeded: {type, at, detail, promptId}` (server-only).

**Tech Stack:** Firebase Cloud Functions (Node, CommonJS), Firestore, Twilio WhatsApp, nodemailer SMTP digest, CRA React 18 + Tailwind, jest (functions dir only).

**Spec:** `docs/superpowers/specs/2026-07-13-stuck-state-sweep-design.md` (governs thresholds); parent: `2026-07-12-job-lifecycle-scenarios-design.md` §Scenario 12 + F5.

## Global Constraints

- **Anti-iCloud protocol (MANDATORY, every commit):** stage ONLY the named files; read `git diff --staged` hunk-by-hunk before committing; after committing re-grep a distinctive string from each changed file out of `git show HEAD:<path>`. NEVER `git add -A`/`git add .`.
- **Never stage** user's unrelated files: `.env.local.example`, `src/components/handyman/status-views/SuspendedStatusView.jsx`, deleted `src/services/stripe/*.mjs`, `"package-lock 2.json"`, `"src/components/handyman/JobBoard 2.jsx"`, `"Testing and Validation Guide (1).docx"`, `WHATSAPP_TEMPLATES.md`, `copy_change.md`.
- **NEVER run bare `npm install`** (recovery: `git checkout -- package-lock.json && npm ci`). No `timeout` command on macOS. Firebase CLI = `/Users/liongchenglex/.npm-global/bin/firebase` (npx firebase hangs).
- Frontend verification: `CI=true npx react-scripts build` from repo root (CRA jest is dead on Node 22). Functions tests: `cd functions && npx jest`.
- Thresholds (spec §3, verbatim): prompt nudge extends `expiresAt` **+24h**; ASAP nudge **24h** / escalate **48h**; unclaimed fan-out **3d** / escalate **7d**; re-released fan-out **2d** / escalate **4d**. Every nudge fires AT MOST ONCE per state (markers: `nudgedAt` on prompts/links, `sweepNudges` map on jobs).
- Attention types (exact strings): `schedule_deadlock | prompt_expired | link_ignored | asap_no_time | unclaimed | reclaim_stalled`.
- **Escrow untouched by the sweep.** Money moves only via the queue's explicit refund action (existing `refundPayment` endpoint) — never automatically.
- One digest email per sweep run (existing `sendAdminEmail(subject, html)`, everything user-influenced through `escapeHtml`).
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `sweepService.js` — pure detectors

**Files:**
- Create: `functions/sweepService.js`
- Test: `functions/__tests__/sweepService.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 2):
  - `SWEEP` constants object (see code)
  - `toMs(v) -> number|null` — tolerant timestamp parse (Firestore Timestamp | ISO string | Date | ms)
  - `evaluatePrompt(prompt, nowMs) -> 'ok'|'nudge'|'escalate'`
  - `evaluateLink(link, nowMs) -> 'ok'|'renew'|'escalate'`
  - `evaluateAsapJob(job, {hasOpenSchedulePrompt, hasActiveLink}, nowMs) -> 'ok'|'nudge'|'escalate'`
  - `evaluateUnclaimedJob(job, nowMs) -> {verdict: 'ok'|'fanout'|'escalate', kind: 'unclaimed'|'reclaim_stalled'}`
  - `buildAttentionUpdate(type, {detail, promptId, nowIso}) -> object`

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/sweepService.test.js`:

```js
const {
  SWEEP,
  toMs,
  evaluatePrompt,
  evaluateLink,
  evaluateAsapJob,
  evaluateUnclaimedJob,
  buildAttentionUpdate,
} = require('../sweepService');

// Fixed clock: 2026-07-14T02:30:00Z (= 10:30 SGT)
const NOW_MS = Date.UTC(2026, 6, 14, 2, 30, 0);
const hoursAgo = (h) => new Date(NOW_MS - h * 3600 * 1000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

describe('toMs', () => {
  test('parses ISO strings, Date, ms, and Timestamp-like objects', () => {
    expect(toMs('2026-07-14T02:30:00.000Z')).toBe(NOW_MS);
    expect(toMs(new Date(NOW_MS))).toBe(NOW_MS);
    expect(toMs(NOW_MS)).toBe(NOW_MS);
    expect(toMs({ toMillis: () => NOW_MS })).toBe(NOW_MS);
    expect(toMs(null)).toBeNull();
    expect(toMs('garbage')).toBeNull();
  });
});

describe('evaluatePrompt', () => {
  test('unexpired prompt is ok', () => {
    expect(evaluatePrompt({ status: 'open', expiresAt: hoursAgo(-2) }, NOW_MS)).toBe('ok');
  });
  test('expired, never nudged → nudge', () => {
    expect(evaluatePrompt({ status: 'open', expiresAt: hoursAgo(1) }, NOW_MS)).toBe('nudge');
  });
  test('expired after a nudge → escalate', () => {
    expect(evaluatePrompt({ status: 'open', expiresAt: hoursAgo(1), nudgedAt: hoursAgo(25) }, NOW_MS)).toBe('escalate');
  });
});

describe('evaluateLink', () => {
  test('unexpired active link is ok', () => {
    expect(evaluateLink({ status: 'active', expiresAt: hoursAgo(-1) }, NOW_MS)).toBe('ok');
  });
  test('expired original link → renew (one fresh link)', () => {
    expect(evaluateLink({ status: 'active', expiresAt: hoursAgo(1), createdBy: 'system_decline' }, NOW_MS)).toBe('renew');
  });
  test('expired system_nudge link → escalate (no third link)', () => {
    expect(evaluateLink({ status: 'active', expiresAt: hoursAgo(1), createdBy: 'system_nudge' }, NOW_MS)).toBe('escalate');
  });
});

describe('evaluateAsapJob', () => {
  const asap = (over = {}) => ({
    status: 'in_progress',
    preferredTiming: 'Immediate',
    acceptedAt: hoursAgo(30),
    ...over,
  });
  test('scheduled or already-fixed jobs are ok', () => {
    expect(evaluateAsapJob(asap({ preferredTiming: 'Schedule' }), {}, NOW_MS)).toBe('ok');
    expect(evaluateAsapJob(asap({ scheduledFromAsapAt: hoursAgo(1) }), {}, NOW_MS)).toBe('ok');
  });
  test('something in flight (open prompt or active link) is ok', () => {
    expect(evaluateAsapJob(asap(), { hasOpenSchedulePrompt: true }, NOW_MS)).toBe('ok');
    expect(evaluateAsapJob(asap(), { hasActiveLink: true }, NOW_MS)).toBe('ok');
  });
  test('under 24h is ok; over 24h with no nudge → nudge', () => {
    expect(evaluateAsapJob(asap({ acceptedAt: hoursAgo(10) }), {}, NOW_MS)).toBe('ok');
    expect(evaluateAsapJob(asap({ acceptedAt: hoursAgo(30) }), {}, NOW_MS)).toBe('nudge');
  });
  test('over 48h after a nudge → escalate; nudged but under 48h → ok', () => {
    expect(evaluateAsapJob(
      asap({ acceptedAt: hoursAgo(50), sweepNudges: { asap_no_time: hoursAgo(20) } }), {}, NOW_MS
    )).toBe('escalate');
    expect(evaluateAsapJob(
      asap({ acceptedAt: hoursAgo(30), sweepNudges: { asap_no_time: hoursAgo(2) } }), {}, NOW_MS
    )).toBe('ok');
  });
  test('missing acceptedAt is defensively ok', () => {
    expect(evaluateAsapJob(asap({ acceptedAt: undefined }), {}, NOW_MS)).toBe('ok');
  });
});

describe('evaluateUnclaimedJob', () => {
  const pending = (over = {}) => ({
    status: 'pending',
    paymentStatus: 'succeeded',
    handymanId: null,
    createdAt: daysAgo(4),
    ...over,
  });
  test('unpaid or assigned jobs are ok', () => {
    expect(evaluateUnclaimedJob(pending({ paymentStatus: 'pending' }), NOW_MS).verdict).toBe('ok');
    expect(evaluateUnclaimedJob(pending({ handymanId: 'hm1' }), NOW_MS).verdict).toBe('ok');
  });
  test('fresh unclaimed: 4d → fanout once, then ok until 7d, then escalate', () => {
    expect(evaluateUnclaimedJob(pending(), NOW_MS)).toEqual({ verdict: 'fanout', kind: 'unclaimed' });
    expect(evaluateUnclaimedJob(
      pending({ sweepNudges: { unclaimed_refanout: daysAgo(1) } }), NOW_MS
    ).verdict).toBe('ok');
    expect(evaluateUnclaimedJob(pending({ createdAt: daysAgo(8) }), NOW_MS))
      .toEqual({ verdict: 'escalate', kind: 'unclaimed' });
  });
  test('re-released job uses lastCancelledAt and 2d/4d thresholds', () => {
    const j = pending({ reassignmentCount: 1, createdAt: daysAgo(20), lastCancelledAt: daysAgo(3) });
    expect(evaluateUnclaimedJob(j, NOW_MS)).toEqual({ verdict: 'fanout', kind: 'reclaim_stalled' });
    expect(evaluateUnclaimedJob({ ...j, lastCancelledAt: daysAgo(5) }, NOW_MS))
      .toEqual({ verdict: 'escalate', kind: 'reclaim_stalled' });
  });
  test('under threshold is ok', () => {
    expect(evaluateUnclaimedJob(pending({ createdAt: daysAgo(1) }), NOW_MS).verdict).toBe('ok');
  });
});

describe('buildAttentionUpdate', () => {
  test('builds the exact escalation fields', () => {
    const nowIso = new Date(NOW_MS).toISOString();
    expect(buildAttentionUpdate('asap_no_time', { detail: 'no confirmed time', nowIso }))
      .toEqual({
        needsAttention: true,
        attentionNeeded: { type: 'asap_no_time', at: nowIso, detail: 'no confirmed time', promptId: null },
      });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions && npx jest __tests__/sweepService.test.js`
Expected: FAIL — `Cannot find module '../sweepService'`

- [ ] **Step 3: Write the implementation**

Create `functions/sweepService.js`:

```js
/**
 * Stuck-state sweep — pure detectors (lifecycle spec Scenario 12 / F5;
 * v1 machinery in docs/superpowers/specs/2026-07-13-stuck-state-sweep-design.md).
 *
 * Policy: every wait state gets ONE bounded nudge, then escalates to the
 * admin attention queue. These functions decide; the stuckStateSweep
 * orchestrator in index.js queries and acts. Detectors never touch
 * Firestore and never touch money.
 */

/** Thresholds (spec §3 — that doc governs over the Scenario 12 table). */
const SWEEP = Object.freeze({
  PROMPT_NUDGE_EXTEND_HOURS: 24,
  ASAP_NUDGE_HOURS: 24,
  ASAP_ESCALATE_HOURS: 48,
  UNCLAIMED_FANOUT_DAYS: 3,
  UNCLAIMED_ESCALATE_DAYS: 7,
  RECLAIM_FANOUT_DAYS: 2,
  RECLAIM_ESCALATE_DAYS: 4,
});

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Tolerant timestamp parse: job docs mix Firestore Timestamps (server
 * writes), ISO strings (client writes), and Dates. Null when unparseable
 * — callers treat null as "not stuck" (defensive: bad data must not
 * spam nudges).
 */
function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

/** Open prompt past expiresAt: nudge once (orchestrator extends +24h), then escalate. */
function evaluatePrompt(prompt, nowMs) {
  const exp = toMs(prompt.expiresAt);
  if (exp === null || exp > nowMs) return 'ok';
  return prompt.nudgedAt ? 'escalate' : 'nudge';
}

/**
 * Active link past expiresAt: renew once (expire + ONE fresh
 * system_nudge link — a nudge without a working link is useless), then
 * escalate. No third link, ever.
 */
function evaluateLink(link, nowMs) {
  const exp = toMs(link.expiresAt);
  if (exp === null || exp > nowMs) return 'ok';
  return link.createdBy === 'system_nudge' ? 'escalate' : 'renew';
}

/**
 * ASAP job with no confirmed time and NOTHING in flight (no open
 * schedule prompt, no active link): nudge the handyman at 24h from
 * acceptance, escalate at 48h.
 */
function evaluateAsapJob(job, { hasOpenSchedulePrompt = false, hasActiveLink = false } = {}, nowMs) {
  if (job.preferredTiming === 'Schedule' || job.scheduledFromAsapAt) return 'ok';
  if (hasOpenSchedulePrompt || hasActiveLink) return 'ok';
  const accepted = toMs(job.acceptedAt);
  if (accepted === null) return 'ok';
  const hours = (nowMs - accepted) / HOUR_MS;
  const nudged = !!(job.sweepNudges && job.sweepNudges.asap_no_time);
  if (nudged) return hours >= SWEEP.ASAP_ESCALATE_HOURS ? 'escalate' : 'ok';
  return hours >= SWEEP.ASAP_NUDGE_HOURS ? 'nudge' : 'ok';
}

/**
 * Paid, pending, unassigned job: re-run the fan-out once at 3d (2d for
 * a re-released job, measured from lastCancelledAt), escalate at 7d/4d.
 * Money is sitting in the platform balance on every one of these.
 */
function evaluateUnclaimedJob(job, nowMs) {
  const reclaim = (job.reassignmentCount || 0) > 0;
  const kind = reclaim ? 'reclaim_stalled' : 'unclaimed';
  if (job.handymanId || job.paymentStatus !== 'succeeded') return { verdict: 'ok', kind };
  const base = toMs(reclaim ? (job.lastCancelledAt || job.createdAt) : job.createdAt);
  if (base === null) return { verdict: 'ok', kind };
  const days = (nowMs - base) / DAY_MS;
  const fanoutAt = reclaim ? SWEEP.RECLAIM_FANOUT_DAYS : SWEEP.UNCLAIMED_FANOUT_DAYS;
  const escalateAt = reclaim ? SWEEP.RECLAIM_ESCALATE_DAYS : SWEEP.UNCLAIMED_ESCALATE_DAYS;
  const nudgeKey = reclaim ? 'reclaim_refanout' : 'unclaimed_refanout';
  if (days >= escalateAt) return { verdict: 'escalate', kind };
  const nudged = !!(job.sweepNudges && job.sweepNudges[nudgeKey]);
  if (!nudged && days >= fanoutAt) return { verdict: 'fanout', kind };
  return { verdict: 'ok', kind };
}

/** Escalation fields written to the job (needsAttention is the queryable flag). */
function buildAttentionUpdate(type, { detail = null, promptId = null, nowIso }) {
  return {
    needsAttention: true,
    attentionNeeded: { type, at: nowIso, detail, promptId },
  };
}

module.exports = {
  SWEEP,
  toMs,
  evaluatePrompt,
  evaluateLink,
  evaluateAsapJob,
  evaluateUnclaimedJob,
  buildAttentionUpdate,
};
```

- [ ] **Step 4: Run the full suite**

Run: `cd /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions && npx jest`
Expected: ALL suites pass (51 existing + the new ones).

- [ ] **Step 5: Commit (anti-iCloud protocol)**

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/sweepService.js functions/__tests__/sweepService.test.js
git diff --staged
git commit -m "feat(sweep): stuck-state detectors (prompt/link/asap/unclaimed ladders)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/sweepService.js | grep -c "evaluateUnclaimedJob"
```

---

### Task 2: inert-poll fix + `stuckStateSweep` scheduled function + indexes

**Files:**
- Modify: `functions/index.js` — (a) widen `applyCompletionAnswer`'s transaction condition (search `status !== 'pending_confirmation'` inside `applyCompletionAnswer`, ~line 2578); (b) add the sweepService require next to the scheduleLinkService require; (c) add `exports.stuckStateSweep` directly after `exports.autoTriggerCompletionPoll` ends.
- Modify: `firestore.indexes.json` — two new composite indexes.

**Interfaces:**
- Consumes: Task 1's exports; existing `openPrompt`-shaped prompt docs (fields `jobId, type, toPhone, toRole, question, status, expiresAt`), `issueScheduleLink`, `sendTwilioMessage`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`, `sendAdminEmail`, `escapeHtml`, `runHandymanFanOut({job, jobId, db, sendTwilioTemplateMessage, checkRateLimit, logger, round, excludeIds})`, `checkRateLimit`, `APP_URL`.
- Produces: jobs carrying `needsAttention`/`attentionNeeded`/`sweepNudges` (read by Tasks 3+5); prompts gaining `nudgedAt`; env var `TWILIO_TEMPLATE_PROMPT_NUDGE` (optional, freeform fallback).

- [ ] **Step 1: Fix `applyCompletionAnswer`**

Replace inside the transaction (the fix makes YES to an auto-fired poll count — the nightly poll leaves jobs `in_progress` with `completionPollSentAt` set):

```js
      const fresh = await tx.get(jobRef);
      if (!fresh.exists) {
        throw new Error('ALREADY_PROCESSED');
      }
      const freshData = fresh.data();
      // Accept the answer while the question is actually open: either the
      // handyman marked complete (pending_confirmation) or the nightly
      // auto-poll asked the customer while the job stayed in_progress.
      const pollOpen = freshData.status === 'in_progress' && !!freshData.completionPollSentAt;
      if (freshData.status !== 'pending_confirmation' && !pollOpen) {
        throw new Error('ALREADY_PROCESSED');
      }
      jobData = freshData;
```

(The `if (isConfirm)`/else update block below stays unchanged.) Also update the function's doc comment line "re-checks status === 'pending_confirmation'" to mention both accepted states.

- [ ] **Step 2: Add the require**

Next to `require('./scheduleLinkService')`:

```js
const {
  SWEEP,
  evaluatePrompt,
  evaluateLink,
  evaluateAsapJob,
  evaluateUnclaimedJob,
  buildAttentionUpdate,
} = require('./sweepService');
```

- [ ] **Step 3: Add the scheduled function**

After `autoTriggerCompletionPoll`:

```js
/**
 * stuckStateSweep — Scenario 12's safety net (spec:
 * 2026-07-13-stuck-state-sweep-design.md). Runs daily at 10:30 SGT,
 * 30 min after the completion poll, so freshly-sent polls are never
 * inspected in the run that created them.
 *
 * Four ladders, each nudging AT MOST ONCE per state before escalating
 * to the admin attention queue (needsAttention on the job + one digest
 * email per run). The sweep never touches money.
 */
exports.stuckStateSweep = functions.pubsub
  .schedule('every day 10:30')
  .timeZone('Asia/Singapore')
  .onRun(async () => {
    const db = admin.firestore();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const escalations = []; // {jobId, type, detail} for the digest
    const counts = { nudged: 0, escalated: 0, renewedLinks: 0, fanouts: 0 };

    const escalate = async (jobId, type, detail, promptId = null) => {
      try {
        await db.collection('jobs').doc(jobId)
          .update(buildAttentionUpdate(type, { detail, promptId, nowIso }));
        escalations.push({ jobId, type, detail });
        counts.escalated++;
      } catch (err) {
        console.error(`⚠️ Sweep escalation write failed for job ${jobId} (${type}):`, err);
      }
    };

    // ---- Ladder 1: open prompts past expiry (CG query, capped) ----
    try {
      const snap = await db.collectionGroup('prompts')
        .where('status', '==', 'open')
        .where('expiresAt', '<=', nowIso)
        .limit(200)
        .get();
      if (snap.size === 200) console.warn('⚠️ Sweep prompt query hit the 200 cap — rerun tomorrow covers the rest');
      for (const doc of snap.docs) {
        const p = doc.data();
        const verdict = evaluatePrompt(p, nowMs);
        const jobShortId = String(p.jobId || '').slice(-6);
        if (verdict === 'nudge') {
          try {
            const isPoll = p.type === 'completion_confirmation';
            const fallback = isPoll
              ? `⏰ Reminder for Job #${jobShortId}: was your job completed?\n\n👉 Reply *YES* to confirm\n👉 Reply *NO* to report an issue`
              : `⏰ Reminder (Job #${jobShortId}) — we're still waiting for your reply:\n\n${String(p.question || '').slice(0, 200)}\n\nPlease reply when you can.`;
            await sendTwilioTemplateMessage(
              formatPhoneToWhatsApp(p.toPhone),
              process.env.TWILIO_TEMPLATE_PROMPT_NUDGE,
              { '1': String(p.question || '').slice(0, 120), '2': jobShortId },
              fallback,
            );
            await doc.ref.update({
              nudgedAt: nowIso,
              expiresAt: new Date(nowMs + SWEEP.PROMPT_NUDGE_EXTEND_HOURS * 3600 * 1000).toISOString(),
            });
            counts.nudged++;
          } catch (err) {
            console.error(`⚠️ Prompt nudge failed for ${doc.ref.path}:`, err);
          }
        } else if (verdict === 'escalate') {
          try {
            await doc.ref.update({ status: 'expired', expiredAt: nowIso });
          } catch (err) {
            console.error(`⚠️ Prompt expire write failed for ${doc.ref.path}:`, err);
          }
          await escalate(p.jobId, 'prompt_expired',
            `${p.type} to ${p.toRole} unanswered after nudge`, doc.id);
        }
      }
    } catch (err) {
      console.error('⚠️ Sweep ladder 1 (prompts) failed:', err);
    }

    // ---- Ladder 2a: active schedule links past expiry ----
    try {
      const snap = await db.collection('scheduleLinks')
        .where('status', '==', 'active')
        .where('expiresAt', '<=', nowIso)
        .limit(100)
        .get();
      for (const doc of snap.docs) {
        const link = doc.data();
        const verdict = evaluateLink(link, nowMs);
        const jobShortId = String(link.jobId || '').slice(-6);
        if (verdict === 'renew') {
          try {
            await doc.ref.update({ status: 'expired', expiredAt: nowIso });
            // Job must still be schedulable; otherwise just drop the link.
            const jobSnap = await db.collection('jobs').doc(link.jobId).get();
            if (!jobSnap.exists || jobSnap.data().status !== 'in_progress') continue;
            const { token } = await issueScheduleLink({
              db, jobId: link.jobId, customerPhone: link.customerPhone, createdBy: 'system_nudge',
            });
            await sendTwilioTemplateMessage(
              formatPhoneToWhatsApp(link.customerPhone),
              process.env.TWILIO_TEMPLATE_SCHEDULE_LINK,
              { '1': jobShortId, '2': token },
              `⏰ Your pick-a-time link for Job #${jobShortId} expired — here's a fresh one (valid 72 hours):\n${APP_URL}/pick-time?t=${token}`,
            );
            counts.renewedLinks++;
          } catch (err) {
            console.error(`⚠️ Link renew failed for job ${link.jobId}:`, err);
          }
        } else if (verdict === 'escalate') {
          try {
            await doc.ref.update({ status: 'expired', expiredAt: nowIso });
          } catch (err) {
            console.error(`⚠️ Link expire write failed for ${doc.id}:`, err);
          }
          await escalate(link.jobId, 'link_ignored', 'customer ignored two pick-time links');
        }
      }
    } catch (err) {
      console.error('⚠️ Sweep ladder 2a (links) failed:', err);
    }

    // ---- Ladders 2b + 3: job scans (in_progress ASAP gaps; pending unclaimed) ----
    try {
      const inProgress = await db.collection('jobs')
        .where('status', '==', 'in_progress').limit(300).get();
      for (const doc of inProgress.docs) {
        const job = doc.data();
        if (job.preferredTiming === 'Schedule' || job.scheduledFromAsapAt) continue;
        // Anything already in flight?
        const openPrompts = await doc.ref.collection('prompts')
          .where('status', '==', 'open').get();
        const hasOpenSchedulePrompt = openPrompts.docs.some((d) =>
          ['schedule_approval', 'schedule_pick_approval'].includes(d.data().type));
        const activeLinks = await db.collection('scheduleLinks')
          .where('jobId', '==', doc.id).where('status', '==', 'active').limit(1).get();
        const verdict = evaluateAsapJob(job,
          { hasOpenSchedulePrompt, hasActiveLink: !activeLinks.empty }, nowMs);
        if (verdict === 'nudge') {
          try {
            const hmSnap = await db.collection('handymen').doc(job.handymanId).get();
            const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
            if (hmPhone) {
              await sendTwilioMessage(
                formatPhoneToWhatsApp(hmPhone),
                `⏰ Job #${doc.id.slice(-6)} still has no confirmed visit time. Please tap "Set visit time" on the job page so the customer can approve it.`
              );
            }
            await doc.ref.update({ 'sweepNudges.asap_no_time': nowIso });
            counts.nudged++;
          } catch (err) {
            console.error(`⚠️ ASAP nudge failed for job ${doc.id}:`, err);
          }
        } else if (verdict === 'escalate') {
          await escalate(doc.id, 'asap_no_time', 'ASAP job accepted but no visit time confirmed');
        }
      }
    } catch (err) {
      console.error('⚠️ Sweep ladder 2b (ASAP) failed:', err);
    }

    try {
      const pending = await db.collection('jobs')
        .where('status', '==', 'pending').limit(300).get();
      for (const doc of pending.docs) {
        const job = doc.data();
        const { verdict, kind } = evaluateUnclaimedJob(job, nowMs);
        if (verdict === 'fanout') {
          try {
            // Round 900+N: a marker namespace the accept/cancel rounds
            // never use, so this re-notification is idempotent per sweep
            // era and cannot collide with organic rounds.
            await runHandymanFanOut({
              job, jobId: doc.id, db,
              sendTwilioTemplateMessage, checkRateLimit, logger: console,
              round: 900 + (job.reassignmentCount || 0),
              excludeIds: Array.isArray(job.previousHandymanIds) ? job.previousHandymanIds : [],
            });
            const key = kind === 'reclaim_stalled' ? 'reclaim_refanout' : 'unclaimed_refanout';
            await doc.ref.update({ [`sweepNudges.${key}`]: nowIso });
            counts.fanouts++;
          } catch (err) {
            console.error(`⚠️ Sweep fan-out failed for job ${doc.id}:`, err);
          }
        } else if (verdict === 'escalate') {
          await escalate(doc.id, kind,
            kind === 'unclaimed' ? 'paid job never accepted' : 're-released job never re-claimed');
        }
      }
    } catch (err) {
      console.error('⚠️ Sweep ladder 3 (unclaimed) failed:', err);
    }

    // ---- One digest email per run (free SMTP; deadlocks already email immediately) ----
    if (escalations.length > 0) {
      const rows = escalations.map((e) =>
        `<tr><td>${escapeHtml(String(e.jobId).slice(-6))}</td><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.detail || '')}</td></tr>`
      ).join('');
      await sendAdminEmail(
        `⚠️ Attention needed: ${escalations.length} stuck job${escalations.length > 1 ? 's' : ''}`,
        `<p>The daily sweep escalated ${escalations.length} job(s) to the attention queue:</p>
         <table border="1" cellpadding="6"><tr><th>Job</th><th>Type</th><th>Why</th></tr>${rows}</table>
         <p>Resolve them from the admin dashboard's Active jobs section.</p>`
      );
    }

    console.log(`🧹 Sweep done: ${counts.nudged} nudged, ${counts.renewedLinks} links renewed, ${counts.fanouts} fan-outs, ${counts.escalated} escalated`);
    return null;
  });
```

- [ ] **Step 4: Add the two composite indexes**

In `firestore.indexes.json`, append to the `indexes` array:

```json
    {
      "collectionGroup": "prompts",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "scheduleLinks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 5: Verify + commit**

Run: `node --check functions/index.js` (exit 0); `cd functions && npx jest` (all pass); `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('json ok')"`.

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/index.js firestore.indexes.json
git diff --staged
git commit -m "feat(sweep): stuckStateSweep daily function + inert auto-poll confirm fix

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/index.js | grep -c "stuckStateSweep"
```

---

### Task 3: admin endpoints — `resolveAttention`, `adminSetSchedule`, `adminUnassignJob`

**Files:**
- Modify: `functions/index.js` — three endpoints added after `sendScheduleLink`'s closing `});`.

**Interfaces:**
- Consumes: existing `verifyAuthToken`, `verifyAdminAccess`, `checkRateLimit`, `applyScheduleChange`, `validateScheduleProposal`/`ScheduleError`, `buildCancelUpdate` (from `./jobReassignment`, already required), `runHandymanFanOut`, `revokeActiveLinks`, `sendTwilioMessage`, `sendTwilioTemplateMessage`, `formatPhoneToWhatsApp`, `writeAuditLog`, `admin.firestore.FieldValue`.
- Produces (Task 4 calls these): `POST resolveAttention {jobId, markCancelled?}`; `POST adminSetSchedule {jobId, newDate, newTime, note?}`; `POST adminUnassignJob {jobId, note?}` — all admin Bearer, all return `{success: true}` or `{error, code?}`.

- [ ] **Step 1: Add `resolveAttention`**

```js
/**
 * resolveAttention — admin clears a job's attention flag (Scenario 12
 * queue). With markCancelled it also closes the job after a refund
 * (the queue's refund button calls the existing refundPayment endpoint
 * first, then this with markCancelled: true).
 */
exports.resolveAttention = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      const decodedToken = await verifyAuthToken(req);
      verifyAdminAccess(decodedToken);
      const { jobId, markCancelled } = req.body || {};
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
      const jobRef = admin.firestore().collection('jobs').doc(jobId);
      const snap = await jobRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Job not found' });

      const update = {
        needsAttention: admin.firestore.FieldValue.delete(),
        attentionNeeded: admin.firestore.FieldValue.delete(),
      };
      if (markCancelled === true) {
        update.status = 'cancelled';
        update.cancelledAt = new Date().toISOString();
        update.cancelledVia = 'admin_queue';
      }
      await jobRef.update(update);
      await writeAuditLog('attention_resolved', decodedToken, {
        jobId, markCancelled: markCancelled === true,
        priorAttentionType: (snap.data().attentionNeeded && snap.data().attentionNeeded.type) || null,
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Error in resolveAttention:', error);
      if (error.message.includes('Unauthorized')) return res.status(401).json({ error: error.message });
      if (error.message.includes('Forbidden')) return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: 'Failed to resolve attention' });
    }
  });
});
```

- [ ] **Step 2: Add `adminSetSchedule`**

```js
/**
 * adminSetSchedule — F5 admin-as-actor "set the time after phoning both
 * parties". Applies through the F4 single writer (via 'admin'), then
 * closes every competing channel: open schedule prompts superseded,
 * active links revoked, attention cleared. Both parties notified.
 */
exports.adminSetSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      const decodedToken = await verifyAuthToken(req);
      verifyAdminAccess(decodedToken);
      const { jobId, newDate, newTime, note } = req.body || {};
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
      try {
        validateScheduleProposal({ date: newDate, time: newTime });
      } catch (err) {
        if (err instanceof ScheduleError) return res.status(400).json({ error: err.message, code: err.code });
        throw err;
      }

      const changeResult = await applyScheduleChange({
        db: admin.firestore(), jobId,
        newDate, newTime: String(newTime),
        actor: decodedToken.uid, via: 'admin',
        note: String(note || '').trim() || null, promptId: null,
      });
      if (changeResult.outcome === 'wrong_status') {
        return res.status(409).json({ error: 'This job can no longer be rescheduled' });
      }

      // Close competing channels — a settled schedule kills open asks.
      try {
        const openPrompts = await admin.firestore()
          .collection('jobs').doc(jobId).collection('prompts')
          .where('status', '==', 'open').get();
        await Promise.all(openPrompts.docs
          .filter((d) => ['schedule_approval', 'schedule_pick_approval'].includes(d.data().type))
          .map((d) => d.ref.update({ status: 'superseded', supersededAt: new Date().toISOString() })));
        await revokeActiveLinks({ db: admin.firestore(), jobId });
        await admin.firestore().collection('jobs').doc(jobId).update({
          needsAttention: admin.firestore.FieldValue.delete(),
          attentionNeeded: admin.firestore.FieldValue.delete(),
        });
      } catch (cleanupErr) {
        console.error('⚠️ adminSetSchedule cleanup failed (continuing):', cleanupErr);
      }

      const job = changeResult.job;
      const jobShortId = String(jobId).slice(-6);
      const displayDate = new Date(newDate).toLocaleDateString('en-SG', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      try {
        if (job.customerPhone) {
          await sendTwilioMessage(
            formatPhoneToWhatsApp(job.customerPhone),
            `📅 Update on Job #${jobShortId}: your visit is now set for *${displayDate}* at *${newTime}* — arranged with our team. See you then! 🔧`
          );
        }
        if (job.handymanId) {
          const hmSnap = await admin.firestore().collection('handymen').doc(job.handymanId).get();
          const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
          if (hmPhone) {
            await sendTwilioMessage(
              formatPhoneToWhatsApp(hmPhone),
              `📅 Our team set Job #${jobShortId} to ${displayDate} at ${newTime}. Please plan for it.`
            );
          }
        }
      } catch (notifyErr) {
        console.error('⚠️ adminSetSchedule notifications failed (continuing):', notifyErr);
      }

      await writeAuditLog('admin_set_schedule', decodedToken, { jobId, newDate, newTime: String(newTime) });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Error in adminSetSchedule:', error);
      if (error.message.includes('Unauthorized')) return res.status(401).json({ error: error.message });
      if (error.message.includes('Forbidden')) return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: 'Failed to set schedule' });
    }
  });
});
```

- [ ] **Step 3: Add `adminUnassignJob`**

```js
/**
 * adminUnassignJob — F5 forcing action: strip the current handyman and
 * re-release (Scenario 2 machinery). Unlike the handyman self-cancel,
 * this is allowed even after the completion poll went out — forcing
 * actions exist precisely for jobs wedged past the self-serve window.
 */
exports.adminUnassignJob = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      const decodedToken = await verifyAuthToken(req);
      verifyAdminAccess(decodedToken);
      const rl = await checkRateLimit(`admin_unassign_${decodedToken.uid}`, 10, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many unassignments — please slow down' });
      }
      const { jobId, note } = req.body || {};
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

      const jobRef = admin.firestore().collection('jobs').doc(jobId);
      let jobData; let updatePayload; let removedHandymanId;
      try {
        await admin.firestore().runTransaction(async (tx) => {
          const snap = await tx.get(jobRef);
          if (!snap.exists) throw new Error('NOT_FOUND');
          const job = snap.data();
          if (job.status !== 'in_progress' || !job.handymanId) throw new Error('WRONG_STATUS');
          jobData = job;
          removedHandymanId = job.handymanId;
          updatePayload = buildCancelUpdate(job, job.handymanId, {
            reason: 'admin_forced',
            note: String(note || '').trim(),
            nowIso: new Date().toISOString(),
          });
          tx.update(jobRef, updatePayload);
        });
      } catch (err) {
        if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Job not found' });
        if (err.message === 'WRONG_STATUS') return res.status(409).json({ error: 'Job is not in progress with an assigned handyman' });
        throw err;
      }

      // Close every open channel tied to the removed assignment.
      try {
        const openPrompts = await jobRef.collection('prompts').where('status', '==', 'open').get();
        await Promise.all(openPrompts.docs.map((d) =>
          d.ref.update({ status: 'superseded', supersededAt: new Date().toISOString() })));
        await revokeActiveLinks({ db: admin.firestore(), jobId });
        await jobRef.update({
          needsAttention: admin.firestore.FieldValue.delete(),
          attentionNeeded: admin.firestore.FieldValue.delete(),
        });
      } catch (cleanupErr) {
        console.error('⚠️ adminUnassignJob cleanup failed (continuing):', cleanupErr);
      }

      // Side effects mirror cancelJobAssignment (best-effort, caught).
      try {
        await admin.firestore().collection('handymen').doc(removedHandymanId)
          .update({ cancellationCount: admin.firestore.FieldValue.increment(1) });
      } catch (err) {
        console.error(`⚠️ cancellationCount increment failed for ${removedHandymanId}:`, err);
      }
      try {
        const hmSnap = await admin.firestore().collection('handymen').doc(removedHandymanId).get();
        const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
        if (hmPhone) {
          await sendTwilioMessage(
            formatPhoneToWhatsApp(hmPhone),
            `ℹ️ Our team has removed you from Job #${jobId.slice(-6)} and is reassigning it. Questions? Contact easydonehandyman@gmail.com`
          );
        }
      } catch (err) {
        console.error('⚠️ Removed-handyman notice failed:', err);
      }
      if (jobData.customerPhone) {
        try {
          const shortId = jobId.slice(-6);
          await sendTwilioTemplateMessage(
            formatPhoneToWhatsApp(jobData.customerPhone),
            process.env.TWILIO_TEMPLATE_HANDYMAN_CANCELLED,
            { '1': jobData.customerName || 'there', '2': shortId, '3': jobData.serviceType || 'your job' },
            `Update on Job #${shortId} (${jobData.serviceType}):\n\nYour handyman is no longer available. We're finding you a new one — no action needed, and your payment stays protected.\n\nQuestions? Contact easydonehandyman@gmail.com`,
          );
        } catch (err) {
          console.error(`⚠️ Customer unassign notice failed for job ${jobId}:`, err);
        }
      }
      try {
        await runHandymanFanOut({
          job: { ...jobData, ...updatePayload, handymanId: null, status: 'pending' },
          jobId, db: admin.firestore(),
          sendTwilioTemplateMessage, checkRateLimit, logger: console,
          round: updatePayload.reassignmentCount,
          excludeIds: updatePayload.previousHandymanIds,
        });
      } catch (err) {
        console.error(`⚠️ Unassign fan-out failed for job ${jobId}:`, err);
      }

      await writeAuditLog('admin_force_unassign', decodedToken, {
        jobId, removedHandymanId,
        note: String(note || '').slice(0, 500) || null,
        reassignmentCount: updatePayload.reassignmentCount,
      });
      return res.status(200).json({ success: true, reassignmentCount: updatePayload.reassignmentCount });
    } catch (error) {
      console.error('❌ Error in adminUnassignJob:', error);
      if (error.message.includes('Unauthorized')) return res.status(401).json({ error: error.message });
      if (error.message.includes('Forbidden')) return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: 'Failed to unassign job' });
    }
  });
});
```

Note: `buildCancelUpdate` accepts `reason: 'admin_forced'` because only `validateCancelRequest` (deliberately NOT called here) checks the reason picklist; the history entry records `cancelReason: 'admin_forced'`, which the admin fund-release history view renders via its label fallback.

- [ ] **Step 4: Verify + commit**

Run: `node --check functions/index.js`; `cd functions && npx jest` (all pass).

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/index.js
git diff --staged
git commit -m "feat(admin): resolveAttention, adminSetSchedule, adminUnassignJob forcing actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/index.js | grep -c "adminUnassignJob"
```

---

### Task 4: frontend admin-queue service

**Files:**
- Create: `src/services/api/adminQueue.js`

**Interfaces:**
- Consumes: Task 3's endpoints + existing `refundPayment` Cloud Function (NOTE: the legacy wrapper in `src/services/stripe/stripeApi.js` sends NO auth header and would 401 — do not reuse it).
- Produces (Task 5 imports): `resolveAttention(jobId, {markCancelled} = {})`, `adminSetSchedule(jobId, newDate, newTime, note = '')`, `adminUnassignJob(jobId, note = '')`, `adminRefundJob(paymentIntentId)` — all return `{success, error?}` and never throw.

- [ ] **Step 1: Create the service**

```js
/**
 * Admin attention-queue service (lifecycle spec Scenario 12 / F5).
 *
 * Thin authed wrappers over the admin forcing-action endpoints. All of
 * them require the caller's Firebase user to hold the admin claim; the
 * server re-verifies. Never throws — {success, error?} shape, matching
 * jobSchedule.js / scheduleLink.js.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

const post = async (path, body) => {
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
      return { success: false, error: result.error || 'Request failed. Please try again.' };
    }
    return { success: true, ...result };
  } catch (error) {
    console.error(`❌ Error calling ${path}:`, error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

export const resolveAttention = (jobId, { markCancelled = false } = {}) =>
  post('resolveAttention', { jobId, markCancelled });

export const adminSetSchedule = (jobId, newDate, newTime, note = '') =>
  post('adminSetSchedule', { jobId, newDate, newTime, note });

export const adminUnassignJob = (jobId, note = '') =>
  post('adminUnassignJob', { jobId, note });

/**
 * Refund via the EXISTING refundPayment endpoint (it already authorizes
 * admins and handles transfer reversal). The caller follows up with
 * resolveAttention(jobId, {markCancelled: true}) on success.
 */
export const adminRefundJob = (paymentIntentId) =>
  post('refundPayment', { paymentIntentId, reason: 'requested_by_customer' });
```

- [ ] **Step 2: Verify + commit**

Run: `CI=true npx react-scripts build` (compiles — the file is not imported yet, but the build catches syntax).

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add src/services/api/adminQueue.js
git diff --staged
git commit -m "feat(admin): attention-queue service wrappers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:src/services/api/adminQueue.js | grep -c "adminRefundJob"
```

---

### Task 5: `ActiveJobsTable` → attention queue UI

**Files:**
- Create: `src/components/admin/AdminSetTimeModal.jsx`
- Modify: `src/components/admin/ActiveJobsTable.jsx` (query merge + reason chip + four actions)

**Interfaces:**
- Consumes: Task 4's service; existing `getProposalDateBounds` from `src/services/api/jobSchedule.js`; Firestore web SDK.
- Produces: nothing consumed later.

- [ ] **Step 1: Create `AdminSetTimeModal.jsx`**

Mount-and-toggle modal, same pattern as `ProposeTimeModal` (state resets on open; plain conditional render — NOT a nested component function, which remounts per keystroke):

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { adminSetSchedule } from '../../services/api/adminQueue';
import { getProposalDateBounds } from '../../services/api/jobSchedule';

/**
 * AdminSetTimeModal — F5 admin-as-actor set-time (Scenario 12 queue).
 * Applies immediately via adminSetSchedule (no approval round); the
 * admin is expected to have phoned both parties first, and the copy
 * says so.
 */
const AdminSetTimeModal = ({ job, isOpen, onClose, onApplied }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setDate(''); setTime(''); setNote(''); setError(null);
      setIsSubmitting(false); submittingRef.current = false;
    }
  }, [isOpen, job && job.id]);

  if (!isOpen || !job) return null;

  const dateBounds = getProposalDateBounds();
  const canSubmit = date && time.trim();

  const handleConfirm = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    const result = await adminSetSchedule(job.id, date, time.trim(), note.trim());
    if (result.success) {
      onApplied();
    } else {
      setError(result.error);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Set visit time (admin) — #{job.id.slice(-6)}
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Applies immediately and notifies both parties — call them first. Open
          proposals and pick-links for this job are closed.
        </p>

        <label htmlFor="admin-set-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          id="admin-set-date" type="date"
          min={dateBounds.min} max={dateBounds.max}
          value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />
        <label htmlFor="admin-set-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Time <span className="text-red-500">*</span>
        </label>
        <input
          id="admin-set-time" type="text" maxLength={20} placeholder="e.g. 2:00 PM"
          value={time} onChange={(e) => setTime(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />
        <label htmlFor="admin-set-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Internal note <span className="text-gray-400">(optional, kept in schedule history)</span>
        </label>
        <textarea
          id="admin-set-note" rows={2} maxLength={300}
          value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose} disabled={isSubmitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm} disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Applying…' : 'Set time'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSetTimeModal;
```

- [ ] **Step 2: Upgrade `ActiveJobsTable.jsx`**

Read the current file first. Apply these changes (keep everything not mentioned):

(a) Imports:
```jsx
import { resolveAttention, adminUnassignJob, adminRefundJob } from '../../services/api/adminQueue';
import AdminSetTimeModal from './AdminSetTimeModal';
```

(b) In `fetchJobs`, replace the single query with a merged read (attention rows of ANY status + all in_progress):
```jsx
      const jobsCol = collection(db, 'jobs');
      const [inProgressSnap, attentionSnap] = await Promise.all([
        getDocs(query(jobsCol, where('status', '==', 'in_progress'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(jobsCol, where('needsAttention', '==', true), limit(50))),
      ]);
      const byId = new Map();
      [...inProgressSnap.docs, ...attentionSnap.docs].forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
      const rows = [...byId.values()];
      rows.sort((a, b) => (b.needsAttention ? 1 : 0) - (a.needsAttention ? 1 : 0));
      setJobs(rows);
```

(c) New state + handlers inside the component:
```jsx
  const [setTimeJob, setSetTimeJob] = useState(null); // job whose set-time modal is open
  const [actionState, setActionState] = useState({}); // { [jobId]: 'busy' | <error string> }

  const runAction = async (jobId, fn) => {
    setActionState((s) => ({ ...s, [jobId]: 'busy' }));
    const result = await fn();
    if (result.success) {
      setActionState((s) => ({ ...s, [jobId]: undefined }));
      fetchJobs();
    } else {
      setActionState((s) => ({ ...s, [jobId]: result.error || 'Failed' }));
    }
  };

  const handleResolve = (job) => {
    if (!window.confirm(`Clear the attention flag on Job #${job.id.slice(-6)}?`)) return;
    runAction(job.id, () => resolveAttention(job.id));
  };

  const handleUnassign = (job) => {
    const note = window.prompt(
      `Force-unassign ${(job.acceptedBy && job.acceptedBy.name) || 'the handyman'} from Job #${job.id.slice(-6)}?\n\nThe job re-releases to the board and they cannot re-claim it. Optional note:`
    );
    if (note === null) return; // cancelled
    runAction(job.id, () => adminUnassignJob(job.id, note));
  };

  const handleRefund = (job) => {
    if (!window.confirm(
      `Refund Job #${job.id.slice(-6)} (S$${job.estimatedBudget || '?'}) to the customer and cancel the job?\n\nThis cannot be undone.`
    )) return;
    runAction(job.id, async () => {
      const refund = await adminRefundJob(job.paymentIntentId);
      if (!refund.success) return refund;
      // Close the job + clear attention; if this half fails the row shows
      // the error and 'Mark resolved' is the retry path.
      return resolveAttention(job.id, { markCancelled: true });
    });
  };
```

(d) Reason chip: extend the existing `attentionNeeded` label to show the type generically plus age:
```jsx
                  {job.attentionNeeded && (
                    <span className="ml-2 inline-block text-xs font-bold text-red-700 dark:text-red-300 uppercase">
                      Needs attention · {String(job.attentionNeeded.type || '').replace(/_/g, ' ')}
                      {job.attentionNeeded.at ? ` · since ${new Date(job.attentionNeeded.at).toLocaleDateString('en-SG')}` : ''}
                    </span>
                  )}
```

(e) Actions cell — replace the single Send-reschedule-link button block with a button group (send-link button and its `sendState` logic stay as-is, joined by the new ones):
```jsx
              <div className="mt-3 md:mt-0 shrink-0 flex flex-col gap-2 md:items-end">
                <div className="flex flex-wrap gap-2">
                  {job.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => handleSendLink(job)}
                        disabled={state === 'sending' || state === 'sent' || !job.customerPhone}
                        className="bg-primary text-black text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Link sent ✓' : 'Send reschedule link'}
                      </button>
                      <button
                        onClick={() => setSetTimeJob(job)}
                        disabled={busy}
                        className="bg-blue-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Set time
                      </button>
                      <button
                        onClick={() => handleUnassign(job)}
                        disabled={busy || !job.handymanId}
                        className="bg-orange-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        Force unassign
                      </button>
                    </>
                  )}
                  {job.paymentIntentId && job.paymentStatus === 'succeeded' && (
                    <button
                      onClick={() => handleRefund(job)}
                      disabled={busy}
                      className="bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Refund
                    </button>
                  )}
                  {job.needsAttention && (
                    <button
                      onClick={() => handleResolve(job)}
                      disabled={busy}
                      className="bg-gray-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
                {typeof actionState[job.id] === 'string' && actionState[job.id] !== 'busy' && (
                  <p className="text-xs text-red-600 dark:text-red-400">{actionState[job.id]}</p>
                )}
                {state && state !== 'sending' && state !== 'sent' && (
                  <p className="text-xs text-red-600 dark:text-red-400">{state}</p>
                )}
              </div>
```
with, inside the `jobs.map` callback before the return: `const busy = actionState[job.id] === 'busy';`

(f) Mount the modal before the component's closing tag (sibling of the rows container, inside the outermost div):
```jsx
      <AdminSetTimeModal
        job={setTimeJob}
        isOpen={!!setTimeJob}
        onClose={() => setSetTimeJob(null)}
        onApplied={() => { setSetTimeJob(null); fetchJobs(); }}
      />
```

(g) The empty-state copy changes from "No jobs are currently in progress." to "No active or flagged jobs." Row rendering must tolerate non-in_progress rows (pending unclaimed jobs have no handyman — the existing `'—'` fallbacks already cover this; also show `job.status` in the schedule line for non-in_progress rows):
```jsx
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {job.status !== 'in_progress' ? `Status: ${job.status} · ` : ''}Schedule: {scheduleLabel(job)}
                  {Array.isArray(job.scheduleHistory) && job.scheduleHistory.length > 0 &&
                    ` · ${job.scheduleHistory.length} change${job.scheduleHistory.length > 1 ? 's' : ''}`}
                </p>
```

- [ ] **Step 3: Verify + commit**

Run: `CI=true npx react-scripts build` → `Compiled successfully.`

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add src/components/admin/AdminSetTimeModal.jsx src/components/admin/ActiveJobsTable.jsx
git diff --staged
git commit -m "feat(admin): attention queue actions — resolve, set time, force unassign, refund

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:src/components/admin/ActiveJobsTable.jsx | grep -c "handleRefund"
```

---

### Task 6: rules for `needsAttention` + `sweepNudges`

**Files:**
- Modify: `firestore.rules` — add `'needsAttention'` and `'sweepNudges'` to BOTH `jobSystemFields()` and `jobCreateDeniedFields()`, adjacent to the existing `'attentionNeeded'` entries (added in stage 3b). Read both functions first and match their exact formatting.

**Interfaces:**
- Consumes: existing rules helpers. Produces: both fields server-only for non-admin clients (admins keep the documented `isAdmin()` update bypass, consistent with all system fields).

- [ ] **Step 1: Edit both lists** (two single-line insertions per list — four lines total).

- [ ] **Step 2: Verify rules compile**

```bash
/Users/liongchenglex/.npm-global/bin/firebase deploy --only firestore:rules --dry-run 2>&1 | tail -5
```
Expected: `compiled successfully` / dry-run complete. Do NOT actually deploy.

- [ ] **Step 3: Commit**

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add firestore.rules
git diff --staged
git commit -m "feat(rules): needsAttention + sweepNudges are server-only job fields

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:firestore.rules | grep -c "needsAttention"
```

---

## Owner ops (user-run, after merge/deploy)

1. **Meta/Twilio template `prompt_nudge`** (Utility, en): body `⏰ Reminder (Job #{{2}}) — we're still waiting for your reply: {{1}}. Please reply when you can.` Samples: `{{1}}` = `Approve the proposed time: Tuesday 15 July at 2:00 PM?`, `{{2}}` = `AB12CD` → set Content SID as `TWILIO_TEMPLATE_PROMPT_NUDGE`. Freeform fallback covers sandbox until approval.
2. Deploy functions + rules + **indexes** together: `firebase deploy --only functions,firestore:rules,firestore:indexes` (global binary). The two new composite indexes must finish building before the first sweep run.
3. The link-renewal nudge reuses `TWILIO_TEMPLATE_SCHEDULE_LINK` (prod template from stage 3b).

## E2E checklist (user-run) — "manufacture a stuck state, run the sweep twice"

Trigger the sweep manually between edits: `firebase functions:shell` → `stuckStateSweep()` (or temporarily invoke via the Cloud Console "Test" tab). For each state: hand-edit timestamps in Firestore, run once → assert exactly ONE nudge + marker; run again → assert escalation, digest email row, red queue row.

1. **Prompt expiry:** set an open `schedule_approval` prompt's `expiresAt` into the past → run → customer gets the reminder, prompt gains `nudgedAt`, `expiresAt` moved +24h → set past again → run → prompt `expired`, job flagged `prompt_expired`, digest email.
2. **Inert poll fix:** let the nightly poll fire on an overdue scheduled job (status stays `in_progress`) → reply YES → job now moves to `pending_admin_approval` (this was a no-op before).
3. **Link ignored:** expire an active link → run → link `expired`, customer gets ONE fresh link (`createdBy: 'system_nudge'`) → expire that one → run → `link_ignored` flag, NO third link.
4. **ASAP gap:** ASAP job accepted, then decline the proposal and let the auto-link expire; backdate `acceptedAt` >24h → run → handyman nudged, `sweepNudges.asap_no_time` stamped → backdate >48h → run → `asap_no_time` flag.
5. **Unclaimed:** paid `pending` job, backdate `createdAt` 4d → run → fan-out re-notifies eligible handymen (round 900 markers), no duplicate on second run → backdate 8d → run → `unclaimed` flag.
6. **Queue actions:** for a flagged job — Mark resolved clears the chip; Set time applies + notifies both + closes open prompts/links; Force unassign re-releases (board shows it, removed handyman blocked from re-claim, customer notified); Refund refunds in Stripe (`paymentStatus: 'refunded'`) + job `cancelled` + chip cleared.
7. **Digest:** a run with ≥1 escalation sends exactly one email listing them; a run with none sends nothing.
8. **Escrow:** after sweeps + nudges (no refund action), every job's `paymentStatus` is unchanged.
