# WhatsApp Notifications Setup - Manual Steps Required

This document outlines the **manual steps** you need to complete to enable WhatsApp notifications using Twilio.

## ✅ What Has Been Implemented (Code Changes)

The following code changes have been completed:

1. ✅ **whatsappService.js** - Updated to use Twilio API instead of Meta API
2. ✅ **ExpressInterestButton.jsx** - Fixed job acceptance notification (Point 2)
3. ✅ **JobRequestForm.jsx** - Added payment success notification (Point 1)
4. ✅ **JobActionButtons.jsx** - Job completion notification already implemented (Point 3)
5. ✅ **Documentation** - Updated all docs to reflect Twilio implementation

---

## 🔧 Manual Steps You Need to Complete

### Step 1: Create Twilio Account

**Time Required:** 5-10 minutes

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account
3. Verify your email and phone number
4. Complete the account setup wizard

**What you'll get:**
- Account SID (starts with `AC`)
- Auth Token (hidden by default, click "Show" to reveal)

---

### Step 2: Set Up WhatsApp Sandbox (For Testing)

**Time Required:** 5 minutes

1. Login to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. You'll see instructions like:
   ```
   Join your sandbox by sending this code to +1 415 523 8886 on WhatsApp:
   join <random-words>
   ```
4. Open WhatsApp on your phone
5. Send the code to the sandbox number
6. You'll receive a confirmation message

**What you'll get:**
- Twilio Sandbox WhatsApp number (e.g., `whatsapp:+14155238886`)

**Note:** The sandbox allows testing without approval. For production, you'll need to apply for a dedicated WhatsApp Business number.

---

### Step 3: Configure Environment Variables

**Time Required:** 2 minutes

