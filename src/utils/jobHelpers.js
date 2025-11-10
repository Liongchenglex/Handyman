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
    case 'accepted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'pending_confirmation':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
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
    case 'accepted':
      return 'Accepted';
    case 'in_progress':
      return 'In Progress';
    case 'pending_confirmation':
      return 'Awaiting Confirmation';
    case 'completed':
      return 'Completed';
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
