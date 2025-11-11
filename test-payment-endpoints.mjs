/**
 * Test Payment Endpoints
 *
 * This tests only the payment-related endpoints which don't require existing Firestore documents
 */

import axios from 'axios';

const BASE_URL = 'https://us-central1-eazydone-d06cf.cloudfunctions.net';

console.log('\n🧪 Testing Payment Endpoints\n');
console.log('Base URL:', BASE_URL);
console.log('========================================\n');

let paymentIntentId = null;

try {
  // Test 1: Create Payment Intent
  console.log('Test 1: Create Payment Intent');
  console.log('─────────────────────────────────');

  const paymentData = {
    jobId: 'test_job_' + Date.now(),
    customerId: 'test_customer_' + Date.now(),
    handymanId: 'test_handyman_' + Date.now(),
    serviceFee: 120,
    serviceType: 'Plumbing',
    customerEmail: 'customer@example.com'
  };

  console.log('Sending:', JSON.stringify(paymentData, null, 2));

  const response = await axios.post(`${BASE_URL}/createPaymentIntent`, paymentData);

  console.log('\n✅ SUCCESS');
  console.log('Status Code:', response.status);
  console.log('Response Data:');
  console.log('  Success:', response.data.success);
  console.log('  Payment Intent ID:', response.data.paymentIntentId);
  console.log('  Amount:', response.data.amount, response.data.currency.toUpperCase());
  console.log('  Status:', response.data.status);
  console.log('  Client Secret:', response.data.clientSecret.substring(0, 30) + '...');

  paymentIntentId = response.data.paymentIntentId;

  // Test 2: Get Payment Status
  console.log('\n\nTest 2: Get Payment Status');
  console.log('─────────────────────────────────');

  const statusResponse = await axios.get(
    `${BASE_URL}/getPaymentStatus?paymentIntentId=${paymentIntentId}`
  );

  console.log('\n✅ SUCCESS');
  console.log('Status Code:', statusResponse.status);
  console.log('Payment Status:');
  console.log('  ID:', statusResponse.data.status.id);
  console.log('  Status:', statusResponse.data.status.status);
  console.log('  Amount:', statusResponse.data.status.amount, statusResponse.data.status.currency.toUpperCase());
  console.log('  Job ID:', statusResponse.data.status.jobId);
  console.log('  Customer ID:', statusResponse.data.status.customerId);
  console.log('  Handyman ID:', statusResponse.data.status.handymanId);

  // Summary
  console.log('\n\n========================================');
  console.log('✅ All Payment Endpoint Tests Passed!');
  console.log('========================================\n');
  console.log('Working Endpoints:');
  console.log('  ✅ createPaymentIntent - Creates payment with escrow');
  console.log('  ✅ getPaymentStatus - Retrieves payment details');
  console.log('\nOther Available Endpoints:');
  console.log('  • confirmPayment - Capture payment from escrow');
  console.log('  • releaseEscrowAndSplit - Split payment 10/10/80');
  console.log('  • refundPayment - Refund customer');
  console.log('  • createConnectedAccount - Create handyman Stripe account');
  console.log('  • getAccountStatus - Check onboarding status');
  console.log('  • createAccountLink - Generate onboarding URL');
  console.log('  • createLoginLink - Access Stripe dashboard');
  console.log('\n✅ Your endpoints are working correctly!');
  console.log('You can now proceed with frontend integration.\n');

} catch (error) {
  console.log('\n❌ ERROR');
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.log('Error Message:', error.message);
  }
  process.exit(1);
}
