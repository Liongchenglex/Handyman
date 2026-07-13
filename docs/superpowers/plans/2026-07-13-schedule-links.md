# F6 Secure Schedule Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the account-less customer pick a visit time through a one-time, job-scoped `/pick-time` link — sent automatically when they decline a handyman's proposal, or manually by the admin — with the pick approved by the handyman over WhatsApp, and a hard cap on proposal ping-pong (handyman declines the pick → admin queue, no third round).

**Architecture:** A new `scheduleLinks/{tokenHash}` collection stores only SHA-256 hashes of 128-bit random tokens (72h expiry, single-use, revoked on supersede). Two public rate-limited Cloud Function endpoints serve the link page (context + submit); the pick opens a roles-flipped `schedule_pick_approval` prompt on the existing F2 rail, and approval flows through the existing F4 `applyScheduleChange` single writer. An admin-authed endpoint + AdminDashboard Active-jobs table cover the customer-asked-first path.

**Tech Stack:** Firebase Cloud Functions (Node, CommonJS), Firestore, Twilio WhatsApp, CRA React 18 + Tailwind, jest (functions dir only).

**Spec:** `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` §3 F6, Scenario 3 (Trigger B + pick→approval), Scenario 4 (decline flow + admin doors).

## Global Constraints

- **Anti-iCloud protocol (MANDATORY, every commit):** stage ONLY the named files (`git add <file> <file>`); read `git diff --staged` hunk-by-hunk before committing; after committing, re-grep one distinctive string from each changed file out of `git show HEAD:<path>` to prove the committed content is what you wrote. NEVER `git add -A`/`git add .`.
- **Never stage** user's unrelated files: `.env.local.example`, `src/components/handyman/status-views/SuspendedStatusView.jsx`, deleted `src/services/stripe/*.mjs`, `"package-lock 2.json"`, `"src/components/handyman/JobBoard 2.jsx"`, `"Testing and Validation Guide (1).docx"`, `WHATSAPP_TEMPLATES.md`, `copy_change.md`, untracked docs.
- **NEVER run bare `npm install`** (recovery if it happens: `git checkout -- package-lock.json && npm ci`).
- Frontend tests cannot run (CRA jest v27 dead on Node 22). Verify frontend with `CI=true npx react-scripts build` from the repo root. Functions tests DO run: `cd functions && npx jest`.
- No `timeout` command on macOS. `npx firebase` hangs — if the Firebase CLI is ever needed use `/Users/liongchenglex/.npm-global/bin/firebase`.
- Token: 16 random bytes, base64url. Store ONLY `sha256(token)` hex as the doc ID. TTL **72h**. Single-use. One active link per job.
- Date validation everywhere reuses `validateScheduleProposal` (strict `YYYY-MM-DD`, min today UTC, max **+90 days**, time ≤ 20 chars).
- The customer's pick NEVER applies directly — always via `schedule_pick_approval` → existing `applyScheduleChange` (history `via: 'customer_link'`). No money fields are ever touched.
- Handyman declines the pick → job flagged for admin **immediately**; no further automated proposal rounds.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `scheduleLinkService.js` — token + link-doc domain module

**Files:**
- Create: `functions/scheduleLinkService.js`
- Test: `functions/__tests__/scheduleLinkService.test.js`

**Interfaces:**
- Consumes: nothing (only Node `crypto`).
- Produces (used by Tasks 2–3):
  - `generateLinkToken() -> { token: string, tokenHash: string }` (token base64url, 22 chars; tokenHash sha256 hex, 64 chars)
  - `hashLinkToken(token: string) -> string` (sha256 hex; trims input)
  - `buildScheduleLinkDoc({ jobId, customerPhone, createdBy, nowMs }) -> object` (fields for `scheduleLinks/{tokenHash}`)
  - `issueScheduleLink({ db, jobId, customerPhone, createdBy, nowMs? }) -> Promise<{ token, tokenHash, revoked: number }>`
  - `revokeActiveLinks({ db, jobId, nowMs? }) -> Promise<number>`
  - `LINK_TTL_HOURS = 72`

- [ ] **Step 1: Write the failing test**

Create `functions/__tests__/scheduleLinkService.test.js`:

```js
const {
  generateLinkToken,
  hashLinkToken,
  buildScheduleLinkDoc,
  LINK_TTL_HOURS,
} = require('../scheduleLinkService');

// Fixed clock: 2026-07-13T04:00:00Z
const NOW_MS = Date.UTC(2026, 6, 13, 4, 0, 0);

describe('generateLinkToken', () => {
  test('produces a url-safe token and its sha256 hash', () => {
    const { token, tokenHash } = generateLinkToken();
    // 16 bytes base64url = 22 chars, no padding, no +/= characters
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLinkToken(token)).toBe(tokenHash);
  });

  test('two calls never collide', () => {
    const a = generateLinkToken();
    const b = generateLinkToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('hashLinkToken', () => {
  test('is deterministic and trims whitespace', () => {
    expect(hashLinkToken(' abc ')).toBe(hashLinkToken('abc'));
    expect(hashLinkToken('abc')).toMatch(/^[a-f0-9]{64}$/);
  });

  test('handles null/empty without throwing', () => {
    expect(hashLinkToken('')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLinkToken(null)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('buildScheduleLinkDoc', () => {
  test('builds an active pick_time doc with a 72h expiry', () => {
    const doc = buildScheduleLinkDoc({
      jobId: 'job_1',
      customerPhone: '+6591234567',
      createdBy: 'system_decline',
      nowMs: NOW_MS,
    });
    expect(doc).toEqual({
      jobId: 'job_1',
      customerPhone: '+6591234567',
      purpose: 'pick_time',
      status: 'active',
      createdAt: '2026-07-13T04:00:00.000Z',
      expiresAt: '2026-07-16T04:00:00.000Z', // exactly +72h
      createdBy: 'system_decline',
      usedAt: null,
    });
    expect(LINK_TTL_HOURS).toBe(72);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions && npx jest __tests__/scheduleLinkService.test.js`
Expected: FAIL — `Cannot find module '../scheduleLinkService'`

- [ ] **Step 3: Write the implementation**

Create `functions/scheduleLinkService.js`:

