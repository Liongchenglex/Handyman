/**
 * WhatsApp Notification Service (Green-API)
 *
 * Handles all WhatsApp message sending via Green-API
 * No templates required - send any message anytime!
 *
 * Setup:
 * 1. Create account at https://console.green-api.com
 * 2. Create an instance and scan QR code with WhatsApp
 * 3. Add to .env.local:
 *    - REACT_APP_GREENAPI_API_URL (e.g., https://api.green-api.com)
 *    - REACT_APP_GREENAPI_ID_INSTANCE (your instance ID)
 *    - REACT_APP_GREENAPI_API_TOKEN (your API token)
 *
 * Documentation: https://green-api.com/en/docs/
 */

const GREENAPI_CONFIG = {
  apiUrl: process.env.REACT_APP_GREENAPI_API_URL || 'https://api.green-api.com',
  idInstance: process.env.REACT_APP_GREENAPI_ID_INSTANCE,
  apiToken: process.env.REACT_APP_GREENAPI_API_TOKEN
};

/**
 * Check if WhatsApp/Green-API is configured
 * @returns {boolean} - True if all required config is present
 */
export const isWhatsAppConfigured = () => {
  return !!(GREENAPI_CONFIG.idInstance && GREENAPI_CONFIG.apiToken);
};

/**
 * Format phone number for Green-API (chatId format)
 * Green-API uses format: 6591234567@c.us (no + prefix, @c.us suffix)
 *
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted chatId (e.g., 6591234567@c.us)
 */
export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If it doesn't have country code, assume Singapore (65)
  if (cleaned.length === 8) {
    cleaned = `65${cleaned}`;
  }

  // Remove leading zeros if any
  cleaned = cleaned.replace(/^0+/, '');

  // Add @c.us suffix for personal chat
  return `${cleaned}@c.us`;
};

/**
 * Build Green-API endpoint URL
 * @param {string} method - API method name (e.g., 'sendMessage', 'sendPoll')
 * @returns {string} - Full API endpoint URL
 */
const buildApiUrl = (method) => {
  return `${GREENAPI_CONFIG.apiUrl}/waInstance${GREENAPI_CONFIG.idInstance}/${method}/${GREENAPI_CONFIG.apiToken}`;
};

/**
 * Send a text message via Green-API
 * No 24-hour window restriction - send anytime!
 *
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text to send (max 20,000 characters)
 * @returns {Promise<object>} - API response
 */
