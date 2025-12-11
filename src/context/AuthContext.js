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
        // User is signed in, fetch their handyman profile
        // (No separate users collection - all data in handymen collection)
        try {
          const handymanProfile = await getHandyman(firebaseUser.uid);

          if (handymanProfile) {
            setUser(firebaseUser);
            setUserProfile({
              ...handymanProfile,
              handyman: handymanProfile // Keep nested structure for backwards compatibility
            });
          } else {
            // User exists in Firebase Auth but not in Firestore (incomplete registration)
            console.warn('User authenticated but no handyman profile found');
            setUser(firebaseUser);
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching handyman profile:', error);
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
      {children}
    </AuthContext.Provider>
  );
};