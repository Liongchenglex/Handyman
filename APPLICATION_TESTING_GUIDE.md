# Application Testing Guide - Stripe Payment Integration

## ✅ Phase 1: Payment Intent Creation & Escrow (CURRENT)

This guide walks you through testing the first phase of Stripe integration - creating a payment intent and verifying funds are held in escrow.

---

## 🎯 Test Case 1: Create Payment Intent with Escrow

### What This Tests:
- Payment intent is created in Stripe
- Funds are authorized (held in escrow) but NOT charged
- Payment shows as "requires_payment_method" status in Stripe
- Payment data is logged to console

### Endpoint Used:
`createPaymentIntent` → `https://us-central1-eazydone-d06cf.cloudfunctions.net/createPaymentIntent`

---

## 📋 Testing Steps

### Step 1: Start Your Application

```bash
npm start
```

### Step 2: Navigate to Job Request Form

1. Open your app at `http://localhost:3000`
2. Click "Request a Service" or navigate to job request form
3. Fill in customer details:
   - Name: Test Customer
   - Email: test@example.com
   - Phone: +6591234567

### Step 3: Select Service and Proceed

1. Select a service type (e.g., **Plumbing**)
2. Fill in job description and details
3. Select preferred date/time
4. Click "Continue to Payment"

### Step 4: Verify Payment Summary

On the payment page, verify:
- ✅ Service Fee is displayed correctly (e.g., Plumbing = $120)
- ✅ Platform Fee shows **10%** of service fee (e.g., $12.00)
- ✅ Total = Service Fee + Platform Fee (e.g., $132.00)
- ✅ Only **Card** payment method is shown

**Example for Plumbing:**
```
Service Fee (Plumbing): $120.00
Platform Fee (10%):     $12.00
─────────────────────────────
Total:                  $132.00
```

### Step 5: Open Browser Console

1. Open Developer Tools (F12 or Right-click → Inspect)
2. Go to **Console** tab
3. Keep it open to monitor logs

### Step 6: Click "Confirm & Pay"

Click the payment button and watch the console output.

### Expected Console Output:

```
🎯 Creating payment intent with escrow...
Service Fee: 120
Platform Fee (10%): 12
Total Amount: 132

✅ Payment intent created successfully!
Payment Intent ID: pi_3SRoLrPCPLQMMg7202Pon2qh
Client Secret: pi_3SRoLrPCPLQMMg7202Pon2q...
Status: requires_payment_method
Amount: 132 SGD
```

---

## ✅ Verification Checklist

### In Browser Console:
- [ ] Payment intent ID starts with `pi_`
- [ ] Client secret is returned (truncated in log)
- [ ] Status is `requires_payment_method`
- [ ] Amount matches service fee + platform fee
- [ ] Currency is SGD
- [ ] No errors in console

### In Stripe Dashboard:

1. Go to https://dashboard.stripe.com/test/payments
2. Look for the most recent payment
3. Verify:
   - [ ] Payment Intent ID matches console log
   - [ ] Amount is correct (in cents: $132 = 13200 cents)
   - [ ] Status shows **"Requires payment method"** or **"Incomplete"**
   - [ ] Description shows service type (e.g., "Plumbing service - Job #temp_job_...")
   - [ ] **Capture method**: Manual (this is the escrow!)
   - [ ] Metadata includes:
     - jobId
     - customerId
     - handymanId
     - serviceFee
     - platformFee
     - serviceType

### Visual Verification in Stripe:

<img width="800" alt="Stripe Payment Intent" src="docs/stripe-payment-intent-example.png">

Look for:
- 💳 **Manual capture** badge (indicates escrow)
- ⏳ **Incomplete** or **Requires payment method** status
- 📊 Amount breakdown in metadata

---

## 🧪 Test Different Service Types

Test with multiple service types to verify 10% platform fee calculation:

| Service Type | Service Fee | Platform Fee (10%) | Total |
|--------------|-------------|-------------------|--------|
| Plumbing | $120 | $12.00 | $132.00 |
| Electrical | $150 | $15.00 | $165.00 |
| Carpentry | $180 | $18.00 | $198.00 |
| Appliance Repair | $100 | $10.00 | $110.00 |
| Painting | $200 | $20.00 | $220.00 |
| General handyman | $100 | $10.00 | $110.00 |

