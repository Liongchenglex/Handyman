import React from 'react';

/**
 * AdjustmentScopeNote
 *
 * Tells a handyman that the job's price already includes a price
 * adjustment the customer agreed to (and paid), and WHY — the agreed
 * extra scope. Shown wherever the job's price is shown to handymen
 * (job board card, job page, My Jobs).
 *
 * Matters most after a reassignment: if handyman A's adjustment was paid
 * and A was then removed (cancel / no-show / admin force-unassign), the
 * paid adjustment stays on the job and is released to whoever finishes it.
 * Without this note handyman B would see only a higher price, not the
 * extra work the customer paid for.
 *
 * Renders nothing unless job.priceAdjustment is paid (or already released).
 *
 * Props:
 *   job     - job object (reads priceAdjustment.{status, deltaServiceFee, reason})
 *   compact - one-line variant for list cards
 */
const AGREED_STATUSES = ['paid', 'released'];

const AdjustmentScopeNote = ({ job, compact = false }) => {
  const adj = job?.priceAdjustment;
  if (!adj || !AGREED_STATUSES.includes(adj.status)) return null;

  const amount = Number(adj.deltaServiceFee);
  const amountText = Number.isFinite(amount) ? `+S$${amount % 1 === 0 ? amount : amount.toFixed(2)}` : 'an extra amount';
  const reason = adj.reason ? String(adj.reason) : null;

  if (compact) {
    return (
      <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300 break-words">
        💰 Price includes {amountText} agreed with the customer{reason ? `: ${reason}` : ''}
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        💰 Price includes {amountText} agreed with the customer
      </p>
      {reason && (
        <p className="text-sm text-amber-900 dark:text-amber-200 mt-1 break-words">
          Agreed extra work: {reason}
        </p>
      )}
      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
        The customer has already paid this — please do the agreed extra work as part of this job.
      </p>
    </div>
  );
};

export default AdjustmentScopeNote;
