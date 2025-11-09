# Dashboard Status Views

This document explains the different dashboard views shown to handymen based on their verification status.

---

## Overview

The HandymanDashboard now dynamically displays different content based on the handyman's `status` field in Firestore.

### Status Flow

```
Registration → pending → (approved) → active → (can work)
                    ↓
                (rejected) → rejected → (appeal option)
                    ↓
                (suspended) → suspended → (contact support)
```

---

## Status Views

### 1. PENDING STATUS - "Application Under Review"

**When shown:**
- `status === 'pending'`
- After handyman completes registration
- Default state for new handymen

**What handyman sees:**
- ⏳ Yellow "pending" icon
- "Application Under Review" title
- Message: "Thank you for registering with EazyDone! Our operations team is currently reviewing your application."
- Timeline: "Our team typically reviews applications within 1-2 business days"
- Registration details summary (name, email, services, status)
- Support contact link

**What handyman CANNOT do:**
- ❌ Cannot see job board
- ❌ Cannot browse available jobs
- ❌ Cannot accept jobs

**What handyman CAN do:**
- ✅ View their registration details
- ✅ Contact support
- ✅ Wait for approval email

---

### 2. ACTIVE STATUS - Full Dashboard

**When shown:**
- `status === 'active'`
- `verified === true`
- After operations team approves

**What handyman sees:**
- Full HandymanDashboard with all features
- Three tabs: Available Jobs, My Jobs, Profile
- Job board with all available jobs
- Ability to express interest in jobs
- My jobs list with status tracking
- Profile page with stats

**What handyman CAN do:**
- ✅ Browse all available jobs
- ✅ Express interest in jobs
- ✅ View accepted jobs
- ✅ Mark jobs as in progress
- ✅ Mark jobs as completed
- ✅ Contact customers
- ✅ View and edit profile

**This is the normal, fully functional dashboard**

---

### 3. REJECTED STATUS - "Application Not Approved"

**When shown:**
- `status === 'rejected'`
- After operations team rejects

**What handyman sees:**
- 🚫 Red "cancel" icon
- "Application Not Approved" title
- Message: "Unfortunately, we are unable to approve your handyman application at this time."
- Rejection reason (if provided by ops team)
- **Appeal option** - Pre-filled email to operations team
- Application details summary
- Support contact link

**What handyman CANNOT do:**
- ❌ Cannot see job board
- ❌ Cannot browse or accept jobs
- ❌ Cannot work on platform

**What handyman CAN do:**
- ✅ View rejection reason
- ✅ **Email operations team to appeal** (blue button with pre-filled email)
- ✅ Contact support

**Appeal email template includes:**
- Subject: "Handyman Application Appeal - [Name]"
- Pre-filled body with handyman details
- Space for handyman to explain why they should be reconsidered

---

### 4. SUSPENDED STATUS - "Account Suspended"

**When shown:**
- `status === 'suspended'`
- If handyman account is suspended (future feature)

**What handyman sees:**
- ⛔ Orange "block" icon
- "Account Suspended" title
- Message: "Your handyman account has been temporarily suspended."
- Suspension reason (if provided)
- Contact support button

**What handyman CANNOT do:**
- ❌ Cannot access job board
- ❌ Cannot work on any jobs
- ❌ Account is locked

**What handyman CAN do:**
- ✅ Contact support to resolve issue
- ✅ View suspension reason

---

## Code Logic

### Status Check Flow

```javascript
// In HandymanDashboard.jsx

const handymanStatus = userProfile?.handyman?.status || 'pending';
const handymanVerified = userProfile?.handyman?.verified || false;

// 1. Check if pending
if (handymanStatus === 'pending') {
  return <PendingStatusView />;
}

// 2. Check if rejected
if (handymanStatus === 'rejected') {
  return <RejectedStatusView />;
}

// 3. Check if suspended
if (handymanStatus === 'suspended') {
  return <SuspendedStatusView />;
}

// 4. Check if active AND verified
if (handymanStatus !== 'active' || !handymanVerified) {
  return <PendingStatusView />;
}

// 5. Show full dashboard (active handymen only)
return <FullDashboard />;
```

---

## Firestore Data Structure

### Pending Handyman
```javascript
{
  uid: "user123",
  name: "John Doe",
  email: "john@example.com",
  verified: false,
  status: "pending",
  // ... other fields
}
```

