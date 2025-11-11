/**
 * WhatsApp Business API Service
 *
 * Handles all WhatsApp message sending via Meta Cloud API
 * Supports both sandbox (testing) and production environments
 *
 * Setup:
 * 1. Get credentials from Meta for Developers (https://developers.facebook.com/)
 * 2. Add to .env.local:
 *    - REACT_APP_WHATSAPP_PHONE_NUMBER_ID
 *    - REACT_APP_WHATSAPP_ACCESS_TOKEN
 *    - REACT_APP_WHATSAPP_API_VERSION (optional, defaults to v18.0)
 */

const WHATSAPP_CONFIG = {
  phoneNumberId: process.env.REACT_APP_WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.REACT_APP_WHATSAPP_ACCESS_TOKEN,
  apiVersion: process.env.REACT_APP_WHATSAPP_API_VERSION || 'v18.0'
};

/**
 * Check if WhatsApp is configured
 */
export const isWhatsAppConfigured = () => {
  return !!(WHATSAPP_CONFIG.phoneNumberId && WHATSAPP_CONFIG.accessToken);
};

/**
 * Format phone number for WhatsApp API
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted phone number (e.g., 6591234567) - NO + prefix for Meta API
 */
export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it doesn't start with country code, assume Singapore (65)
  if (digits.length === 8) {
    // Singapore number without country code
    return `65${digits}`;
  }

  // Already has country code (10+ digits)
  if (digits.length >= 10) {
    return digits;
  }

  // Fallback - return as is
  return digits;
};

/**
 * Send a template message via WhatsApp
 * Templates must be pre-approved by Meta and are required for proactive messages
 *
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Name of approved template (e.g., 'hello_world')
 * @param {string} languageCode - Language code (e.g., 'en_US')
 * @returns {Promise<object>} - API response
 */
export const sendTemplateMessage = async (to, templateName = 'hello_world', languageCode = 'en_US') => {
  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp not configured. Message not sent.');
    console.log(`📱 WhatsApp Template [FALLBACK - Not Configured]:`);
    console.log(`To: ${to}`);
    console.log(`Template: ${templateName}`);
    return {
      success: false,
      error: 'WhatsApp not configured',
      fallback: true
    };
  }

  try {
    // Format phone number
    const formattedPhone = formatPhoneNumber(to);

    console.log('📱 Sending WhatsApp template message...');
    console.log(`To: ${formattedPhone}`);
    console.log(`Template: ${templateName}`);

    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API Error:', data);
      throw new Error(data.error?.message || 'Failed to send WhatsApp template');
    }

    console.log('✅ WhatsApp template sent successfully');
    console.log('Message ID:', data.messages?.[0]?.id);

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      data
    };

  } catch (error) {
    console.error('❌ Error sending WhatsApp template:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a text message via WhatsApp
 * NOTE: Text messages can only be sent within 24-hour customer service window
 * For proactive messages, use sendTemplateMessage instead
 *
 * @param {string} to - Recipient phone number (E.164 format: +6591234567)
 * @param {string} message - Message text to send
 * @returns {Promise<object>} - API response
 */
export const sendTextMessage = async (to, message) => {
  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp not configured. Message not sent.');
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
    // Format phone number
    const formattedPhone = formatPhoneNumber(to);

    console.log('📱 Sending WhatsApp message...');
    console.log(`To: ${formattedPhone}`);
    console.log(`Message: ${message}`);

    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API Error:', data);
      throw new Error(data.error?.message || 'Failed to send WhatsApp message');
    }

    console.log('✅ WhatsApp message sent successfully');
    console.log('Message ID:', data.messages?.[0]?.id);

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
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
 * Send job completion notification to customer
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobCompletionNotification = async (job, handyman) => {
  const message = `Hello ${job.customerName}, your handyman ${handyman.name} has marked the job "${job.serviceType}" as complete. Please review and confirm completion in the EazyDone app.`;

  return await sendTextMessage(job.customerPhone, message);
};

/**
 * Send job acceptance notification to customer
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobAcceptanceNotification = async (job, handyman) => {
  const message = `Great news! ${handyman.name} has accepted your job "${job.serviceType}". They will contact you shortly to discuss the details. Job ID: ${job.id}`;

  return await sendTextMessage(job.customerPhone, message);
};

/**
 * Send job creation confirmation to customer
 *
 * NOTE: For testing, this uses the 'hello_world' template
 * In production, you should create and use a custom approved template with job details
 *
 * @param {object} jobData - Job data object containing customer info and job details
 * @returns {Promise<object>} - API response
 */
export const sendJobCreationNotification = async (jobData) => {
  // For testing: Use hello_world template (pre-approved in Meta sandbox)
  // TODO: In production, replace with custom approved template that includes job details

  console.log('📋 Job Creation Details (would be in template):');
  console.log(`Customer: ${jobData.customerName}`);
  console.log(`Service: ${jobData.serviceType}`);
  console.log(`Budget: $${jobData.estimatedBudget}`);
  console.log(`Job ID: ${jobData.id || 'Pending'}`);

  // Send hello_world template for now
  return await sendTemplateMessage(jobData.customerPhone, 'hello_world', 'en_US');

  /*
  // Future: When you have custom templates approved, use this instead:
  const timingText = jobData.preferredTiming === 'Schedule'
    ? `on ${new Date(jobData.preferredDate).toLocaleDateString()} at ${jobData.preferredTime}`
    : 'as soon as possible';

  const message = `Hi ${jobData.customerName}, your job request for "${jobData.serviceType}" has been received! We'll notify you when a handyman accepts your job. Scheduled ${timingText}. Service fee: $${jobData.estimatedBudget}. Job ID: ${jobData.id || 'Pending'}`;

  return await sendTextMessage(jobData.customerPhone, message);
  */
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
