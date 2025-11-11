# Phase 2 Testing Guide - Card Collection & Escrow

## 🎯 What Was Implemented

### Phase 2 Goal: Get payment from "Incomplete" to "Uncaptured" (Escrow)

**Before Phase 2**:
- Status: "Incomplete" (`requires_payment_method`)
- Money held: ❌ No

**After Phase 2**:
- Status: "Uncaptured" (`requires_capture`)
- Money held: ✅ **YES - In Escrow!**

---

## 📦 What's New

### 1. **StripeCardForm Component** ✨
**File**: `/src/components/customer/StripeCardForm.jsx`

**Features**:
- Secure card collection with Stripe Elements
- Automatic 3D Secure (SCA) authentication
- Real-time card validation
- Beautiful UI with error handling
- Test card information display

### 2. **Updated PaymentForm** 🔄
**File**: `/src/components/customer/PaymentForm.jsx`

**Changes**:
- Loads Stripe.js with publishable key
- Creates payment intent automatically on mount
- Shows card form with Stripe Elements
- Handles card confirmation and 3D Secure
- Updates job with payment status after confirmation

---

## 🧪 Testing Steps

### Prerequisites:
```bash
# Make sure your app is running
npm start
```

### Step 1: Fill Out Job Request Form

1. Open http://localhost:3000
2. Navigate to "Request a Service"
3. Fill in customer details:
   - Name: Test Customer
   - Email: test@example.com
   - Phone: +6591234567
   - Address: Any Singapore address
4. Select service type: **Plumbing** ($120)
5. Fill in job description
6. Click "Continue to Review"

### Step 2: Review and Proceed

1. Review your job details
2. Click "Continue to Payment"
3. **Wait for job creation** - You should see:
   ```
   Console: Creating job in Firestore before payment...
   Console: Job created successfully with ID: {real_job_id}
   ```
4. Payment page loads automatically

### Step 3: Wait for Payment Intent Creation

The payment form will:
1. Show "Initializing secure payment..." loading state
2. Create payment intent with escrow (manual capture)
3. Load Stripe card form

**Console output**:
```
🎯 Creating payment intent with escrow...
Service Fee: 120
Platform Fee (10%): 12
Total Amount: 132
Job ID: {real_job_id}
✅ Payment intent created successfully!
Payment Intent ID: pi_xxxxx
Status: requires_payment_method
```

### Step 4: Enter Card Details

You'll see the Stripe card form with:
- Card number field
- Expiry date field
- CVC field
- Postal code field

**Important Test Cards**:

| Card Number | Description | Expected Result |
|-------------|-------------|-----------------|
| `4242 4242 4242 4242` | Standard success | Authorizes immediately |
| `4000 0027 6000 3184` | 3D Secure required | Shows authentication popup |
| `4000 0000 0000 0002` | Card declined | Shows decline error |
| `4000 0000 0000 9995` | Insufficient funds | Shows error |

**Card details**:
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- Postal code: Any valid code (e.g., 12345)

---

## 🎴 Test Case 1: Standard Card (No 3D Secure)

### Card: `4242 4242 4242 4242`

**Steps**:
1. Enter card: `4242 4242 4242 4242`
2. Expiry: `12/25`
3. CVC: `123`
4. Postal: `12345`
5. Click "Authorize Payment ($132.00)"

**Expected Console Output**:
```
🎯 Confirming payment with card...
Client Secret: pi_xxxxx_secret_xxxxx...
✅ Payment confirmed successfully!
Payment Intent: {paymentIntent object}
Status: requires_capture
💰 Payment authorized - Funds held in escrow!
💳 Card payment confirmed!
Payment Intent Status: requires_capture
```

**Expected Result**:
- ✅ Payment authorizes immediately (no popup)
- ✅ Redirects to confirmation screen
- ✅ Shows success message

**Verify in Stripe Dashboard**:
1. Go to https://dashboard.stripe.com/test/payments
2. Find the payment (sort by newest)
3. **Status**: "Uncaptured" ✅
4. **Amount**: $132.00 (13200 cents)
5. **Capture method**: Manual ✅
6. **Description**: "Plumbing service - Job #{jobId}"

