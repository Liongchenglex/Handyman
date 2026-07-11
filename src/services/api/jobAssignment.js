/**
 * Job assignment service — handyman-side cancel.
 *
 * Cancelling goes through the cancelJobAssignment Cloud Function (never
 * a direct Firestore write): the server owns the assignment-history
 * audit trail, the customer WhatsApp notice, and the re-notification
 * fan-out. See docs/superpowers/specs/2026-07-10-job-reassignment-design.md.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/**
 * Reason picklist — keys MUST match CANCEL_REASONS in
 * functions/jobReassignment.js; labels are display-only.
 */
export const CANCEL_REASON_OPTIONS = [
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'job_bigger_than_expected', label: 'Job is bigger than expected' },
  { value: 'location_too_far', label: 'Location is too far' },
  { value: 'personal_emergency', label: 'Personal emergency' },
  { value: 'other', label: 'Other (please describe)' },
];

/**
 * Cancel the current user's assignment on a job.
 *
 * @param {string} jobId
 * @param {string} reason - a CANCEL_REASON_OPTIONS value
 * @param {string} note - required when reason is 'other'
 * @returns {Promise<{success: boolean, error?: string, code?: string, reassignmentCount?: number}>}
 */
export const cancelJobAssignment = async (jobId, reason, note = '') => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/cancelJobAssignment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId, reason, note }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Cancellation failed', code: result.code };
    }
    return { success: true, reassignmentCount: result.reassignmentCount };
  } catch (error) {
    console.error('❌ Error cancelling job assignment:', error);
    return { success: false, error: error.message };
  }
};
