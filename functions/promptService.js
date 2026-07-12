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
 * version of the question. Optional payload (e.g. a schedule proposal) is
 * stored verbatim for the dispatcher to act on when the prompt is answered.
 */
async function openPrompt({
  db,
  jobId,
  type,
  toPhone,
  toRole,
  question,
  options,
  payload = null,
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
    payload,
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
