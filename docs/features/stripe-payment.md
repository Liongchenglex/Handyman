# Stripe Payment Integration

## Overview

Stripe payment system with manual-capture escrow and Stripe Connect (Express) payouts to handymen. Funds are authorized at booking, held until an admin releases the escrow, then split between the handyman and the platform (Stripe processing fee absorbed proportionally on both sides).

Currency: **SGD**. Country: **SG**.

---

## Current Implementation Status

| Capability | Status | Source |
|---|---|---|
| Payment intent creation with manual-capture escrow | Implemented | `functions/index.js:480` (`createPaymentIntent`) |
| Stripe Elements card collection + 3D Secure | Implemented | `src/components/customer/StripeCardForm.jsx` |
| Customer-facing fee breakdown | Implemented | `src/components/customer/PaymentForm.jsx:29` |
| Admin escrow release + transfer to handyman | Implemented | `functions/index.js:867` (`releaseEscrowSimple`) |
| Refunds | Implemented | `functions/index.js:1055` (`refundPayment`) |
| Stripe webhooks | Implemented | `functions/index.js:1146` (`stripeWebhook`) |
| Stripe Connect Express onboarding for handymen | Implemented | `functions/index.js:197` (`createConnectedAccount`) |
| 3-way split (cofounder / operator / handyman) | **Not active** — original `releaseEscrowAndSplit` is commented out (commit `bdde2bc`); platform fee is retained in the platform Stripe balance and split manually outside the app | `functions/index.js:787-854` |

---

## Pricing & Fee Structure

### Inputs

- **Service fee** — looked up per service type in `src/config/servicePricing.js:11`:

  | Service | Service fee (SGD) |
  |---|---|
  | Plumbing | 120 |
  | Electrical | 150 |
  | Carpentry | 180 |
  | Appliance Repair | 100 |
  | Painting | 200 |
  | General handyman | 100 |

- **Platform fee percentage** — default `0.10` (10%) at `src/config/servicePricing.js:23` and `functions/index.js:151`. Backend value is overridable via Firebase config:
  ```bash
  firebase functions:config:set platform.fee_percentage="0.10"
  ```

### Formulas

What the customer is charged (computed on both frontend and in `createPaymentIntent`):

```
platformFee  = serviceFee × platformFeePercentage
totalCharged = serviceFee + platformFee
```
> Source: `src/config/servicePricing.js:39-55`, `functions/index.js:507-511`.

What gets transferred when escrow is released (`releaseEscrowSimple`, lines 931-972):

```
// 1. Reverse-calc the original service/platform fee from the stored total.
totalAmount  = job.estimatedBudget                     // = totalCharged
serviceFee   = totalAmount / (1 + platformFeePercentage)
platformFee  = totalAmount − serviceFee

// 2. Capture the payment, then pull the *actual* Stripe processing fee
//    from the BalanceTransaction (real value, not estimated).
netAmount    = totalAmount − stripeFee                 // what landed in our Stripe balance

// 3. Re-split from the NET amount using the same ratio.
//    This means the Stripe fee is shared proportionally between handyman and platform.
platformFeeFromNet = netAmount × platformFeePercentage / (1 + platformFeePercentage)
handymanPayout     = netAmount − platformFeeFromNet
```

> **Important:** the Stripe fee is **not** absorbed by the platform alone. Because both shares are recomputed from the post-fee `netAmount`, Stripe's fee is split in the same `100 : 10` ratio as the underlying service/platform split — handyman absorbs ~90.9%, platform absorbs ~9.1%.

### Stripe processing fee

The platform does **not** hardcode Stripe's rate. The actual fee is read at release time from `stripe.balanceTransactions.retrieve(charge.balance_transaction).fee` (`functions/index.js:961-965`), so the math is always exact.

For estimation purposes, Stripe's published Singapore card rate at time of writing is roughly **3.4% + S$0.50** for standard local/international cards (see [stripe.com/sg/pricing](https://stripe.com/sg/pricing) for the current rate — verify before quoting to customers). 3DS authentication and currency conversion can add to this.

### Worked example — Plumbing job ($120 service fee, 10% platform fee)

Assuming a Stripe fee of ~$4.99 (3.4% × $132 + $0.50 SGD — illustrative only):

| Step | Amount (SGD) |
|---|---:|
| Service fee | 120.00 |
| Platform fee (10% × 120) | +12.00 |
| **Customer card charged (`totalAmount`)** | **132.00** |
| Stripe processing fee (read from `balanceTransaction`) | −4.99 |
| **Net into platform's Stripe balance** | **127.01** |
| Platform fee retained — `127.01 × 0.10 / 1.10` | 11.55 |
| **Handyman payout — transferred to Connect account** | **115.46** |

