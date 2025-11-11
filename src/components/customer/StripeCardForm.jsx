import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * StripeCardForm - Collects card details and confirms payment
 *
 * This component uses Stripe Elements to securely collect card information
 * and handle 3D Secure authentication (SCA) if required.
 */
const StripeCardForm = ({
  clientSecret,
  amount,
  onSuccess,
  onError
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);

  // Stripe Card Element styling
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': {
          color: '#9ca3af',
        },
        iconColor: '#6366f1',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: false, // Show postal code field
  };

  // Handle card element changes
  const handleCardChange = (event) => {
    setCardError(event.error ? event.error.message : null);
    setCardComplete(event.complete);
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error('Stripe.js has not loaded yet.');
      return;
    }

    if (!cardComplete) {
      setCardError('Please enter complete card details.');
      return;
    }

    setIsProcessing(true);
    setCardError(null);

    try {
      console.log('🎯 Confirming payment with card...');
      console.log('Client Secret:', clientSecret.substring(0, 30) + '...');

      // Confirm the payment with card details
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      );

      if (error) {
        console.error('❌ Payment confirmation error:', error);
        setCardError(error.message);
        if (onError) {
          onError(error);
        }
        setIsProcessing(false);
        return;
      }

      // Payment successful!
      console.log('✅ Payment confirmed successfully!');
      console.log('Payment Intent:', paymentIntent);
      console.log('Status:', paymentIntent.status);

      if (paymentIntent.status === 'requires_capture') {
        console.log('💰 Payment authorized - Funds held in escrow!');
      }

      if (onSuccess) {
        onSuccess(paymentIntent);
      }

      setIsProcessing(false);
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setCardError('An unexpected error occurred. Please try again.');
      if (onError) {
        onError(err);
      }
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Card Details Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Card Information
        </label>
        <div className="p-4 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-800">
          <CardElement
            options={cardElementOptions}
            onChange={handleCardChange}
          />
        </div>
        {cardError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {cardError}
          </p>
        )}
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
          lock
        </span>
        <div className="flex-1">
          <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
            Secure Payment
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Your card details are encrypted and securely processed by Stripe.
            We never store your card information.
          </p>
        </div>
      </div>

      {/* Amount Display */}
      <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          Amount to authorize:
        </span>
        <span className="text-2xl font-bold text-primary">
          ${amount.toFixed(2)}
        </span>
      </div>

      {/* Escrow Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <span className="material-symbols-outlined text-green-600 dark:text-green-400 mt-0.5">
          shield_check
        </span>
        <div className="flex-1">
          <p className="text-sm text-green-900 dark:text-green-100 font-medium">
            Payment Protection (Escrow)
          </p>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            Your card will be authorized for ${amount.toFixed(2)}, but the charge won't be completed
            until you confirm the job is done to your satisfaction.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isProcessing || !stripe || !cardComplete}
        className="w-full h-12 flex items-center justify-center rounded-lg bg-primary text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <LoadingSpinner size="small" />
        ) : (
          `Authorize Payment ($${amount.toFixed(2)})`
        )}
      </button>

      {/* Test Cards Info (only in test mode) */}
      <div className="text-xs text-gray-500 dark:text-gray-400 p-3 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="font-semibold mb-1">Test Mode - Use these test cards:</p>
        <p>• Success: 4242 4242 4242 4242</p>
        <p>• 3D Secure: 4000 0027 6000 3184</p>
        <p>• Decline: 4000 0000 0000 0002</p>
        <p className="mt-1 text-gray-400">Use any future expiry date and any 3-digit CVC</p>
      </div>
    </form>
  );
};

export default StripeCardForm;
