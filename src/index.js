import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSentry } from './services/sentry';
// Build-time Tailwind + globals. Pulling the stylesheet through index.js
// is what causes Create React App to emit a static CSS bundle, replacing
// the old <script src="cdn.tailwindcss.com"> tag in public/index.html
// (which was unversioned and would break a strict CSP).
import './styles/globals.css';

// Wire up error tracking before anything else so init-time crashes are caught.
// No-op if REACT_APP_SENTRY_DSN isn't set.
initSentry();

// In production builds, silence informational console output (log/info/debug/
// trace) so the rest of the codebase can keep its development-time logs
// without leaking noise — and source structure — into end-user devtools.
// We deliberately preserve console.warn and console.error so genuine problems
// still surface and any error-tracking SDK (Sentry, Crashlytics) can pick
// them up via console hooks.
if (process.env.NODE_ENV === 'production') {
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
  // eslint-disable-next-line no-console
  console.trace = noop;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