```js
/**
 * Secure schedule links (job lifecycle spec §3 F6).
 *
 * Customers have no accounts, so a one-time job-scoped URL is how they
 * pick a visit time. The URL's token is the credential; this module's
 * invariants assume URLs leak:
 *  - Firestore stores ONLY sha256(token) (as the doc id) — a DB read
 *    leak yields no usable links.
 *  - One active link per job: issuing revokes prior actives, and F4's
 *    applyScheduleChange call sites revoke on any settled change, so a
 *    stale link can never resurrect a settled schedule.
 *  - 72h expiry, single-use (consumption happens transactionally in
 *    the submitSchedulePick endpoint, not here).
 *
 * Same DI style as jobReassignment.js / scheduleService.js: pure
 * builders are unit-tested; db functions take the Firestore handle.
 */

const crypto = require('crypto');

/** Links expire this many hours after issuance. */
const LINK_TTL_HOURS = 72;

/** sha256 hex of a token string. Null-safe: hashing '' is fine (never matches). */
function hashLinkToken(token) {
  return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}

/**
 * 128-bit crypto-random token + its hash. The raw token goes into the
 * WhatsApp URL and is NEVER persisted; the hash is the Firestore doc id.
 */
function generateLinkToken() {
  const token = crypto.randomBytes(16).toString('base64url');
  return { token, tokenHash: hashLinkToken(token) };
}

/** Fields for a fresh scheduleLinks/{tokenHash} doc. */
function buildScheduleLinkDoc({ jobId, customerPhone, createdBy, nowMs }) {
  return {
    jobId,
    customerPhone: String(customerPhone),
    purpose: 'pick_time',
    status: 'active',
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + LINK_TTL_HOURS * 3600 * 1000).toISOString(),
    createdBy,
    usedAt: null,
  };
}

/**
 * Revoke every active link for a job. Called before issuing a new link
 * and whenever a schedule change settles (approved pick or proposal).
 * Equality-only query — no composite index needed.
 */
async function revokeActiveLinks({ db, jobId, nowMs = Date.now() }) {
  const snap = await db.collection('scheduleLinks')
    .where('jobId', '==', jobId)
    .where('status', '==', 'active')
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.update({
    status: 'revoked',
    revokedAt: new Date(nowMs).toISOString(),
  })));
  return snap.docs.length;
}

/**
 * Issue a fresh link for a job, revoking prior actives first so at most
 * one link is live per job. Returns the RAW token for the URL — the
 * caller must send it and forget it.
 */
async function issueScheduleLink({ db, jobId, customerPhone, createdBy, nowMs = Date.now() }) {
  const revoked = await revokeActiveLinks({ db, jobId, nowMs });
  const { token, tokenHash } = generateLinkToken();
  await db.collection('scheduleLinks').doc(tokenHash).set(
    buildScheduleLinkDoc({ jobId, customerPhone, createdBy, nowMs })
  );
  return { token, tokenHash, revoked };
}

module.exports = {
  LINK_TTL_HOURS,
  hashLinkToken,
  generateLinkToken,
  buildScheduleLinkDoc,
  revokeActiveLinks,
  issueScheduleLink,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions && npx jest`
Expected: ALL suites PASS (46 existing tests + the new ones).

- [ ] **Step 5: Commit (anti-iCloud protocol)**

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/scheduleLinkService.js functions/__tests__/scheduleLinkService.test.js
git diff --staged   # read every hunk
git commit -m "feat(schedule-links): F6 token + link-doc domain module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/scheduleLinkService.js | grep -c "base64url"   # expect ≥1
```

---

### Task 2: public endpoints — `getScheduleLinkContext` + `submitSchedulePick`

**Files:**
- Modify: `functions/index.js` (add requires near the existing `scheduleService` require ~line 60s; add both endpoints directly AFTER the `proposeSchedule` endpoint, ~line 3965)

**Interfaces:**
- Consumes: Task 1's `hashLinkToken`, `issueScheduleLink` (not here — Task 3), `revokeActiveLinks`; existing `validateScheduleProposal`, `ScheduleError`, `openPrompt`, `SCHEDULE_APPROVAL_OPTIONS`, `sendTwilioMessage`, `sendAdminEmail(subject, html)`, `escapeHtml`, `formatPhoneToWhatsApp`, `checkRateLimit`, `cors`.
- Produces:
  - HTTP `POST getScheduleLinkContext` body `{ token }` → `{ success, job: { shortId, serviceType, preferredDate, preferredTime, preferredTiming, handymanName } }` or `4xx { error, code? }`
  - HTTP `POST submitSchedulePick` body `{ token, date, time, note? }` → `{ success: true }` or `4xx { error, code? }`
  - New prompt type **`schedule_pick_approval`** with payload `{ pickedDate, pickedTime, pickedBy, note, linkTokenHash }` (Task 4 dispatches it).

- [ ] **Step 1: Add the require**

Next to the existing scheduleService require in `functions/index.js` (search `require('./scheduleService')`):

```js
const {
  hashLinkToken,
  issueScheduleLink,
  revokeActiveLinks,
} = require('./scheduleLinkService');
```

- [ ] **Step 2: Add a shared link-lookup helper + IP key helper**

Place directly above the new endpoints:

```js
/**
 * Rate-limit key for unauthenticated link endpoints. Behind Google's
 * front end X-Forwarded-For's first hop is the client.
 */
function linkRequestIpKey(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (xff || req.ip || 'unknown').replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45) || 'unknown';
}

/**
 * Resolve a raw link token to a live link + its job, mapping every
 * failure to a precise HTTP status. Lazily marks overdue links expired.
 *
 * @returns {{ ok: true, linkRef, link, jobRef, job }
 *         | { ok: false, status: number, error: string, code: string }}
 */
async function resolveScheduleLink(db, token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, status: 400, error: 'Missing link token', code: 'bad_token' };
  }
  const linkRef = db.collection('scheduleLinks').doc(hashLinkToken(token));
  const linkSnap = await linkRef.get();
  if (!linkSnap.exists) {
    return { ok: false, status: 404, error: 'This link is not valid', code: 'not_found' };
  }
  const link = linkSnap.data();
  if (link.status !== 'active') {
    return { ok: false, status: 410, error: 'This link has already been used or replaced', code: `link_${link.status}` };
  }
  if (new Date(link.expiresAt).getTime() < Date.now()) {
    try {
      await linkRef.update({ status: 'expired' });
    } catch (expireErr) {
      console.error('⚠️ Lazy link-expiry write failed (continuing):', expireErr);
    }
    return { ok: false, status: 410, error: 'This link has expired', code: 'link_expired' };
  }
  const jobRef = db.collection('jobs').doc(link.jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists || jobSnap.data().status !== 'in_progress') {
    return { ok: false, status: 409, error: 'This job can no longer be rescheduled', code: 'job_not_active' };
  }
  return { ok: true, linkRef, link, jobRef, job: jobSnap.data() };
}
```

- [ ] **Step 3: Add `getScheduleLinkContext`**

```js
/**
 * getScheduleLinkContext — public, token-gated (F6).
 *
 * The /pick-time page calls this on load. The token is the ONLY
 * credential; the response is deliberately minimal (no customer PII —
 * the customer already knows who they are; no handyman phone).
 *
 * POST body: { token }
 */
