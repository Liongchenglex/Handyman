# Platform Fee Configuration Guide

## Overview

The platform fee is now **fully configurable as a percentage** of the service fee. You can easily change it to 5%, 10%, 15%, or any percentage you want without modifying code.

---

## How It Works

### Frontend Configuration

**File:** `.env.local`

```env
# Set platform fee as decimal (0.10 = 10%)
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.10
```

**Examples:**
- `0.05` = 5% fee
- `0.10` = 10% fee (default)
- `0.15` = 15% fee
- `0.08` = 8% fee

### Backend Configuration

**Set via Firebase CLI:**

```bash
# Set platform fee percentage (10%)
firebase functions:config:set platform.fee_percentage="0.10"

# View current configuration
firebase functions:config:get

# Deploy functions to apply changes
firebase deploy --only functions
```

---

## Calculation Examples

### Example 1: 10% Platform Fee (Default)

```
Service Fee: $120 (Plumbing)
Platform Fee: $120 × 0.10 = $12
Total Charged to Customer: $132

Split After Job Completion:
├─ Handyman: $120 (100% of service fee)
├─ Cofounder: $6 (50% of platform fee)
└─ Operator: $6 (50% of platform fee)
```

### Example 2: 5% Platform Fee

```
Service Fee: $120 (Plumbing)
Platform Fee: $120 × 0.05 = $6
Total Charged to Customer: $126

Split After Job Completion:
├─ Handyman: $120 (100% of service fee)
├─ Cofounder: $3 (50% of platform fee)
└─ Operator: $3 (50% of platform fee)
```

### Example 3: 15% Platform Fee

```
Service Fee: $120 (Plumbing)
Platform Fee: $120 × 0.15 = $18
Total Charged to Customer: $138

Split After Job Completion:
├─ Handyman: $120 (100% of service fee)
├─ Cofounder: $9 (50% of platform fee)
└─ Operator: $9 (50% of platform fee)
```

---

## Changing the Platform Fee

### Development Environment

1. **Update `.env.local`:**
   ```env
   REACT_APP_PLATFORM_FEE_PERCENTAGE=0.08  # Change to 8%
   ```

2. **Restart dev server:**
   ```bash
   npm start
   ```

3. **Test the change:**
   - Create a job request
   - Check that total displays correctly
   - Verify payment intent shows correct amount

### Production Environment

1. **Update frontend environment:**
   ```env
   REACT_APP_PLATFORM_FEE_PERCENTAGE=0.08
   ```

2. **Build and deploy:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

3. **Update backend configuration:**
   ```bash
   firebase functions:config:set platform.fee_percentage="0.08"
   firebase deploy --only functions
   ```

4. **Verify:**
   - Test job creation in production
   - Check Firebase Functions logs
   - Verify payment amounts are correct

---

## Important: Frontend & Backend Must Match

**⚠️ CRITICAL:** The frontend and backend must use the **same percentage** to avoid payment mismatches.

**Frontend:** `.env.local`
```env
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.10
```

**Backend:** Firebase Functions Config
```bash
firebase functions:config:set platform.fee_percentage="0.10"
```

**If they don't match:**
- Frontend shows: $132 total (10% fee)
- Backend charges: $126 (5% fee)
- ❌ Payment fails or customer overcharged/undercharged

---

## Verification Checklist

After changing the platform fee:

- [ ] Updated frontend `.env.local`
- [ ] Restarted dev server
- [ ] Updated backend Firebase config
- [ ] Deployed functions
- [ ] Tested job creation
- [ ] Verified total amount in UI
- [ ] Verified payment intent amount
- [ ] Checked Firebase logs for correct calculation
- [ ] Tested in both dev and production

---

## Code Reference

### Frontend Calculation

**File:** `src/config/servicePricing.js`

```javascript
// Reads from environment variable
export const PLATFORM_FEE_PERCENTAGE = parseFloat(
  process.env.REACT_APP_PLATFORM_FEE_PERCENTAGE
) || 0.10;

// Calculates fee
export const getPlatformFee = (servicePrice) => {
  return servicePrice * PLATFORM_FEE_PERCENTAGE;
};
```

### Backend Calculation

**File:** `functions/index.js`

```javascript
// Reads from Firebase Functions config
const getPlatformFeePercentage = () => {
  const configPercentage = functions.config().platform?.fee_percentage;
  if (configPercentage) {
    const percentage = parseFloat(configPercentage);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 1) {
      return percentage;
    }
  }
  return 0.10; // Default 10%
};

// Calculates fee
const calculatePlatformFee = (serviceFee) => {
  return serviceFee * getPlatformFeePercentage();
};
```

---

## Monitoring

### Check Current Configuration

**Frontend:**
```bash
# In browser console (while app is running)
import { PLATFORM_FEE_PERCENTAGE } from './config/servicePricing';
console.log('Platform Fee:', PLATFORM_FEE_PERCENTAGE * 100 + '%');
```

**Backend:**
```bash
# View Firebase Functions config
firebase functions:config:get

# Check logs during payment creation
firebase functions:log --only createPaymentIntent
```

### Log Messages

When creating a payment, you'll see:

```
Creating payment intent for job: job_abc123
Service Fee: $120, Platform Fee: $12 (10%), Total: $132
```

The percentage is logged so you can verify it's correct.

---

## Different Fees for Different Markets

If you want different fees for different regions or service types in the future:

### Option A: Multiple Environments

```bash
# Singapore: 10%
firebase use singapore
firebase functions:config:set platform.fee_percentage="0.10"

# Malaysia: 8%
firebase use malaysia
firebase functions:config:set platform.fee_percentage="0.08"
```

### Option B: Dynamic Calculation (Future Enhancement)

Store fee percentage in Firestore config:

```javascript
// In Firestore: /config/platform
{
  defaultFeePercentage: 0.10,
  regionFees: {
    SG: 0.10,
    MY: 0.08,
    TH: 0.07
  }
}
```

---

## FAQ

### Q: What if I don't set the environment variable?

**A:** It defaults to 10% (0.10).

### Q: Can I use a flat fee instead of percentage?

**A:** The current implementation uses percentage-based fees. For flat fees, you would need to modify the code. However, percentage-based is more fair as it scales with service cost.

### Q: Can different services have different platform fees?

**A:** Not currently. All services use the same percentage. This can be implemented as a future enhancement.

### Q: How do I test different percentages locally?

**A:**
1. Change `REACT_APP_PLATFORM_FEE_PERCENTAGE` in `.env.local`
2. Restart dev server
3. Test in browser
4. No need to deploy to Firebase

### Q: What's the maximum percentage I can set?

**A:** Technically up to 100% (1.0), but practically you'll want to keep it reasonable (5-20%).

---

## Quick Reference

### Set to 5%
```bash
# Frontend
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.05

# Backend
firebase functions:config:set platform.fee_percentage="0.05"
```

### Set to 10% (default)
```bash
# Frontend
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.10

# Backend
firebase functions:config:set platform.fee_percentage="0.10"
```

### Set to 15%
```bash
# Frontend
REACT_APP_PLATFORM_FEE_PERCENTAGE=0.15

# Backend
firebase functions:config:set platform.fee_percentage="0.15"
```

---

**Last Updated:** 2025-12-11
**Status:** ✅ Fully Configurable
