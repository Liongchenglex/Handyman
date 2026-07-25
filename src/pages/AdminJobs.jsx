import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { adminSetJobStatus } from '../services/api/adminQueue';

/**
 * AdminJobs — every job, every status, newest first.
 *
 * The AdminDashboard's "Active jobs" section is the working QUEUE
 * (in-progress + needs-attention, with forcing actions); this page is
 * the LEDGER — read-only visibility across the whole lifecycle,
 * filterable by status. Deliberately no actions here: acting on a job
 * happens in the queue, fund-release, or disputed-jobs pages.
 */

// Status filter chips, in lifecycle order. 'all' issues an unfiltered
// query; each specific status uses the (status, createdAt) composite
// index that already exists for the board queries.
const STATUS_FILTERS = [
  'all',
  'awaiting_payment',
  'pending',
  'in_progress',
  'pending_confirmation',
  'pending_admin_approval',
  'disputed',
  'completed',
  'cancelled',
];

const STATUS_BADGE_CLASSES = {
  awaiting_payment: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending_confirmation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  pending_admin_approval: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  disputed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const toDisplayDate = (v) => {
  if (!v) return '—';
  const ms = typeof v.toMillis === 'function' ? v.toMillis() : Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '—';
};

const AdminJobs = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // per-job override state: 'busy' | <error string>
  const [overrideState, setOverrideState] = useState({});

  // Manual status override (support escape hatch — e.g. a customer says
  // they confirmed completion but the reply never landed). Audit-logged
  // server-side; the select snaps back on cancel/failure via fetchJobs.
  const handleStatusOverride = async (job, newStatus) => {
    if (!newStatus || newStatus === job.status) return;
    const note = window.prompt(
      `Change Job #${job.id.slice(-6)} from "${job.status}" to "${newStatus}"?\n\nThis is a manual override (audit-logged). Optional note:`
    );
    if (note === null) { fetchJobs(); return; } // cancelled — reset the select
    setOverrideState((s) => ({ ...s, [job.id]: 'busy' }));
    const result = await adminSetJobStatus(job.id, newStatus, note);
    setOverrideState((s) => ({ ...s, [job.id]: result.success ? undefined : (result.error || 'Failed') }));
    fetchJobs();
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const jobsCol = collection(db, 'jobs');
      const q = statusFilter === 'all'
        ? query(jobsCol, orderBy('createdAt', 'desc'), limit(100))
        : query(jobsCol, where('status', '==', statusFilter), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error loading jobs:', err);
      setLoadError('Could not load jobs. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const scheduleLabel = (job) => {
    if (job.preferredTiming === 'Schedule' && job.preferredDate) {
      return `${new Date(job.preferredDate).toLocaleDateString('en-SG')} ${job.preferredTime || ''}`.trim();
    }
    return 'ASAP';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All jobs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Read-only ledger — act on jobs from the{' '}
              <Link to="/admin" className="underline">dashboard queue</Link>, fund-release or disputes pages.
            </p>
          </div>
          <button onClick={fetchJobs} className="text-sm font-medium text-primary underline">Refresh</button>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-black border-primary'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary'
              }`}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {loading && <div className="flex justify-center py-12"><LoadingSpinner /></div>}
        {!loading && loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {!loading && !loadError && jobs.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No jobs match this filter.</p>
        )}

        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:flex md:items-center md:justify-between md:gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {/* Short id everywhere; full id on hover for support lookups */}
                  <span title={job.id}>#{job.id.slice(-6)}</span> · {job.serviceType || 'Job'}
                  <span className={`ml-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[job.status] || 'bg-gray-100 text-gray-700'}`}>
                    {String(job.status || '—').replace(/_/g, ' ')}
                  </span>
                  {job.needsAttention && (
                    <span className="ml-2 inline-block text-xs font-bold text-red-700 dark:text-red-300 uppercase">
                      Needs attention
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  Customer: {job.customerName || '—'} ({job.customerPhone || 'no phone'}) ·
                  Handyman: {(job.acceptedBy && job.acceptedBy.name) || '—'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {scheduleLabel(job)} · Payment: {job.paymentStatus || '—'} · Created {toDisplayDate(job.createdAt)}
                  {typeof job.estimatedBudget !== 'undefined' && ` · S$${job.estimatedBudget}`}
                  {job.statusOverride && (
                    <span className="ml-1 text-xs text-orange-600 dark:text-orange-400" title={`from ${job.statusOverride.from} · ${job.statusOverride.note || 'no note'}`}>
                      · manually set {toDisplayDate(job.statusOverride.at)}
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-3 md:mt-0 shrink-0 flex flex-col md:items-end gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor={`status-${job.id}`}>
                  Set status (override)
                </label>
                <select
                  id={`status-${job.id}`}
                  value={job.status || ''}
                  disabled={overrideState[job.id] === 'busy'}
                  onChange={(e) => handleStatusOverride(job, e.target.value)}
                  className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 disabled:opacity-50"
                >
                  {STATUS_FILTERS.filter((s) => s !== 'all' && s !== 'awaiting_payment').map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                  {job.status === 'awaiting_payment' && (
                    <option value="awaiting_payment">awaiting payment</option>
                  )}
                </select>
                {typeof overrideState[job.id] === 'string' && overrideState[job.id] !== 'busy' && (
                  <p className="text-xs text-red-600 dark:text-red-400">{overrideState[job.id]}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {jobs.length === 100 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Showing the 100 most recent — narrow with a status filter to see older jobs.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminJobs;
