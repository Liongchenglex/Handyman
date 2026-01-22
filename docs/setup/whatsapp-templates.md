# WhatsApp Message Templates for Twilio

This guide provides step-by-step instructions for creating WhatsApp message templates in Twilio Console and submitting them for WhatsApp approval.

## Overview

WhatsApp requires all proactive messages (messages sent outside the 24-hour customer service window) to use pre-approved templates. These templates must be created in the Twilio Console using the **Content Editor** and submitted to WhatsApp for approval.

---

## Prerequisites

Before creating templates, ensure you have:

1. ✅ Twilio account created at https://www.twilio.com
2. ✅ WhatsApp Sandbox enabled OR approved WhatsApp Sender
3. ✅ Twilio Account SID and Auth Token
4. ✅ Twilio WhatsApp phone number

---

## How to Create Templates in Twilio Console

### Step 1: Access Content Editor

1. Login to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Messaging** → **Content Editor** (or **Messaging** → **Content Templates**)
3. Click **Create new Content Template**

### Step 2: Configure Template Settings

1. **Select Channel:** Choose **WhatsApp**
2. **Content Type:** Select **Text**
3. **Template Name:** Enter a unique name (lowercase, underscores allowed)
   - Use descriptive names like `job_payment_confirmation`
4. **Language:** Select **English**
5. **Content SID:** Will be auto-generated (format: `HXxxxxx`)

### Step 3: Build Template Content

Twilio Content Editor has three sections:

#### **Body Text**
- Main message content
- Use `{{1}}`, `{{2}}`, `{{3}}` for variables (numbered placeholders)
- Maximum 1024 characters
- Support for:
  - `*bold text*`
  - `_italic text_`
  - `~strikethrough~`
  - Emojis ✅ 🎉 ⚠️

#### **Header** (Optional)
- Short title for the message
- Maximum 60 characters
- Can include one variable: `{{1}}`

#### **Footer** (Optional)
- Bottom text, typically brand name or disclaimer
- Maximum 60 characters
- No variables allowed

#### **Buttons** (Optional)
- Call-to-Action buttons (URL or Phone)
- Quick Reply buttons (up to 3)
- Not required for basic notifications

### Step 4: Submit for Approval

1. Click **Submit for WhatsApp Approval**
2. Select template **Category**:
   - **TRANSACTIONAL** - For order updates, confirmations (fastest approval) ✅ **Use this**
   - **MARKETING** - For promotional messages (requires opt-in)
   - **UTILITY** - For account updates, alerts
3. Wait for WhatsApp approval (typically 24-48 hours)

### Step 5: Get Content SID

Once approved:
1. Go back to **Messaging** → **Content Editor**
2. Find your approved template
3. Copy the **Content SID** (starts with `HX`)
   - Example: `HXa1b2c3d4e5f6g7h8i9j0`
4. Add to `.env.local` file

---

## Required Templates

### Template 1: Job Payment Confirmation

**Use Case:** Notify customer after payment is captured and job is posted

**Template Name:** `job_payment_confirmation`

**Category:** TRANSACTIONAL

**Language:** English

**Content:**

**Body:**
```
Hi {{1}}, your job request for "{{2}}" has been posted successfully!

Service Fee: {{3}}
Job ID: {{4}}
Timing: {{5}}

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

**Footer:** (Optional)
```
EazyDone - Your Trusted Handyman Service
```

**Variables:**
- `{{1}}` - Customer name (e.g., "John Tan")
- `{{2}}` - Service type (e.g., "Plumbing Repair")
- `{{3}}` - Service fee (e.g., "$150.00")
- `{{4}}` - Job ID (e.g., "abc123xyz")
- `{{5}}` - Timing (e.g., "2025-01-25 at 2:00 PM" or "ASAP")

**Sample Test Values:**
```
{{1}} = Lex Liong
{{2}} = Plumbing Repair
{{3}} = $150.00
{{4}} = JOB-ABC123
{{5}} = ASAP
```

**Environment Variable:**
```env
REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=HXxxxxx
```

**Code Reference:** `src/services/whatsappService.js:285` → `sendJobCreationNotification()`

---

### Template 2: Handyman Accepted Job

**Use Case:** Notify customer when a handyman accepts their job

**Template Name:** `handyman_accepted_job`

**Category:** TRANSACTIONAL

**Language:** English

**Content:**

**Body:**
```
Great news, {{1}}!