export const sendTextMessage = async (to, message) => {
  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp/Green-API not configured. Message not sent.');
    console.log('📱 WhatsApp Message [FALLBACK - Not Configured]:');
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);
    return {
      success: false,
      error: 'WhatsApp not configured',
      fallback: true
    };
  }

  try {
    const chatId = formatPhoneNumber(to);

    console.log('📱 Sending WhatsApp message via Green-API...');
    console.log(`To: ${chatId}`);
    console.log(`Message: ${message}`);

    const response = await fetch(buildApiUrl('sendMessage'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: chatId,
        message: message
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('❌ Green-API Error:', data);
      throw new Error(data.error || 'Failed to send WhatsApp message');
    }

    console.log('✅ WhatsApp message sent successfully');
    console.log('Message ID:', data.idMessage);

    return {
      success: true,
      messageId: data.idMessage,
      data
    };

  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a poll message via Green-API
 * Useful for confirmations (Yes/No) without needing approved templates
 *
 * @param {string} to - Recipient phone number
 * @param {string} question - Poll question (max 255 characters)
 * @param {Array<string>} options - Poll options (2-12 options)
 * @param {boolean} multipleAnswers - Allow multiple selections (default: false)
 * @returns {Promise<object>} - API response
 */
export const sendPoll = async (to, question, options, multipleAnswers = false) => {
  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp/Green-API not configured. Poll not sent.');
    console.log('📱 WhatsApp Poll [FALLBACK - Not Configured]:');
    console.log(`To: ${to}`);
    console.log(`Question: ${question}`);
    console.log(`Options:`, options);
    return {
      success: false,
      error: 'WhatsApp not configured',
      fallback: true
    };
  }

  try {
    const chatId = formatPhoneNumber(to);

    console.log('📱 Sending WhatsApp poll via Green-API...');
    console.log(`To: ${chatId}`);
    console.log(`Question: ${question}`);
    console.log(`Options:`, options);

    // Format options for Green-API
    const formattedOptions = options.map(opt => ({ optionName: opt }));

    const response = await fetch(buildApiUrl('sendPoll'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: chatId,
        message: question,
        options: formattedOptions,
        multipleAnswers: multipleAnswers
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('❌ Green-API Error:', data);
      throw new Error(data.error || 'Failed to send WhatsApp poll');
    }

    console.log('✅ WhatsApp poll sent successfully');
    console.log('Message ID:', data.idMessage);

    return {
      success: true,
      messageId: data.idMessage,
      data
    };

  } catch (error) {
    console.error('❌ Error sending WhatsApp poll:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send job completion notification to customer with confirmation poll
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobCompletionNotification = async (job, handyman) => {
  // First send the info message
  const infoMessage = `Hello ${job.customerName}! 👋

Your handyman *${handyman.name}* has marked the following job as complete:

📋 *Service:* ${job.serviceType}
🔖 *Job ID:* ${job.id}

Please confirm if the work has been completed to your satisfaction.`;

  const infoResult = await sendTextMessage(job.customerPhone, infoMessage);

  if (!infoResult.success) {
    return infoResult;
  }

  // Then send a confirmation poll
  const pollQuestion = `Is the job "${job.serviceType}" completed satisfactorily?`;
  const pollOptions = ['✅ Yes, Confirm Complete', '⚠️ No, Report Issue'];

  return await sendPoll(job.customerPhone, pollQuestion, pollOptions, false);
};

/**
 * Send job acceptance notification to customer
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobAcceptanceNotification = async (job, handyman) => {
  const message = `Great news, ${job.customerName}! 🎉

*${handyman.name}* has accepted your job request!

📋 *Service:* ${job.serviceType}
🔖 *Job ID:* ${job.id}

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com`;

  return await sendTextMessage(job.customerPhone, message);
};

/**
 * Send job creation confirmation to customer after payment success
 *
 * @param {object} jobData - Job data object containing customer info and job details
 * @returns {Promise<object>} - API response
 */
export const sendJobCreationNotification = async (jobData) => {
  // Format timing information
  const timingText = jobData.preferredTiming === 'Schedule'
    ? `${new Date(jobData.preferredDate).toLocaleDateString()} at ${jobData.preferredTime}`
    : 'As soon as possible';

  const message = `Hi ${jobData.customerName}! 👋

Your job request has been posted successfully! ✅

📋 *Service:* ${jobData.serviceType}
💰 *Service Fee:* $${jobData.estimatedBudget}
🔖 *Job ID:* ${jobData.id || 'Pending'}
📅 *Timing:* ${timingText}

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone! 🔧`;

  console.log('📋 Sending job creation notification:');
  console.log(`Customer: ${jobData.customerName}`);
  console.log(`Service: ${jobData.serviceType}`);
  console.log(`Budget: $${jobData.estimatedBudget}`);
  console.log(`Job ID: ${jobData.id || 'Pending'}`);

  return await sendTextMessage(jobData.customerPhone, message);
};

/**
 * Send custom message
 *
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<object>} - API response
 */
export const sendCustomMessage = async (to, message) => {
  return await sendTextMessage(to, message);
};

/**
 * Send confirmation poll for any purpose
 *
 * @param {string} to - Recipient phone number
 * @param {string} question - Poll question
 * @param {Array<string>} options - Poll options (default: Yes/No)
 * @returns {Promise<object>} - API response
 */
export const sendConfirmationPoll = async (to, question, options = ['Yes', 'No']) => {
  return await sendPoll(to, question, options, false);
};

// Export all functions
export default {
  isWhatsAppConfigured,
  formatPhoneNumber,
  sendTextMessage,
  sendPoll,
  sendJobCompletionNotification,
  sendJobAcceptanceNotification,
  sendJobCreationNotification,
  sendCustomMessage,
  sendConfirmationPoll
};