**Verify in Firestore**:

**Job Document** (`jobs/{jobId}`):
```javascript
{
  paymentIntentId: "pi_xxxxx",
  paymentStatus: "pending",
  status: "pending"
}
```

**Payment Document** (`payments/{paymentId}`):
```javascript
{
  jobId: "{real_job_id}",
  paymentIntentId: "pi_xxxxx",
  status: "requires_capture", // ← Changed from requires_payment_method!
  amount: 132,
  clientSecret: "pi_xxxxx_secret_xxxxx"
}
```

---

## 🔐 Test Case 2: 3D Secure Authentication

### Card: `4000 0027 6000 3184`

**Steps**:
1. Enter card: `4000 0027 6000 3184`
2. Expiry: `12/25`
3. CVC: `123`
4. Postal: `12345`
5. Click "Authorize Payment ($132.00)"
6. **3D Secure popup appears!** 🎉
7. Click "Complete authentication"

**Expected Flow**:
1. Card form submits
2. Stripe shows 3D Secure authentication modal
3. Modal has "Complete authentication" button
4. Click button to complete
5. Modal closes
6. Payment authorizes
7. Redirects to confirmation

**Expected Console Output**:
```
🎯 Confirming payment with card...
[3D Secure authentication modal appears]
[User clicks "Complete authentication"]
✅ Payment confirmed successfully!
Status: requires_capture
💰 Payment authorized - Funds held in escrow!
```

**Expected Result**:
- ✅ 3D Secure popup appears
- ✅ After completing, payment authorizes
- ✅ Stripe status: "Uncaptured"
- ✅ Funds held in escrow

---

## ❌ Test Case 3: Declined Card

### Card: `4000 0000 0000 0002`

**Steps**:
1. Enter card: `4000 0000 0000 0002`
2. Expiry: `12/25`
3. CVC: `123`
4. Postal: `12345`
5. Click "Authorize Payment ($132.00)"

**Expected Console Output**:
```
🎯 Confirming payment with card...
❌ Payment confirmation error: Your card was declined.
```

**Expected Result**:
- ❌ Error message displays: "Your card was declined."
- ❌ Payment does NOT authorize
- ❌ User stays on payment page
- ❌ Can try different card

**Verify in Stripe Dashboard**:
- Payment shows as "Failed"
- Status: "Incomplete" or "Failed"

---

## 🎯 Success Criteria Checklist

### Payment Authorization:
- [ ] Card form loads and displays correctly
- [ ] Card validation works (shows errors for invalid cards)
- [ ] Standard card authorizes immediately
- [ ] 3D Secure card shows authentication popup
- [ ] Declined card shows error message
- [ ] Console logs show correct flow

### Stripe Dashboard:
- [ ] Payment appears with status "Uncaptured" ✅
- [ ] Amount is correct ($132 = 13200 cents)
- [ ] Capture method is "Manual" ✅
- [ ] Metadata includes real job ID (not temp_job_xxxxx)
- [ ] Customer email is populated
- [ ] Service type is in description

### Firestore Data:
- [ ] Job document has `paymentIntentId` populated
- [ ] Job `paymentStatus` is "pending" (not "completed")
- [ ] Payment document `status` is "requires_capture" ✅
- [ ] Payment document has `clientSecret`
- [ ] Payment `jobId` matches job document ID

### User Experience:
- [ ] Loading states show during payment intent creation
- [ ] Card form is styled and matches your app theme
- [ ] Error messages are clear and helpful
- [ ] Success flow redirects to confirmation page
- [ ] Test card information is visible for testing

---

## 🎨 UI/UX Features

### Security Indicators:
- 🔒 **Secure Payment** badge with lock icon
- 🛡️ **Payment Protection (Escrow)** notice
- Stripe-powered card form (trusted UI)

### User-Friendly Elements:
- Real-time card validation
- Clear error messages
- Amount display ($132.00)
- Test cards information (test mode)
- Escrow explanation

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: "Stripe.js has not loaded yet"