exports.getScheduleLinkContext = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const rl = await checkRateLimit(`schedule_link_ctx_${linkRequestIpKey(req)}`, 30, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many requests — please try again later' });
      }

      const resolved = await resolveScheduleLink(admin.firestore(), (req.body || {}).token);
      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
      }

      const { link, job } = resolved;
      return res.status(200).json({
        success: true,
        job: {
          shortId: String(link.jobId).slice(-6),
          serviceType: job.serviceType || 'job',
          preferredDate: job.preferredDate || null,
          preferredTime: job.preferredTime || null,
          preferredTiming: job.preferredTiming || null,
          handymanName: (job.acceptedBy && job.acceptedBy.name) || 'Your handyman',
        },
      });
    } catch (error) {
      console.error('❌ Error in getScheduleLinkContext:', error);
      return res.status(500).json({ error: 'Something went wrong — please try again' });
    }
  });
});
```

- [ ] **Step 4: Add `submitSchedulePick`**

```js
/**
 * submitSchedulePick — public, token-gated (F6).
 *
 * Consumes the link (single-use, transactional) and opens the
 * roles-flipped schedule_pick_approval prompt to the handyman. The
 * schedule itself changes ONLY when the handyman approves (F4).
 * Once the link is consumed the customer's part is DONE — failures
 * after that point (no handyman phone, Twilio down, prompt write
 * failure) fall back to the F3 admin email and still return success,
 * because the admin queue is the designed recovery door.
 *
 * POST body: { token, date, time, note? }
 */
exports.submitSchedulePick = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const rl = await checkRateLimit(`schedule_link_pick_${linkRequestIpKey(req)}`, 10, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many requests — please try again later' });
      }

      const { token, date, time, note } = req.body || {};
      try {
        validateScheduleProposal({ date, time });
      } catch (err) {
        if (err instanceof ScheduleError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }

      const db = admin.firestore();
      const resolved = await resolveScheduleLink(db, token);
      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
      }
      const { linkRef, link } = resolved;
      const jobId = link.jobId;
      const trimmedNote = String(note || '').trim().slice(0, 300);

      // Consume the link transactionally: re-check active + job status so
      // two racing submits (or a submit racing a scheduleChange) can't
      // both go through.
      let job;
      try {
        await db.runTransaction(async (tx) => {
          const lSnap = await tx.get(linkRef);
          if (!lSnap.exists || lSnap.data().status !== 'active') {
            throw new Error('LINK_GONE');
          }
          const jSnap = await tx.get(db.collection('jobs').doc(jobId));
          if (!jSnap.exists || jSnap.data().status !== 'in_progress') {
            throw new Error('WRONG_STATUS');
          }
          job = jSnap.data();
          tx.update(linkRef, {
            status: 'used',
            usedAt: new Date().toISOString(),
            pickedDate: date,
            pickedTime: String(time),
          });
        });
      } catch (txErr) {
        if (txErr.message === 'LINK_GONE') {
          return res.status(410).json({ error: 'This link has already been used or replaced', code: 'link_used' });
        }
        if (txErr.message === 'WRONG_STATUS') {
          return res.status(409).json({ error: 'This job can no longer be rescheduled', code: 'job_not_active' });
        }
        throw txErr;
      }

      // The customer's counter-pick supersedes any open handyman
      // proposal — they have effectively declined it by picking.
      try {
        const openApprovals = await db.collection('jobs').doc(jobId).collection('prompts')
          .where('type', '==', 'schedule_approval')
          .where('status', '==', 'open')
          .get();
        await Promise.all(openApprovals.docs.map((d) => d.ref.update({
          status: 'superseded',
          supersededAt: new Date().toISOString(),
        })));
      } catch (supersedeErr) {
        console.error('⚠️ Superseding open schedule_approval prompts failed (continuing):', supersedeErr);
      }

      const jobShortId = String(jobId).slice(-6);
      const displayDate = new Date(date).toLocaleDateString('en-SG', {
        weekday: 'long', day: 'numeric', month: 'long',
      });

      // Roles-flipped approval: WhatsApp the handyman, then open the
      // prompt (same send-then-open order as proposeSchedule).
      let handedToHandyman = false;
      try {
        const hmSnap = await db.collection('handymen').doc(job.handymanId).get();
        const hmPhone = hmSnap.exists ? hmSnap.data().phone : null;
        if (hmPhone) {
          await sendTwilioMessage(
            formatPhoneToWhatsApp(hmPhone),
            `📅 The customer picked a visit time for Job #${jobShortId}: *${displayDate}* at *${time}*.${trimmedNote ? `\n\nNote: ${trimmedNote}` : ''}\n\n👉 Reply *YES* to approve\n👉 Reply *NO* if you can't make it (our team will step in)`
          );
          await openPrompt({
            db,
            jobId,
            type: 'schedule_pick_approval',
            toPhone: hmPhone,
            toRole: 'handyman',
            question: `Approve the customer's picked time: ${displayDate} at ${time}?`,
            options: SCHEDULE_APPROVAL_OPTIONS,
            payload: {
              pickedDate: date,
              pickedTime: String(time),
              pickedBy: normalizePhoneKey(link.customerPhone),
              note: trimmedNote || null,
              linkTokenHash: hashLinkToken(token),
            },
          });
          handedToHandyman = true;
        }
      } catch (handymanErr) {
        console.error('⚠️ Handing pick to handyman failed (admin fallback):', handymanErr);
      }

      if (!handedToHandyman) {
        // F3 door: the pick is recorded on the used link; the admin
        // finishes the job (set time admin-as-actor after a call).
        await sendAdminEmail(
          `⚠️ Schedule pick needs manual handling — Job #${jobShortId}`,
          `<p>The customer picked <strong>${escapeHtml(displayDate)} at ${escapeHtml(String(time))}</strong> via a schedule link, but the handyman could not be reached on WhatsApp (no phone on record or send failure).</p>
           <p>Job: ${escapeHtml(jobId)}<br/>Note: ${escapeHtml(trimmedNote || '—')}</p>
           <p>Please confirm with both parties and set the time from the admin dashboard.</p>`
        );
      }

      console.log(`📅 Schedule pick for job ${jobId}: ${date} ${time} (handedToHandyman=${handedToHandyman})`);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Error in submitSchedulePick:', error);
      return res.status(500).json({ error: 'Something went wrong — please try again' });
    }
  });
});
```

- [ ] **Step 5: Verify + commit**

Run: `cd functions && npx jest` (all pass) and `node -e "require('/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/index.js')" 2>&1 | head -3` is NOT a reliable load check (needs env) — instead run `node --check /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/index.js` for syntax.
Expected: `node --check` exits 0.

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/index.js
git diff --staged   # read every hunk — ONLY the two endpoints + helpers + require
git commit -m "feat(schedule-links): public link-context and submit-pick endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/index.js | grep -c "submitSchedulePick"   # expect ≥2
```