### Active Handyman (Approved)
```javascript
{
  uid: "user123",
  name: "John Doe",
  email: "john@example.com",
  verified: true,
  status: "active",
  verifiedAt: "2024-01-15T10:30:00.000Z",
  // ... other fields
}
```

### Rejected Handyman
```javascript
{
  uid: "user123",
  name: "John Doe",
  email: "john@example.com",
  verified: false,
  status: "rejected",
  rejectedAt: "2024-01-15T10:30:00.000Z",
  rejectedReason: "Insufficient experience documentation",
  // ... other fields
}
```

### Suspended Handyman
```javascript
{
  uid: "user123",
  name: "John Doe",
  email: "john@example.com",
  verified: true, // Was verified before
  status: "suspended",
  suspendedAt: "2024-02-20T14:00:00.000Z",
  suspendedReason: "Violation of terms of service",
  // ... other fields
}
```

---

## User Experience Flow

### New Handyman Journey

```
1. Handyman completes registration form
   ↓
2. Redirected to dashboard
   Status: pending
   Sees: "Application Under Review" page
   ↓
3. Receives email: "Welcome to EazyDone - Registration Received!"
   ↓
4. Operations team receives email with approve/reject buttons
   ↓
5a. Operations APPROVES
    Status: active, verified: true
    Handyman sees: Full dashboard with job board
    Receives email: "Congrats! You're approved" (TODO)

5b. Operations REJECTS
    Status: rejected, verified: false
    Handyman sees: "Application Not Approved" page
    Can click: "Email Operations Team" to appeal
    Receives email: "Application Update" (TODO)
```

---

## Testing Status Views

### How to Test Each View

**1. Test Pending View:**
```javascript
// Set in Firestore handymen collection
{
  status: "pending",
  verified: false
}
```
Then navigate to /handyman-dashboard

**2. Test Active View:**
```javascript
// Set in Firestore handymen collection
{
  status: "active",
  verified: true,
  verifiedAt: "2024-01-15T10:30:00.000Z"
}
```

**3. Test Rejected View:**
```javascript
// Set in Firestore handymen collection
{
  status: "rejected",
  verified: false,
  rejectedAt: "2024-01-15T10:30:00.000Z",
  rejectedReason: "Test rejection reason"
}
```

**4. Test Suspended View:**
```javascript
// Set in Firestore handymen collection
{
  status: "suspended",
  verified: true,
  suspendedAt: "2024-02-20T14:00:00.000Z",
  suspendedReason: "Test suspension"
}
```

---

## UI Components

### All Status Views Include:
- ✅ Responsive design (mobile-friendly)
- ✅ Dark mode support
- ✅ HandymanHeader (locked to profile view for non-active users)
- ✅ Professional icons from Material Symbols
- ✅ Clear messaging about what's happening
- ✅ Contact/support options
- ✅ User details summary

### Only Active View Has:
- Job board tab
- My jobs tab
- Full profile editing
- Job acceptance functionality
- Customer contact features

---

## Email Integration

### Pending Status
- Handyman receives: Welcome email
- Operations receives: Registration notification with approve/reject buttons

### Active Status (Approved)
- TODO: Send "Congratulations! You're approved" email
- TODO: Include getting started guide

### Rejected Status
- TODO: Send "Application Update" email
- TODO: Include appeal instructions

---

## Future Enhancements

🔜 **TODO: Add status badges to profile**
- Show status badge in profile view
- Visual indicator of account standing

🔜 **TODO: Add appeal workflow**
- Formal appeal submission form
- Track appeal status
- Operations team dashboard to review appeals

🔜 **TODO: Add reactivation for suspended accounts**
- Operations can reactivate suspended accounts
- Send reactivation confirmation email

🔜 **TODO: Add automatic status transitions**
- Auto-suspend if no activity for X days
- Auto-remind ops team if pending > 7 days

---

## Support Contacts

All status views provide support contact:
- Email: support@eazydone.com
- Operations (for appeals): operations@eazydone.com

Pre-filled email templates help users provide necessary information.

---

## Summary

✅ **Implemented:**
- Pending status view (under review)
- Active status view (full dashboard)
- Rejected status view (with appeal option)
- Suspended status view (contact support)
- Dynamic status checking
- User-friendly messaging
- Mobile-responsive design
- Dark mode support

✅ **Benefits:**
- Clear communication at each stage
- Professional user experience
- Easy appeal process for rejected applications
- Prevents unauthorized access to job board
- Reduces support inquiries (users know what's happening)
