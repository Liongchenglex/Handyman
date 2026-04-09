/**
 * WhatsApp Notification Service (Twilio)
 *
 * Handles all WhatsApp message sending via Twilio WhatsApp API.
 * Uses Twilio Content Templates for business-initiated messages
 * (outside the 24-hour session window) and freeform text for
 * session replies.
 *
 * Setup:
 * 1. Create account at https://www.twilio.com
 * 2. Enable WhatsApp Sandbox or register a WhatsApp Business number
 * 3. Create Content Templates in Twilio Console and get their Content SIDs
 * 4. Add to .env.local:
 *    - REACT_APP_TWILIO_ACCOUNT_SID
 *    - REACT_APP_TWILIO_AUTH_TOKEN
 *    - REACT_APP_TWILIO_WHATSAPP_FROM
 *    - REACT_APP_TWILIO_TEMPLATE_JOB_CREATED
 *    - REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED
 *    - REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETION
 *
 * Documentation: https://www.twilio.com/docs/whatsapp
 */

const TWILIO_CONFIG = {
  accountSid: process.env.REACT_APP_TWILIO_ACCOUNT_SID,
  authToken: process.env.REACT_APP_TWILIO_AUTH_TOKEN,
  whatsappFrom: process.env.REACT_APP_TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  // Content Template SIDs (from Twilio Console → Content Editor)
  templates: {
    jobCreated: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_CREATED,
    jobAccepted: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED,
    jobCompletion: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETION
  }
};

/**
 * Check if Twilio WhatsApp is configured
 * @returns {boolean} - True if all required config is present
 */
export const isWhatsAppConfigured = () => {
  return !!(TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken);
};

/**
 * Format phone number for Twilio WhatsApp (whatsapp:+E.164 format)
 * Twilio uses format: whatsapp:+6591234567
 *
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted Twilio WhatsApp number (e.g., whatsapp:+6591234567)
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

  return `whatsapp:+${cleaned}`;
};

/**
 * Build Twilio Messages API URL
 * @returns {string} - Twilio Messages API endpoint
 */
const buildApiUrl = () => {
  return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`;
};

/**
 * Build Basic Auth header for Twilio API
 * @returns {string} - Base64-encoded auth string
 */
const buildAuthHeader = () => {
  return 'Basic ' + btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`);
};

/**
 * Send a freeform text message via Twilio WhatsApp API.
 * Use this only for session messages (within 24hr of customer's last message).
 *
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text to send
 * @returns {Promise<object>} - API response
 */
