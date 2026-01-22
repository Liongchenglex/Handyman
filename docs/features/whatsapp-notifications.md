# WhatsApp Notifications (Twilio)

## Overview

Twilio WhatsApp API integration for sending notifications to customers and handymen about job updates.

## Current Implementation Status

✅ **Implemented**
- Twilio WhatsApp API integration
- Template message support
- Phone number formatting (Singapore)
- Configuration check
- Fallback logging when not configured

❌ **Not Implemented**
- Content templates (to be created in Twilio Console)
- Job creation notifications
- Job acceptance notifications
- Job completion notifications
- Webhook handling for customer replies (status callbacks)
- Interactive buttons and media messages

---

## Key Files

**`/src/services/whatsappService.js`** - Main WhatsApp service
- `sendTemplateMessage(to, contentSid, contentVariables)` - Send template message
- `sendMessage(to, body)` - Send simple text message
- `formatPhoneNumber(phone)` - Format for Twilio API (E.164 format)
- `isWhatsAppConfigured()` - Check if Twilio is configured

**Environment Variables:**
```env
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=xxxxx
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## Usage

### Send Template Message

```javascript
import { sendTemplateMessage } from './services/whatsappService';

// Send template with Content API (variables are injected into template)
const contentVariables = {
  '1': 'John Doe',           // Customer name
  '2': 'Plumbing Repair',    // Job title
  '3': '$150.00'             // Amount
};

await sendTemplateMessage(
  '+6591234567',
  'HXxxxxx',  // Content SID from Twilio Console
  contentVariables
);
```

### Send Simple Text Message

```javascript
import { sendMessage } from './services/whatsappService';

// Send plain text message (for follow-ups after 24-hour window)
await sendMessage('+6591234567', 'Your job has been updated!');
```

### Phone Number Formatting

```javascript
import { formatPhoneNumber } from './services/whatsappService';

// Formats to E.164 format with whatsapp: prefix
formatPhoneNumber('91234567');        // → "whatsapp:+6591234567"
formatPhoneNumber('+6591234567');     // → "whatsapp:+6591234567"
formatPhoneNumber('6591234567');      // → "whatsapp:+6591234567"
```

---

## Content Templates

Twilio uses Content API for approved message templates. See `/WHATSAPP_TEMPLATES.md` for:
1. **job_payment_confirmation** - Job created notification
2. **handyman_accepted_job** - Handyman accepted notification
3. **job_completion_request** - Job marked complete notification

**To create templates:**
1. Go to Twilio Console → Messaging → Content Templates
2. Create new template with variables (e.g., {{1}}, {{2}}, {{3}})
3. Submit for WhatsApp approval
4. Wait 24-48 hours for approval
5. Use the Content SID (HXxxxxx) in your code

**Template Guidelines:**
- First message to user must use approved template
- After user replies, 24-hour session window opens
- During session window, can send freeform messages
- Variables are 1-indexed: {{1}}, {{2}}, {{3}}

---

## API Configuration

**Twilio WhatsApp API:**
- Base URL: `https://api.twilio.com/2010-04-01`
- Auth: Basic Auth (Account SID + Auth Token)
- From Number: Twilio Sandbox or approved number
- Format: E.164 with `whatsapp:` prefix

**Template Message Request:**
```javascript
// Using Twilio Node SDK
const message = await client.messages.create({
  contentSid: 'HXxxxxx',
  from: 'whatsapp:+14155238886',
  to: 'whatsapp:+6591234567',
  contentVariables: JSON.stringify({
    '1': 'John Doe',
    '2': 'Plumbing Repair'
  })
});
```

**Simple Message Request:**
```javascript
// Using Twilio Node SDK
const message = await client.messages.create({
  body: 'Your job has been updated!',
  from: 'whatsapp:+14155238886',
  to: 'whatsapp:+6591234567'
});
```

---

## Webhook Configuration (Optional)

Twilio can send status callbacks for message delivery and incoming messages.

**Webhook URL:** `https://yourdomain.com/api/whatsapp/webhook`

**Incoming Message Webhook:**
```javascript
// POST /api/whatsapp/webhook
{
  MessageSid: 'SMxxxxx',
  From: 'whatsapp:+6591234567',
  To: 'whatsapp:+14155238886',
  Body: 'User reply message',
  NumMedia: '0'
}
```

**Status Callback Events:**
- `queued` - Message queued
- `sent` - Sent to carrier
- `delivered` - Delivered to recipient
- `read` - Read by recipient
- `failed` - Failed to deliver

---

## Setup Instructions

### 1. Twilio Account Setup
1. Create Twilio account at https://www.twilio.com
2. Navigate to Console → Messaging → Try WhatsApp
3. Get your sandbox number or request production access

### 2. Get Credentials
1. Account SID: Found on Twilio Console Dashboard
2. Auth Token: Found on Twilio Console Dashboard (click "Show")
3. WhatsApp From Number: Sandbox number or approved number

### 3. Environment Variables
Add to `.env`:
```env
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 4. Install Twilio SDK
```bash
npm install twilio
```

### 5. Production WhatsApp Approval
- Apply for WhatsApp Business Profile
- Submit your business for verification
- Request WhatsApp Sender approval
- Create and submit Content Templates

---

## Related Documentation

- [WhatsApp Templates](../WHATSAPP_TEMPLATES.md)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Twilio Content API](https://www.twilio.com/docs/content)

---

**Last Updated:** 2025-01-22
**Status:** 🔄 Migration to Twilio API in progress
