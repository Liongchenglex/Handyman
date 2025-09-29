import { 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { auth } from './config';

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