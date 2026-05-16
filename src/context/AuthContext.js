import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChange,
  createAnonymousUser,
  signOutUser
} from '../services/firebase/auth';
import { getHandyman } from '../services/firebase/collections';
import useSessionTimeout from '../hooks/useSessionTimeout';
import { isAdminUser as isAdminEmailFallback } from '../config/admins';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Admin status from Firebase Auth custom claim (`admin: true`).
  // The token-claim check is authoritative; the email allow-list is
  // a transitional fallback until every admin has been migrated via
  // scripts/grant-admin.js + the setAdminClaim Cloud Function.
  const [isAdmin, setIsAdmin] = useState(false);

  /**
   * Handle session timeout — logs the user out and sets
   * a flag so the UI can show an appropriate message.
   * @param {'idle'|'absolute'} reason - Why the session expired
   */
  const handleSessionTimeout = useCallback(async (reason) => {
    console.warn(`Session timeout triggered: ${reason}`);
    try {
      await signOutUser();
      setSessionExpired(true);
    } catch (error) {
      console.error('Error during session timeout logout:', error);
    }
  }, []);

  // Session timeout management (idle: 30 min, absolute: 24 hours)
  const { clearSession } = useSessionTimeout({
    onTimeout: handleSessionTimeout,
    isAuthenticated: !!user,
    isAnonymous: user?.isAnonymous || false
  });

  // Resolve admin status from the user's ID token claims. Falls back
  // to the transitional email allow-list when no claim is present so
  // existing admins don't lock themselves out before bootstrap.
  const resolveAdminStatus = useCallback(async (firebaseUser) => {
    if (!firebaseUser || firebaseUser.isAnonymous) return false;
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      if (tokenResult.claims && tokenResult.claims.admin === true) return true;
    } catch (err) {
      console.error('Failed to read ID token claims:', err);
    }
    return isAdminEmailFallback(firebaseUser);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        try {
          // Anonymous users (customers) don't have Firestore profiles
          if (firebaseUser.isAnonymous) {
            setUser(firebaseUser);
            setUserProfile(null);
            setIsAdmin(false);
            setLoading(false);
            return;
          }

          // Resolve admin status in parallel with the profile fetch so
          // ProtectedRoute doesn't briefly redirect an admin to home
          // while the token claim is still loading.
          const [adminResolved, handymanProfile] = await Promise.all([
            resolveAdminStatus(firebaseUser),
            getHandyman(firebaseUser.uid).catch((err) => {
              if (err.message === 'Document not found') return null;
              throw err;
            }),
          ]);

          setIsAdmin(adminResolved);
          setUser(firebaseUser);
          setUserProfile(
            handymanProfile ? { ...handymanProfile, role: 'handyman' } : null
          );
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUser(firebaseUser);
          setUserProfile(null);
          setIsAdmin(await resolveAdminStatus(firebaseUser));
        }
      } else {
        // User is signed out
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [resolveAdminStatus]);

  const login = async (userData) => {
    try {
      const user = await createAnonymousUser(userData);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      clearSession(); // Clear session timeout data on explicit logout
      await signOutUser();
      setSessionExpired(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  /** Clear the session expired flag (e.g., after user acknowledges the message) */
  const clearSessionExpired = () => setSessionExpired(false);

  const value = {
    user,
    userProfile,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isHandyman: userProfile?.role === 'handyman',
    isCustomer: userProfile?.role === 'customer',
    isAdmin,              // Derived from Firebase Auth custom claim
    sessionExpired,       // True when auto-logged out due to timeout
    clearSessionExpired   // Call to dismiss the session expired state
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};