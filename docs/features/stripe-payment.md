# Stripe Payment Integration

## Overview

Complete Stripe payment system with escrow, manual capture, 3-way payment splits, and Stripe Connect for handyman payouts.

## Current Implementation Status

✅ **Implemented**
- Payment intent creation with escrow (manual capture)
- Stripe Elements card collection
- 3D Secure (SCA) authentication
- Payment authorization (funds held)
- 10% platform fee calculation
- Real job ID tracking in Stripe metadata
- Payment record in Firestore

❌ **Not Implemented**
- Payment capture after job completion
- 3-way payment split (handyman 100% service, 50/50 platform fee split)
- Auto-release after 3 days
- Refund system
- Stripe webhooks handling

---

## Key Files & Functions

### Frontend

**`/src/services/stripe/stripeApi.js`** - Stripe API calls
- `createPaymentIntent(paymentData)` - Create payment with escrow (manual capture)
- `getPaymentStatus(paymentIntentId)` - Check payment status
- `confirmPayment(paymentIntentId)` - Capture payment after job completion
- `releaseEscrowAndSplit(releaseData)` - Split payment 3-way (handyman, cofounder, operator)
- `refundPayment(paymentIntentId, reason)` - Refund payment to customer
- `createConnectedAccount(handymanData)` - Create Stripe Connect account for handyman
- `createAccountLink(linkData)` - Generate Stripe onboarding URL
- `getAccountStatus(accountId)` - Check Stripe onboarding completion status
  - Returns: `{success: true, status: {detailsSubmitted, chargesEnabled, payoutsEnabled, ...}}`

**`/src/components/customer/PaymentForm.jsx`** - Payment UI container
- Creates payment intent when component mounts
- Loads Stripe.js library dynamically
- Wraps StripeCardForm in Stripe Elements provider
- Handles payment success/failure callbacks

**`/src/components/customer/StripeCardForm.jsx`** - Card collection UI
- Renders Stripe Elements CardElement for secure card input
- Handles card confirmation with 3D Secure authentication
- Displays loading states and error messages
- Processes payment authorization

**`/src/config/servicePricing.js`** - Pricing logic
- `PLATFORM_FEE_PERCENTAGE` = 0.10 (10%)
- `getPlatformFee(serviceFee)` - Calculate 10% fee
- `getTotalAmount(serviceFee)` - Total with platform fee

### Backend (Firebase Functions)

**`/functions/index.js`** - Cloud Functions

**Payment Functions:**
- `createPaymentIntent` - Create payment with manual capture
  - `handymanId` is **optional** (null for new jobs, assigned after payment)
- `confirmPayment` - Capture authorized payment
- `releaseEscrowAndSplit` - 3-way split to accounts
- `refundPayment` - Refund to customer
- `getPaymentStatus` - Fetch payment details

**Connect Functions:**
- `createConnectedAccount` - Create Stripe Express account for handyman payouts
- `createAccountLink` - Generate onboarding URL for handyman verification
- `getAccountStatus` - Check account onboarding completion status
- `createLoginLink` - Generate Stripe Dashboard access link for handyman

---

## Payment Flow

### Phase 1: Create Payment Intent (Escrow)