Reconciliation: `115.46 + 11.55 = 127.01` ✓

Comparison to the "ideal" split before Stripe takes its cut:

|  | Pre-Stripe ideal | Actual after Stripe fee | Stripe fee absorbed |
|---|---:|---:|---:|
| Handyman | 120.00 | 115.46 | 4.54 (~91%) |
| Platform | 12.00 | 11.55 | 0.45 (~9%) |
| **Total** | **132.00** | **127.01** | **4.99** |

### Worked examples — all service types

Using the same illustrative ~3.4% + S$0.50 Stripe rate. Actual handyman/platform amounts at release will vary based on the real `balanceTransaction.fee`.

| Service | Service fee | Platform fee (10%) | Customer charged | Est. Stripe fee | Est. handyman payout | Est. platform retains |
|---|---:|---:|---:|---:|---:|---:|
| Appliance Repair | 100.00 | 10.00 | 110.00 | 4.24 | 96.15 | 9.61 |
| General handyman | 100.00 | 10.00 | 110.00 | 4.24 | 96.15 | 9.61 |
| Plumbing | 120.00 | 12.00 | 132.00 | 4.99 | 115.46 | 11.55 |
| Electrical | 150.00 | 15.00 | 165.00 | 6.11 | 144.45 | 14.44 |
| Carpentry | 180.00 | 18.00 | 198.00 | 7.23 | 173.43 | 17.34 |
| Painting | 200.00 | 20.00 | 220.00 | 7.98 | 192.75 | 19.27 |

---

## Money flow

```
Customer's card
  │  charge: totalAmount (e.g. $132)  capture_method: manual
  ▼
Stripe holds funds (PaymentIntent: requires_capture)  ← escrow
  │
  │  Admin triggers POST /releaseEscrowSimple { jobId }
  ▼
Stripe captures the charge
  │  Stripe deducts processing fee → net amount lands in platform balance
  ▼
Platform's Stripe balance (gross − stripe fee = net, e.g. $127.01)
  │
  ├── stripe.transfers.create({ destination: handymanAccountId,
  │                             source_transaction: chargeId,
  │                             amount: handymanPayout })
  │   → Handyman's Stripe Express account ($115.46)
  │     → Daily payout to handyman's bank
  │
  └── Remainder ($11.55) stays in platform's Stripe balance
      → Manually distributed off-platform (cofounder / operator)
```

`source_transaction: chargeId` (`functions/index.js:979`) ties the transfer to the originating charge, which lets Stripe release the funds immediately rather than waiting out the standard payout hold.

---

## Payment Status Lifecycle

| Phase | Stripe `PaymentIntent.status` | Firestore `jobs.paymentStatus` | Funds |
|---|---|---|---|
| Intent created | `requires_payment_method` | `pending` | Not held |
| 3DS in progress | `requires_action` | `pending` | Not held |
| Authorized | `requires_capture` | `authorized` | Held in escrow |
| Captured (admin clicked release) | `succeeded` | `captured` (transient) → `released` | In platform Stripe balance, then transferred |
| Refunded | `refunded` | `refunded` | Returned to customer |

> The `refundPayment` flow returns the gross amount to the customer, but Stripe does **not** refund its processing fee. If a refund is issued *after* a transfer to the handyman, the platform may end up out-of-pocket — currently there is no reversal of the handyman transfer in `refundPayment` (`functions/index.js:1055-1136`).

---

## Authorization model

- **`createPaymentIntent`** — caller must be the customer (`decodedToken.uid === customerId`) — `functions/index.js:502`.
- **`confirmPayment`** — customer or assigned handyman.
- **`releaseEscrowSimple`** — admin only. Allowed admin emails are whitelisted at `functions/index.js:103-106` (`verifyAdminAccess`).
- **`refundPayment`** — customer or handyman tied to the payment.

---

## Stripe Connect (handymen)

- Account type: **Express**, country `SG`, capability `transfers` (`functions/index.js:223-245`).
- Payout schedule: **daily** (line 234-238).
- Onboarding URL generated via `createAccountLink`. Status synced to `handymen/{uid}` doc (fields: `stripeConnectedAccountId`, `stripeAccountStatus`, `stripeOnboardingCompleted`, `stripePayoutsEnabled`, `stripeChargesEnabled`).
- Release will fail (HTTP 400) if `charges_enabled` or `payouts_enabled` is false on the connected account (`functions/index.js:923-929`).

---

## Key code references

### Frontend
- `src/config/servicePricing.js:11-55` — service prices, `PLATFORM_FEE_PERCENTAGE`, `getPlatformFee`, `getTotalAmount`.
- `src/components/customer/PaymentForm.jsx:29-31` — fee breakdown shown to customer.
- `src/components/customer/ConfirmationScreen.jsx:24-27` — post-payment summary.
- `src/services/stripe/stripeApi.js` — typed wrappers around the Cloud Functions endpoints.
- `src/pages/AdminFundRelease.jsx:479-504` — admin UI for release; renders `paymentBreakdown` returned by `releaseEscrowSimple`.

