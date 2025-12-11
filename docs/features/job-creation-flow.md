# Job Creation Flow Documentation

## Overview

Complete customer journey from requesting a service to job creation in the system. Customers can submit job requests without registration using anonymous authentication.

## Current Implementation Status

✅ **Implemented**
- Multi-step job request form
- Anonymous customer authentication
- Service type selection with configurable pricing
- Preferred timing selection
- Job description and photo upload
- Job document creation in Firestore
- Payment integration (create job before payment)
- Payment with escrow (manual capture)
- Handyman assigned after payment authorization

❌ **Not Implemented**
- Real-time job matching algorithm
- Automated handyman assignment
- Job location radius search
- Multiple photo uploads
- Video upload support

---

## Key Files & Functions

### Frontend Components

#### `/src/pages/CustomerJobRequest.jsx`
Main container page for job requests.

**Route:** `/request-job`

**Features:**
- Renders JobRequestForm
- No authentication required
- Mobile-responsive layout

#### `/src/components/customer/JobRequestForm.jsx`
Core multi-step job request form component.

**Key Functions:**
- `handleNext()` - Validates current step and moves to next form step
- `handleBack()` - Navigates to previous step without validation
- `handleProceedToPayment()` - Creates anonymous user, creates job in Firestore, navigates to payment
- `handlePaymentSuccess()` - Updates job status and payment info after successful payment

**Form Steps:**
1. Service Selection
2. Job Details
3. Review
4. Payment
5. Confirmation

#### `/src/components/customer/JobConfirmation.jsx`
Success screen after job creation.

**Features:**
- Job ID display
- Job summary
- What happens next information
- Tracking link

#### `/src/components/customer/ConfirmationScreen.jsx`
Alternate confirmation component.

**Features:**
- Payment confirmation
- Job details recap
- Next steps guidance

### Backend Services

#### `/src/services/api/jobs.js`
Job CRUD operations and Firestore integration.

**Key Functions:**
- `createJob(jobData)` - Creates job document in Firestore with all job details and images
- `updateJob(jobId, updates)` - Updates existing job document with new data
- `getJob(jobId)` - Fetches single job by ID from Firestore
- `getJobsByCustomer(customerId)` - Retrieves all jobs for a specific customer
- `getJobsByStatus(status)` - Queries jobs filtered by status (pending, assigned, etc.)
- `createPayment(paymentData)` - Creates payment record in Firestore after Stripe authorization

#### `/src/services/firebase/collections.js`
Low-level Firestore operations.

**Key Functions:**
- `addDocument(collection, data)` - Generic add to collection
- `updateDocument(collection, docId, data)` - Generic update
- `getDocument(collection, docId)` - Generic fetch

#### `/src/config/servicePricing.js`
Service catalog and pricing configuration.

**Key Data:**
- `SERVICE_PRICING` - Object mapping service types to prices (e.g., Plumbing: 120)
- `PLATFORM_FEE_PERCENTAGE` - Configurable platform fee percentage (default 10%)

**Key Functions:**
- `getServicePrice(serviceType)` - Returns base price for given service type
- `getPlatformFee(serviceFee)` - Calculates platform fee using configured percentage
- `getTotalAmount(serviceType)` - Calculates total amount (service fee + platform fee)

---

## Job Creation Flow

### Step 1: Customer Navigates to Job Request

```
User clicks "Request a Service"
  ↓
Navigate to: /request-job
  ↓
Render: /src/pages/CustomerJobRequest.jsx
  ↓
Component: /src/components/customer/JobRequestForm.jsx
  ↓
Initialize form state with empty job data
```

### Step 2: Service Selection (Step 1)

```
Display service categories
  ↓
Data from: /src/config/servicePricing.js
  → SERVICE_PRICING = {
      'Plumbing': 120,
      'Electrical': 150,
      'Carpentry': 180,
      'Appliance Repair': 100,
      'Painting': 200,
      'General handyman': 100
    }

  Note: Icons (🔧, ⚡, 🪚, etc.) are handled in UI components
  ↓
User selects service (e.g., "Plumbing")
  ↓
Calculate total with configurable platform fee:
  → serviceFee = getServicePrice("Plumbing") = 120
  → platformFee = getPlatformFee(120) = 120 × 0.10 = 12 (default)
  → estimatedBudget = serviceFee + platformFee = 132
  ↓
Update form state:
  {
    serviceType: "Plumbing",
    serviceFee: 120,
    platformFee: 12,
    estimatedBudget: 132
  }
  ↓
Click "Next"
  → handleNext() validates and moves to next step
```