**For each service:**
1. Select service type
2. Proceed to payment
3. Verify calculations in UI
4. Click "Confirm & Pay"
5. Check console output
6. Verify in Stripe Dashboard

---

## ❓ Common Issues & Troubleshooting

### Issue 1: "Failed to create payment intent"

**Symptoms**: Error in console, payment doesn't create

**Possible Causes:**
- Firebase Functions not deployed
- Stripe API keys not configured
- Network error

**Solution:**
```bash
# Check if functions are deployed
firebase functions:list

# View function logs
firebase functions:log --only createPaymentIntent

# Verify environment variables
firebase functions:config:get
```

### Issue 2: Platform fee is $5 instead of 10%

**Symptoms**: Platform fee shows as flat $5

**Solution**: Clear cache and restart:
```bash
npm start
```

Verify `servicePricing.js` has:
```javascript
export const PLATFORM_FEE_PERCENTAGE = 0.10;
export const getPlatformFee = (serviceTypeOrPrice) => {
  // ...
  return servicePrice * PLATFORM_FEE_PERCENTAGE;
};
```

### Issue 3: Payment shows "succeeded" instead of "requires_payment_method"

**Symptoms**: Payment is charged immediately, not held in escrow

**Solution**: Verify in `functions/index.js`:
```javascript
capture_method: 'manual'  // Must be 'manual' for escrow
```

### Issue 4: Firestore error "No document to update"

**Symptoms**: Error in function logs about missing job document

**This is expected!** The function tries to update a job document that doesn't exist yet. We're using temporary IDs for testing. This will be fixed when we integrate the full flow.

**Workaround**: Ignore this error for now. The payment intent is still created successfully in Stripe.

---

## 📊 Understanding the Escrow Flow

### What Happens When You Click "Confirm & Pay":

```
1. Frontend calls createPaymentIntent API
   ↓
2. Firebase Function creates Stripe Payment Intent
   - capture_method: 'manual' ← This is the escrow!
   - Status: 'requires_payment_method'
   ↓
3. Stripe AUTHORIZES card but does NOT charge
   - Funds are "held" on customer's card
   - Customer sees pending charge
   ↓
4. Payment Intent ID returned to frontend
   - Saved in console for testing
   - Will be saved to Firestore in full flow
```

### What "Manual Capture" Means:

- **Authorization**: Stripe checks if card has funds and reserves them
- **Not Charged**: Money is NOT taken from customer yet
- **Held in Escrow**: Stripe holds the authorization for up to 7 days
- **You decide when to capture**: You call `releaseEscrowAndSplit` to actually charge the card

---

## 📝 What's Next (NOT in this test)

### ⏳ TODO - Future Integration Steps:

1. **Escrow Release on Status Change** ❌ NOT IMPLEMENTED
   - When job status → "completed", release payment
   - Split payment 10/10/80 to handyman/you/cofounder

2. **Auto-Release After 3 Days** ❌ NOT IMPLEMENTED
   - If customer doesn't confirm after 3 days
   - Automatically release payment

3. **Handyman Onboarding** ❌ NOT IMPLEMENTED
   - Create Stripe Connect account for handyman
   - Generate onboarding link
   - Verify handyman completed onboarding

4. **Full Payment Flow** ❌ NOT IMPLEMENTED
   - Collect actual card details with Stripe Elements
   - Complete 3D Secure authentication
   - Confirm payment

---

## ✅ Success Criteria

You have successfully completed Phase 1 testing if:

- [x] Payment intent is created in Stripe
- [x] Payment Intent ID is logged to console
- [x] Status is "requires_payment_method"
- [x] Amount is correct (service fee + 10% platform fee)
- [x] Manual capture is enabled (escrow)
- [x] Payment appears in Stripe Dashboard
- [x] No critical errors in console or function logs

---

## 🎉 Phase 1 Complete!

Once all tests pass, you're ready to move to Phase 2:
- Integrate Stripe Elements for card collection
- Complete payment flow with 3D Secure
- Test actual card transactions

---

**Last Updated**: 2025-11-10
**Phase**: 1 - Payment Intent Creation
**Status**: Testing
