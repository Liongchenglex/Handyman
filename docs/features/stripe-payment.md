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
- `createPaymentIntent(paymentData)` - Create payment with escrow (Line 29)
- `getPaymentStatus(paymentIntentId)` - Check payment status (Line 45)
- `confirmPayment(paymentIntentId)` - Capture payment (Line 61)
- `releaseEscrowAndSplit(releaseData)` - Split payment 3-way (Line 83)
- `refundPayment(paymentIntentId, reason)` - Refund payment (Line 100)
- `createConnectedAccount(handymanData)` - Create Stripe account (Line 127)
- `createAccountLink(linkData)` - Onboarding URL (Line 146)
- `getAccountStatus(accountId)` - Check onboarding (Line 162)

**`/src/components/customer/PaymentForm.jsx`** - Payment UI container
- Creates payment intent on mount (Line 38)
- Loads Stripe.js
- Wraps StripeCardForm in Elements provider

**`/src/components/customer/StripeCardForm.jsx`** - Card collection
- Stripe Elements CardElement
- Card confirmation with 3D Secure
- Error handling

**`/src/config/servicePricing.js`** - Pricing logic
- `PLATFORM_FEE_PERCENTAGE` = 0.10 (10%)
- `getPlatformFee(serviceFee)` - Calculate 10% fee
- `getTotalAmount(serviceFee)` - Total with platform fee

### Backend (Firebase Functions)

**`/functions/index.js`** - Cloud Functions

**Payment Functions:**
- `createPaymentIntent` - Create payment with manual capture (Line ~230)
- `confirmPayment` - Capture authorized payment (Line ~380)
- `releaseEscrowAndSplit` - 3-way split to accounts (Line ~470)
- `refundPayment` - Refund to customer (Line ~600)
- `getPaymentStatus` - Fetch payment details (Line ~350)

**Connect Functions:**
- `createConnectedAccount` - Create Stripe Express account (Line 58)
- `createAccountLink` - Generate onboarding URL (Line 136)
- `getAccountStatus` - Check account completion (Line 182)
- `createLoginLink` - Stripe Dashboard access (Line ~280)

---

## Payment Flow

### Phase 1: Create Payment Intent (Escrow)

```
Job created in Firestore
  ↓
PaymentForm mounts with jobId
  → /src/components/customer/PaymentForm.jsx:38
  ↓
useEffect creates payment intent
  → /src/services/stripe/stripeApi.js:29
  → createPaymentIntent({
      jobId: "real_firestore_job_id",
      customerId: "firebase_user_id",
      handymanId: null,  // Not assigned yet
      serviceFee: 120,
      serviceType: "Plumbing",
      customerEmail: "customer@example.com"
    })
  ↓
Firebase Function: /functions/index.js (createPaymentIntent)
  → Calculate amounts:
      serviceFee = 120
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
        customerId: "firebase_user_id"
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

| Phase | Stripe Status | Firestore `paymentStatus` | Funds Status |
|-------|---------------|--------------------------|--------------|
| Intent created | `requires_payment_method` | `pending` | ❌ Not held |
| Card entered | `requires_confirmation` | `pending` | ❌ Not held |
| 3D Secure | `requires_action` | `pending` | ❌ Not held |
| Authorized | `requires_capture` | `authorized` | ✅ Held in escrow |
| Captured | `succeeded` | `captured` | ✅ Charged to card |
| Released | `succeeded` (with transfers) | `released` | ✅ Split to accounts |
| Refunded | `refunded` | `refunded` | ❌ Returned to customer |

---

## 3-Way Payment Split (Not Implemented Yet)

### Split Logic

```
Service Fee: $120
Platform Fee: $12 (10%)
Total: $132

After job completion:
  - Handyman: $120 (100% of service fee)
  - Cofounder: $6 (50% of platform fee)
  - Operator: $6 (50% of platform fee)
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
1. Create account → Returns accountId
2. Create onboarding link → Returns URL
3. Redirect to Stripe Express onboarding
4. Handyman completes:
   - Business details
   - Bank account
   - ID verification
5. Return to dashboard
6. Check account.details_submitted === true
7. Update Firestore:
     stripeAccountId: accountId
     stripeOnboardingComplete: true
```

---

## Environment Variables

```env
# Frontend (.env.local)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx  # Test mode
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx  # Production

# Backend (Firebase Functions config)
firebase functions:config:set stripe.secret_key="sk_test_xxxxx"  # Test
firebase functions:config:set stripe.secret_key="sk_live_xxxxx"  # Prod
```

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
**Status:** ⚠️ Partially Implemented - Escrow release and splits not yet activated
