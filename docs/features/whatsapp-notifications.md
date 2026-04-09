# WhatsApp Notifications (Green-API)

## Overview

Green-API WhatsApp integration for sending notifications to customers about job updates, including poll-based confirmation for job completion.

## Current Implementation Status

✅ **Implemented**
- Green-API WhatsApp integration
- Text message sending
- Poll-based job confirmation
- Phone number formatting (Singapore)
- Job creation notifications
- Job acceptance notifications
- Job completion notifications with poll
- Webhook for poll vote handling
- Poll vote locking (prevents vote changes)
- Admin approval workflow for fund release
- **Date gate on "Mark Complete" button** — prevents handyman from marking a job complete before the scheduled date
- **Auto-trigger completion poll** — scheduled Cloud Function sends WhatsApp poll the day after the preferred date if handyman hasn't triggered it
- **Duplicate poll prevention** — `completionPollSentAt` flag ensures only one poll is ever sent per job

❌ **Not Implemented**
- Email notification to admin (SMTP config needed)
- Automatic fund transfer on admin approval

---

## Key Files

**`/src/services/whatsappService.js`** - Frontend WhatsApp service
- `sendTextMessage(to, message)` - Send text message
- `sendPoll(to, pollName, options)` - Send poll
- `formatPhoneNumber(phone)` - Format for Green-API (`{digits}@c.us`)
- `isWhatsAppConfigured()` - Check if Green-API is configured
- `sendJobCreationNotification(jobData)` - Send job created notification
- `sendJobAcceptanceNotification(job, handymanInfo)` - Send job accepted notification
- `sendJobCompletionNotification(job, handymanInfo)` - Send completion poll

**`/functions/index.js`** - Webhook handler & scheduled functions
- `whatsappWebhook` - Handles incoming poll votes
- `autoTriggerCompletionPoll` - Scheduled function (daily 10am SGT) to auto-send completion polls
- `sendGreenApiMessage(chatId, message)` - Helper to send text messages from backend
- `sendGreenApiPoll(chatId, question, options)` - Helper to send polls from backend
- `formatPhoneToChatId(phone)` - Format phone number to Green-API chatId format
- `sendAdminNotificationEmail(jobData, jobId)` - Send email to admin (optional)

**Environment Variables (Frontend - `.env.local`):**
```env
REACT_APP_GREENAPI_API_URL=https://api.green-api.com
REACT_APP_GREENAPI_ID_INSTANCE=your_instance_id
REACT_APP_GREENAPI_API_TOKEN=your_api_token
```

**Environment Variables (Functions - `functions/.env`):**
```env
GREENAPI_API_URL=https://api.green-api.com
GREENAPI_ID_INSTANCE=your_instance_id
GREENAPI_API_TOKEN=your_api_token
```

---

## Message Flow

### 1. Job Created (After Payment)
```
Customer completes payment
  ↓
JobRequestForm.jsx calls sendJobCreationNotification()
  ↓
Customer receives WhatsApp message:
  "Hi [Name]! 👋
   Your job request has been posted successfully! ✅
   📋 Service: [Service Type]
   💰 Amount: $[Amount]
   🔖 Job ID: [ID]
   A qualified handyman will accept your job shortly..."
```

### 2. Job Accepted (Handyman Accepts)
```
Handyman clicks "Express Interest" / Accept
  ↓
ExpressInterestButton.jsx calls sendJobAcceptanceNotification()
  ↓
Customer receives WhatsApp message:
  "Great news, [Name]! 🎉
   [Handyman Name] has accepted your job request!
   📋 Service: [Service Type]
   🔖 Job ID: [ID]
   The handyman will contact you shortly..."
```

### 3. Job Completion — Date Gate, Auto-Trigger & Duplicate Prevention

The completion poll flow has safeguards to prevent premature completion and ensure the customer always receives exactly one poll.

#### Date Gate (Mark Complete Button)

The "Mark Complete" button on the handyman dashboard is **blocked before the job's scheduled date**:

- **Scheduled jobs**: Button is disabled if `today < preferredDate`. The button shows "Scheduled for [date]" and a helper message explains when it will be available.
- **ASAP/Immediate jobs**: No date restriction — the handyman can mark complete at any time.
- **On or after the scheduled date**: Button is enabled and works normally.

#### Two Paths to Sending the Completion Poll

