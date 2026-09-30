import React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * AdjustmentResultNotice
 *
 * Stripe Checkout sends the customer back to the homepage after a price-
 * adjustment payment (functions/index.js — requestPriceAdjustment
 * success_url / cancel_url): `/?adjustment=paid|cancelled&job=<shortId>`.
 * Customers have no account, so this popup is their on-screen confirmation
 * (the WhatsApp message and Stripe's email receipt are the durable ones).
 *
 * Renders nothing unless `adjustment` is present. Closing it strips the
 * query params so a refresh doesn't show it again.
 */
const MESSAGES = {
  paid: {
    icon: 'check_circle',
    iconClass: 'text-green-600 dark:text-green-400',
    title: 'Payment received — thank you!',
    body: 'Your handyman has been notified and will continue with the updated job. You\'ll also get a WhatsApp confirmation. Your payment stays protected until the job is confirmed complete.',
  },
  cancelled: {
    icon: 'info',
    iconClass: 'text-blue-600 dark:text-blue-400',
    title: 'No payment was made',
    body: 'You can still pay using the link in your WhatsApp message (valid 24 hours), or reply NO there to decline. Your handyman can continue at the original price.',
  },
};

const AdjustmentResultNotice = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const result = searchParams.get('adjustment');
  const message = MESSAGES[result];
  if (!message) return null;

  // Only a short id is ever in the URL; strip anything unexpected.
  const jobShortId = String(searchParams.get('job') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);

  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('adjustment');
    next.delete('job');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="adjustment-result-title">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 text-center">
        <span className={`material-symbols-outlined text-5xl ${message.iconClass}`}>{message.icon}</span>
        <h2 id="adjustment-result-title" className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
          {message.title}
        </h2>
        {jobShortId && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Job #{jobShortId}</p>
        )}
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{message.body}</p>
        <button
          type="button"
          onClick={close}
          className="mt-6 w-full h-12 bg-primary text-gray-900 font-bold rounded-xl hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default AdjustmentResultNotice;
