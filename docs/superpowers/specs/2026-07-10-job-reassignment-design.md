# Design: Job Reassignment (Handyman Cancel → Re-release → Correct Payee)

Date: 2026-07-10
Status: Approved design, pending implementation plan
Branch: `feature/job-reassignment`

## 1. Goal

Let an assigned handyman cancel a job they can no longer do; return the job to the board for another handyman; keep the escrow correct so admin fund release always pays the *current* handyman; and give the admin full visibility of any reassignment before releasing funds. Also: make the job board default-sort by date needed (ASAP first), and confirm/enforce that no automatic fund-release path exists.

## 2. Audit result: no auto fund release (verified 2026-07-10)

- The only live `stripe.transfers.create` is in `releaseEscrowSimple` (`functions/index.js:1646`), gated by `verifyAdminAccess` and called only from `/admin/fund-release`.
- `refundPayment` (admin-gated) uses `transfers.createReversal` — refunds, not payouts.
- `confirmPayment`'s `paymentIntents.capture` moves customer money into the platform balance (escrow), never to a handyman.
- The Stripe webhook and scheduled functions (`cleanupAbandonedJobs`, `autoTriggerCompletionPoll`, `onJobPaymentSucceeded`) move no money.
- Legacy `releaseEscrowAndSplit` backend is commented out; its orphaned frontend wrapper (`src/services/stripe/stripeApi.js:103`) calls a nonexistent endpoint and **is removed by this feature** so no dead release path lingers.

Escrow model insight this design relies on: the transfer destination is resolved at release time from the job's current `handymanId`. Held funds are never bound to a handyman, so "reassigning escrow" = keeping `handymanId` and its history correct.

## 3. Scope

**In:** handyman cancel from job details (and My Jobs), server-side cancel function, assignment history, re-release to board, fan-out re-notification excluding previous cancellers, customer WhatsApp notice on cancel, canceller re-claim blocking (UI + rules), board default sort by date needed, admin fund-release visibility (payee line, reassignment badge + history), null-handyman release guard, dead-code removal.

**Out:** auto-suspension for repeat cancellers (we only count), admin-initiated reassignment/removal of a handyman, customer-initiated cancellation, penalties/fees, WhatsApp thread swap handling (that lands with the job-threads feature; see §10).

## 4. Data model (fields on `jobs/{jobId}`; no new collections)

```
assignmentHistory: [                 // append-only; written only by Cloud Functions
  { handymanId, handymanName, assignedAt, endedAt,
    endReason: 'cancelled' | 'completed',
    cancelReason,                    // picklist key, present when endReason = cancelled
    cancelNote }                     // optional free text
]
previousHandymanIds: [uid, ...]      // denormalized: rules checks + fan-out exclusion
reassignmentCount: number            // bumped per cancel; scopes notification marker IDs
cancelledLastBy, lastCancelledAt     // convenience for admin badges/lists
```

- The current round's history entry is created lazily at cancel/release time from the job's existing `acceptedBy`/`acceptedAt` (no change to the accept flow needed).
- Array-on-doc (not a subcollection) because the admin fund-release page gets the full story in the job read it already performs, and reassignment counts are small and bounded.
- `handymen/{uid}.cancellationCount`: incremented per cancel; display-only signal for admin.

Cancel reasons (picklist): `schedule_conflict`, `job_bigger_than_expected`, `location_too_far`, `personal_emergency`, `other` (note required when `other`).

## 5. Cancel flow — `cancelJobAssignment` (new HTTPS Cloud Function)

1. **Auth:** Bearer ID token (existing `verifyAuthToken`); caller must have a `handymen/{uid}` doc.
2. **Validation + mutation in one Firestore transaction:**
   - Job exists; `job.handymanId === caller.uid`; `job.status === 'in_progress'`; `!job.completionPollSentAt`.
   - Failures return 409 with a human-readable reason (e.g. "You've already marked this job complete — contact support").
   - Atomic update: close/append the history entry (`endReason: 'cancelled'` + reason/note), add uid to `previousHandymanIds`, increment `reassignmentCount`, set `status: 'pending'`, `handymanId: null`, delete `acceptedBy`, `acceptedAt`, `completionPollSentAt`, set `cancelledLastBy`/`lastCancelledAt`. **`paymentStatus` untouched** — escrow stays held.
3. **Handyman profile:** increment `cancellationCount` (outside the job transaction; best-effort).
4. **Post-transaction, best-effort, failures logged and non-blocking:**
   - Customer WhatsApp notice (new utility template `handyman_cancelled` + freeform fallback, existing `sendTwilioTemplateMessage` pattern): "Update on Job #…: your handyman is no longer available. We're finding you a new one — no action needed."
   - Fan-out re-run: call `runHandymanFanOut` directly with round-scoped markers and exclusions (§6).
5. **Audit:** `writeAuditLog('job_cancelled_by_handyman', …)` with jobId, uid, reason, reassignmentCount.
6. Rate limit: reuse `checkRateLimit` — 5 cancels per hour per handyman — to stop scripted churn.

