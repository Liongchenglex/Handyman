# Payment Data Flow - Complete Explanation

## Your Observations (FIXED!)

You noticed:
1. ✅ Payment appears in Stripe
2. ✅ Payment document created in `payments` collection
3. ❌ **Job document had `paymentStatus: 'completed'` but `paymentIntentId: null`** (FIXED!)

## Root Cause

There was a **data structure mismatch** between what the frontend sent and what the backend expected.

---

## Complete Data Flow

### Step 1: User Clicks "Confirm & Pay"

**File**: `/src/components/customer/PaymentForm.jsx` (lines 47-54)

```javascript
const result = await createPaymentIntent({
  jobId: tempJobId,
  customerId: customerId || 'temp_customer',
  handymanId: handymanId || 'temp_handyman',
  serviceFee: serviceFee,
  serviceType: serviceType,
  customerEmail: customerEmail
});
```

**Result from Stripe API**:
```javascript
{
  paymentIntentId: "pi_xxxxx",
  clientSecret: "pi_xxxxx_secret_xxxxx",
  status: "requires_payment_method",
  amount: 132, // in SGD (not cents)
  currency: "sgd"
}
```

---

### Step 2: PaymentForm Sends Data to Parent Component

**File**: `/src/components/customer/PaymentForm.jsx` (lines 68-77)

**BEFORE (BROKEN)**:
```javascript
onPaymentSuccess({
  id: result.paymentIntentId,  // ← Top level
  status: result.status,
  amount: result.amount * 100  // ← WRONG! Already in SGD
});
```

**AFTER (FIXED)** ✅:
```javascript
onPaymentSuccess({
  paymentIntent: {  // ← Nested structure
    id: result.paymentIntentId,
    status: result.status,
    amount: result.amount, // ← Already in SGD
    currency: result.currency,
    payment_method: selectedPaymentMethod,
    client_secret: result.clientSecret
  }
});
```

---

### Step 3: JobRequestForm Receives Payment Result

**File**: `/src/components/customer/JobRequestForm.jsx` (lines 269-302)

```javascript
const handlePaymentSuccess = async (paymentResultData) => {
  // paymentResultData structure:
  // {
  //   paymentIntent: {
  //     id: "pi_xxxxx",
  //     status: "requires_payment_method",
  //     amount: 132,
  //     currency: "sgd",
  //     payment_method: "Card",
  //     client_secret: "pi_xxxxx_secret_xxxxx"
  //   }
  // }

  const completeJobData = {
    ...jobData,
    customerId: userId,
    paymentResult: paymentResultData  // ← Passed to createJob
  };

  const createdJob = await createJob(completeJobData);
};
```

---

### Step 4: Create Job Document in Firestore

**File**: `/src/services/api/jobs.js` (lines 85-86)

**BEFORE (BROKEN)**:
```javascript
paymentStatus: jobData.paymentResult ? 'completed' : 'pending',  // ← WRONG!
paymentIntentId: jobData.paymentResult?.paymentIntent?.id || null  // ← null because structure mismatch
```

**AFTER (FIXED)** ✅:
```javascript
paymentStatus: jobData.paymentResult ? 'pending' : 'pending',  // ← Correct! Payment not captured yet
paymentIntentId: jobData.paymentResult?.paymentIntent?.id || null  // ← Now works!
```

**Firestore Job Document** (`jobs/{jobId}`):
```javascript
{
  jobId: "job123",
  serviceType: "Plumbing",
  customerId: "user123",
  status: "pending",
  paymentStatus: "pending",  // ← Correct status
  paymentIntentId: "pi_xxxxx",  // ← Now populated!
  estimatedBudget: 132,
  // ... other job fields
}
```

---

### Step 5: Create Payment Document in Firestore

**File**: `/src/services/api/jobs.js` (lines 95-106)

**BEFORE (BROKEN)**:
```javascript
await createPayment({
  jobId: jobId,
  customerId: jobData.customerId,
  amount: jobData.estimatedBudget || 120,
  currency: 'sgd',
  status: 'succeeded',  // ← WRONG! Should be 'requires_payment_method'
  paymentIntentId: jobData.paymentResult.paymentIntent?.id,
  paymentMethod: jobData.paymentResult.paymentIntent?.payment_method,
  stripeResponse: jobData.paymentResult
});
```

**AFTER (FIXED)** ✅:
```javascript
await createPayment({
  jobId: jobId,
  customerId: jobData.customerId,
  amount: jobData.estimatedBudget || 120,
  currency: 'sgd',
  status: jobData.paymentResult.paymentIntent?.status || 'pending',  // ← Uses actual Stripe status
  paymentIntentId: jobData.paymentResult.paymentIntent?.id,
  paymentMethod: jobData.paymentResult.paymentIntent?.payment_method,
  clientSecret: jobData.paymentResult.paymentIntent?.client_secret,  // ← Added
  stripeResponse: jobData.paymentResult
});
```