```
Job created in Firestore (status: "awaiting_payment")
  ↓
PaymentForm mounts with jobId
  → /src/components/customer/PaymentForm.jsx
  ↓
useEffect creates payment intent
  → /src/services/stripe/stripeApi.js
  → createPaymentIntent({
      jobId: "real_firestore_job_id",
      customerId: "firebase_user_id",
      handymanId: null,  // ✅ Optional - Not assigned yet
      serviceFee: 120,
      serviceType: "Plumbing",
      customerEmail: "customer@example.com"
    })
  ↓
Firebase Function: /functions/index.js (createPaymentIntent)
  → Extract and validate fields:
      jobId (required)
      customerId (required)
      handymanId (optional - null for new jobs)
      serviceFee (required)
      serviceType (required)
  → Calculate amounts using configurable percentage:
      serviceFee = 120
      platformFeePercentage = 0.10 (from config)
      platformFee = 120 * 0.10 = 12
      totalAmount = 132
  → Create Stripe PaymentIntent:
      amount: 13200 cents (132 SGD)
      currency: "sgd"
      capture_method: "manual"  // ESCROW!
      metadata: {
        jobId: "real_firestore_job_id",
        serviceFee: 120,
        platformFee: 12,
        serviceType: "Plumbing",
        customerId: "firebase_user_id",
        handymanId: null  // Will be assigned later
      }
  → Update job document:
      paymentIntentId: "pi_xxxxx"
      paymentStatus: "pending"
  ↓
Returns: {
  paymentIntentId: "pi_xxxxx",
  clientSecret: "pi_xxxxx_secret_xxxxx",
  status: "requires_payment_method",
  amount: 132,
  currency: "sgd"
}
```

### Phase 2: Collect Card & Authorize

```
Frontend receives clientSecret
  ↓
Render StripeCardForm
  → /src/components/customer/StripeCardForm.jsx
  ↓
User enters card: 4242 4242 4242 4242
  ↓
User clicks "Authorize Payment"
  ↓
Call stripe.confirmCardPayment()
  → clientSecret
  → payment_method: { card: CardElement }
  ↓
Stripe processes:
  - Validates card
  - 3D Secure if required
  - Authorizes payment (HOLDS funds)
  ↓
Returns PaymentIntent:
  status: "requires_capture"
  amount_capturable: 13200
  ↓
Update Firestore:
  → jobs/{jobId}:
      paymentStatus: "authorized"
  → payments/{paymentId}:
      status: "requires_capture"
```

**Stripe Dashboard shows: "Uncaptured" ✅**

---

## Payment Status Lifecycle

| User Journey Phase | Stripe Status | Firestore `paymentStatus` | Job Status | Funds Status | What Happens |
|-------------------|---------------|--------------------------|------------|--------------|--------------|
| Customer fills job form | - | - | `awaiting_payment` | ❌ No payment yet | Customer provides job details, no payment created |
| Redirect to payment page | `requires_payment_method` | `pending` | `awaiting_payment` | ❌ Not held | Payment intent created, waiting for card |
| Customer enters card | `requires_confirmation` | `pending` | `awaiting_payment` | ❌ Not held | Card details entered, not submitted yet |
| 3D Secure challenge | `requires_action` | `pending` | `awaiting_payment` | ❌ Not held | Customer completing 3D Secure verification |
| Job submitted successfully | `requires_capture` | `authorized` | `pending` | ✅ Held in escrow | Funds authorized and held, job visible to handymen |
| Handyman accepts job | `requires_capture` | `authorized` | `assigned` | ✅ Held in escrow | Handyman assigned, funds still in escrow |
| Handyman completes job | `requires_capture` | `authorized` | `completed` | ✅ Held in escrow | Waiting for customer confirmation |
| Customer confirms / 3 days pass | `succeeded` | `captured` then `released` | `payment_released` | ✅ Split to accounts | Payment captured and split 3-way |
| Issue/cancellation | `refunded` | `refunded` | `cancelled` | ❌ Returned to customer | Full refund issued |

**Key Points:**
- **Escrow Protection:** Funds are held from job submission until completion confirmation
- **Handyman Assignment:** Can happen while payment is still in escrow (authorized)
- **Auto-Release:** Payment automatically captured and released after 3 days if customer doesn't respond
- **Refunds:** Only possible before payment is captured and released (see Refund Logic below)

---

## Refund Logic & Edge Cases

### Automatic Refund Scenarios

#### 1. **Job Not Accepted Before Scheduled Date**

**Trigger:** Current date > scheduled date AND job status still `pending`

