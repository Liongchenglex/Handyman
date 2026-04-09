# WhatsApp Notifications (Twilio)

## Overview

Twilio WhatsApp integration for sending notifications to customers about job updates. Customers confirm job completion by replying YES/NO to a WhatsApp message. The system includes a date gate to prevent premature completion and an auto-trigger to follow up on overdue jobs.

## Current Implementation Status

✅ **Implemented**
- Twilio WhatsApp integration (migrated from Green-API)
- Text message sending via Twilio API
- Job creation notifications
- Job acceptance notifications
- Job completion confirmation (customer replies YES/NO)
- Webhook for processing customer text replies
- Response locking (prevents duplicate responses)
- Admin approval workflow for fund release
- **Date gate on "Mark Complete" button** — prevents handyman from marking a job complete before the scheduled date
- **Auto-trigger completion message** — scheduled Cloud Function sends WhatsApp message the day after the preferred date if handyman hasn't triggered it
- **Duplicate message prevention** — `completionPollSentAt` flag ensures only one confirmation message is ever sent per job
- **Follow-up messages** — customer receives contextual follow-up after confirming or rejecting

❌ **Not Implemented**
- Automatic fund transfer on admin approval

---

## Key Files

**`/src/services/whatsappService.js`** - Frontend WhatsApp service (Twilio)
- `sendTextMessage(to, message)` - Send text message via Twilio
- `formatPhoneNumber(phone)` - Format to Twilio WhatsApp format (`whatsapp:+{digits}`)
- `isWhatsAppConfigured()` - Check if Twilio is configured
- `sendJobCreationNotification(jobData)` - Send job created notification
- `sendJobAcceptanceNotification(job, handymanInfo)` - Send job accepted notification
- `sendJobCompletionNotification(job, handymanInfo)` - Send completion confirmation request

**`/functions/index.js`** - Webhook handler & scheduled functions
- `whatsappWebhook` - Handles incoming YES/NO text replies from customers
- `autoTriggerCompletionPoll` - Scheduled function (daily 10am SGT) to auto-send completion messages
- `sendTwilioMessage(to, message)` - Helper to send freeform WhatsApp messages (session replies)
- `sendTwilioTemplateMessage(to, contentSid, variables, fallback)` - Helper to send template messages
- `formatPhoneToWhatsApp(phone)` - Format phone number to Twilio WhatsApp format
- `sendAdminNotificationEmail(jobData, jobId)` - Send email to admin

**Environment Variables (Frontend - `.env.local`):**
```env
REACT_APP_TWILIO_ACCOUNT_SID=your_account_sid
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Content Template SIDs (required for production, optional for sandbox)
REACT_APP_TWILIO_TEMPLATE_JOB_CREATED=HXxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETION=HXxxxxxxxxxxxxxxxxxxxxx
```

**Environment Variables (Functions - `functions/.env`):**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Content Template SID for auto-trigger (reuses job completion template)
TWILIO_TEMPLATE_JOB_COMPLETION=HXxxxxxxxxxxxxxxxxxxxxx
```

### Template vs Freeform Messages

Twilio WhatsApp has a **24-hour session window**. Business-initiated messages (outside the window) require approved Content Templates. Session replies (within 24hrs of customer's last message) can use freeform text.

| Message | Type | Template needed? |
|---------|------|-----------------|
| Job Created | Business-initiated | **YES** — `TWILIO_TEMPLATE_JOB_CREATED` |
| Job Accepted | Business-initiated | **YES** — `TWILIO_TEMPLATE_JOB_ACCEPTED` |
| Job Completion Confirmation | Business-initiated | **YES** — `TWILIO_TEMPLATE_JOB_COMPLETION` |
| Auto-trigger Confirmation | Business-initiated | **YES** — reuses `TWILIO_TEMPLATE_JOB_COMPLETION` |
| Follow-up after YES/NO | Session reply | No — freeform text |
| "Already recorded" reply | Session reply | No — freeform text |

If no template SID is configured, the code falls back to freeform messages (works in sandbox mode).

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

The completion confirmation flow has safeguards to prevent premature completion and ensure the customer always receives exactly one message.

#### Date Gate (Mark Complete Button)

The "Mark Complete" button on the handyman dashboard is **blocked before the job's scheduled date**:

- **Scheduled jobs**: Button is disabled if `today < preferredDate`. The button shows "Scheduled for [date]" and a helper message explains when it will be available.
- **ASAP/Immediate jobs**: No date restriction — the handyman can mark complete at any time.
- **On or after the scheduled date**: Button is enabled and works normally.

#### Two Paths to Sending the Completion Message

**Path A — Handyman clicks "Mark Complete" (on or after scheduled date):**
```
Handyman clicks "Mark Complete"
  ↓
