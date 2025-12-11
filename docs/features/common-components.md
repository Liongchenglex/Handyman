# Common Components & Shared Modules

## Overview

Reusable UI components and shared utilities used across the application.

---

## Layout Components

### Header
**File:** `/src/components/common/Header.jsx`

**Features:**
- Site logo and branding
- Navigation links (Home, Request Service, Handyman Login)
- Responsive mobile menu
- Sticky header on scroll

**Props:** None (static)

### Footer
**File:** `/src/components/common/Footer.jsx`

**Features:**
- Company information
- Quick links (About, Contact, Terms, Privacy)
- Social media links
- Copyright notice

**Props:** None (static)

### Handyman Header
**File:** `/src/components/handyman/HandymanHeader.jsx`

**Features:**
- Handyman-specific navigation
- Dashboard tabs (Jobs, My Jobs, Profile)
- Logout button
- User greeting with name

**Props:**
- `currentUser` - Authenticated user object

---

## UI Components

### Loading Spinner
**File:** `/src/components/common/LoadingSpinner.jsx`

**Features:**
- Animated loading spinner
- Customizable size and color
- Full-screen overlay option

**Props:**
- `size` - "small" | "medium" | "large" (default: "medium")
- `overlay` - boolean (default: false)

**Usage:**
```javascript
import LoadingSpinner from './components/common/LoadingSpinner';

<LoadingSpinner size="large" overlay={true} />
```

### Modal
**File:** `/src/components/common/Modal.jsx`

**Features:**
- Reusable modal dialog
- Backdrop click to close
- ESC key to close
- Custom header, body, footer

**Props:**
- `isOpen` - boolean
- `onClose` - function
- `title` - string
- `children` - React node

**Usage:**
```javascript
import Modal from './components/common/Modal';

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Confirm Action"
>
  <p>Are you sure?</p>
  <button onClick={handleConfirm}>Confirm</button>
</Modal>
```

### Progress Stepper
**File:** `/src/components/common/ProgressStepper.jsx`

**Features:**
- Multi-step form progress indicator
- Active/completed/inactive states
- Step labels
- Responsive design

**Props:**
- `steps` - array of step objects
- `currentStep` - number (0-indexed)

**Usage:**
```javascript
import ProgressStepper from './components/common/ProgressStepper';

const steps = [
  { label: 'Service Selection' },
  { label: 'Details' },
  { label: 'Review' },
  { label: 'Payment' }
];

<ProgressStepper steps={steps} currentStep={2} />
```

### Fixed Stepper Container
**File:** `/src/components/common/FixedStepperContainer.jsx`

**Features:**
- Container with fixed stepper at top
- Scrollable content area
- Responsive layout

**Props:**
- `steps` - array of steps
- `currentStep` - number
- `children` - React node

### Help Contact
**File:** `/src/components/common/HelpContact.jsx`

**Features:**
- Contact form
- Email/phone display
- Operating hours
- FAQ section

**Route:** `/help` or `/contact`

---

## Hooks

### useAuth
**File:** `/src/hooks/useAuth.js`

**Returns:**
```javascript
{
  currentUser: FirebaseUser | null,
  userProfile: UserProfile | null,
  loading: boolean
}
```

**Usage:**
```javascript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!currentUser) return <LoginPrompt />;

  return <div>Welcome, {userProfile.name}!</div>;
}
```

### useJobs
**File:** `/src/hooks/useJobs.js`

**Features:**
- Fetch jobs from Firestore
- Real-time updates
- Filter by status
- Filter by handyman

**Returns:**
```javascript
{
  jobs: Job[],
  loading: boolean,
  error: Error | null,
  refreshJobs: () => void
}
```

**Usage:**
```javascript
import { useJobs } from './hooks/useJobs';

function JobList() {
  const { jobs, loading, error } = useJobs({
    status: 'pending',
    serviceType: 'Plumbing'
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {jobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  );
}
```

### usePayments
**File:** `/src/hooks/usePayments.js`

**Features:**
- Fetch payment records
- Filter by customer/handyman
- Real-time updates

