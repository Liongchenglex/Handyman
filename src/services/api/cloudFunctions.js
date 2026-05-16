/**
 * Cloud Functions client helper.
 *
 * Centralises the base URL and Bearer-token attachment so we don't
 * repeat the same fetch wiring across feature modules. Every call
 * includes the current user's Firebase ID token; backend functions
 * verify it via verifyAuthToken().
 */

import { auth } from '../firebase/config';
import { projectConfig } from '../../config/firebaseProject';

// Region/project-bound base URL, derived from the configured Firebase
// project (see src/config/firebaseProject.js). Switching projects is a
// .env change — no edit needed here.
const FUNCTIONS_BASE_URL = projectConfig.functionsBaseUrl;

class CloudFunctionError extends Error {
  constructor(message, { status, payload }) {
    super(message);
    this.name = 'CloudFunctionError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Call a Cloud Function by name with optional JSON body.
 *
 * @param {string} fnName - The exported function name (must match exports.<fnName>).
 * @param {object} [body] - JSON body. Omit for GET-style calls (POST with empty body is also fine).
 * @param {object} [opts]
 * @param {boolean} [opts.requireAuth=true] - When false, sends no Authorization header.
 * @returns {Promise<object>} - Parsed JSON response.
 * @throws {CloudFunctionError} - For non-2xx responses; .status and .payload available.
 */
export const callFunction = async (fnName, body = {}, opts = {}) => {
  const { requireAuth = true } = opts;

  const headers = { 'Content-Type': 'application/json' };
  if (requireAuth) {
    const user = auth.currentUser;
    if (!user) {
      throw new CloudFunctionError('Not authenticated', { status: 401, payload: null });
    }
    const idToken = await user.getIdToken();
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch(`${FUNCTIONS_BASE_URL}/${fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let payload = null;
  try { payload = await response.json(); } catch (_) { /* non-JSON body */ }

  if (!response.ok) {
    const message = (payload && (payload.error || payload.message)) || `Cloud Function ${fnName} failed with ${response.status}`;
    throw new CloudFunctionError(message, { status: response.status, payload });
  }

  return payload || {};
};

export { CloudFunctionError, FUNCTIONS_BASE_URL };
