/**
 * useSessionTimeout Hook
 *
 * Implements two industry-standard session security mechanisms:
 *
 * 1. **Idle Timeout** (30 minutes) — Monitors user activity (mouse, keyboard,
 *    touch, scroll). If no activity is detected within the timeout window,
 *    the user is automatically logged out.
 *
 * 2. **Absolute Timeout** (24 hours) — Regardless of activity, the session
 *    expires after a fixed duration from the initial login. This prevents
 *    indefinite sessions even for active users.
 *
 * Login timestamps are stored in sessionStorage so they also clear when
 * the browser is fully closed — an additional layer of session hygiene.
 *
 * @see OWASP Session Management Cheat Sheet
 */

import { useEffect, useRef, useCallback } from 'react';

// Session timeout configuration (in milliseconds)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours max session
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
const SESSION_LOGIN_KEY = 'session_login_timestamp';

// User activity events to monitor for idle timeout
const ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'mousemove'
];

/**
 * Hook to manage session timeouts (idle + absolute)
 * @param {Object} options
 * @param {Function} options.onTimeout - Callback when session expires (should trigger logout)
 * @param {boolean} options.isAuthenticated - Whether the user is currently logged in
 * @param {boolean} options.isAnonymous - Whether the user is an anonymous customer
 */
const useSessionTimeout = ({ onTimeout, isAuthenticated, isAnonymous = false }) => {
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef(null);
  const hasTimedOutRef = useRef(false);

  /**
   * Record the login timestamp when the user first authenticates.
   * Uses sessionStorage so it clears when the browser is fully closed.
   */
  const recordLoginTimestamp = useCallback(() => {
    if (!sessionStorage.getItem(SESSION_LOGIN_KEY)) {
      sessionStorage.setItem(SESSION_LOGIN_KEY, Date.now().toString());
    }
  }, []);

  /**
   * Clear the login timestamp on logout or timeout
   */
  const clearLoginTimestamp = useCallback(() => {
    sessionStorage.removeItem(SESSION_LOGIN_KEY);
  }, []);

  /**
   * Update the last activity timestamp on user interaction
   */
  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /**
   * Check if either timeout has been exceeded and trigger logout
   */
  const checkTimeouts = useCallback(() => {
    // Prevent multiple timeout triggers
    if (hasTimedOutRef.current) return;

    const now = Date.now();

    // Check idle timeout — has the user been inactive too long?
    const idleTime = now - lastActivityRef.current;
    if (idleTime >= IDLE_TIMEOUT_MS) {
      console.warn(`Session expired: idle for ${Math.round(idleTime / 60000)} minutes`);
      hasTimedOutRef.current = true;
      clearLoginTimestamp();
      onTimeout('idle');
      return;
    }

    // Check absolute timeout — has the session exceeded max duration?
    const loginTimestamp = sessionStorage.getItem(SESSION_LOGIN_KEY);
    if (loginTimestamp) {
      const sessionDuration = now - parseInt(loginTimestamp, 10);
      if (sessionDuration >= ABSOLUTE_TIMEOUT_MS) {
        console.warn(`Session expired: active for ${Math.round(sessionDuration / 3600000)} hours`);
        hasTimedOutRef.current = true;
        clearLoginTimestamp();
        onTimeout('absolute');
        return;
      }
    }
  }, [onTimeout, clearLoginTimestamp]);

  useEffect(() => {
    // Skip timeout management for unauthenticated or anonymous users
    // Anonymous customers have short-lived, single-task sessions
    if (!isAuthenticated || isAnonymous) {
      return;
    }

    // Record login time for absolute timeout tracking
    recordLoginTimestamp();
    hasTimedOutRef.current = false;

    // Attach activity listeners for idle timeout detection
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Start periodic timeout checks
    intervalRef.current = setInterval(checkTimeouts, ACTIVITY_CHECK_INTERVAL_MS);

    // Cleanup on unmount or when auth state changes
    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, isAnonymous, recordLoginTimestamp, handleUserActivity, checkTimeouts]);

  // Clear login timestamp when user logs out normally
  useEffect(() => {
    if (!isAuthenticated) {
      clearLoginTimestamp();
      hasTimedOutRef.current = false;
    }
  }, [isAuthenticated, clearLoginTimestamp]);

  return {
    /** Reset the idle timer (useful after re-authentication) */
    resetIdleTimer: handleUserActivity,
    /** Clear session data (call on explicit logout) */
    clearSession: clearLoginTimestamp
  };
};

export default useSessionTimeout;
