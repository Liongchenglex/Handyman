# Job Dashboard (Handyman)

## Overview

Handyman dashboard showing available jobs, current jobs, profile, and earnings. Different views based on verification status.

## Current Implementation Status

✅ **Implemented**
- Status-based dashboard views (pending/approved/rejected/suspended)
- Job board for available jobs
- Job card component with full details
- Profile view
- My Jobs view
- Express interest in jobs (auto-assigns handyman)
- Stripe onboarding prompt
- Start job functionality
- Mark job complete with WhatsApp notification
- Job action buttons (Start Work, Mark Complete)
- WhatsApp poll-based customer confirmation
- Admin fund release approval page

❌ **Not Implemented**
- Earnings tracking
- Ratings and reviews display
- Job filtering and search
- Automatic Stripe fund transfer

---

## Key Files

### Pages

**`/src/pages/HandymanDashboard.jsx`** - Main dashboard container
- Protected route (requires authentication)
- Loads handyman profile from Firestore
- Routes to status-specific views
- Tab navigation (Jobs / My Jobs / Profile)

### Components

**`/src/components/handyman/JobBoard.jsx`** - Available jobs list
- Fetches jobs with status "pending"
- Filters by handyman's service types
- Displays job cards
- Real-time updates

**`/src/components/handyman/JobCard.jsx`** - Individual job display
- Job details (service, location, timing, budget)
- Express interest button
- Customer info (when assigned)

**`/src/components/handyman/MyJobsView.jsx`** - Handyman's accepted jobs
- Filters jobs by `assignedHandymanId`
- Groups by status (assigned/in_progress/completed)
- Job action buttons

**`/src/components/handyman/ProfileView.jsx`** - Handyman profile
- Display profile info
- Edit functionality
- Stripe onboarding status
- Verification status badge

**`/src/components/handyman/ExpressInterestButton.jsx`** - Interest in job
- Button to express interest
- Creates notification to customer
- Updates job interested handymen list

### Status Views

**`/src/components/handyman/status-views/PendingStatusView.jsx`**
- Shown when `verificationStatus === 'pending'`
- Application under review message
- Stripe onboarding prompt
- Timeline info (24-48 hours)

**`/src/components/handyman/status-views/RejectedStatusView.jsx`**
- Shown when `verificationStatus === 'rejected'`
- Displays rejection reason
- Reapply option
- Contact support link

**`/src/components/handyman/status-views/SuspendedStatusView.jsx`**
- Shown when `verificationStatus === 'suspended'`
- Suspension reason
- Appeal process
- Contact info

---

## Dashboard Flow

```
User logs in as handyman
  ↓
Navigate to: /handyman-dashboard
  → /src/pages/HandymanDashboard.jsx
  ↓
Check authentication
  → useAuth() hook
  → If not logged in → redirect to /handyman-auth
  ↓
Fetch handyman profile
  → getHandyman(currentUser.uid)
  → /src/services/firebase/collections.js
  ↓
Check verificationStatus:

IF status === 'pending':
  → Render: /src/components/handyman/status-views/PendingStatusView.jsx
  → Show: "Application under review"
  → Show: Stripe onboarding prompt

IF status === 'rejected':
  → Render: /src/components/handyman/status-views/RejectedStatusView.jsx
  → Show: Rejection reason
  → Show: Reapply button

IF status === 'suspended':
  → Render: /src/components/handyman/status-views/SuspendedStatusView.jsx
  → Show: Suspension reason

IF status === 'approved':
  → Render: Main dashboard with tabs:
      1. Job Board (default)
      2. My Jobs
      3. Profile
```

---

## Job Board

```
JobBoard component mounts
  ↓
useEffect fetches available jobs
  → /src/hooks/useJobs.js
  → Query Firestore:
      collection: "jobs"
      where: "status" == "pending"
      where: "serviceType" in handyman.serviceTypes
  ↓
Display JobCard for each job
  → /src/components/handyman/JobCard.jsx
  ↓
Each card shows:
  - Service type
  - Description
  - Location
  - Timing (ASAP or scheduled)
  - Budget
  - "Express Interest" button
```

### Express Interest Flow

```
Handyman clicks "Express Interest"
  ↓
Component: /src/components/handyman/ExpressInterestButton.jsx
  ↓
handleExpressInterest() called
  ↓
Update Firestore:
  → jobs/{jobId}/interestedHandymen array
  → Add handyman UID to array
  ↓
Create notification for customer
  → notifications/{notificationId}:
      type: "handyman_interested"
      jobId: jobId
      handymanId: handyman.uid
      handymanName: handyman.name
      createdAt: Timestamp
  ↓
Send email/WhatsApp to customer (future)
  ↓
Update button state to "Interest Sent"
```

---

## My Jobs View

```
MyJobsView component
  ↓
Fetch jobs assigned to handyman
  → Query:
      where: "assignedHandymanId" == handyman.uid
  ↓
Group by status:
  - Assigned (status === "assigned")
  - In Progress (status === "in_progress")
  - Completed (status === "completed")
  ↓
Display with action buttons:
  - Assigned → "Start Job" button
  - In Progress → "Mark Complete" button
  - Completed → View only
```

