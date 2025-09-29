import React, { useState } from 'react';
// import { createPaymentIntent } from '../../services/stripe/payment';
import LoadingSpinner from '../common/LoadingSpinner';

const PaymentForm = ({ amount, jobId, onPaymentSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('PayNow');
  const [error, setError] = useState(null);

  const serviceFee = parseFloat(amount) || 120;
  const platformFee = 5;
  const totalAmount = serviceFee + platformFee;

  const paymentMethods = [
    {
      id: 'PayNow',
      name: 'PayNow',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAw187E7vJgIZ5qhTAGeyFp2iiILcE55heS6OEHCXHhathRZIaSfuaewDf8lUFloIw9V4DGEQZ-Ls6QQ1LmUHEQ0n-u8RhO0yXwQHxF-NiYLjKLwHoLTbg8sKh8rrvGtndYACzzA9QuHx4vI6KXsSkVkX6IVY5b6vsRub2_lPlvRD2_81FqGMVNWk4mhUi5ZybAhfsMhYluoVMP6NmYbJOETAQ38aURXcH8l6VvreNi8aV_WdkStWZzP5gk82XWQXJynC2rNC3OHLcT'
    },
    {
      id: 'PayLah',
      name: 'PayLah!',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDw3Jvp1q59sLBADkbjMNUq80HIcBIAI4Vbldx3oTHj4qbPssuusYv5xWm7XuMFC8cstlRWRwaImv--MDx3w0jDn7cvzIjJWPDGMyUrqiQti5HTYCj7Q-W-2OGZLe4gkORVC5593Q6KaEZqAnG3oTHFZ8ZQ1uFehU6ma_Ry6fn_MsgTW7whdwlgkupAJBs2JYm6T2ksL7mptCYoInluWIvOss3GF9mt30Axf2t2ciekpr6q7KiriyUFC014gWcDBEaBuaBC6KX5-onY'
    },
    {
      id: 'Card',
      name: 'Credit / Debit Card',
      icon: 'credit_card'
    }
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      // Simulate payment processing
      const paymentData = {
        amount: totalAmount,
        paymentMethod: selectedPaymentMethod,
        jobId,
        currency: 'sgd'
      };

      // For demo purposes, we'll simulate a successful payment
      setTimeout(() => {
        const mockPaymentIntent = {
          id: 'pi_' + Date.now(),
          status: 'succeeded',
          amount: totalAmount * 100,
          currency: 'sgd',
          payment_method: selectedPaymentMethod
        };
        onPaymentSuccess(mockPaymentIntent);
        setIsProcessing(false);
      }, 2000);

    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
      setIsProcessing(false);
    }
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
              <p className="text-muted-light dark:text-muted-dark">Platform fee</p>
              <p className="font-medium">${platformFee.toFixed(2)}</p>
            </div>
            <div className="border-t border-border-light dark:border-border-dark my-3"></div>
            <div className="flex justify-between items-center text-lg">
              <p className="font-bold">Total</p>
              <p className="font-bold">${totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Payment method</h2>
          <form onSubmit={handleSubmit}>
            <fieldset>
              <legend className="sr-only">Payment method</legend>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedPaymentMethod === method.id
                        ? 'border-primary ring-2 ring-primary dark:border-primary'
                        : 'border-border-light dark:border-border-dark hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={method.id}
                      checked={selectedPaymentMethod === method.id}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <span className="flex-grow font-medium">{method.name}</span>
                    {method.logo ? (
                      <img
                        alt={`${method.name} logo`}
                        className="h-6"
                        src={method.logo}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-muted-light dark:text-muted-dark">
                        {method.icon}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Payment Protection Notice */}
            <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 mt-6">
              <span className="material-symbols-outlined text-primary mt-1">shield</span>
              <div>
                <h3 className="font-bold text-foreground-light dark:text-foreground-dark">Your payment is protected</h3>
                <p className="text-sm text-muted-light dark:text-muted-dark mt-1">
                  We use a secure escrow service. We'll hold your payment and only release it to the handyman after you confirm the job is completed to your satisfaction.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full h-12 flex items-center justify-center rounded-lg bg-primary text-background-dark font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <LoadingSpinner size="small" />
                ) : (
                  'Confirm & Pay'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentForm;