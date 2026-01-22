# WhatsApp Quick Reply Buttons - Implementation Guide

## Overview

Quick Reply buttons have been added to the job completion notification (Template 3) for instant customer responses when a handyman marks a job complete.

**MVP Approach:** Simple button-based flow without deep links or confirmation modals.

---

## How It Works

### Customer Experience

1. **Handyman marks job complete** → Customer receives WhatsApp message:

```
Hello John Tan,

Your handyman Michael Lee has marked your "Plumbing Repair" job as complete.

Job ID: abc123xyz

Please review the work and confirm completion, or report any issues.

[✅ Confirm Complete] [⚠️ Report Issue]
```

2. **Customer taps a button** in WhatsApp (no app required)

3. **Instant response** from the system:

**If "Confirm Complete" tapped:**
```
Thank you for confirming! Your payment of $150.00 has been released
to the handyman. We hope to serve you again!
```

**If "Report Issue" tapped:**
```
We've received your report. Our support team will contact you shortly
to resolve the issue. Job ID: abc123xyz
```

---

## Technical Implementation

### 1. Template Configuration

**Template Name:** `job_completion_request`

**Quick Reply Buttons:**
- Button 1: `✅ Confirm Complete`
- Button 2: `⚠️ Report Issue`

**Created in:** Twilio Console → Messaging → Content Editor

---

### 2. Webhook Handler

**Cloud Function:** `whatsappWebhook`
**File:** `functions/index.js:1068-1213`
**Deployed URL:** `https://us-central1-[project].cloudfunctions.net/whatsappWebhook`

**What it does:**

#### When "Confirm Complete" is clicked:
1. ✅ Finds the pending job by customer phone number
2. ✅ Updates job status: `pending_confirmation` → `completed`
3. ✅ Adds `customerConfirmedAt` timestamp
4. ✅ Logs `confirmedVia: 'whatsapp_button'`
5. ✅ Logs payment release information
6. ✅ Sends confirmation message to customer

**Firestore Update:**
```javascript
{
  status: 'completed',
  customerConfirmedAt: '2026-01-22T12:45:00Z',
  confirmedVia: 'whatsapp_button'
}
```

#### When "Report Issue" is clicked:
1. ⚠️ Finds the pending job
2. ⚠️ Updates job status: `pending_confirmation` → `disputed`
3. ⚠️ Adds `disputedAt` timestamp
4. ⚠️ Logs dispute reason
5. ⚠️ Sends support message to customer
6. ⚠️ Logs for support team notification

**Firestore Update:**
```javascript
{
  status: 'disputed',
  disputedAt: '2026-01-22T12:45:00Z',
  disputedVia: 'whatsapp_button',
  disputeReason: 'Customer reported issue via WhatsApp'
}
```

---

## Setup Steps

### Step 1: Create Template with Buttons

1. Go to Twilio Console → **Messaging** → **Content Editor**
2. Click **Create new Content Template**
3. Configure:
   - **Name:** `job_completion_request`
   - **Language:** English
   - **Channel:** WhatsApp
   - **Category:** TRANSACTIONAL

4. **Body:**
```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```

5. **Add Buttons:**
   - Click **+ Add Button**
   - Type: **Quick Reply**
   - Text: `✅ Confirm Complete`

   - Click **+ Add Button** again
   - Type: **Quick Reply**
   - Text: `⚠️ Report Issue`

6. **Submit for approval** (TRANSACTIONAL category)
7. Wait 24-48 hours for WhatsApp approval

---

### Step 2: Deploy Webhook Handler

```bash
cd functions
firebase deploy --only functions:whatsappWebhook
```

**Note the URL:**
```
https://us-central1-your-project-id.cloudfunctions.net/whatsappWebhook
```

---

### Step 3: Configure Webhook in Twilio

1. Go to Twilio Console → **Messaging** → **Settings**
2. Navigate to **WhatsApp Sandbox Settings** (or your approved number settings)
3. Find **"WHEN A MESSAGE COMES IN"** section
4. Enter your webhook URL:
   ```
   https://us-central1-your-project-id.cloudfunctions.net/whatsappWebhook
   ```
