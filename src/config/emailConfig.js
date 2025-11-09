/**
 * Email Configuration
 *
 * Configure email settings for the handyman platform
 */

export const EMAIL_CONFIG = {
  // Operations team email - receives handyman registration notifications
  OPERATIONS_EMAIL: process.env.REACT_APP_OPERATIONS_EMAIL || 'operations@eazydone.com',

  // Company details for email templates
  COMPANY_NAME: 'EazyDone',
  COMPANY_SUPPORT_EMAIL: 'support@eazydone.com',

  // Email service configuration (using EmailJS - free tier)
  // Sign up at: https://www.emailjs.com/
  EMAILJS_SERVICE_ID: process.env.REACT_APP_EMAILJS_SERVICE_ID || '',
  EMAILJS_TEMPLATE_ID_HANDYMAN: process.env.REACT_APP_EMAILJS_TEMPLATE_HANDYMAN || '',
  EMAILJS_TEMPLATE_ID_OPERATIONS: process.env.REACT_APP_EMAILJS_TEMPLATE_OPERATIONS || '',
  EMAILJS_PUBLIC_KEY: process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '',

  // Approval link base URL
  APPROVAL_BASE_URL: process.env.REACT_APP_APPROVAL_BASE_URL || 'https://eazydone-d06cf.web.app/admin/approve-handyman'
};

/**
 * Email Templates
 */

// Handyman acknowledgment email template
export const HANDYMAN_ACKNOWLEDGMENT_EMAIL = (handymanData) => ({
  subject: 'Welcome to EazyDone - Registration Received!',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FFD60A; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #FFD60A; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #000;">Welcome to EazyDone!</h1>
        </div>
        <div class="content">
          <h2>Hi ${handymanData.name},</h2>

          <p>Thank you for registering as a handyman with EazyDone! We're excited to have you on our platform.</p>

          <p><strong>Registration Details:</strong></p>
          <ul>
            <li><strong>Name:</strong> ${handymanData.name}</li>
            <li><strong>Email:</strong> ${handymanData.email}</li>
            <li><strong>Phone:</strong> ${handymanData.phone}</li>
            <li><strong>Service Types:</strong> ${handymanData.serviceTypes.join(', ')}</li>
            <li><strong>Experience Level:</strong> ${handymanData.experienceLevel}</li>
            <li><strong>Service Areas:</strong> ${handymanData.serviceAreas.join(', ')}</li>
          </ul>

          <p><strong>What's Next?</strong></p>
          <p>Our operations team is currently reviewing your application. This typically takes 1-2 business days. We'll notify you via email once your account is approved.</p>

          <p>Once approved, you'll be able to:</p>
          <ul>
            <li>Browse and accept job requests in your area</li>
            <li>Build your reputation through customer reviews</li>
            <li>Earn money doing what you do best</li>
          </ul>

          <p>If you have any questions, feel free to reach out to our support team at <a href="mailto:support@eazydone.com">support@eazydone.com</a>.</p>

          <p>Best regards,<br>
          <strong>The EazyDone Team</strong></p>
        </div>
        <div class="footer">
          <p>© 2024 EazyDone. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
});