**UI:**
- `JobActionButtons.jsx`: a secondary "Can't do this job?" cancel action, visible only when `isMyJob && status === 'in_progress' && !completionPollSentAt`. Opens a modal: reason picklist + optional note + consequence copy ("The job returns to the board and the customer will be notified"). Confirm → call function → toast → navigate to dashboard. Mobile-first, follows existing modal patterns.
- `MyJobsView.jsx`: job cards in the same states render the same shared cancel-modal component (one `CancelJobModal.jsx` used by both surfaces; no navigation required to cancel).
- New `src/services/api/jobAssignment.js` frontend wrapper (Bearer-token fetch, same shape as `whatsappService.js`).

## 6. Re-release to the board

- Board subscription is `status == 'pending'`, so the transactional reset re-lists the job instantly. `paymentStatus` remains `succeeded` (board jobs are paid jobs; unchanged semantics).
- **Fan-out re-notification (`handymanNotifier.js` changes):**
  - Marker doc ID becomes `{handymanId}_r{round}` where `round = reassignmentCount`; round 0 keeps bare `{handymanId}` IDs for backward compatibility with existing markers.
  - `pickEligibleHandymen` gains an `excludeIds` parameter, fed with `previousHandymanIds`.
  - `cancelJobAssignment` invokes `runHandymanFanOut` directly (module is already dependency-injected); the payment trigger `onJobPaymentSucceeded` is untouched and remains round-0-only by construction (it only fires on the not-paid → paid transition).
- **Canceller cannot re-claim (three layers):**
  1. Fan-out exclusion (above).
  2. UI: `ExpressInterestButton` disabled with "You previously cancelled this job" when `previousHandymanIds` contains the current uid.
  3. Firestore rules: the claim update additionally requires `!(request.auth.uid in resource.data.get('previousHandymanIds', []))`.

## 7. Job board sorting (`JobBoard.jsx`, client-side only)

- New sort option `Date Needed` (value `date-needed`), set as the **default** `sortBy`.
- Comparator: ASAP jobs (`preferredTiming !== 'Schedule'`) before scheduled jobs; among ASAP, newest `createdAt` first; among scheduled, ascending `preferredDate`; jobs missing `preferredDate` sort to the end of the scheduled group. Existing options (newest, budget, urgent) remain.
- No query or index changes (sorting stays client-side over the same `status == 'pending'` subscription).

## 8. Admin visibility & fund release

**`AdminFundRelease.jsx`:**
- Pending-release cards with `reassignmentCount > 0` show an amber "Reassigned ×N" badge and an expandable history: each round's handyman name, assigned/ended dates, cancel reason (+note).
- Explicit payee line on every card and in the confirm dialog: "Releasing to: **{current handyman name}** (assigned {date})".
- Data comes from the job doc fields (§4) — no extra reads beyond the existing handyman-name lookup.

**`releaseEscrowSimple` (two additions, no payout-logic change):**
- Guard: if `handymanId` is null → 400 "Job has no assigned handyman — it was cancelled and has not been re-claimed" (currently caught generically; make the message reassignment-aware).
- On success: close the open history entry with `endReason: 'completed'`, and include `reassignmentCount` + payee name in the response payload and the existing `fund_release` audit-log entry.

**Dead code removal:** delete `releaseEscrowAndSplit` from `src/services/stripe/stripeApi.js` (backend already commented out; no callers).

## 9. Security, error handling, testing

**Security:**
- All reassignment fields (`assignmentHistory`, `previousHandymanIds`, `reassignmentCount`) are written only via Admin SDK; Firestore rules deny client writes to these fields (the existing claim-update rule is tightened to enumerate allowed fields if it doesn't already).
- Cancel is server-side only; the claim rule addition (§6) is enforced regardless of UI.
- Per-handyman cancel rate limit (§5).

**Error handling:**
- Post-transaction side effects (WhatsApp, fan-out) never roll back a cancel; failures are logged with jobId. Fan-out is idempotent per round, so retries are safe.
- Race: cancel vs. Mark Complete — both check `status` transactionally; exactly one wins, the loser gets a clear 409.
- Double-cancel (two devices): second transaction fails the `handymanId === uid` check → 409.

**Testing:**
- Unit (Jest, DI style like `handymanNotifier` tests): transaction guards (wrong uid / wrong status / poll sent / already cancelled), history append + close correctness across two rounds, round-scoped marker IDs incl. round-0 backward compatibility, `excludeIds` filtering, board comparator (ASAP vs dated vs missing date), release guard on null `handymanId`, history close on release.
- Manual E2E (dev project, Stripe test mode): pay job → handyman A accepts → cancels with reason → customer receives WhatsApp notice → job re-listed and re-notified (A excluded, A's Express Interest blocked) → handyman B accepts → admin fund-release shows badge, history, and "Releasing to: B" → release → Stripe test dashboard shows transfer to B's connected account → job history closed as completed.
- Regression: normal never-cancelled job flows unchanged end-to-end.

## 10. Compatibility with the WhatsApp job-threads design

This feature is a prerequisite-friendly neighbor to `2026-07-10-whatsapp-job-threads-design.md` (separate branch, not yet implemented): when threads land, `cancelJobAssignment` becomes the trigger for the thread-side handyman swap (spec Feature 2), and `assignmentHistory` provides exactly the participant-interval audit that spec requires. Nothing in this design blocks or is blocked by it.
