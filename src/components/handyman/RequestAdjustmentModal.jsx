import React, { useState, useRef, useEffect } from 'react';
import { requestPriceAdjustment } from '../../services/api/jobPricing';
import { getServicePriceRange } from '../../config/servicePricing';

/**
 * RequestAdjustmentModal
 *
 * Handyman asks the customer to approve a price increase after an on-site
 * inspection reveals the job needs more than the original estimate. The
 * customer approves by paying the additional amount via a secure Stripe
 * link; declining lets the handyman continue at the original price or
 * cancel the job. Cloned from VisitIssueModal's skeleton (null-when-closed
 * after hooks, reset effect, submittingRef, inline error, dark-mode
 * classes) with amount + reason + note fields instead of a single note.
 *
 * The server enforces the price cap authoritatively (against the service's
 * configured range) — the range hint shown here is advisory only, so a
 * stale/mismatched client can never bypass the real check.
 *
 * Props:
 *   job         - the job object (needs .id, .serviceType, .estimatedBudget)
 *   isOpen      - render toggle
 *   onClose     - called when the user backs out or after a successful request
 *   onRequested - called after a successful request, before onClose
 */
const RequestAdjustmentModal = ({ job, isOpen, onClose, onRequested }) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entrancy guard (same pattern as VisitIssueModal).
  const submittingRef = useRef(false);

  // Reset on every open (and if the parent swaps to a different job while
  // reopening) — otherwise a stuck submittingRef or leftover amount/reason
  // would carry over into the next request.
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setReason('');
      setNote('');
      setError(null);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [isOpen, job.id]);

  if (!isOpen) return null;

  // Advisory-only range hint — the server is the source of truth for the cap.
  const { max } = getServicePriceRange(job.serviceType);
  const maxAdditional = Math.max(0, max - job.estimatedBudget);

  const canSubmit = Number(amount) > 0 && reason.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await requestPriceAdjustment(job.id, Number(amount), reason.trim(), note.trim());

    if (result.success) {
      onRequested?.();
      alert('Request sent — the customer has been asked to approve by paying.');
      onClose();
    } else {
      setError(result.error || 'Could not send the adjustment request. Please try again.');
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">request_quote</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Request price adjustment
          </h3>
        </div>

        {/* Body note */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          The customer approves by paying the additional amount through a secure Stripe link — you'll be notified when it's paid. If they decline, you can continue at the original price or cancel the job.
        </p>

        {/* Amount */}
        <label htmlFor="adjustment-amount" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Additional amount (S$, before platform fee)
        </label>
        <input
          id="adjustment-amount"
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full mb-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Range for {job.serviceType}: up to S${max} total — current S${job.estimatedBudget}, so max +S${maxAdditional}
        </p>

        {/* Reason */}
        <label htmlFor="adjustment-reason" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          id="adjustment-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="What changed on-site that requires the extra amount"
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {/* Optional note */}
        <label htmlFor="adjustment-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Additional details <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="adjustment-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Anything else the customer should know"
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestAdjustmentModal;
