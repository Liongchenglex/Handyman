import React from 'react';

/**
 * TestJobBadge — marks prod test jobs (job.isTest, LAUNCH-CHECKLIST Phase 8)
 * on admin pages so a test job is never mistaken for a real customer's
 * when releasing funds or refunding. Renders nothing for real jobs.
 */
const TestJobBadge = ({ job, className = '' }) => {
  if (job?.isTest !== true) return null;
  return (
    <span
      className={`inline-block align-middle rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-xs font-bold text-purple-800 dark:text-purple-200 ${className}`}
      title="Test job — booked from a TEST_CUSTOMER_PHONES number; only test handymen can see it"
    >
      🧪 TEST
    </span>
  );
};

export default TestJobBadge;
