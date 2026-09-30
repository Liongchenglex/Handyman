/**
 * adminJobStatus.js — plain-English status lines for the admin
 * Active jobs table (src/components/admin/ActiveJobsTable.jsx).
 *
 * 1. getAttentionLabel(type): turns `job.attentionNeeded.type` (a machine
 *    code set by the backend — buildAttentionUpdate, the sweep's
 *    `escalate`, the schedule-deadlock handler) into a label + a
 *    suggested next step, so the admin knows WHAT is wrong and WHAT to do.
 * 2. deriveScheduleStatus(job, prompts): works out where a reschedule
 *    currently stands (who we're waiting on) from the job's recent prompt
 *    docs (jobs/{id}/prompts). No backend field needed — every stage of
 *    the Scenario 3/4/11 flows already leaves a prompt record.
 *
 * Pure functions (no Firestore) so they are unit-testable.
 * Keep ATTENTION_LABELS in sync when a new attention type ships.
 */

const ATTENTION_LABELS = {
  schedule_deadlock: {
    label: 'Schedule deadlock',
    hint: 'Handyman declined the time the customer picked. Call both, then Set time — or Force unassign.',
  },
  asap_no_time: {
    label: 'ASAP job — no visit time agreed',
    hint: 'Handyman accepted but no time was confirmed. Call both, then Set time — or Force unassign.',
  },
  link_ignored: {
    label: 'Customer never picked a time',
    hint: 'The pick-time link expired unused. Send reschedule link again, or call and Set time.',
  },
  prompt_expired: {
    label: 'WhatsApp question left unanswered',
    hint: 'No reply even after a reminder (see detail). Contact whoever owes the answer.',
  },
  unclaimed: {
    label: 'Nobody has claimed this job',
    hint: 'Paid but no handyman took it. Find one manually, or Refund.',
  },
  reclaim_stalled: {
    label: 'Re-released job not re-claimed',
    hint: 'A handyman dropped it and nobody took it again. Find one manually, or Refund.',
  },
  second_visit_no_date: {
    label: 'Second visit — no date proposed',
    hint: 'Handyman has not proposed a return date. Call them and Set time, or Force unassign.',
  },
  second_visit_declined: {
    label: 'Customer declined a second visit',
    hint: 'Mediate — often becomes a price discussion or a cancellation (Refund).',
  },
  visit_problem: {
    label: 'Handyman reported a problem',
    hint: 'Handyman says they cannot finish. Call them — may need Force unassign or a price adjustment.',
  },
  no_show_new_handyman: {
    label: 'No-show — customer wants a new handyman',
    hint: 'Confirm, then Force unassign to re-release the job.',
  },
  no_show_refund_requested: {
    label: 'No-show — customer wants a refund',
    hint: 'Click Refund to return the payment and cancel the job.',
  },
  adjustment_expired: {
    label: 'Price adjustment expired unpaid',
    hint: 'Handyman was told to proceed at the original price or cancel. Check in with them.',
  },
  adjustment_payment_orphaned: {
    label: 'Late price-adjustment payment',
    hint: 'Customer paid an adjustment that was no longer valid. Refund that extra charge in Stripe.',
  },
  delta_refund_failed: {
    label: 'Price-adjustment refund failed',
    hint: 'Refund of the extra charge failed. Retry it in the Stripe Dashboard.',
  },
};

/**
 * @param {string} type - attentionNeeded.type
 * @returns {{ label: string, hint: string|null }}
 */
export const getAttentionLabel = (type) => {
  if (ATTENTION_LABELS[type]) return ATTENTION_LABELS[type];
  const readable = String(type || 'unknown').replace(/_/g, ' ');
  return { label: readable.charAt(0).toUpperCase() + readable.slice(1), hint: null };
};

// Pick-time links (F6) are valid for 72h — scheduleLinkService.js.
const LINK_VALID_HOURS = 72;

const PROMPT_TYPES_ABOUT_TIME = ['schedule_approval', 'schedule_pick_approval', 'second_visit_approval'];

const when = (date, time) => [date, time].filter(Boolean).join(', ') || 'a new time';

const toMs = (iso) => {
  const ms = Date.parse(iso || '');
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Where does this job's scheduling stand right now?
 *
 * @param {object} job - job doc data
 * @param {Array<object>} prompts - recent docs from jobs/{id}/prompts (any order)
 * @param {number} [nowMs]
 * @returns {{ tone: 'alert'|'waiting', text: string, since: string|null } | null}
 *   null when nothing is in progress.
 */
export const deriveScheduleStatus = (job, prompts = [], nowMs = Date.now()) => {
  if (job?.attentionNeeded?.type === 'schedule_deadlock') {
    return {
      tone: 'alert',
      text: 'Deadlock — handyman declined the time the customer picked',
      since: job.attentionNeeded.at || null,
    };
  }

  const open = prompts.filter((p) => p.status === 'open');

  const pick = open.find((p) => p.type === 'schedule_pick_approval');
  if (pick) {
    return {
      tone: 'waiting',
      text: `Customer picked ${when(pick.payload?.pickedDate, pick.payload?.pickedTime)} — waiting for handyman to approve`,
      since: pick.createdAt || null,
    };
  }

  const proposal = open.find((p) => p.type === 'schedule_approval');
  if (proposal) {
    return {
      tone: 'waiting',
      text: `Handyman proposed ${when(proposal.payload?.proposedDate, proposal.payload?.proposedTime)} — waiting for customer to approve`,
      since: proposal.createdAt || null,
    };
  }

  const secondVisit = open.find((p) => p.type === 'second_visit_approval');
  if (secondVisit) {
    return {
      tone: 'waiting',
      text: `Second visit proposed for ${when(secondVisit.payload?.proposedDate, secondVisit.payload?.proposedTime)} — waiting for customer to approve`,
      since: secondVisit.createdAt || null,
    };
  }

  // Customer sent a pick-time link: a declined proposal, or a no-show /
  // access-issue "reschedule" answer. Still pending unless something
  // newer (a pick prompt or an applied schedule change) settled it.
  const newest = [...prompts].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const latestTimePrompt = newest.find(
    (p) => PROMPT_TYPES_ABOUT_TIME.includes(p.type) || p.resultingAction === 'link_sent'
  );
  const linkIssued = latestTimePrompt && (
    latestTimePrompt.resultingAction === 'link_sent' ||
    (latestTimePrompt.type === 'schedule_approval' && latestTimePrompt.resultingAction === 'declined')
  );
  if (linkIssued) {
    const sentMs = toMs(latestTimePrompt.answeredAt || latestTimePrompt.createdAt);
    const history = Array.isArray(job?.scheduleHistory) ? job.scheduleHistory : [];
    const settledAfter = history.some((h) => toMs(h.changedAt) > sentMs);
    if (!settledAfter) {
      const expired = nowMs - sentMs > LINK_VALID_HOURS * 3600 * 1000;
      return {
        tone: 'waiting',
        text: expired
          ? 'Pick-time link expired unused — send a new one or call the customer'
          : 'Customer was sent a pick-time link — waiting for them to choose a time',
        since: latestTimePrompt.answeredAt || latestTimePrompt.createdAt || null,
      };
    }
  }

  const isAsap = job?.preferredTiming !== 'Schedule';
  if (isAsap && !job?.scheduledFromAsapAt) {
    return { tone: 'waiting', text: 'ASAP job — no visit time agreed yet', since: null };
  }

  return null;
};
