/**
 * Sentry initialization.
 *
 * Sentry is wired up so that any uncaught error or unhandled rejection in the
 * app — plus errors caught by our top-level ErrorBoundary — gets surfaced
 * with a stack trace, breadcrumb trail, and request context. Without this,
 * production errors disappear into the user's devtools and we never see them.
 *
 * Configuration is driven by env vars so we don't ship a hard-coded DSN:
 *   REACT_APP_SENTRY_DSN   - issued by Sentry when you create the project.
 *                            If unset (e.g. local dev), Sentry is a no-op.
 *   REACT_APP_RELEASE      - optional; tags events with the deployed release.
 *
 * To activate: create a Sentry project (free tier is fine for launch),
 * grab the DSN from "Settings → Client Keys (DSN)", and add
 *   REACT_APP_SENTRY_DSN=https://...@sentry.io/...
 * to .env.production.local before building.
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  if (initialized) return;

  const dsn = process.env.REACT_APP_SENTRY_DSN;

  // No DSN configured -> stay a no-op. This is the expected state in
  // local development and during the period before the user creates
  // a Sentry project; we don't want noisy console errors for it.
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.REACT_APP_RELEASE || undefined,

    // Sample 10% of transactions for performance monitoring. Enough to
    // spot a regression without burning the free-tier quota.
    tracesSampleRate: 0.1,

    // Don't replay sessions by default — replays cost more events and
    // can capture sensitive marketplace data (addresses, phone numbers).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Strip out anything that looks like a Stripe key or Firebase
    // service-account block before it leaves the browser.
    beforeSend(event) {
      const json = JSON.stringify(event);
      if (/sk_live_|sk_test_|whsec_|"private_key"/.test(json)) {
        return null;
      }
      return event;
    },
  });

  initialized = true;
}

// Re-export the module so callers (e.g. ErrorBoundary) can call
// Sentry.captureException directly without a separate import.
export { Sentry };
