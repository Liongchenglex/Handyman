import React from 'react';

/**
 * LoadingSpinner
 *
 * Two modes:
 *  - size="small"  → a bare spinning circle, for inline use INSIDE
 *    buttons. No centered container, no message text.
 *  - size="medium" | "large" (default) → a centered panel with the
 *    spinner and a message, for full-page / section loading states.
 *
 * The styles live in src/styles/globals.css (.spinner, .spinner-*,
 * .loading-container, .loading-message). Note: the small/inline mode
 * deliberately omits .loading-container — its 2rem padding and column
 * layout would balloon any button it's dropped into.
 */
const LoadingSpinner = ({ size = 'medium', message = 'Loading...' }) => {
  if (size === 'small') {
    return <div className="spinner spinner-small" role="status" aria-label="Loading"></div>;
  }

  const sizeClass = size === 'large' ? 'spinner-large' : 'spinner-medium';

  return (
    <div className="loading-container">
      <div className={`spinner ${sizeClass}`}></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