**Logic:**
```javascript
// Scheduled job check (runs daily)
if (job.preferredTiming === 'Schedule') {
  const scheduledDate = new Date(job.preferredDate);
  const currentDate = new Date();

  if (currentDate > scheduledDate && job.status === 'pending') {
    // No handyman accepted the job before scheduled date
    // Automatic refund
    await refundPayment(job.paymentIntentId, 'no_handyman_available');
    await updateJob(job.id, {
      status: 'cancelled',
      cancellationReason: 'No handyman available by scheduled date',
      cancelledAt: Timestamp.now()
    });
    // Send notification to customer
  }
}
```

**Customer Experience:**
1. Job scheduled for "2025-12-15 at 2:00 PM"
2. No handyman accepts by end of day 2025-12-15
3. System automatically issues refund at midnight
4. Customer receives email: "We're sorry, no handyman was available for your scheduled job. Full refund issued."

**Status:** ❌ Not Implemented Yet

---

#### 2. **ASAP Job Not Accepted Within 24 Hours**

**Trigger:** Job created with "Immediate" timing AND no acceptance within 24 hours

**Logic:**
```javascript
// For ASAP jobs (runs hourly)
if (job.preferredTiming === 'Immediate') {
  const jobCreated = job.createdAt.toDate();
  const currentDate = new Date();
  const hoursSinceCreation = (currentDate - jobCreated) / (1000 * 60 * 60);

  if (hoursSinceCreation > 24 && job.status === 'pending') {
    // No handyman accepted within 24 hours
    await refundPayment(job.paymentIntentId, 'no_handyman_available');
    await updateJob(job.id, {
      status: 'cancelled',
      cancellationReason: 'No handyman available within 24 hours',
      cancelledAt: Timestamp.now()
    });
  }
}
```

**Customer Experience:**
- Job created for "ASAP" service
- 24 hours pass with no acceptance
- Automatic refund issued
- Email notification sent

**Status:** ❌ Not Implemented Yet

---

### Manual Refund Scenarios

#### 3. **Job Not Satisfactory (Dispute)**

**Trigger:** Customer reports job unsatisfactory / raises dispute

**Logic:**
```javascript
// Customer clicks "Report Issue" or "Not Satisfied"
// Requires manual review by operations team

// Step 1: Customer submits dispute
await createDispute({
  jobId: job.id,
  customerId: customer.uid,
  reason: disputeReason,
  description: customerDescription,
  photos: disputePhotos,
  status: 'under_review'
});

// Step 2: Update job status
await updateJob(job.id, {
  status: 'disputed',
  disputedAt: Timestamp.now()
});

// Step 3: Notify operations team for review
await sendDisputeNotification({
  jobId: job.id,
  to: OPERATIONS_EMAIL,
  customerReason: disputeReason
});

// Step 4: Operations team reviews and decides
// If refund approved:
await refundPayment(job.paymentIntentId, 'dispute_approved');
await updateJob(job.id, {
  status: 'refunded',
  refundReason: 'Dispute approved by operations',
  refundApprovedBy: adminUid
});

// If dispute rejected:
// Payment capture proceeds as normal
```

**Customer Experience:**
1. Handyman marks job complete
2. Customer clicks "Report Issue" instead of "Confirm Completion"
3. Fills dispute form with reason and photos
4. Operations team reviews within 48 hours
5. Decision communicated to both parties
6. Refund issued if approved OR payment released if rejected

**Status:** ❌ Not Implemented Yet

---

#### 4. **Handyman Cancellation After Acceptance**

**Trigger:** Handyman cancels after accepting (before starting work)

**Logic:**
```javascript
// Handyman clicks "Cancel Job"
if (job.status === 'assigned' && job.startedAt === null) {
  // Job was accepted but work hasn't started

  // Option A: Automatic refund (customer friendly)
  await refundPayment(job.paymentIntentId, 'handyman_cancelled');
  await updateJob(job.id, {
    status: 'cancelled',
    cancellationReason: 'Handyman cancelled before starting',
    cancelledBy: handyman.uid
  });

  // Option B: Try to reassign to another handyman first
  await updateJob(job.id, {
    status: 'pending', // Back to pending
    assignedHandymanId: null,
    handymanCancellationCount: (job.handymanCancellationCount || 0) + 1
  });

  // If reassignment fails after 24 hours, then refund
}
```

