# Pending-Prompt Router + No-Silent-Drops (Stage 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every WhatsApp question we send is recorded as a pending prompt before sending, every inbound reply is resolved against the sender's open prompts (not regex-on-job-status), and every message we can't handle is stored + forwarded to the admin instead of silently dropped — with the existing completion poll migrated onto this machinery.

**Architecture:** A new DI-style `functions/promptService.js` owns prompt documents (`jobs/{jobId}/prompts/{promptId}`), the collection-group lookup by phone, and the pure reply-interpretation logic (single-prompt option matching, multi-prompt numbered disambiguation). `whatsappWebhook` gains a prompt-first routing stage ahead of its existing logic; the existing completion transaction is extracted into a reusable `applyCompletionAnswer` used by both the prompt path and the legacy path (pre-deploy polls). Unmatched messages flow to `inboundMessages` + a generic admin email + a rate-limited ack (F3). Both completion-poll senders open a prompt after a successful send.

**Tech Stack:** Firebase Cloud Functions (Node 20, plain JS), Firestore collection-group query (new composite index), Twilio via existing REST helpers, nodemailer via existing SMTP env, Jest.

**Spec:** `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` §3 (F2, F3). Branch: `feature/job-lifecycle-flows` (checked out).

## Global Constraints

- Prompt doc shape exactly as below (spec §3 F2, plus `toPhoneKey`/`jobId` denormalized for the collection-group query). Statuses: `open | answered | expired | superseded`. Default expiry 48h (stored; expiry *sweeping* is Scenario 12, out of scope — replies to expired prompts still count in v1).
- Opening a prompt supersedes prior `open` prompts of the same `type` on the same job (spec: "Opening a new prompt of the same type supersedes the old one").
- `completionPollSentAt`/`completionPollSentBy` bookkeeping is kept unchanged (spec: compatibility).
- Legacy YES/NO handling stays as the fallback for polls sent before this deploys; it must end in F3, never a silent ignore.
- F3: nothing inbound is dropped — store in `inboundMessages`, email the admin, ack the sender at most once per 12h per phone (`checkRateLimit('whatsapp_ack_' + phoneKey, 1, 43200)`).
- Job-state writes happen BEFORE the prompt is marked answered (a failed job transaction must not leave an answered prompt).
- Firestore rules: `prompts` (collection-group) and `inboundMessages` — admin read, all client writes denied.
- ANTI-iCLOUD PROTOCOL for every commit: stage only named files, read `git diff --staged` hunk-by-hunk, re-grep a distinctive string post-commit.
- Verification: `cd functions && node --check index.js && npx jest`. Rules/indexes verified via `/Users/liongchenglex/.npm-global/bin/firebase emulators:start --only firestore` started in background (NO `timeout` command on this Mac; `npx firebase` hangs — use the global binary), grep the log for "All emulators ready".
- Line numbers in this plan may drift a few lines — locate by the quoted content.

---

### Task 1: `promptService.js` — prompt documents + reply interpretation

**Files:**
- Create: `functions/promptService.js`
- Test: `functions/__tests__/promptService.test.js`

**Interfaces (produced; Tasks 3–4 consume):**
- `normalizePhoneKey(phone)` → digits-only string, `65` prefixed for 8-digit SG numbers, `whatsapp:`/`+`/spaces stripped.
- `openPrompt({ db, jobId, type, toPhone, toRole, question, options, expiresInHours = 48, nowMs })` → Promise<{ promptId, superseded: number }>.
- `findOpenPrompts(db, phoneKey)` → Promise<Array<{ id, ref, ...data }>> newest-first (collection-group query).
- `interpretReply(prompts, messageText)` → `{ kind: 'none' }` | `{ kind: 'answer', prompt, action, answerText }` | `{ kind: 'disambiguate' }` | `{ kind: 'unmatched' }`.
- `buildDisambiguationList(prompts)` → string (numbered list + reply instructions).
- `markAnswered(promptRef, { answer, resultingAction })` → Promise<void>.

- [ ] **Step 1: Write the failing tests**

Create `functions/__tests__/promptService.test.js`:

