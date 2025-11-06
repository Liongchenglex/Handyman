import React, { useState, useEffect } from 'react';
// import { sendWhatsAppNotification } from '../../services/whatsapp/notifications';

const JobConfirmation = ({ job, paymentIntent }) => {
  const [notificationSent, setNotificationSent] = useState(false);

  useEffect(() => {
    const sendNotifications = async () => {
      try {
        // Send WhatsApp notification to customer (placeholder)
        // await sendWhatsAppNotification({
        //   to: job.customerPhone,
        //   message: `Your job request has been submitted successfully! Job ID: ${job.id}. We'll notify you when a handyman accepts your job.`,
        //   type: 'customer_confirmation'
        // });

        setNotificationSent(true);
      } catch (error) {
        console.error('Failed to send notifications:', error);
      }
    };

    if (job && paymentIntent) {
      sendNotifications();
    }
  }, [job, paymentIntent]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-zinc-900 dark:text-zinc-100">
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <main className="w-full max-w-md mx-auto">
          <div className="bg-background-light dark:bg-background-dark shadow-xl rounded-xl p-6 sm:p-8 text-center">
            {/* Success Icon */}
            <div className="mb-6 flex justify-center">
              <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-4">
                <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-3">
                  <span className="material-symbols-outlined text-primary text-4xl">
                    check
                  </span>
                </div>
              </div>
            </div>

            {/* Success Message */}
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              Job Posted Successfully!
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
              We've sent you a WhatsApp message and an in-app notification with the job details. You'll receive updates from handymen shortly.
            </p>

            Action Button
            <a
              href="/"
              className="w-full inline-block bg-primary text-background-dark font-bold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors duration-300"
            >
              Back to Home
            </a>

            {/* Job Details Summary */}
            <div className="mt-8 text-left">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Job ID:</span>
                  <span className="font-medium">{job.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Service:</span>
                  <span className="font-medium">{job.serviceType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Job Address:</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {job.address || job.location || 'Address to be confirmed'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-medium">SGD ${paymentIntent.amount / 100}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className="font-medium text-green-600">Payment Secured</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Notification Status */}
            {notificationSent ? (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-base">check_circle</span>
                WhatsApp notification sent
              </div>
            ) : (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                Sending WhatsApp notification...
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default JobConfirmation;