/**
 * Job Helper Utilities
 *
 * Common utility functions for job-related operations
 * Used across JobCard, JobBoard, MyJobsView, etc.
 */

/**
 * Format date to readable string
 */
export const formatDate = (date) => {
  if (!date) return 'Flexible';
  return new Date(date).toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Get color class for urgency badge
 */
export const getUrgencyColor = (urgency) => {
  return urgency === 'urgent'
    ? 'text-red-600 dark:text-red-400'
    : 'text-gray-600 dark:text-gray-400';
};

/**
 * Get urgency badge component
 */
export const getUrgencyBadge = (urgency) => {
  return urgency === 'urgent' ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
      <span className="material-symbols-outlined text-xs">emergency</span>
      Urgent
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
      Normal
    </span>
  );
};

/**
 * Get color class for job status badge
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'pending_confirmation':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'pending_admin_approval':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'disputed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

/**
 * Get human-readable status text
 */
export const getStatusText = (status) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'pending_confirmation':
      return 'Awaiting Confirmation';
    case 'pending_admin_approval':
      return 'Pending Fund Release';
    case 'completed':
      return 'Completed';
    case 'disputed':
      return 'Disputed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
};

/**
 * Format phone number for WhatsApp link
 */
export const formatPhoneForWhatsApp = (phone) => {
  return phone.replace(/[^0-9]/g, '');
};

/**
 * Job board "Date Needed" comparator (default board sort).
 *
 * Ordering (reassignment spec §7):
 *   1. ASAP/Immediate jobs first, newest-posted first among them —
 *      anything that isn't explicitly scheduled counts as ASAP.
 *   2. Scheduled jobs by soonest preferredDate.
 *   3. Scheduled jobs missing a date sink to the very end (unknown
 *      urgency shouldn't outrank a known near date).
 *
 * NaN safety: `new Date(x).getTime()` is NaN for missing/unparseable
 * values, and `Infinity - Infinity` is also NaN — either would make
 * Array.prototype.sort behave unpredictably. `timeOr` normalizes any
 * missing/unparseable value to an explicit fallback so the comparator
 * always returns a real number.
 */
export const compareByDateNeeded = (a, b) => {
  const isAsap = (job) => job.preferredTiming !== 'Schedule';
  // Millisecond timestamp for `value`, or `fallback` when the value is
  // missing or fails to parse — comparator must never return NaN.
  // Handles both ISO strings (preferredDate from the booking form) and
  // Firestore Timestamp objects (createdAt is written with
  // serverTimestamp() and arrives from subscriptions as a Timestamp,
  // which `new Date(...)` cannot parse).
  const timeOr = (value, fallback) => {
    if (value && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    const t = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(t) ? fallback : t;
  };

  if (isAsap(a) && isAsap(b)) {
    return timeOr(b.createdAt || b.postedAt, 0) - timeOr(a.createdAt || a.postedAt, 0);
  }
  if (isAsap(a)) return -1;
  if (isAsap(b)) return 1;

  const aTime = timeOr(a.preferredDate, Infinity);
  const bTime = timeOr(b.preferredDate, Infinity);
  if (aTime === bTime) return 0; // covers the both-Infinity (both missing/unparseable) case
  return aTime - bTime;
};
