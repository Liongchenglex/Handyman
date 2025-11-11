import { createPaymentIntent, getPaymentStatus } from './src/services/stripe/payment.mjs';

console.log('\n🧪 Testing Payment Intent Creation\n');
console.log('================================\n');

try {
  const paymentData = {
    jobId: 'test_job_' + Date.now(),
    customerId: 'test_customer_123',
    handymanId: 'test_handyman_123',
    serviceFee: 120,
    serviceType: 'Carpentry',
    customerEmail: 'customer@example.com'
  };

  console.log('Creating payment intent...');
  console.log('Service Fee: $' + paymentData.serviceFee);
  console.log('Service Type: ' + paymentData.serviceType);

  const result = await createPaymentIntent(paymentData);

  console.log('\n✅ Payment intent created successfully!');
  console.log('   Payment Intent ID:', result.paymentIntentId);
  console.log('   Total Amount: $' + result.amount, result.currency.toUpperCase());
  console.log('   Status:', result.status);
  console.log('   Client Secret:', result.clientSecret.substring(0, 30) + '...');

  console.log('\nChecking payment status...');
  const statusResult = await getPaymentStatus(result.paymentIntentId);

  console.log('\n📊 Payment Status:');
  console.log('   Status:', statusResult.status.status);
  console.log('   Amount: $' + statusResult.status.amount, statusResult.status.currency.toUpperCase());

  console.log('\n================================');
  console.log('✅ Payment intent test completed!');
  console.log('\n📝 Test card: 4242 4242 4242 4242');
  console.log('Payment Intent ID:', result.paymentIntentId);
  console.log('\n');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
