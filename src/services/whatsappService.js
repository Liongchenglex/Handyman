/**
 * WhatsApp Notification Service (via Cloud Function Proxy)
 *
 * All WhatsApp messages are sent through the sendWhatsAppNotification
 * Cloud Function, which calls Twilio server-side. This approach:
 * 1. Avoids CORS issues (Twilio API doesn't support browser calls)
 * 2. Keeps Twilio credentials server-side only
 *
 * The Cloud Function handles template selection and fallback logic.
 * No Twilio configuration is needed in the frontend .env.
 *
 * Required: Firebase Auth (user must be logged in to call the function)
 */

import { auth } from './firebase/config';

// Cloud Functions base URL
const FUNCTIONS_BASE_URL = 'https://us-central1-eazydone-d06cf.cloudfunctions.net';

/**
 * Send a WhatsApp notification via the Cloud Function proxy.
 * Requires the user to be authenticated (Firebase Auth token is sent).
 *
 * @param {string} type - Notification type: 'job_created', 'job_accepted', 'job_completion'
 * @param {object} data - Notification data (varies by type)
 * @returns {Promise<object>} - API response { success, sid } or { success: false, error }
 */
const sendNotification = async (type, data) => {
  try {
    // Get Firebase Auth token for the current user
    const user = auth.currentUser;
    if (!user) {
      console.warn('⚠️ No authenticated user — cannot send WhatsApp notification');
      return { success: false, error: 'Not authenticated', fallback: true };
    }

    const token = await user.getIdToken();

    console.log(`📱 Sending WhatsApp ${type} notification via Cloud Function...`);
    console.log(`To: ${data.customerPhone}`);

    const response = await fetch(`${FUNCTIONS_BASE_URL}/sendWhatsAppNotification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, data })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error(`❌ WhatsApp ${type} notification failed:`, result.error);
      return { success: false, error: result.error };
    }

    console.log(`✅ WhatsApp ${type} notification sent successfully (SID: ${result.sid})`);
    return { success: true, messageId: result.sid };

  } catch (error) {
    console.error(`❌ Error sending WhatsApp ${type} notification:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send job completion notification to customer with confirmation prompt.
 * Customer replies with YES or NO, handled by the webhook.
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobCompletionNotification = async (job, handyman) => {
  return await sendNotification('job_completion', {
    customerPhone: job.customerPhone,
    customerName: job.customerName,
    handymanName: handyman.name,
    serviceType: job.serviceType,
    jobId: job.id
  });
};

/**
 * Send job acceptance notification to customer.
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobAcceptanceNotification = async (job, handyman) => {
  return await sendNotification('job_accepted', {
    customerPhone: job.customerPhone,
    customerName: job.customerName,
    handymanName: handyman.name,
    serviceType: job.serviceType,
    jobId: job.id
  });
};

/**
 * Send job creation confirmation to customer after payment success.
 *
 * @param {object} jobData - Job data object containing customer info and job details
 * @returns {Promise<object>} - API response
 */
export const sendJobCreationNotification = async (jobData) => {
  console.log('📋 Sending job creation notification:');
  console.log(`Customer: ${jobData.customerName}`);
  console.log(`Service: ${jobData.serviceType}`);
  console.log(`Budget: $${jobData.estimatedBudget}`);
  console.log(`Job ID: ${jobData.id || 'Pending'}`);

  return await sendNotification('job_created', {
    customerPhone: jobData.customerPhone,
    customerName: jobData.customerName,
    serviceType: jobData.serviceType,
    estimatedBudget: jobData.estimatedBudget,
    jobId: jobData.id || 'Pending',
    preferredTiming: jobData.preferredTiming,
    preferredDate: jobData.preferredDate,
    preferredTime: jobData.preferredTime
  });
};

/**
 * Check if WhatsApp is configured.
 * With the proxy approach, this always returns true since
 * configuration is on the server side.
 * @returns {boolean}
 */
export const isWhatsAppConfigured = () => true;

/**
 * Format phone number for display purposes.
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted number
 */
export const formatPhoneNumber = (phone) => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    cleaned = `65${cleaned}`;
  }
  cleaned = cleaned.replace(/^0+/, '');
  return `whatsapp:+${cleaned}`;
};

// Export all functions
export default {
  isWhatsAppConfigured,
  formatPhoneNumber,
  sendJobCompletionNotification,
  sendJobAcceptanceNotification,
  sendJobCreationNotification
};
