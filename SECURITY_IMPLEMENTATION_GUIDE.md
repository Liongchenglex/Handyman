# Security Implementation Guide - Handyman-FRESH

**Status:** ✅ Working Dev Server | ⏳ Security Partially Applied
**Date:** January 19, 2026
**Branch:** master (in Handyman-FRESH folder)

---

## 🎉 VICTORY: Dev Server Works!

**Root Cause Fixed:**
- OLD package-lock.json (from December 2025) works with Node 21
- NEW package-lock.json (from January 2026) breaks with Node 21
- Solution: Keep the old package-lock.json from GitHub

**How to Start Server:**
```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman-FRESH
npm start
```

Server will start normally in 20-30 seconds!

---

## ✅ Security Fixes Applied So Far

### Phase 0.1: CORS Protection ✅
**File:** `functions/index.js` (lines 12-36)
**What:** Whitelisted only approved origins
**Blocks:** Unauthorized cross-origin requests

### Phase 0.4: Authentication Framework ✅
**File:** `functions/index.js` (lines 74-103)
**What:** Added `verifyAuthToken()` helper function
**Purpose:** Validates Firebase ID tokens

### Phase 0.4: Auth on createConnectedAccount ✅
**File:** `functions/index.js` (lines 121-134)
**What:** Added authentication + authorization check
**Prevents:** Users creating Stripe accounts for others

---

## 📋 Remaining Security Work

### Phase 0.4: Auth on 2 More Endpoints ⏳

#### 1. createPaymentIntent
**Location:** Find `exports.createPaymentIntent` in functions/index.js

**Add after line "if (req.method !== 'POST')...":**
```javascript
// SECURITY FIX (Phase 0.4): Verify authentication
const decodedToken = await verifyAuthToken(req);

// Later, after getting customerId from req.body, add:
// SECURITY FIX (Phase 0.4): Verify user owns this transaction
if (decodedToken.uid !== customerId) {
  console.warn(`🚫 Authorization failed: User ${decodedToken.uid} tried to create payment for customer ${customerId}`);
  return res.status(403).json({ error: 'Forbidden: Cannot create payment for another user' });
}
```

#### 2. releaseEscrowAndSplit
**Location:** Find `exports.releaseEscrowAndSplit` in functions/index.js

**Add authentication check at the start of try block**

---

### Phase 1.1: Auth on 6 More Endpoints ⏳

Apply `verifyAuthToken(req)` to:
1. `createAccountLink`
2. `getAccountStatus`
3. `createLoginLink`
4. `confirmPayment`
5. `getPaymentStatus`
6. `refundPayment`

---

### Phase 1.2: Input Validation with Joi ⏳

**Step 1: Install Joi**
```bash
cd functions
npm install joi
```

**Step 2: Create validation files**

Create `functions/validation/schemas.js`:
```javascript
const Joi = require('joi');

exports.paymentIntentSchema = Joi.object({
  jobId: Joi.string().required().min(10).max(100),
  customerId: Joi.string().required().min(10).max(100),
  serviceFee: Joi.number().required().min(20).max(10000),
  serviceType: Joi.string().required().min(3).max(100),
  customerEmail: Joi.string().email().allow(null, '')
}).strict();

exports.connectedAccountSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().required().min(2).max(100),
  phone: Joi.string().pattern(/^\+65[0-9]{8}$/).allow(null, ''),
  uid: Joi.string().required().min(10).max(100)
}).strict();
```

Create `functions/validation/middleware.js`:
```javascript
const validate = (schema) => {
  return (data) => {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }

    return value;
  };
};

module.exports = { validate };
```

**Step 3: Apply validation**

In `functions/index.js`, add at top:
```javascript
const { validate } = require('./validation/middleware');
const { paymentIntentSchema, connectedAccountSchema } = require('./validation/schemas');
```

Then in each endpoint:
```javascript
const validatedData = validate(paymentIntentSchema)(req.body);
const { jobId, customerId, serviceFee } = validatedData;
```

---

### Phase 1.4: Server-Side Fee Calculation ✅

**Status:** ALREADY IMPLEMENTED!
**Location:** `functions/index.js` - look for `getPlatformFeePercentage()` and `calculatePlatformFee()`

Server already calculates fees - just needs verification during testing.

---

## 🧪 Testing Checklist

After applying all fixes:

```bash
# 1. Deploy functions
firebase deploy --only functions

# 2. Test authentication
curl -X POST https://us-central1-eazydone-d06cf.cloudfunctions.net/createPaymentIntent
# Should get: 401 Unauthorized

# 3. Test with valid auth (in browser console at localhost:3000)
const auth = (await import('firebase/auth')).getAuth();
const token = await auth.currentUser.getIdToken();
fetch('https://us-central1-eazydone-d06cf.cloudfunctions.net/createPaymentIntent', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jobId: 'test_' + Date.now(),
    customerId: auth.currentUser.uid,
    serviceFee: 100,
    serviceType: 'plumbing'
  })
}).then(r => r.json()).then(console.log);
# Should succeed
```

---

## 📁 Reference Documents

All detailed implementation guides are in your old `/Handyman` folder:

- `PHASE_0_SUMMARY.md` - Phase 0 complete guide
- `TASK_1.2_SUMMARY.md` - Input validation guide (9 test scenarios)
- `TASK_1.3_SUMMARY.md` - JWT approval system
- `TASK_1.4_SUMMARY.md` - Fee validation
- `TESTING_COMPLETE_SUMMARY.md` - All test cases

---

## 🚀 Quick Commands

### Start Development
```bash
cd /Users/liongchenglex/Desktop/AI_Projects/Handyman-FRESH
npm start
```

### Deploy Functions
```bash
firebase deploy --only functions
```

### Check Git Status
```bash
git status
git log --oneline -5
```

### Commit Progress
```bash
git add -A
git commit -m "security: Phase [X] - [description]"
```

---

## ⚠️ IMPORTANT: Don't Break package-lock.json!

**DO NOT run these commands:**
- ❌ `npm install [new-package]` - This updates package-lock.json
- ❌ `npm update` - This breaks everything
- ❌ `npm audit fix` - This updates dependencies

**If you need to add a package:**
1. Add it to `package.json` manually
2. Delete `node_modules`
3. Run `npm install` (uses existing package-lock.json)

**If package-lock.json gets updated by accident:**
```bash
git checkout HEAD -- package-lock.json
rm -rf node_modules
npm install
```

---

## 🎯 Your Next Steps

1. ✅ **Server is working** - Take a break!
2. ⏳ **Continue security fixes** - Follow guide above
3. ⏳ **Test each change** - Deploy and verify
4. ⏳ **Commit progress** - Small commits for each fix

---

## 📊 Progress Tracker

- [x] Dev server working
- [x] Phase 0.1: CORS fixes
- [x] Phase 0.4: Auth framework
- [x] Phase 0.4: Auth on createConnectedAccount
- [ ] Phase 0.4: Auth on createPaymentIntent
- [ ] Phase 0.4: Auth on releaseEscrowAndSplit
- [ ] Phase 1.1: Auth on 6 endpoints
- [ ] Phase 1.2: Joi validation
- [ ] Phase 1.4: Verify fee calculation
- [ ] Full testing
- [ ] Deploy to production

---

**You've got this! The hard part (fixing the dev server) is DONE.** 🎉

The security fixes are straightforward - just follow the patterns shown above.
