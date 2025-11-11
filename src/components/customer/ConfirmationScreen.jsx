import React from 'react';
import PropTypes from 'prop-types';
import { getPlatformFee } from '../../config/servicePricing';

/**
 * ConfirmationScreen Component
 *
 * Displays a success confirmation screen after successful job posting and payment
 *
 * @param {Object} jobData - The completed job data from the form
 * @param {Object} paymentResult - Payment confirmation details
 * @param {Function} onBackToHome - Callback function to navigate back to landing page
 * @param {Function} onViewJob - Callback function to view the created job (optional)
 */
const ConfirmationScreen = ({
  jobData = {},
  paymentResult = {},
  onBackToHome,
  onViewJob = null
}) => {
  // Generate a mock job ID for display purposes (in real app, this would come from backend)
  const jobId = paymentResult?.jobId || `JOB-${Date.now().toString().slice(-6)}`;

  // Calculate total amount (service fee + platform fee)
  const serviceFee = jobData.estimatedBudget || 120;
  const platformFee = getPlatformFee(serviceFee);
  const totalAmount = serviceFee + platformFee;

  // Format payment amount for display
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD'
    }).format(amount || 120);
  };

  // Handle view job action
  const handleViewJob = () => {
    if (onViewJob && typeof onViewJob === 'function') {
      onViewJob(jobData, jobId);
    } else {
      // Fallback behavior - could navigate to a job detail page
      console.log('View job functionality not implemented yet');
    }
  };

  // Handle back to home action
  const handleBackToHome = () => {
    if (onBackToHome && typeof onBackToHome === 'function') {
      onBackToHome();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-lg mx-auto">
        {/* Success Card */}
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">

          {/* Success Icon */}
          <div className="mb-8 flex justify-center">
            <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-6">
              <div className="bg-primary/30 dark:bg-primary/40 rounded-full p-4">
                <span className="material-symbols-outlined text-primary text-5xl font-normal">
                  check_circle
                </span>
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Job Posted Successfully!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              Your job request has been submitted and payment of{' '}
              <span className="font-semibold text-primary">
                {formatAmount(totalAmount)}
              </span>{' '}
              has been authorized successfully (service fee: {formatAmount(serviceFee)} + platform fee: {formatAmount(platformFee)}).
            </p>
          </div>

          {/* Job Details Summary */}
          <div className="mb-8 bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-left space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Job ID:</span>
                <span className="font-mono text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-lg">
                  {jobId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Service:</span>
                <span className="font-medium">{jobData.serviceType || 'Handyman Service'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                <span className="font-medium">{jobData.customerName}</span>
              </div>
            </div>
          </div>

          {/* Notification Message */}
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
                notifications_active
              </span>
              <div className="text-left">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  What happens next?
                </h3>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  We've sent you a WhatsApp message and email confirmation.
                  You'll receive updates from qualified handymen who are interested in your job.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Primary Action - View Job */}
            {/* <button
              onClick={handleViewJob}
              className="w-full bg-primary text-gray-900 font-bold py-4 px-6 rounded-xl hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 transition-all duration-200 shadow-lg"
            >
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">visibility</span>
                View Job Details
              </span>
            </button> */}

            {/* Secondary Action - Back to Home */}
            <button
              onClick={handleBackToHome}
              className="w-full bg-primary text-gray-900 font-bold py-4 px-6 rounded-xl hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 transition-all duration-200 shadow-lg"
            >
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">home</span>
                Back to Home
              </span>
            </button>
          </div>

          {/* Support Contact */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Need help? Contact our support team at{' '}
              <a
                href="mailto:support@handyman.sg"
                className="text-primary hover:underline font-medium"
              >
                support@handyman.sg
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

// PropTypes for better development experience and documentation
ConfirmationScreen.propTypes = {
  jobData: PropTypes.shape({
    customerName: PropTypes.string,
    serviceType: PropTypes.string,
    estimatedBudget: PropTypes.number,
    customerEmail: PropTypes.string,
    customerPhone: PropTypes.string
  }),
  paymentResult: PropTypes.shape({
    jobId: PropTypes.string,
    transactionId: PropTypes.string,
    amount: PropTypes.number,
    status: PropTypes.string
  }),
  onBackToHome: PropTypes.func.isRequired,
  onViewJob: PropTypes.func
};

export default ConfirmationScreen;