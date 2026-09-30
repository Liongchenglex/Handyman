/**
 * jobTimeline.js — one chronological "what happened" list for a job,
 * used by the admin job detail page (src/pages/AdminJobDetail.jsx).
 *
 * A job's history is spread across several places: timestamps on the job
 * doc, history arrays (scheduleHistory, assignmentHistory, noShowReports,
 * accessIssues, visits), the price adjustment, the attention flag, and the
 * WhatsApp prompt docs in jobs/{id}/prompts. This merges them into a single
 * newest-first list of { ms, title, detail, tone } so the admin can read the
 * story of a job top to bottom without opening Firestore.
 *
 * Pure (no Firestore) and defensive: entries without a usable timestamp are
 * skipped rather than crashing the page.
 */

/**
 * Normalise an ISO string, Firestore Timestamp, Date or millis to millis.
 * @returns {number|null}
 */
export const toMillis = (v) => {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};

const readable = (s) => String(s || '').replace(/_/g, ' ');
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/**
 * @param {object} job - job doc data
 * @param {Array<object>} prompts - docs from jobs/{id}/prompts
 * @returns {Array<{ ms: number, title: string, detail: string|null, tone: 'info'|'good'|'warn'|'alert' }>}
 */
export const buildJobTimeline = (job = {}, prompts = []) => {
  const events = [];
  const add = (time, title, detail = null, tone = 'info') => {
    const ms = toMillis(time);
    if (ms != null) events.push({ ms, title, detail, tone });
  };

  // Lifecycle stamps on the job doc
  add(job.createdAt, 'Job created', job.serviceType ? `${job.serviceType}${job.estimatedBudget != null ? ` · S$${job.estimatedBudget}` : ''}` : null);
  add(job.acceptedAt, 'Handyman accepted', job.acceptedBy?.name || null, 'good');
  add(job.completedAt, 'Marked complete', null, 'good');
  add(job.releasedAt, 'Funds released to handyman', job.transferId || null, 'good');
  add(job.refundedAt, 'Payment refunded', null, 'warn');
  add(job.cancelledAt, 'Job cancelled', null, 'warn');

  arr(job.assignmentHistory).forEach((h) => add(
    h.endedAt,
    `Handyman removed (${readable(h.endReason || 'ended')})`,
    [h.handymanName, h.cancelReason && readable(h.cancelReason), h.cancelNote].filter(Boolean).join(' · ') || null,
    'warn'
  ));

  arr(job.scheduleHistory).forEach((h) => add(
    h.changedAt,
    `Schedule changed${h.via ? ` (via ${readable(h.via)})` : ''}`,
    `${[h.fromDate, h.fromTime].filter(Boolean).join(' ') || '—'} → ${[h.toDate, h.toTime].filter(Boolean).join(' ') || '—'}${h.note ? ` · ${h.note}` : ''}`
  ));

  arr(job.visits).forEach((v, i) => add(
    v.createdAt,
    `Visit ${i + 2} requested (${readable(v.status)})`,
    [v.proposedDate, v.proposedTime, v.reason && readable(v.reason), v.reportedVia && `via ${readable(v.reportedVia)}`].filter(Boolean).join(' · ') || null
  ));

  arr(job.noShowReports).forEach((r) => add(r.reportedAt, 'No-show reported', r.via ? `via ${readable(r.via)}` : null, 'alert'));
  arr(job.accessIssues).forEach((a) => add(a.reportedAt, `Visit issue: ${readable(a.kind)}`, a.note || null, 'alert'));
  arr(job.lateNotices).forEach((n) => add(n.sentAt || n.createdAt, 'Running-late notice', n.note || n.delay || null));

  const adj = job.priceAdjustment;
  if (adj) {
    add(adj.requestedAt, `Price adjustment requested: +S$${adj.deltaServiceFee ?? '?'}`, adj.reason ? readable(adj.reason) : null);
    add(adj.paidAt, 'Price adjustment paid', null, 'good');
    add(adj.declinedAt, 'Price adjustment declined', null, 'warn');
  }

  if (job.attentionNeeded) {
    add(job.attentionNeeded.at, `Flagged for attention: ${readable(job.attentionNeeded.type)}`, job.attentionNeeded.detail || null, 'alert');
  }

  // WhatsApp questions (F2 prompts): when asked, and how it ended
  arr(prompts).forEach((p) => {
    add(p.createdAt, `Asked ${p.toRole || 'someone'}: ${readable(p.type)}`, p.question || null);
    if (p.status === 'answered') {
      add(p.answeredAt, `${p.toRole === 'handyman' ? 'Handyman' : 'Customer'} replied`,
        `"${p.answer || ''}"${p.resultingAction ? ` → ${readable(p.resultingAction)}` : ''}`);
    } else if (p.status === 'expired') {
      add(p.expiredAt || p.expiresAt, `No reply: ${readable(p.type)}`, null, 'warn');
    } else if (p.status === 'superseded') {
      add(p.supersededAt, `Question replaced: ${readable(p.type)}`, null);
    }
  });

  return events.sort((a, b) => b.ms - a.ms);
};
