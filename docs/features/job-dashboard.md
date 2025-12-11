# Job Dashboard (Handyman)

## Overview

Handyman dashboard showing available jobs, current jobs, profile, and earnings. Different views based on verification status.

## Current Implementation Status

✅ **Implemented**
- Status-based dashboard views (pending/approved/rejected/suspended)
- Job board for available jobs
- Job card component
- Profile view
- My Jobs view
- Express interest in jobs
- Stripe onboarding prompt

❌ **Not Implemented**
- Job acceptance flow
- Start job functionality
- Mark job complete
- Earnings tracking
- Ratings and reviews display
- Job filtering and search

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

### Mark Complete

```
Handyman clicks "Mark Complete"
  ↓
Update Firestore:
  → jobs/{jobId}:
      status: "completed"
      completedAt: Timestamp
  ↓
Request customer confirmation
  → Email + WhatsApp with buttons:
      [Confirm Completion] [Report Issue]
  ↓
IF customer confirms OR 3 days pass:
  → Capture payment
  → Release escrow
  → Split payment 3-way
```

---

## Related Documentation

- [Job Creation Flow](./job-creation-flow.md)
- [Handyman Registration](./handyman-registration.md)
- [Stripe Payment](./stripe-payment.md)
- [Authentication](./authentication.md)

---

**Last Updated:** 2025-12-11
**Status:** ✅ Core dashboard implemented - Job actions pending