5. Set HTTP Method: **POST**
6. Click **Save**

---

### Step 4: Add Template SID to Environment

Once template is approved:

1. Get Content SID from Twilio Console (starts with `HX`)
2. Add to `.env.local`:
   ```env
   REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=HXxxxxx
   ```
3. Restart your app

---

### Step 5: Test the Flow

1. **Create a test job** with your phone number
2. **Login as handyman** and accept the job
3. **Mark job as complete** as handyman
4. **Check your WhatsApp** for the completion message with buttons
5. **Tap "Confirm Complete"** button
6. **Verify:**
   - Received confirmation message
   - Job status updated to `completed` in Firestore
   - Payment release logged in Firebase Functions logs

7. **Check Firebase Console:**
   - Go to **Firestore** → `jobs` collection
   - Find your test job
   - Verify fields:
     ```
     status: "completed"
     customerConfirmedAt: "2026-01-22T12:45:00Z"
     confirmedVia: "whatsapp_button"
     ```

8. **Check Functions Logs:**
   - Go to Firebase Console → **Functions** → **Logs**
   - Look for `whatsappWebhook` execution
   - Verify payment release was logged

---

## Webhook Payload Examples

### When Customer Taps Button

**Request from Twilio to your webhook:**
```
POST https://your-webhook-url.cloudfunctions.net/whatsappWebhook
Content-Type: application/x-www-form-urlencoded

From=whatsapp%3A%2B6591234567
To=whatsapp%3A%2B14155238886
Body=%E2%9C%85+Confirm+Complete
MessageSid=SMxxxxx
```

**Parsed body:**
```javascript
{
  From: "whatsapp:+6591234567",
  To: "whatsapp:+14155238886",
  Body: "✅ Confirm Complete",
  MessageSid: "SMxxxxx"
}
```

---

### Webhook Response (TwiML)

**Success response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for confirming! Your payment of $150.00 has been released to the handyman. We hope to serve you again!</Message>
</Response>
```

This sends an automatic reply back to the customer.

---

## Payment Release

### Current Implementation

When customer confirms completion via button:

**✅ What happens:**
- Job status updated to `completed`
- Payment information logged to Firebase Functions logs
- Admin can manually process payment release

**⚠️ What doesn't happen (yet):**
- Automatic Stripe payment release
- Automatic payment split to handyman

### Why Manual for Now?

The webhook logs all payment information but doesn't automatically release payments because:

1. **Security:** Payment operations require careful validation
2. **Error handling:** Stripe API calls can fail, need proper retry logic
3. **Admin oversight:** MVP approach allows manual verification before release

### Payment Release Information Logged:

```javascript
{
  jobId: "abc123xyz",
  paymentIntentId: "pi_xxxxx",
  amount: "$150.00",
  status: "completed",
  customerConfirmedAt: "2026-01-22T12:45:00Z"
}
```

### Future Enhancement

To enable automatic payment release, integrate with the existing `releaseEscrowAndSplit` function:

```javascript
// In whatsappWebhook function, replace TODO with:
const releaseResult = await releaseEscrowAndSplit(
  jobId,
  updatedJobData.paymentIntentId
);
```

---

## Error Handling

### No Pending Job Found

**Customer sees:**
```
We couldn't find a pending job to confirm. Please contact
support if you need assistance.
```

**When this happens:**
- No recent `pending_confirmation` job for customer's phone number
- Job may have already been confirmed
- Phone number mismatch

---

### Unknown Button Response

**Customer sees:**
```
Sorry, we didn't understand that. Please use the buttons
provided or contact support.
```

**When this happens:**
- Customer sent text instead of clicking button
- Button text doesn't match expected values

---

### Webhook Processing Error

**Logged to Firebase:**
```
❌ Error processing WhatsApp webhook: [error details]
```

**Customer sees:**
```
500 Internal Server Error
```

**Action required:**
- Check Firebase Functions logs
- Verify Firestore permissions
- Check job exists and has correct status

---

## Testing Locally

### Using ngrok for Local Development

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start Firebase emulators:**
   ```bash
   firebase emulators:start
   ```

3. **In another terminal, expose local server:**
   ```bash
   ngrok http 5001
   ```

4. **Copy ngrok URL:**
   ```
   https://abc123.ngrok.io
   ```

5. **Update Twilio webhook:**
   ```
   https://abc123.ngrok.io/your-project/us-central1/whatsappWebhook
   ```

6. **Test by clicking buttons in WhatsApp**

7. **Check terminal logs** for webhook execution

8. **Remember to switch back to production URL** when done!

---

## Monitoring

### Firebase Functions Logs

**Check logs:**
```bash
firebase functions:log
```

**Look for:**
- `📱 WhatsApp webhook received`
- `✅ Customer confirmed job completion`
- `⚠️ Customer reported an issue`
- `💰 Payment release required`

### Firestore Queries

**Find recently confirmed jobs:**
```javascript
db.collection('jobs')
  .where('status', '==', 'completed')
  .where('confirmedVia', '==', 'whatsapp_button')
  .orderBy('customerConfirmedAt', 'desc')
  .limit(10)