```js
const {
  normalizePhoneKey,
  interpretReply,
  buildDisambiguationList,
  openPrompt,
} = require('../promptService');

const prompt = (over = {}) => ({
  id: 'p1',
  jobId: 'job_aaa111',
  type: 'completion_confirmation',
  toPhoneKey: '6591234567',
  question: 'Has the work been completed?',
  options: { YES: 'confirm', 'CONFIRM COMPLETE': 'confirm', NO: 'reject', 'REPORT ISSUE': 'reject' },
  status: 'open',
  ...over,
});

describe('normalizePhoneKey', () => {
  test('strips whatsapp prefix, plus, spaces; adds SG country code to 8-digit locals', () => {
    expect(normalizePhoneKey('whatsapp:+6591234567')).toBe('6591234567');
    expect(normalizePhoneKey('9123 4567')).toBe('6591234567');
    expect(normalizePhoneKey('+65 9123-4567')).toBe('6591234567');
  });
});

describe('interpretReply — single open prompt', () => {
  test('matches an option key as a whole word, case-insensitively', () => {
    const r = interpretReply([prompt()], 'yes');
    expect(r).toMatchObject({ kind: 'answer', action: 'confirm' });
    expect(r.prompt.id).toBe('p1');
  });

  test('matches a multi-word quick-reply button text', () => {
    expect(interpretReply([prompt()], 'Report Issue'))
      .toMatchObject({ kind: 'answer', action: 'reject' });
  });

  test('does not match option keys inside other words', () => {
    // 'KNOW' contains the letters NO but not the word NO
    expect(interpretReply([prompt()], 'know')).toEqual({ kind: 'unmatched' });
  });

  test('conflicting matches are unmatched, not guessed', () => {
    expect(interpretReply([prompt()], 'yes no')).toEqual({ kind: 'unmatched' });
  });

  test('free text is unmatched', () => {
    expect(interpretReply([prompt()], 'can you come at 3pm instead?'))
      .toEqual({ kind: 'unmatched' });
  });
});

describe('interpretReply — multiple open prompts', () => {
  const two = [
    prompt(),
    prompt({ id: 'p2', jobId: 'job_bbb222', type: 'reschedule_approval', options: { YES: 'approve', NO: 'decline' } }),
  ];

  test('a leading selector binds the answer to that prompt (1-based, list order)', () => {
    const r = interpretReply(two, '2 yes');
    expect(r).toMatchObject({ kind: 'answer', action: 'approve' });
    expect(r.prompt.id).toBe('p2');
  });

  test('an answer without a selector asks for disambiguation', () => {
    expect(interpretReply(two, 'yes')).toEqual({ kind: 'disambiguate' });
  });

  test('a selector out of range is unmatched', () => {
    expect(interpretReply(two, '5 yes')).toEqual({ kind: 'unmatched' });
  });

  test('no prompts at all → none', () => {
    expect(interpretReply([], 'yes')).toEqual({ kind: 'none' });
  });
});

describe('buildDisambiguationList', () => {
  test('numbers prompts and includes the reply format', () => {
    const text = buildDisambiguationList([
      prompt(),
      prompt({ id: 'p2', jobId: 'job_bbb222', question: 'Approve the new time?' }),
    ]);
    expect(text).toContain('1.');
    expect(text).toContain('2.');
    expect(text).toContain('#aaa111');
    expect(text).toContain('#bbb222');
    expect(text).toMatch(/reply with the number/i);
  });
});

describe('openPrompt', () => {
  // Minimal chainable fake for jobs/{id}/prompts: supports the supersede
  // query (where/where/get) and doc creation via doc().set().
  function fakeDb(existingOpenPrompts) {
    const writes = { set: [], updates: [] };
    const promptsCol = {
      where: () => promptsCol,
      get: async () => ({
        docs: existingOpenPrompts.map((p) => ({
          id: p.id,
          ref: { update: async (u) => writes.updates.push({ id: p.id, ...u }) },
        })),
      }),
      doc: () => ({
        id: 'new_prompt_id',
        set: async (data) => writes.set.push(data),
      }),
    };
    return {
      writes,
      collection: () => ({ doc: () => ({ collection: () => promptsCol }) }),
    };
  }

  test('creates the prompt doc and supersedes prior open prompts of the same type', async () => {
    const db = fakeDb([{ id: 'old1' }]);
    const result = await openPrompt({
      db,
      jobId: 'job_aaa111',
      type: 'completion_confirmation',
      toPhone: 'whatsapp:+6591234567',
      toRole: 'customer',
      question: 'Has the work been completed?',
      options: { YES: 'confirm', NO: 'reject' },
      nowMs: 1_700_000_000_000,
    });

    expect(result).toEqual({ promptId: 'new_prompt_id', superseded: 1 });
    expect(db.writes.updates[0]).toMatchObject({ id: 'old1', status: 'superseded' });
    const doc = db.writes.set[0];
    expect(doc).toMatchObject({
      jobId: 'job_aaa111',
      type: 'completion_confirmation',
      toPhoneKey: '6591234567',
      toRole: 'customer',
      status: 'open',
      options: { YES: 'confirm', NO: 'reject' },
    });
    // 48h default expiry from the injected clock
    expect(doc.expiresAt).toBe(new Date(1_700_000_000_000 + 48 * 3600 * 1000).toISOString());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest __tests__/promptService.test.js`
Expected: FAIL — `Cannot find module '../promptService'`

- [ ] **Step 3: Implement the module**

Create `functions/promptService.js`:

```js
/**
 * Pending-prompt primitive (job lifecycle spec §3 F2).
 *
 * Every WhatsApp question we send a party is recorded as a prompt doc
 * BEFORE the send, and every inbound reply is resolved against the
 * sender's open prompts — instead of inferring intent from regexes and
 * job status. One prompt = one outstanding question; a phone with
 * several open prompts gets the numbered-disambiguation treatment the
 * completion flow already trained customers on ("1 YES").
 *
 * Docs live at jobs/{jobId}/prompts/{promptId}; toPhoneKey and jobId
 * are denormalized onto each doc so a single collection-group query
 * can find a sender's open prompts across all their jobs.
 *
 * Pure logic (interpretReply, buildDisambiguationList) is separated
 * from Firestore access (openPrompt, findOpenPrompts, markAnswered)
 * for testability, in the same DI style as handymanNotifier.js.
 */

const admin = require('firebase-admin');

/**
 * Digits-only phone key. Accepts 'whatsapp:+65...', '+65 ...', local
 * 8-digit SG numbers (gets '65' prefixed) — mirrors formatPhoneToWhatsApp
 * in functions/index.js so both sides agree on identity.
 */
function normalizePhoneKey(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 8) cleaned = `65${cleaned}`;
  return cleaned;
}

/** Escape a string for use inside a RegExp. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match `text` against one prompt's option keys. Whole-word,
 * case-insensitive; multi-word keys (quick-reply button texts) match as
 * phrases. Returns the mapped action, or null when nothing (or more
 * than one DIFFERENT action) matches — we never guess between
 * conflicting matches.
 */
function matchOptions(options, text) {
  const upper = ` ${String(text || '').toUpperCase().trim()} `;
  const actions = new Set();
  let matchedAction = null;
  for (const [key, action] of Object.entries(options || {})) {
    const re = new RegExp(`(?:^|[^A-Z0-9])${escapeRegExp(key.toUpperCase())}(?:[^A-Z0-9]|$)`);
    if (re.test(upper)) {
      actions.add(action);
      matchedAction = action;
    }
  }
  return actions.size === 1 ? matchedAction : null;
}

/**
 * Resolve an inbound message against the sender's open prompts
 * (newest-first, as returned by findOpenPrompts).
 *
 *  - no prompts        → { kind: 'none' }   (caller: legacy path, then F3)
 *  - one prompt        → option match → answer; else unmatched
 *  - several prompts   → leading number selects one ("2 YES"); a bare
 *                        answer can't be attributed → disambiguate;
 *                        out-of-range selector → unmatched
 *
 * Expired prompts still match in v1 — a late answer beats a dropped
 * one; expiry sweeping/nudging is Scenario 12.
 */
function interpretReply(prompts, messageText) {
  if (!prompts || prompts.length === 0) return { kind: 'none' };
  const text = String(messageText || '').trim();

  if (prompts.length === 1) {
    const action = matchOptions(prompts[0].options, text);
    return action
      ? { kind: 'answer', prompt: prompts[0], action, answerText: text }
      : { kind: 'unmatched' };
  }

  const selectorMatch = text.match(/^\s*([1-9])\b(.*)$/);
  if (!selectorMatch) {
    // Something that looks like an answer but no selector → ask which.
    // Pure free text with no option match anywhere → unmatched (F3).
    const matchesAny = prompts.some((p) => matchOptions(p.options, text));
    return matchesAny ? { kind: 'disambiguate' } : { kind: 'unmatched' };
  }

  const index = parseInt(selectorMatch[1], 10) - 1;
  if (index >= prompts.length) return { kind: 'unmatched' };
  const rest = selectorMatch[2].trim();
  const action = matchOptions(prompts[index].options, rest);
  return action
    ? { kind: 'answer', prompt: prompts[index], action, answerText: text }
    : { kind: 'unmatched' };
}

/**
 * Numbered list a sender sees when they answered without a selector.
 * Mirrors the existing multi-job completion disambiguation copy.
 */
function buildDisambiguationList(prompts) {
  const lines = prompts.map((p, i) => `${i + 1}. ${p.question} (Job #${String(p.jobId).slice(-6)})`);
  return (
    `You have ${prompts.length} pending questions:\n\n${lines.join('\n')}\n\n` +
    `Please reply with the number and your answer — e.g. "1 YES".`
  );
}

/**
 * Record a question we are about to send. Supersedes prior open prompts
 * of the same type on the same job so replies always bind to the latest
 * version of the question.
 */
async function openPrompt({
  db,
  jobId,
  type,
  toPhone,
  toRole,
  question,
  options,
  expiresInHours = 48,
  nowMs = Date.now(),
}) {
  const promptsCol = db.collection('jobs').doc(jobId).collection('prompts');

  const priorOpen = await promptsCol
    .where('type', '==', type)
    .where('status', '==', 'open')
    .get();
  await Promise.all(priorOpen.docs.map((d) => d.ref.update({
    status: 'superseded',
    supersededAt: new Date(nowMs).toISOString(),
  })));

  const docRef = promptsCol.doc();
  await docRef.set({
    jobId,
    type,
    toPhone: String(toPhone),
    toPhoneKey: normalizePhoneKey(toPhone),
    toRole,
    question,
    options,
    status: 'open',
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + expiresInHours * 3600 * 1000).toISOString(),
  });

  return { promptId: docRef.id, superseded: priorOpen.docs.length };
}

/**
 * All open prompts for a phone, newest first, across every job.
 * Requires the composite collection-group index on prompts
 * (toPhoneKey ASC, status ASC, createdAt DESC) — see firestore.indexes.json.
 */