### Step 2: Job Details (Step 2)

```
User fills in details:
  ↓
Customer Information:
  - Name: "Jane Doe"
  - Email: "jane@example.com"
  - Phone: "+6591234567"
  - Address: "123 Main Street, Singapore 123456"
  ↓
Job Details:
  - Description: "Leaking pipe under kitchen sink"
  - Preferred Timing: "ASAP" or "Schedule"
  - If Schedule:
      * Date: Date picker
      * Time: Time picker
  ↓
Photo Upload (Optional):
  - handlePhotoUpload() called
  - Upload to Firebase Storage
  - Store URL in form state
  ↓
Form state updated:
  {
    serviceType: "Plumbing",
    estimatedBudget: 132,
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: "+6591234567",
    customerAddress: "123 Main Street, Singapore 123456",
    description: "Leaking pipe under kitchen sink",
    preferredTiming: "ASAP",
    preferredDate: null,
    preferredTime: null,
    photoURL: "https://storage.googleapis.com/..."
  }
  ↓
Click "Next"
  → handleNext() called
```

### Step 3: Review (Step 3)

```
Display summary:
  ↓
Service: Plumbing
Price: $120.00
Platform Fee (10%): $12.00
Total: $132.00

Customer: Jane Doe
Email: jane@example.com
Phone: +6591234567
Address: 123 Main Street

Job Details:
- Leaking pipe under kitchen sink
- Timing: As soon as possible
[Photo preview if uploaded]
  ↓
User reviews and clicks "Continue to Payment"
  → handleProceedToPayment() called (Line ~240)
```

### Step 4: Create Job in Firestore (Before Payment)

```
handleProceedToPayment() executes:
  ↓
Step 1: Create or Get Anonymous User
  → Check if customerId exists in state
  → If not, create anonymous user:
      /src/services/firebase/auth.js:174
      createAnonymousUser({
        name: jobData.customerName,
        email: jobData.customerEmail,
        phone: jobData.customerPhone
      })
  → Returns: { uid: "anonymous_user_id" }
  → Store in state: setCustomerId(uid)
  ↓
Step 2: Prepare Job Data
  → const jobDataWithUser = {
      ...jobData,
      customerId: userId,
      status: "pending",
      paymentStatus: "pending",
      createdAt: new Date().toISOString()
    }
  ↓
Step 3: Create Job in Firestore
  → /src/services/api/jobs.js:30
  → createJob(jobDataWithUser)
  ↓
  Firebase Function creates document:
    Collection: jobs/{jobId}
    Data: {
      jobId: "auto_generated_id",
      customerId: "anonymous_user_id",
      serviceType: "Plumbing",
      estimatedBudget: 132,
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      customerPhone: "+6591234567",
      customerAddress: "123 Main Street, Singapore 123456",
      description: "Leaking pipe under kitchen sink",
      preferredTiming: "ASAP",
      preferredDate: null,
      preferredTime: null,
      photoURL: "https://...",

      // Status
      status: "pending",  // pending → assigned → in_progress → completed
      paymentStatus: "pending",  // pending → authorized → captured → released

      // Payment (null initially)
      paymentIntentId: null,
      paymentCreatedAt: null,

      // Assignment (null initially)
      assignedHandymanId: null,
      assignedAt: null,

      // Timestamps
      createdAt: Timestamp,
      updatedAt: Timestamp
    }
  ↓
Step 4: Store Job ID
  → const createdJob = await createJob(jobDataWithUser)
  → setCreatedJobId(createdJob.id)
  ↓
Step 5: Navigate to Payment
  → setCurrentStep(4)  // Show payment form
```

### Step 5: Payment (Step 4)