**Firestore Payment Document** (`payments/{paymentId}`):
```javascript
{
  id: "payment123",
  jobId: "job123",
  customerId: "user123",
  amount: 132,
  currency: "sgd",
  status: "requires_payment_method",  // ← Correct Stripe status
  paymentIntentId: "pi_xxxxx",
  paymentMethod: "Card",
  clientSecret: "pi_xxxxx_secret_xxxxx",
  stripeResponse: { /* full payment result */ },
  createdAt: "2025-11-11T00:49:24.000Z"
}
```

---

## Data Architecture Clarification

### You Have TWO Collections:

#### 1. `jobs` Collection (Primary)
**Purpose**: Store job details AND payment status

**Payment Fields**:
- `paymentIntentId` - Reference to Stripe payment intent
- `paymentStatus` - Lifecycle: `pending` → `captured` → `released` or `refunded`
- `paymentCreatedAt`, `paymentCapturedAt`, `paymentReleasedAt` - Timestamps
- `transferIds` - Transfer IDs after escrow release

**When Updated**:
- ✅ Payment intent created (Firebase Function, lines 316-334)
- ✅ Payment captured (Firebase Function, lines 392-395)
- ✅ Escrow released (Firebase Function, lines 545-552)
- ✅ Payment refunded (Firebase Function, lines 636-641)

#### 2. `payments` Collection (Audit Trail)
**Purpose**: Separate payment records for querying and history

**Why It Exists**:
- Easy to query all payments for a customer
- Stores complete Stripe response for debugging
- Audit trail independent of job lifecycle
- Can be used for reporting/analytics

**When Created**:
- ✅ After job is created (in `jobs.js`, lines 94-106)

---

## Payment Status Lifecycle

### Status Mapping Table

| Phase | Stripe Dashboard Status | Stripe API Status | `payments` Collection Status | `jobs` Collection `paymentStatus` | Money Held? | Description |
|-------|------------------------|-------------------|----------------------------|----------------------------------|-------------|-------------|
| **1. Intent Created** | Incomplete | `requires_payment_method` | `requires_payment_method` | `pending` | ❌ No | Payment intent created, no card collected yet |
| **2. Card Entered** | Incomplete | `requires_confirmation` | `requires_confirmation` | `pending` | ❌ No | Card details entered, needs confirmation |
| **3. 3D Secure** | Incomplete | `requires_action` | `requires_action` | `pending` | ❌ No | Needs 3D Secure authentication |
| **4. Authorized (Escrow)** | Uncaptured | `requires_capture` | `requires_capture` | `pending` | ✅ **Yes** | Card authorized, funds held in escrow |
| **5. Captured** | Succeeded | `succeeded` | `succeeded` | `captured` | ✅ Yes | Payment captured (money taken from card) |
| **6. Split & Released** | Succeeded | `succeeded` | `succeeded` | `released` | ✅ Yes | Payment split to handyman/cofounder/operator |
| **7. Refunded** | Refunded | `succeeded` (refund object) | `refunded` | `refunded` | ❌ No | Payment refunded to customer |
| **8. Failed** | Failed | `canceled` or `failed` | `failed` | `failed` | ❌ No | Payment failed or canceled |

### Key Differences Explained

#### `payments` Collection Status
- **Source**: Directly from Stripe API (`paymentIntent.status`)
- **Purpose**: Technical tracking, matches Stripe exactly
- **Values**: Stripe's native status strings
- **Example**: `requires_payment_method`, `requires_capture`, `succeeded`

#### `jobs` Collection `paymentStatus`
- **Source**: Your business logic (set by Firebase Functions)
- **Purpose**: Simplified status for job lifecycle
- **Values**: Your custom status strings
- **Example**: `pending`, `captured`, `released`, `refunded`

---

