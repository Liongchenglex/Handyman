import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { createPaymentIntent } from '../../services/stripe/stripeApi';
import StripeCardForm from './StripeCardForm';
import { getPlatformFee } from '../../config/servicePricing';

// Load Stripe with your publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Global tracker for payment intents - persists across component mounts/unmounts
// This prevents duplicate payment intent creation even if component remounts
const paymentIntentTracker = new Map();

const PaymentForm = ({
  amount,
  jobId,
  serviceType,
  customerId,
  handymanId,
  customerEmail,
  onPaymentSuccess
}) => {
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  const isCreatingRef = useRef(false); // Prevent concurrent creation within same component instance

  const serviceFee = parseFloat(amount) || 120;
  const platformFee = getPlatformFee(serviceFee); // 10% of service fee
  const totalAmount = serviceFee + platformFee;

  // Create payment intent on component mount
  useEffect(() => {
    // Check if this jobId already has a payment intent being created or created
    if (!jobId || isCreatingRef.current) {
      return;
    }

    // Check global tracker - if this jobId was already processed, use cached result
    if (paymentIntentTracker.has(jobId)) {
      const cachedResult = paymentIntentTracker.get(jobId);
      if (cachedResult.clientSecret) {
        console.log('⚡ Using cached payment intent for job:', jobId);
        setClientSecret(cachedResult.clientSecret);
        return;
      }
      // If creation is in progress, wait
      if (cachedResult.isCreating) {
        console.log('⏳ Payment intent creation already in progress for job:', jobId);
        return;
      }
    }

    // Mark as creating in global tracker
    paymentIntentTracker.set(jobId, { isCreating: true, clientSecret: null });
    isCreatingRef.current = true;
    const createIntent = async () => {
      setIsCreatingIntent(true);
      setError(null);

      try {
        console.log('🎯 Creating payment intent with escrow...');
        console.log('Service Fee:', serviceFee);
        console.log('Platform Fee (10%):', platformFee);
        console.log('Total Amount:', totalAmount);
        console.log('Job ID:', jobId);

        // Validate that we have a real job ID
        if (!jobId) {
          throw new Error('Job ID is required to create payment intent');
        }

        // Call Stripe API to create payment intent with escrow
        const result = await createPaymentIntent({
          jobId: jobId, // Real job ID from Firestore
          customerId: customerId || 'temp_customer',
          handymanId: handymanId || 'temp_handyman',
          serviceFee: serviceFee,
          serviceType: serviceType || 'General handyman',
          customerEmail: customerEmail || null
        });

        console.log('✅ Payment intent created successfully!');
        console.log('Payment Intent ID:', result.paymentIntentId);
        console.log('Client Secret:', result.clientSecret.substring(0, 30) + '...');
        console.log('Status:', result.status);
        console.log('Amount:', result.amount, result.currency.toUpperCase());

        // Store client secret for card collection
        setClientSecret(result.clientSecret);

        // Update global tracker with successful result
        paymentIntentTracker.set(jobId, {
          isCreating: false,
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId
        });

        setIsCreatingIntent(false);
      } catch (err) {
        console.error('❌ Error creating payment intent:', err);
        setError(err.response?.data?.message || err.message || 'Failed to initialize payment. Please try again.');

        // Remove from tracker on error to allow retry
        paymentIntentTracker.delete(jobId);
        isCreatingRef.current = false;

        setIsCreatingIntent(false);
      }
    };

    createIntent();

    // Cleanup: Don't reset refs/tracker - they should persist across remounts
    // This prevents duplicate payment intent creation if component remounts
  }, [jobId]); // Only re-create if jobId changes (prevents duplicate payment intents)

  // Handle successful card confirmation
  const handleCardSuccess = (paymentIntent) => {
    console.log('💳 Card payment confirmed!');
    console.log('Payment Intent Status:', paymentIntent.status);

    // Call parent success callback
    onPaymentSuccess({
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: totalAmount,
        currency: paymentIntent.currency,
        payment_method: paymentIntent.payment_method,
        client_secret: paymentIntent.client_secret
      }
    });
  };

  // Handle card confirmation error
  const handleCardError = (error) => {
    console.error('❌ Card payment error:', error);
    setError(error.message || 'Payment failed. Please try again.');
  };

  // Stripe Elements options
  const elementsOptions = {
    clientSecret: clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#6366f1',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-foreground-light dark:text-foreground-dark">
      <div className="max-w-lg mx-auto space-y-8">

        {/* Price Breakdown */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Estimated price breakdown</h2>
          <div className="rounded-lg border border-border-light dark:border-border-dark p-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-muted-light dark:text-muted-dark">Service fee</p>
              <p className="font-medium">${serviceFee.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-muted-light dark:text-muted-dark">Platform fee (10%)</p>
              <p className="font-medium">${platformFee.toFixed(2)}</p>
            </div>
            <div className="border-t border-border-light dark:border-border-dark my-3"></div>
            <div className="flex justify-between items-center text-lg">
              <p className="font-bold">Total</p>
              <p className="font-bold">${totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Payment Method Section */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Payment method</h2>

          {/* Show error if payment intent creation failed */}
          {error && !clientSecret && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                <div>
                  <p className="text-red-600 dark:text-red-400 font-medium">Payment Initialization Failed</p>
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Show loading while creating payment intent */}
          {isCreatingIntent && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Initializing secure payment...</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Please wait</p>
            </div>
          )}

          {/* Show Stripe card form once payment intent is created */}
          {!isCreatingIntent && clientSecret && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <StripeCardForm
                clientSecret={clientSecret}
                amount={totalAmount}
                onSuccess={handleCardSuccess}
                onError={handleCardError}
              />
            </Elements>
          )}

          {/* Show error if card confirmation failed */}
          {error && clientSecret && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentForm;