```
Payment form loads
  ↓
Component: /src/components/customer/PaymentForm.jsx
  ↓
Props passed:
  - amount: 132
  - jobId: createdJobId  // Real job ID from Firestore!
  - serviceType: "Plumbing"
  - customerId: userId
  - handymanId: null  // Not assigned yet
  - customerEmail: "jane@example.com"
  - onPaymentSuccess: handlePaymentSuccess
  ↓
useEffect hook runs:
  → Creates payment intent with real job ID
  → /src/services/stripe/stripeApi.js:29
  → createPaymentIntent({
      jobId: createdJobId,  // Real Firestore job ID
      customerId: userId,
      handymanId: null,
      serviceFee: 120,
      serviceType: "Plumbing",
      customerEmail: "jane@example.com"
    })
  ↓
Firebase Function (createPaymentIntent):
  → /functions/index.js
  → Creates Stripe PaymentIntent with:
      * amount: 13200 cents (132 SGD)
      * currency: "sgd"
      * capture_method: "manual"  // ESCROW!
      * metadata: {
          jobId: createdJobId,  // Real job ID
          serviceFee: 120,
          platformFee: 12,
          serviceType: "Plumbing"
        }
  → Returns: {
      paymentIntentId: "pi_xxxxx",
      clientSecret: "pi_xxxxx_secret_xxxxx",
      status: "requires_payment_method",
      amount: 132,
      currency: "sgd"
    }
  ↓
Store clientSecret in state
  → setClientSecret(result.clientSecret)
  ↓
Render Stripe card form
  → /src/components/customer/StripeCardForm.jsx
```

**See: [Stripe Payment Documentation](./stripe-payment.md) for detailed payment flow**

### Step 6: Payment Success Callback

```
After successful card authorization:
  ↓
handlePaymentSuccess() called (Line ~303)
  ↓
Receives paymentResultData:
  {
    paymentIntent: {
      id: "pi_xxxxx",
      status: "requires_capture",  // Authorized, held in escrow
      amount: 132,
      currency: "sgd",
      payment_method: "pm_xxxxx",
      client_secret: "pi_xxxxx_secret_xxxxx"
    }
  }
  ↓
Step 1: Update Job with Payment Info
  → /src/services/api/jobs.js:110
  → updateJob(createdJobId, {
      paymentIntentId: paymentResultData.paymentIntent.id,
      paymentStatus: "pending",  // Will be "captured" after handyman completes
      paymentCreatedAt: new Date().toISOString()
    })
  ↓
Step 2: Create Payment Record
  → /src/services/api/jobs.js:200
  → createPayment({
      jobId: createdJobId,
      customerId: customerId,
      amount: 132,
      currency: "sgd",
      status: paymentResultData.paymentIntent.status,  // "requires_capture"
      paymentIntentId: paymentResultData.paymentIntent.id,
      paymentMethod: paymentResultData.paymentIntent.payment_method,
      clientSecret: paymentResultData.paymentIntent.client_secret,
      stripeResponse: paymentResultData
    })
  ↓
Firestore creates document:
  Collection: payments/{paymentId}
  Data: {
    paymentId: "auto_generated_id",
    jobId: createdJobId,
    customerId: userId,
    amount: 132,
    currency: "sgd",
    status: "requires_capture",
    paymentIntentId: "pi_xxxxx",
    paymentMethod: "pm_xxxxx",
    clientSecret: "pi_xxxxx_secret_xxxxx",
    stripeResponse: { /* full payment intent object */ },
    createdAt: Timestamp
  }
  ↓
Step 3: Navigate to Confirmation
  → setCurrentStep(5)
```

### Step 7: Confirmation Screen

```
Display confirmation:
  ↓
Component: /src/components/customer/JobConfirmation.jsx
  ↓
Shows:
  - ✅ Job submitted successfully
  - Job ID: {createdJobId}
  - Service: Plumbing
  - Total paid: $132.00 (held in escrow)
  - We're matching you with available handymen
  - You'll receive updates via email/WhatsApp
  - Job tracking link
```

---

## Firestore Data Structure

### Jobs Collection (`jobs/{jobId}`)