### Complete Payment Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Payment Intent Created (Current Implementation)       │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Incomplete"                               │
│ Stripe API:          requires_payment_method                    │
│ payments.status:     requires_payment_method                    │
│ jobs.paymentStatus:  pending                                    │
│ Money Held:          ❌ No                                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    [User enters card details]
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Card Confirmation (Not Yet Implemented)               │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Incomplete"                               │
│ Stripe API:          requires_confirmation                      │
│ payments.status:     requires_confirmation                      │
│ jobs.paymentStatus:  pending                                    │
│ Money Held:          ❌ No                                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    [Confirm payment intent]
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: 3D Secure Authentication (If Required)                │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Incomplete"                               │
│ Stripe API:          requires_action                            │
│ payments.status:     requires_action                            │
│ jobs.paymentStatus:  pending                                    │
│ Money Held:          ❌ No                                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    [User completes 3D Secure]
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Payment Authorized - ESCROW! (Goal of Phase 2)        │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Uncaptured"                               │
│ Stripe API:          requires_capture                           │
│ payments.status:     requires_capture                           │
│ jobs.paymentStatus:  pending                                    │
│ Money Held:          ✅ YES (held on customer's card)           │
│ Note:                Funds reserved but NOT charged yet         │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    [Handyman completes job]
                    [Customer confirms completion]
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: Payment Captured (Manual Capture)                     │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Succeeded"                                │
│ Stripe API:          succeeded                                  │
│ payments.status:     succeeded                                  │
│ jobs.paymentStatus:  captured                                   │
│ Money Held:          ✅ YES (now in your Stripe balance)        │
│ Trigger:             Firebase Function captures payment         │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    [Split payment to handyman/you/cofounder]
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: Payment Split & Released                              │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Succeeded" (with transfers)               │
│ Stripe API:          succeeded                                  │
│ payments.status:     succeeded                                  │
│ jobs.paymentStatus:  released                                   │
│ Money Held:          ✅ YES (distributed to all parties)        │
│ Distribution:        Handyman: 100% service fee                 │
│                      You: 50% platform fee                      │
│                      Cofounder: 50% platform fee                │
└─────────────────────────────────────────────────────────────────┘
```

### Alternative Flow: Refund

```
┌─────────────────────────────────────────────────────────────────┐
│ REFUND: Job Canceled Before Capture                            │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Canceled"                                 │
│ Stripe API:          canceled                                   │
│ payments.status:     canceled                                   │
│ jobs.paymentStatus:  canceled                                   │
│ Money Held:          ❌ No (authorization released)             │
│ Note:                No charge to customer if before capture    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ REFUND: Job Canceled After Capture                             │
├─────────────────────────────────────────────────────────────────┤
│ Stripe Dashboard:    "Refunded"                                 │
│ Stripe API:          succeeded (with refund)                    │
│ payments.status:     refunded                                   │
│ jobs.paymentStatus:  refunded                                   │
│ Money Held:          ❌ No (returned to customer)               │
│ Note:                Refund issued, money back to customer      │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Was Fixed

### Fix 1: Data Structure Mismatch ✅
**Problem**: PaymentForm sent `{ id: "pi_xxxxx" }` but jobs.js expected `{ paymentIntent: { id: "pi_xxxxx" } }`

**Solution**: Updated PaymentForm.jsx to send nested structure

**Impact**: Now `paymentIntentId` is correctly populated in job document

### Fix 2: Incorrect Payment Status ✅
**Problem**: Job's `paymentStatus` was set to `'completed'` immediately after creating payment intent

**Solution**: Set to `'pending'` because payment is held in escrow, not completed

**Impact**: Correct payment lifecycle tracking

### Fix 3: Hardcoded Payment Record Status ✅
**Problem**: Payment record in `payments` collection was hardcoded to `'succeeded'`

**Solution**: Use actual Stripe status from `paymentIntent.status`

**Impact**: Accurate payment status in audit trail

---

## Testing the Fix

### Before Testing:
```bash
# Refresh your app
npm start
```

### Test Case: Create a Job with Payment

1. Fill out job request form
2. Click "Confirm & Pay"
3. Check console for payment intent creation
4. Check Firestore:

**Job Document** (`jobs/{jobId}`):
```javascript
{
  paymentIntentId: "pi_xxxxx",  // ← Should be populated now!
  paymentStatus: "pending",     // ← Correct status
  // ...
}
```

**Payment Document** (`payments/{paymentId}`):
```javascript
{
  paymentIntentId: "pi_xxxxx",
  status: "requires_payment_method",  // ← Correct Stripe status
  clientSecret: "pi_xxxxx_secret_xxxxx",
  stripeResponse: { /* complete data */ },
  // ...
}
```

---

## Summary

✅ **Fixed**: Payment intent ID now correctly stored in job document
✅ **Fixed**: Payment status reflects actual state (pending, not completed)
✅ **Fixed**: Payment record uses actual Stripe status
✅ **Clarified**: Two collections serve different purposes (job lifecycle vs audit trail)

**Next Steps**:
- Test the fix by creating a new job
- Verify both `jobs` and `payments` documents are correct
- Proceed to Phase 2 (card collection with Stripe Elements)

---

**Last Updated**: 2025-11-11
**Status**: Data flow fixed and documented