---

### Task 3: `sendScheduleLink` admin endpoint + decline→link auto-send

**Files:**
- Modify: `functions/index.js` — (a) new endpoint after `submitSchedulePick`; (b) rewrite the decline branch of the `schedule_approval` dispatch (search `Decline: schedule unchanged; handyman must re-propose`, ~line 2854); (c) revoke links when a schedule change settles (in the `schedule_approval` approve branch, after `applyScheduleChange` returns `applied`).

**Interfaces:**
- Consumes: Task 1's `issueScheduleLink`, `revokeActiveLinks`; existing `verifyAuthToken`, `verifyAdminAccess`, `sendTwilioTemplateMessage`, `sendTwilioMessage`, `writeAuditLog`, `APP_URL`.
- Produces: HTTP `POST sendScheduleLink` body `{ jobId }` (admin Bearer) → `{ success: true }`; env var **`TWILIO_TEMPLATE_SCHEDULE_LINK`** (freeform fallback until approved, existing pattern).

- [ ] **Step 1: Add the admin endpoint**

```js
/**
 * sendScheduleLink — admin-only (F6, Scenario 3 Trigger B).
 *
 * The customer asked for a schedule change in free text (F3 inbox);
 * the admin sends them a pick-time link from the Active-jobs table.
 * Business-initiated → template with freeform fallback.
 *
 * POST body: { jobId }
 */
exports.sendScheduleLink = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      const decodedToken = await verifyAuthToken(req);
      verifyAdminAccess(decodedToken);

      const rl = await checkRateLimit(`schedule_link_send_${decodedToken.uid}`, 20, 3600);
      if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many link sends — please slow down', retryAfterSeconds: rl.retryAfterSeconds });
      }

      const { jobId } = req.body || {};
      if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId' });
      }
      const jobSnap = await admin.firestore().collection('jobs').doc(jobId).get();
      if (!jobSnap.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      const job = jobSnap.data();
      if (job.status !== 'in_progress') {
        return res.status(409).json({ error: `This job can no longer be rescheduled (status: ${job.status})` });
      }
      if (!job.customerPhone) {
        return res.status(400).json({ error: 'Job has no customer phone on record' });
      }

      const { token } = await issueScheduleLink({
        db: admin.firestore(),
        jobId,
        customerPhone: job.customerPhone,
        createdBy: decodedToken.uid,
      });
      const jobShortId = String(jobId).slice(-6);
      const linkUrl = `${APP_URL}/pick-time?t=${token}`;

      const sendResult = await sendTwilioTemplateMessage(
        formatPhoneToWhatsApp(job.customerPhone),
        process.env.TWILIO_TEMPLATE_SCHEDULE_LINK,
        { '1': jobShortId, '2': linkUrl },
        `📅 Need a different visit time for your ${job.serviceType || 'job'} (Job #${jobShortId})?\n\nPick a time that works for you here (valid 72 hours):\n${linkUrl}`
      );
      if (!sendResult.success) {
        return res.status(502).json({ error: 'Could not reach the customer on WhatsApp — please try again' });
      }

      await writeAuditLog('schedule_link_sent', decodedToken, { jobId });
      console.log(`🔗 Schedule link sent for job ${jobId} by admin ${decodedToken.uid}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Error in sendScheduleLink:', error);
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to send schedule link' });
    }
  });
});
```

- [ ] **Step 2: Rewrite the `schedule_approval` DECLINE branch (decline→link auto-send)**

Current code (in the webhook, after the decline `markAnswered`) sends "your handyman will propose another time". Replace the customer message + handyman notice with:

```js
          // Decline → the customer picks their own time (F6). The reply
          // rides the free 24h session window (they just messaged us),
          // so a freeform message with the link needs no template.
          // Failure to issue/send falls back to the old copy — the
          // Scenario 12 sweep still catches the stall.
          let declineLinkSent = false;
          try {
            const { token } = await issueScheduleLink({
              db: admin.firestore(),
              jobId: verdict.prompt.jobId,
              customerPhone: verdict.prompt.toPhone,
              createdBy: 'system_decline',
            });
            await sendTwilioMessage(
              From,
              `👍 No problem — pick a time that works for you here (valid 72 hours):\n${APP_URL}/pick-time?t=${token}\n\nYour handyman will confirm the time you choose (Job #${jobShortId}).`
            );
            declineLinkSent = true;
          } catch (linkErr) {
            console.error('⚠️ Decline→link auto-send failed (falling back to old copy):', linkErr);
          }
          if (!declineLinkSent) {
            await sendTwilioMessage(
              From,
              proposal.isFirstTime
                ? `👍 No problem — your handyman will propose another time for Job #${jobShortId}.`
                : `👍 No problem — the original time for Job #${jobShortId} stays. Your handyman may propose another option.`
            );
          }
```

And change the handyman decline notice copy (same branch, the existing `try { ... hmPhone ... }` block) to:

```js
                await sendTwilioMessage(
                  formatPhoneToWhatsApp(hmPhone),
                  declineLinkSent
                    ? `ℹ️ The customer declined your proposed time for Job #${jobShortId}. They've been sent a link to pick a time — you'll be asked to approve their pick.`
                    : `ℹ️ The customer declined your proposed time for Job #${jobShortId}. Please propose another time from the job page.`
                );
```

- [ ] **Step 3: Revoke links when a proposal is APPROVED**

In the `schedule_approval` approve branch, right after `changeResult.outcome === 'applied'` is established (i.e. after the `wrong_status` early return), add:

```js
            // A settled schedule kills any outstanding pick link (F6:
            // a stale link must never resurrect a settled schedule).
            try {
              await revokeActiveLinks({ db: admin.firestore(), jobId: verdict.prompt.jobId });
            } catch (revokeErr) {
              console.error('⚠️ Link revocation after schedule approval failed (continuing):', revokeErr);
            }
