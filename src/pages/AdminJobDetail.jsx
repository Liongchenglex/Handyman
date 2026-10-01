import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { projectConfig } from '../config/firebaseProject';
import { getPlatformFee } from '../config/servicePricing';
import LoadingSpinner from '../components/common/LoadingSpinner';
import TestJobBadge from '../components/admin/TestJobBadge';
import RequestAdjustmentModal from '../components/handyman/RequestAdjustmentModal';
import { getAttentionLabel, deriveScheduleStatus } from '../utils/adminJobStatus';
import { buildJobTimeline, toMillis } from '../utils/jobTimeline';

/**
 * AdminJobDetail — everything about one job on a single admin page
 * (route: /admin/jobs/:jobId, admin-only).
 *
 * Reached by clicking a job in the dashboard's Active jobs table or the
 * All jobs ledger. Shows: why it needs attention + next step, where the
 * schedule stands, customer / handyman / job / money details, photos, and
 * one merged timeline of everything that happened (job history arrays +
 * WhatsApp prompts — see utils/jobTimeline.js).
 *
 * Mostly read-only by design. The one action here is "Request price
 * adjustment" on the assigned handyman's behalf (admin-as-actor); the
 * queue actions (Set time, Force unassign, Refund) stay on the dashboard,
 * and fund release stays on /admin/fund-release.
 *
 * Mobile-first: single column, cards stack; two columns from md.
 */

const STRIPE_BASE = `https://dashboard.stripe.com${
  String(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_test') ? '/test' : ''
}`;

const fmtDateTime = (v) => {
  const ms = toMillis(v);
  return ms == null ? '—' : new Date(ms).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });
};
const readable = (s) => String(s || '—').replace(/_/g, ' ');
const money = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `S$${Number(n).toFixed(2)}`);
const waLink = (phone) => `https://wa.me/${String(phone || '').replace(/\D/g, '')}`;

const TONE_DOT = {
  info: 'bg-gray-400',
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  alert: 'bg-red-500',
};