**Customer Experience:**
- Handyman accepts job
- Later cancels before starting
- System tries to reassign to another handyman
- If no one available within 24 hours → automatic refund
- Customer notified of reassignment attempt

**Status:** ❌ Not Implemented Yet

---

#### 5. **Customer Cancellation Before Handyman Starts**

**Trigger:** Customer cancels after payment but before handyman starts work

**Logic:**
```javascript
// Customer clicks "Cancel Job"
if (job.status === 'pending' || (job.status === 'assigned' && job.startedAt === null)) {
  // No work has been done yet

  // Calculate cancellation fee (optional)
  const cancellationFee = 0; // Or small percentage like 5%
  const refundAmount = job.totalAmount - cancellationFee;

  await refundPayment(job.paymentIntentId, 'customer_cancelled', refundAmount);
  await updateJob(job.id, {
    status: 'cancelled',
    cancellationReason: 'Cancelled by customer',
    cancelledBy: customer.uid,
    cancellationFee: cancellationFee
  });
}
```

**Customer Experience:**
- Can cancel anytime before work starts
- Full refund (or minus small cancellation fee)
- Email confirmation sent

**Status:** ❌ Not Implemented Yet

---

### Partial Refund Scenarios

#### 6. **Job Partially Completed**

**Trigger:** Handyman started work but didn't complete, both parties agree on partial completion

**Logic:**
```javascript
// Requires negotiation between customer and handyman
// Operations team mediates

// Step 1: Calculate partial payment
const workCompletedPercentage = 0.60; // 60% complete
const handymanPayment = job.serviceFee * workCompletedPercentage;
const refundAmount = job.totalAmount - handymanPayment - job.platformFee;

// Step 2: Process partial refund
await refundPayment(job.paymentIntentId, 'partial_completion', refundAmount);

// Step 3: Pay handyman for partial work
await captureAndSplitPartial(job.paymentIntentId, handymanPayment);

// Step 4: Update job
await updateJob(job.id, {
  status: 'partially_completed',
  completionPercentage: workCompletedPercentage,
  partialRefundAmount: refundAmount
});
```

**Customer Experience:**
- Work partially done (e.g., plumber fixed 2 out of 3 leaks)
- Both parties agree on completion percentage
- Operations team verifies and processes
- Partial refund issued to customer
- Partial payment released to handyman

**Status:** ❌ Not Implemented Yet

---

### Refund Rules Summary

| Scenario | Trigger | Refund Type | Amount | Auto/Manual | Status |
|----------|---------|-------------|--------|-------------|--------|
| Scheduled job not accepted | Date passed, still `pending` | Automatic | 100% | Automatic | ❌ Not implemented |
| ASAP job timeout | 24 hours, still `pending` | Automatic | 100% | Automatic | ❌ Not implemented |
| Job not satisfactory | Customer dispute | Manual review | 0-100% | Manual | ❌ Not implemented |
| Handyman cancels | After accept, before start | Automatic | 100% | Automatic | ❌ Not implemented |
| Customer cancels | Before work starts | Automatic | 100% (or minus fee) | Automatic | ❌ Not implemented |
| Partial completion | Work started but incomplete | Manual review | Variable | Manual | ❌ Not implemented |
| Payment error | System/Stripe error | Automatic | 100% | Automatic | ❌ Not implemented |

---

### Implementation Priority

**Phase 1 (Critical - Customer Protection):**
1. ✅ Scheduled job not accepted by date → Auto refund
2. ✅ ASAP job timeout (24 hours) → Auto refund
3. ✅ Customer cancellation (before start) → Auto refund

**Phase 2 (Important - Operations):**
4. ⚠️ Dispute handling system with manual review
5. ⚠️ Handyman cancellation handling

**Phase 3 (Advanced):**
6. 🔄 Partial completion / partial refund logic
7. 🔄 Cancellation fees configuration

---

### Technical Implementation Notes

