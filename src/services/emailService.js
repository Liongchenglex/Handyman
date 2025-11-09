/**
 * Email Service
 *
 * Handles sending emails for handyman registration notifications
 *
 * Setup Instructions:
 * 1. Create account at https://www.emailjs.com/ (free tier: 200 emails/month)
 * 2. Create email service (Gmail, Outlook, etc.)
 * 3. Create two email templates in EmailJS dashboard
 * 4. Add credentials to .env.local file:
 *    REACT_APP_EMAILJS_SERVICE_ID=your_service_id
 *    REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key
 *    REACT_APP_OPERATIONS_EMAIL=your_operations_email
 */

import emailjs from '@emailjs/browser';
import { EMAIL_CONFIG, HANDYMAN_ACKNOWLEDGMENT_EMAIL, OPERATIONS_NOTIFICATION_EMAIL } from '../config/emailConfig';

/**
 * Initialize EmailJS
 */
export const initializeEmailService = () => {
  if (EMAIL_CONFIG.EMAILJS_PUBLIC_KEY) {
    emailjs.init(EMAIL_CONFIG.EMAILJS_PUBLIC_KEY);
  } else {
    console.warn('EmailJS public key not configured. Emails will not be sent.');
  }
};

/**
 * Generate approval token for handyman
 * @param {string} handymanId - Handyman user ID
 * @returns {string} Base64 encoded token
 */
export const generateApprovalToken = (handymanId) => {
  const timestamp = Date.now();
  const tokenData = {
    handymanId,
    timestamp,
    // Add a simple verification hash (in production, use proper JWT)
    hash: btoa(`${handymanId}-${timestamp}-${process.env.REACT_APP_APPROVAL_SECRET || 'default-secret'}`)
  };
  return btoa(JSON.stringify(tokenData));
};

/**
 * Verify approval token
 * @param {string} token - Base64 encoded token
 * @returns {Object|null} Decoded token data or null if invalid
 */
export const verifyApprovalToken = (token) => {
  try {
    const decoded = JSON.parse(atob(token));
    // Token expires after 30 days
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - decoded.timestamp > thirtyDays) {
      return null;
    }
    return decoded;
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
};

/**
 * Send acknowledgment email to handyman
 * @param {Object} handymanData - Handyman registration data
 * @returns {Promise} EmailJS response
 */
export const sendHandymanAcknowledgment = async (handymanData) => {
  try {
    console.log('Sending acknowledgment email to:', handymanData.email);

    // For EmailJS, we'll send using direct email
    // Alternative: Use template IDs from EmailJS dashboard

    const emailTemplate = HANDYMAN_ACKNOWLEDGMENT_EMAIL(handymanData);

    // Using EmailJS send method
    // Note: You need to configure this in EmailJS dashboard
    const templateParams = {
      to_email: handymanData.email,
      to_name: handymanData.name,
      subject: emailTemplate.subject,
      message_html: emailTemplate.html,
      company_name: EMAIL_CONFIG.COMPANY_NAME
    };

    // If EmailJS is configured, send via EmailJS
    if (EMAIL_CONFIG.EMAILJS_SERVICE_ID && EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_HANDYMAN) {
      const response = await emailjs.send(
        EMAIL_CONFIG.EMAILJS_SERVICE_ID,
        EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_HANDYMAN,
        templateParams
      );
      console.log('✅ Handyman acknowledgment email sent successfully:', response);
      return response;
    } else {
      // Fallback: Log email content for now
      console.log('📧 Email content (EmailJS not configured):');
      console.log('To:', handymanData.email);
      console.log('Subject:', emailTemplate.subject);
      console.log('---Email Preview---');
      console.log(emailTemplate.html.substring(0, 500) + '...');

      // In production, this should call a backend API or Cloud Function
      return { status: 'simulated', message: 'Email logged to console' };
    }
  } catch (error) {
    console.error('❌ Error sending handyman acknowledgment email:', error);
    throw error;
  }
};

/**
 * Send notification email to operations team
 * @param {Object} handymanData - Handyman registration data
 * @returns {Promise} EmailJS response
 */
export const sendOperationsNotification = async (handymanData) => {
  try {
    console.log('Sending operations notification email to:', EMAIL_CONFIG.OPERATIONS_EMAIL);

    // Generate approval token
    const approvalToken = generateApprovalToken(handymanData.uid);

    const emailTemplate = OPERATIONS_NOTIFICATION_EMAIL(handymanData, approvalToken);

    const templateParams = {
      to_email: EMAIL_CONFIG.OPERATIONS_EMAIL,
      subject: emailTemplate.subject,
      message_html: emailTemplate.html,
      handyman_name: handymanData.name,
      handyman_email: handymanData.email,
      handyman_id: handymanData.uid,
      approval_token: approvalToken
    };

    // If EmailJS is configured, send via EmailJS
    if (EMAIL_CONFIG.EMAILJS_SERVICE_ID && EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_OPERATIONS) {
      const response = await emailjs.send(
        EMAIL_CONFIG.EMAILJS_SERVICE_ID,
        EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_OPERATIONS,
        templateParams
      );
      console.log('✅ Operations notification email sent successfully:', response);
      return response;
    } else {
      // Fallback: Log email content for now
      console.log('📧 Operations Email (EmailJS not configured):');
      console.log('To:', EMAIL_CONFIG.OPERATIONS_EMAIL);
      console.log('Subject:', emailTemplate.subject);
      console.log('Approval Link:', `${EMAIL_CONFIG.APPROVAL_BASE_URL}?token=${approvalToken}&action=approve`);
      console.log('---Email Preview---');
      console.log(emailTemplate.html.substring(0, 500) + '...');

      // Store approval token in sessionStorage for testing
      if (typeof window !== 'undefined') {
        const pendingApprovals = JSON.parse(sessionStorage.getItem('pendingApprovals') || '[]');
        pendingApprovals.push({ handymanId: handymanData.uid, token: approvalToken, data: handymanData });
        sessionStorage.setItem('pendingApprovals', JSON.stringify(pendingApprovals));
        console.log('💾 Approval data stored in sessionStorage for testing');
      }

      return { status: 'simulated', message: 'Email logged to console', token: approvalToken };
    }
  } catch (error) {
    console.error('❌ Error sending operations notification email:', error);
    throw error;
  }
};

/**
 * Send both handyman acknowledgment and operations notification
 * @param {Object} handymanData - Handyman registration data
 * @returns {Promise<Object>} Results from both emails
 */
export const sendRegistrationEmails = async (handymanData) => {
  try {
    const results = await Promise.allSettled([
      sendHandymanAcknowledgment(handymanData),
      sendOperationsNotification(handymanData)
    ]);

    const [handymanResult, opsResult] = results;

    return {
      handymanEmail: handymanResult.status === 'fulfilled' ? handymanResult.value : null,
      operationsEmail: opsResult.status === 'fulfilled' ? opsResult.value : null,
      errors: results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason)
    };
  } catch (error) {
    console.error('Error sending registration emails:', error);
    throw error;
  }
};

export default {
  initializeEmailService,
  sendHandymanAcknowledgment,
  sendOperationsNotification,
  sendRegistrationEmails,
  generateApprovalToken,
  verifyApprovalToken
};
