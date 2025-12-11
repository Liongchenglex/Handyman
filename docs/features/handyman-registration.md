# Handyman Registration & Stripe Onboarding

## Overview

Complete workflow for handymen to register on the platform, get verified by operations team, and complete Stripe Connect onboarding to receive payments.

## Current Implementation Status

✅ **Implemented**
- Multi-step registration form
- Document upload (ID, certifications)
- Email notifications (handyman + operations)
- Admin approval/rejection system
- Stripe Connect account creation
- Stripe Express onboarding flow
- Verification status tracking

❌ **Not Implemented**
- Automated document verification (currently manual)
- Background check integration
- SMS verification during registration
- Real-time approval notifications via WhatsApp

---

## Key Files & Functions

### Frontend Components

#### `/src/pages/HandymanRegistration.jsx`
Main registration page container.

**Key Features:**
- Multi-step form wizard
- Progress stepper UI
- Routing and navigation

#### `/src/components/handyman/HandymanRegistration.jsx`
Core registration form component.

**Key Functions:**
- `handleSubmit()` - Validates form, creates Firebase user, uploads documents, sends emails
- `handleDocumentUpload()` - Uploads documents to Firebase Storage with validation and progress tracking
- `sendRegistrationEmails()` - Sends confirmation email to handyman and notification to operations team
- `handleStripeOnboarding()` - Creates Stripe Connect account and generates onboarding link

**Form Steps:**
1. Personal Information (name, email, phone, NRIC)
2. Services & Experience (service types, years, bio)
3. Document Upload (ID, certifications, insurance)
4. Review & Submit

#### `/src/components/handyman/status-views/PendingStatusView.jsx`
Dashboard view shown to handymen awaiting approval.

**Features:**
- "Pending Review" status message
- Stripe onboarding prompt
- Application timeline

#### `/src/components/handyman/status-views/RejectedStatusView.jsx`
Dashboard view shown to rejected handymen.

**Features:**
- Rejection reason display
- Re-application option
- Contact support link

#### `/src/components/handyman/StripeOnboardingPrompt.jsx`
Prompt to complete Stripe Connect onboarding.

**Key Functions:**
- `handleStartOnboarding()` - Creates Stripe Express account, generates onboarding URL, redirects handyman
- `checkOnboardingStatus()` - Polls Stripe API to verify onboarding completion and updates Firestore

### Backend Services

#### `/src/services/firebase/collections.js`
Firestore database operations.

**Key Functions:**
- `createHandyman(uid, data)` - Creates handyman document in Firestore with initial profile data
- `updateHandyman(uid, updates)` - Updates existing handyman document with new data
- `getHandyman(uid)` - Retrieves handyman profile document from Firestore
- `updateHandymanVerificationStatus(uid, status, reason)` - Updates verification status and reason fields

#### `/src/services/firebase/storage.js`
Firebase Storage operations for document uploads.

**Key Functions:**
- `uploadHandymanDocument(uid, file, documentType)` - Uploads document to Firebase Storage with proper path structure
- `getHandymanDocumentURL(uid, documentType)` - Retrieves download URL for uploaded document
- `deleteHandymanDocument(uid, documentType)` - Removes document from Firebase Storage

**Storage Structure:**
```
handyman-documents/
  {uid}/
    nric.pdf
    certifications/
      cert1.pdf
      cert2.jpg
    insurance.pdf
```

#### `/src/services/emailService.js`
Email notification service using EmailJS.

**Key Functions:**
- `sendHandymanAcknowledgment(handymanData)` - Send confirmation to handyman (Line ~45)
- `sendOperationsNotification(handymanData)` - Notify operations team (Line ~80)

**Email Templates Used:**
- `REACT_APP_EMAILJS_TEMPLATE_HANDYMAN` - Handyman acknowledgment
- `REACT_APP_EMAILJS_TEMPLATE_OPERATIONS` - Operations notification

#### `/src/services/stripe/stripeApi.js`
Stripe Connect API integration.

**Key Functions:**
- `createConnectedAccount(handymanData)` - Create Stripe Express account (Line 127)
- `createAccountLink(linkData)` - Generate onboarding URL (Line 146)
- `getAccountStatus(accountId)` - Check onboarding completion (Line 162)
- `createLoginLink(accountId)` - Generate Stripe Dashboard login link (Line 178)

### Backend (Firebase Functions)

#### `/functions/index.js`
Cloud Functions for Stripe and payment operations.

**Key Exports:**
- `createConnectedAccount` - HTTP function to create Stripe account (Line ~150)
- `createAccountLink` - HTTP function to generate onboarding link (Line ~200)
- `getAccountStatus` - HTTP function to check account status (Line ~250)