{{2}} has accepted your "{{3}}" job.

Job ID: {{4}}

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com
```

**Footer:** (Optional)
```
EazyDone - Your Trusted Handyman Service
```

**Variables:**
- `{{1}}` - Customer name (e.g., "John Tan")
- `{{2}}` - Handyman name (e.g., "Michael Lee")
- `{{3}}` - Service type (e.g., "Plumbing Repair")
- `{{4}}` - Job ID (e.g., "abc123xyz")

**Sample Test Values:**
```
{{1}} = Lex Liong
{{2}} = Michael Lee
{{3}} = Plumbing Repair
{{4}} = JOB-ABC123
```

**Environment Variable:**
```env
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxx
```

**Code Reference:** `src/services/whatsappService.js:255` → `sendJobAcceptanceNotification()`

---

### Template 3: Job Completion with Quick Reply Buttons (Recommended for MVP)

**Use Case:** Notify customer when handyman marks job complete with instant action buttons

**Template Name:** `job_completion_request`

**Category:** TRANSACTIONAL

**Language:** English

**Content:**

**Body:**
```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```

**Footer:** (Optional)
```
EazyDone - Your Trusted Handyman Service
```

**Quick Reply Buttons:**
Add these buttons in the Twilio Content Editor:

1. **Button 1:**
   - Type: Quick Reply
   - Text: `✅ Confirm Complete`

2. **Button 2:**
   - Type: Quick Reply
   - Text: `⚠️ Report Issue`

**How to Add Buttons in Twilio Console:**

1. In the Content Editor, scroll to **Buttons** section
2. Click **+ Add Button**
3. Select **Quick Reply** as button type
4. Enter button text: `✅ Confirm Complete`
5. Click **+ Add Button** again
6. Select **Quick Reply** as button type
7. Enter button text: `⚠️ Report Issue`
8. Submit for approval

**Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Handyman name
- `{{3}}` - Service type
- `{{4}}` - Job ID

**Sample Test Values:**
```
{{1}} = Lex Liong
{{2}} = Michael Lee
{{3}} = Plumbing Repair
{{4}} = JOB-ABC123
```

**Environment Variable:**
```env
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=HXxxxxx
```

**Webhook Configuration Required:**
- You'll need to set up a webhook endpoint to handle button responses
- See "Webhook Setup" section below for implementation details

**Code Reference:**
- Template sending: `src/services/whatsappService.js:241` → `sendJobCompletionNotification()`
- Webhook handler: `functions/index.js` → `whatsappWebhook()` (to be created)

---

## Twilio Content Editor UI Guide

### Creating a Template - Step by Step

#### 1. Template Information

```
┌─────────────────────────────────────────┐
│ Create Content Template                 │
├─────────────────────────────────────────┤
│ Name: job_payment_confirmation          │
│ Language: English                        │
│ Channel: ☑ WhatsApp                     │
│ Content Type: Text                       │
└─────────────────────────────────────────┘
```

#### 2. Content Sections

```
┌─────────────────────────────────────────┐
│ Header (Optional)                        │
├─────────────────────────────────────────┤
│ [Leave empty]                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Body *                                   │
├─────────────────────────────────────────┤
│ Hi {{1}}, your job request for "{{2}}"  │
│ has been posted successfully!            │
│                                          │
│ Service Fee: {{3}}                       │
│ Job ID: {{4}}                            │
│ Timing: {{5}}                            │
│                                          │
│ A qualified handyman will accept your    │
│ job shortly. You'll receive a            │
│ notification when someone accepts.       │
│                                          │
│ Thank you for using EazyDone!            │
│                                          │
│ [+ Add Variable]  Variables: 5 added    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Footer (Optional)                        │
├─────────────────────────────────────────┤
│ EazyDone - Your Trusted Handyman Service│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Buttons (Optional)                       │
├─────────────────────────────────────────┤
│ [+ Add Button]                           │
└─────────────────────────────────────────┘
```

#### 3. WhatsApp Submission

```
┌─────────────────────────────────────────┐
│ Submit for WhatsApp Approval             │
├─────────────────────────────────────────┤
│ Category: ⚫ TRANSACTIONAL               │
│           ○ MARKETING                    │
│           ○ UTILITY                      │
│                                          │
│ [ Submit for Approval ]                  │
└─────────────────────────────────────────┘
```

#### 4. Approval Status

After submission, you'll see:

```
┌─────────────────────────────────────────┐
│ Template Status                          │
├─────────────────────────────────────────┤
│ Status: ⏳ Pending Approval              │
│ Submitted: 2025-01-22 14:30 SGT          │
│ Content SID: HXa1b2c3d4e5f6g7h8i9j0     │
│                                          │
│ ℹ️ WhatsApp approval typically takes    │
│    24-48 hours                           │
└─────────────────────────────────────────┘
```

Once approved:

```
┌─────────────────────────────────────────┐
│ Template Status                          │
├─────────────────────────────────────────┤
│ Status: ✅ APPROVED                     │
│ Approved: 2025-01-23 09:15 SGT           │
│ Content SID: HXa1b2c3d4e5f6g7h8i9j0     │
│                                          │
│ 📋 [Copy Content SID]                   │
└─────────────────────────────────────────┘
```

---

## Testing Templates

### Using Twilio WhatsApp Sandbox

Before production, test templates using the Twilio WhatsApp Sandbox:

#### 1. Join the Sandbox

1. Go to Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. You'll see a sandbox code like: `join <random-words>`
3. Send that code to the Twilio sandbox number (e.g., `+1 415 523 8886`)
4. You'll receive a confirmation message

#### 2. Configure Sandbox in .env.local

```env
# Use sandbox number for testing
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