/** Card wrapper used by every section. */
const Section = ({ title, children, action = null }) => (
  <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

/** Label/value row; value wraps instead of overflowing on small screens. */
const Field = ({ label, children }) => (
  <div className="py-1.5 grid grid-cols-3 gap-2 text-sm">
    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="col-span-2 text-gray-900 dark:text-white break-words">{children ?? '—'}</dd>
  </div>
);

const AdminJobDetail = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [handyman, setHandyman] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const snap = await getDoc(doc(db, 'jobs', jobId));
      if (!snap.exists()) {
        setJob(null);
        setLoadError('Job not found.');
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      setJob(data);

      // Prompts + handyman are secondary: a failure hides that part only.
      const [promptsResult, handymanResult] = await Promise.allSettled([
        getDocs(query(collection(db, 'jobs', jobId, 'prompts'), orderBy('createdAt', 'desc'), limit(50))),
        data.handymanId ? getDoc(doc(db, 'handymen', data.handymanId)) : Promise.resolve(null),
      ]);
      if (promptsResult.status === 'fulfilled') {
        setPrompts(promptsResult.value.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else {
        console.error('Could not load prompts:', promptsResult.reason);
        setPrompts([]);
      }
      if (handymanResult.status === 'fulfilled' && handymanResult.value?.exists?.()) {
        setHandyman({ id: handymanResult.value.id, ...handymanResult.value.data() });
      } else {
        setHandyman(null);
      }
    } catch (err) {
      console.error('Error loading job:', err);
      setLoadError('Could not load this job. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center pt-24"><LoadingSpinner /></div>;
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link to="/admin" className="text-sm text-primary underline">← Back to dashboard</Link>
          <p className="mt-6 text-red-600 dark:text-red-400">{loadError || 'Job not found.'}</p>
        </div>
      </div>
    );
  }

  const attention = job.attentionNeeded ? getAttentionLabel(job.attentionNeeded.type) : null;
  const scheduleStatus = deriveScheduleStatus(job, prompts);
  const timeline = buildJobTimeline(job, prompts);
  const adj = job.priceAdjustment;
  const canRequestAdjustment = job.status === 'in_progress' && !!job.handymanId &&
    !(adj && ['pending_payment', 'paid', 'refunded', 'released'].includes(adj.status));
  const images = Array.isArray(job.imageUrls) ? job.imageUrls : [];
  const schedule = job.preferredTiming === 'Schedule' && job.preferredDate
    ? `${new Date(job.preferredDate).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ${job.preferredTime || ''}`.trim()
    : 'ASAP';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <Link to="/admin" className="text-sm text-primary underline">← Back to dashboard</Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Job #{job.id.slice(-6)} · {job.serviceType || 'Job'}
                <TestJobBadge job={job} className="ml-2" />
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 break-all">ID: {job.id}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {readable(job.status)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  payment: {readable(job.paymentStatus)}
                </span>
              </div>
            </div>
            <button onClick={load} className="text-sm font-medium text-primary underline py-2">Refresh</button>
          </div>
        </div>

        {/* Attention + schedule status */}
        {attention && (
          <div className="rounded-2xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="font-bold text-red-800 dark:text-red-200">
              ⚠️ Needs attention: {attention.label}
              <span className="font-normal"> · since {fmtDateTime(job.attentionNeeded.at)}</span>
            </p>
            {job.attentionNeeded.detail && (
              <p className="text-sm text-red-800 dark:text-red-200 mt-1 break-words">{job.attentionNeeded.detail}</p>
            )}
            {attention.hint && (
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                <span className="font-semibold">Next step:</span> {attention.hint}{' '}
                <Link to="/admin" className="underline">Actions are on the dashboard →</Link>
              </p>
            )}
          </div>
        )}
        {scheduleStatus && (
          <div className={`rounded-2xl border p-4 text-sm ${
            scheduleStatus.tone === 'alert'
              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 font-semibold'
              : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
          }`}>
            🕒 {scheduleStatus.text}
            {scheduleStatus.since && <span className="font-normal opacity-80"> · since {fmtDateTime(scheduleStatus.since)}</span>}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Customer">
            <dl>
              <Field label="Name">{job.customerName}</Field>
              <Field label="Phone">
                {job.customerPhone
                  ? <a className="text-primary underline" href={waLink(job.customerPhone)} target="_blank" rel="noopener noreferrer">{job.customerPhone} (WhatsApp)</a>
                  : null}
              </Field>
              <Field label="Email">
                {job.customerEmail ? <a className="text-primary underline" href={`mailto:${job.customerEmail}`}>{job.customerEmail}</a> : null}
              </Field>
              <Field label="Address">{job.address || job.location}</Field>
            </dl>
          </Section>

          <Section title="Handyman">
            {job.handymanId ? (
              <dl>
                <Field label="Name">{handyman?.name || job.acceptedBy?.name}</Field>
                <Field label="Phone">
                  {handyman?.phone
                    ? <a className="text-primary underline" href={waLink(handyman.phone)} target="_blank" rel="noopener noreferrer">{handyman.phone} (WhatsApp)</a>
                    : null}
                </Field>
                <Field label="Accepted">{fmtDateTime(job.acceptedAt)}</Field>
                <Field label="Record">
                  <span className="text-xs">
                    cancellations {handyman?.cancellationCount || 0} · no-shows {handyman?.noShowCount || 0}
                  </span>
                </Field>
              </dl>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Not assigned — job is on the board.</p>
            )}
            {Array.isArray(job.previousHandymanIds) && job.previousHandymanIds.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Previously assigned: {job.previousHandymanIds.length} handyman(s) — see timeline.
              </p>
            )}
          </Section>

          <Section title="Job">
            <dl>
              <Field label="Visit">{schedule}</Field>
              <Field label="Description"><span className="whitespace-pre-wrap">{job.description}</span></Field>
              <Field label="Materials">{job.materials}</Field>
              <Field label="Site visit">{job.siteVisit}</Field>
              <Field label="Created">{fmtDateTime(job.createdAt)}</Field>
            </dl>
          </Section>

          <Section
            title="Money"
            action={canRequestAdjustment && (
              <button
                onClick={() => setShowAdjust(true)}
                className="text-sm font-bold bg-primary text-gray-900 rounded-lg px-3 py-2 hover:bg-primary/90"
              >
                Request price adjustment
              </button>
            )}
          >
            <dl>
              <Field label="Service fee">{money(job.estimatedBudget)}</Field>
              <Field label="Payment">{readable(job.paymentStatus)}</Field>
              <Field label="Stripe">
                {job.paymentIntentId
                  ? <a className="text-primary underline break-all" href={`${STRIPE_BASE}/payments/${job.paymentIntentId}`} target="_blank" rel="noopener noreferrer">{job.paymentIntentId}</a>
                  : null}
              </Field>
              {adj && (
                <Field label="Adjustment">
                  +{money(adj.deltaServiceFee)} service fee
                  {' '}(customer pays {money(adj.customerTotal ?? (Number(adj.deltaServiceFee) + getPlatformFee(Number(adj.deltaServiceFee))))} incl. platform fee)
                  {' '}· <b>{readable(adj.status)}</b>
                  {adj.requestedVia === 'admin' && ' · by admin'}
                  {adj.reason && <span className="block text-xs text-gray-500 dark:text-gray-400">{adj.reason}</span>}
                  {adj.status === 'pending_payment' && adj.checkoutUrl && (
                    <a className="block text-xs text-primary underline break-all" href={adj.checkoutUrl} target="_blank" rel="noopener noreferrer">customer pay link</a>
                  )}
                </Field>
              )}
            </dl>
            {job.status === 'pending_admin_approval' && (
              <Link to="/admin/fund-release" className="inline-block mt-2 text-sm text-primary underline">Release funds →</Link>
            )}
          </Section>
        </div>

        {images.length > 0 && (
          <Section title={`Photos (${images.length})`}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="Job" className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                </a>
              ))}
            </div>
          </Section>
        )}

        <Section title="Timeline">
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No history recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((e, i) => (
                <li key={`${e.ms}-${i}`} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[e.tone] || TONE_DOT.info}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{e.title}</p>
                    {e.detail && <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{e.detail}</p>}
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(e.ms)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <p className="text-xs text-gray-500 dark:text-gray-400 pb-6">
          Raw data:{' '}
          <a
            className="underline"
            href={`${projectConfig.firebaseConsoleUrl}/firestore/data/~2Fjobs~2F${job.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            open this job in the Firebase console
          </a>
        </p>
      </div>

      {job.handymanId && (
        <RequestAdjustmentModal
          job={job}
          isOpen={showAdjust}
          asAdmin
          onClose={() => setShowAdjust(false)}
          onRequested={load}
        />
      )}
    </div>
  );
};

export default AdminJobDetail;