```

- [ ] **Step 4: Verify + commit**

Run: `node --check functions/index.js` (exit 0) and `cd functions && npx jest` (all pass).

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/index.js
git diff --staged   # hunks: sendScheduleLink endpoint, decline branch, revoke-on-approve
git commit -m "feat(schedule-links): admin send-link endpoint + decline auto-sends pick link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/index.js | grep -c "sendScheduleLink"   # expect ≥2
```

---

### Task 4: webhook dispatch for `schedule_pick_approval`

**Files:**
- Modify: `functions/index.js` — add a dispatch branch in the webhook immediately after the `schedule_approval` branch ends (search `action: 'schedule_declined', via: 'prompt'` — insert after that `}` closing the `schedule_approval` type block, before the "Unknown prompt type" fallback).

**Interfaces:**
- Consumes: Task 2's prompt payload `{ pickedDate, pickedTime, pickedBy, note, linkTokenHash }`; existing `applyScheduleChange`, `markAnswered`, `forwardUnmatchedInbound`, `sendTwilioMessage`, `sendAdminEmail`, `escapeHtml`, `revokeActiveLinks`.
- Produces: on approve — schedule applied with `via: 'customer_link'`; on decline — job flagged `attentionNeeded: { type: 'schedule_deadlock', at, promptId }` (server-only field; Task 7 adds it to the rules deny-list) + admin email + both parties notified.

- [ ] **Step 1: Add the dispatch branch**

The sender here is the HANDYMAN (the prompt's `toRole` is 'handyman'); `From` is the handyman's WhatsApp. Mirror the `schedule_approval` branch's defensive structure exactly:

```js
        if (verdict.prompt.type === 'schedule_pick_approval') {
          const pick = verdict.prompt.payload || {};
          const jobShortId = String(verdict.prompt.jobId).slice(-6);

          // Same invalid-payload guard as schedule_approval: never let a
          // legacy/malformed prompt 500 the webhook into a Twilio retry
          // loop with a stranded open prompt.
          if (!pick.pickedDate || !pick.pickedTime) {
            console.error(`⚠️ schedule_pick_approval prompt ${verdict.prompt.id} has no usable payload — closing and forwarding`);
            try {
              await markAnswered(verdict.prompt.ref, {
                answer: verdict.answerText,
                resultingAction: 'invalid_payload',
              });
            } catch (markErr) {
              console.error('⚠️ markAnswered failed (continuing):', markErr);
            }
            await forwardUnmatchedInbound({ from: From, body: Body, mediaUrls, reason: 'unmatched_reply' });
            return res.status(200).json({ received: true, processed: false, reason: 'Pick prompt without payload — forwarded to admin' });
          }

          const displayDate = new Date(pick.pickedDate).toLocaleDateString('en-SG', {
            weekday: 'long', day: 'numeric', month: 'long',
          });

          if (verdict.action === 'approve') {
            const changeResult = await applyScheduleChange({
              db: admin.firestore(),
              jobId: verdict.prompt.jobId,
              newDate: pick.pickedDate,
              newTime: pick.pickedTime,
              actor: pick.pickedBy || 'customer',
              via: 'customer_link',
              note: pick.note,
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
              return res.status(200).json({ received: true, processed: false, reason: 'Pick approval on non-in_progress job' });
            }

            try {
              await revokeActiveLinks({ db: admin.firestore(), jobId: verdict.prompt.jobId });
            } catch (revokeErr) {
              console.error('⚠️ Link revocation after pick approval failed (continuing):', revokeErr);
            }

            await sendTwilioMessage(
              From,
              `✅ Confirmed: Job #${jobShortId} is set for *${displayDate}* at *${pick.pickedTime}*. See you then! 🔧`
            );

            // Tell the customer their picked time is locked in.
            try {
              const job = changeResult.job;
              if (job && job.customerPhone) {
                await sendTwilioMessage(
                  formatPhoneToWhatsApp(job.customerPhone),
                  `✅ Confirmed! Your visit for Job #${jobShortId} is set for *${displayDate}* at *${pick.pickedTime}* — the time you picked. See you then! 🔧`
                );
              }
            } catch (notifyErr) {
              console.error('⚠️ Customer pick-confirmation notice failed:', notifyErr);
            }

            return res.status(200).json({ received: true, processed: true, action: 'schedule_pick_applied', via: 'prompt' });
          }

          // Decline → schedule deadlock: the ping-pong cap. Straight to
          // the admin queue, no third automated round (spec Scenario 4).
          try {
            await markAnswered(verdict.prompt.ref, {
              answer: verdict.answerText,
              resultingAction: 'declined_deadlock',
            });
          } catch (markErr) {
            console.error('⚠️ markAnswered failed (continuing):', markErr);
          }

          try {
            await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).update({
              attentionNeeded: {
                type: 'schedule_deadlock',
                at: new Date().toISOString(),
                promptId: verdict.prompt.id,
              },
            });
          } catch (flagErr) {
            console.error('⚠️ attentionNeeded flag write failed (continuing):', flagErr);
          }

          await sendAdminEmail(
            `🔴 Schedule deadlock — Job #${jobShortId}`,
            `<p>The handyman declined the customer's picked time (<strong>${escapeHtml(displayDate)} at ${escapeHtml(String(pick.pickedTime))}</strong>).</p>
             <p>Job: ${escapeHtml(String(verdict.prompt.jobId))}</p>
             <p>Per the lifecycle spec this is the ping-pong cap — please call both parties and set the time from the admin dashboard (or force-unassign / offer a refund).</p>`
          );

          await sendTwilioMessage(
            From,
            `ℹ️ Noted — you declined the customer's picked time for Job #${jobShortId}. Our team will step in to arrange the schedule with both of you.`
          );

          try {
            const jobSnap = await admin.firestore().collection('jobs').doc(verdict.prompt.jobId).get();
            const custPhone = jobSnap.exists ? jobSnap.data().customerPhone : null;
            if (custPhone) {
              await sendTwilioMessage(
                formatPhoneToWhatsApp(custPhone),
                `ℹ️ Your handyman couldn't make the time you picked for Job #${jobShortId}. We're arranging it — you'll hear from us shortly.`
              );
            }
          } catch (notifyErr) {
            console.error('⚠️ Customer deadlock notice failed:', notifyErr);
          }

          return res.status(200).json({ received: true, processed: true, action: 'schedule_deadlock', via: 'prompt' });
        }
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/index.js` (exit 0) and `cd functions && npx jest` (all pass).

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add functions/index.js
git diff --staged   # single insertion: the schedule_pick_approval branch
git commit -m "feat(schedule-links): webhook dispatch for schedule_pick_approval (approve applies, decline deadlocks to admin)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:functions/index.js | grep -c "schedule_pick_approval"   # expect ≥4
```

