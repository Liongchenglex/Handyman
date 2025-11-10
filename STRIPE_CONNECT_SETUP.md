# Stripe Connect Implementation Guide

## Overview

This document outlines the implementation of Stripe Connect for the Handyman platform, enabling a three-way payment split with escrow functionality.

## Business Model

### Payment Flow
1. **Customer Payment** → Customer pays for service
2. **Escrow Hold** → Funds held by platform until job completion
3. **Customer Confirmation** → Customer confirms job is completed satisfactorily
4. **Payment Release & Split** → Funds released and split between:
   - **Cofounder** (You)
   - **Business Operator** (Partner)
   - **Service Provider** (Handyman)

## Stripe Connect Architecture

### Account Types

#### 1. **Platform Account (Your Main Stripe Account)**
- This is your primary Stripe account
- Receives all customer payments initially
- Controls the escrow and payment release
- Charges platform fees

#### 2. **Connected Accounts (Express or Custom)**
For service providers (handymen), we recommend **Stripe Express**:
- ✅ Easier onboarding for handymen
- ✅ Stripe handles compliance (KYC/AML)
- ✅ Handymen get their own Stripe dashboard
- ✅ Faster implementation

For cofounders/business operator, you can use:
- **Standard accounts** (if they have existing Stripe accounts)
- **Express accounts** (if they need new accounts)

### Recommended Architecture: **Destination Charges with Separate Charges and Transfers**

This approach gives you maximum control over escrow and splits.

## Payment Flow Architecture

```
┌─────────────┐
│  Customer   │
└──────┬──────┘
       │ $125 (service $120 + platform fee $5)
       ▼
┌─────────────────────────────────────────┐
│   Platform Stripe Account               │
│   (Funds held in escrow)                │
└──────┬──────────────────────────────────┘
       │
       │ Customer confirms job done
       │
       ▼
┌─────────────────────────────────────────┐
│   Payment Split (3-way)                 │
├─────────────────────────────────────────┤
│   Cofounder: $X                         │
│   Business Operator: $Y                 │
│   Service Provider: $Z                  │
│   (where X + Y + Z = $120)              │
└─────────────────────────────────────────┘
       │
       ▼
┌──────────────────┬──────────────────┬──────────────────┐
│   Cofounder      │  Operator        │  Service         │
│   Connected Acc  │  Connected Acc   │  Provider Acc    │
└──────────────────┴──────────────────┴──────────────────┘
```

## Complete Handyman Journey Flow

Before diving into implementation, understand the complete flow:

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: HANDYMAN REGISTRATION                               │
│ ─────────────────────────────────────────────────────────── │
│ • Handyman completes registration form                       │
│ • Account created in Firebase Auth                           │
│ • Profile created in Firestore                               │
│                                                              │
│ Database State:                                              │
│   verified: false                                            │
│   status: 'pending'                                          │
│   stripeConnectAccountId: null                               │
│                                                              │
│ Dashboard Shows: ⏳ "Application Under Review"              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: OPERATIONS TEAM APPROVAL                             │
│ ─────────────────────────────────────────────────────────── │
│ • Ops team receives email notification                       │
│ • Reviews handyman documents and profile                     │
│ • Clicks "Approve" button in email                           │
│                                                              │
│ Database State:                                              │
│   verified: true  ← Changed                                  │
│   status: 'active'  ← Changed                                │
│   stripeConnectAccountId: null  ← Still null                 │
│                                                              │
│ Dashboard Shows: 💳 "Set Up Payment Account" (NEW VIEW)    │
│ Handyman CANNOT accept jobs yet - needs Stripe setup        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: STRIPE CONNECT ONBOARDING (NEW!)                    │
│ ─────────────────────────────────────────────────────────── │
│ • Handyman sees "Connect with Stripe" button                 │
│ • Clicks button → API creates Stripe Connect account         │
│ • Redirects to Stripe onboarding URL                         │
│ • Handyman fills in KYC info on Stripe's secure site         │
│ • Provides: ID, bank details, tax info                       │
│ • Stripe redirects back to app                               │
│ • Webhook updates handyman document                          │
│                                                              │
│ Database State:                                              │
│   verified: true                                             │
│   status: 'active'                                           │
│   stripeConnectAccountId: 'acct_xxxxx'  ← Added              │
│   stripeOnboardingComplete: true  ← Changed                  │
│   stripePayoutsEnabled: true  ← Changed                      │
│   stripeChargesEnabled: true  ← Changed                      │
│   stripeConnectedAt: timestamp  ← Added                      │
│                                                              │
│ Dashboard Shows: ✅ Full Dashboard with Job Board           │
│ Handyman CAN NOW accept jobs and receive payments           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: ACCEPTING JOBS & GETTING PAID                       │
│ ─────────────────────────────────────────────────────────── │
│ • Handyman can browse job board                              │
│ • Accept jobs and complete work                              │
│ • Customer pays through platform                             │
│ • Funds held in escrow until job confirmed                   │
│ • Payment split 3-ways (cofounder/operator/handyman)         │
│ • Handyman receives payout to their bank account             │
└─────────────────────────────────────────────────────────────┘
```

## Dashboard View Logic (HandymanDashboard.jsx)

Add this logic to show the correct view based on handyman state:

```javascript
// Get handyman state
const handymanStatus = userProfile?.handyman?.status;
const handymanVerified = userProfile?.handyman?.verified;
const stripeAccountId = userProfile?.handyman?.stripeConnectAccountId;
const stripeOnboardingComplete = userProfile?.handyman?.stripeOnboardingComplete;