```

**Find disputed jobs:**
```javascript
db.collection('jobs')
  .where('status', '==', 'disputed')
  .where('disputedVia', '==', 'whatsapp_button')
  .orderBy('disputedAt', 'desc')
  .limit(10)
```

---

## Cost Implications

### WhatsApp Message Costs

**Template message (job completion):** ~$0.008 per message

**Webhook response (confirmation):** FREE
- Response sent within 24-hour window
- Triggered by customer action

**Total cost per job completion:**
- Template: $0.008
- Confirmation response: $0.00
- **Total: ~$0.008**

---

## Future Enhancements

### 1. Automatic Payment Release
- Integrate with `releaseEscrowAndSplit` function
- Add retry logic for failed Stripe calls
- Send payment receipt to handyman

### 2. Support Team Notifications
- Email/Slack alert when dispute is created
- Include job details and customer contact
- Priority based on job value

### 3. Rich Confirmation Messages
- Include job summary in confirmation
- Show payment breakdown
- Request review/rating

### 4. Analytics
- Track confirmation vs dispute rates
- Response time metrics
- Button click analytics

---

## Security Considerations

### Webhook Validation

**Current implementation:**
- Validates request method (POST only)
- Checks required fields exist
- Finds job by customer phone

**Future additions:**
- Verify request signature from Twilio
- Rate limiting to prevent abuse
- IP whitelist for Twilio webhook servers

### Data Privacy

- Customer phone numbers stored in Firestore
- Webhook logs contain customer data
- Follow GDPR/PDPA compliance requirements

---

## Troubleshooting

### Buttons Not Showing

**Problem:** Template message received but no buttons

**Solutions:**
- Verify template was approved by WhatsApp
- Check buttons were added in Twilio Content Editor
- Ensure using correct Content SID
- Resubmit template if buttons missing

---

### Webhook Not Triggered

**Problem:** Clicking button doesn't trigger webhook

**Solutions:**
- Verify webhook URL is correct in Twilio settings
- Check Cloud Function is deployed: `firebase functions:list`
- Test webhook with curl or Postman
- Check Firebase Functions logs for errors

---

### Job Not Updating

**Problem:** Button clicked but job status doesn't change

**Solutions:**
- Check customer phone number format in Firestore
- Verify job status is `pending_confirmation`
- Check Firestore security rules allow update
- Review Firebase Functions logs for errors

---

## Summary

✅ **Implemented:**
- Quick Reply buttons in job completion template
- Webhook handler for button responses
- Automatic job status updates
- Customer confirmation messages

⚠️ **Manual (for now):**
- Payment release to handyman
- Support team notifications for disputes

📚 **Documentation:**
- Template setup guide
- Webhook configuration
- Testing procedures
- Error handling

🚀 **Ready for MVP:**
- Simple, user-friendly flow
- No app required for confirmation
- Instant customer response
- Clear audit trail in Firestore

---

**Last Updated:** 2026-01-22
**Status:** ✅ Ready for testing after template approval