async function findOpenPrompts(db, phoneKey) {
  const snap = await db.collectionGroup('prompts')
    .where('toPhoneKey', '==', phoneKey)
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .limit(9) // selector is a single digit; more than 9 open prompts is pathological
    .get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

/** Close an answered prompt. Call AFTER the job-state write succeeded. */
async function markAnswered(promptRef, { answer, resultingAction }) {
  await promptRef.update({
    status: 'answered',
    answeredAt: new Date().toISOString(),
    answer: String(answer || '').slice(0, 500),
    resultingAction: resultingAction || null,
  });
}

module.exports = {
  normalizePhoneKey,
  interpretReply,
  buildDisambiguationList,
  openPrompt,
  findOpenPrompts,
  markAnswered,
};
```

(Note: `admin` is required only so future helpers can use FieldValue without re-plumbing; if the linter flags it unused, remove the import — nothing in this module needs it today.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest __tests__/promptService.test.js`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit (anti-iCloud protocol)**

```bash
git add functions/promptService.js functions/__tests__/promptService.test.js
git diff --staged   # read every hunk
git commit -m "feat(prompts): pending-prompt primitive with reply interpretation"
grep -c "interpretReply" functions/promptService.js   # expect ≥ 2
```

---

### Task 2: Extract `applyCompletionAnswer` (behavior-preserving refactor)

**Files:**
- Modify: `functions/index.js` — inside `whatsappWebhook` (locate `Atomically verify the job is still pending_confirmation`), plus a new module-level function.

**Interfaces:**
- Produces: `applyCompletionAnswer({ db, jobId, isConfirm })` → Promise of `{ outcome: 'confirmed' | 'disputed' | 'already_processed', jobData?, recordedAs? }`. Task 3 consumes it from the prompt path; the legacy path calls it in this task.

- [ ] **Step 1: Add the module-level function**

Insert above `exports.whatsappWebhook` in `functions/index.js`:

```js
/**
 * Apply a customer's completion answer to a job, atomically.
 *
 * Extracted from the webhook so BOTH reply paths share one
 * transaction: the prompt router (post-migration polls carry a prompt
 * doc that names the job directly) and the legacy phone-lookup path
 * (polls sent before the prompt migration deployed).
 *
 * The transaction re-checks status === 'pending_confirmation' so a
 * double-tap or a stale prompt can never flip an already-decided job.
 *
 * @returns {{outcome: 'confirmed'|'disputed'|'already_processed', jobData?: object, recordedAs?: string}}
 */
async function applyCompletionAnswer({ db, jobId, isConfirm }) {
  const jobRef = db.collection('jobs').doc(jobId);
  let jobData;
  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(jobRef);
      if (!fresh.exists || fresh.data().status !== 'pending_confirmation') {
        throw new Error('ALREADY_PROCESSED');
      }
      jobData = fresh.data();
      if (isConfirm) {
        tx.update(jobRef, {
          status: 'pending_admin_approval',
          customerConfirmedAt: new Date().toISOString(),
          confirmedVia: 'whatsapp_reply',
        });
      } else {
        tx.update(jobRef, {
          status: 'disputed',
          disputedAt: new Date().toISOString(),
          disputedVia: 'whatsapp_reply',
          disputeReason: 'Customer reported issue via WhatsApp reply',
        });
      }
    });
  } catch (txError) {
    if (txError.message === 'ALREADY_PROCESSED') {
      let recordedAs = 'already recorded';
      try {
        const snap = await jobRef.get();
        const s = snap.exists ? snap.data().status : null;
        if (s === 'pending_admin_approval') recordedAs = '✅ Confirmed';
        else if (s === 'disputed') recordedAs = '⚠️ Issue Reported';
      } catch (readErr) {
        console.error('Could not read job status after ALREADY_PROCESSED:', readErr);
      }
      return { outcome: 'already_processed', recordedAs };
    }
    throw txError;
  }
  return { outcome: isConfirm ? 'confirmed' : 'disputed', jobData };
}
```

- [ ] **Step 2: Make the legacy webhook path call it**

In `whatsappWebhook`, replace the block starting at the comment `// Atomically verify the job is still pending_confirmation, then write the response.` down to (and including) the closing `}` of the `catch (txError)` block — i.e., the inline transaction and its ALREADY_PROCESSED handling — with:

```js
    const jobId = pendingJobRef.id;
    const answerResult = await applyCompletionAnswer({
      db: admin.firestore(),
      jobId,
      isConfirm,
    });

    if (answerResult.outcome === 'already_processed') {
      await sendTwilioMessage(
        From,
        `ℹ️ Your ${isConfirm ? 'confirmation' : 'report'} for Job #${jobId} did not go through — this job has already been recorded as: ${answerResult.recordedAs}.\n\nThe outcome cannot be changed here. If it was a mistake, please contact easydonehandyman@gmail.com as soon as possible.`
      );
      return res.status(200).json({
        received: true,
        processed: false,
        reason: 'Job already processed — customer notified'
      });
    }

    const action = answerResult.outcome === 'confirmed' ? 'confirm' : 'reject';
    const jobData = answerResult.jobData;
