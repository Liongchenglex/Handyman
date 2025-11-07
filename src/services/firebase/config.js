/**
 * Firebase Configuration and Initialization
 *
 * This module initializes Firebase and exports core service instances.
 * All environment variables must be set in .env.local file.
 *
 * @see FIREBASE_SETUP.md for detailed setup instructions
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Validate configuration
const validateConfig = () => {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingKeys = requiredKeys.filter(
    key => !firebaseConfig[key] || firebaseConfig[key].startsWith('your_')
  );

  if (missingKeys.length > 0) {
    console.error(
      'Firebase configuration error: Missing or invalid environment variables:',
      missingKeys.map(key => `REACT_APP_FIREBASE_${key.toUpperCase()}`)
    );
    console.error('Please check your .env.local file and refer to FIREBASE_SETUP.md');
  }
};

// Validate on load
validateConfig();

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // For better compatibility with some environments
  ignoreUndefinedProperties: true // Ignore undefined properties in documents
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// Export default app instance
export default app;