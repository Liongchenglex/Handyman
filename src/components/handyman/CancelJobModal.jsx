import React, { useState, useRef } from 'react';
import { cancelJobAssignment, CANCEL_REASON_OPTIONS } from '../../services/api/jobAssignment';

/**
 * CancelJobModal
 *
 * Shared cancel dialog used by JobActionButtons (job details) and
 * MyJobsView. Collects a mandatory reason (+ note when 'other'),
 * explains the consequence, and calls the cancelJobAssignment Cloud
 * Function. Mobile-first, mirrors the ConfirmationModal pattern in
 * ExpressInterestButton.jsx.
 *
 * Props:
 *   job         - the job object (needs .id, .serviceType)
 *   isOpen      - render toggle
 *   onClose     - called when the user backs out
 *   onCancelled - called after a successful cancel (navigate/refresh)
 */
const CancelJobModal = ({ job, isOpen, onClose, onCancelled }) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entrancy guard (same pattern as ExpressInterestButton).
  const submittingRef = useRef(false);

  if (!isOpen) return null;

  const noteRequired = reason === 'other';
  const canSubmit = reason && (!noteRequired || note.trim());

  const handleConfirm = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await cancelJobAssignment(job.id, reason, note.trim());

    if (result.success) {
      onCancelled();
    } else {
      setError(result.error || 'Failed to cancel. Please try again.');
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400">event_busy</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Cancel this job?
          </h3>
        </div>

        {/* Consequence copy */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          The job returns to the job board for another handyman, and the
          customer will be notified. You won't be able to take this job again.
        </p>

        {/* Reason picklist */}
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Why are you cancelling? <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        >
          <option value="">Select a reason…</option>
          {CANCEL_REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Optional / required note */}
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Details {noteRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Anything the team should know"
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
            Keep Job
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Cancelling…' : 'Cancel Job'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelJobModal;
