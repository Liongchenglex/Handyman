# Code Explanation - Where Things Are Defined

## 📍 Location: `/functions/index.js`

This file contains ALL your Stripe logic. Let me break down where each piece is:

---

## 💰 Profit Split Logic

### Location: Lines 29-48

```javascript
/**
 * Calculate payment splits
 * - Handyman gets 100% of service fee
 * - Platform fee ($5) is split 50/50 between cofounder and operator
 */
const calculateSplits = (serviceFee, platformFee = 5) => {
  const handymanShare = serviceFee; // 100% of service fee
  const cofounderShare = platformFee / 2; // 50% of platform fee
  const operatorShare = platformFee / 2; // 50% of platform fee

  return {
    cofounder: cofounderShare,
    operator: operatorShare,
    handyman: handymanShare,
    platformFee: platformFee,
    totalCollected: serviceFee + platformFee
  };
};
```

**How it works:**
- Takes service fee (e.g., $120) and platform fee (default $5)
- Handyman gets 100% of service fee = $120
- Cofounder gets 50% of platform fee = $2.50
- Operator gets 50% of platform fee = $2.50
- Total collected: $125 ($120 service + $5 platform)

**Used by:** `releaseEscrowAndSplit` function

---

## 🔒 Escrow Logic

### ⚠️ Important: The escrow logic is SPLIT between two places

### Part 1: Payment Intent Creation (Lines 280-360)
**Function:** `createPaymentIntent`

```javascript
// Create payment intent with manual capture (for escrow)
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: 'sgd',
  payment_method_types: ['card'],
  capture_method: 'manual',  // 🔑 THIS is the escrow! Funds are HELD, not charged
  // ... other fields
});
```

**What this does:**
1. When customer pays, Stripe **authorizes** the card but doesn't **charge** it yet
2. Funds are "held" on their card (shows as pending)
3. You have 7 days to either:
   - Capture the payment (take the money)
   - Cancel it (release the hold)

**This creates the escrow!** Money is reserved but not taken.

---

### Part 2: Escrow Release (Lines 450-564)
**Function:** `releaseEscrowAndSplit`

```javascript
exports.releaseEscrowAndSplit = functions.https.onRequest((req, res) => {
  // ...

  // Calculate splits
  const splits = calculateSplits(serviceFee, platformFee);

  // Create transfers to all three parties IN PARALLEL
  const [cofounderTransfer, operatorTransfer, handymanTransfer] = await Promise.all([
    stripe.transfers.create({
      amount: dollarsToCents(splits.cofounder),  // 50% of platform fee ($2.50)
      destination: cofounderAccountId,
      // ...
    }),
    stripe.transfers.create({
      amount: dollarsToCents(splits.operator),   // 50% of platform fee ($2.50)
      destination: operatorAccountId,
      // ...
    }),
    stripe.transfers.create({
      amount: dollarsToCents(splits.handyman),   // 100% of service fee ($120)
      destination: handymanAccountId,
      // ...
    })
  ]);

  // Update job document in Firestore
  await admin.firestore().collection('jobs').doc(jobId).update({
    paymentStatus: 'released',
    transferIds: { ... },
    splits: { ... }
  });
});
```

**What this does:**
1. Takes the service fee and platform fee amounts
2. Calls `calculateSplits()` to get the split breakdown:
   - Handyman: 100% of service fee ($120)
   - Cofounder: 50% of platform fee ($2.50)
   - Operator: 50% of platform fee ($2.50)
3. Creates 3 **separate transfers** in Stripe (all at once using `Promise.all`)
4. Updates Firestore to mark payment as "released"

---

## ❓ What's MISSING: Status-Based Auto-Release

### The Current Flow (Manual):
```
Customer pays → Funds held in escrow → Customer manually confirms job → You call releaseEscrowAndSplit → Payment splits:
  - Handyman: $120 (100% service fee)
  - Cofounder: $2.50 (50% platform fee)
  - Operator: $2.50 (50% platform fee)
```

### What's NOT Implemented Yet: Automatic Status Check

You mentioned wanting **status-based** escrow, meaning:
- When job status = "completed" → automatically release after 3 days
- Or when customer clicks "Confirm Completion" → immediately release

**This logic is NOT in the code yet.** Here's what you need to add:

#### Option A: Immediate Release (Customer Confirms)
**Where:** Your frontend React component

