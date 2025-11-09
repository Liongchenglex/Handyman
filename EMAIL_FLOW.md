# Email Flow - Simplified

This document shows the complete email flow for handyman registration.

---

## Complete Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Handyman Fills Registration Form                           │
│     - Personal info (name, phone, address)                      │
│     - Professional info (services, experience, rate)            │
│     - Documents (CV, profile picture)                           │
│     - Preferences (notifications)                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Firebase Auth Account Created                               │
│     - Email: handyman@example.com                               │
│     - Password: hashed                                          │
│     - UID: user123                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Firestore Documents Created                                 │
│                                                                  │
│     users/user123:                                              │
│       { email, name, phone, role: "handyman" }                  │
│                                                                  │
│     handymen/user123:                                           │
│       { ..., verified: false, status: "pending" }               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Documents Uploaded to Storage                               │
│     - Profile picture → handymen/{uid}/profile/                 │
│     - CV/Work docs → handymen/{uid}/work-experience/            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. TWO EMAILS SENT (via EmailJS)                               │
│                                                                  │
│  📧 Email #1: To Handyman                                       │
│     Subject: "Welcome to EazyDone - Registration Received!"     │
│     Content:                                                    │
│       - Welcome message                                         │
│       - Registration details summary                            │
│       - "We're reviewing your application (1-2 days)"           │
│       - Support contact info                                    │
│                                                                  │
│  📧 Email #2: To Operations Team                                │
│     Subject: "New Handyman Registration: John Doe"              │
│     Content:                                                    │
│       - Complete handyman profile                               │
│       - All uploaded documents (links)                          │
│       - Profile picture                                         │
│       - ✅ [Approve] button                                     │
│       - ❌ [Reject] button                                      │
│       - Link to Firebase Console                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Handyman Sees Dashboard                                     │
│     Status: "Your application is under review"                  │
│     Cannot see job board yet                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  7a. Operations Team APPROVES                                   │
│      (Clicks "Approve" button in email)                         │
│                                                                  │
│      Firestore updated:                                         │
│        verified: true                                           │
│        status: "active"                                         │
│        verifiedAt: timestamp                                    │
│                                                                  │
│      TODO: Send approval confirmation email to handyman         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  8a. Handyman Can Now Work                                      │
│      - Dashboard shows job board                                │
│      - Can browse and accept jobs                               │
│      - Status: "Active"                                         │
└─────────────────────────────────────────────────────────────────┘

                           OR

┌─────────────────────────────────────────────────────────────────┐
│  7b. Operations Team REJECTS                                    │
│      (Clicks "Reject" button in email)                          │
│                                                                  │
│      Firestore updated:                                         │
│        verified: false                                          │
│        status: "rejected"                                       │
│        rejectedAt: timestamp                                    │
│                                                                  │
│      TODO: Send rejection notification email to handyman        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  8b. Handyman Sees Rejection Message                            │
│      - Dashboard shows "Application not approved"               │
│      - Cannot access job board                                  │
│      - Status: "Rejected"                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Email Timeline

| Time | Event | Emails Sent |
|------|-------|-------------|
| T+0 min | Handyman submits registration | 2 emails sent immediately |
| T+0 min | Handyman receives | ✉️ Welcome email |
| T+0 min | Operations receives | ✉️ Review request with approve/reject buttons |
| T+1-2 days | Operations reviews application | - |
| T+1-2 days | Operations clicks approve/reject | 🔜 TODO: Confirmation email to handyman |
| T+1-2 days | Handyman receives decision | 🔜 TODO: Approval or rejection email |

---

## What We Removed (Simplified)

### ❌ What We DON'T Use Anymore

**Firebase Auth Email Verification:**
```javascript
// REMOVED - We don't use this
await sendEmailVerification(user);
```

This would have sent a third email:
- Generic Firebase branded email
- "Please verify your email address"
- Click link to verify
- Redundant with our custom emails

### ✅ What We DO Use Now

**Custom Branded Emails via EmailJS:**
- Professional, branded emails
- Customized content
- Two emails total:
  1. Handyman acknowledgment
  2. Operations notification with approval buttons

---

## Why This Is Better

1. **No Confusion**: Handyman receives ONE email, not two
2. **Branded Experience**: All emails come from EazyDone with your branding
3. **Simpler Flow**: No need to track Firebase email verification
4. **Manual Approval**: Operations team reviews documents anyway, so their approval is what matters
5. **Better UX**: Clear communication at each step

---

## Email Content Preview

### Email to Handyman

```
From: EazyDone <noreply@emailjs.com>
To: handyman@example.com
Subject: Welcome to EazyDone - Registration Received!

Hi John,

Thank you for registering as a handyman with EazyDone! We're excited to have
you on our platform.

Registration Details:
• Name: John Doe
• Email: handyman@example.com
• Phone: 9123 4567
• Service Types: Plumbing, Electrical
• Experience Level: 5+ years
• Service Areas: Central, North

What's Next?
Our operations team is currently reviewing your application. This typically
takes 1-2 business days. We'll notify you via email once your account is
approved.

Once approved, you'll be able to:
✓ Browse and accept job requests in your area
✓ Build your reputation through customer reviews
✓ Earn money doing what you do best

Questions? Contact support@eazydone.com

Best regards,
The EazyDone Team
```

### Email to Operations Team

```
From: EazyDone <noreply@emailjs.com>
To: operations@eazydone.com
Subject: New Handyman Registration: John Doe

New Handyman Registration - Action Required

Personal Information:
• Full Name: John Doe
• Email: handyman@example.com
• Phone: 9123 4567
• Address: 123 Orchard Road, 238864
• User ID: user123

Professional Information:
• Service Types: Plumbing, Electrical
• Experience Level: 5+ years
• Hourly Rate: SGD $25/hour
• Service Areas: Central, North
• Availability: Full-time

Documents:
📄 CV - View/Download
📷 Profile Picture - [Image displayed]

[✓ Approve Registration]  [✗ Reject Registration]

View in Firebase Console
```

---

## Future Enhancements

🔜 **TODO: Add confirmation emails**
- When ops team approves → Send "Congrats! You're approved" email to handyman
- When ops team rejects → Send "Application update" email to handyman

🔜 **TODO: Reminder emails**
- If ops team hasn't reviewed in 3 days → Send reminder to ops
- If handyman's application pending for 7 days → Send status update

🔜 **TODO: Email preferences**
- Allow handyman to customize which emails they receive
- Managed in dashboard preferences
