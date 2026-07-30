# Price Adjustment Flow

> **Status:** ⚠️ **Partially superseded (owner decision 2026-07-30).** The governing design is now Scenario 10 in `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md`: **approve-by-paying** — a Stripe Payment Link where the customer's payment IS the approval. This supersedes this doc's locked decisions **1** (magic-link breakdown page → dropped; the WhatsApp message + payment-link page carry amount/reason) and **3** (off-session saved-card charge → dropped; no `setup_future_usage`, no card storage). Decision **2** (delta capped at the service's published `priceMax`) and the mandatory-reason rule **still stand**. The background analysis and integration inventory below remain useful reference.

## Overview

Service prices are now published as **estimated ranges** (lower–upper bound). At checkout we automatically charge the **lower bound** of the range. After the on-site inspection, the handyman may discover the actual scope is larger than expected — e.g. a corroded pipe behind the wall, an extra electrical run, or wood rot under the floorboard. This flow lets the handyman **request an upward adjustment within the published range**, with a reason and itemised breakdown, and lets the customer approve or reject before any additional money moves.

If approved, the difference (the **delta**) is collected immediately on the customer's saved card — no need to re-enter card details. If rejected, the handyman can either complete the job at the original lower-bound price or cancel it and trigger a refund via support.

This is the second half of the platform's **Pricing Rule** already shown to customers at checkout (`src/components/customer/PaymentForm.jsx` — *Pricing Rule* notice block).

---

## Pricing Rule (customer-facing copy)

The notice currently rendered on the payment screen and review screen states:

- The platform automatically charges the **lower end** of the estimated range.
- The handyman can request an adjustment **upward only after the on-site inspection**.
- Any increase must include:
  - **Reason** (mandatory)
  - **Updated breakdown** (line items)
  - **Customer approval required**

This document specifies how the third bullet is operationalised end-to-end.

---

## Current Implementation Status

| Capability | Status | Source / Notes |
|---|---|---|
| Lower-bound charged automatically at checkout | ✅ Implemented | `src/config/servicePricing.js` — `getServicePrice` returns `min` |
| Pricing Rule copy shown on review + payment screens | ✅ Implemented | `src/components/customer/JobRequestForm.jsx` (Estimated Price section), `src/components/customer/PaymentForm.jsx` (Pricing Rule notice) |
| Card saved for off-session re-charge of the delta | ❌ Not yet | Need `setup_future_usage: 'off_session'` on original PaymentIntent in `functions/index.js:566` |
| Handyman submits adjustment with reason + breakdown | ❌ Not yet | New `RequestAdjustmentForm` modal + `requestPriceAdjustment` Cloud Function |
| Customer approves / rejects via magic-link page | ❌ Not yet | New `/jobs/:jobId/adjustment/:token` route + `respondToPriceAdjustment` Cloud Function |
| Mark Complete blocked while adjustment is pending | ❌ Not yet | Modify `src/components/handyman/JobActionButtons.jsx:175` |
| Admin sees breakdown + new total at fund release | ❌ Not yet | Modify `src/pages/AdminFundRelease.jsx` |
| Auto-expiry of unanswered adjustment requests | ❌ Not yet | New scheduled function `expirePriceAdjustments` |
| Combined transfer (original + delta) at escrow release | ❌ Not yet | Modify `releaseEscrowSimple` in `functions/index.js:873` |

---

## Design Decisions (locked)

These three forks were resolved before drafting this doc:

| # | Decision | Rationale |
|---|---|---|
| 1 | Customer approves via **magic-link page**, delivered by **WhatsApp + email** | A dollar-amount decision needs a clear breakdown view — chat-bubble YES/NO can't render a line-item table. Mirrors the pattern already used for handyman approval emails. |
| 2 | Proposed amount **capped at the service's published `priceMax`** | Honours the "estimated range" contract. Out-of-range work becomes a support / dispute matter rather than a unilateral handyman decision. |
| 3 | Delta charged **immediately on customer approval, off-session** | Tells us up-front if the card declines (vs. discovering it at admin-release time, which is messy). Standard Stripe marketplace pattern for "estimate now, true-up later". |

---

## End-to-end flow

```text
┌────────────────────┐   accept    ┌────────────────────┐   inspection    ┌─────────────────────────┐
│  status: pending   │───────────▶ │  status: in_progress│────────────────▶│  Handyman opens         │
│  (lower bound      │             │  priceAdjustment:   │                 │  RequestAdjustmentForm  │
│   already charged) │             │  null               │                 └────────────┬────────────┘
└────────────────────┘             └─────────────────────┘                              │ submit
                                              ▲                                         ▼
                                              │                            ┌─────────────────────────┐
                                              │ approve                    │ requestPriceAdjustment  │
                                              │                            │ - validates ≤ priceMax  │
                                              │                            │ - writes priceAdjustment│
                                              │                            │   {status: requested}   │
                                              │                            │ - sends WhatsApp + email│
                                              │                            │   with HMAC magic link  │
                                              │                            └────────────┬────────────┘
                                              │                                         │
                                              │         ┌─────── customer opens link ───┘
                                              │         ▼
                                              │   ┌─────────────────────────────┐
                                              │   │ AdjustmentApproval page     │
                                              │   │ shows reason + breakdown    │
                                              │   │ [Approve]   [Reject + note] │
                                              │   └────────┬───────────┬────────┘
                                              │            │           │
                                              │   approve  │           │ reject
                                              │            ▼           ▼
                                              │   ┌──────────────┐ ┌──────────────┐
                                              │   │ Off-session  │ │ status:      │
                                              │   │ PI for delta │ │ rejected     │
                                              │   │ created +    │ │ handyman can:│
                                              │   │ captured     │ │  • complete  │
                                              │   │              │ │    at lower  │
                                              │   │ status:      │ │    bound     │
                                              │   │ approved     │ │  • cancel ⇒  │
                                              │   └──────┬───────┘ │    refund via│
                                              │          │         │    support   │
                                              └──────────┘         └──────────────┘

After approval (or with no adjustment), the existing flow continues:

  in_progress ──Mark Complete──▶ pending_confirmation ──customer YES──▶ pending_admin_approval ──release──▶ completed
                                                          │
                                                          └──customer NO──▶ disputed
```

### Scheduled date gate is preserved

The handyman cannot request an adjustment **before** they've had the opportunity to inspect. The simplest gate is the existing **scheduled-date gate** at `src/components/handyman/JobActionButtons.jsx:34-47` — adjustments can only be requested on or after `preferredDate`. ASAP / Immediate jobs have no date gate (consistent with the existing Mark Complete button).

---

## Data model

A new `priceAdjustment` sub-document is added to each job. While `priceAdjustment.status === 'requested'`, the handyman is blocked from marking the job complete.

### `jobs/{jobId}.priceAdjustment`

```js
priceAdjustment: {
  status: 'requested' | 'approved' | 'rejected' | 'expired',

  // Money — all SGD, dollars (not cents)
  originalAmount:   80,    // service fee charged at checkout (lower bound)
  proposedAmount:   95,    // new TOTAL service fee proposed
  delta:            15,    // proposedAmount - originalAmount, denormalised for clarity
  priceMaxAtRequest: 100,  // service's priceMax at request time, snapshot for audit

  // Required justification
  reason: 'Pipe behind drywall is corroded — needs replacement copper joint and 30 min extra labour.',
  breakdown: [
    { label: 'Replacement copper joint', amount: 8, type: 'parts'  },
    { label: 'Extra 30 min labour',      amount: 7, type: 'labour' }
  ],
  // Sum of breakdown[].amount MUST equal `delta` (server-validated).

  // Optional supporting evidence
  photos: [
    'gs://eazydone-d06cf.appspot.com/adjustments/{jobId}/{uuid}.jpg'
  ],

  // Audit
  requestedBy: { uid: 'handyman_uid', name: 'Alex Tan' },
  requestedAt: Timestamp,
  expiresAt:   Timestamp,        // requestedAt + 24h

  // Customer response (written server-side only via respondToPriceAdjustment)
  customerResponse: {
    decision: 'approved' | 'rejected',
    note: 'Optional rejection reason',
    respondedAt: Timestamp,
    via: 'web' | 'whatsapp'      // 'web' for v1; 'whatsapp' reserved for future
  } | null,

  // Stripe — populated after off-session capture
  paymentIntentId: 'pi_3Q...',
  capturedAt: Timestamp,

  // Magic-link token (HMAC; stored hashed for verification)
  approvalTokenHash: 'sha256-hex'
},

// Append-only record of every adjustment round on this job (supports re-quotes)
adjustmentHistory: [
  { /* same shape as priceAdjustment, frozen at terminal state */ }
]
```

### Notes

- **`adjustmentHistory`** is appended to whenever a `priceAdjustment` reaches a terminal state (`approved` / `rejected` / `expired`). This supports the case of a handyman submitting a revised proposal after a rejection. Only one `priceAdjustment` may be active at a time.
- **`priceMaxAtRequest`** is a snapshot so retroactively raising the published `priceMax` (e.g. a 2027 price-list update) doesn't make a 2026 adjustment look out-of-range during disputes.
- **`approvalTokenHash`** — only the hash is stored. The plaintext token is sent in the magic link and never persisted.

---

## State machine

```
priceAdjustment.status:

  none
    │
    ▼ (handyman submits)
  requested ───────────────┬───────────────┐
    │                      │               │
    │ customer approves    │ rejects       │ 24h elapses (cron)
    ▼                      ▼               ▼
  approved              rejected         expired
    │
    ▼ (admin releases escrow)
  captured  ←── conceptually a sub-state of approved; tracked via capturedAt + paymentIntentId
```

**Transitions** are enforced server-side in `requestPriceAdjustment` and `respondToPriceAdjustment`. The client never writes terminal states directly — Firestore rules deny it (see [Firestore rules](#firestore-rules)).

**Mark Complete is blocked** when `priceAdjustment.status === 'requested'`. It's allowed in all other states (including `rejected` and `expired`, where the handyman finishes at the lower bound).

---

## UI surfaces

| # | Who | Where | Status |
|---|---|---|---|
| 1 | Handyman | New **`RequestAdjustmentButton`** on `src/pages/JobDetails.jsx`, next to Mark Complete. Visible only when `status === 'in_progress'` && no active adjustment && date-gate passed. | New |
| 2 | Handyman | New **`<RequestAdjustmentForm />`** modal at `src/components/handyman/RequestAdjustmentForm.jsx`. Fields: proposed amount (number, validated `≤ priceMax`), reason (textarea, min 30 chars), dynamic line-items table (label + amount + type), optional photo upload (≤3 photos, ≤5 MB each). Live-displays the delta and warns if line-item sum ≠ delta. | New |
| 3 | Handyman | `JobActionButtons.jsx:175` — Mark Complete disabled while `priceAdjustment.status === 'requested'`, with copy *"Awaiting customer approval of price update"*. Mirrors the existing date-gate disabled state. | Modify |
| 4 | Customer | New page **`src/pages/AdjustmentApproval.jsx`** at route `/jobs/:jobId/adjustment/:token`. No login required — token is HMAC-signed and verified server-side. Shows: original total, proposed total, delta in red, line-item table, reason, handyman name, photos. Two CTAs: **Approve & Pay $X** / **Reject** (rejection opens an optional note textarea). | New |
| 5 | Customer | After approval: redirect to a confirmation screen (in-page) showing "Charged $X to •••• 4242" and link back to home. After rejection: thank-you screen with "We've notified the handyman. They'll be in touch about next steps." | New |
| 6 | Admin | `src/pages/AdminFundRelease.jsx` — when an `approved` adjustment exists, render an expandable "Price adjustment details" section with reason, breakdown, photos, customer response timestamp. Update the displayed `estimatedBudget` to `originalAmount + delta`. | Modify |
| 7 | Admin | `src/pages/AdminDisputedJobs.jsx` — auto-flag jobs whose adjustment was `rejected` AND the handyman subsequently cancels, so support has a queue. | Modify |

### Sample copy (for cofounder review)

**Handyman form — submit button hover state when amount is out of range:**
> "Proposed amount exceeds the published range for {service} ({min}–{max}). To go above $max, please contact support to open a quote dispute."

**Customer email subject:**
> "Action required: {Handyman} has updated the estimate for your {service} job"

**Customer email body (excerpt):**
> Hi {customerName},
>
> {handymanName} has inspected your {serviceType} job and found additional work is needed. They've proposed an updated estimate of **${proposedAmount}** (up from ${originalAmount}).
>
> Reason: {reason}
>
> Updated breakdown:
> - Replacement copper joint — $8
> - Extra 30 min labour — $7
>
> [**Review and approve →**](magic-link)
>
> This link expires in 24 hours. If you don't respond, the job will continue at the original price.

**Customer WhatsApp message:**
> Hi {customerName} — {handymanName} has updated the estimate for your {serviceType} job to ${proposedAmount} (was ${originalAmount}). Tap to review and approve: {magic-link}. Link expires in 24 hours.

---

## Cloud Functions (new)

All in `functions/index.js`. Auth + validation patterns follow the existing functions (`createPaymentIntent`, `releaseEscrowSimple`).

### `requestPriceAdjustment` (handyman-only)

```
POST /requestPriceAdjustment
Body: { jobId, proposedAmount, reason, breakdown[], photos[] }
Auth: Bearer <handyman ID token>
```

1. Verify auth + that requester is the assigned handyman on the job.
2. Validate input: `proposedAmount > originalAmount`, `proposedAmount ≤ priceMax(serviceType)`, reason length ≥ 30, sum of `breakdown[].amount === proposedAmount − originalAmount`.
3. Block if `status !== 'in_progress'` or an active adjustment already exists.
4. Generate HMAC token: `HMAC-SHA256(secret, jobId + adjustmentRequestedAt)`. Store the hash. Plaintext token sent in the link only.
5. Write `priceAdjustment` to job doc with `status: 'requested'` and `expiresAt: now + 24h`.
6. Send WhatsApp + email to customer with link `https://app/jobs/{jobId}/adjustment/{token}`.

### `respondToPriceAdjustment` (token-authenticated, no login)

```
POST /respondToPriceAdjustment
Body: { jobId, token, decision: 'approved' | 'rejected', note? }
```

1. Load job, recompute HMAC, constant-time compare against stored hash. Reject if `expiresAt < now`.
2. On **`rejected`** — set `customerResponse`, transition to `rejected`, append to `adjustmentHistory`, notify handyman.
3. On **`approved`**:
    1. Look up the saved payment method on the original PI's customer (saved at checkout via `setup_future_usage: 'off_session'`).
    2. `stripe.paymentIntents.create({ amount: deltaCents, currency: 'sgd', customer, payment_method, off_session: true, confirm: true, capture_method: 'automatic', metadata: { jobId, adjustment: true, originalPaymentIntent: ..., parentJobId: ... } })`.
    3. On success, write `paymentIntentId` + `capturedAt`, transition to `approved`, append to `adjustmentHistory`, notify handyman.
    4. On Stripe `card_declined` — transition to `rejected` with `customerResponse.note: 'card_declined'` and surface a friendly retry screen with a "Try a different card" CTA (creates a SetupIntent → updated PI for delta).

### `expirePriceAdjustments` (scheduled, every 30 min)

```
exports.expirePriceAdjustments = functions.pubsub.schedule('every 30 minutes').onRun(...)
```

For every job with `priceAdjustment.status === 'requested'` && `expiresAt < now`, set status `expired` and notify the handyman.

### `releaseEscrowSimple` (modify — `functions/index.js:873`)

When an `approved` adjustment exists:

1. Capture the original PI as today (line 948).
2. Retrieve the **delta PI** (already captured at customer-approval time) via `priceAdjustment.paymentIntentId`.
3. Sum the two charges' net amounts (each post-Stripe-fee), apply the same `100:10` ratio to compute platform fee from net.
4. Issue a **single combined transfer** to the handyman keyed by `transfer-${chargeId}-${adjustmentChargeId}` for idempotency.

This keeps the handyman payout as one transfer (no surprise multiple deposits) while keeping each Stripe fee accurate.

---

## Stripe details

### Card saving at checkout

Modify `createPaymentIntent` (`functions/index.js:566-587`):

```diff
  paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'sgd',
    payment_method_types: ['card'],
    capture_method: 'manual',
+   setup_future_usage: 'off_session',  // saves card for delta charge
+   customer: stripeCustomerId,         // create-or-fetch customer first
    receipt_email: customerEmail || null,
    description: `${serviceType} service - Job #${jobId}`,
    metadata: { ... },
    statement_descriptor: 'HANDYMAN SVC',
  }, { idempotencyKey: `pi-create-${jobId}` });
```

This requires creating a Stripe Customer first (one per `customerId` Firebase UID, deduped by metadata or a Firestore lookup). Today we pass `customerEmail` directly to the PI without creating a Customer; that needs to change.

### Delta capture pattern

```js
const delta = priceAdjustment.proposedAmount - priceAdjustment.originalAmount;
const platformFeeOnDelta = delta * platformFeePercentage;     // 10%
const totalDeltaCents = Math.round((delta + platformFeeOnDelta) * 100);

const deltaPI = await stripe.paymentIntents.create({
  amount: totalDeltaCents,
  currency: 'sgd',
  customer: stripeCustomerId,
  payment_method: savedPaymentMethodId,
  off_session: true,
  confirm: true,
  capture_method: 'automatic',
  metadata: {
    jobId,
    parentPaymentIntent: originalPI.id,
    type: 'price_adjustment_delta',
  },
}, {
  idempotencyKey: `pi-delta-${jobId}-${priceAdjustment.requestedAt.toMillis()}`,
});
```

### Decline handling

Off-session declines surface as `errorCode === 'authentication_required'` (3DS challenge needed) or `card_declined`. For `authentication_required`, return the PI's client secret to the customer page so they can complete 3DS in-line. For `card_declined`, mark the adjustment `rejected` and prompt the customer to try a different card.

### Refunds

If the customer rejects after a successful capture (shouldn't happen in normal flow, but consider partial-completion disputes), `refundPayment` (`functions/index.js:1085`) needs to know which PI to refund. Adjustment PIs are refundable independently of the original — they share a `customer` but are distinct charges.

---

## Notifications

Add to `src/services/whatsappService.js` and the existing email service:

| Helper | Trigger | Channel | Recipient |
|---|---|---|---|
| `sendAdjustmentRequestedNotification` | After `requestPriceAdjustment` succeeds | WhatsApp + email | Customer |
| `sendAdjustmentApprovedNotification` | After successful delta capture | WhatsApp + email | Handyman |
| `sendAdjustmentRejectedNotification` | After customer rejects OR auto-expiry | WhatsApp + email | Handyman |
| `sendAdjustmentDeclinedNotification` | After delta capture fails (declined card) | WhatsApp + email | Customer (with retry link) |

The WhatsApp delivery uses the existing `sendNotification` proxy at `whatsappService.js`. Email reuses `src/services/emailService.js` patterns.

---

## Firestore rules

`firestore.rules:67-71` already lets the assigned handyman update the job doc. We need to forbid them from writing customer-controlled adjustment fields. Proposed rule:

```js
// Job owner or assigned handyman can update — but with field restrictions on adjustments
allow update: if isSignedIn() && (
  isOwner(resource.data.customerId) ||
  (resource.data.handymanId != null && isOwner(resource.data.handymanId) &&
    !writesProtectedAdjustmentFields()) ||
  (resource.data.handymanId == null && request.resource.data.handymanId == request.auth.uid)
);

function writesProtectedAdjustmentFields() {
  let changed = request.resource.data.priceAdjustment.diff(resource.data.priceAdjustment).affectedKeys();
  return changed.hasAny(['customerResponse', 'paymentIntentId', 'capturedAt', 'status']);
}
```

The terminal `status` transitions (`approved`, `rejected`, `expired`) and the `customerResponse` / Stripe fields are written only by Cloud Functions via the Admin SDK, which bypasses these rules.

`adjustmentHistory` is also Cloud-Functions-only — clients cannot mutate audit history.

---

## Edge cases & invariants

| Scenario | Behaviour |
|---|---|
| Handyman submits adjustment with `proposedAmount > priceMax` | Cloud Function rejects with 400; UI prevents submission. Out-of-range work is a support / dispute matter. |
| Handyman submits a second adjustment while one is `requested` | 409 Conflict — must wait for response or auto-expiry. |
| Handyman submits revised adjustment after rejection | Allowed — previous attempt is in `adjustmentHistory`, new one becomes the active `priceAdjustment`. |
| Customer opens magic link after `expiresAt` | Page shows "This link has expired — please ask your handyman to re-issue an estimate." |
| Customer approves, but card declines (off-session) | Adjustment auto-`rejected` with `customerResponse.note: 'card_declined'`. Customer notified with a "Try another card" link (creates a new delta PI with a SetupIntent). |
| Admin releases escrow before customer responds to adjustment | The active adjustment is auto-`expired` at release time; only the original lower-bound is captured. Admin sees a warning before clicking Release. |
| Customer disputes after approval (chargeback) | Standard Stripe dispute flow on the delta PI. The original PI is unaffected. |
| Job is cancelled with refund (`refundPayment`) while adjustment is `approved` | Both PIs (original + delta) are refunded. `refundPayment` must iterate adjustment PIs. |
| Handyman tries to Mark Complete with `requested` adjustment | Button disabled with copy *"Awaiting customer approval of price update"*. |
| Handyman tries to Mark Complete with `rejected` / `expired` adjustment | Allowed — completes at the original lower-bound price. |
| Customer's saved card is later removed in their bank | Off-session charge fails with `card_declined`; same fallback as above. |

### Invariants (server-enforced)

1. `priceAdjustment.proposedAmount > priceAdjustment.originalAmount` — adjustments are upward only.
2. `priceAdjustment.proposedAmount ≤ priceMaxAtRequest` — never exceed the published range.
3. `sum(breakdown[].amount) === proposedAmount − originalAmount` — itemisation must match.
4. Only one active `priceAdjustment` per job at a time.
5. `customerResponse` and Stripe fields (`paymentIntentId`, `capturedAt`, terminal `status`) are written only by Cloud Functions.
6. `adjustmentHistory` is append-only.

---

## Implementation phases

Each phase leaves the app in a working state.

### Phase 1 — Plumbing (no user-visible change)
1. Add adjustment helpers to `src/config/servicePricing.js` — `isProposalWithinRange(serviceType, amount)`, `formatBreakdown(items)`.
2. Modify `createPaymentIntent` to (a) create-or-fetch a Stripe Customer per `customerId`, (b) attach `setup_future_usage: 'off_session'` to the PI.
3. Backfill: existing in-flight jobs without a saved card cannot have adjustments — gracefully fall back to "Adjustment unavailable for this job; please contact support" if the saved PM is missing.

### Phase 2 — Handyman submission
4. New `<RequestAdjustmentForm />` modal.
5. New `<RequestAdjustmentButton />` on `JobDetails.jsx`.
6. Disable Mark Complete in `JobActionButtons.jsx` while `requested`.
7. New Cloud Function `requestPriceAdjustment`.
8. WhatsApp + email helper `sendAdjustmentRequestedNotification`.

### Phase 3 — Customer response
9. New page `AdjustmentApproval.jsx` at route `/jobs/:jobId/adjustment/:token`.
10. New Cloud Function `respondToPriceAdjustment` (handles approve, reject, off-session capture, decline fallback).
11. WhatsApp + email helpers `sendAdjustmentApprovedNotification`, `sendAdjustmentRejectedNotification`, `sendAdjustmentDeclinedNotification`.

### Phase 4 — Admin & cleanup
12. Modify `releaseEscrowSimple` to combine original + delta into a single transfer.
13. Modify `AdminFundRelease.jsx` to render breakdown + new total.
14. Modify `AdminDisputedJobs.jsx` to auto-flag rejected-then-cancelled adjustments.
15. New scheduled function `expirePriceAdjustments` (every 30 min).
16. Tighten `firestore.rules` for adjustment fields.

---

## Open questions for cofounder review

1. **Expiry window** — 24 h, or longer (48 h)? Short window forces a quick decision but risks expiring on weekends. Long window stalls jobs.
2. **Photo evidence** — make uploading photos *required* for adjustments (more accountability) or optional (less friction)? Recommend optional for v1, monitor abuse, tighten if needed.
3. **Customer rejection without note** — allow silent rejection, or require a reason (min 10 chars)? Recommend allow silent — friction here just delays the inevitable.
4. **Handyman after rejection** — auto-cancel the job (with full refund) or let the handyman choose between completing at lower bound vs cancelling? Recommend the latter — gives the handyman an off-ramp.
5. **Multiple adjustment rounds** — should we cap at 1 attempt per job, or allow re-quote after rejection (with `adjustmentHistory`)? Recommend 1 attempt per job for v1; 2nd attempt requires support involvement. Reduces back-and-forth.
6. **Customer-side identity** — today customers sign in anonymously (`createAnonymousUser` in `JobRequestForm.jsx`). Magic link bypasses this with HMAC token. Long-term, do we want a real customer login + dashboard so they can see all their jobs / adjustments in one place?
7. **GST / tax handling** — the breakdown is pre-tax today. If GST registration is on the roadmap, the line-item table needs a tax-handling column.
8. **Handyman's view of their own breakdown after submission** — do we want an "Edit / withdraw request" affordance before the customer responds? Recommend a withdraw button (sets status to `expired` early) but no edit — once submitted, it's a quote.

---

## Out of scope (future)

- **Downward adjustments** (handyman finishes faster than expected). Today's flow is upward-only.
- **Real-time approval over WhatsApp** with a one-tap reply. The chat experience can't render a line-item table cleanly; web link is the v1 channel.
- **Customer-initiated re-quote requests** (e.g. customer asks for a cheaper alternative). This is a different flow.
- **Itemised invoicing / GST receipts** — see open question 7.
- **Adjustment templates** — handymen typing the same line items repeatedly. Could add a saved-templates feature later.

---

## Key code references

### Frontend
- `src/config/servicePricing.js` — `getServicePrice` (lower bound), `getServicePriceMax`, `formatPriceRange`.
- `src/components/customer/JobRequestForm.jsx` — Estimated Price section displays the range and the lower-bound charge.
- `src/components/customer/PaymentForm.jsx` — Pricing Rule notice block.
- `src/components/handyman/JobActionButtons.jsx:34-47` — date-gate pattern reused for adjustment-blocking.
- `src/components/handyman/JobActionButtons.jsx:175` — Mark Complete disabled-state to extend.
- `src/pages/JobDetails.jsx` — handyman job detail view; adjustment button slot.

### Backend (`functions/index.js`)
- `createPaymentIntent` (line 480) — modify to save card for off-session re-charge.
- `releaseEscrowSimple` (line 873) — modify to add delta capture into the transfer.
- `refundPayment` (line 1085) — modify to iterate adjustment PIs.
- New: `requestPriceAdjustment`, `respondToPriceAdjustment`, `expirePriceAdjustments`.

### Firestore
- `firestore.rules:67-71` — extend with `writesProtectedAdjustmentFields()` clause.

---

## Related documentation

- [`stripe-payment.md`](./stripe-payment.md) — escrow model, Connect onboarding, fee math.
- [`job-creation-flow.md`](./job-creation-flow.md) — how the job + payment intent is created at booking.
- [`whatsapp-notifications.md`](./whatsapp-notifications.md) — WhatsApp template + webhook patterns; new templates added here will follow the same pattern.