```javascript
// In your JobCompletion component
const handleCustomerConfirm = async () => {
  // 1. Update job status
  await updateDoc(doc(db, 'jobs', jobId), {
    status: 'confirmed',
    confirmedAt: serverTimestamp()
  });

  // 2. Immediately release payment
  await releaseEscrowAndSplit({
    paymentIntentId: job.paymentIntentId,
    jobId: job.id,
    serviceFee: job.serviceFee,
    handymanAccountId: job.handymanStripeAccountId,
    cofounderAccountId: process.env.REACT_APP_COFOUNDER_ACCOUNT,
    operatorAccountId: process.env.REACT_APP_OPERATOR_ACCOUNT
  });
};
```

#### Option B: Auto-Release After 3 Days (Not Implemented)
**Where:** You'd need to add a new Cloud Scheduler function

```javascript
// NOT IN YOUR CODE YET - You need to add this:
exports.autoReleaseEscrow = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const threeDaysAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    );

    // Find jobs completed >3 days ago with unreleased payment
    const jobsSnapshot = await admin.firestore()
      .collection('jobs')
      .where('status', '==', 'completed')
      .where('completedAt', '<=', threeDaysAgo)
      .where('paymentStatus', '==', 'captured')
      .get();

    // Release payment for each job
    for (const jobDoc of jobsSnapshot.docs) {
      const job = jobDoc.data();
      // Call releaseEscrowAndSplit logic here
    }
  });
```

---

## 📊 Summary: Where Everything Is

| Feature | File | Lines | Function Name |
|---------|------|-------|---------------|
| **Profit Split Calculation** | `/functions/index.js` | 29-43 | `calculateSplits()` |
| **Escrow Creation (Hold Funds)** | `/functions/index.js` | 280-360 | `createPaymentIntent` (line ~310: `capture_method: 'manual'`) |
| **Escrow Release (Split Payment)** | `/functions/index.js` | 450-564 | `releaseEscrowAndSplit` |
| **Status-Based Auto-Release** | ❌ **NOT IMPLEMENTED** | N/A | Needs to be added |

---

## 🎯 What You Have vs What You Need

### ✅ You Have:
1. **Manual escrow** - Payment is held when customer pays
2. **Manual release** - You can call `releaseEscrowAndSplit` to split payment
3. **Profit split** - Handyman gets 100% service fee, you and cofounder split platform fee 50/50

### ⚠️ You Need to Add:
1. **Status-based trigger** - When job status = "completed", start 3-day countdown
2. **Auto-release scheduler** - After 3 working days, automatically call `releaseEscrowAndSplit`
3. **Frontend integration** - Connect your UI buttons to call `releaseEscrowAndSplit`

---

## 🔧 Quick Integration Guide

### In Your Frontend (React):

**When customer confirms job completion:**
```javascript
import { releaseEscrowAndSplit } from './services/stripe/stripeApi';

// In your component:
const confirmCompletion = async () => {
  await releaseEscrowAndSplit({
    paymentIntentId: job.paymentIntentId,
    jobId: job.id,
    serviceFee: job.serviceFee,
    platformFee: 5, // Optional, defaults to $5
    handymanAccountId: job.handymanStripeAccountId,
    cofounderAccountId: process.env.REACT_APP_COFOUNDER_ACCOUNT,
    operatorAccountId: process.env.REACT_APP_OPERATOR_ACCOUNT
  });

  // This will:
  // 1. Capture the held payment
  // 2. Split it:
  //    - Handyman: $120 (100% service fee)
  //    - Cofounder: $2.50 (50% platform fee)
  //    - Operator: $2.50 (50% platform fee)
  // 3. Transfer to all 3 accounts
  // 4. Update Firestore with transfer IDs
};
```

---

## 📝 Key Takeaways

1. **Escrow = `capture_method: 'manual'`** in the payment intent
2. **Profit split = `calculateSplits()`** helper function
3. **Release = `releaseEscrowAndSplit()`** endpoint (you call this from frontend)
4. **Auto-release** = Not implemented yet, needs Cloud Scheduler
5. **Everything is in** `/functions/index.js` (one file for all Stripe logic)

---

## 🤔 Common Confusion

**Q: Where's the "check job status" logic?**
**A:** It doesn't exist yet in the backend. Currently, YOU (the frontend) need to decide when to call `releaseEscrowAndSplit`. The function doesn't check job status - it just releases payment when called.

**Q: Where's the "3 working days" countdown?**
**A:** Not implemented yet. You'd need a Cloud Scheduler function that runs daily and checks for old completed jobs.

**Q: How does the escrow "hold" the money?**
**A:** The line `capture_method: 'manual'` tells Stripe: "Authorize this card but don't charge it yet. I'll tell you when to charge it."

---

Hope this clears things up! Let me know if you want me to implement the auto-release scheduler.