### Backend (`functions/index.js`)
- `getPlatformFeePercentage` — line 143
- `calculatePlatformFee` — line 159
- `calculateSplits` — line 172 *(legacy 50/50 cofounder/operator helper — not used by the active release path)*
- `createConnectedAccount` — line 197
- `createAccountLink` — line 292
- `createPaymentIntent` — line 480
- `confirmPayment` — line 644
- `releaseEscrowAndSplit` — line 787 *(commented out — preserved for future multi-party splits, see commit `bdde2bc`)*
- `releaseEscrowSimple` — line 867 *(active release path)*
- `refundPayment` — line 1055
- `stripeWebhook` — line 1146

---

## Firestore schema (payment-relevant fields)

### `jobs/{jobId}`
```js
{
  estimatedBudget: 132,                  // == totalCharged (service + platform fee)
  serviceType: 'Plumbing',
  customerId, handymanId,

  paymentResult: {                       // single source of truth for payment IDs
    paymentIntent: { id: 'pi_...' }      // read by releaseEscrowSimple
  },
  paymentIntentId: 'pi_...',             // also stored at top level
  paymentStatus: 'pending' | 'authorized' | 'captured' | 'released' | 'refunded',

  paymentCreatedAt, paymentReleasedAt, paymentReleasedBy,

  chargeId: 'ch_...',
  transferId: 'tr_...',
  paymentBreakdown: {                    // written by releaseEscrowSimple
    grossAmount: 132.00,
    stripeFee:   4.99,
    netAmount:  127.01,
    handymanPayout: 115.46,
    platformFee:    11.55
  }
}
```

### `handymen/{uid}` (Stripe Connect fields)
```js
{
  stripeConnectedAccountId: 'acct_...',
  stripeAccountStatus: 'pending' | 'active',
  stripeOnboardingCompleted: bool,
  stripeDetailsSubmitted: bool,
  stripePayoutsEnabled: bool,
  stripeChargesEnabled: bool,
  stripeConnectedAt, stripeLastSyncedAt
}
```

---

## API endpoints

Base URL: `https://us-central1-eazydone-d06cf.cloudfunctions.net`

### Payment
| Endpoint | Method | Purpose |
|---|---|---|
| `/createPaymentIntent` | POST | Create PaymentIntent with `capture_method: 'manual'` |
| `/getPaymentStatus` | GET | Read PaymentIntent status |
| `/confirmPayment` | POST | Mark `paymentStatus: 'captured'` after client-side confirm |
| `/releaseEscrowSimple` | POST | **Admin only.** Capture + transfer net to handyman |
| `/refundPayment` | POST | Refund a charge to customer |
| `/stripeWebhook` | POST | Handles `payment_intent.succeeded`, `account.updated` |

### Connect
| Endpoint | Method | Purpose |
|---|---|---|
| `/createConnectedAccount` | POST | Create Stripe Express account (SG) |
| `/createAccountLink` | POST | Generate onboarding URL |
| `/getAccountStatus` | GET | Check `details_submitted`, `charges_enabled`, `payouts_enabled` |
| `/createLoginLink` | POST | Stripe Express dashboard link |

---

## Environment / config

```env
# Frontend (.env.local)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...   # or pk_live_... in prod
```

```bash
# Backend (Firebase Functions config)
firebase functions:config:set stripe.secret_key="sk_test_..."        # or sk_live_...
firebase functions:config:set platform.fee_percentage="0.10"         # optional override
```

---

## Testing

| Card | Behavior |
|---|---|
| `4242 4242 4242 4242` | Success, no 3DS |
| `4000 0027 6000 3184` | Requires 3DS |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |

Any future expiry, any CVC, any postal code.

---

## Known issues / follow-ups

- **Stale UI copy** — `src/components/common/HelpContact.jsx:68` advertises a "5% platform fee" but the actual rate is **10%**. Update the help text.
- **Refund-after-release gap** — `refundPayment` does not reverse the handyman transfer. If a refund is required after `releaseEscrowSimple` has run, the platform must also call `stripe.transfers.createReversal` (or similar) manually, otherwise the platform absorbs the full refunded amount.
- **3-way split is manual** — `releaseEscrowAndSplit` (commented at line 787) is the only code path that knew about cofounder/operator accounts. With it disabled, the platform fee accumulates in the platform Stripe balance and must be distributed off-platform.

---

**Last Updated:** 2026-04-26
**Active release path:** `releaseEscrowSimple` (single transfer to handyman, platform fee retained)
