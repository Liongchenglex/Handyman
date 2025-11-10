import React from 'react';
import HandymanHeader from '../HandymanHeader';

/**
 * SuspendedStatusView Component
 *
 * Displayed when handyman status is 'suspended'
 * Shows account suspended message with reason (if provided) and support contact
 */
const SuspendedStatusView = ({ userProfile }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader currentView="profile" onViewChange={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-orange-600 dark:text-orange-400">
                block
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Account Suspended
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Your handyman account has been temporarily suspended.
          </p>

          {/* Reason (if provided) */}
          {userProfile.handyman?.suspendedReason && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                Reason: {userProfile.handyman.suspendedReason}
              </h3>
            </div>
          )}

          {/* Contact Support */}
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please contact support to resolve this issue.
          </p>
          <a
            href="mailto:support@eazydone.com"
            className="inline-flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-sm">email</span>
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default SuspendedStatusView;
