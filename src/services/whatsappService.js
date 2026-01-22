/**
 * WhatsApp Notification Service (Twilio API)
 *
 * Handles all WhatsApp message sending via Twilio WhatsApp API
 * Supports both template messages and freeform text messages
 *
 * Setup:
 * 1. Create Twilio account at https://www.twilio.com
 * 2. Get WhatsApp sandbox or production number
 * 3. Add to .env.local:
 *    - REACT_APP_TWILIO_ACCOUNT_SID
 *    - REACT_APP_TWILIO_AUTH_TOKEN
 *    - REACT_APP_TWILIO_WHATSAPP_FROM (format: whatsapp:+14155238886)
 * 4. Install Twilio SDK: npm install twilio
 */

const TWILIO_CONFIG = {
  accountSid: process.env.REACT_APP_TWILIO_ACCOUNT_SID,
  authToken: process.env.REACT_APP_TWILIO_AUTH_TOKEN,
  whatsappFrom: process.env.REACT_APP_TWILIO_WHATSAPP_FROM
};

// Twilio Content Template SIDs (update these after creating templates in Twilio Console)
const TWILIO_TEMPLATES = {
  JOB_PAYMENT_CONFIRMATION: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT || null,
  HANDYMAN_ACCEPTED_JOB: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED || null,
  JOB_COMPLETION_CONFIRMED: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED || null
};

/**
 * Check if WhatsApp/Twilio is configured
 */
export const isWhatsAppConfigured = () => {
  return !!(TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken && TWILIO_CONFIG.whatsappFrom);
};

/**
 * Format phone number for Twilio WhatsApp API (E.164 format with whatsapp: prefix)
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted phone number (e.g., whatsapp:+6591234567)
 */
export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it doesn't start with +, add it
  if (!cleaned.startsWith('+')) {
    // If it doesn't have country code, assume Singapore (65)
    if (cleaned.length === 8) {
      cleaned = `+65${cleaned}`;
    } else if (cleaned.length >= 10) {
      cleaned = `+${cleaned}`;
    } else {
      // Fallback - assume Singapore
      cleaned = `+65${cleaned}`;
    }
  }

  // Add whatsapp: prefix if not already present
  if (!cleaned.startsWith('whatsapp:')) {
    cleaned = `whatsapp:${cleaned}`;
  }

  return cleaned;
};

/**
 * Get Twilio client instance (lazy initialization)
 * Note: Twilio SDK doesn't work in browser, so we use REST API directly
 */
const getTwilioClient = () => {
  // For browser environment, we'll use fetch API instead of Twilio SDK
  // This is because Twilio SDK is designed for Node.js server-side use
  return null;
};

/**
 * Send a message via Twilio REST API (browser-compatible)
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body (optional if using contentSid)
 * @param {string} contentSid - Twilio Content Template SID (optional)
 * @param {object} contentVariables - Template variables (optional)
 * @returns {Promise<object>} - API response
 */
const sendViaTwilioAPI = async (to, body = null, contentSid = null, contentVariables = null) => {
  const formattedPhone = formatPhoneNumber(to);

  // Create form data for Twilio API
  const formData = new URLSearchParams();
  formData.append('From', TWILIO_CONFIG.whatsappFrom);
  formData.append('To', formattedPhone);

  if (contentSid) {
    // Template message
    formData.append('ContentSid', contentSid);
    if (contentVariables) {
      formData.append('ContentVariables', JSON.stringify(contentVariables));
    }
  } else if (body) {
    // Plain text message
    formData.append('Body', body);
  } else {
    throw new Error('Either body or contentSid must be provided');
  }

  // Twilio uses Basic Auth
  const auth = btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Twilio API Error:', data);
    throw new Error(data.message || 'Failed to send WhatsApp message');
  }

  return data;
};

/**
 * Send a template message via WhatsApp using Twilio Content API
 * Templates must be pre-approved by WhatsApp
 *
 * @param {string} to - Recipient phone number
 * @param {string} contentSid - Twilio Content Template SID (e.g., 'HXxxxxx')
 * @param {object} contentVariables - Template variables (e.g., { '1': 'John', '2': 'Plumbing' })
 * @returns {Promise<object>} - API response
 */
