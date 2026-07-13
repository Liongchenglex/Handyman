import React, { useState, useRef, useEffect } from 'react';
import { proposeSchedule, getProposalDateBounds } from '../../services/api/jobSchedule';

/**
 * ProposeTimeModal
 *
 * Handyman proposes a (new) visit date/time. The customer approves or
 * declines over WhatsApp; nothing changes until they approve (F4).
 * Mirrors CancelJobModal's mount-and-toggle pattern: parent keeps it
 * mounted, state resets on every open.
 *
 * Props:
 *   job        - job object (needs .id; .preferredDate/.preferredTime shown as current)
 *   isOpen     - render toggle
 *   onClose    - back out
 *   onProposed - called after the proposal was sent successfully
 */
const ProposeTimeModal = ({ job, isOpen, onClose, onProposed }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setDate('');
      setTime('');
      setNote('');
      setError(null);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [isOpen, job.id]);

  if (!isOpen) return null;

  const canSubmit = date && time.trim();

  const handleConfirm = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await proposeSchedule(job.id, date, time.trim(), note.trim());
    if (result.success) {
      onProposed();
    } else {
      setError(result.error || 'Failed to send the proposal. Please try again.');
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const hasCurrent = job.preferredTiming === 'Schedule' && job.preferredDate;

  // Date-picker bounds (today … +90d) matching the server's validation.
  const dateBounds = getProposalDateBounds();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">event</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {hasCurrent ? 'Propose a new time' : 'Set the visit time'}
          </h3>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          {hasCurrent
            ? `Current: ${new Date(job.preferredDate).toLocaleDateString('en-SG')} at ${job.preferredTime || '—'}. The customer must approve the new time before it takes effect.`
            : 'The customer must approve this time before it takes effect. They are notified on WhatsApp right away.'}
        </p>

        <label htmlFor="propose-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          id="propose-date"
          type="date"
          min={dateBounds.min}
          max={dateBounds.max}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        <label htmlFor="propose-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Time <span className="text-red-500">*</span>
        </label>
        <input
          id="propose-time"
          type="text"
          maxLength={20}
          placeholder="e.g. 2:00 PM"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        <label htmlFor="propose-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Note to customer <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="propose-note"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Traffic on my earlier job — sorry!"
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Send to customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProposeTimeModal;