```

Keep everything after this point (the `if (action === 'confirm')` block with `sendAdminNotificationEmail` + thank-you message, and the dispute reply) exactly as-is — it already uses `action`, `jobData`, `jobId`, `From`.

Also delete the now-dead local declarations this replaced (`let action;` and `let jobData;` above the old transaction).

- [ ] **Step 3: Verify parse + suite**

Run: `cd functions && node --check index.js && npx jest`
Expected: clean; 22 tests + Task 1's 13 = 35 green.

- [ ] **Step 4: Commit (anti-iCloud protocol)**

```bash
git add functions/index.js
git diff --staged   # read every hunk — must be the extraction only, no behavior change
git commit -m "refactor(webhook): extract applyCompletionAnswer for reuse by prompt router"
grep -c "applyCompletionAnswer" functions/index.js   # expect ≥ 3
```

---

### Task 3: Prompt-first routing + F3 in `whatsappWebhook`

**Files:**
- Modify: `functions/index.js` — requires at top; `whatsappWebhook` body; new helpers `sendAdminEmail` and `forwardUnmatchedInbound` above the webhook.

**Interfaces:**
- Consumes: Task 1's `normalizePhoneKey`, `findOpenPrompts`, `interpretReply`, `buildDisambiguationList`, `markAnswered`; Task 2's `applyCompletionAnswer`; existing `sendTwilioMessage`, `sendAdminNotificationEmail`, `checkRateLimit`, `HOSTING_URL`.
- Produces: F3 behavior + `sendAdminEmail(subject, html)` (generic; future flows reuse it).

- [ ] **Step 1: Add the require**

Next to `require('./paymentCapture')` at the top of `functions/index.js`:

```js
// Pending-prompt primitive — see functions/promptService.js and
// docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md §3.
const {
  normalizePhoneKey,
  interpretReply,
  buildDisambiguationList,
  findOpenPrompts,
  markAnswered,
  openPrompt,
} = require('./promptService');
```

- [ ] **Step 2: Add the generic admin email helper**

Insert directly above the existing `sendAdminNotificationEmail` function (locate `async function sendAdminNotificationEmail`):

```js
/**
 * Send the admin a plain operational email. Generic sibling of
 * sendAdminNotificationEmail (which is fund-release-specific); used by
 * the F3 no-silent-drops forwarder and future lifecycle flows.
 * Same env contract: ADMIN_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 * Never throws — email is best-effort, callers must not fail on it.
 */