**Scheduled Function Required:**
```javascript
// functions/index.js

/**
 * Check for jobs that need automatic refunds
 * Runs every hour
 */
exports.processAutoRefunds = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('Asia/Singapore')
  .onRun(async () => {
    // Check scheduled jobs past date
    // Check ASAP jobs > 24 hours old
    // Issue refunds automatically
  });
```

**Firestore Schema Addition:**
```javascript
// jobs collection - add fields
{
  refundStatus: null | 'pending' | 'approved' | 'rejected' | 'processed',
  refundReason: string,
  refundAmount: number,
  refundProcessedAt: Timestamp,

  disputeStatus: null | 'under_review' | 'resolved',
  disputeReason: string,
  disputeDescription: string,
  disputePhotos: array,
  disputeCreatedAt: Timestamp,
  disputeResolvedAt: Timestamp
}
```

---

## 3-Way Payment Split (Not Implemented Yet)

### Split Logic

**Platform fee is configurable as a percentage via environment variables:**
- Frontend: `REACT_APP_PLATFORM_FEE_PERCENTAGE` (decimal: 0.10 = 10%)
- Backend: `firebase functions:config:set platform.fee_percentage="0.10"`
- See [Platform Fee Configuration Guide](../../PLATFORM_FEE_CONFIGURATION.md) for details

**Example with 10% platform fee (default):**
```
Service Fee: $120
Platform Fee: $12 (10% of $120)
Total: $132

After job completion:
  - Handyman: $120 (100% of service fee)
  - Cofounder: $6 (50% of platform fee)
  - Operator: $6 (50% of platform fee)
```

**Example with 5% platform fee:**
```
Service Fee: $120
Platform Fee: $6 (5% of $120)
Total: $126

After job completion:
  - Handyman: $120 (100% of service fee)
  - Cofounder: $3 (50% of platform fee)
  - Operator: $3 (50% of platform fee)
```

**To change the percentage:**
```bash
# Frontend (.env.local)
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.08  # 8%

# Backend
firebase functions:config:set platform.fee_percentage="0.08"
```

### Implementation (Future)

**Trigger:** Job status → "completed" AND customer confirms

```javascript
// Call when releasing escrow
await releaseEscrowAndSplit({
  paymentIntentId: "pi_xxxxx",
  jobId: "job_abc123",
  serviceFee: 120,
  handymanAccountId: "acct_handyman_xxxxx",
  cofounderAccountId: "acct_cofounder_xxxxx",
  operatorAccountId: "acct_operator_xxxxx"
});
```

**Firebase Function Process:**
```
1. Capture payment (charge customer's card)
   → stripe.paymentIntents.capture(paymentIntentId)
   → Money now in platform account

2. Transfer to handyman (100% service fee)
   → stripe.transfers.create({
       amount: 12000 cents ($120),
       currency: "sgd",
       destination: handymanAccountId,
       transfer_group: jobId
     })

3. Transfer to cofounder (50% platform fee)
   → stripe.transfers.create({
       amount: 600 cents ($6),
       currency: "sgd",
       destination: cofounderAccountId,
       transfer_group: jobId
     })

4. Transfer to operator (50% platform fee)
   → stripe.transfers.create({
       amount: 600 cents ($6),
       currency: "sgd",
       destination: operatorAccountId,
       transfer_group: jobId
     })

5. Update Firestore
   → jobs/{jobId}:
       paymentStatus: "released"
       paymentCapturedAt: Timestamp
       paymentReleasedAt: Timestamp
       transferIds: [tr_1, tr_2, tr_3]
```

---

## Firestore Collections

### Jobs Collection

```javascript
{
  jobId: "job_abc123",
  // ... job details

  // Payment Info
  paymentIntentId: "pi_xxxxx",
  paymentStatus: "authorized", // pending → authorized → captured → released
  paymentCreatedAt: Timestamp,
  paymentCapturedAt: null,
  paymentReleasedAt: null,

  // Transfer IDs (after split)
  transferIds: null,  // Will be array of Stripe transfer IDs
}
```

### Payments Collection

