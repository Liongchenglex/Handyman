/**
 * Price adjustment service — Task 7 (no-show / price adjustment flow).
 *
 * Requesting an adjustment goes through a Cloud Function (never a direct
 * Firestore write): the server owns `job.priceAdjustment`, the cap check
 * against the service's price range, and the customer's Stripe approval
 * link. See docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

const post = async (path, body, failMessage) => {
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
      return { success: false, error: result.error || failMessage, code: result.code };
    }
    return result;
  } catch (error) {
    console.error(`❌ ${path} failed:`, error);
    return { success: false, error: 'Request failed. Please check your connection and try again.' };
  }
};

/** Ask the customer to approve a price adjustment by paying the delta. */
export const requestPriceAdjustment = (jobId, deltaDollars, reason, note = '') =>
  post('requestPriceAdjustment', { jobId, deltaDollars, reason, note },
    'Could not send the adjustment request. Please try again.');