Check: Is completionPollSentAt already set?
  ↓
IF NOT SET:
  → Send WhatsApp message asking customer to reply YES/NO
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
  → Send WhatsApp message asking customer to reply YES/NO
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
│   └─ completionPollSentAt is null → sends WhatsApp message, sets flag
│
├─ April 10 10am: Auto-trigger runs
│   └─ completionPollSentAt already set → skips
│
│  ── OR ──
│
├─ April 9: Handyman doesn't click anything
├─ April 10 10am: Auto-trigger runs
│   └─ completionPollSentAt is null → sends WhatsApp message, sets flag
│
├─ April 10 2pm: Handyman clicks "Mark Complete"
│   └─ completionPollSentAt already set → updates status only, no duplicate message
```

#### Scenario Coverage

| Scenario | Handled by |
|----------|-----------|
| Handyman tries to mark complete early | Date gate blocks it |
| Handyman marks complete on/after the date | Normal flow, WhatsApp message sent |
| Handyman forgets to mark complete | Auto-trigger sends message after appointment date |
| Job is "ASAP" (no scheduled date) | No date gate, handyman can mark complete anytime |
| Auto-trigger fires first, then handyman clicks | `completionPollSentAt` flag prevents duplicate message |
| Handyman clicks first, then auto-trigger runs | `completionPollSentAt` flag causes auto-trigger to skip |

#### Key Database Fields

| Field | Type | Set by | Purpose |
|-------|------|--------|---------|
| `completionPollSentAt` | ISO timestamp / null | Handyman click or auto-trigger | Prevents duplicate WhatsApp messages |
| `completionPollSentBy` | `'handyman'` or `'auto_trigger'` | Same as above | Audit trail for which path sent the message |

### 4. Customer Confirms via WhatsApp Reply
```
Customer replies to WhatsApp message with YES or NO
  ↓
Twilio sends webhook to Cloud Function
  ↓
whatsappWebhook processes reply:
  - First response is locked (pollVoteLocked: true)
  - Subsequent replies ignored with message
  ↓
IF "YES":
  → Job status → pending_admin_approval
  → Customer receives: "Our team will process the payment and email you the receipt."
  → Admin receives email notification
  ↓
IF "NO":
  → Job status → disputed
  → Customer receives: "Our team will contact you with regard to this dispute."
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
  ↓ [Handyman marks complete OR auto-trigger sends message]
  │
  │  Note: The WhatsApp completion message can be sent by either:
  │  (a) Handyman clicking "Mark Complete" (on or after scheduled date)
  │  (b) Auto-trigger Cloud Function (day after scheduled date, 10am SGT)
  │  Only one message is sent — whichever fires first sets completionPollSentAt.
  │
pending_confirmation (awaiting customer YES/NO reply)
  ↓ [Customer replies YES]
pending_admin_approval (awaiting admin fund release)
  ↓ [Admin approves]
completed (funds released)

Alternative paths:
- Customer replies NO → disputed
- Admin can reject → disputed
```

---

## Phone Number Formatting

Twilio uses E.164 format with a `whatsapp:` prefix:

```javascript
import { formatPhoneNumber } from './services/whatsappService';