// Priority order (check top to bottom):

// 1. Not verified yet
if (status === 'pending') {
  return <PendingStatusView />;  // ✅ Already exists
}

// 2. Rejected
if (status === 'rejected') {
  return <RejectedStatusView />;  // ✅ Already exists
}

// 3. Suspended
if (status === 'suspended') {
  return <SuspendedStatusView />;  // ✅ Already exists
}

// 4. ⭐ NEW: Approved but needs Stripe Connect setup
if (status === 'active' && verified === true && !stripeAccountId) {
  return <StripeConnectOnboardingView />;  // 🆕 Need to create
}

// 5. ⭐ NEW: Stripe setup incomplete (started but didn't finish)
if (status === 'active' && verified === true && stripeAccountId && !stripeOnboardingComplete) {
  return <StripeOnboardingIncompleteView />;  // 🆕 Need to create
}

// 6. Fully ready - show full dashboard with job board
if (status === 'active' && verified === true && stripeOnboardingComplete) {
  return <FullDashboard />;  // ✅ Already exists - NOW WITH JOB ACCESS
}
```

## New Dashboard Views Needed

### 1. StripeConnectOnboardingView

**When to show:** `verified === true` AND `stripeConnectAccountId === null`

**Purpose:** Prompt handyman to set up Stripe Connect account

**Content:**
- Title: "Set Up Your Payment Account"
- Explanation of why Stripe is needed
- Benefits:
  - Secure payment processing
  - Direct deposits to bank account
  - Stripe handles KYC/compliance
  - Real-time earnings tracking
- "Connect with Stripe" button (primary CTA)
- What you'll need:
  - Government ID
  - Bank account details
  - Tax information
- Security assurance message

### 2. StripeOnboardingIncompleteView

**When to show:** `stripeConnectAccountId` exists BUT `stripeOnboardingComplete === false`

**Purpose:** Prompt handyman to complete Stripe setup they started

**Content:**
- Title: "Complete Your Stripe Setup"
- Message: "You started setting up payments but didn't finish"
- "Resume Stripe Setup" button
- Time estimate: "Only 2-3 minutes remaining"

---

## Implementation Steps

### Phase 1: Stripe Setup

#### 1.1 Platform Account Setup
- [ ] Create/verify your Stripe account
- [ ] Enable Stripe Connect in Dashboard
- [ ] Get API keys (test mode first):
  - Publishable key
  - Secret key

#### 1.2 Connect Account Configuration
- [ ] Configure Express account settings
- [ ] Set up account onboarding for handymen
- [ ] Create cofounder & operator connected accounts

### Phase 2: Database Schema

#### 2.1 Updated Collections/Tables

**IMPORTANT ARCHITECTURAL DECISION:**
Instead of creating a separate `stripe_accounts` collection, we will **embed Stripe Connect fields directly in the `handymen` collection**. This approach is simpler, requires fewer queries, and provides atomic updates.

**Updated `handymen` collection** (add these fields):
```javascript
{
  // Existing fields
  uid: "user_id",
  name: "John Doe",
  email: "handyman@example.com",
  verified: true,
  status: "active",
  serviceTypes: [],
  experienceLevel: "intermediate",
  // ... other existing fields

  // NEW: Stripe Connect fields
  stripeConnectAccountId: null, // "acct_xxxxx" after Stripe Connect setup
  stripeAccountStatus: "pending", // 'pending', 'complete', 'restricted'
  stripeOnboardingComplete: false, // true when fully onboarded with Stripe
  stripeDetailsSubmitted: false, // true when KYC details submitted to Stripe
  stripePayoutsEnabled: false, // true when can receive payouts
  stripeChargesEnabled: false, // true when can accept payments
  stripeConnectedAt: null, // timestamp when first connected to Stripe
  stripeLastSyncedAt: null, // timestamp of last Stripe status sync

  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Why embed instead of separate collection?**
- ✅ Simpler - one document lookup instead of joining two collections
- ✅ Atomic updates - update handyman and Stripe status together
- ✅ Easier queries - filter handymen by Stripe status in single query
- ✅ Less data duplication and consistency issues
- ✅ Natural relationship - one handyman has one Stripe account

**`payments` collection**
```javascript
{
  jobId: "job_id",
  customerId: "customer_id",
  handymanId: "handyman_id",

  // Payment details
  paymentIntentId: "pi_xxxxx",
  amount: 125,
  serviceFee: 120,
  platformFee: 5,
  currency: "sgd",

  // Escrow status
  status: "pending|held|released|refunded",
  heldAt: timestamp,
  releasedAt: timestamp,

  // Split configuration
  splits: {
    cofounder: 40,
    operator: 40,
    handyman: 40
  },

  // Transfer IDs (after release)
  transferIds: {
    cofounder: "tr_xxxxx",
    operator: "tr_xxxxx",
    handyman: "tr_xxxxx"
  },

  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Update `jobs` collection**
```javascript
{
  // ... existing fields
  paymentId: "payment_id",
  paymentStatus: "pending|held|released|refunded",
  customerConfirmedAt: timestamp
}
```

### Phase 3: Backend Implementation

#### 3.1 Stripe Service Setup

**File: `src/services/stripe/config.js`**
```javascript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const STRIPE_CONFIG = {
  platformFee: 5, // $5 platform fee
  splits: {
    cofounder: 0.33, // 33% of service fee
    operator: 0.33,  // 33% of service fee
    handyman: 0.34   // 34% of service fee (to handle rounding)
  }
};
```

#### 3.2 Core Stripe Services

**File: `src/services/stripe/connect.js`**
- Create Express account for handymen
- Generate onboarding link
- Check account status
- Handle webhooks

**File: `src/services/stripe/payment.js`**
- Create payment intent
- Capture payment (hold in escrow)
- Release payment with splits
- Handle refunds

**File: `src/services/stripe/transfers.js`**
- Execute 3-way split transfers
- Handle transfer failures
- Track transfer status

### Phase 4: API Endpoints

#### 4.1 Connect Onboarding
```
POST /api/stripe/connect/create-account
- Creates Express connected account for handyman

GET /api/stripe/connect/onboarding-link
- Generates onboarding URL for account setup

GET /api/stripe/connect/account-status
- Checks if connected account is fully set up
```

#### 4.2 Payment Processing
```
POST /api/stripe/payment/create-intent
- Creates payment intent for customer

POST /api/stripe/payment/confirm
- Confirms payment (holds in escrow)

POST /api/stripe/payment/release
- Releases escrow and splits payment 3-ways

POST /api/stripe/payment/refund
- Refunds payment if job cancelled
```

### Phase 5: Frontend Integration

#### 5.1 Customer Payment Flow
- Update PaymentForm.jsx to use real Stripe Elements
- Handle payment confirmation
- Show escrow status

#### 5.2 Handyman Onboarding
- Add Stripe Connect onboarding flow
- Dashboard page for payout settings
- View payment history

#### 5.3 Job Completion Flow
- Add "Mark as Complete" button for customers
- Confirmation dialog
- Trigger payment release

## Code Structure

```
src/
├── services/
│   └── stripe/
│       ├── config.js           # Stripe initialization & config
│       ├── connect.js          # Connected account management
│       ├── payment.js          # Payment intent & capture
│       ├── transfers.js        # Payment splits & transfers
│       └── webhooks.js         # Webhook handlers
├── api/
│   └── stripe/
│       ├── connect/
│       │   ├── create-account.js
│       │   ├── onboarding-link.js
│       │   └── account-status.js
│       ├── payment/
│       │   ├── create-intent.js
│       │   ├── confirm.js
│       │   ├── release.js
│       │   └── refund.js
│       └── webhooks.js
├── components/
│   ├── payment/
│   │   ├── StripePaymentForm.jsx
│   │   └── PaymentStatus.jsx
│   ├── handyman/
│   │   ├── StripeOnboarding.jsx
│   │   └── PayoutDashboard.jsx
│   └── customer/
│       └── JobCompletionConfirm.jsx
└── config/
    └── stripe.js              # Stripe keys & configuration
```

## Environment Variables

```env
# Stripe Keys (Test Mode)
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Stripe Connect
STRIPE_CONNECT_REFRESH_URL=https://yourdomain.com/stripe/connect/refresh
STRIPE_CONNECT_RETURN_URL=https://yourdomain.com/stripe/connect/return

# Connected Account IDs (for cofounder & operator)
STRIPE_COFOUNDER_ACCOUNT_ID=acct_xxxxx
STRIPE_OPERATOR_ACCOUNT_ID=acct_xxxxx
```

## Webhook Events to Handle

### Critical Webhooks
```
account.updated                    # Connected account status changes
payment_intent.succeeded           # Payment successful
payment_intent.payment_failed      # Payment failed
transfer.created                   # Transfer initiated
transfer.paid                      # Transfer completed
transfer.failed                    # Transfer failed
payout.paid                        # Handyman received payout
payout.failed                      # Payout failed
```

## Split Calculation Example

### Scenario: $120 Service Fee

```javascript
const serviceFee = 120;
const platformFee = 5;
const totalCharged = 125; // Customer pays this

// Service fee split (3-way)
const cofounderShare = Math.floor(serviceFee * 0.33); // $39.60 → $39
const operatorShare = Math.floor(serviceFee * 0.33);  // $39.60 → $39
const handymanShare = serviceFee - cofounderShare - operatorShare; // $42

// Platform keeps the $5 platform fee
```

**Note:** Consider making split percentages configurable per job or service type.

## Testing Strategy

### Phase 1: Test Mode
1. Use Stripe test API keys
2. Use test card numbers: `4242 4242 4242 4242`
3. Test full flow:
   - Handyman onboarding
   - Customer payment
   - Escrow hold
   - Payment release & splits

### Phase 2: Test Connected Accounts
1. Create test connected accounts
2. Verify onboarding flow
3. Test transfers to connected accounts
4. Verify payout schedules

### Phase 3: Edge Cases
- Failed payments
- Refunds
- Disputed charges
- Transfer failures
- Account restrictions

## Compliance & Legal Considerations

### 1. Platform Agreement
- [ ] Review Stripe Connect terms
- [ ] Create service agreement for handymen
- [ ] Define liability and escrow terms

### 2. Tax Compliance
- [ ] Stripe handles 1099-K forms (for US)
- [ ] Configure tax settings
- [ ] Consider tax collection per jurisdiction

### 3. Escrow Period
- [ ] Define maximum escrow hold period (7-30 days typical)
- [ ] Auto-release policy if customer doesn't respond
- [ ] Dispute resolution process

### 4. Fees Transparency
- [ ] Clearly display all fees to customers
- [ ] Show net payout to handymen
- [ ] Terms of service updates

## Cost Structure (Stripe Fees)

### Stripe Processing Fees
- **Singapore cards:** 3.4% + $0.50 SGD
- **International cards:** 4.4% + $0.50 SGD
- **Transfers to connected accounts:** No additional fee

### Example Cost Breakdown
```
Customer pays: $125.00
Stripe fee (3.4% + 0.50): $4.75
Net received: $120.25

Split:
- Cofounder: $40.00
- Operator: $40.00
- Handyman: $40.00
- Platform net: $0.25 (after Stripe fees)
```

**Important:** Consider who absorbs Stripe fees (customer, platform, or split across parties).

## Timeline Estimate

### Week 1: Setup & Infrastructure
- Stripe account configuration
- Database schema updates
- Environment setup

### Week 2: Backend Development
- Connect account management
- Payment processing
- Transfer logic

### Week 3: Frontend Integration
- Payment forms
- Onboarding flows
- Dashboard updates

### Week 4: Testing & Refinement
- Test mode validation
- Edge case handling
- Security review

### Week 5: Production Launch
- Switch to live mode
- Monitor transactions
- Support & iteration

## Security Considerations

### 1. API Keys
- ✅ Never commit API keys to git
- ✅ Use environment variables
- ✅ Restrict API key permissions
- ✅ Rotate keys periodically

### 2. Webhook Security
- ✅ Verify webhook signatures
- ✅ Use HTTPS only
- ✅ Implement idempotency

### 3. PCI Compliance
- ✅ Use Stripe Elements (handles PCI)
- ✅ Never store card details
- ✅ Use HTTPS everywhere

## Next Steps

1. **Review this document** and provide feedback
2. **Decide on split percentages** for the three parties
3. **Create Stripe account** (if not already done)
4. **Approve implementation plan**
5. **Start with Phase 1** (Stripe setup)

## Questions to Answer Before Implementation

1. **Split percentages:** What % should each party receive?
   - Cofounder: ____%
   - Operator: ____%
   - Handyman: ____%

2. **Escrow period:** How long should we hold funds?
   - Suggested: 7 days with auto-release

3. **Who pays Stripe fees?**
   - Option A: Customer (add to total)
   - Option B: Platform absorbs
   - Option C: Split proportionally

4. **Dispute resolution:** What if customer isn't satisfied?
   - Full refund period: ___ days
   - Partial refund rules?
   - Dispute mediation process?

5. **Payout schedule:** How often do handymen get paid?
   - Instant (more fees)
   - Daily
   - Weekly (Stripe default)

## Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Stripe Transfers](https://stripe.com/docs/connect/charges-transfers)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)

---

**Ready to implement?** Review this document and let me know:
1. Any questions or concerns
2. Answers to the decision points above
3. If you'd like to proceed with implementation
