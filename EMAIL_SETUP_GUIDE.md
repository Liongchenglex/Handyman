# Email Notification Setup Guide

This guide will help you set up email notifications for handyman registration.

## Quick Start

### Option A: Local Testing WITH Real Emails (Recommended)

**EmailJS works the same in local and production!** Just set it up once and it works everywhere.

1. **Set up EmailJS** (see detailed instructions below - takes 5 minutes)

2. **Create `.env.local` file** in the project root:

```bash
# Copy the example file
cp .env.local.example .env.local
```

3. **Configure for local testing WITH EmailJS**:

```bash
# Operations team email - use your personal email for testing
REACT_APP_OPERATIONS_EMAIL=your-email@gmail.com

# Approval URL for local testing
REACT_APP_APPROVAL_BASE_URL=http://localhost:3000/admin/approve-handyman

# Approval secret - any random string for testing
REACT_APP_APPROVAL_SECRET=my-local-secret-123

# EmailJS credentials (from EmailJS dashboard)
REACT_APP_EMAILJS_SERVICE_ID=service_abc123
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=template_xyz456
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=template_def789
REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key_here
```

4. **Test the flow**:
   - Run `npm start`
   - Complete handyman registration
   - Check your email inbox for REAL emails
   - Click approve/reject buttons in email
   - They'll open http://localhost:3000/admin/approve-handyman

**✅ This is the recommended way to test - you get real emails even in local development!**

---

### Option B: Local Testing WITHOUT EmailJS (Console Fallback)

If you don't want to set up EmailJS yet, you can test with console logging:

1. **Create `.env.local` file**:

```bash
# Operations team email
REACT_APP_OPERATIONS_EMAIL=your-email@gmail.com

# Approval URL for local testing
REACT_APP_APPROVAL_BASE_URL=http://localhost:3000/admin/approve-handyman

# Approval secret
REACT_APP_APPROVAL_SECRET=my-local-secret-123

# EmailJS - Leave empty for console fallback
REACT_APP_EMAILJS_SERVICE_ID=
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=
REACT_APP_EMAILJS_PUBLIC_KEY=
```

2. **Test the flow**:
   - Run `npm start`
   - Complete handyman registration
   - Check browser console for email logs (no real emails sent)
   - Copy the approval link from console
   - Paste in browser to test approval flow

**Note:** This is useful for quick testing, but you won't receive actual emails.

---

## Important: EmailJS Works the Same Everywhere!

**Key Point:** EmailJS is a client-side email service. Once you configure it, it works identically in:
- ✅ Local development (`npm start`)
- ✅ Production (deployed to Firebase Hosting)
- ✅ Any environment

**The only thing that changes between environments is the approval URL** (localhost vs production domain).

**You can test with REAL emails in local development!** No need to deploy to test emails.

---

### For Production

1. **Use the SAME EmailJS credentials** you set up for local testing

2. **Update `.env.local` for production build** (only change the approval URL):

```bash
# Operations team email - your actual operations email
REACT_APP_OPERATIONS_EMAIL=operations@eazydone.com

# Approval URL for production
REACT_APP_APPROVAL_BASE_URL=https://eazydone-d06cf.web.app/admin/approve-handyman

# Approval secret - use a strong random string
REACT_APP_APPROVAL_SECRET=prod-secret-xyz-abc-123

# EmailJS credentials (from EmailJS dashboard)
REACT_APP_EMAILJS_SERVICE_ID=service_xxxxxxx
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=template_xxxxxxx
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=template_xxxxxxx
REACT_APP_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx
```

3. **Important**: Firebase Hosting doesn't automatically use `.env.local`. You have two options:

   **Option A: Build with environment variables** (Recommended)
   ```bash
   # Build with production env vars
   npm run build
   firebase deploy --only hosting
   ```

   **Option B: Use Firebase Environment Config**
   ```bash
   # Set Firebase environment variables
   firebase functions:config:set emailjs.service_id="service_xxx"
   firebase functions:config:set emailjs.template_handyman="template_xxx"
   # ... etc
   ```

---

## Detailed EmailJS Setup

### Step 1: Create EmailJS Account

1. Go to https://www.emailjs.com/
2. Sign up for free account (200 emails/month)
3. Verify your email

### Step 2: Add Email Service

1. Go to **Email Services** in dashboard
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow authentication steps
5. Copy the **Service ID** (e.g., `service_abc123`)

### Step 3: Create Email Templates

You need to create **TWO** templates:

#### Template 1: Handyman Acknowledgment

1. Go to **Email Templates** → **Create New Template**
2. Name it: `Handyman Registration Acknowledgment`
3. **Template Content**:

```html
Subject: {{subject}}

<div>
  {{{message_html}}}
</div>
```

4. **Important**: Use triple braces `{{{message_html}}}` to render HTML
5. Copy the **Template ID** (e.g., `template_abc123`)

#### Template 2: Operations Notification

1. Create another template
2. Name it: `Operations - New Handyman Registration`
3. **Template Content**:

```html
Subject: {{subject}}

<div>
  {{{message_html}}}
</div>
```

4. Copy the **Template ID**

### Step 4: Get Public Key

1. Go to **Account** → **General**
2. Find **Public Key** (starts with random characters)
3. Copy it

### Step 5: Update .env.local

```bash
REACT_APP_EMAILJS_SERVICE_ID=service_abc123
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=template_handyman_123
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=template_operations_456
REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key_here
```

---

## Testing the Email Flow

### Local Testing (Without EmailJS)

1. Start the app: `npm start`
2. Register as a handyman
3. Check **browser console** for:
   - "📧 Email content (EmailJS not configured)"
   - Email preview
   - Approval link
4. Copy the approval link from console
5. Paste in browser to test approval

**Example console output**:
```
📧 Email content (EmailJS not configured):
To: handyman@example.com
Subject: Welcome to EazyDone - Registration Received!
---Email Preview---
<!DOCTYPE html>...

📧 Operations Email (EmailJS not configured):
To: operations@eazydone.com
Subject: New Handyman Registration: John Doe
Approval Link: http://localhost:3000/admin/approve-handyman?token=eyJ...&action=approve
```

### Production Testing (With EmailJS)

1. Configure EmailJS credentials in `.env.local`
2. Set approval URL to production: `https://eazydone-d06cf.web.app/admin/approve-handyman`
3. Restart app: `npm start`
4. Register as a handyman
5. Check your email inbox for both emails
6. Click approval/reject buttons in operations email
7. Verify handyman status updated in Firebase

---

## Environment Variables Summary

| Variable | Local Testing | Production |
|----------|--------------|------------|
| `REACT_APP_OPERATIONS_EMAIL` | Your personal email | `operations@eazydone.com` |
| `REACT_APP_APPROVAL_BASE_URL` | `http://localhost:3000/admin/approve-handyman` | `https://eazydone-d06cf.web.app/admin/approve-handyman` |
| `REACT_APP_APPROVAL_SECRET` | Any string | Strong random string |
| `REACT_APP_EMAILJS_SERVICE_ID` | **Same credentials** | **Same credentials** |
| `REACT_APP_EMAILJS_TEMPLATE_HANDYMAN` | **Same credentials** | **Same credentials** |
| `REACT_APP_EMAILJS_TEMPLATE_OPERATIONS` | **Same credentials** | **Same credentials** |
| `REACT_APP_EMAILJS_PUBLIC_KEY` | **Same credentials** | **Same credentials** |

**Note:** EmailJS credentials are the same for local and production! Only the approval URL changes.

---

## Troubleshooting

### Emails not sending?

1. **Check console** - Look for EmailJS errors
2. **Verify credentials** - Double-check Service ID, Template IDs, Public Key
3. **Check EmailJS dashboard** - View email history and errors
4. **Email quota** - Free tier: 200 emails/month (check usage)

### Approval links not working?

1. **Check approval URL** - Must match your environment (localhost vs production)
2. **Token expired** - Tokens expire after 30 days
3. **Already processed** - Can't approve/reject twice

### Console fallback not showing?

1. **Open browser DevTools** - F12 or Cmd+Option+I
2. **Go to Console tab**
3. Look for "📧" emoji in logs

---

## Security Notes

1. **.env.local is git-ignored** - Never commit it
2. **Approval secret** - Use strong random string in production
3. **Token expiration** - Tokens expire after 30 days for security
4. **HTTPS only** - Production should use HTTPS (Firebase Hosting does this automatically)

---

## Next Steps

After email setup works:

1. ✅ Test handyman registration flow
2. ✅ Test approval/rejection workflow
3. ✅ Deploy to Firebase Hosting
4. 🔜 Add confirmation emails (when handyman is approved/rejected)
5. 🔜 Add email templates customization in admin panel

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check EmailJS dashboard for delivery logs
3. Verify all environment variables are set correctly
4. Test with console fallback mode first
