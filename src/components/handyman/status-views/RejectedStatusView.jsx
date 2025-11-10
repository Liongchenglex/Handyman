import React from 'react';
import HandymanHeader from '../HandymanHeader';

/**
 * RejectedStatusView Component
 *
 * Displayed when handyman status is 'rejected'
 * Shows rejection message with reason (if provided) and appeal option
 */
const RejectedStatusView = ({ userProfile }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader currentView="profile" onViewChange={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-red-600 dark:text-red-400">
                cancel
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Application Not Approved
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Unfortunately, we are unable to approve your handyman application at this time.
          </p>

          {/* Reason (if provided) */}
          {userProfile.handyman?.rejectedReason && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5">
                  info
                </span>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                    Reason for Rejection
                  </h3>
                  <p className="text-red-800 dark:text-red-300 text-sm">
                    {userProfile.handyman.rejectedReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Appeal Option */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3 text-left">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
                support_agent
              </span>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Want to Appeal?
                </h3>
                <p className="text-blue-800 dark:text-blue-300 text-sm mb-4">
                  If you believe this decision was made in error or you have additional information to provide,
                  you can contact our operations team to appeal this decision.
                </p>
                <a
                  href={`mailto:operations@eazydone.com?subject=Handyman%20Application%20Appeal%20-%20${userProfile.name}&body=Hi%20EazyDone%20Team,%0A%0AI%20would%20like%20to%20appeal%20the%20rejection%20of%20my%20handyman%20application.%0A%0AName:%20${userProfile.name}%0AEmail:%20${userProfile.email}%0A%0AReason%20for%20appeal:%0A[Please%20explain%20why%20you%20believe%20your%20application%20should%20be%20reconsidered]`}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-sm">email</span>
                  Email Operations Team
                </a>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
              Application Details
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
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className="font-medium text-red-600 dark:text-red-400">Rejected</span>
              </div>
              {userProfile.handyman?.rejectedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Rejected On:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(userProfile.handyman.rejectedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Support */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For any questions, contact us at{' '}
              <a href="mailto:support@eazydone.com" className="text-primary hover:underline font-medium">
                support@eazydone.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RejectedStatusView;
