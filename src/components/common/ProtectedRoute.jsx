import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Route guard for authenticated / admin-only pages.
 *
 * Wraps a route element and short-circuits rendering when the current
 * user doesn't satisfy the access requirements. Without this guard,
 * lazy-loaded admin chunks ship to any visitor who guesses the URL —
 * the existing per-page UI gates fire AFTER the chunk has already been
 * fetched and the page-level data hooks have run. The route guard
 * stops that earlier.
 *
 * Backend Cloud Functions still verify admin access independently;
 * this guard is defense-in-depth, not a replacement for server checks.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The protected route element.
 * @param {boolean} [props.requireAdmin=false] - Require admin allow-list match.
 * @param {string} [props.loginRedirect='/handyman-auth'] - Where to send
 *        unauthenticated visitors. Admin pages and handyman pages share
 *        the same auth screen.
 */
const ProtectedRoute = ({ children, requireAdmin = false, loginRedirect = '/handyman-auth' }) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    // Preserve the attempted URL so the auth page can bounce back here
    // after a successful sign-in.
    return <Navigate to={loginRedirect} replace state={{ from: location.pathname + location.search }} />;
  }

  if (requireAdmin && !isAdmin) {
    // Authenticated but not an admin — send to home rather than the
    // login page (logging in as a different account won't help).
    // `isAdmin` comes from the Firebase Auth custom claim (set via
    // scripts/grant-admin.js or the setAdminClaim Cloud Function),
    // with a transitional email fallback in AuthContext.
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
