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

  const update = {
    assignmentHistory: history,
    previousHandymanIds: prev.includes(callerUid) ? prev : [...prev, callerUid],
    reassignmentCount: (job.reassignmentCount || 0) + 1,
    status: 'pending',
    handymanId: null,
    acceptedAt: admin.firestore.FieldValue.delete(),
    acceptedBy: admin.firestore.FieldValue.delete(),
    completionPollSentAt: admin.firestore.FieldValue.delete(),
    completionPollSentBy: admin.firestore.FieldValue.delete(),
    // A new assignment era starts: stale sweep markers from the previous
    // handyman must not suppress nudges/escalations for the next one.
    sweepNudges: admin.firestore.FieldValue.delete(),
    // A stale open second-visit approval prompt must not survive into the
    // new era either — it could apply the outgoing handyman's proposal to
    // whoever picks the job up next (a late customer YES re-applying).
    visitDispositionSentFor: admin.firestore.FieldValue.delete(),
    cancelledLastBy: callerUid,
    lastCancelledAt: nowIso,
  };

  // Void any second-visit entry still awaiting scheduling: it belonged to
  // the cancelling handyman's plan and must not suppress the auto-poll or
  // mis-nudge the next handyman via hasPendingSecondVisit. Scheduled,
  // declined, and done entries are historical fact and stay untouched.
  const visits = Array.isArray(job.visits) ? job.visits : [];
  let visitsChanged = false;
  const nextVisits = visits.map((entry) => {
    if (entry && entry.status === 'pending_schedule') {
      visitsChanged = true;
      return { ...entry, status: 'cancelled_assignment', cancelledAt: nowIso };
    }
    return entry;
  });
  if (visitsChanged) {
    update.visits = nextVisits;
  }

  return update;
}

module.exports = {
  CANCEL_REASONS,
  CancelError,
  validateCancelRequest,
  buildCancelUpdate,
};