---

### Task 5: `/pick-time` public page + frontend link service

**Files:**
- Create: `src/services/api/scheduleLink.js`
- Create: `src/pages/PickTime.jsx`
- Modify: `src/App.jsx` (add lazy import next to the other page imports; add `<Route path="/pick-time" element={<PickTime />} />` next to the `/request-job` route, line ~58)

**Interfaces:**
- Consumes: Task 2's endpoints; `getProposalDateBounds` from `src/services/api/jobSchedule.js`; `projectConfig.functionsBaseUrl` from `src/config/firebaseProject`.
- Produces: `getScheduleLinkContext(token)`, `submitSchedulePick(token, date, time, note)` (both unauthenticated, never throw — `{ success, ... }` shape), `sendScheduleLink(jobId)` (admin Bearer, for Task 6).

- [ ] **Step 1: Create `src/services/api/scheduleLink.js`**

```js
/**
 * Schedule-link service (lifecycle spec §3 F6).
 *
 * The /pick-time page is the only truly public page in the app: the
 * customer has no account, so the link token in the URL is the whole
 * credential and every call here is validated server-side. No Firebase
 * auth is attached to the two token-gated calls; sendScheduleLink is
 * the admin-only counterpart used by the Active-jobs table.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/**
 * Load the minimal job context for a pick-time link.
 * @returns {Promise<{success: boolean, job?: object, error?: string, code?: string}>}
 */
export const getScheduleLinkContext = async (token) => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getScheduleLinkContext`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'This link could not be opened.', code: result.code };
    }
    return { success: true, job: result.job };
  } catch (error) {
    console.error('❌ Error loading schedule link:', error);
    return { success: false, error: 'Could not load this link. Please check your connection and try again.' };
  }
};

/**
 * Submit the customer's picked visit time.
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
export const submitSchedulePick = async (token, date, time, note = '') => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/submitSchedulePick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, date, time, note }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Could not submit your pick. Please try again.', code: result.code };
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Error submitting schedule pick:', error);
    return { success: false, error: 'Could not submit your pick. Please check your connection and try again.' };
  }
};

/**
 * Admin: send the customer a fresh pick-time link for a job.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendScheduleLink = async (jobId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/sendScheduleLink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Could not send the link. Please try again.' };
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending schedule link:', error);
    return { success: false, error: 'Could not send the link. Please check your connection and try again.' };
  }
};
```

- [ ] **Step 2: Create `src/pages/PickTime.jsx`**

```jsx
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getScheduleLinkContext, submitSchedulePick } from '../services/api/scheduleLink';
import { getProposalDateBounds } from '../services/api/jobSchedule';

/**
 * PickTime — the public F6 deep-link page (lifecycle spec Scenario 3).
 *
 * Reached ONLY via a one-time token in the URL (?t=...). No login: the
 * customer has no account, and the server validates the token on every
 * call. The pick does not change the schedule — it goes to the handyman
 * for approval, and the page says so.
 */
const PickTime = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';

  // phase: loading | ready | submitting | done | error
  const [phase, setPhase] = useState('loading');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const submittingRef = useRef(false);

  const dateBounds = getProposalDateBounds();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!token) {
        setError('This link is missing its code. Please use the exact link from your WhatsApp message.');
        setPhase('error');
        return;
      }
      const result = await getScheduleLinkContext(token);
      if (cancelled) return;
      if (result.success) {
        setJob(result.job);
        setPhase('ready');
      } else {
        setError(result.error);
        setPhase('error');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  const canSubmit = date && time.trim();

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setPhase('submitting');
    const result = await submitSchedulePick(token, date, time.trim(), note.trim());
    if (result.success) {
      setPhase('done');
    } else {
      setError(result.error);
      // Used/expired links can't be retried; validation errors can.
      const terminal = ['link_used', 'link_expired', 'link_revoked', 'job_not_active', 'not_found'].includes(result.code);
      setPhase(terminal ? 'error' : 'ready');
      submittingRef.current = false;
    }
  };

  const shell = (children) => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        {children}
      </div>
    </div>
  );

  if (phase === 'loading') {
    return shell(<div className="flex justify-center py-10"><LoadingSpinner /></div>);
  }

  if (phase === 'error') {
    return shell(
      <div className="text-center">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400">link_off</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">This link can't be used</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Need help? Reply to us on WhatsApp or email{' '}
          <a className="underline" href="mailto:easydonehandyman@gmail.com">easydonehandyman@gmail.com</a>.
        </p>
        <Link to="/" className="inline-block mt-6 text-sm font-medium text-primary underline">Back to EasyDone</Link>
      </div>
    );
  }

  if (phase === 'done') {
    return shell(
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-2xl text-green-600 dark:text-green-400">check_circle</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Time sent!</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {job ? `${job.handymanName} will confirm your picked time` : 'Your handyman will confirm your picked time'} — we'll
          message you on WhatsApp once it's locked in. You can close this page.
        </p>
      </div>
    );
  }

  // ready / submitting
  return shell(
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">event</span>
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Pick your visit time</h1>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        {job.serviceType} — Job #{job.shortId}.{' '}
        {job.preferredTiming === 'Schedule' && job.preferredDate
          ? `Currently scheduled: ${new Date(job.preferredDate).toLocaleDateString('en-SG')} at ${job.preferredTime || '—'}. `
          : ''}
        {job.handymanName} will confirm the time you pick before it's final.
      </p>

      <label htmlFor="pick-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Date <span className="text-red-500">*</span>
      </label>
      <input
        id="pick-date"
        type="date"
        min={dateBounds.min}
        max={dateBounds.max}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
      />

      <label htmlFor="pick-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Time <span className="text-red-500">*</span>
      </label>
      <input
        id="pick-time"
        type="text"
        maxLength={20}
        placeholder="e.g. 2:00 PM"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
      />

      <label htmlFor="pick-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Note to your handyman <span className="text-gray-400">(optional)</span>
      </label>
      <textarea
        id="pick-note"
        rows={2}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Mornings work best for me"
        className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || phase === 'submitting'}
        className="w-full bg-primary text-black font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {phase === 'submitting' ? 'Sending…' : 'Send my picked time'}
      </button>
    </>
  );
};

export default PickTime;
```

- [ ] **Step 3: Register the route in `src/App.jsx`**

Add the import alongside the other page imports (match the file's existing import style — if pages are imported eagerly, import eagerly):

```jsx
import PickTime from './pages/PickTime';
```

Add next to the `/request-job` route:

```jsx
            <Route path="/pick-time" element={<PickTime />} />
