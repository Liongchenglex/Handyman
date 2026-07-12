/**
 * Job schedule service — handyman-side time proposals.
 *
 * Proposals go through the proposeSchedule Cloud Function (never a
 * direct Firestore write): the server owns the customer WhatsApp
 * prompt and the F4 single-writer schedule change that keeps the
 * completion poll and date gate honest. See the lifecycle spec §3/§4.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/**
 * Propose a (new) visit time for a job the current handyman owns.
 *
 * @param {string} jobId
 * @param {string} proposedDate - ISO date (yyyy-mm-dd)
 * @param {string} proposedTime - display time string, e.g. "2:00 PM"
 * @param {string} note - optional, shown to the customer
 * @returns {Promise<{success: boolean, error?: string, code?: string, promptId?: string}>}
 */
export const proposeSchedule = async (jobId, proposedDate, proposedTime, note = '') => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/proposeSchedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId, proposedDate, proposedTime, note }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Could not send the proposal. Please try again.', code: result.code };
    }
    return { success: true, promptId: result.promptId };
  } catch (error) {
    console.error('❌ Error proposing schedule:', error);
    return { success: false, error: 'Could not send the proposal. Please check your connection and try again.' };
  }
};
