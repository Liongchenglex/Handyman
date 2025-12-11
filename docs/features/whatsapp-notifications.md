# WhatsApp Notifications

## Overview

WhatsApp Business API integration for sending notifications to customers and handymen about job updates.

## Current Implementation Status

✅ **Implemented**
- WhatsApp Business Cloud API integration
- Template message support
- Phone number formatting (Singapore)
- Configuration check
- Fallback logging when not configured

❌ **Not Implemented**
- Actual template messages (using `hello_world` placeholder)
- Job creation notifications
- Job acceptance notifications
- Job completion notifications
- Webhook handling for customer replies
- Interactive buttons

---

## Key Files

**`/src/services/whatsappService.js`** - Main WhatsApp service
- `sendTemplateMessage(to, templateName, languageCode)` - Send template (Line 61)
- `formatPhoneNumber(phone)` - Format for API (Line 33)
- `isWhatsAppConfigured()` - Check if setup (Line 24)

**Environment Variables:**
```env
REACT_APP_WHATSAPP_PHONE_NUMBER_ID=xxxxx
REACT_APP_WHATSAPP_ACCESS_TOKEN=xxxxx
REACT_APP_WHATSAPP_API_VERSION=v18.0
```

---

## Usage

### Send Template Message

```javascript
import { sendTemplateMessage } from './services/whatsappService';

// Send hello_world template (currently only approved template)
await sendTemplateMessage('+6591234567', 'hello_world', 'en_US');
```

### Phone Number Formatting

```javascript
import { formatPhoneNumber } from './services/whatsappService';

formatPhoneNumber('91234567');        // → "6591234567"
formatPhoneNumber('+6591234567');     // → "6591234567"
formatPhoneNumber('6591234567');      // → "6591234567"
```

---

## Future Templates

Templates need Meta approval before use. See [WhatsApp Templates Setup](../setup/whatsapp-templates.md) for:
1. **job_payment_confirmation** - Job created notification
2. **handyman_accepted_job** - Handyman accepted
3. **job_completion_request** - Handyman marked complete

**To submit templates:**
1. Go to Meta Business Manager
2. WhatsApp Manager → Message Templates
3. Create Template
4. Wait 24-48 hours for approval

---

## API Configuration

**Meta Cloud API:**
- Version: v18.0
- Endpoint: `https://graph.facebook.com/v18.0/{phone_number_id}/messages`
- Auth: Bearer token

**Message Format:**
```javascript
{
  messaging_product: 'whatsapp',
  to: '6591234567',  // No + prefix
  type: 'template',
  template: {
    name: 'hello_world',
    language: { code: 'en_US' }
  }
}
```

---

## Related Documentation

- [WhatsApp Templates](../WHATSAPP_TEMPLATES.md)
- [Setup Guide](../setup/whatsapp-setup.md)

---

**Last Updated:** 2025-12-11
**Status:** ⚠️ Configured but templates not approved - using placeholder only