```

- [ ] **Step 4: Verify + commit**

Run: `CI=true npx react-scripts build` from the repo root.
Expected: `Compiled successfully.` (warnings acceptable if pre-existing).

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add src/services/api/scheduleLink.js src/pages/PickTime.jsx src/App.jsx
git diff --staged   # read every hunk; App.jsx must show ONLY the import + route
git commit -m "feat(schedule-links): public /pick-time page + link service

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:src/pages/PickTime.jsx | grep -c "submitSchedulePick"   # expect ≥2
```

---

### Task 6: AdminDashboard Active-jobs table + Send-reschedule-link action

**Files:**
- Create: `src/components/admin/ActiveJobsTable.jsx` (note: `src/components/admin/` may not exist yet — creating the file creates it)
- Modify: `src/pages/AdminDashboard.jsx` (render the table below the existing stats/links sections; add the import)

**Interfaces:**
- Consumes: Task 5's `sendScheduleLink(jobId)`; Firestore web SDK `collection/query/where/orderBy/limit/getDocs` from `firebase/firestore` and `db` from `../../services/firebase/config` (admin reads on `jobs` are already allowed — AdminFundRelease queries jobs the same way; the `status`+`createdAt` composite index already exists in `firestore.indexes.json`).
- Produces: nothing consumed later.

- [ ] **Step 1: Create `src/components/admin/ActiveJobsTable.jsx`**

