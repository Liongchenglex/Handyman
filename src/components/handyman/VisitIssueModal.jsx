import React, { useState, useRef, useEffect } from 'react';
import { reportVisitIssue } from '../../services/api/jobVisits';

// Copy per `kind` — keyed lookup keeps the component free of branching
// strings scattered through the JSX.
const COPY = {
  no_access: {
    title: 'Customer not home / no access',
    body: "We'll let the customer know and ask them to reschedule or contact support. Add any details below (optional).",
    noteRequired: false,
  },
  cannot_finish: {
    title: "Problem — can't finish this job",
    body: "Describe what's blocking the job. Our team will step in — the customer will be told we're looking into it.",
    noteRequired: true,
  },
};

/**
 * VisitIssueModal
 *
 * Handyman reports that a visit couldn't proceed as planned — either the
 * customer wasn't home/reachable (`kind: 'no_access'`) or something else
 * is blocking completion of the job (`kind: 'cannot_finish'`). Both kinds
 * share the same shell and submit flow; only the copy and note
 * requirement differ. Cloned from CancelJobModal's skeleton.
 *
 * The parent (Task 13) keeps this component always mounted and toggles
 * `isOpen`/`kind` together, so all form/submission state resets on every
 * open AND on every kind change — otherwise a stale note from a
 * 'cannot_finish' report could leak into a 'no_access' one (or vice
 * versa) without the modal ever having closed.
 *
 * Props:
 *   job        - the job object (needs .id)
 *   kind       - 'no_access' | 'cannot_finish' — selects the copy/validation
 *   isOpen     - render toggle
 *   onClose    - called when the user backs out or after a successful report
 *   onReported - called after a successful report, before onClose
 */
const VisitIssueModal = ({ job, kind, isOpen, onClose, onReported }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entrancy guard (same pattern as CancelJobModal).
  const submittingRef = useRef(false);

  // Reset on open AND on kind change — the parent may swap `kind` while
  // reopening the modal for a different report, and a stuck
  // submittingRef or leftover note would otherwise carry over.
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setError(null);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [isOpen, job.id, kind]);

  if (!isOpen) return null;

  const copy = COPY[kind] || COPY.no_access;
  const canSubmit = (kind === 'no_access' || note.trim()) && !isSubmitting;

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await reportVisitIssue(job.id, kind, note.trim());

    if (result.success) {
      onReported?.();
      alert(
        kind === 'no_access'
          ? "Reported — we've let the customer know and asked them to reschedule or contact support."
          : 'Reported — our team will step in and contact the customer.'
      );
      onClose();
    } else {
      setError(result.error || 'Could not send the report. Please try again.');
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
            <span className="material-symbols-outlined text-red-600 dark:text-red-400">report_problem</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {copy.title}
          </h3>
        </div>

        {/* Kind-specific copy */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          {copy.body}
        </p>

        {/* Optional / required note */}
        <label htmlFor="visit-issue-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Details {copy.noteRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
        </label>
        <textarea
          id="visit-issue-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={300}
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
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisitIssueModal;
