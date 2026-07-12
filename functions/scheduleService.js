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