#### 3. Test Template Sending

```javascript
// In browser console or test file
import { sendTemplateMessage } from './services/whatsappService';

const testTemplate = async () => {
  const result = await sendTemplateMessage(
    '+6591234567', // Your phone number
    'HXxxxxx',     // Your Content SID
    {
      '1': 'John Tan',
      '2': 'Plumbing Repair',
      '3': '$150.00',
      '4': 'JOB-ABC123',
      '5': 'ASAP'
    }
  );

  console.log('Result:', result);
};

testTemplate();
```

#### 4. Check Logs

Monitor the browser console and Twilio Console logs for:
- ✅ Message sent successfully
- ⚠️ Template not approved
- ❌ Invalid variables
- ❌ Authentication errors

---

## Environment Configuration

After templates are approved, update your `.env.local`:

```env
# Twilio WhatsApp Configuration
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token_here
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Twilio Content Template SIDs (get from Console after approval)
REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=HXa1b2c3d4e5f6g7h8i9j0
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXb2c3d4e5f6g7h8i9j0k1
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=HXc3d4e5f6g7h8i9j0k1l2
```

**Important:** Keep these credentials secure! Add `.env.local` to `.gitignore`.

---

## Template Approval Guidelines

### What WhatsApp Approves ✅

- Clear, concise transactional messages
- Helpful information for customers
- Professional tone and formatting
- Appropriate use of variables
- Compliance with WhatsApp Commerce Policy

### What WhatsApp Rejects ❌

- Marketing/promotional content in TRANSACTIONAL category
- Misleading or deceptive messages
- Messages containing:
  - Shortened URLs (bit.ly, tinyurl, etc.)
  - Profanity or inappropriate content
  - Requests for sensitive information (passwords, SSN, etc.)
  - Spam-like content
- Too many variables (keep it reasonable)

### Tips for Fast Approval

1. ✅ Use TRANSACTIONAL category for order/service updates
2. ✅ Keep messages concise and to the point
3. ✅ Use clear, professional language
4. ✅ Test variable placement before submission
5. ✅ Include helpful customer information (Job ID, timing, etc.)
6. ✅ Add footer with company name for branding

---

## Common Issues & Troubleshooting

### Issue 1: Template Rejected by WhatsApp

**Symptoms:** Template status shows "REJECTED" in Twilio Console

**Solutions:**
- Review rejection reason in Twilio Console
- Check template category matches content type
- Remove any promotional language if using TRANSACTIONAL
- Ensure variables are properly formatted (`{{1}}`, `{{2}}`, etc.)
- Resubmit with modifications

### Issue 2: Template Not Sending

**Symptoms:** `sendTemplateMessage()` returns error

**Solutions:**
```javascript
// Check configuration
console.log('Config:', {
  accountSid: process.env.REACT_APP_TWILIO_ACCOUNT_SID,
  hasAuthToken: !!process.env.REACT_APP_TWILIO_AUTH_TOKEN,
  whatsappFrom: process.env.REACT_APP_TWILIO_WHATSAPP_FROM,
  templateSid: process.env.REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT
});
```

