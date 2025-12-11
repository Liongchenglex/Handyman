/**
 * Environment Configuration
 *
 * This module provides environment-aware configuration for the application.
 * It automatically detects the current environment and provides the appropriate settings.
 *
 * Environments:
 * - development: Local development (localhost)
 * - production: Deployed production (firebase hosting)
 *
 * @module config/environment
 */

/**
 * Detect the current environment based on hostname and NODE_ENV
 * @returns {'development' | 'production'}
 */
export const getEnvironment = () => {
  // Check if explicitly set via environment variable
  if (process.env.REACT_APP_ENVIRONMENT) {
    return process.env.REACT_APP_ENVIRONMENT;
  }

  // Auto-detect based on hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Production: Firebase hosting domain
    if (hostname === 'eazydone-d06cf.web.app' || hostname === 'eazydone-d06cf.firebaseapp.com') {
      return 'production';
    }

    // Development: localhost or local IP
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'development';
    }
  }

  // Fallback to NODE_ENV
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
};

/**
 * Check if currently in development environment
 * @returns {boolean}
 */
export const isDevelopment = () => getEnvironment() === 'development';

/**
 * Check if currently in production environment
 * @returns {boolean}
 */
export const isProduction = () => getEnvironment() === 'production';

/**
 * Get the Firestore database ID based on environment
 * @returns {string} Database ID ('(default)' for production, 'devs' for development)
 */
export const getFirestoreDatabase = () => {
  return isProduction() ? '(default)' : 'devs';
};

/**
 * Get the base URL for approval links based on environment
 * @returns {string} The base URL for approval links
 */
export const getApprovalBaseUrl = () => {
  if (isProduction()) {
    return 'https://eazydone-d06cf.web.app/admin/approve-handyman';
  }
  return 'http://localhost:3000/admin/approve-handyman';
};

/**
 * Get environment-specific configuration
 * @returns {object} Configuration object for current environment
 */
export const getConfig = () => {
  const env = getEnvironment();

  return {
    environment: env,
    isDevelopment: isDevelopment(),
    isProduction: isProduction(),
    database: getFirestoreDatabase(),
    approvalBaseUrl: getApprovalBaseUrl(),
    apiUrl: isProduction()
      ? 'https://us-central1-eazydone-d06cf.cloudfunctions.net'
      : 'http://localhost:5001/eazydone-d06cf/us-central1',

    // Feature flags (can be used to enable/disable features per environment)
    features: {
      // Enable debug logging in development
      debugLogging: isDevelopment(),
      // Enable analytics in production
      analytics: isProduction(),
      // Enable Stripe test mode (keeping test for both environments as requested)
      stripeTestMode: true,
    }
  };
};

/**
 * Log environment information (useful for debugging)
 */
export const logEnvironmentInfo = () => {
  if (isDevelopment()) {
    const config = getConfig();
    console.log('🔧 Environment Configuration:', {
      environment: config.environment,
      database: config.database,
      approvalBaseUrl: config.approvalBaseUrl,
      features: config.features,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A'
    });
  }
};

// Auto-log on import in development
if (isDevelopment() && typeof window !== 'undefined') {
  logEnvironmentInfo();
}

// Default export
export default {
  getEnvironment,
  isDevelopment,
  isProduction,
  getFirestoreDatabase,
  getApprovalBaseUrl,
  getConfig,
  logEnvironmentInfo
};
