import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getScheduleLinkContext, submitSchedulePick } from '../services/api/scheduleLink';
import { getProposalDateBounds } from '../services/api/jobSchedule';

/**
 * PickTime — the public F6 deep-link page (lifecycle spec Scenario 3).
 *
 * Reached ONLY via a one-time token in the URL (?t=...). No login: the
 * customer has no account, and the server validates the token on every
 * call. The pick does not change the schedule — it goes to the handyman
 * for approval, and the page says so.
 */
const PickTime = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';

  // phase: loading | ready | submitting | done | error
  const [phase, setPhase] = useState('loading');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const submittingRef = useRef(false);

  const dateBounds = getProposalDateBounds();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!token) {
        setError('This link is missing its code. Please use the exact link from your WhatsApp message.');
        setPhase('error');
        return;
      }
      const result = await getScheduleLinkContext(token);
      if (cancelled) return;
      if (result.success) {
        setJob(result.job);
        setPhase('ready');
      } else {
        setError(result.error);
        setPhase('error');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  const canSubmit = date && time.trim();

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    setPhase('submitting');
    const result = await submitSchedulePick(token, date, time.trim(), note.trim());
    if (result.success) {
      setPhase('done');
    } else {
      setError(result.error);
      // Used/expired links can't be retried; validation errors can.
      const terminal = ['link_used', 'link_expired', 'link_revoked', 'job_not_active', 'not_found'].includes(result.code);
      setPhase(terminal ? 'error' : 'ready');
      submittingRef.current = false;
    }
  };

  const shell = (children) => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
        {children}
      </div>
    </div>
  );

  if (phase === 'loading') {
    return shell(<div className="flex justify-center py-10"><LoadingSpinner /></div>);
  }

  if (phase === 'error') {
    return shell(
      <div className="text-center">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400">link_off</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">This link can't be used</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Need help? Reply to us on WhatsApp or email{' '}
          <a className="underline" href="mailto:easydonehandyman@gmail.com">easydonehandyman@gmail.com</a>.
        </p>
        <Link to="/" className="inline-block mt-6 text-sm font-medium text-primary underline">Back to EasyDone</Link>
      </div>
    );
  }

  if (phase === 'done') {
    return shell(
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-2xl text-green-600 dark:text-green-400">check_circle</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Time sent!</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {job ? `${job.handymanName} will confirm your picked time` : 'Your handyman will confirm your picked time'} — we'll
          message you on WhatsApp once it's locked in. You can close this page.
        </p>
      </div>
    );
  }

  // ready / submitting
  return shell(
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">event</span>
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Pick your visit time</h1>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        {job.serviceType} — Job #{job.shortId}.{' '}
        {job.preferredTiming === 'Schedule' && job.preferredDate
          ? `Currently scheduled: ${new Date(job.preferredDate).toLocaleDateString('en-SG')} at ${job.preferredTime || '—'}. `
          : ''}
        {job.handymanName} will confirm the time you pick before it's final.
      </p>

      <label htmlFor="pick-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Date <span className="text-red-500">*</span>
      </label>
      <input
        id="pick-date"
        type="date"
        min={dateBounds.min}
        max={dateBounds.max}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
      />

      <label htmlFor="pick-time" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Time <span className="text-red-500">*</span>
      </label>
      <input
        id="pick-time"
        type="text"
        maxLength={20}
        placeholder="e.g. 2:00 PM"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
      />

      <label htmlFor="pick-note" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Note to your handyman <span className="text-gray-400">(optional)</span>
      </label>
      <textarea
        id="pick-note"
        rows={2}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Mornings work best for me"
        className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || phase === 'submitting'}
        className="w-full bg-primary text-black font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {phase === 'submitting' ? 'Sending…' : 'Send my picked time'}
      </button>
    </>
  );
};

export default PickTime;