---

## Registration Flow

### Step 1: Handyman Fills Registration Form

```
User navigates to: /handyman-registration
↓
Component: /src/pages/HandymanRegistration.jsx
↓
Renders: /src/components/handyman/HandymanRegistration.jsx
↓
User completes 4-step form:
  1. Personal Info (name, email, phone, NRIC, address)
  2. Services (serviceTypes[], experience, bio, availability)
  3. Documents (ID upload, certifications, insurance)
  4. Review & Submit
```

### Step 2: Document Upload

```
User uploads documents
↓
handleDocumentUpload() called
  → /src/components/handyman/HandymanRegistration.jsx:320
↓
Upload to Firebase Storage
  → /src/services/firebase/storage.js:25
  → uploadHandymanDocument(uid, file, documentType)
↓
Store download URLs in form state
```

### Step 3: Form Submission

```
User clicks "Submit Registration"
↓
handleSubmit() called
  → /src/components/handyman/HandymanRegistration.jsx:450
↓
Create Firebase Auth account
  → /src/services/firebase/auth.js:36
  → registerHandyman()
↓
Create Firestore documents
  → /src/services/firebase/collections.js:120
  → createHandyman(uid, handymanData)
↓
Data structure:
{
  uid: "firebase_uid",
  name: "John Tan",
  email: "john@example.com",
  phone: "+6591234567",
  nric: "S1234567D",
  address: "123 Main Street, Singapore",
  serviceTypes: ["Plumbing", "Electrical"],
  experience: "5 years",
  bio: "Professional handyman...",

  // Verification
  verificationStatus: "pending",
  verificationReason: null,

  // Documents
  documents: {
    nric: "gs://bucket/handyman-documents/{uid}/nric.pdf",
    certifications: ["gs://..."],
    insurance: "gs://..."
  },

  // Stripe (null initially)
  stripeAccountId: null,
  stripeOnboardingComplete: false,

  // Status
  verified: false,
  isAvailable: true,

  // Ratings
  rating: 0,
  totalJobs: 0,

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Step 4: Send Email Notifications

```
After Firestore save
↓
sendRegistrationEmails() called
  → /src/components/handyman/HandymanRegistration.jsx:480
↓
Send to Handyman
  → /src/services/emailService.js:45
  → sendHandymanAcknowledgment()
  → EmailJS template: REACT_APP_EMAILJS_TEMPLATE_HANDYMAN

  Email content:
    - "Thank you for registering"
    - "We're reviewing your application"
    - "You'll hear from us within 24-48 hours"
↓
Send to Operations Team
  → /src/services/emailService.js:80
  → sendOperationsNotification()
  → EmailJS template: REACT_APP_EMAILJS_TEMPLATE_OPERATIONS
  → To: REACT_APP_OPERATIONS_EMAIL

  Email content:
    - Handyman details
    - Service types
    - Document links
    - Approval/Rejection buttons with tokens
```

### Step 5: Operations Team Review

```
Operations team receives email
↓
Clicks "Approve" or "Reject" button
↓
Opens: /admin/approve-handyman?token={encrypted_token}
  → /src/pages/ApproveHandyman.jsx
↓
Decrypt token and verify
↓
If APPROVED:
  → updateHandymanVerificationStatus(uid, 'approved', null)
  → Set verified: true
  → Set verificationStatus: 'approved'
  → Send approval confirmation email

If REJECTED:
  → updateHandymanVerificationStatus(uid, 'rejected', reason)
  → Set verified: false
  → Set verificationStatus: 'rejected'
  → Set verificationReason: "Reason from operations"
  → Send rejection email with reason
```

---

## Stripe Connect Onboarding

### When to Start Onboarding

**Trigger 1: During Registration (Recommended)**
- After successful registration
- Handyman clicks "Complete Stripe Setup" button
- Located in: `/src/components/handyman/HandymanRegistration.jsx:520`

**Trigger 2: From Dashboard (If Skipped)**
- After approval, when handyman logs in
- Dashboard shows onboarding prompt
- Located in: `/src/components/handyman/StripeOnboardingPrompt.jsx:45`

### Onboarding Flow

```
Step 1: Create Stripe Connect Account
  ↓
  handleStartOnboarding() called
    → /src/components/handyman/StripeOnboardingPrompt.jsx:45
  ↓
  Call Stripe API
    → /src/services/stripe/stripeApi.js:127
    → createConnectedAccount({
        uid: handyman.uid,
        email: handyman.email,
        name: handyman.name,
        phone: handyman.phone
      })
  ↓
  Firebase Function: /functions/index.js (createConnectedAccount)
    → Creates Stripe Express account
    → Type: 'express'
    → Capabilities: { transfers: { requested: true } }
    → Metadata: { firebaseUid: uid }
  ↓
  Returns: { accountId: "acct_xxxxx" }
  ↓
  Update Firestore
    → updateHandyman(uid, { stripeAccountId: accountId })

