import React from 'react';
import HandymanHeader from '../HandymanHeader';

/**
 * PendingStatusView Component
 *
 * Displayed when handyman status is 'pending' - awaiting operations team approval
 * Shows application under review message with timeline and support contact
 */
const PendingStatusView = ({ userProfile }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader currentView="profile" onViewChange={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-yellow-600 dark:text-yellow-400">
                pending
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Application Under Review
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Thank you for registering with EazyDone! Our operations team is currently reviewing your application.
          </p>

          {/* Timeline */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3 text-left">
              <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 mt-0.5">
                schedule
              </span>
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  What's Next?
                </h3>
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  Our team typically reviews applications within <strong>1-2 business days</strong>.
                  We'll send you an email notification once your account has been approved.
                </p>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
              Your Registration Details
            </h3>
            <div className="space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                <span className="font-medium text-gray-900 dark:text-white">{userProfile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="font-medium text-gray-900 dark:text-white">{userProfile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Services:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {userProfile.handyman?.serviceTypes?.join(', ') || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">Pending Review</span>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Have questions about your application?
            </p>
            <a
              href="mailto:support@eazydone.com"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <span className="material-symbols-outlined text-sm">email</span>
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingStatusView;