// All these inputs produce: "whatsapp:+6591234567"
formatPhoneNumber('91234567');        // → "whatsapp:+6591234567"
formatPhoneNumber('+6591234567');     // → "whatsapp:+6591234567"
formatPhoneNumber('6591234567');      // → "whatsapp:+6591234567"
formatPhoneNumber('+65 9123 4567');   // → "whatsapp:+6591234567"
```

---

## Webhook Configuration

### Twilio Console Setup

1. Go to https://console.twilio.com
2. Navigate to **Messaging** → **Settings** → **WhatsApp Sandbox Settings** (or your production number settings)
3. Set the **"When a message comes in"** webhook URL:
   ```
   https://us-central1-eazydone-d06cf.cloudfunctions.net/whatsappWebhook
   ```
4. Method: **POST**

### Webhook Data Format

Twilio sends form-encoded POST data:

```
From=whatsapp%3A%2B6591234567
To=whatsapp%3A%2B14155238886
Body=YES
MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Key fields:
- `From` - Customer's WhatsApp number (e.g., `whatsapp:+6591234567`)
- `Body` - Customer's reply text (e.g., `YES`, `NO`)
- `MessageSid` - Unique message identifier

---

## Response Locking

To prevent customers from changing their response after initial submission:

1. When first response is processed, `pollVoteLocked: true` is set on the job
2. Subsequent replies are detected by checking for existing locked jobs
3. Customer receives message: "Your response has already been recorded"

**Implementation in webhook:**
```javascript
// Check for already locked responses first
const lockedJobSnapshot = await admin.firestore().collection('jobs')
  .where('customerPhone', '==', phoneFormat)
  .where('pollVoteLocked', '==', true)
  .orderBy('customerConfirmedAt', 'desc')
  .limit(1)
  .get();

if (lockedJobSnapshot && !lockedJobSnapshot.empty) {
  // Response already recorded - send message and return
  await sendTwilioMessage(From, "Your response has already been recorded...");
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

### 1. Create Twilio Account
1. Go to https://www.twilio.com
2. Create an account and verify your phone number
3. Enable WhatsApp Sandbox (for testing) or register a WhatsApp Business number

### 2. Get Credentials
From Twilio Console:
- Account SID
- Auth Token
- WhatsApp From number (sandbox: `whatsapp:+14155238886`)

### 3. Create Content Templates
Go to **Twilio Console** → **Content Editor** and create 3 templates:

| Template | Name | Variables |
|----------|------|-----------|
| Job Created | `job_created` | {{1}} customerName, {{2}} serviceType, {{3}} amount, {{4}} jobId, {{5}} timing |
| Job Accepted | `job_accepted` | {{1}} customerName, {{2}} handymanName, {{3}} serviceType, {{4}} jobId |
| Job Completion | `job_completion_confirm` | {{1}} customerName, {{2}} handymanName, {{3}} serviceType, {{4}} jobId |

After templates are approved, note down each **Content SID** (starts with `HX`).

### 4. Configure Environment Variables

**Frontend (`.env.local`):**
```env
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token_here
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+your_twilio_number

# Content Template SIDs
REACT_APP_TWILIO_TEMPLATE_JOB_CREATED=HXxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETION=HXxxxxxxxxxxxxxxxxxxxxx
```

**Functions (`functions/.env`):**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+your_twilio_number

# Content Template SID (reused for auto-trigger)
TWILIO_TEMPLATE_JOB_COMPLETION=HXxxxxxxxxxxxxxxxxxxxxx
```

### 5. Configure Webhook
Set webhook URL in Twilio Console to your deployed function URL.

### 5. Deploy Functions
```bash
cd functions
npm install
firebase deploy --only functions:whatsappWebhook,functions:autoTriggerCompletionPoll
```

---

## Twilio Pricing

Twilio WhatsApp pricing:
- **Sandbox**: Free (limited to numbers that join the sandbox)
- **Production**: Per-message pricing varies by country (~$0.005-0.08 per message)
- See: https://www.twilio.com/whatsapp/pricing

---

## Related Documentation

- [Job Dashboard](./job-dashboard.md)
- [Job Creation Flow](./job-creation-flow.md)
- [Twilio WhatsApp Docs](https://www.twilio.com/docs/whatsapp)

---

**Last Updated:** 2026-04-09
**Status:** ✅ Implemented - Twilio WhatsApp integration with YES/NO confirmation, date gate, auto-trigger, and follow-up messages