Step 2: Generate Onboarding Link
  ↓
  Call Stripe API
    → /src/services/stripe/stripeApi.js:146
    → createAccountLink({
        accountId: "acct_xxxxx",
        refreshUrl: window.location.href,
        returnUrl: `${window.location.origin}/handyman-dashboard`
      })
  ↓
  Firebase Function: /functions/index.js (createAccountLink)
    → Creates AccountLink for Express onboarding
    → Type: 'account_onboarding'
  ↓
  Returns: { url: "https://connect.stripe.com/setup/..." }

Step 3: Redirect to Stripe
  ↓
  window.location.href = onboardingUrl
  ↓
  Handyman completes Stripe Express onboarding:
    - Business details
    - Bank account (for payouts)
    - ID verification
    - Tax information

Step 4: Return to Dashboard
  ↓
  After completion, Stripe redirects to returnUrl
    → /handyman-dashboard
  ↓
  Check onboarding status
    → /src/components/handyman/StripeOnboardingPrompt.jsx:80
    → checkOnboardingStatus()
  ↓
  Call Stripe API
    → /src/services/stripe/stripeApi.js:162
    → getAccountStatus(accountId)
  ↓
  Check: account.details_submitted === true
        AND account.charges_enabled === true
  ↓
  If complete:
    → updateHandyman(uid, {
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true
      })
```

---

## Firestore Data Structure

### Handymen Collection (`handymen/{uid}`)

```javascript
{
  // Basic Info
  uid: "firebase_user_id",
  name: "John Tan",
  email: "john@example.com",
  phone: "+6591234567",
  nric: "S1234567D",
  address: "123 Main Street, Singapore 123456",

  // Services
  serviceTypes: ["Plumbing", "Electrical", "Carpentry"],
  experience: "5 years",
  bio: "Professional handyman with 5+ years experience in residential repairs",

  // Availability
  isAvailable: true,
  notificationPreferences: {
    email: true,
    whatsapp: true,
    push: false
  },

  // Verification Status
  verificationStatus: "pending" | "approved" | "rejected" | "suspended",
  verified: false,
  verificationReason: null, // Set when rejected
  verifiedAt: null, // Timestamp when approved
  verifiedBy: null, // Admin UID who approved

  // Documents
  documents: {
    nric: "https://storage.googleapis.com/...",
    certifications: [
      "https://storage.googleapis.com/...",
      "https://storage.googleapis.com/..."
    ],
    insurance: "https://storage.googleapis.com/..."
  },

  // Stripe Connect
  stripeAccountId: "acct_xxxxx",
  stripeOnboardingComplete: true,
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,

  // Performance Metrics
  rating: 4.8,
  totalJobs: 25,
  completedJobs: 23,
  cancelledJobs: 2,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt: Timestamp
}
```

---

## Email Templates Configuration

### Environment Variables Required

```env
# EmailJS Configuration
REACT_APP_EMAILJS_SERVICE_ID=service_xxxxx
REACT_APP_EMAILJS_PUBLIC_KEY=xxxxx

# Templates
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=template_xxxxx
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=template_xxxxx

# Operations Email
REACT_APP_OPERATIONS_EMAIL=operations@eazydone.com

# Approval Base URL (environment-specific)
REACT_APP_APPROVAL_BASE_URL=http://localhost:3000/admin/approve-handyman  # Dev
REACT_APP_APPROVAL_BASE_URL=https://eazydone-d06cf.web.app/admin/approve-handyman  # Prod
```

### Email Content Templates

**Handyman Acknowledgment Email:**
```
Subject: Thank You for Registering - EazyDone

Hi {{handyman_name}},

Thank you for registering with EazyDone!

We've received your application and are currently reviewing your information and documents.

Our operations team will review your application within 24-48 hours, and you'll receive an email with the outcome.

In the meantime, you can complete your Stripe onboarding to ensure you're ready to receive payments once approved.

Best regards,
The EazyDone Team
```

**Operations Notification Email:**
```
Subject: New Handyman Registration - {{handyman_name}}

A new handyman has registered:

Name: {{handyman_name}}
Email: {{handyman_email}}
Phone: {{handyman_phone}}
Services: {{service_types}}
Experience: {{experience}}

