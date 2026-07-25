import React, { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import LoadingSpinner from '../common/LoadingSpinner';
import { sendScheduleLink } from '../../services/api/scheduleLink';
import { resolveAttention, adminUnassignJob, adminRefundJob } from '../../services/api/adminQueue';
import AdminSetTimeModal from './AdminSetTimeModal';

/**
 * ActiveJobsTable — admin view of every in_progress job (lifecycle
 * spec Scenario 3 Trigger B + Scenario 12's future attention queue).
 *
 * The admin's one action here (v1) is "Send reschedule link": when a
 * customer asks for a time change in free text (F3 inbox), the admin
 * sends them the F6 pick-time link from the matching row. Rows flagged
 * attentionNeeded (schedule deadlock) sort first and are highlighted.
 *
 * Mobile-friendly: stacked cards on small screens, table-like rows on
 * md+, matching the dashboard's Tailwind idiom.
 */
const ActiveJobsTable = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // per-job send state: { [jobId]: 'sending' | 'sent' | <error string> }
  const [sendState, setSendState] = useState({});

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const jobsCol = collection(db, 'jobs');
      const [inProgressSnap, attentionSnap] = await Promise.all([
        getDocs(query(jobsCol, where('status', '==', 'in_progress'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(jobsCol, where('needsAttention', '==', true), limit(50))),
      ]);
      const byId = new Map();
      [...inProgressSnap.docs, ...attentionSnap.docs].forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
      const rows = [...byId.values()];
      rows.sort((a, b) => (b.needsAttention ? 1 : 0) - (a.needsAttention ? 1 : 0));
      setJobs(rows);
    } catch (err) {
      console.error('Error loading active jobs:', err);
      setLoadError('Could not load active jobs. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const [setTimeJob, setSetTimeJob] = useState(null); // job whose set-time modal is open
  const [actionState, setActionState] = useState({}); // { [jobId]: 'busy' | <error string> }

  const runAction = async (jobId, fn) => {
    setActionState((s) => ({ ...s, [jobId]: 'busy' }));
    const result = await fn();
    if (result.success) {
      setActionState((s) => ({ ...s, [jobId]: undefined }));
      fetchJobs();
    } else {
      setActionState((s) => ({ ...s, [jobId]: result.error || 'Failed' }));
    }
  };

  const handleResolve = (job) => {
    if (!window.confirm(`Clear the attention flag on Job #${job.id.slice(-6)}?`)) return;
    runAction(job.id, () => resolveAttention(job.id));
  };

  const handleUnassign = (job) => {
    const note = window.prompt(
      `Force-unassign ${(job.acceptedBy && job.acceptedBy.name) || 'the handyman'} from Job #${job.id.slice(-6)}?\n\nThe job re-releases to the board and they cannot re-claim it. Optional note:`
    );
    if (note === null) return; // cancelled
    runAction(job.id, () => adminUnassignJob(job.id, note));
  };

  const handleRefund = async (job) => {
    if (!window.confirm(
      `Refund Job #${job.id.slice(-6)} (S$${job.estimatedBudget || '?'}) to the customer and cancel the job?\n\nThis cannot be undone.`
    )) return;
    setActionState((s) => ({ ...s, [job.id]: 'busy' }));
    const refund = await adminRefundJob(job.paymentIntentId);
    if (!refund.success) {
      setActionState((s) => ({ ...s, [job.id]: refund.error || 'Refund failed' }));
      return;
    }
    // Money is refunded from here on — the job MUST end up cancelled.
    // A failure on this second write gets its own recovery button below
    // ('Finish cancelling'); plain 'Mark resolved' would leave a refunded
    // job open with no trace.
    const closed = await resolveAttention(job.id, { markCancelled: true });
    if (!closed.success) {
      setActionState((s) => ({ ...s, [job.id]: 'refund_orphaned' }));
      return;
    }
    setActionState((s) => ({ ...s, [job.id]: undefined }));
    fetchJobs();
  };

  const handleFinishCancelling = (job) => {
    runAction(job.id, () => resolveAttention(job.id, { markCancelled: true }));
  };

  const handleSendLink = async (job) => {
    const confirmed = window.confirm(
      `Send ${job.customerName || 'the customer'} a WhatsApp link to pick a new visit time for Job #${job.id.slice(-6)}?\n\nThis replaces any earlier link for this job.`
    );
    if (!confirmed) return;
    setSendState((s) => ({ ...s, [job.id]: 'sending' }));
    const result = await sendScheduleLink(job.id);
    setSendState((s) => ({ ...s, [job.id]: result.success ? 'sent' : (result.error || 'Failed') }));
  };

  const scheduleLabel = (job) => {
    if (job.preferredTiming === 'Schedule' && job.preferredDate) {
      return `${new Date(job.preferredDate).toLocaleDateString('en-SG')} ${job.preferredTime || ''}`.trim();
    }
    return 'ASAP — time not fixed';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active jobs</h2>
        <button
          onClick={fetchJobs}
          className="text-sm font-medium text-primary underline"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
      {!loading && loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {!loading && !loadError && jobs.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No active or flagged jobs.</p>
      )}

      <div className="space-y-3">
        {jobs.map((job) => {
          const state = sendState[job.id];
          const busy = actionState[job.id] === 'busy';
          const refundOrphaned = actionState[job.id] === 'refund_orphaned';
          return (
            <div
              key={job.id}
              className={`rounded-xl border p-4 md:flex md:items-center md:justify-between md:gap-4 ${
                job.attentionNeeded
                  ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  #{job.id.slice(-6)} · {job.serviceType || 'Job'}
                  {job.attentionNeeded && (
                    <span className="ml-2 inline-block text-xs font-bold text-red-700 dark:text-red-300 uppercase">
                      Needs attention · {String(job.attentionNeeded.type || '').replace(/_/g, ' ')}
                      {job.attentionNeeded.at ? ` · since ${new Date(job.attentionNeeded.at).toLocaleDateString('en-SG')}` : ''}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  Customer: {job.customerName || '—'} ({job.customerPhone || 'no phone'}) ·
                  Handyman: {(job.acceptedBy && job.acceptedBy.name) || '—'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {job.status !== 'in_progress' ? `Status: ${job.status} · ` : ''}Schedule: {scheduleLabel(job)}
                  {Array.isArray(job.scheduleHistory) && job.scheduleHistory.length > 0 &&
                    ` · ${job.scheduleHistory.length} change${job.scheduleHistory.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="mt-3 md:mt-0 shrink-0 flex flex-col gap-2 md:items-end">
                <div className="flex flex-wrap gap-2">
                  {job.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => handleSendLink(job)}
                        disabled={state === 'sending' || state === 'sent' || !job.customerPhone}
                        className="bg-primary text-black text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Link sent ✓' : 'Send reschedule link'}
                      </button>
                      <button
                        onClick={() => setSetTimeJob(job)}
                        disabled={busy}
                        className="bg-blue-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Set time
                      </button>
                      <button
                        onClick={() => handleUnassign(job)}
                        disabled={busy || !job.handymanId}
                        className="bg-orange-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        Force unassign
                      </button>
                    </>
                  )}
                  {job.paymentIntentId && job.paymentStatus === 'succeeded' && !refundOrphaned && (
                    <button
                      onClick={() => handleRefund(job)}
                      disabled={busy}
                      className="bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Refund
                    </button>
                  )}
                  {refundOrphaned && (
                    <button
                      onClick={() => handleFinishCancelling(job)}
                      className="bg-red-700 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-red-800 transition-colors"
                    >
                      Finish cancelling
                    </button>
                  )}
                  {job.needsAttention && (
                    <button
                      onClick={() => handleResolve(job)}
                      disabled={busy}
                      className="bg-gray-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
                {typeof actionState[job.id] === 'string' && actionState[job.id] !== 'busy' && actionState[job.id] !== 'refund_orphaned' && (
                  <p className="text-xs text-red-600 dark:text-red-400">{actionState[job.id]}</p>
                )}
                {refundOrphaned && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Refunded, but the job could not be closed — tap "Finish cancelling".
                  </p>
                )}
                {state && state !== 'sending' && state !== 'sent' && (
                  <p className="text-xs text-red-600 dark:text-red-400">{state}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AdminSetTimeModal
        job={setTimeJob}
        isOpen={!!setTimeJob}
        onClose={() => setSetTimeJob(null)}
        onApplied={() => { setSetTimeJob(null); fetchJobs(); }}
      />
    </div>
  );
};

export default ActiveJobsTable;