async function sendAdminEmail(subject, html) {
  const nodemailer = require('nodemailer');
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!adminEmail || !smtpHost || !smtpUser || !smtpPass) {
    console.warn('⚠️ Email not configured — admin email skipped:', subject);
    return { success: false, error: 'Email not configured' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: `"EasyDone System" <${smtpUser}>`,
      to: adminEmail,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('⚠️ sendAdminEmail failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * F3 — no silent drops (job lifecycle spec §3). Any inbound WhatsApp
 * message we could not resolve is stored, forwarded to the admin, and
 * (rate-limited) acknowledged to the sender. This is v1's substitute
 * for chat-level admin transparency, and the metric for whether a real
 * chat channel is ever needed.
 */
async function forwardUnmatchedInbound({ from, body, mediaUrls, reason }) {
  const phoneKey = normalizePhoneKey(from);

  // Best-guess job attribution: the sender's most recent job.
  let matchedJobId = null;
  let matchedService = null;
  try {
    const phoneFormats = [phoneKey, `+${phoneKey}`, phoneKey.startsWith('65') ? phoneKey.substring(2) : phoneKey];
    for (const p of phoneFormats) {
      const snap = await admin.firestore().collection('jobs')
        .where('customerPhone', '==', p)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!snap.empty) {
        matchedJobId = snap.docs[0].id;
        matchedService = snap.docs[0].data().serviceType || null;
        break;
      }
    }
  } catch (lookupErr) {
    console.warn('Inbound job attribution failed (storing anyway):', lookupErr.message);
  }

  await admin.firestore().collection('inboundMessages').add({
    fromPhone: phoneKey,
    body: String(body || '').slice(0, 2000),
    mediaUrls: mediaUrls || [],
    reason, // 'no_open_prompt' | 'unmatched_reply' | 'selector_out_of_range'
    matchedJobId,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await sendAdminEmail(
    `📨 Unhandled WhatsApp message${matchedJobId ? ` — Job #${matchedJobId.slice(-6)}` : ''}`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px;">
      <p><strong>From:</strong> ${phoneKey}</p>
      ${matchedJobId ? `<p><strong>Likely job:</strong> ${matchedJobId} (${matchedService || 'unknown service'})</p>` : '<p><strong>Likely job:</strong> none found</p>'}
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="border-left: 3px solid #ccc; padding-left: 10px;">${String(body || '(no text)').slice(0, 2000)}</blockquote>
      ${(mediaUrls && mediaUrls.length) ? `<p><strong>Media:</strong> ${mediaUrls.length} attachment(s) — view in Twilio console</p>` : ''}
    </div>`
  );

  // Ack the sender at most once per 12h so they aren't ghosted, without
  // ack-looping against autoresponders.
  const rl = await checkRateLimit(`whatsapp_ack_${phoneKey}`, 1, 43200);
  if (rl.allowed) {
    await sendTwilioMessage(
      from,
      `Thanks for your message — our team has received it and will get back to you if needed.\n\nFor urgent matters, contact easydonehandyman@gmail.com.`
    );
  }
}
```

- [ ] **Step 3: Insert the prompt-first routing stage**

In `whatsappWebhook`, immediately AFTER the block that extracts `customerPhone`/`messageText` (locate `console.log(\`📱 Incoming WhatsApp from ${customerPhone}\`) `), and BEFORE the intent-detection comment (`// Process confirmation replies`), insert:

```js
    // ------- Prompt-first routing (job lifecycle spec §3 F2) -------
    // Inbound media (photos of the job site etc.) — captured for F3.
    const numMedia = parseInt(req.body.NumMedia || '0', 10) || 0;
    const mediaUrls = [];
    for (let i = 0; i < numMedia; i++) {
      if (req.body[`MediaUrl${i}`]) mediaUrls.push(req.body[`MediaUrl${i}`]);
    }

    const senderKey = normalizePhoneKey(From);
    let openPrompts = [];
    try {
      openPrompts = await findOpenPrompts(admin.firestore(), senderKey);
    } catch (promptLookupErr) {
      // A missing index or transient error must not kill the webhook —
      // fall through to the legacy path.
      console.error('Prompt lookup failed (falling back to legacy):', promptLookupErr);
    }

    if (openPrompts.length > 0) {
      const verdict = interpretReply(openPrompts, Body);

      if (verdict.kind === 'answer') {
        if (verdict.prompt.type === 'completion_confirmation') {
          const isPromptConfirm = verdict.action === 'confirm';
          const answerResult = await applyCompletionAnswer({
            db: admin.firestore(),
            jobId: verdict.prompt.jobId,
            isConfirm: isPromptConfirm,
          });

          // Close the prompt AFTER the job write settles (either way the
          // question is no longer open — 'already_processed' means it was
          // decided elsewhere).
          await markAnswered(verdict.prompt.ref, {
            answer: verdict.answerText,
            resultingAction: answerResult.outcome,
          });

          if (answerResult.outcome === 'already_processed') {
            await sendTwilioMessage(
              From,
              `ℹ️ Your ${isPromptConfirm ? 'confirmation' : 'report'} for Job #${verdict.prompt.jobId} did not go through — this job has already been recorded as: ${answerResult.recordedAs}.\n\nThe outcome cannot be changed here. If it was a mistake, please contact easydonehandyman@gmail.com as soon as possible.`
            );
            return res.status(200).json({ received: true, processed: false, reason: 'Prompt answer on already-processed job' });
          }

          if (answerResult.outcome === 'confirmed') {
            await sendAdminNotificationEmail(answerResult.jobData, verdict.prompt.jobId);
            await sendTwilioMessage(
              From,
              `✅ Thank you for confirming!\n\nOur team will process the payment and email you the receipt.\n\nJob ID: ${verdict.prompt.jobId}\n\nIf you confirmed by mistake, please contact easydonehandyman@gmail.com as soon as possible.\n\nWe hope to serve you again! 🔧`
            );
            return res.status(200).json({ received: true, processed: true, action: 'pending_admin_approval', via: 'prompt' });
          }

          await sendTwilioMessage(
            From,
            `⚠️ We're sorry to hear that.\n\nOur team will contact you with regard to this dispute.\n\nJob ID: ${verdict.prompt.jobId}\n\nIf you reported this by mistake, please contact easydonehandyman@gmail.com as soon as possible.\n\nWe take every feedback seriously and will resolve this promptly.`
          );
          return res.status(200).json({ received: true, processed: true, action: 'disputed', via: 'prompt' });
        }

        // A prompt type this deploy doesn't know how to dispatch —
        // defensive forward rather than a wrong action.
        console.warn(`Unknown prompt type '${verdict.prompt.type}' — forwarding to admin`);
        await forwardUnmatchedInbound({ from: From, body: Body, mediaUrls, reason: 'unmatched_reply' });
        return res.status(200).json({ received: true, processed: false, reason: 'Unknown prompt type' });
      }

      if (verdict.kind === 'disambiguate') {
        await sendTwilioMessage(From, buildDisambiguationList(openPrompts));
        return res.status(200).json({ received: true, processed: false, reason: 'Multiple prompts — asked to disambiguate' });
      }

      // 'unmatched' with open prompts: fall through to the legacy path
      // (pre-migration polls), which now ends in F3 instead of a drop.
    }
    // ------- end prompt-first routing -------
```

- [ ] **Step 4: Replace the two silent-ignore exits with F3**

(a) Locate in `whatsappWebhook`:

```js
    if (!isConfirm && !isReject) {
      // Not a confirmation reply — ignore
      console.log(`ℹ️ Non-confirmation message received: "${Body.trim()}", ignoring`);
      return res.status(200).json({ received: true, processed: false, reason: 'Not a confirmation reply' });
    }
```

Replace with:

```js
    if (!isConfirm && !isReject) {
      // Not a recognizable reply — F3: store, forward to admin, ack.
      await forwardUnmatchedInbound({ from: From, body: Body, mediaUrls, reason: 'no_open_prompt' });
      return res.status(200).json({ received: true, processed: false, reason: 'Unmatched — forwarded to admin' });
    }
```

(b) Locate:

```js
      console.warn('⚠️ No pending job found for customer:', customerPhone);
      return res.status(200).json({
        received: true,
        processed: false,
        reason: 'No pending job found'
      });
```

Replace with:

```js
      console.warn('⚠️ No pending job found for customer:', customerPhone);
      await forwardUnmatchedInbound({ from: From, body: Body, mediaUrls, reason: 'no_open_prompt' });
      return res.status(200).json({
        received: true,
        processed: false,
        reason: 'No pending job found — forwarded to admin'
      });
```

- [ ] **Step 5: Verify parse + suite**

Run: `cd functions && node --check index.js && npx jest`
Expected: clean; 35 tests green.

- [ ] **Step 6: Commit (anti-iCloud protocol)**

```bash
git add functions/index.js
git diff --staged   # read every hunk against Steps 1-4
git commit -m "feat(webhook): prompt-first routing and no-silent-drops admin fallback"
grep -c "forwardUnmatchedInbound" functions/index.js   # expect ≥ 4
```

---

### Task 4: Open a prompt at both completion-poll send sites

**Files:**
- Modify: `functions/index.js` — the `case 'job_completion':` block in `sendWhatsAppNotification`, and `autoTriggerCompletionPoll`.

**Interfaces:**
- Consumes: Task 1's `openPrompt`. Options map shared by both sites (must be identical):

```js
const COMPLETION_PROMPT_OPTIONS = {
  'YES': 'confirm', 'CONFIRM COMPLETE': 'confirm', 'CONFIRM': 'confirm',
  'NO': 'reject', 'REPORT ISSUE': 'reject', 'REPORT': 'reject', 'ISSUE': 'reject',
};
```

- [ ] **Step 1: Add the shared options constant**

Insert at module level in `functions/index.js`, next to the promptService require:

```js
// Reply options for the completion poll — shared by the handyman
// "Mark Complete" proxy path and the daily auto-poll so both create
// identical prompts. Keys mirror the quick-reply button texts and the
// words the legacy regexes accepted.
const COMPLETION_PROMPT_OPTIONS = {
  'YES': 'confirm', 'CONFIRM COMPLETE': 'confirm', 'CONFIRM': 'confirm',
  'NO': 'reject', 'REPORT ISSUE': 'reject', 'REPORT': 'reject', 'ISSUE': 'reject',
};
```

- [ ] **Step 2: Open a prompt in the `job_completion` proxy case**

In `sendWhatsAppNotification`, locate `case 'job_completion': {` and its send:

```js
          result = await sendTwilioTemplateMessage(
            toWhatsApp,
            templateSid,
            { '1': data.customerName, '2': data.handymanName, '3': data.serviceType, '4': data.jobId },
            fallback
          );
          break;
```

Replace with:

```js
          result = await sendTwilioTemplateMessage(
            toWhatsApp,
            templateSid,
            { '1': data.customerName, '2': data.handymanName, '3': data.serviceType, '4': data.jobId },
            fallback
          );

          // F2: record the question so the reply router can bind the
          // customer's YES/NO to THIS job without phone-lookup guessing.
          if (result.success && data.jobId) {
            try {
              await openPrompt({
                db: admin.firestore(),
                jobId: data.jobId,
                type: 'completion_confirmation',
                toPhone: data.customerPhone,
                toRole: 'customer',
                question: `Has ${data.handymanName || 'your handyman'} completed the ${data.serviceType || 'job'}?`,
                options: COMPLETION_PROMPT_OPTIONS,
              });
            } catch (promptErr) {
              // Prompt bookkeeping must not fail the send — the legacy
              // reply path still handles this job by phone lookup.
              console.error(`⚠️ openPrompt failed for job ${data.jobId} (job_completion):`, promptErr);
            }
          }
          break;
```

- [ ] **Step 3: Open a prompt in `autoTriggerCompletionPoll`**

Locate in `autoTriggerCompletionPoll`:

```js
        if (!sendResult.success) {
          console.error(`❌ Failed to send message for job ${jobId}:`, sendResult.error);
          continue;
        }
```

Insert immediately after that block (before the `completionPollSentAt` update):

```js
        // F2: record the question for the reply router (see promptService).
        try {
          await openPrompt({
            db: admin.firestore(),
            jobId,
            type: 'completion_confirmation',
            toPhone: job.customerPhone,
            toRole: 'customer',
            question: `Has ${handymanName} completed the ${job.serviceType || 'job'}?`,
            options: COMPLETION_PROMPT_OPTIONS,
          });
        } catch (promptErr) {
          console.error(`⚠️ openPrompt failed for job ${jobId} (auto poll):`, promptErr);
        }
```

- [ ] **Step 4: Verify parse + suite, commit**

Run: `cd functions && node --check index.js && npx jest`
Expected: clean; 35 green.

```bash
git add functions/index.js
git diff --staged
git commit -m "feat(prompts): completion poll opens a pending prompt at both send sites"
grep -c "COMPLETION_PROMPT_OPTIONS" functions/index.js   # expect 3
```

---

### Task 5: Firestore rules + collection-group index

**Files:**
- Modify: `firestore.rules` (inside the `match /jobs/{jobId}` block, after the existing `notifications` match; plus a new top-level `inboundMessages` match near `auditLog`)
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Rules — prompts subcollection + collection-group + inboundMessages**

(a) Inside `match /jobs/{jobId} { ... }`, after the `match /notifications/{handymanId}` block, add:

```
      // Pending prompts — one doc per outstanding WhatsApp question
      // (completion poll, reschedule approval, ...). Written EXCLUSIVELY
      // by Cloud Functions (Admin SDK bypasses rules). Parties answer
      // over WhatsApp, never through the app, so clients get no access;
      // admins may read for support/debugging.
      match /prompts/{promptId} {
        allow read: if isAdmin();
        allow write: if false;
      }
```

(b) The webhook's collection-group query runs via the Admin SDK (bypasses rules), but an admin-dashboard CG query later would need a CG rule. Add after the `jobs` block (top level, before `match /handymen`):

```
    // Collection-group access to prompts across all jobs (admin tooling).
    match /{path=**}/prompts/{promptId} {
      allow read: if isAdmin();
      allow write: if false;
    }
```

(c) Near the `auditLog` match at the bottom, add:

```
    // Unmatched inbound WhatsApp messages (F3 no-silent-drops). Written
    // only by Cloud Functions; admin reads for the support inbox.
    match /inboundMessages/{messageId} {
      allow read: if isAdmin();
      allow write: if false;
    }
```

- [ ] **Step 2: Composite collection-group index**

In `firestore.indexes.json`, append to the `indexes` array (before the closing `]`):

```json
    {
      "collectionGroup": "prompts",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "toPhoneKey", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
```

- [ ] **Step 3: Verify rules compile**

Start the emulator in the background (`/Users/liongchenglex/.npm-global/bin/firebase emulators:start --only firestore`, capture output to a file), wait for the log to contain `All emulators ready` (rules loaded = compiled), then kill it (`pkill -f "emulators:start --only firestore"`). There is no `timeout` command on this Mac and `npx firebase` hangs — use the global binary and a background run.
Expected: "All emulators ready!" with no rules errors in the log.

- [ ] **Step 4: Commit (anti-iCloud protocol)**

```bash
git add firestore.rules firestore.indexes.json
git diff --staged
git commit -m "feat(rules): prompts and inboundMessages access control + prompts CG index"
grep -c "inboundMessages" firestore.rules   # expect ≥ 1
```

---

### Task 6: Ops/E2E checklist (owner-run; no code)

- [ ] Deploy functions + rules + indexes to dev (`firebase deploy --only functions,firestore` — index build may take a few minutes; the CG query fails with a FAILED_PRECONDITION error until it finishes).
- [ ] **Prompt path:** handyman marks a job complete → verify a `prompts` doc appears under the job (`status: 'open'`, `toPhoneKey` matches) → customer replies YES → job flips to `pending_admin_approval`, prompt flips to `answered` with `resultingAction: 'confirmed'`, admin email arrives.
- [ ] **Disambiguation:** two jobs pending confirmation for one phone → bare "YES" gets the numbered list → "2 YES" resolves job 2.
- [ ] **F3:** customer sends "can you come at 3pm?" → `inboundMessages` doc created with best-guess job, admin email received, customer gets the ack; a second free-text within 12h gets NO second ack but still stores + emails.
- [ ] **Media:** send a photo → `mediaUrls` populated on the inbound doc, admin email notes the attachment.
- [ ] **Legacy fallback:** a job whose poll was sent BEFORE deploy (no prompt doc) still resolves via the old phone-lookup path.
- [ ] **Regression:** completion double-tap still yields the "already recorded" message; webhook rate limits unchanged.

## Self-review notes (applied)

- Spec §3 F2: prompt shape, supersede-on-open, 48h expiry stored (sweeping deferred to Scenario 12 per spec), completion-poll migration with `completionPollSentAt` kept → Tasks 1, 4. Reply binding + numbered disambiguation → Tasks 1, 3.
- Spec §3 F3: `inboundMessages` store + admin forward + never-silent → Task 3 (both legacy ignore exits replaced); ack added (rate-limited 1/12h) as discussed in design.
- Ordering constraint (job write before prompt close) honored in Task 3's prompt path (`applyCompletionAnswer` → then `markAnswered`).
- Type consistency: `interpretReply` verdict kinds used in Task 3 match Task 1 exactly; `applyCompletionAnswer` outcomes (`confirmed|disputed|already_processed`) consistent between Tasks 2 and 3; `COMPLETION_PROMPT_OPTIONS` keys align with `matchOptions` word-boundary matching and the legacy regex vocabulary.
- No placeholders; complete code everywhere.