export const sendTextMessage = async (to, message) => {
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ Twilio WhatsApp not configured. Message not sent.');
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
    const toFormatted = formatPhoneNumber(to);

    console.log('📱 Sending WhatsApp message via Twilio...');
    console.log(`To: ${toFormatted}`);

    const body = new URLSearchParams({
      From: TWILIO_CONFIG.whatsappFrom,
      To: toFormatted,
      Body: message
    });

    const response = await fetch(buildApiUrl(), {
      method: 'POST',
      headers: {
        'Authorization': buildAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok || data.code) {
      console.error('❌ Twilio Error:', data);
      throw new Error(data.message || 'Failed to send WhatsApp message');
    }

    console.log('✅ WhatsApp message sent successfully');
    console.log('Message SID:', data.sid);

    return { success: true, messageId: data.sid, data };

  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a template message via Twilio WhatsApp API.
 * Used for business-initiated messages outside the 24-hour session window.
 * Falls back to freeform text if no template SID is configured (e.g., sandbox testing).
 *
 * @param {string} to - Recipient phone number
 * @param {string} contentSid - Twilio Content Template SID (HXxxxxx)
 * @param {object} contentVariables - Template variable values (e.g., { "1": "John", "2": "Plumbing" })
 * @param {string} fallbackMessage - Freeform message to send if no template SID configured
 * @returns {Promise<object>} - API response
 */
export const sendTemplateMessage = async (to, contentSid, contentVariables, fallbackMessage) => {
  // If no template SID, fall back to freeform (works in sandbox mode)
  if (!contentSid) {
    console.warn('⚠️ No template SID configured — sending freeform message (sandbox mode)');
    return await sendTextMessage(to, fallbackMessage);
  }

  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ Twilio WhatsApp not configured. Template message not sent.');
    console.log('📱 WhatsApp Template [FALLBACK - Not Configured]:');
    console.log(`To: ${to}`);
    console.log(`ContentSid: ${contentSid}`);
    console.log(`Variables:`, contentVariables);
    return {
      success: false,
      error: 'WhatsApp not configured',
      fallback: true
    };
  }

  try {
    const toFormatted = formatPhoneNumber(to);

    console.log('📱 Sending WhatsApp template message via Twilio...');
    console.log(`To: ${toFormatted}`);
    console.log(`ContentSid: ${contentSid}`);
    console.log(`Variables:`, contentVariables);

    const body = new URLSearchParams({
      From: TWILIO_CONFIG.whatsappFrom,
      To: toFormatted,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(contentVariables)
    });

    const response = await fetch(buildApiUrl(), {
      method: 'POST',
      headers: {
        'Authorization': buildAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok || data.code) {
      console.error('❌ Twilio Error:', data);
      throw new Error(data.message || 'Failed to send WhatsApp template message');
    }

    console.log('✅ WhatsApp template message sent successfully');
    console.log('Message SID:', data.sid);

    return { success: true, messageId: data.sid, data };

  } catch (error) {
    console.error('❌ Error sending WhatsApp template message:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send job completion notification to customer with confirmation prompt.
 * Uses the job_completion template for business-initiated messages.
 * Customer replies with YES or NO, handled by the webhook.
 *
 * Template variables: {{1}} customerName, {{2}} handymanName, {{3}} serviceType, {{4}} jobId
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobCompletionNotification = async (job, handyman) => {
  // Fallback freeform message for sandbox testing
  const fallbackMessage = `Hello ${job.customerName}! 👋

Your handyman *${handyman.name}* has marked the following job as complete:

📋 *Service:* ${job.serviceType}
🔖 *Job ID:* ${job.id}

Please confirm if the work has been completed to your satisfaction.

👉 Reply *YES* to confirm completion
👉 Reply *NO* to report an issue`;

  return await sendTemplateMessage(
    job.customerPhone,
    TWILIO_CONFIG.templates.jobCompletion,
    { '1': job.customerName, '2': handyman.name, '3': job.serviceType, '4': job.id },
    fallbackMessage
  );
};

/**
 * Send job acceptance notification to customer.
 * Uses the job_accepted template for business-initiated messages.
 *
 * Template variables: {{1}} customerName, {{2}} handymanName, {{3}} serviceType, {{4}} jobId
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobAcceptanceNotification = async (job, handyman) => {
  // Fallback freeform message for sandbox testing
  const fallbackMessage = `Great news, ${job.customerName}! 🎉

*${handyman.name}* has accepted your job request!

📋 *Service:* ${job.serviceType}
🔖 *Job ID:* ${job.id}

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com`;

  return await sendTemplateMessage(
    job.customerPhone,
    TWILIO_CONFIG.templates.jobAccepted,
    { '1': job.customerName, '2': handyman.name, '3': job.serviceType, '4': job.id },
    fallbackMessage
  );
};

/**
 * Send job creation confirmation to customer after payment success.
 * Uses the job_created template for business-initiated messages.
 *
 * Template variables: {{1}} customerName, {{2}} serviceType, {{3}} amount, {{4}} jobId, {{5}} timing
 *
 * @param {object} jobData - Job data object containing customer info and job details
 * @returns {Promise<object>} - API response
 */
export const sendJobCreationNotification = async (jobData) => {
  // Format timing information
  const timingText = jobData.preferredTiming === 'Schedule'
    ? `${new Date(jobData.preferredDate).toLocaleDateString()} at ${jobData.preferredTime}`
    : 'As soon as possible';

  console.log('📋 Sending job creation notification:');
  console.log(`Customer: ${jobData.customerName}`);
  console.log(`Service: ${jobData.serviceType}`);
  console.log(`Budget: $${jobData.estimatedBudget}`);
  console.log(`Job ID: ${jobData.id || 'Pending'}`);

  // Fallback freeform message for sandbox testing
  const fallbackMessage = `Hi ${jobData.customerName}! 👋

Your job request has been posted successfully! ✅

📋 *Service:* ${jobData.serviceType}
💰 *Service Fee:* $${jobData.estimatedBudget}
🔖 *Job ID:* ${jobData.id || 'Pending'}
📅 *Timing:* ${timingText}

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone! 🔧`;

  return await sendTemplateMessage(
    jobData.customerPhone,
    TWILIO_CONFIG.templates.jobCreated,
    {
      '1': jobData.customerName,
      '2': jobData.serviceType,
      '3': `${jobData.estimatedBudget}`,
      '4': jobData.id || 'Pending',
      '5': timingText
    },
    fallbackMessage
  );
};

/**
 * Send custom message (freeform — only works within 24hr session window)
 *
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<object>} - API response
 */
export const sendCustomMessage = async (to, message) => {
  return await sendTextMessage(to, message);
};

// Export all functions
export default {
  isWhatsAppConfigured,
  formatPhoneNumber,
  sendTextMessage,
  sendTemplateMessage,
  sendJobCompletionNotification,
  sendJobAcceptanceNotification,
  sendJobCreationNotification,
  sendCustomMessage
};
