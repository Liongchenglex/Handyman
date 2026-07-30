import React, { useState, useRef, useEffect } from 'react';
import { requestSecondVisit, SECOND_VISIT_REASON_OPTIONS } from '../../services/api/jobVisits';
import { getProposalDateBounds } from '../../services/api/jobSchedule';
import { TIME_SLOTS, isSlotInPastForDate, firstAvailableSlot } from '../../utils/timeSlots';

/**
 * SecondVisitModal
 *
 * Handyman requests a return visit (Scenario 11: parts on order, job
 * bigger than expected, customer asked for another visit, etc). Collects
 * a mandatory reason (+ note when 'other') and a proposed date/time, then
 * asks the customer to approve on WhatsApp — nothing changes on the job
 * until they do. The job stays open (not completed) until the final
 * visit happens.
 *
 * Composed from CancelJobModal (shell + reason/note handling) and
 * ProposeTimeModal (date/time picker trio + slot-snapping effect).
 * Mirrors both modals' mount-and-toggle pattern: the parent keeps this
 * component mounted and toggles `isOpen`, so all form/submission state
 * must reset on every open.
 *
 * Props:
 *   job         - the job object (needs .id)
 *   isOpen      - render toggle
 *   onClose     - called when the user backs out
 *   onRequested - called after the request was sent successfully
 */
const SecondVisitModal = ({ job, isOpen, onClose, onRequested }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Synchronous re-entrancy guard (same pattern as CancelJobModal/ProposeTimeModal).
  const submittingRef = useRef(false);

  // The parent keeps this component mounted and toggles `isOpen`, so all
  // form/submission state must reset on every open — otherwise a stale
  // note, error banner, or (worst) a stuck submittingRef from a previous
  // job's request would leak into the next one.
  useEffect(() => {
    if (isOpen) {
      setDate('');
      setTime('');
      setReason('');
      setNote('');
      setError('');
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [isOpen, job.id]);

  // Snap the slot when the chosen date invalidates it (today's slots
  // pass as the clock moves) — mirrors ProposeTimeModal's behavior.
  useEffect(() => {
    if (date && time && isSlotInPastForDate(time, date)) {
      setTime(firstAvailableSlot(date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!isOpen) return null;

  const noteRequired = reason === 'other';
  const canSubmit = date && time.trim() && reason && (!noteRequired || note.trim());

  // Date-picker bounds (today … +90d) matching the server's validation.
  const dateBounds = getProposalDateBounds();

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    const result = await requestSecondVisit(job.id, date, time.trim(), reason, note.trim());

    submittingRef.current = false;
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onRequested?.();
    alert('Request sent — the customer will confirm on WhatsApp.');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2">
            <span className="material-symbols-outlined text-orange-600 dark:text-orange-400">event_repeat</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Needs another visit
          </h3>
        </div>

        {/* Consequence copy */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          The customer will be asked on WhatsApp to approve the new visit time.
          The job stays open until the final visit is done.
        </p>

        {/* Reason picklist */}
        <label htmlFor="second-visit-reason" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Why do you need another visit? <span className="text-red-500">*</span>
        </label>
        <select
          id="second-visit-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        >
          <option value="">Select a reason…</option>
          {SECOND_VISIT_REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Optional / required note */}
        <label htmlFor="second-visit-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Details {noteRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
        </label>
        <textarea
          id="second-visit-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Anything the customer should know"
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {/* Proposed date */}
        <label htmlFor="second-visit-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Proposed date <span className="text-red-500">*</span>
        </label>
        <input
          id="second-visit-date"
          type="date"
          min={dateBounds.min}
          max={dateBounds.max}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {/* Proposed time slot */}
        <label htmlFor="second-visit-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Time slot <span className="text-red-500">*</span>
        </label>
        <select
          id="second-visit-time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        >
          <option value="">Select a time slot…</option>
          {TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot} disabled={isSlotInPastForDate(slot, date)}>
              {slot}{isSlotInPastForDate(slot, date) ? ' (passed)' : ''}
            </option>
          ))}
        </select>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 bg-orange-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Send to customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecondVisitModal;