Common fixes:
- Verify environment variables are loaded
- Check Content SID is correct (starts with `HX`)
- Ensure template is approved in Twilio Console
- Verify phone number format (E.164: `+6591234567`)
- Check variable count matches template

### Issue 3: Variables Not Displaying

**Symptoms:** Variables show as `{{1}}` in received message

**Solutions:**
- Ensure `contentVariables` object uses string keys: `'1'`, `'2'`, `'3'`
- Check all variables are provided (no missing values)
- Verify variable order matches template

```javascript
// ❌ Wrong
contentVariables: {
  1: 'John',  // Number key
  2: 'Plumbing'
}

// ✅ Correct
contentVariables: {
  '1': 'John',  // String key
  '2': 'Plumbing'
}
```

---

## Webhook Setup for Quick Reply Buttons

If you're using Template 3 with Quick Reply buttons, you need to set up a webhook to handle customer responses.

### 1. Configure Webhook URL in Twilio Console

1. Go to Twilio Console → **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
2. Find **"WHEN A MESSAGE COMES IN"** section
3. Enter your webhook URL:
   ```
   https://your-domain.com/api/whatsapp/webhook
   ```
   Or for Firebase Cloud Functions:
   ```
   https://us-central1-your-project.cloudfunctions.net/whatsappWebhook
   ```
4. Set HTTP Method to **POST**
5. Click **Save**

### 2. Webhook Payload Structure

When a customer taps a Quick Reply button, Twilio sends this payload:

```json
{
  "MessageSid": "SMxxxxx",
  "From": "whatsapp:+6591234567",
  "To": "whatsapp:+14155238886",
  "Body": "✅ Confirm Complete",
  "NumMedia": "0",
  "ButtonPayload": "Confirm Complete"
}
```

**Key Fields:**
- `From`: Customer's WhatsApp number
- `Body`: Button text that was tapped
- `ButtonPayload`: Normalized button text

### 3. Implementation Guide

The webhook handler is created in `functions/index.js`. It:

1. ✅ Receives button click from Twilio
2. ✅ Validates the webhook request
3. ✅ Extracts customer phone number and button choice
4. ✅ Finds the job in Firestore
5. ✅ Updates job status based on button:
   - "Confirm Complete" → Job status: `completed`, release payment
   - "Report Issue" → Job status: `disputed`, notify support
6. ✅ Sends confirmation message back to customer

**See implementation:** `functions/index.js` → `whatsappWebhook()`

### 4. Testing the Webhook

**Local Testing with ngrok:**
```bash
# Install ngrok
npm install -g ngrok

# Start your functions locally
firebase emulators:start

# In another terminal, expose local server
ngrok http 5001

# Use the ngrok URL in Twilio webhook settings
https://abc123.ngrok.io/your-project/us-central1/whatsappWebhook
```

**Production Testing:**
1. Deploy Cloud Functions: `firebase deploy --only functions`
2. Configure Twilio webhook with production URL
3. Send test job completion notification
4. Tap button in WhatsApp
5. Check Firestore - job status should update
6. Check Firebase Functions logs

---

## Cost Considerations

### Twilio WhatsApp Pricing (as of 2025)

**Message Types:**
- **Template Messages (Business-Initiated):** $0.005 - $0.01 per message (varies by country)
- **Session Messages (Customer-Initiated 24hr window):** Free
- **Singapore Rates:** ~$0.008 per template message

**Monthly Cost Estimate:**
- 100 jobs/month × 2 templates = 200 messages = ~$1.60
- 500 jobs/month × 2 templates = 1000 messages = ~$8.00
- 1000 jobs/month × 2 templates = 2000 messages = ~$16.00

**Cost Optimization:**
- Template 3 (job completion) uses text message within 24hr window = FREE
- Only Templates 1 & 2 are chargeable
- Monitor usage in Twilio Console → **Monitor** → **Messaging Insights**

---

## Support Resources

- [Twilio WhatsApp API Docs](https://www.twilio.com/docs/whatsapp)
- [Twilio Content API](https://www.twilio.com/docs/content)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
- [Twilio Console](https://console.twilio.com/)
- [Twilio Support](https://support.twilio.com/)

---

**Last Updated:** 2025-01-22
**Status:** 🔄 Ready for template creation in Twilio Console