**Path A — Handyman clicks "Mark Complete" (on or after scheduled date):**
```
Handyman clicks "Mark Complete"
  ↓
Check: Is completionPollSentAt already set?
  ↓
IF NOT SET:
  → Send WhatsApp info message + poll to customer
  → Set completionPollSentAt + completionPollSentBy: 'handyman'
  → Job status → pending_confirmation
  ↓
IF ALREADY SET (auto-trigger sent it first):
  → Skip WhatsApp send (no duplicate message)
  → Job status → pending_confirmation
```

**Path B — Auto-trigger scheduled Cloud Function (daily at 10:00 AM SGT):**
```
autoTriggerCompletionPoll runs daily at 10am SGT
  ↓
Queries jobs where:
  - status == 'in_progress'
  - preferredTiming == 'Schedule'
  - preferredDate < today (day AFTER the appointment)
  - completionPollSentAt is NOT set
  ↓
For each matching job:
  → Send WhatsApp info message + poll to customer
  → Set completionPollSentAt + completionPollSentBy: 'auto_trigger'
  → Job status remains 'in_progress' (handyman can still click "Mark Complete")
```

#### Complete Flow Summary

```
Job in_progress + scheduled for April 9
│
├─ April 8: Handyman tries "Mark Complete" → BLOCKED (before preferred date)
│
├─ April 9: Handyman clicks "Mark Complete" → Allowed
│   └─ completionPollSentAt is null → sends WhatsApp poll, sets flag
│
├─ April 10 10am: Auto-trigger runs
│   └─ completionPollSentAt already set → skips
│
│  ── OR ──
│
├─ April 9: Handyman doesn't click anything
├─ April 10 10am: Auto-trigger runs
│   └─ completionPollSentAt is null → sends WhatsApp poll, sets flag
│
├─ April 10 2pm: Handyman clicks "Mark Complete"
│   └─ completionPollSentAt already set → updates status only, no duplicate message
```

#### Scenario Coverage

| Scenario | Handled by |
|----------|-----------|
| Handyman tries to mark complete early | Date gate blocks it |
| Handyman marks complete on/after the date | Normal flow, WhatsApp poll sent |
| Handyman forgets to mark complete | Auto-trigger sends poll after appointment date |
| Job is "ASAP" (no scheduled date) | No date gate, handyman can mark complete anytime |
| Auto-trigger fires first, then handyman clicks | `completionPollSentAt` flag prevents duplicate poll |
| Handyman clicks first, then auto-trigger runs | `completionPollSentAt` flag causes auto-trigger to skip |

#### Key Database Fields

| Field | Type | Set by | Purpose |
|-------|------|--------|---------|
| `completionPollSentAt` | ISO timestamp / null | Handyman click or auto-trigger | Prevents duplicate WhatsApp polls |
| `completionPollSentBy` | `'handyman'` or `'auto_trigger'` | Same as above | Audit trail for which path sent the poll |

### 4. Customer Confirms via Poll
```
Customer votes on WhatsApp poll
  ↓
Green-API sends webhook to Cloud Function
  ↓
whatsappWebhook processes vote:
  - First vote is locked (pollVoteLocked: true)
  - Subsequent votes ignored with message
  ↓
IF "Yes, Confirm":
  → Job status → pending_admin_approval
  → Customer receives confirmation message
  → (Optional) Admin receives email notification
  ↓
IF "No, Report Issue":
  → Job status → disputed
  → Customer receives acknowledgment
  → Support team notified
```

### 5. Admin Approves Fund Release
```
Admin visits /admin/fund-release
  ↓
Reviews jobs with status: pending_admin_approval
  ↓
Clicks "Release Funds"
  ↓
Job status → completed
  ↓
(Future) Trigger Stripe fund transfer
```

---

## Job Status Lifecycle

```
pending (job created, payment completed, awaiting handyman)
  ↓ [Handyman clicks "Express Interest"]
in_progress (handyman assigned, job underway)
  ↓ [Handyman marks complete OR auto-trigger sends poll]
  │
  │  Note: The WhatsApp completion poll can be sent by either:
  │  (a) Handyman clicking "Mark Complete" (on or after scheduled date)
  │  (b) Auto-trigger Cloud Function (day after scheduled date, 10am SGT)
  │  Only one poll is sent — whichever fires first sets completionPollSentAt.
  │
pending_confirmation (awaiting customer poll response)
  ↓ [Customer confirms YES via WhatsApp poll]
pending_admin_approval (awaiting admin fund release)
  ↓ [Admin approves]
completed (funds released)

Alternative paths:
- Customer votes NO → disputed
- Admin can reject → disputed
```

---

## Phone Number Formatting

Green-API uses a specific format: `{country_code}{number}@c.us`