Documents:
- NRIC: [View Document]
- Certifications: [View Documents]
- Insurance: [View Document]

[Approve Registration] [Reject Registration]
```

---

## Admin Approval System

### Approval Page

**File:** `/src/pages/ApproveHandyman.jsx`

**URL:** `/admin/approve-handyman?token={encrypted_token}`

**Token Format:**
```javascript
{
  handymanId: "firebase_uid",
  action: "approve" | "reject",
  timestamp: Date.now(),
  signature: "encrypted_hash"
}
```

**Approval Flow:**
```
1. Admin clicks button in email
   ↓
2. Opens approval page with token
   ↓
3. Decrypt and validate token
   ↓
4. Display handyman details
   ↓
5. Admin confirms action
   ↓
6. Update Firestore:
     - verificationStatus: 'approved'
     - verified: true
     - verifiedAt: Timestamp
     - verifiedBy: admin_uid
   ↓
7. Send confirmation email to handyman
   ↓
8. Show success message
```

**Rejection Flow:**
```
1. Admin clicks "Reject" in email
   ↓
2. Opens approval page
   ↓
3. Admin enters rejection reason
   ↓
4. Update Firestore:
     - verificationStatus: 'rejected'
     - verified: false
     - verificationReason: "Reason text"
   ↓
5. Send rejection email with reason
   ↓
6. Show confirmation
```

---

## Stripe Connect Account Structure

### Express Account Capabilities

```javascript
{
  type: 'express',
  capabilities: {
    transfers: { requested: true }
  },
  business_type: 'individual',
  metadata: {
    firebaseUid: handyman.uid,
    handymanName: handyman.name,
    registeredAt: Date.now()
  }
}
```

### Onboarding Requirements

**Required Information:**
- Legal business name (or individual name)
- Business address
- Bank account details
- ID verification (passport/IC)
- Tax information

**Singapore-Specific:**
- NRIC/FIN for individuals
- UEN for companies
- Local bank account (DBS, OCBC, UOB, etc.)

---

## Dashboard Status Views

Handymen see different dashboard views based on their verification status:

### Pending Status
**Component:** `/src/components/handyman/status-views/PendingStatusView.jsx`

**Shows:**
- "Application Under Review" message
- Expected timeline (24-48 hours)
- Stripe onboarding prompt
- Application details

### Approved Status
**Component:** Main dashboard (`/src/pages/HandymanDashboard.jsx`)

**Shows:**
- Job board
- My jobs
- Profile
- Earnings

### Rejected Status
**Component:** `/src/components/handyman/status-views/RejectedStatusView.jsx`

**Shows:**
- Rejection reason
- "Reapply" option
- Contact support link

### Suspended Status
**Component:** `/src/components/handyman/status-views/SuspendedStatusView.jsx`

**Shows:**
- Suspension reason
- Appeal process
- Contact support

---

## Testing Checklist

### Registration Flow
- [ ] Complete all form steps successfully
- [ ] Upload documents (ID, certifications)
- [ ] Receive acknowledgment email
- [ ] Operations receives notification email
- [ ] Firestore documents created correctly
- [ ] Storage documents uploaded successfully

### Stripe Onboarding
- [ ] Create Stripe Connect account
- [ ] Generate onboarding link
- [ ] Complete Stripe Express onboarding
- [ ] Account status updates to complete
- [ ] Firestore updated with account ID
- [ ] Can access Stripe Dashboard

### Approval System
- [ ] Approval email link works
- [ ] Token validates correctly
- [ ] Approval updates Firestore
- [ ] Handyman receives confirmation email
- [ ] Dashboard shows approved status

### Rejection System
- [ ] Rejection email link works
- [ ] Can enter rejection reason
- [ ] Firestore updated with reason
- [ ] Handyman receives rejection email
- [ ] Dashboard shows rejected status with reason

---

## Future Enhancements

1. **Automated Document Verification**
   - OCR for ID verification
   - Automatic certification validation
   - Background check API integration

2. **Real-Time Notifications**
   - WhatsApp notifications for status changes
   - Push notifications for mobile app

3. **Enhanced Onboarding**
   - Video introduction option
   - Portfolio/work samples upload
   - Customer reviews import

4. **Batch Approval**
   - Admin dashboard for bulk approval
   - Advanced filtering and search

---

## Related Documentation

- [Authentication](./authentication.md)
- [Stripe Payment Integration](./stripe-payment.md)
- [Email Setup](../setup/email-setup.md)
- [Firebase Setup](../setup/firebase-setup.md)

---

**Last Updated:** 2025-12-11
**Status:** ✅ Fully Implemented and Production-Ready
