/**
 * Firebase Connection Test Utility
 *
 * Use this to verify your Firebase setup is working correctly
 * Run this from browser console or add to a test component
 */

import { db, auth } from './config';
import { createAnonymousUser } from './auth';
import { createDocument, getDocument } from './firestore';

/**
 * Test Firebase configuration
 */
export const testFirebaseConfig = () => {
  console.log('=== Firebase Configuration Test ===');

  const config = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY ? ' Set' : ' Missing',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ? ' Set' : ' Missing',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID ? ' Set' : ' Missing',
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ? ' Set' : ' Missing',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ? ' Set' : ' Missing',
    appId: process.env.REACT_APP_FIREBASE_APP_ID ? ' Set' : ' Missing'
  };

  console.table(config);

  const allSet = Object.values(config).every(v => v === ' Set');
  if (allSet) {
    console.log(' All environment variables are set!');
  } else {
    console.error(' Some environment variables are missing. Check your .env.local file');
  }

  return allSet;
};

/**
 * Test Firebase Authentication
 */
export const testFirebaseAuth = async () => {
  console.log('\n=== Firebase Authentication Test ===');

  try {
    // Test anonymous sign-in
    console.log('Testing anonymous authentication...');
    const user = await createAnonymousUser({ name: 'Test User' });

    console.log(' Authentication successful!');
    console.log('User ID:', user.uid);
    console.log('User:', user);

    return { success: true, user };
  } catch (error) {
    console.error(' Authentication failed:', error.message);
    console.error('Full error:', error);
    return { success: false, error };
  }
};

/**
 * Test Firestore Database
 */
export const testFirestore = async () => {
  console.log('\n=== Firestore Database Test ===');

  try {
    // Create a test document
    console.log('Creating test document...');
    const testData = {
      test: true,
      message: 'Firebase connection test',
      timestamp: new Date().toISOString()
    };

    const docId = await createDocument('_test_connection', testData);
    console.log(' Document created with ID:', docId);

    // Read the document back
    console.log('Reading document back...');
    const doc = await getDocument('_test_connection', docId);
    console.log(' Document retrieved:', doc);

    return { success: true, docId, doc };
  } catch (error) {
    console.error(' Firestore test failed:', error.message);
    console.error('Full error:', error);

    if (error.message.includes('Missing or insufficient permissions')) {
      console.error('\n   Permission Error: You need to deploy Firestore rules first!');
      console.error('Run: firebase deploy --only firestore:rules');
    }

    return { success: false, error };
  }
};

/**
 * Run all tests
 */
export const runAllTests = async () => {
  console.log('=% Starting Firebase Connection Tests...\n');

  // Test 1: Configuration
  const configOk = testFirebaseConfig();
  if (!configOk) {
    console.error('\nL Configuration test failed. Fix environment variables first.');
    return;
  }

  // Test 2: Authentication
  const authResult = await testFirebaseAuth();
  if (!authResult.success) {
    console.error('\nL Authentication test failed.');
    return;
  }

  // Test 3: Firestore
  const firestoreResult = await testFirestore();
  if (!firestoreResult.success) {
    console.error('\nL Firestore test failed.');
    return;
  }

  console.log('\n All tests passed! Firebase is connected and working!');
  console.log('\n=Ý Next steps:');
  console.log('1. Deploy security rules: firebase deploy --only firestore:rules');
  console.log('2. You can now use Firebase in your app');
  console.log('3. Check Firebase Console to see the test data');

  return {
    config: configOk,
    auth: authResult,
    firestore: firestoreResult
  };
};

// Export for easy console access
if (typeof window !== 'undefined') {
  window.testFirebase = runAllTests;
  window.testFirebaseConfig = testFirebaseConfig;
  window.testFirebaseAuth = testFirebaseAuth;
  window.testFirestore = testFirestore;
}

export default {
  testFirebaseConfig,
  testFirebaseAuth,
  testFirestore,
  runAllTests
};