```javascript
{
  paymentId: "payment_xyz789",
  jobId: "job_abc123",
  customerId: "user_id",

  // Stripe
  paymentIntentId: "pi_xxxxx",
  clientSecret: "pi_xxxxx_secret_xxxxx",
  paymentMethod: "pm_xxxxx",

  // Amounts
  amount: 132,
  serviceFee: 120,
  platformFee: 12,
  currency: "sgd",

  // Status
  status: "requires_capture",

  // Full response
  stripeResponse: { /* PaymentIntent object */ },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Stripe Connect for Handymen

### Account Creation

```javascript
// When handyman completes onboarding
await createConnectedAccount({
  uid: handyman.uid,
  email: handyman.email,
  name: handyman.name,
  phone: handyman.phone
});

// Firebase Function creates Express account
{
  type: 'express',
  country: 'SG',
  capabilities: {
    transfers: { requested: true }
  },
  metadata: {
    firebaseUid: uid,
    accountType: 'handyman'
  }
}
```

### Onboarding Flow

```
1. Handyman clicks "Set Up Payment Account"
   → /src/components/handyman/StripeOnboardingPrompt.jsx
   ↓
2. Create Stripe Connect account (if not exists)
   → createConnectedAccount({ uid, email, name, phone })
   → Returns accountId
   → Store in Firestore: stripeConnectedAccountId
   ↓
3. Create onboarding link
   → createAccountLink({ accountId, refreshUrl, returnUrl })
   → returnUrl: /handyman-dashboard?stripe_onboarding=complete
   → Returns Stripe hosted URL
   ↓
4. Redirect to Stripe Express onboarding
   → window.location.href = stripeOnboardingUrl
   → Handyman completes on Stripe:
      - Business details
      - Bank account information
      - ID verification
      - Tax information
   ↓
5. Stripe redirects back to returnUrl
   → /handyman-dashboard?stripe_onboarding=complete
   ↓
6. CRITICAL SECURITY CHECK - Verify completion with Stripe API
   → /src/pages/HandymanDashboard.jsx (useEffect)
   → Call getAccountStatus(accountId)
   → Backend returns: {success: true, status: {...}}
   → Check Stripe response fields:
      ✅ status.detailsSubmitted === true
      ✅ status.chargesEnabled === true
   ↓
7. If verified complete:
   → Update Firestore:
      stripeOnboardingCompleted: true
      stripeAccountStatus: 'complete'
      stripeChargesEnabled: true
      stripePayoutsEnabled: true/false
   → Reload page → Show full dashboard
   ↓
8. If NOT complete:
   → Remove URL param
   → Show StripeOnboardingPrompt again
   → Handyman must complete setup
```

### Security: Onboarding Verification

**Critical Edge Case:** Handyman navigates back before completing Stripe onboarding

**Vulnerability (Fixed 2025-12-11):**
- **Problem**: Previously trusted URL parameter `?stripe_onboarding=complete` blindly
- **Attack Vector**: Handyman could click browser back button or manually add URL param
- **Impact**: Dashboard would mark `stripeOnboardingCompleted=true` without verification
- **Result**: Handyman could accept jobs without payment account setup

**Fix Implementation:**
```javascript
// /src/pages/HandymanDashboard.jsx - Stripe Return Handler