```javascript
{
  // Auto-generated ID
  jobId: "job_abc123",

  // Customer Info
  customerId: "anonymous_user_id",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "+6591234567",
  customerAddress: "123 Main Street, Singapore 123456",

  // Service Details
  serviceType: "Plumbing",
  description: "Leaking pipe under kitchen sink",
  estimatedBudget: 132,  // Including 10% platform fee
  photoURL: "https://storage.googleapis.com/...",

  // Scheduling
  preferredTiming: "ASAP" | "Schedule",
  preferredDate: "2025-12-15",  // null if ASAP
  preferredTime: "14:00",       // null if ASAP

  // Status Tracking
  status: "pending",  // pending → assigned → in_progress → completed → cancelled
  paymentStatus: "pending",  // pending → authorized → captured → released → refunded

  // Payment Info
  paymentIntentId: "pi_xxxxx",
  paymentCreatedAt: "2025-12-11T10:30:00.000Z",
  paymentCapturedAt: null,  // Set when captured
  paymentReleasedAt: null,  // Set when released to handyman

  // Assignment
  assignedHandymanId: null,  // Set when handyman accepts
  assignedAt: null,
  acceptedAt: null,
  startedAt: null,
  completedAt: null,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Payments Collection (`payments/{paymentId}`)

```javascript
{
  paymentId: "payment_xyz789",
  jobId: "job_abc123",
  customerId: "anonymous_user_id",

  // Stripe Info
  paymentIntentId: "pi_xxxxx",
  clientSecret: "pi_xxxxx_secret_xxxxx",
  paymentMethod: "pm_xxxxx",

  // Amount
  amount: 132,
  currency: "sgd",

  // Status (from Stripe)
  status: "requires_capture",  // requires_payment_method → requires_capture → succeeded

  // Full Stripe Response (for debugging)
  stripeResponse: {
    id: "pi_xxxxx",
    object: "payment_intent",
    amount: 13200,
    // ... full PaymentIntent object
  },

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Service Pricing Configuration

**File:** `/src/config/servicePricing.js`

```javascript
// Service catalog with base prices (SGD)
export const SERVICE_PRICING = {
  'Plumbing': 120,
  'Electrical': 150,
  'Carpentry': 180,
  'Appliance Repair': 100,
  'Painting': 200,
  'General handyman': 100
};

// Platform fee percentage configuration
// Configurable via REACT_APP_PLATFORM_FEE_PERCENTAGE environment variable
// Examples: 0.10 = 10%, 0.05 = 5%, 0.15 = 15%
export const PLATFORM_FEE_PERCENTAGE = parseFloat(
  process.env.REACT_APP_PLATFORM_FEE_PERCENTAGE
) || 0.10;

// Get the price for a specific service type
export const getServicePrice = (serviceType) => {
  return SERVICE_PRICING[serviceType] || 120;
};

// Calculate the platform fee as percentage of service price
export const getPlatformFee = (serviceTypeOrPrice) => {
  const servicePrice = typeof serviceTypeOrPrice === 'string'
    ? getServicePrice(serviceTypeOrPrice)
    : serviceTypeOrPrice;

  return servicePrice * PLATFORM_FEE_PERCENTAGE;
};

// Get the total amount including platform fee
export const getTotalAmount = (serviceTypeOrPrice) => {
  const servicePrice = typeof serviceTypeOrPrice === 'string'
    ? getServicePrice(serviceTypeOrPrice)
    : serviceTypeOrPrice;
  const platformFee = getPlatformFee(servicePrice);
  return servicePrice + platformFee;
};

// Get all service types with their prices
export const getServiceTypes = () => {
  return Object.entries(SERVICE_PRICING).map(([type, price]) => ({
    type,
    price
  }));
};
```

**Configuration:**
```env
# In .env.local
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.10  # 10% (default)
```

**Usage Example:**
```javascript
import { getServicePrice, getPlatformFee, getTotalAmount } from './config/servicePricing';

const serviceType = "Plumbing";
const serviceFee = getServicePrice(serviceType);  // 120
const platformFee = getPlatformFee(serviceFee);   // 12 (10% of 120)
const total = getTotalAmount(serviceType);        // 132
```

**See:** [Platform Fee Configuration Guide](../../PLATFORM_FEE_CONFIGURATION.md) for detailed instructions on changing the percentage.

---

## Job Status Lifecycle

```
awaiting_payment (job created, no payment yet)
  ↓
  [Customer completes payment]
  ↓
pending (payment authorized, waiting for handyman)
  ↓
  [Handyman accepts job - handymanId assigned]
  ↓
assigned
  ↓
  [Handyman starts work]
  ↓
in_progress
  ↓
  [Handyman marks complete]
  ↓
completed
  ↓
  [Customer confirms OR 3 days pass]
  ↓
payment_released
```

**Important Notes:**
- `awaiting_payment` jobs are automatically deleted after 30 minutes if payment not completed
- `handymanId` is `null` until status changes from `pending` to `assigned`
- See [Scheduled Jobs Documentation](./scheduled-jobs.md) for cleanup details

### Status Definitions

| Status | Description | Next Step | Who Can Update |
|--------|-------------|-----------|----------------|
| `pending` | Job created, awaiting handyman | Handyman accepts | System |
| `assigned` | Handyman accepted, not started | Handyman starts work | Handyman |
| `in_progress` | Work in progress | Handyman completes | Handyman |
| `completed` | Handyman finished | Customer confirms | Handyman |
| `confirmed` | Customer confirmed completion | Payment release | Customer |
| `payment_released` | Payment split to all parties | - | System |
| `cancelled` | Job cancelled | - | Customer/Admin |
| `disputed` | Issue reported | Admin review | Customer/Handyman |

---

## Photo Upload

**Current Implementation:**
- Single photo upload
- Stored in Firebase Storage
- Path: `job-photos/{jobId}/{timestamp}.jpg`

**Code Location:**
`/src/components/customer/JobRequestForm.jsx:350`

```javascript
const handlePhotoUpload = async (file) => {
  try {
    // Create storage reference
    const storageRef = ref(
      storage,
      `job-photos/${Date.now()}_${file.name}`
    );

    // Upload file
    await uploadBytes(storageRef, file);

    // Get download URL
    const photoURL = await getDownloadURL(storageRef);

    // Update form state
    setJobData(prev => ({
      ...prev,
      photoURL: photoURL
    }));

    console.log('Photo uploaded:', photoURL);
  } catch (error) {
    console.error('Photo upload failed:', error);
    setPhotoError('Failed to upload photo. Please try again.');
  }
};
```

---

## Form Validation

**Validation Rules:**

**Step 1: Service Selection**
- Service type must be selected

**Step 2: Job Details**
- Customer name: Required, min 2 characters
- Customer email: Required, valid email format
- Customer phone: Required, Singapore format (+65 or 8 digits)
- Customer address: Required, min 10 characters
- Description: Required, min 10 characters
- Preferred timing: Required ("ASAP" or "Schedule")
- If "Schedule": Date and time required

**Step 3: Review**
- All previous validations must pass
- User must review summary

**Step 4: Payment**
- Valid payment method required
- Card details validated by Stripe

---

## Error Handling

**Common Errors:**

1. **Anonymous User Creation Failed**
   - Retry with exponential backoff
   - Show error message
   - Allow manual retry

2. **Job Creation Failed**
   - Log error to console
   - Show user-friendly message
   - Don't proceed to payment
   - Allow retry

3. **Payment Intent Creation Failed**
   - Show Stripe error message
   - Allow retry
   - Don't update job document

4. **Photo Upload Failed**
   - Show upload error
   - Allow retry
   - Don't block form submission

---

## Testing Checklist

### Happy Path
- [ ] Select service type successfully
- [ ] Fill in all required fields
- [ ] Upload photo (optional)
- [ ] Review shows correct information
- [ ] Anonymous user created
- [ ] Job document created in Firestore
- [ ] Payment intent created with real job ID
- [ ] Card authorization successful
- [ ] Job updated with payment info
- [ ] Payment record created
- [ ] Confirmation screen displayed

### Error Cases
- [ ] Form validation prevents next step
- [ ] Photo upload error handled gracefully
- [ ] Anonymous user creation failure handled
- [ ] Job creation failure prevents payment
- [ ] Payment failure doesn't corrupt job
- [ ] Duplicate submission prevented

### Data Verification
- [ ] Job ID matches between Firestore and Stripe
- [ ] Customer data accurate in job document
- [ ] Payment status correctly tracked
- [ ] Timestamps populated correctly

---

## Future Enhancements

1. **Multiple Photo Uploads**
   - Support 3-5 photos per job
   - Photo gallery view

2. **Video Upload**
   - Allow customers to upload problem videos
   - Max 30-second clips

3. **Location-Based Matching**
   - Radius search for nearby handymen
   - Distance calculation

4. **Instant Quoting**
   - Handymen can view and quote on jobs
   - Customer selects best quote

5. **Saved Addresses**
   - For registered customers
   - Quick address selection

6. **Recurring Jobs**
   - Schedule weekly/monthly services
   - Subscription model

---

## Related Documentation

- [Stripe Payment Integration](./stripe-payment.md)
- [Authentication](./authentication.md)
- [Job Dashboard](./job-dashboard.md)
- [WhatsApp Notifications](./whatsapp-notifications.md)

---

**Last Updated:** 2025-12-11
**Status:** ✅ Fully Implemented and Production-Ready