// Operations team notification email template
export const OPERATIONS_NOTIFICATION_EMAIL = (handymanData, approvalToken) => ({
  subject: `New Handyman Registration: ${handymanData.name}`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; color: white; }
        .content { background: #f9f9f9; padding: 30px; }
        .section { margin-bottom: 25px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #FFD60A; }
        .approve-button { display: inline-block; padding: 15px 30px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .reject-button { display: inline-block; padding: 15px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0 20px 10px; }
        .info-row { margin: 8px 0; }
        .label { font-weight: bold; color: #555; min-width: 150px; display: inline-block; }
        .value { color: #000; }
        .documents { margin-top: 10px; }
        .document-link { display: block; margin: 5px 0; color: #2563eb; text-decoration: none; }
        .document-link:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">New Handyman Registration</h1>
          <p style="margin: 10px 0 0 0;">Action Required: Review & Approve</p>
        </div>

        <div class="content">
          <div class="section">
            <h2 style="margin-top: 0; color: #2563eb;">Personal Information</h2>
            <div class="info-row">
              <span class="label">Full Name:</span>
              <span class="value">${handymanData.name}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">${handymanData.email}</span>
            </div>
            <div class="info-row">
              <span class="label">Phone:</span>
              <span class="value">${handymanData.phone}</span>
            </div>
            <div class="info-row">
              <span class="label">Address:</span>
              <span class="value">${handymanData.address}, ${handymanData.postalCode}</span>
            </div>
            <div class="info-row">
              <span class="label">User ID:</span>
              <span class="value">${handymanData.uid}</span>
            </div>
          </div>

          <div class="section">
            <h2 style="margin-top: 0; color: #2563eb;">Professional Information</h2>
            <div class="info-row">
              <span class="label">Service Types:</span>
              <span class="value">${handymanData.serviceTypes.join(', ')}</span>
            </div>
            <div class="info-row">
              <span class="label">Experience Level:</span>
              <span class="value">${handymanData.experienceLevel}</span>
            </div>
            <div class="info-row">
              <span class="label">Hourly Rate:</span>
              <span class="value">SGD $${handymanData.hourlyRate}/hour</span>
            </div>
            <div class="info-row">
              <span class="label">Service Areas:</span>
              <span class="value">${handymanData.serviceAreas.join(', ')}</span>
            </div>
            <div class="info-row">
              <span class="label">Availability:</span>
              <span class="value">${handymanData.availability}</span>
            </div>
          </div>

          <div class="section">
            <h2 style="margin-top: 0; color: #2563eb;">Service Description</h2>
            <p style="margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 4px;">${handymanData.description}</p>
          </div>

          ${handymanData.profileImageUrl ? `
          <div class="section">
            <h2 style="margin-top: 0; color: #2563eb;">Profile Picture</h2>
            <img src="${handymanData.profileImageUrl}" alt="Profile" style="max-width: 200px; border-radius: 8px; border: 2px solid #ddd;" />
            <br>
            <a href="${handymanData.profileImageUrl}" target="_blank" class="document-link">View Full Size</a>
          </div>
          ` : ''}

          ${handymanData.workExperienceUrls && handymanData.workExperienceUrls.length > 0 ? `
          <div class="section">
            <h2 style="margin-top: 0; color: #2563eb;">Work Experience / CV Documents</h2>
            <div class="documents">
              ${handymanData.workExperienceUrls.map((url, index) => `
                <a href="${url}" target="_blank" class="document-link">📄 Document ${index + 1} - View/Download</a>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div class="section">
            <h2 style="margin-top: 0; color: #2563eb;">Notification Preferences</h2>
            <div class="info-row">
              <span class="label">WhatsApp:</span>
              <span class="value">${handymanData.preferences?.whatsappNotifications ? '✓ Yes' : '✗ No'}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">${handymanData.preferences?.emailNotifications ? '✓ Yes' : '✗ No'}</span>
            </div>
            <div class="info-row">
              <span class="label">SMS:</span>
              <span class="value">${handymanData.preferences?.smsNotifications ? '✓ Yes' : '✗ No'}</span>
            </div>
          </div>

          <div class="section" style="background: #fef3c7; border-left-color: #f59e0b;">
            <h2 style="margin-top: 0; color: #f59e0b;">Action Required</h2>
            <p>Please review the handyman's information and documents, then approve or reject their registration:</p>

            <a href="${EMAIL_CONFIG.APPROVAL_BASE_URL}?token=${approvalToken}&action=approve" class="approve-button">
              ✓ Approve Registration
            </a>

            <a href="${EMAIL_CONFIG.APPROVAL_BASE_URL}?token=${approvalToken}&action=reject" class="reject-button">
              ✗ Reject Registration
            </a>

            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              <strong>Note:</strong> Clicking the approve button will activate the handyman's account and send them a confirmation email. The reject button will notify them that their application was not approved.
            </p>
          </div>

          <div style="margin-top: 20px; padding: 15px; background: #e5e7eb; border-radius: 6px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              <strong>Registered:</strong> ${new Date(handymanData.registeredAt).toLocaleString()}<br>
              <strong>Direct Link to Firestore:</strong> <a href="https://console.firebase.google.com/project/eazydone-d06cf/firestore/data/handymen/${handymanData.uid}" target="_blank">View in Firebase Console</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
});