1. Open your `.env.local` file (create if it doesn't exist)
2. Add the following environment variables:

```env
# Twilio WhatsApp Configuration
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token_here
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Twilio Content Template SIDs (add after creating templates in Step 4)
REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=
```

**Replace:**
- `ACxxxxxxxxxxxxxxxxxxxxx` with your actual Account SID from Twilio Console
- `your_auth_token_here` with your actual Auth Token
- `whatsapp:+14155238886` with your Twilio sandbox number (keep the `whatsapp:` prefix)

**Security Note:**
- Make sure `.env.local` is in your `.gitignore` file
- Never commit credentials to Git

---

### Step 4: Create WhatsApp Message Templates in Twilio

**Time Required:** 15-20 minutes
**Wait Time:** 24-48 hours for WhatsApp approval

You need to create **2 required templates** (Template 3 is optional):

#### Template 1: Job Payment Confirmation

1. Go to Twilio Console → **Messaging** → **Content Editor**
2. Click **Create new Content Template**
3. Fill in:
   - **Name:** `job_payment_confirmation`
   - **Language:** English
   - **Channel:** WhatsApp ✓
   - **Content Type:** Text

4. **Body Text:**
```
Hi {{1}}, your job request for "{{2}}" has been posted successfully!

Service Fee: {{3}}
Job ID: {{4}}
Timing: {{5}}

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

5. **Footer:** (Optional)
```
EazyDone - Your Trusted Handyman Service
```

6. Click **Submit for WhatsApp Approval**
7. Select **Category:** TRANSACTIONAL
8. Click **Submit**

9. **Wait for approval** (24-48 hours)
10. Once approved, copy the **Content SID** (format: `HXxxxxx`)
11. Add to `.env.local`:
```env
REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=HXxxxxx
```

---

#### Template 2: Handyman Accepted Job

1. Create new Content Template
2. Fill in:
   - **Name:** `handyman_accepted_job`
   - **Language:** English
   - **Channel:** WhatsApp ✓
   - **Content Type:** Text

3. **Body Text:**
```
Great news, {{1}}!

{{2}} has accepted your "{{3}}" job.

Job ID: {{4}}

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com
```

4. **Footer:** (Optional)
```
EazyDone - Your Trusted Handyman Service
```

5. Click **Submit for WhatsApp Approval**
6. Select **Category:** TRANSACTIONAL
7. Click **Submit**

8. **Wait for approval** (24-48 hours)
9. Once approved, copy the **Content SID**
10. Add to `.env.local`:
```env
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxx
```

---

#### Template 3: Job Completion with Quick Reply Buttons (REQUIRED for MVP)

**Note:** This template includes Quick Reply buttons for customers to instantly confirm or report issues. Required for the button feature to work.

**How to create it:**

1. Create new Content Template in Twilio Console
2. Fill in:
   - **Name:** `job_completion_request`
   - **Language:** English
   - **Channel:** WhatsApp ✓
   - **Content Type:** Text

3. **Body Text:**
```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```

4. **Add Quick Reply Buttons:**
   - Click **+ Add Button**
   - Type: Quick Reply
   - Text: `✅ Confirm Complete`

   - Click **+ Add Button** again
   - Type: Quick Reply
   - Text: `⚠️ Report Issue`

5. **Footer (Optional):**
```
EazyDone - Your Trusted Handyman Service
```

6. Submit for approval (TRANSACTIONAL category)
7. Wait 24-48 hours for approval
8. Add Content SID to `.env.local`:
```env
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=HXxxxxx
```

---

### Step 5: Configure WhatsApp Webhook (For Quick Reply Buttons)

**Time Required:** 10 minutes

If you created Template 3 with Quick Reply buttons, you need to configure a webhook to handle button responses.

#### 5.1 Deploy the Webhook Handler

The webhook handler has already been created in `functions/index.js` as `whatsappWebhook`.

1. Deploy the Cloud Function:
```bash
cd functions
firebase deploy --only functions:whatsappWebhook
```

2. Note the deployment URL (will look like):
```
https://us-central1-your-project-id.cloudfunctions.net/whatsappWebhook
```

#### 5.2 Configure Webhook in Twilio Console

1. Go to Twilio Console → **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
2. Scroll to **"WHEN A MESSAGE COMES IN"** section
3. Enter your webhook URL:
   ```
   https://us-central1-your-project-id.cloudfunctions.net/whatsappWebhook
   ```
4. Set HTTP Method to **POST**
5. Click **Save**

#### 5.3 What the Webhook Does

When a customer taps a Quick Reply button:

**"✅ Confirm Complete" button:**
- Updates job status to `completed`
- Logs payment release information (manual release required for now)
- Sends confirmation message to customer
- Payment: Shows in logs for admin to process

**"⚠️ Report Issue" button:**
- Updates job status to `disputed`
- Logs dispute information
- Sends confirmation message to customer
- Support team should be notified (check Firebase logs)

#### 5.4 Testing the Webhook Locally (Optional)

For local development:

1. Install ngrok: `npm install -g ngrok`
2. Start Firebase emulators: `firebase emulators:start`
3. In another terminal: `ngrok http 5001`
4. Use the ngrok URL in Twilio webhook settings
5. Test by sending completion notification and clicking buttons

**Note:** Remember to switch back to production URL after testing!

---

### Step 6: Test the Integration

**Time Required:** 10 minutes

After templates are approved and environment variables are set:

#### 5.1 Restart Your Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm start
```

This ensures environment variables are loaded.

#### 5.2 Test Job Creation Flow

1. Create a new job as a customer
2. Use your own phone number for testing
3. Complete the payment
4. Check your WhatsApp for the job payment confirmation message

**Expected Message:**
```
Hi [Your Name], your job request for "[Service Type]" has been posted successfully!

Service Fee: $150.00
Job ID: abc123xyz
Timing: ASAP

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

#### 5.3 Test Job Acceptance Flow

1. Login as a handyman
2. Accept the job you just created
3. Check the customer's WhatsApp for acceptance notification

**Expected Message:**
```
Great news, [Customer Name]!

[Handyman Name] has accepted your "[Service Type]" job.

Job ID: abc123xyz

The handyman will contact you shortly to discuss the job details and confirm the appointment time.

Need help? Contact us at support@easydone.com
```

#### 6.4 Test Job Completion Flow with Buttons

1. As handyman, mark the job as complete
2. Check the customer's WhatsApp for completion notification

**Expected Message with Buttons:**
```
Hello [Customer Name],

Your handyman [Handyman Name] has marked your "[Service Type]" job as complete.

Job ID: abc123xyz

Please review the work and confirm completion, or report any issues.

[✅ Confirm Complete] [⚠️ Report Issue]
```

3. Tap one of the buttons to test webhook:
   - **Confirm Complete**: Should receive confirmation that payment is released
   - **Report Issue**: Should receive message that support will contact you

4. Check Firestore:
   - Job status should update to `completed` or `disputed`
   - Check `customerConfirmedAt` or `disputedAt` timestamp

5. Check Firebase Functions logs:
   - Go to Firebase Console → Functions → Logs
   - Look for webhook execution logs
   - Verify payment release was logged (if Confirm button was clicked)

---

### Step 6: Monitor and Debug

#### Check Browser Console

Open browser console (F12) and look for:
- ✅ `📱 Sending WhatsApp template message via Twilio...`
- ✅ `✅ WhatsApp template sent successfully`
- ⚠️ `⚠️ WhatsApp/Twilio not configured` (if env vars missing)
- ❌ `❌ Error sending WhatsApp template:` (if something failed)

#### Check Twilio Console Logs

1. Go to Twilio Console → **Monitor** → **Logs** → **Messaging**
2. Filter by **WhatsApp**
3. Check for successful/failed message deliveries

Common statuses:
- **queued** - Message queued
- **sent** - Sent to carrier
- **delivered** - Delivered to recipient ✅
- **read** - Read by recipient ✅
- **failed** - Delivery failed ❌
- **undelivered** - Could not deliver ❌

---

## 🚨 Common Issues and Solutions

### Issue 1: "WhatsApp/Twilio not configured" Warning

**Cause:** Environment variables not loaded

**Solution:**
1. Check `.env.local` file exists in project root
2. Verify variables start with `REACT_APP_`
3. Restart development server (`npm start`)
4. Check console: `console.log(process.env.REACT_APP_TWILIO_ACCOUNT_SID)`

---

### Issue 2: "Template not configured" Warning

**Cause:** Template SID not added to environment variables

**Solution:**
1. Get Content SID from Twilio Console (Content Editor)
2. Add to `.env.local`:
   ```env
   REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=HXxxxxx
   REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxx
   ```
3. Restart server

---

### Issue 3: Message Not Received

**Possible Causes:**
- Phone number not joined to sandbox
- Phone number format incorrect
- Template not approved
- Twilio account suspended/out of credits

**Solution:**
1. Verify sandbox is joined (send `join <code>` again)
2. Check phone format in database (should be +6591234567)
3. Check template status in Twilio Console
4. Check Twilio account balance
5. Review Twilio error logs

---

### Issue 4: Variables Not Showing in Message

**Cause:** Variable keys are numbers instead of strings

**Solution:**
Already fixed in code. Variables use string keys:
```javascript
contentVariables: {
  '1': 'John Tan',  // ✅ String key
  '2': 'Plumbing'
}
```

---

## 📊 Production Deployment Checklist

Before going to production:

- [ ] Apply for WhatsApp Business Account verification
- [ ] Request dedicated WhatsApp Business number from Twilio
- [ ] Create production templates (same as sandbox templates)
- [ ] Update `REACT_APP_TWILIO_WHATSAPP_FROM` with production number
- [ ] Set up billing alerts in Twilio Console
- [ ] Monitor message delivery rates
- [ ] Set up error alerting (optional)

---

## 💰 Cost Estimate

**Twilio WhatsApp Pricing (Singapore, as of 2025):**
- Template messages: ~$0.008 per message
- Session messages (within 24hr): Free

**Monthly Estimate:**
| Jobs/Month | Messages | Cost/Month |
|------------|----------|------------|
| 100        | 200      | ~$1.60     |
| 500        | 1000     | ~$8.00     |
| 1000       | 2000     | ~$16.00    |

**Note:** Job completion notification is FREE (sent within 24hr window)

---

## 📚 Documentation References

- **Template Setup Guide:** `docs/setup/whatsapp-templates.md`
- **Template Content:** `WHATSAPP_TEMPLATES.md`
- **Feature Documentation:** `docs/features/whatsapp-notifications.md`
- **Twilio Docs:** https://www.twilio.com/docs/whatsapp

---

## 🎯 Summary of Manual Work

**Immediate (Required for Testing):**
1. ✅ Create Twilio account (5 min)
2. ✅ Join WhatsApp sandbox (5 min)
3. ✅ Add environment variables to `.env.local` (2 min)
4. ✅ Create 2 templates in Twilio Console (15 min)
5. ⏳ Wait for template approval (24-48 hours)
6. ✅ Add Content SIDs to `.env.local` (2 min)
7. ✅ Test the integration (10 min)

**Later (For Production):**
- Apply for WhatsApp Business verification
- Get dedicated WhatsApp number
- Update production environment variables

---

**Total Active Time:** ~40 minutes
**Total Wait Time:** 24-48 hours for template approval

After templates are approved, the integration will be fully functional! 🎉
