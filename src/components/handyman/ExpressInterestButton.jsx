import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * ExpressInterestButton Component
 *
 * Shared component for expressing interest in jobs with confirmation modal
 * Includes penalty warnings and professional commitment messaging
 * Used by both JobBoard and JobCard components
 *
 * @param {Object} job - Job object containing job details
 * @param {Function} onJobSelect - Optional callback when job is selected
 * @param {string} buttonStyle - Style variant: 'full-width' | 'inline'
 * @param {Function} onSuccess - Optional callback after successful interest expression
 */
const ExpressInterestButton = ({
  job,
  onJobSelect,
  buttonStyle = 'full-width',
  onSuccess
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleExpressInterest = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmInterest = () => {
    setIsLoading(true);
    setShowConfirmModal(false);

    // Simulate API call
    setTimeout(() => {
      console.log('Expressing interest in job:', job);
      alert(`Interest expressed in job ${job.id}. Customer will be notified via WhatsApp!`);
      setIsLoading(false);

      // Execute callbacks
      if (onJobSelect) {
        onJobSelect(job);
      }
      if (onSuccess) {
        onSuccess();
      }
    }, 1500);
  };

  // Button style variants
  const getButtonClasses = () => {
    const baseClasses = "bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

    switch (buttonStyle) {
      case 'full-width':
        return `w-full py-4 px-6 ${baseClasses}`;
      case 'inline':
        return `py-3 px-4 ${baseClasses}`;
      default:
        return `w-full py-3 px-4 ${baseClasses}`;
    }
  };

  // Confirmation Modal Component
  const ConfirmationModal = () => (
    showConfirmModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2">
              <span className="material-symbols-outlined text-orange-600 dark:text-orange-400">warning</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Confirm Interest
            </h3>
          </div>

          {/* Modal Content */}
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You are about to express interest in this job. Please note:
            </p>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                ⚠️ Important Penalties
              </h4>
              <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                <li>• Cancelling after acceptance: <strong>$20 penalty</strong></li>
                <li>• No-show without 2 hours notice: <strong>$50 penalty</strong></li>
                <li>• Multiple cancellations may result in account suspension</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              By expressing interest, you commit to providing professional service if selected by the customer.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmInterest}
              className="flex-1 bg-primary text-black font-bold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Confirm Interest
            </button>
          </div>
        </div>
      </div>
    )
  );

  return (
    <>
      <button
        onClick={handleExpressInterest}
        disabled={isLoading}
        className={getButtonClasses()}
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            Expressing Interest...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">work</span>
            Express Interest
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      <ConfirmationModal />
    </>
  );
};

export default ExpressInterestButton;