---

## Profile View

```
ProfileView component
  ↓
Display handyman profile data:
  - Name
  - Email
  - Phone
  - Service types
  - Experience
  - Bio
  - Verification badge
  - Rating (stars)
  - Total jobs completed
  ↓
Stripe onboarding status:
  IF stripeOnboardingComplete === false:
    → Show: "Complete Stripe Setup" button
    → /src/components/handyman/StripeOnboardingPrompt.jsx
  ELSE:
    → Show: "Connected" badge
    → Show: "View Stripe Dashboard" link
  ↓
Edit profile button
  → Opens edit modal (future)
```

---

## Firestore Queries

### Get Available Jobs

```javascript
// In JobBoard component
const jobsQuery = query(
  collection(db, 'jobs'),
  where('status', '==', 'pending'),
  where('serviceType', 'in', handyman.serviceTypes),
  orderBy('createdAt', 'desc'),
  limit(20)
);
```

### Get Handyman's Jobs

```javascript
// In MyJobsView component
const myJobsQuery = query(
  collection(db, 'jobs'),
  where('assignedHandymanId', '==', handyman.uid),
  orderBy('createdAt', 'desc')
);
```

---

## Job Actions (Future Implementation)

### Accept Job

```
Handyman clicks "Accept Job"
  ↓
Update Firestore:
  → jobs/{jobId}:
      status: "assigned"
      assignedHandymanId: handyman.uid
      assignedAt: Timestamp
  ↓
Notify customer
  → Email + WhatsApp
  ↓
Update other interested handymen
  → Job no longer available
```

### Start Job

```
Handyman clicks "Start Job"
  ↓
Update Firestore:
  → jobs/{jobId}:
      status: "in_progress"
      startedAt: Timestamp
  ↓
Notify customer: "Handyman has arrived"
```

### Mark Complete (Implemented)

```
Handyman clicks "Mark Complete"
  ↓
JobActionButtons.jsx (completionFlow="pending_confirmation")
  ↓
Update Firestore:
  → jobs/{jobId}:
      status: "pending_confirmation"
      completedAt: Timestamp
      completedBy: { uid, name, email }
  ↓
Send WhatsApp notification via Green-API:
  → sendJobCompletionNotification(job, handymanInfo)
  → Customer receives text message + poll
  ↓
Poll options:
  - ✅ Yes, Confirm Complete
  - ⚠️ No, Report Issue
  ↓
Customer votes on WhatsApp poll
  → Green-API webhook receives vote
  → Vote is locked (pollVoteLocked: true)
  ↓
IF "Yes, Confirm":
  → status: "pending_admin_approval"
  → customerConfirmedAt: Timestamp
  → confirmedVia: "whatsapp_poll"
  ↓
IF "No, Report Issue":
  → status: "disputed"
  → disputedAt: Timestamp
  ↓
Admin visits /admin/fund-release
  → Reviews pending jobs
  → Clicks "Release Funds"
  → status: "completed"
  → adminApprovedAt: Timestamp
  ↓
(Future) Trigger Stripe fund transfer
```

---

## Job Status Lifecycle

```
pending (job created, payment authorized)
  ↓ [Handyman accepts]
accepted
  ↓ [Handyman clicks "Start Work"]
in_progress
  ↓ [Handyman clicks "Mark Complete"]
pending_confirmation (awaiting customer WhatsApp poll)
  ↓ [Customer confirms via poll]
pending_admin_approval (awaiting admin fund release)
  ↓ [Admin approves]
completed (job done, funds released)

Alternative paths:
- Customer votes NO → disputed
- Job cancelled → cancelled
```

### Status Definitions

| Status | Description | Next Action | Who Updates |
|--------|-------------|-------------|-------------|
| `pending` | Job created, awaiting handyman | Handyman accepts | System |
| `accepted` | Handyman assigned, not started | Start Work button | Handyman |
| `in_progress` | Work in progress | Mark Complete button | Handyman |
| `pending_confirmation` | Awaiting customer poll response | Customer votes | Webhook |
| `pending_admin_approval` | Customer confirmed, awaiting admin | Release Funds button | Admin |
| `completed` | Job done, funds released | - | Admin |
| `disputed` | Issue reported | Admin review | Webhook/Admin |
| `cancelled` | Job cancelled | - | Customer/Admin |

---

## Admin Fund Release Page

**Route:** `/admin/fund-release`

**Access:** Restricted to emails in ADMIN_EMAILS array

**Features:**
- Lists jobs with `status: pending_admin_approval`
- Shows job details (service, customer, amount)
- "Release Funds" button to approve
- Updates status to `completed`

**File:** `/src/pages/AdminFundRelease.jsx`

---

## Related Documentation

- [Job Creation Flow](./job-creation-flow.md)
- [Handyman Registration](./handyman-registration.md)
- [Stripe Payment](./stripe-payment.md)
- [Authentication](./authentication.md)

---

**Last Updated:** 2026-02-02
**Status:** ✅ Fully implemented - Includes job actions and WhatsApp confirmation flow
