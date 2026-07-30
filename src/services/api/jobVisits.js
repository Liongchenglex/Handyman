/**
 * Second-visit + visit-issue service — Scenario 11 / Scenario 8.
 *
 * Both actions go through Cloud Functions (never direct Firestore
 * writes): the server owns visits[]/accessIssues[], the customer
 * WhatsApp prompts, and the attention-queue flags. See
 * docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md.
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

/** Values MUST match SECOND_VISIT_REASONS in functions/visitService.js. */
export const SECOND_VISIT_REASON_OPTIONS = [
  { value: 'parts_materials', label: 'Waiting on parts / materials' },
  { value: 'job_bigger_than_expected', label: 'Job is bigger than expected' },
  { value: 'customer_request', label: 'Customer asked for another visit' },
  { value: 'other', label: 'Other (please describe)' },
];

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

/** Ask the customer to approve a return visit (opens a WhatsApp prompt). */
export const requestSecondVisit = (jobId, proposedDate, proposedTime, reason, note = '') =>
  post('requestSecondVisit', { jobId, proposedDate, proposedTime, reason, note },
    'Could not send the second-visit request. Please try again.');

/** Report no access / cannot finish. kind: 'no_access' | 'cannot_finish'. */
export const reportVisitIssue = (jobId, kind, note = '') =>
  post('reportVisitIssue', { jobId, kind, note },
    'Could not send the report. Please try again.');
