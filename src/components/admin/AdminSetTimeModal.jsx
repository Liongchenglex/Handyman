import React, { useState, useRef, useEffect } from 'react';
import { adminSetSchedule } from '../../services/api/adminQueue';
import { getProposalDateBounds } from '../../services/api/jobSchedule';

/**
 * AdminSetTimeModal — F5 admin-as-actor set-time (Scenario 12 queue).
 * Applies immediately via adminSetSchedule (no approval round); the
 * admin is expected to have phoned both parties first, and the copy
 * says so.
 */
const AdminSetTimeModal = ({ job, isOpen, onClose, onApplied }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // Extracted so the useEffect dependency array holds a simple identifier
  // (react-hooks/exhaustive-deps rejects inline `job && job.id`).
  const jobId = job && job.id;

  useEffect(() => {
    if (isOpen) {
      setDate(''); setTime(''); setNote(''); setError(null);
      setIsSubmitting(false); submittingRef.current = false;
    }
  }, [isOpen, jobId]);

  if (!isOpen || !job) return null;

  const dateBounds = getProposalDateBounds();
  const canSubmit = date && time.trim();

  const handleConfirm = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    const result = await adminSetSchedule(job.id, date, time.trim(), note.trim());
    if (result.success) {
      onApplied();
    } else {
      setError(result.error);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Set visit time (admin) — #{job.id.slice(-6)}
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Applies immediately and notifies both parties — call them first. Open
          proposals and pick-links for this job are closed.
        </p>

        <label htmlFor="admin-set-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          id="admin-set-date" type="date"
          min={dateBounds.min} max={dateBounds.max}
          value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />
        <label htmlFor="admin-set-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Time <span className="text-red-500">*</span>
        </label>
        <input
          id="admin-set-time" type="text" maxLength={20} placeholder="e.g. 2:00 PM"
          value={time} onChange={(e) => setTime(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />
        <label htmlFor="admin-set-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Internal note <span className="text-gray-400">(optional, kept in schedule history)</span>
        </label>
        <textarea
          id="admin-set-note" rows={2} maxLength={300}
          value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose} disabled={isSubmitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm} disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Applying…' : 'Set time'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSetTimeModal;