```javascript
import { formatPhoneNumber } from './services/whatsappService';

// All these inputs produce: "6591234567@c.us"
formatPhoneNumber('91234567');        // → "6591234567@c.us"
formatPhoneNumber('+6591234567');     // → "6591234567@c.us"
formatPhoneNumber('6591234567');      // → "6591234567@c.us"
formatPhoneNumber('+65 9123 4567');   // → "6591234567@c.us"
```

---

## Webhook Configuration

### Green-API Console Setup

1. Go to https://console.green-api.com
2. Select your instance
3. Go to Settings → Webhooks
4. Set Webhook URL:
   ```
   https://us-central1-eazydone-d06cf.cloudfunctions.net/whatsappWebhook
   ```
5. Enable:
   - ✅ Receive notifications about incoming messages
   - ✅ Receive notifications about polls

### Webhook Data Format

**Poll Vote Webhook:**
```json
{
  "typeWebhook": "incomingMessageReceived",
  "senderData": {
    "chatId": "6591234567@c.us",
    "sender": "6591234567@c.us"
  },
  "messageData": {
    "typeMessage": "pollUpdateMessage",
    "pollMessageData": {
      "votes": [
        {
          "optionName": "✅ Yes, Confirm Complete",
          "optionVoters": ["6591234567@c.us"]
        },
        {
          "optionName": "⚠️ No, Report Issue",
          "optionVoters": []
        }
      ]
    }
  }
}
```

---

## Poll Vote Locking

To prevent customers from changing their vote after initial submission:

1. When first vote is processed, `pollVoteLocked: true` is set on the job
2. Subsequent votes are detected by checking for existing locked jobs
3. Customer receives message: "Your response has already been recorded"

**Implementation in webhook:**
```javascript
// Check for already locked votes first
const lockedJobSnapshot = await admin.firestore().collection('jobs')
  .where('customerPhone', '==', phoneFormat)
  .where('pollVoteLocked', '==', true)
  .orderBy('customerConfirmedAt', 'desc')
  .limit(1)
  .get();

if (lockedJobSnapshot && !lockedJobSnapshot.empty) {
  // Vote already recorded - send message and return
  await sendGreenApiMessage(chatId, "Your response has already been recorded...");
  return;
}
```

---

## Admin Fund Release Page

**Route:** `/admin/fund-release`

**Access:** Restricted to admin emails configured in `AdminFundRelease.jsx`:
```javascript
const ADMIN_EMAILS = [
  'easydonehandyman@gmail.com',
  // Add more admin emails as needed
];
```

**Features:**
- Lists all jobs with `status: pending_admin_approval`
- Shows job details, customer info, amount
- "Release Funds" button to approve
- Updates status to `completed`

---

## Setup Instructions

### 1. Create Green-API Account
1. Go to https://console.green-api.com
2. Register and create an instance
3. Scan QR code with WhatsApp to link

### 2. Get Credentials
From Green-API Console:
- Instance ID (idInstance)
- API Token (apiTokenInstance)
- API URL (usually https://api.green-api.com)

### 3. Configure Environment Variables

**Frontend (`.env.local`):**
```env
REACT_APP_GREENAPI_API_URL=https://api.green-api.com
REACT_APP_GREENAPI_ID_INSTANCE=your_instance_id
REACT_APP_GREENAPI_API_TOKEN=your_api_token
```

**Functions (`functions/.env`):**
```env
GREENAPI_API_URL=https://api.green-api.com
GREENAPI_ID_INSTANCE=your_instance_id
GREENAPI_API_TOKEN=your_api_token
```

### 4. Configure Webhook
Set webhook URL in Green-API Console to your deployed function URL.

### 5. Deploy Functions
```bash
cd functions
npm install
firebase deploy --only functions:whatsappWebhook,functions:autoTriggerCompletionPoll
```

---

## Free Tier Limitations

Green-API Developer (Free) plan has a **3 correspondents per month** limit. This means you can only send/receive messages to 3 unique phone numbers per month.

**Solutions:**
- Upgrade to paid plan for production
- Create new instance to reset correspondents
- Test with same numbers consistently

---

## Related Documentation

- [Green-API Setup Guide](../../WHATSAPP_GREENAPI_SETUP.md)
- [Job Dashboard](./job-dashboard.md)
- [Job Creation Flow](./job-creation-flow.md)
- [Green-API Docs](https://green-api.com/en/docs/)

---

**Last Updated:** 2026-04-09
**Status:** ✅ Implemented - Poll confirmation, admin approval, date gate, auto-trigger completion poll, and duplicate prevention working
