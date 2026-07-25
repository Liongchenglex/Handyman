/**
 * Schedule-link service (lifecycle spec §3 F6).
 *
 * The /pick-time page is the only truly public page in the app: the
 * customer has no account, so the link token in the URL is the whole
 * credential and every call here is validated server-side. No Firebase
 * auth is attached to the two token-gated calls; sendScheduleLink is
 * the admin-only counterpart used by the Active-jobs table.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/**
 * Load the minimal job context for a pick-time link.
 * @returns {Promise<{success: boolean, job?: object, error?: string, code?: string}>}
 */
export const getScheduleLinkContext = async (token) => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getScheduleLinkContext`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'This link could not be opened.', code: result.code };
    }
    return { success: true, job: result.job };
  } catch (error) {
    console.error('❌ Error loading schedule link:', error);
    return { success: false, error: 'Could not load this link. Please check your connection and try again.' };
  }
};

/**
 * Submit the customer's picked visit time.
 * @returns {Promise<{success: boolean, error?: string, code?: string}>}
 */
export const submitSchedulePick = async (token, date, time, note = '') => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/submitSchedulePick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, date, time, note }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Could not submit your pick. Please try again.', code: result.code };
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Error submitting schedule pick:', error);
    return { success: false, error: 'Could not submit your pick. Please check your connection and try again.' };
  }
};

/**
 * Admin: send the customer a fresh pick-time link for a job.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendScheduleLink = async (jobId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/sendScheduleLink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Could not send the link. Please try again.' };
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending schedule link:', error);
    return { success: false, error: 'Could not send the link. Please check your connection and try again.' };
  }
};
