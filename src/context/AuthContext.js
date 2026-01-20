import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChange,
  createAnonymousUser,
  signOutUser
} from '../services/firebase/auth';
import { getHandyman } from '../services/firebase/collections';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        try {
          // Anonymous users (customers) don't have Firestore profiles
          if (firebaseUser.isAnonymous) {
            setUser(firebaseUser);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          // For non-anonymous users, fetch handyman profile
          // (handymen collection is the only collection we use now)
          try {
            const handymanProfile = await getHandyman(firebaseUser.uid);

            // Use handyman profile as main profile
            const profileWithRole = {
              ...handymanProfile,
              role: 'handyman' // Ensure role is set
            };

            setUser(firebaseUser);
            setUserProfile(profileWithRole);
            setLoading(false);
            return;
          } catch (error) {
            // If not found in handymen collection, user might be incomplete registration
            if (error.message === 'Document not found') {
              setUser(firebaseUser);
              setUserProfile(null);
              setLoading(false);
              return;
            }
            throw error;
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUser(firebaseUser);
          setUserProfile(null);
        }
      } else {
        // User is signed out
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isHandyman: userProfile?.role === 'handyman',
    isCustomer: userProfile?.role === 'customer'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};