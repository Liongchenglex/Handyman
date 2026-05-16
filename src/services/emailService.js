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
import {
  EMAIL_CONFIG,
  HANDYMAN_ACKNOWLEDGMENT_EMAIL,
  OPERATIONS_NOTIFICATION_EMAIL,
  HANDYMAN_APPROVAL_EMAIL,
  HANDYMAN_REJECTION_EMAIL,
} from '../config/emailConfig';
import { callFunction } from './api/cloudFunctions';

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
 * Request a server-signed approval token for a handyman.
 *
 * The token is an HS256 JWT signed by the Cloud Functions environment
 * variable APPROVAL_SECRET — the secret never reaches the browser,
 * which closes the historical "secret-in-the-bundle" gap. The caller
 * must be authenticated; the backend additionally enforces that a
 * non-admin caller may only mint a token for their OWN handymanId.
 *
 * @param {string} handymanId
 * @returns {Promise<string>} The signed JWT.
 */
export const generateApprovalToken = async (handymanId) => {
  const result = await callFunction('generateApprovalToken', { handymanId });
  if (!result || !result.token) {
    throw new Error('Approval token endpoint returned no token');
  }
  return result.token;
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

    // Request a server-signed approval token. If the backend isn't
    // reachable (offline, function not deployed yet) we still log the
    // operator email so the registration UI doesn't block — but we
    // surface the error in the result so callers know the operations
    // team won't receive a working link.
    let approvalToken;
    try {
      approvalToken = await generateApprovalToken(handymanData.uid);
    } catch (tokenErr) {
      console.error('❌ Could not mint approval token from server:', tokenErr);
      return { status: 'failed', error: 'Approval token service unavailable' };
    }

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
      // Fallback path: EmailJS isn't configured. In development this
      // surfaces the approval link via the console so the operator can
      // click through manually. In production we DO NOT log the token
      // or persist it to sessionStorage — that would leak a privileged
      // approval credential to anyone with devtools access. Production
      // deployments must configure EmailJS (or the equivalent server-
      // side sender from Batch B) before going live.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('📧 Operations Email (EmailJS not configured) — dev fallback only.');
        console.log('To:', EMAIL_CONFIG.OPERATIONS_EMAIL);
        console.log('Subject:', emailTemplate.subject);
        console.log('Approval Link:', `${EMAIL_CONFIG.APPROVAL_BASE_URL}?token=${approvalToken}&action=approve`);

        if (typeof window !== 'undefined') {
          const pendingApprovals = JSON.parse(sessionStorage.getItem('pendingApprovals') || '[]');
          pendingApprovals.push({ handymanId: handymanData.uid, token: approvalToken, data: handymanData });
          sessionStorage.setItem('pendingApprovals', JSON.stringify(pendingApprovals));
        }
      } else {
        // Loud signal in production. The handyman registration still
        // succeeded in Firestore — operations can approve via the
        // admin console — but the email notification did not go out.
        console.error('Operations notification email failed: EmailJS service or template not configured.');
      }

      return { status: 'simulated', message: 'Email not sent (EmailJS not configured)' };
    }
  } catch (error) {
    console.error('❌ Error sending operations notification email:', error);
    throw error;
  }
};

/**
 * Send approval-confirmation email to handyman after operations approves them.
 * Mirrors the fall-back-to-console pattern of the other senders so launch
 * doesn't get blocked on EmailJS template setup.
 *
 * @param {Object} handymanData - { name, email, ... }
 * @returns {Promise} EmailJS response or simulated stub
 */
export const sendApprovalEmail = async (handymanData) => {
  try {
    const emailTemplate = HANDYMAN_APPROVAL_EMAIL(handymanData);
    const templateParams = {
      to_email: handymanData.email,
      to_name: handymanData.name,
      subject: emailTemplate.subject,
      message_html: emailTemplate.html,
      company_name: EMAIL_CONFIG.COMPANY_NAME,
    };

    if (EMAIL_CONFIG.EMAILJS_SERVICE_ID && EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_APPROVAL) {
      const response = await emailjs.send(
        EMAIL_CONFIG.EMAILJS_SERVICE_ID,
        EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_APPROVAL,
        templateParams
      );
      console.log('✅ Approval email sent to', handymanData.email);
      return response;
    }

    console.warn('📧 EmailJS approval template not configured — logging only.');
    console.log('To:', handymanData.email, 'Subject:', emailTemplate.subject);
    return { status: 'simulated', message: 'Approval email logged to console' };
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    // Swallow — approval flow shouldn't fail just because email did.
    return { status: 'failed', error: error.message };
  }
};

/**
 * Send rejection email to handyman after operations rejects them.
 *
 * @param {Object} handymanData - { name, email, ... }
 * @param {string} reason - Optional human-readable rejection reason.
 * @returns {Promise} EmailJS response or simulated stub
 */
export const sendRejectionEmail = async (handymanData, reason = '') => {
  try {
    const emailTemplate = HANDYMAN_REJECTION_EMAIL(handymanData, reason);
    const templateParams = {
      to_email: handymanData.email,
      to_name: handymanData.name,
      subject: emailTemplate.subject,
      message_html: emailTemplate.html,
      company_name: EMAIL_CONFIG.COMPANY_NAME,
      reason,
    };

    if (EMAIL_CONFIG.EMAILJS_SERVICE_ID && EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_REJECTION) {
      const response = await emailjs.send(
        EMAIL_CONFIG.EMAILJS_SERVICE_ID,
        EMAIL_CONFIG.EMAILJS_TEMPLATE_ID_REJECTION,
        templateParams
      );
      console.log('✅ Rejection email sent to', handymanData.email);
      return response;
    }

    console.warn('📧 EmailJS rejection template not configured — logging only.');
    console.log('To:', handymanData.email, 'Subject:', emailTemplate.subject);
    return { status: 'simulated', message: 'Rejection email logged to console' };
  } catch (error) {
    console.error('❌ Error sending rejection email:', error);
    return { status: 'failed', error: error.message };
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

// verifyApprovalToken is no longer exported — token verification now
// happens server-side via the processHandymanApproval Cloud Function
// so the signing secret can stay on the server.
const emailService = {
  initializeEmailService,
  sendHandymanAcknowledgment,
  sendOperationsNotification,
  sendRegistrationEmails,
  sendApprovalEmail,
  sendRejectionEmail,
  generateApprovalToken,
};

export default emailService;
