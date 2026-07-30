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
 * Find the last visits[] entry still in 'pending_schedule', proposed or
 * not. Unlike findUnproposedVisitIndex (dateless-only, used by the sweep
 * detector), this backs upsertPendingVisit's fill-vs-append decision.
 */
function findLastPendingVisitIndex(job) {
  const visits = visitsOf(job);
  for (let i = visits.length - 1; i >= 0; i--) {
    const v = visits[i];
    if (v && v.status === 'pending_schedule') return i;
  }
  return -1;
}

/**
 * Create or fill the pending second-visit entry. A customer-initiated
 * intent (poll option 3) creates a dateless pending entry; when the
 * handyman later proposes, we FILL that entry rather than append —
 * `reportedVia` keeps recording who first raised the visit. A repeated
 * proposal (re-propose, or an endpoint retry after a post-commit
 * failure) likewise FILLS the existing pending entry rather than
 * appending a duplicate — a new proposal supersedes an open one,
 * regardless of whether that open entry already carries a date.
 *
 * Caveat: the fill targets the LAST pending_schedule entry regardless of
 * its proposedDate, and proposedDate/proposedTime are overwritten
 * unconditionally (a dateless call nulls out a previously proposed
 * date) while reason/note/promptId merely fall back to the existing
 * entry's values — callers must ensure at most one open pending-visit
 * flow is live per job before calling.
 */
function upsertPendingVisit(job, { proposedDate, proposedTime, reason, note, reportedVia, promptId, nowIso }) {
  const visits = visitsOf(job).slice();
  const existingIdx = findLastPendingVisitIndex(job);
  if (existingIdx >= 0) {
    visits[existingIdx] = {
      ...visits[existingIdx],
      proposedDate: proposedDate || null,
      proposedTime: proposedTime || null,
      reason: reason || visits[existingIdx].reason || null,
      note: cleanNote(note) || visits[existingIdx].note || null,
      promptId: promptId || visits[existingIdx].promptId || null,
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

/**
 * When a second-visit approval prompt dies unanswered, strip the dead
 * proposal's date so the entry re-enters the dateless "handyman owes a
 * date" ladder (evaluateSecondVisit) instead of wedging the poll gates.
 * Returns null when there is nothing to reset (idempotent for sweeps).
 */
function buildVisitProposalReset(job, { visitIndex, nowIso }) {
  const visits = Array.isArray(job && job.visits) ? job.visits.slice() : [];
  const entry = visits[visitIndex];
  if (!entry || entry.status !== 'pending_schedule' || !entry.proposedDate) return null;
  visits[visitIndex] = { ...entry, proposedDate: null, proposedTime: null, proposalExpiredAt: nowIso };
  return { visits };
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
  buildVisitProposalReset,
};