**Symptoms**: Error in console, card form doesn't show

**Solution**:
```javascript
// Check that REACT_APP_STRIPE_PUBLISHABLE_KEY is set in .env.local
console.log(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
```

Should output: `pk_test_xxxxx`

If undefined, add to `.env.local`:
```
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Issue 2: 3D Secure Popup Not Appearing

**Symptoms**: Using 3D Secure test card but no popup

**Solution**:
- Make sure you're using `4000 0027 6000 3184` (with spaces)
- Check browser console for errors
- Try in incognito mode (extensions may block popups)
- Verify Stripe Elements loaded correctly

### Issue 3: Payment Still Shows "Incomplete" in Stripe

**Symptoms**: Payment authorized but shows as Incomplete

**Possible Causes**:
- Card confirmation didn't complete
- Check console for errors during `stripe.confirmCardPayment`
- Verify clientSecret is correct

**Solution**: Check console output. Should see:
```
✅ Payment confirmed successfully!
Status: requires_capture
```

### Issue 4: Job Not Found Error

**Symptoms**: Error creating payment intent

**Solution**: Make sure job is created BEFORE payment form loads. Check:
```javascript
// JobRequestForm.jsx should create job first
const createdJob = await createJob(jobDataWithUser);
setCreatedJobId(createdJob.id); // ← Must be set

// Then PaymentForm uses createdJobId
<PaymentForm jobId={createdJobId} ... />
```

---

## 📊 Status Progression Tracking

Track the payment status changes:

| Step | Stripe Dashboard | Stripe API | `payments.status` | `jobs.paymentStatus` |
|------|------------------|------------|------------------|---------------------|
| **Before Phase 2** | Incomplete | `requires_payment_method` | `requires_payment_method` | `pending` |
| **After entering card** | Incomplete | `requires_confirmation` | `requires_confirmation` | `pending` |
| **After 3D Secure** | Incomplete | `requires_action` | `requires_action` | `pending` |
| **After authorization** ✅ | **Uncaptured** | **`requires_capture`** | **`requires_capture`** | `pending` |

**You've reached the goal when**:
- Stripe Dashboard shows "Uncaptured"
- `payments.status` is `requires_capture`
- Money is held on customer's card (authorized but not charged)

---

## 🎉 You've Completed Phase 2 When:

✅ Card form loads with Stripe Elements
✅ Can enter card details securely
✅ 3D Secure authentication works (test with 4000 0027 6000 3184)
✅ Payment authorizes successfully
✅ Stripe Dashboard shows "Uncaptured"
✅ Firestore payment status is `requires_capture`
✅ Money is held in escrow (not charged yet)

---

## 🚀 What's Next: Phase 3

Phase 3 will implement:
1. **Escrow Release on Job Completion**
   - When customer confirms job is done
   - Call `releaseEscrowAndSplit` endpoint
   - Split payment 50/50 platform fee, 100% service fee to handyman

2. **Auto-Release After 3 Days**
   - If customer doesn't confirm within 3 days
   - Automatically release payment
   - Cloud Scheduler function

3. **Handyman Onboarding**
   - Create Stripe Connect account
   - Generate onboarding link
   - Verify handyman completed setup

---

## 📝 Test Results Log

Document your test results:

**Date**: ___________

**Test Card 4242 4242 4242 4242**:
- [ ] Payment authorized
- [ ] Status: Uncaptured
- [ ] Firestore updated correctly

**Test Card 4000 0027 6000 3184 (3D Secure)**:
- [ ] 3D Secure popup appeared
- [ ] Payment authorized after auth
- [ ] Status: Uncaptured

**Test Card 4000 0000 0000 0002 (Declined)**:
- [ ] Error message displayed
- [ ] Payment NOT authorized
- [ ] User can retry

**Notes**:
_______________________________________
_______________________________________
_______________________________________

---

**Last Updated**: 2025-11-11
**Phase**: 2 - Card Collection & Escrow
**Status**: ✅ Ready for Testing