```jsx
import React, { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import LoadingSpinner from '../common/LoadingSpinner';
import { sendScheduleLink } from '../../services/api/scheduleLink';

/**
 * ActiveJobsTable — admin view of every in_progress job (lifecycle
 * spec Scenario 3 Trigger B + Scenario 12's future attention queue).
 *
 * The admin's one action here (v1) is "Send reschedule link": when a
 * customer asks for a time change in free text (F3 inbox), the admin
 * sends them the F6 pick-time link from the matching row. Rows flagged
 * attentionNeeded (schedule deadlock) sort first and are highlighted.
 *
 * Mobile-friendly: stacked cards on small screens, table-like rows on
 * md+, matching the dashboard's Tailwind idiom.
 */
const ActiveJobsTable = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // per-job send state: { [jobId]: 'sending' | 'sent' | <error string> }
  const [sendState, setSendState] = useState({});

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const q = query(
        collection(db, 'jobs'),
        where('status', '==', 'in_progress'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Attention-flagged rows first, then newest first (query order kept).
      rows.sort((a, b) => (b.attentionNeeded ? 1 : 0) - (a.attentionNeeded ? 1 : 0));
      setJobs(rows);
    } catch (err) {
      console.error('Error loading active jobs:', err);
      setLoadError('Could not load active jobs. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleSendLink = async (job) => {
    const confirmed = window.confirm(
      `Send ${job.customerName || 'the customer'} a WhatsApp link to pick a new visit time for Job #${job.id.slice(-6)}?\n\nThis replaces any earlier link for this job.`
    );
    if (!confirmed) return;
    setSendState((s) => ({ ...s, [job.id]: 'sending' }));
    const result = await sendScheduleLink(job.id);
    setSendState((s) => ({ ...s, [job.id]: result.success ? 'sent' : (result.error || 'Failed') }));
  };

  const scheduleLabel = (job) => {
    if (job.preferredTiming === 'Schedule' && job.preferredDate) {
      return `${new Date(job.preferredDate).toLocaleDateString('en-SG')} ${job.preferredTime || ''}`.trim();
    }
    return 'ASAP — time not fixed';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active jobs</h2>
        <button
          onClick={fetchJobs}
          className="text-sm font-medium text-primary underline"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
      {!loading && loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {!loading && !loadError && jobs.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No jobs are currently in progress.</p>
      )}

      <div className="space-y-3">
        {jobs.map((job) => {
          const state = sendState[job.id];
          return (
            <div
              key={job.id}
              className={`rounded-xl border p-4 md:flex md:items-center md:justify-between md:gap-4 ${
                job.attentionNeeded
                  ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  #{job.id.slice(-6)} · {job.serviceType || 'Job'}
                  {job.attentionNeeded && (
                    <span className="ml-2 inline-block text-xs font-bold text-red-700 dark:text-red-300 uppercase">
                      Needs attention · {job.attentionNeeded.type === 'schedule_deadlock' ? 'schedule deadlock' : job.attentionNeeded.type}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  Customer: {job.customerName || '—'} ({job.customerPhone || 'no phone'}) ·
                  Handyman: {(job.acceptedBy && job.acceptedBy.name) || '—'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Schedule: {scheduleLabel(job)}
                  {Array.isArray(job.scheduleHistory) && job.scheduleHistory.length > 0 &&
                    ` · ${job.scheduleHistory.length} change${job.scheduleHistory.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="mt-3 md:mt-0 shrink-0">
                <button
                  onClick={() => handleSendLink(job)}
                  disabled={state === 'sending' || state === 'sent' || !job.customerPhone}
                  className="w-full md:w-auto bg-primary text-black text-sm font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Link sent ✓' : 'Send reschedule link'}
                </button>
                {state && state !== 'sending' && state !== 'sent' && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{state}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveJobsTable;
```

- [ ] **Step 2: Mount it in `src/pages/AdminDashboard.jsx`**

Add the import next to the other component imports:

```jsx
import ActiveJobsTable from '../components/admin/ActiveJobsTable';
```

Render it inside the admin-authenticated return, after the existing admin-links/stats sections (find the last card/grid section inside the main authenticated JSX container and add below it):

```jsx
          {/* Active jobs — Scenario 3 Trigger B: send the customer a
              pick-time link when they ask for a schedule change. */}
          <ActiveJobsTable />
```

- [ ] **Step 3: Verify + commit**

Run: `CI=true npx react-scripts build` from the repo root.
Expected: `Compiled successfully.`

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
git add src/components/admin/ActiveJobsTable.jsx src/pages/AdminDashboard.jsx
git diff --staged   # AdminDashboard hunks: import + one JSX insertion ONLY
git commit -m "feat(admin): Active-jobs table with Send-reschedule-link action

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:src/components/admin/ActiveJobsTable.jsx | grep -c "sendScheduleLink"   # expect ≥2
```

---

### Task 7: Firestore rules + docs/ops closeout

**Files:**
- Modify: `firestore.rules` — (a) new deny-all `scheduleLinks` match; (b) add `attentionNeeded` to `jobSystemFields()` and `jobCreateDeniedFields()`

**Interfaces:**
- Consumes: existing `jobSystemFields()` / `jobCreateDeniedFields()` helper functions in `firestore.rules` (added in earlier stages).
- Produces: client-inaccessible `scheduleLinks`; server-only `attentionNeeded` job field.

- [ ] **Step 1: Add the `scheduleLinks` match block**

Inside `match /databases/{database}/documents { ... }`, next to the other top-level collections (e.g. after the `inboundMessages` block):

```
    // F6 schedule links (lifecycle spec §3): the token hash in the doc
    // id IS the credential — no client, not even an admin's browser,
    // may read or write these. All access goes through the
    // getScheduleLinkContext / submitSchedulePick / sendScheduleLink
    // Cloud Functions (Admin SDK bypasses rules).
    match /scheduleLinks/{tokenHash} {
      allow read, write: if false;
    }
```

- [ ] **Step 2: Make `attentionNeeded` server-only**

In `jobSystemFields()` add `'attentionNeeded'` to the list (exact placement: alongside `'scheduleHistory'`, `'scheduledFromAsapAt'`). In `jobCreateDeniedFields()` add `'attentionNeeded'` the same way. Read both functions first and match their exact formatting.

- [ ] **Step 3: Verify rules compile**

Run (uses the global binary — `npx firebase` hangs):

```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
/Users/liongchenglex/.npm-global/bin/firebase deploy --only firestore:rules --dry-run 2>&1 | tail -5
```

Expected: `compiled successfully` / dry-run success. If the dry-run flag is unsupported in this CLI version, fall back to a syntax check via the emulator: skip and rely on review — do NOT deploy.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git diff --staged   # exactly: one new match block + two list insertions
git commit -m "feat(rules): scheduleLinks client-inaccessible; attentionNeeded server-only

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git show HEAD:firestore.rules | grep -c "scheduleLinks"   # expect ≥1
```

---

## Owner ops (user-run, after merge/deploy)

1. **Meta/Twilio template `schedule_link`** (Utility): body e.g. `Need a different visit time for Job #{{1}}? Pick a time that works for you here (valid 72 hours): {{2}}` → set `TWILIO_TEMPLATE_SCHEDULE_LINK` in `functions/.env`. Freeform fallback covers sandbox until approval.
2. **`APP_URL` in `functions/.env`** must be the real customer-facing origin (`https://easydonehandyman.sg`) — the decline auto-send and admin send both build `${APP_URL}/pick-time?t=...`.
3. Deploy order: functions + rules together (`firebase deploy --only functions,firestore:rules` with the global binary), then hosting for the new page.

## Combined E2E walkthrough — Scenarios 3 + 4 in one run (user-run)

Setup: two test bookings from a WhatsApp-reachable customer phone — **Job A** with ASAP timing (Scenario 4) and **Job B** with a scheduled date (Scenario 3) — plus a verified test handyman (with a WhatsApp-reachable phone in `handymen/{id}.phone`) and an admin login. Steps 4–7 exercise the shared decline→pick machinery once via Job A; step 10 re-enters it from Scenario 3's admin path, so nothing is tested twice.

**Part 1 — Scenario 4: ASAP job (Job A)**
1. **Accept requires a time:** on the job board, Express Interest on Job A → the modal shows the required date/time picker; Confirm stays disabled until both are filled; the date input is bounded today…+90 days.
2. **Claim + proposal together:** confirm → job assigned; the customer receives the acceptance message AND the proposal ("proposes to visit on … Reply YES/NO"); the handyman's success alert names the proposal. A `schedule_approval` prompt is open on the job.
3. **Approve path:** customer replies YES → `preferredDate/Time` written, `preferredTiming` becomes `Schedule`, `scheduledFromAsapAt` stamped, `scheduleHistory` entry `via: 'whatsapp_reply'`, both parties get confirmations.
4. **Decline → auto-link:** from the job page tap "Propose new time" and send a second proposal, then reply NO as the customer → customer receives the pick-time link (in-session freeform, no template needed); handyman gets "they've been sent a link to pick a time".
5. **Customer picks:** open the link → context loads (service, handyman first name, current schedule); pick a date/time + note → success screen ("will confirm your picked time"). Link doc flips to `used` with `pickedDate/pickedTime`; any open `schedule_approval` prompt is superseded.
6. **Handyman approves the pick:** handyman receives "The customer picked … Reply YES/NO"; reply YES → schedule applied, `scheduleHistory` entry `via: 'customer_link'`, active links revoked, BOTH parties get confirmations.
7. **Deadlock (run on a fresh decline round):** repeat steps 4–5, then the handyman replies NO → job gains `attentionNeeded.type === 'schedule_deadlock'`, admin email arrives, the AdminDashboard Active-jobs row turns red "Needs attention", handyman gets "our team will step in", customer gets "we're arranging it". Confirm NO further automated proposal round starts (ping-pong cap).

**Part 2 — Scenario 3: scheduled job (Job B)**
8. **Handyman-initiated reschedule:** job page → "Propose new time" (date bounded, note optional) → customer receives the proposal → reply YES → schedule updated, `completionPollSentAt` cleared, both confirmed.
9. **Trigger B, customer asks in free text:** as the customer, send "can we change the time?" → it lands in `inboundMessages` + the F3 admin email (no auto-reply beyond the rate-limited ack).
10. **Admin sends the link:** AdminDashboard → Active jobs → find Job B → "Send reschedule link" (confirm dialog) → customer receives the `schedule_link` template (or freeform fallback pre-approval) with a working URL → pick → handyman approves → applied. If the handyman had an open proposal at pick time, verify it shows as `superseded`.

**Part 3 — Link security (any job)**
11. **Single-use:** re-open a used link → "already been used"; re-submit via curl → 410.
12. **Supersede:** admin sends a link, then sends another → first link doc `revoked`, first URL shows "used or replaced".
13. **Rules:** in the browser console as an admin, `getDoc(doc(db,'scheduleLinks','x'))` → permission denied.
14. **Expiry:** manually set a link doc's `expiresAt` into the past → page shows "expired", doc flips to `expired` on next open.
15. **Escrow untouched:** after all of the above, the job's `paymentStatus` and Stripe records are unchanged; nothing was released or refunded.

**Known not-covered until Stage 4 (don't file as bugs):** silent stalls have no automated escalation yet — a customer who ignores the link for 72h, or a handyman who never answers the pick, just times out quietly (prompt/link expire; no nudge, no admin email). Only an explicit handyman NO (deadlock) alerts the admin today. Scenario 12's sweep adds the nudge→queue ladders.
