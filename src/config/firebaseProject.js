/**
 * Firebase project configuration (single source of truth).
 *
 * Everything project-bound — Cloud Functions URLs, the hosting domain,
 * Firebase Console deep links — is DERIVED here from the project ID
 * rather than hardcoded across the codebase. Switching to a different
 * Firebase project (e.g. moving from a personal dev project to the
 * company's production project) is then a `.env` change, not a
 * find-and-replace through source files.
 *
 * Inputs (all REACT_APP_* so Create React App exposes them to the
 * bundle — none of these are secret; the project ID and region are
 * public by nature):
 *   REACT_APP_FIREBASE_PROJECT_ID  — e.g. "eazydone-d06cf"
 *   REACT_APP_FUNCTIONS_REGION     — e.g. "us-central1" (optional)
 *
 * The fallbacks below keep the current dev project working if the env
 * vars are ever missing, but production deploys should always set
 * REACT_APP_FIREBASE_PROJECT_ID explicitly.
 */

const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'eazydone-d06cf';
const FUNCTIONS_REGION = process.env.REACT_APP_FUNCTIONS_REGION || 'us-central1';

export const projectConfig = {
  /** The Firebase / GCP project ID. */
  projectId: PROJECT_ID,

  /** Region the Cloud Functions are deployed to. */
  functionsRegion: FUNCTIONS_REGION,

  /**
   * Base URL for HTTP Cloud Functions (gen-1 onRequest style).
   * Append `/<functionName>` to call a specific function.
   */
  functionsBaseUrl: `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net`,

  /** Firebase Hosting URL for this project. */
  hostingUrl: `https://${PROJECT_ID}.web.app`,

  /** Firebase Console root for this project (for admin deep links). */
  firebaseConsoleUrl: `https://console.firebase.google.com/project/${PROJECT_ID}`,
};

export default projectConfig;
