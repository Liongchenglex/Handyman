/**
 * Simple Authentication Test
 *
 * This file tests if Firebase Email/Password authentication is working
 * Import this temporarily in App.jsx to test
 */

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './services/firebase/config';
import { createUser, createHandyman } from './services/firebase/collections';

/**
 * Test 1: Create a test handyman account
 */
const testCreateHandyman = async () => {
  const testEmail = `testhandyman${Date.now()}@example.com`;
  const testPassword = 'Test123456';

  console.log('🧪 Test 1: Creating handyman account...');
  console.log('Email:', testEmail);
  console.log('Password:', testPassword);

  try {
    // Step 1: Create Firebase Auth user
    console.log('  → Creating Firebase Auth user...');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    console.log('  ✅ Firebase Auth user created:', userCredential.user.uid);

    // Step 2: Create Firestore user document
    console.log('  → Creating Firestore user document...');
    await createUser(userCredential.user.uid, {
      email: testEmail,
      name: 'Test Handyman',
      phone: '+6591234567',
      role: 'handyman',
      emailVerified: false
    });
    console.log('  ✅ User document created');

    // Step 3: Create Firestore handyman profile
    console.log('  → Creating handyman profile...');
    await createHandyman(userCredential.user.uid, {
      name: 'Test Handyman',
      email: testEmail,
      phone: '+6591234567',
      serviceTypes: ['Plumbing', 'Electrical'],
      experience: '5 years',
      bio: 'Test handyman account'
    });
    console.log('  ✅ Handyman profile created');

    console.log('\n✅ SUCCESS! Test handyman created:');
    console.log('   Email:', testEmail);
    console.log('   Password:', testPassword);
    console.log('   UID:', userCredential.user.uid);

    // Save credentials for sign-in test
    window._testCredentials = { email: testEmail, password: testPassword };

    return { success: true, email: testEmail, password: testPassword, uid: userCredential.user.uid };
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Error code:', error.code);
    return { success: false, error: error.message };
  }
};

/**
 * Test 2: Sign in with the test account
 */
const testSignIn = async (email, password) => {
  console.log('\n🧪 Test 2: Signing in...');

  if (!email || !password) {
    if (window._testCredentials) {
      email = window._testCredentials.email;
      password = window._testCredentials.password;
    } else {
      console.error('❌ No credentials provided. Run testAuth.create() first.');
      return { success: false };
    }
  }

  console.log('Email:', email);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ SUCCESS! Signed in as:', userCredential.user.email);
    console.log('   UID:', userCredential.user.uid);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Error code:', error.code);
    return { success: false, error: error.message };
  }
};

/**
 * Test 3: Check current auth state
 */
const testAuthState = () => {
  console.log('\n🧪 Test 3: Checking auth state...');

  const user = auth.currentUser;

  if (user) {
    console.log('✅ User is signed in:');
    console.log('   Email:', user.email);
    console.log('   UID:', user.uid);
    console.log('   Email verified:', user.emailVerified);
    return { signedIn: true, user };
  } else {
    console.log('❌ No user is signed in');
    return { signedIn: false };
  }
};

/**
 * Test 4: Sign out
 */
const testSignOut = async () => {
  console.log('\n🧪 Test 4: Signing out...');

  try {
    await auth.signOut();
    console.log('✅ Signed out successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Run all tests in sequence
 */
const runAllTests = async () => {
  console.log('🚀 Running Complete Authentication Test Suite');
  console.log('='.repeat(60));

  // Test 1: Create account
  const createResult = await testCreateHandyman();
  if (!createResult.success) {
    console.log('\n❌ Test suite stopped - account creation failed');
    return;
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Check auth state (should be signed in)
  testAuthState();

  // Test 3: Sign out
  await testSignOut();

  // Test 4: Check auth state (should be signed out)
  testAuthState();

  // Test 5: Sign in again
  await testSignIn(createResult.email, createResult.password);

  // Test 6: Check final state
  testAuthState();

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('Test credentials saved in window._testCredentials');
};

// Expose to window for console testing
if (typeof window !== 'undefined') {
  window.testAuth = {
    create: testCreateHandyman,
    signIn: testSignIn,
    signOut: testSignOut,
    status: testAuthState,
    runAll: runAllTests
  };

  console.log('🔐 Auth test utilities loaded!');
  console.log('📝 Available commands:');
  console.log('  window.testAuth.create()  - Create test handyman account');
  console.log('  window.testAuth.signIn()  - Sign in with test account');
  console.log('  window.testAuth.signOut() - Sign out');
  console.log('  window.testAuth.status()  - Check auth state');
  console.log('  window.testAuth.runAll()  - Run complete test suite');
}

export { testCreateHandyman, testSignIn, testSignOut, testAuthState, runAllTests };
