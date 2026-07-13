/**
 * Admin attention-queue service (lifecycle spec Scenario 12 / F5).
 *
 * Thin authed wrappers over the admin forcing-action endpoints. All of
 * them require the caller's Firebase user to hold the admin claim; the
 * server re-verifies. Never throws — {success, error?} shape, matching
 * jobSchedule.js / scheduleLink.js.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

const post = async (path, body) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not authenticated' };
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Request failed. Please try again.' };
    }
    return { success: true, ...result };
  } catch (error) {
    console.error(`❌ Error calling ${path}:`, error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

export const resolveAttention = (jobId, { markCancelled = false } = {}) =>
  post('resolveAttention', { jobId, markCancelled });

export const adminSetSchedule = (jobId, newDate, newTime, note = '') =>
  post('adminSetSchedule', { jobId, newDate, newTime, note });

export const adminUnassignJob = (jobId, note = '') =>
  post('adminUnassignJob', { jobId, note });

/**
 * Refund via the EXISTING refundPayment endpoint (it already authorizes
 * admins and handles transfer reversal). The caller follows up with
 * resolveAttention(jobId, {markCancelled: true}) on success.
 */
export const adminRefundJob = (paymentIntentId) =>
  post('refundPayment', { paymentIntentId, reason: 'requested_by_customer' });
