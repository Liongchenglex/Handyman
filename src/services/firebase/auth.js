/**
 * Firebase Authentication Service
 *
 * Handles all authentication operations including:
 * - Email/Password authentication for handymen
 * - Anonymous authentication for customers
 * - User profile management
 */

import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './config';
import { createUser, createHandyman, getUser } from './collections';

// ==================== HANDYMAN AUTHENTICATION ====================

/**
 * Register a new handyman with email and password
 * @param {Object} registrationData - Registration details
 * @param {string} registrationData.email - Email address
 * @param {string} registrationData.password - Password (min 6 characters)
 * @param {string} registrationData.name - Full name
 * @param {string} registrationData.phone - Phone number
 * @param {Array<string>} registrationData.serviceTypes - Services offered
 * @param {string} registrationData.experience - Years of experience
 * @param {string} registrationData.bio - Short bio/description
 * @returns {Promise<Object>} Created user and handyman profile
 */
export const registerHandyman = async (registrationData) => {
  try {
    const { email, password, name, phone, serviceTypes, experience, bio } = registrationData;

    // Validate required fields
    if (!email || !password || !name || !phone) {
      throw new Error('Email, password, name, and phone are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Create Firebase auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase auth profile
    await updateProfile(user, {
      displayName: name
    });

    // Create user document in Firestore
    await createUser(user.uid, {
      email: email,
      name: name,
      phone: phone,
      role: 'handyman'
    });

    // Create handyman profile document
    await createHandyman(user.uid, {
      name: name,
      email: email,
      phone: phone,
      serviceTypes: serviceTypes || [],
      experience: experience || '',
      bio: bio || '',
      verified: false,
      isAvailable: true,
      rating: 0,
      totalJobs: 0
    });

    // Note: Email acknowledgment will be sent after full registration is complete
    // See HandymanRegistration.jsx -> sendRegistrationEmails()

    return {
      user: user,
      profile: {
        uid: user.uid,
        email: email,
        name: name,
        role: 'handyman'
      }
    };
  } catch (error) {
    console.error('Error registering handyman:', error);

    // Provide user-friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please sign in instead.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    }

    throw error;
  }
};

/**
 * Sign in handyman with email and password
 * @param {string} email - Email address
 * @param {string} password - Password
 * @returns {Promise<Object>} User object with profile
 */
export const signInHandyman = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Try to get user profile from Firestore
    let userProfile;
    try {
      userProfile = await getUser(user.uid);
    } catch (error) {
      // If document doesn't exist, user needs to complete registration
      if (error.message.includes('Document not found')) {
        await signOut(auth);
        throw new Error('Account registration incomplete. Please complete the registration process.');
      }
      throw error;
    }

    if (!userProfile) {
      await signOut(auth);
      throw new Error('Account registration incomplete. Please complete the registration process.');
    }

    if (userProfile.role !== 'handyman') {
      // Sign out if not a handyman
      await signOut(auth);
      throw new Error('This account is not registered as a handyman.');
    }

    return {
      user: user,
      profile: userProfile
    };
  } catch (error) {
    console.error('Error signing in:', error);

    if (error.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password.');
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please try again later.');
    }

    throw error;
  }
};

// ==================== CUSTOMER AUTHENTICATION ====================

/**
 * Create anonymous user for customers (no registration required)
 * @param {Object} userData - Customer data
 * @param {string} userData.name - Customer name
 * @param {string} userData.email - Customer email
 * @param {string} userData.phone - Customer phone
 * @returns {Promise<Object>} Anonymous user
 */
export const createAnonymousUser = async (userData) => {
  try {
    const result = await signInAnonymously(auth);
    
    // Update the user profile with provided data
    if (userData.name) {
      await updateProfile(result.user, {
        displayName: userData.name
      });
    }
    
    return result.user;
  } catch (error) {
    console.error('Error creating anonymous user:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is logged in
 */
export const isAuthenticated = () => {
  return auth.currentUser !== null;
};

/**
 * Get current user's role
 * @returns {Promise<string|null>} User role (handyman, customer, admin) or null
 */
export const getCurrentUserRole = async () => {
  const user = getCurrentUser();
  if (!user) return null;

  try {
    const userProfile = await getUser(user.uid);
    return userProfile?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

/**
 * Send password reset email
 * @param {string} email - Email address
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);

    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    }

    throw error;
  }
};