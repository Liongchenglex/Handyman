import React from 'react';
import { Sentry } from '../../services/sentry';

/**
 * Top-level React error boundary.
 *
 * Catches render-time exceptions anywhere in the component tree below it and
 * shows a user-visible fallback instead of letting the app crash to a blank
 * white screen. Async/event-handler errors are NOT caught by error boundaries
 * (React limitation) and must still be handled with try/catch in those code
 * paths.
 *
 * In development, the original error is shown to aid debugging. In production
 * we show a generic message; the error is sent to the console for capture by
 * any error-tracking service that hooks into it.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error:', error, errorInfo);
    // If Sentry is configured (REACT_APP_SENTRY_DSN set), forward the error
    // with the React component stack so we can debug from the dashboard.
    // No-op when the DSN isn't set, so this is safe in dev.
    if (Sentry?.captureException) {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo?.componentStack } },
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">
              error
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            We hit an unexpected error. You can reload the page or head back to the
            homepage. If this keeps happening, please contact support.
          </p>

          {isDev && this.state.error && (
            <pre className="text-left text-xs bg-gray-100 dark:bg-gray-900 text-red-700 dark:text-red-300 rounded-lg p-3 mb-4 overflow-auto max-h-48">
              {this.state.error.toString()}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload page
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
