# WhatsApp Message Templates (Twilio)

This document contains the WhatsApp message templates that need to be created in Twilio Console and submitted for WhatsApp approval.

## Overview

WhatsApp requires all proactive messages (messages sent outside the 24-hour customer service window) to use pre-approved templates. These templates must be created in the Twilio Console and submitted to WhatsApp for approval.

---

## Required Templates

### 1. Job Payment Confirmation (After Payment Success)

**Template Name:** `job_payment_confirmation`
**Purpose:** Notify customer that their job has been posted successfully after payment
**Trigger:** After payment is captured and job status changes to `pending`
**Language:** English
**Category:** TRANSACTIONAL

**Template Content:**
```
Hi {{1}}, your job request for "{{2}}" has been posted successfully!

Service Fee: {{3}}
Job ID: {{4}}
Timing: {{5}}

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

**Template Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Service type (e.g., "Plumbing Repair", "Aircon Servicing")
- `{{3}}` - Service fee (e.g., "$150.00")
- `{{4}}` - Job ID
- `{{5}}` - Timing preference (e.g., "ASAP" or "2025-01-25 at 2:00 PM")

**Sample Message:**
```
Hi John Tan, your job request for "Plumbing Repair" has been posted successfully!

Service Fee: $150.00
Job ID: abc123xyz
Timing: 2025-01-25 at 2:00 PM

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

**Code Reference:**
Environment Variable: `REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT`
File: `src/services/whatsappService.js:286`
Function: `sendJobCreationNotification()`

---

### 2. Handyman Accepted Job (Job Acceptance Notification)

**Template Name:** `handyman_accepted_job`
**Purpose:** Notify customer that a handyman has accepted their job
**Trigger:** When handyman clicks "Express Interest" and job status changes to `in_progress`
**Language:** English
**Category:** TRANSACTIONAL

**Template Content:**
```
Great news, {{1}}!

{{2}} has accepted your "{{3}}" job.

Job ID: {{4}}

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com
```

**Template Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Handyman name
- `{{3}}` - Service type
- `{{4}}` - Job ID

**Sample Message:**
```
Great news, John Tan!

Michael Lee has accepted your "Plumbing Repair" job.

Job ID: abc123xyz

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com
```

**Code Reference:**
Environment Variable: `REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED`
File: `src/services/whatsappService.js:255`
Function: `sendJobAcceptanceNotification()`

---

### 3. Job Completion Notification with Quick Reply Buttons

**Template Name:** `job_completion_request`
**Purpose:** Notify customer that handyman has marked the job as complete with action buttons
**Trigger:** When handyman marks job complete and status changes to `pending_confirmation`
**Language:** English
**Category:** TRANSACTIONAL

**Status:** ✅ Recommended for MVP - Includes Quick Reply buttons for instant customer response

**Template Content:**
```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```

**Template Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Handyman name
- `{{3}}` - Service type
- `{{4}}` - Job ID

**Quick Reply Buttons:**
1. **Button 1:** "✅ Confirm Complete"
   - When tapped: Sends "confirm_complete" to webhook
   - Action: Job status → `completed`, payment released to handyman

2. **Button 2:** "⚠️ Report Issue"
   - When tapped: Sends "report_issue" to webhook
   - Action: Job status → `disputed`, notify support team

**Twilio Configuration:**
In Twilio Content Editor, add these buttons:
- Button Type: **Quick Reply**
- Button 1 Text: `✅ Confirm Complete`
- Button 2 Text: `⚠️ Report Issue`

**Webhook Requirements:**
- Endpoint: `POST /api/whatsapp/webhook`
- Handles button responses
- Updates job status based on customer action
- Sends confirmation message back to customer

**Code Reference:**
File: `src/components/handyman/JobActionButtons.jsx:74`
Function: `sendJobCompletionNotification()`
Webhook: `functions/index.js` (to be created)

---

## How to Create Templates in Twilio Console

See detailed instructions in: `docs/setup/whatsapp-templates.md`

**Quick Steps:**
1. Login to Twilio Console
2. Navigate to **Messaging** → **Content Editor**
3. Click **Create new Content Template**
4. Select **WhatsApp** as the channel
5. Fill in template details:
   - **Name:** Use the template name from above
   - **Language:** English
   - **Category:** TRANSACTIONAL
   - **Content:** Copy the template content from above
6. Click **Submit for Approval**
7. Wait 24-48 hours for WhatsApp approval
8. Once approved, copy the **Content SID** (format: `HXxxxxx`)
9. Add the Content SID to your `.env.local` file

---

## Environment Variables

After templates are approved, add the Content SIDs to your `.env.local`:

```env
# Twilio WhatsApp Configuration
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token_here
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Twilio Content Template SIDs (HXxxxxx format)
REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=HXxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=HXxxxxx
```

---

## Template Approval Guidelines

**WhatsApp Template Requirements:**
- ✅ Transactional templates typically approved within 24 hours
- ✅ Must provide value to the customer
- ✅ Must be clear and concise
- ✅ Variables should be clearly marked with `{{1}}`, `{{2}}`, etc.
- ❌ No promotional content
- ❌ No opt-out language (WhatsApp provides this automatically)
- ❌ No link shorteners or suspicious URLs

**Categories:**
- **TRANSACTIONAL** - For transaction updates, confirmations, status changes (fastest approval)
- **MARKETING** - For promotional messages (requires opt-in)
- **UTILITY** - For account updates, alerts, reminders

---

## Testing Templates

### Using Twilio WhatsApp Sandbox

Before production, test your templates using the Twilio WhatsApp Sandbox:

1. Join the sandbox by sending the sandbox code to your Twilio WhatsApp number
2. Use the sandbox number in `REACT_APP_TWILIO_WHATSAPP_FROM`
3. Test with your own phone number
4. Check console logs for debugging

**Note:** Sandbox allows testing without template approval, but production requires approved templates.

---

## Future Templates (Optional)

### 4. Payment Released to Handyman

**Purpose:** Notify handyman when payment is released after job completion
**Trigger:** After customer confirms completion and payment is transferred
**Status:** Not yet implemented

**Template Content:**
```
Great job, {{1}}!

Payment for your "{{2}}" job has been released.

Amount: {{3}}
Job ID: {{4}}

The funds will be transferred to your account within 3-5 business days.

Thank you for using EazyDone!
```

**Template Variables:**
- `{{1}}` - Handyman name
- `{{2}}` - Service type
- `{{3}}` - Payment amount
- `{{4}}` - Job ID

---

**Last Updated:** 2025-01-22
**Status:** 🔄 Migration to Twilio in progress - Templates need to be created and approved
