import React from 'react';
import { Link } from 'react-router-dom';

/**
 * BrandLogo
 *
 * The EasyDoneHandyman wordmark + hammer icon, defined in exactly one place
 * and reused by the public Header, the HandymanHeader, and the Footer.
 *
 * Mobile-friendly by default: `min-w-0` + `truncate` let the brand text shrink
 * (rather than push sibling nav off-screen) on narrow phones, and the icon is
 * `shrink-0` so it never distorts.
 *
 * @param {object} props
 * @param {string}      [props.subtitle]   Optional small label after the name
 *                                          (e.g. "Handyman Portal"). Hidden on
 *                                          the smallest screens to save width.
 * @param {string|null} [props.to='/']      Router destination. Pass `null` to
 *                                          render a non-interactive <div>
 *                                          (used in the Footer).
 * @param {string}      [props.className]   Extra classes for the root element.
 */
const BrandLogo = ({ subtitle, to = '/', className = '' }) => {
  const content = (
    <>
      <svg className="h-8 w-8 shrink-0 text-primary" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
      </svg>
      <div className="min-w-0 flex items-baseline">
        <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
          EasyDoneHandyman
        </span>
        {subtitle && (
          <span className="hidden sm:inline ml-2 shrink-0 text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </span>
        )}
      </div>
    </>
  );

  const baseClass = `flex items-center gap-2 min-w-0 ${className}`.trim();

  // Footer renders a plain (non-linked) mark; headers link to home.
  if (to === null) {
    return <div className={baseClass}>{content}</div>;
  }

  return (
    <Link to={to} className={`${baseClass} hover:opacity-80 transition-opacity`}>
      {content}
    </Link>
  );
};

export default BrandLogo;
