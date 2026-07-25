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