**Returns:**
```javascript
{
  payments: Payment[],
  loading: boolean,
  error: Error | null
}
```

---

## Context Providers

### AuthContext
**File:** `/src/context/AuthContext.js`

**Provides:**
- Global authentication state
- Current user
- User profile
- Loading state

**Usage:**
```javascript
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';

// In App.jsx
<AuthProvider>
  <App />
</AuthProvider>

// In any component
function MyComponent() {
  const { currentUser } = useAuth();
  // ...
}
```

### JobContext (Commented Out)
**File:** `/src/context/JobContext.js`

**Status:** Not currently used

---

## Utilities

### Job Helpers
**File:** `/src/utils/jobHelpers.js`

**Functions:**
- `formatJobDate(date)` - Format job dates
- `getJobStatusBadge(status)` - Get colored status badge
- `calculateJobDuration(startTime, endTime)` - Calculate time
- `getServiceIcon(serviceType)` - Get service type icon

---

## Service Pricing

**File:** `/src/config/servicePricing.js`

**See:** [Job Creation Flow Documentation](./job-creation-flow.md#service-pricing-configuration)

**Exports:**
- `SERVICE_CATEGORIES` - Service types with pricing
- `PLATFORM_FEE_PERCENTAGE` - 10% platform fee
- `getServicePrice(type)` - Get service base price
- `getPlatformFee(serviceFee)` - Calculate platform fee
- `getTotalAmount(serviceFee)` - Total with fee

---

## Email Configuration

**File:** `/src/config/emailConfig.js`

**Exports:**
- `EMAIL_CONFIG` - EmailJS configuration
- `APPROVAL_BASE_URL` - Handyman approval URL

**Environment Variables:**
```env
REACT_APP_EMAILJS_SERVICE_ID=service_xxxxx
REACT_APP_EMAILJS_PUBLIC_KEY=xxxxx
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=template_xxxxx
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=template_xxxxx
REACT_APP_OPERATIONS_EMAIL=operations@eazydone.com
REACT_APP_APPROVAL_BASE_URL=http://localhost:3000/admin/approve-handyman
```

---

## Firebase Services

### Config
**File:** `/src/services/firebase/config.js`

**Exports:**
- `app` - Initialized Firebase app
- `auth` - Firebase Auth instance
- `db` - Firestore database instance
- `storage` - Firebase Storage instance

### Collections
**File:** `/src/services/firebase/collections.js`

**Generic Firestore CRUD operations:**
- `addDocument(collection, data)` - Add to collection
- `getDocument(collection, docId)` - Fetch document
- `updateDocument(collection, docId, data)` - Update document
- `deleteDocument(collection, docId)` - Delete document
- `queryCollection(collection, queries)` - Query collection

**Specific operations:**
- `createUser(uid, data)` - Create user profile
- `getUser(uid)` - Get user profile
- `createHandyman(uid, data)` - Create handyman profile
- `getHandyman(uid)` - Get handyman profile
- `updateHandyman(uid, data)` - Update handyman profile

### Firestore Service
**File:** `/src/services/firebase/firestore.js`

**Lower-level Firestore operations**

### Storage
**File:** `/src/services/firebase/storage.js`

**Functions:**
- `uploadHandymanDocument(uid, file, type)` - Upload document
- `getHandymanDocumentURL(uid, type)` - Get download URL
- `deleteHandymanDocument(uid, type)` - Delete document

**Storage paths:**
```
handyman-documents/{uid}/{documentType}.pdf
job-photos/{jobId}/{timestamp}.jpg
```

---

## Styling

**Global Styles:**
- `/src/index.css` - Base styles
- Component-specific styles in JSX files (CSS modules or inline styles)

**Design System:**
- Primary color: Blue (#1976d2)
- Secondary color: Orange (#ff9800)
- Success: Green (#4caf50)
- Error: Red (#f44336)
- Warning: Yellow (#ffc107)

---

## Related Documentation

- [Authentication](./authentication.md)
- [Job Creation Flow](./job-creation-flow.md)
- [Handyman Registration](./handyman-registration.md)

---

**Last Updated:** 2025-12-11
**Status:** ✅ Fully Implemented
