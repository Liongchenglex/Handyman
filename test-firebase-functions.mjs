/**
 * Test Firebase Functions Endpoints
 *
 * This script tests all deployed Stripe Firebase Functions
 */

import axios from 'axios';

const BASE_URL = 'https://us-central1-eazydone-d06cf.cloudfunctions.net';

// Test data
const testHandyman = {
  uid: 'test_handyman_' + Date.now(),
  email: 'testhandyman@example.com',
  name: 'Test Handyman',
  phone: '+6591234567'
};

console.log('\n🧪 Testing Firebase Functions Endpoints\n');
console.log('Base URL:', BASE_URL);
console.log('========================================\n');

// Test 1: Create Connected Account
console.log('Test 1: Create Connected Account');
console.log('─────────────────────────────────');

try {
  const response = await axios.post(`${BASE_URL}/createConnectedAccount`, testHandyman);
  console.log('✅ SUCCESS');
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(response.data, null, 2));
  console.log('Account ID:', response.data.accountId);

  const accountId = response.data.accountId;

  // Test 2: Get Account Status
  console.log('\n\nTest 2: Get Account Status');
  console.log('─────────────────────────────────');

  const statusResponse = await axios.get(`${BASE_URL}/getAccountStatus?accountId=${accountId}`);
  console.log('✅ SUCCESS');
  console.log('Status:', statusResponse.status);
  console.log('Response:', JSON.stringify(statusResponse.data, null, 2));

  // Test 3: Create Account Link
  console.log('\n\nTest 3: Create Account Link (Onboarding)');
  console.log('─────────────────────────────────');

  const linkResponse = await axios.post(`${BASE_URL}/createAccountLink`, { accountId });
  console.log('✅ SUCCESS');
  console.log('Status:', linkResponse.status);
  console.log('Onboarding URL:', linkResponse.data.url.substring(0, 80) + '...');

  // Test 4: Create Payment Intent
  console.log('\n\nTest 4: Create Payment Intent');
  console.log('─────────────────────────────────');

  const paymentData = {
    jobId: 'test_job_' + Date.now(),
    customerId: 'test_customer_123',
    handymanId: testHandyman.uid,
    serviceFee: 120,
    serviceType: 'Plumbing',
    customerEmail: 'customer@example.com'
  };

  const paymentResponse = await axios.post(`${BASE_URL}/createPaymentIntent`, paymentData);
  console.log('✅ SUCCESS');
  console.log('Status:', paymentResponse.status);
  console.log('Response:', JSON.stringify(paymentResponse.data, null, 2));
  console.log('Payment Intent ID:', paymentResponse.data.paymentIntentId);
  console.log('Client Secret:', paymentResponse.data.clientSecret.substring(0, 30) + '...');

  const paymentIntentId = paymentResponse.data.paymentIntentId;

  // Test 5: Get Payment Status
  console.log('\n\nTest 5: Get Payment Status');
  console.log('─────────────────────────────────');

  const paymentStatusResponse = await axios.get(`${BASE_URL}/getPaymentStatus?paymentIntentId=${paymentIntentId}`);
  console.log('✅ SUCCESS');
  console.log('Status:', paymentStatusResponse.status);
  console.log('Payment Status:', paymentStatusResponse.data.status.status);
  console.log('Amount:', paymentStatusResponse.data.status.amount, paymentStatusResponse.data.status.currency.toUpperCase());

  console.log('\n\n========================================');
  console.log('✅ All endpoint tests passed!');
  console.log('========================================\n');
  console.log('Summary:');
  console.log('  ✅ createConnectedAccount - Working');
  console.log('  ✅ getAccountStatus - Working');
  console.log('  ✅ createAccountLink - Working');
  console.log('  ✅ createPaymentIntent - Working');
  console.log('  ✅ getPaymentStatus - Working');
  console.log('\nYour Firebase Functions are ready to use!');
  console.log('You can now proceed with frontend integration.\n');

} catch (error) {
  console.log('❌ ERROR');
  console.log('Status:', error.response?.status);
  console.log('Error:', error.response?.data || error.message);
  console.log('\nFull Error:', error);
  process.exit(1);
}