useEffect(() => {
  const handleStripeReturn = async () => {
    const onboardingParam = searchParams.get('stripe_onboarding');

    if (onboardingParam === 'complete' && user && userProfile?.handyman?.stripeConnectedAccountId) {
      console.log('🔄 Handyman returned from Stripe - verifying completion...');

      // STEP 1: Call Stripe API to verify actual completion
      const accountStatus = await getAccountStatus(accountId);

      console.log('📊 Stripe account status:', accountStatus);

      // STEP 2: Check BOTH required fields
      // Note: Backend returns {success: true, status: {...}} structure
      const status = accountStatus.status;

      if (status?.detailsSubmitted && status?.chargesEnabled) {
        // VERIFIED: Mark as complete
        console.log('✅ Stripe onboarding verified as complete');

        await updateHandyman(user.uid, {
          stripeOnboardingCompleted: true,
          stripeAccountStatus: 'complete',
          stripeChargesEnabled: true,
          stripePayoutsEnabled: status.payoutsEnabled || false,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Firestore updated, reloading page...');
        window.location.href = '/handyman-dashboard';
      } else {
        // NOT COMPLETE: Remove param, show prompt again
        console.log('⚠️ Stripe onboarding NOT complete - handyman must finish setup');
        window.location.href = '/handyman-dashboard';
      }
    }
  };

  if (user && userProfile) {
    handleStripeReturn();
  }
}, [user, userProfile, searchParams]);
```

**Key Security Points:**
1. ✅ **Never trust URL parameters** - Always verify with authoritative source (Stripe API)
2. ✅ **Check multiple fields** - Both `details_submitted` AND `charges_enabled` must be true
3. ✅ **Fail securely** - If verification fails or errors, show onboarding prompt again
4. ✅ **Server-side verification** - Additional check via Stripe webhooks recommended for production

**Dashboard Access Control:**
```javascript
// /src/pages/HandymanDashboard.jsx - Access Gate

// ALWAYS check before showing dashboard
const hasCompletedStripeOnboarding =
  handymanProfile?.stripeOnboardingCompleted === true;

if (!hasCompletedStripeOnboarding) {
  // Block dashboard access, show onboarding prompt
  return <StripeOnboardingPrompt handyman={handymanProfile} />;
}

// Only show dashboard if ALL requirements met
return <FullDashboard />;
```

**Testing Verification:**
1. Start onboarding → Redirected to Stripe
2. Click browser back button → Returns to app
3. Check Firestore → `stripeOnboardingCompleted` should still be `false`
4. Dashboard → Should show StripeOnboardingPrompt, NOT full dashboard
5. Complete Stripe onboarding → Redirected back
6. Stripe API verification → Confirms completion
7. Firestore updated → `stripeOnboardingCompleted: true`
8. Dashboard → Shows full dashboard

---

## Environment Variables

```env
# Frontend (.env.local)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx  # Test mode
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx  # Production

# Backend (Firebase Functions config)
firebase functions:config:set stripe.secret_key="sk_test_xxxxx"  # Test
firebase functions:config:set stripe.secret_key="sk_live_xxxxx"  # Prod

# Webhook Secret (Backend)
firebase functions:config:set stripe.webhook_secret="whsec_xxxxx"
```

---

## Webhook Configuration

### Overview

Stripe webhooks notify your backend when payment events occur (payment succeeded, refund processed, etc.). Essential for production to ensure payment state stays in sync.

### Setup Instructions

#### 1. Get Webhook Endpoint URL

After deploying functions, your webhook endpoint is:
```
https://us-central1-eazydone-d06cf.cloudfunctions.net/stripeWebhook
```

#### 2. Configure in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Enter your webhook URL (from step 1)
5. Select events to listen for:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `charge.refunded`
   - ✅ `account.updated` (for Stripe Connect)
   - ✅ `transfer.created`
6. Click **Add endpoint**

#### 3. Get Webhook Signing Secret

1. After creating endpoint, click on it
2. Reveal the **Signing secret** (starts with `whsec_`)
3. Copy the secret

#### 4. Configure Backend

```bash
# Set webhook secret in Firebase Functions
firebase functions:config:set stripe.webhook_secret="whsec_xxxxx"

# Deploy functions to apply changes
firebase deploy --only functions
```

### Webhook Handler

**File:** `/functions/index.js` (lines 732-790)

**Function:** `stripeWebhook`

**Events Handled:**

| Event | Action | Firestore Update |
|-------|--------|-----------------|
| `payment_intent.succeeded` | Payment captured successfully | `paymentStatus: 'succeeded'` |
| `account.updated` | Stripe account status changed | Update handyman's Stripe onboarding status |
| `transfer.created` | Payment split transferred | Log transfer ID |

**Security:**
- Webhook signature verification using signing secret
- Prevents replay attacks
- Validates event authenticity

### Testing Webhooks Locally

#### Option 1: Stripe CLI (Recommended)

1. **Install Stripe CLI:**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop install stripe

   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to localhost:**
   ```bash
   # Forward to local Functions emulator
   stripe listen --forward-to localhost:5001/eazydone-d06cf/us-central1/stripeWebhook
   ```

4. **Trigger test events:**
   ```bash
   # Test payment success
   stripe trigger payment_intent.succeeded

   # Test account update
   stripe trigger account.updated
   ```

#### Option 2: Stripe Dashboard Test Mode

1. Use test API keys in development
2. Create test payments
3. Check webhook logs in Stripe Dashboard → Webhooks
4. View webhook payload and response

### Monitoring Webhooks

#### Check Webhook Deliveries

**Stripe Dashboard:**
1. Go to **Developers** → **Webhooks**
2. Click on your endpoint
3. View **Recent deliveries**
4. Check delivery status (succeeded/failed)
5. View request/response details

**Firebase Logs:**
```bash
# View webhook logs
firebase functions:log --only stripeWebhook

# Tail logs in real-time
firebase functions:log --only stripeWebhook --follow
```

### Troubleshooting

#### Webhook Not Receiving Events

1. **Check endpoint URL** - Must be publicly accessible (not localhost in production)
2. **Verify HTTPS** - Stripe requires HTTPS endpoints
3. **Check Firebase deployment** - Ensure functions deployed successfully
4. **Review Stripe logs** - Check Webhook delivery attempts in dashboard

#### Signature Verification Failed

1. **Check signing secret** - Ensure it matches Stripe dashboard
2. **Verify configuration** - `firebase functions:config:get` to check
3. **Redeploy functions** - After updating config

#### Events Not Processing

1. **Check Firebase logs** - Look for errors in webhook handler
2. **Verify event types** - Ensure subscribed to correct events
3. **Test with Stripe CLI** - Trigger events manually to debug

### Production Checklist

Before going live:

- [ ] Webhook endpoint configured with production URL
- [ ] Production signing secret set in Firebase Functions
- [ ] Event types selected in Stripe Dashboard
- [ ] Webhook handler tested with test events
- [ ] Monitoring/alerting set up for failed webhooks
- [ ] Error handling tested (signature failures, processing errors)

---

## API Endpoints

**Base URL:** `https://us-central1-eazydone-d06cf.cloudfunctions.net`

### Payment Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/createPaymentIntent` | POST | Create payment with escrow | ✅ Implemented |
| `/getPaymentStatus` | GET | Check payment status | ✅ Implemented |
| `/confirmPayment` | POST | Capture authorized payment | ✅ Implemented |
| `/releaseEscrowAndSplit` | POST | 3-way split after completion | ❌ Not used yet |
| `/refundPayment` | POST | Refund to customer | ✅ Implemented |

### Connect Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/createConnectedAccount` | POST | Create Stripe account | ✅ Implemented |
| `/createAccountLink` | POST | Generate onboarding URL | ✅ Implemented |
| `/getAccountStatus` | GET | Check onboarding status | ✅ Implemented |
| `/createLoginLink` | POST | Stripe Dashboard access | ✅ Implemented |

---

## Testing

### Test Cards

| Card Number | Behavior |
|-------------|----------|
| `4242 4242 4242 4242` | Success (no 3D Secure) |
| `4000 0027 6000 3184` | Requires 3D Secure |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |

**All test cards:** Any future expiry, any 3-digit CVC, any postal code

---

## Related Documentation

- [Job Creation Flow](./job-creation-flow.md)
- [Handyman Registration](./handyman-registration.md)
- [Firebase Setup](../setup/firebase-setup.md)

---

**Last Updated:** 2025-12-11
**Status:** ⚠️ Partially Implemented
- ✅ Payment intent creation with escrow
- ✅ Payment authorization (funds held)
- ✅ Stripe Connect account creation
- ❌ Payment capture after job completion
- ❌ 3-way split implementation
- ❌ Automatic refund scenarios