export const sendTemplateMessage = async (to, contentSid, contentVariables = {}) => {
  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp/Twilio not configured. Message not sent.');
    console.log(`📱 WhatsApp Template [FALLBACK - Not Configured]:`);
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
    console.log('📱 Sending WhatsApp template message via Twilio...');
    console.log(`To: ${to}`);
    console.log(`Template SID: ${contentSid}`);
    console.log(`Variables:`, contentVariables);

    const data = await sendViaTwilioAPI(to, null, contentSid, contentVariables);

    console.log('✅ WhatsApp template sent successfully');
    console.log('Message SID:', data.sid);
    console.log('Status:', data.status);

    return {
      success: true,
      messageSid: data.sid,
      status: data.status,
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
 * Send a text message via WhatsApp (Twilio)
 * NOTE: Text messages can only be sent within 24-hour customer service window
 * For proactive messages, use sendTemplateMessage instead
 *
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text to send
 * @returns {Promise<object>} - API response
 */
export const sendTextMessage = async (to, message) => {
  // Check if WhatsApp is configured
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp/Twilio not configured. Message not sent.');
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
    console.log('📱 Sending WhatsApp text message via Twilio...');
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);

    const data = await sendViaTwilioAPI(to, message);

    console.log('✅ WhatsApp message sent successfully');
    console.log('Message SID:', data.sid);
    console.log('Status:', data.status);

    return {
      success: true,
      messageSid: data.sid,
      status: data.status,
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
 * Uses text message (assumes within 24-hour window after job acceptance)
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
 * Uses Twilio Content Template for WhatsApp approval compliance
 *
 * @param {object} job - Job object
 * @param {object} handyman - Handyman object
 * @returns {Promise<object>} - API response
 */
export const sendJobAcceptanceNotification = async (job, handyman) => {
  const templateSid = TWILIO_TEMPLATES.HANDYMAN_ACCEPTED_JOB;

  if (!templateSid) {
    console.warn('⚠️ Template not configured: HANDYMAN_ACCEPTED_JOB');
    console.log('📱 Fallback to text message (may fail if outside 24hr window)');

    // Fallback to text message
    const message = `Great news! ${handyman.name} has accepted your job "${job.serviceType}". They will contact you shortly to discuss the details. Job ID: ${job.id}`;
    return await sendTextMessage(job.customerPhone, message);
  }

  // Use approved template with variables
  const contentVariables = {
    '1': job.customerName,      // {{1}} = Customer name
    '2': handyman.name,          // {{2}} = Handyman name
    '3': job.serviceType,        // {{3}} = Service type
    '4': job.id                  // {{4}} = Job ID
  };

  return await sendTemplateMessage(job.customerPhone, templateSid, contentVariables);
};

/**
 * Send job creation confirmation to customer after payment success
 * Uses Twilio Content Template for WhatsApp approval compliance
 *
 * @param {object} jobData - Job data object containing customer info and job details
 * @returns {Promise<object>} - API response
 */
export const sendJobCreationNotification = async (jobData) => {
  const templateSid = TWILIO_TEMPLATES.JOB_PAYMENT_CONFIRMATION;

  if (!templateSid) {
    console.warn('⚠️ Template not configured: JOB_PAYMENT_CONFIRMATION');
    console.log('📋 Job Creation Details (template not sent):');
    console.log(`Customer: ${jobData.customerName}`);
    console.log(`Service: ${jobData.serviceType}`);
    console.log(`Budget: $${jobData.estimatedBudget}`);
    console.log(`Job ID: ${jobData.id || 'Pending'}`);

    return {
      success: false,
      error: 'Template not configured',
      fallback: true
    };
  }

  // Format timing information
  const timingText = jobData.preferredTiming === 'Schedule'
    ? `${new Date(jobData.preferredDate).toLocaleDateString()} at ${jobData.preferredTime}`
    : 'ASAP';

  // Use approved template with variables
  const contentVariables = {
    '1': jobData.customerName,              // {{1}} = Customer name
    '2': jobData.serviceType,               // {{2}} = Service type
    '3': `$${jobData.estimatedBudget}`,     // {{3}} = Budget
    '4': jobData.id || 'Pending',           // {{4}} = Job ID
    '5': timingText                         // {{5}} = Timing
  };

  console.log('📋 Sending job creation notification:');
  console.log(`Customer: ${jobData.customerName}`);
  console.log(`Service: ${jobData.serviceType}`);
  console.log(`Budget: $${jobData.estimatedBudget}`);
  console.log(`Job ID: ${jobData.id || 'Pending'}`);

  return await sendTemplateMessage(jobData.customerPhone, templateSid, contentVariables);
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
