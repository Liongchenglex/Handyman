# Design: Job Lifecycle Scenarios — Structured Async WhatsApp Flows (v1)

Date: 2026-07-12
Status: Draft — pending owner review
Branch: `feature/job-lifecycle-flows`
Supersedes for v1: `docs/features/whatsapp-job-thread-spec.md` (archived — see §1)
Related: `docs/superpowers/specs/2026-07-10-job-reassignment-design.md` (shipped), `docs/features/price-adjustment-flow.md` (referenced by Scenario 10)

## 1. Context and approach

The WhatsApp job-threads feature (masked relay group chat) is **archived for v1** as an overbuild. Instead, v1 handles the *predictable coordination events* of a handyman job with **structured async WhatsApp flows**: a specific event triggers a specific message with specific reply options, the reply updates the job transactionally, and everything is recorded. Free-form conversation is deliberately out of scope; anything unstructured falls through to the admin (never dropped silently). Revisit threads if the unrecognized-reply volume (§3, F3) grows.

**The golden rule (money):**

> The customer's money is always fully recoverable until the admin clicks "release funds" — that click is the single point of no return.

Stripe mechanics behind the rule: an *uncaptured authorization* can always be voided free but **expires ~7 days after booking**; *captured* funds sit in the platform balance indefinitely — releasable to the handyman any time, refundable to the customer any time (platform absorbs Stripe's ~3.4% + S$0.50 fee); *released* funds require a transfer reversal and are treated as final. Because every scenario below can stretch a job past 7 days, v1 must **capture at booking** (Scenario 0). Consequently every flow below must keep the job in a pre-release state until genuinely settled, and stuck jobs (Scenario 12) must end in an explicit admin decision — release or refund — never rot.

**Corollary — escrow is a pot, not a promise to a person.** Captured funds sit in the platform balance with no handyman attribution; the payee is resolved only at the instant of admin release, from the job's *current* `handymanId`. Therefore "unassigning" or "reassigning" escrow when a handyman cancels or is replaced is a **no-op by construction** — there is nothing to unbind or rebind, and no scenario below moves money when people change. Money moves in exactly three places: capture at booking (in), admin release (out to handyman), admin refund (out to customer). §2b tabulates the escrow effect of every scenario.

## 2. Scenario catalog at a glance

| # | Scenario | Status today |
|---|----------|--------------|
| 0 | Capture escrow at booking | **Bug/gap** — capture only happens at fund release; auth expires at ~7 days; fan-out trigger likely never fires |
| 1 | Happy flow (done on schedule) | Built |
| 2 | Handyman cancels → re-release | Built (2026-07-11) |
| 3 | Reschedule | New |
| 4 | ASAP job: fixing the visit time | New (also fixes ASAP poll/date-gate blind spot) |
| 5 | Same-day "running late" notice | New |
| 6 | Handyman swap after inspection (late lifecycle) | Partial — cancel blocked once completion poll sent |
| 7 | Handyman no-show | New |
| 8 | Customer no-show / no access | New |
| 9 | Customer cancellation + refund | New |
| 10 | Price/scope change after inspection | Spec exists (`price-adjustment-flow.md`); integration defined here |
| 11 | Second visit needed | New |
| 12 | Stuck-state timeouts | New |

**Non-goals for v1** (admin resolves manually via existing dispute/refund tools): partial completion / partial payment, property-damage incidents, refund-after-release, editing job details other than schedule before acceptance, free-form chat.

## 2b. Escrow effect per scenario

Baseline: from Scenario 0 onward, money is captured at booking and **held** in the platform balance for the job's whole life. "Held" below always means: fully refundable, payee not yet determined, admin release is the only exit toward a handyman.

| # | Scenario | Escrow effect |
|---|----------|---------------|
| 0 | Capture at booking | Customer's card charged → **held**. If the auth is lost before capture (expiry/cancel), nothing was collected — admin alerted to re-collect. |
| 1 | Happy flow | Held throughout → **released** to the current handyman at the admin click (point of no return). |
| 2 | Handyman cancels | **Held, untouched.** No unassignment exists — escrow was never bound to the handyman. The replacement handyman is paid at release purely because `handymanId` points at them then. |
| 3 | Reschedule | Held, unaffected — only schedule metadata changes. |
| 4 | ASAP time-fixing | Held, unaffected. |
| 5 | Running late | Held, unaffected. |
| 6 | Swap after inspection | Held, untouched through the swap; the finishing handyman is the payee at release. |
| 7 | Handyman no-show | Held while resolving. Reschedule/new-handyman keep it held; the cancel branch ends in an admin **refund**. |
| 8 | Customer no-show | Held while resolving. Any compensation to the handyman for a wasted trip would be a partial release — admin-mediated, **out of scope v1** (see §6.3 penalty decision). |
| 9 | Customer cancellation | Held → admin **refund** (full or minus processing fee per §6.1 policy). An assigned handyman never had a claim on the pot, so no clawback is ever needed. |
| 10 | Price adjustment | Original pot held, unaffected. The approved **delta is a second pot** (payment link charge into the platform balance) governed by the same rule: held until admin release, refundable before it. |
| 11 | Second visit | Held, unaffected until final completion → normal release. |
| 12 | Stuck states | Held — which is exactly why every stuck path must terminate in an explicit admin decision (**release or refund**); a stuck job is customer money sitting in our balance. |

## 3. Foundations (cross-cutting, built once)

**F1 — Capture at booking.** See Scenario 0.

**F2 — Pending-prompt primitive.** Every question we send a party is recorded before it is sent:

```
jobs/{jobId}/prompts/{promptId}
  type: reschedule_approval | visit_time_approval | second_visit_approval |
        completion_confirmation | cancel_confirmation | no_show_choice | ...
  toPhone (E.164), toRole: customer | handyman
  question (rendered text), options: { "1": <action>, "YES": <action>, ... }
  status: open | answered | expired | superseded
  createdAt, expiresAt, answeredAt, answer, resultingAction
```

The inbound webhook router resolves every reply **against the sender's open prompts** instead of regex-on-job-status: one open prompt → bind reply to it; several → numbered disambiguation (the existing "1 YES / 2 NO" pattern, generalized); none → legacy handling, then F3. Opening a new prompt of the same type supersedes the old one. The existing completion poll migrates onto this primitive (its `completionPollSentAt` bookkeeping is kept for compatibility). Expiry default 48h; one nudge, then admin escalation (Scenario 12).

**F3 — No silent drops.** Any inbound message (or media) that doesn't match an open prompt or a recognized intent is stored in `inboundMessages/{id}` (sender, body, media refs, best-guess job) and forwarded to the admin via the existing email transport. This is the v1 substitute for chat transparency — and the metric that tells us if threads are ever actually needed.

**F4 — Single writer for the schedule.** After booking, `preferredDate`/`preferredTime` are changed ONLY by a `scheduleChange` Cloud Function (used by Scenarios 3, 4, 6, 7, 8, 11). It atomically updates the date, clears `completionPollSentAt` (so the poll re-arms for the new date), records the change in a `scheduleHistory[]` array (who, from→to, reason, promptId), and notifies both parties. This keeps the completion poll and the Mark-Complete date gate honest — today an unrecorded reschedule would poll the customer about a job that hasn't happened.

**F5 — Initiation reconciliation.** Several flows depend on a party — usually the handyman — *starting* something (proposing an ASAP visit time, answering a proposal addressed to them). Waiting politely forever is not a plan, so every dependent-initiation step carries the same three-rung ladder:

1. **Deadline** — every expected initiation/answer has an explicit clock (stored on the prompt's `expiresAt`, or on the job for initiations that have no prompt yet, e.g. "ASAP time never proposed").
2. **One or two automated nudges** — WhatsApp `prompt_nudge` to the owing party (plus in-app visibility for handymen); nudge counts are bounded, never infinite.
3. **Admin queue with forcing actions** — after the ladder is exhausted, the job lands in Scenario 12's "Attention needed" queue, where the admin can always resolve it because of the **admin-as-actor principle**: the admin may perform any party's step on their behalf (set a visit time after a phone call, apply a reschedule, force-unassign a handyman and re-release, or offer the customer cancel + refund). Every admin-as-actor write records the actor (`...By`, `via: 'admin'`) so the audit trail never pretends the party did it themselves.

The sweep engine for all of this is Scenario 12 — F5 is the policy, 12 is the machinery.

**Template pack** (all Utility; submit early; freeform fallback until approved, matching existing pattern): `reschedule_proposal`, `visit_time_proposal` (ASAP), `second_visit_proposal`, `running_late_notice`, `no_show_choice`, `customer_cancel_confirm`, `refund_processed`, `prompt_nudge`.

## 4. Scenarios

Legend for flows: `[A]` app action, `[WA]` WhatsApp message, `[F]` Cloud Function/trigger, `[ADM]` admin action.

---

### Scenario 0 — Capture escrow at booking (foundation, do first)

**Problem.** Booking only *authorizes* the card (`capture_method: 'manual'`); nothing captures until `releaseEscrowSimple` captures-then-transfers at admin release. Authorizations expire ~7 days → any job living longer loses the money. Side effect: `payment_intent.succeeded` (which sets `paymentStatus: 'succeeded'`, the handyman fan-out trigger) fires only at capture, so the fan-out likely never fires in production. The `confirmPayment` capture endpoint exists but has zero callers.

**Solution.** Capture server-side at booking: handle `payment_intent.amount_capturable_updated` in `stripeWebhook` → capture the PaymentIntent (idempotency key `capture-{paymentIntentId}`) → the ensuing `payment_intent.succeeded` event sets `paymentStatus: 'succeeded'` exactly as the existing handler already does → fan-out fires as designed. `releaseEscrowSimple`'s `requires_capture` branch stays as a legacy safety net. Refund policy consequence: customer refunds now cost the platform Stripe's fee — priced into Scenario 9's copy.

**Flow.**
```
Customer books + card authorized [WA job_created]
      → [F] stripeWebhook: amount_capturable_updated → capture
      → [F] stripeWebhook: payment_intent.succeeded → paymentStatus='succeeded'
      → [F] onJobPaymentSucceeded → WhatsApp fan-out to eligible handymen
      → job on board (status 'pending'), money safely in platform balance
```

---

### Scenario 1 — Happy flow (built; baseline all others deviate from)

```
Job created + paid [0] → fan-out [WA] → handyman accepts [A]
      → customer notified [WA job_accepted]
      → handyman shows up on preferredDate, does job
      → handyman taps Mark Complete [A] → completion poll [WA, quick-reply YES/NO]
      → customer YES → status 'pending_admin_approval' → admin email
      → [ADM] reviews payee + reassignment history → clicks Release  ← point of no return
      → transfer to handyman, job 'completed', paymentStatus 'released'
```
(Customer NO at the poll → 'disputed' → admin mediates; unchanged.)

---

### Scenario 2 — Handyman cancels → job re-released (built 2026-07-11)

```
Handyman taps "Can't do this job?" [A] → reason picklist → cancelJobAssignment [F]
      → job back on board (status 'pending', handymanId null, history appended)
      → customer reassured [WA handyman_cancelled]
      → fan-out round N+1 [WA], canceller excluded (markers _rN, rules + UI block)
      → new handyman accepts → continues at Scenario 1 (or 4 to re-fix the time)
```
V1 addition on top of what shipped: after a re-claim, the new handyman is prompted to confirm/re-propose the visit time via Scenario 3's machinery (the original date often no longer stands).

---

### Scenario 3 — Reschedule (either direction, customer approves)

**Trigger.** Handyman needs a different time (initiates in-app), or customer asks (arrives as free text → F3 → admin can initiate on their behalf; a customer-initiated in-WA flow is v2).

**Solution.** Handyman taps "Propose new time" on the job (date+time picker + optional note) → `proposeSchedule` [F] opens a `reschedule_approval` prompt and sends the customer a quick-reply template ("Ah Seng proposes Tue 15 Jul, 2pm — Approve / Decline"). Approve → F4 `scheduleChange` applies it, both parties get confirmations. Decline → handyman notified with the option to keep the original slot or cancel (Scenario 2). Prompt expires in 48h → nudge → admin (Scenario 12). A new proposal supersedes an open one.

**Flow.**
```
Handyman [A] "Propose new time" (new date/time + note)
      → [F] proposeSchedule: open prompt → [WA] customer: Approve / Decline
      ├─ Approve → [F] scheduleChange: preferredDate/Time updated,
      │       completionPollSentAt cleared, scheduleHistory appended
      │       → [WA] both parties: "New time confirmed: Tue 15 Jul, 2pm"
      │       → continues at Scenario 1 on the new date
      ├─ Decline → [WA] handyman: "Customer declined" → keep original or cancel [2]
      └─ No reply 48h → [WA] nudge once → still nothing → admin queue [12]
```

**Reconciliation when the handyman doesn't initiate (F5).** A reschedule is inherently voluntary — nobody *must* propose one — so non-initiation matters in two specific cases:
- **The customer asked for a change** (arrives as free text via F3): the admin sees it in the inbound queue and, if the handyman doesn't act on a forwarded request within 24h, applies the change directly via admin-as-actor `scheduleChange` (typically after a phone call) — approval prompts are skipped, actor recorded as `via: 'admin'`.
- **A proposal is addressed TO the handyman** (roles-flipped reschedules from Scenarios 7/8): same ladder as customers get — 24h nudge, 48h admin queue; the admin can accept/decline on the handyman's behalf or force-unassign (Scenario 2 machinery) if the handyman has gone dark.

---

### Scenario 4 — ASAP job: fixing the visit time after acceptance

**Problem.** ASAP jobs have no `preferredDate`, so the completion poll never auto-fires for them, the date gate is inert, and nothing ever pins down when the visit actually happens.

**Solution.** Reuse Scenario 3's machinery with a different trigger: on accepting an ASAP job, the handyman's job page shows a prominent "Set visit time" action (and the acceptance flow prompts for it immediately). Proposal → customer Approve/Decline prompt → on approve, `scheduleChange` writes the concrete `preferredDate`/`preferredTime` and marks `scheduledFromAsapAt`, which makes the poll and date gate work normally from then on. The customer's acceptance message says "your handyman will confirm the exact visit time shortly", so silence has a face.

**Reconciliation when the handyman doesn't initiate (F5) — mandatory here, unlike Scenario 3, because an ASAP job without a fixed time can never complete.** The full ladder:

| Clock (from acceptance) | Action |
|---|---|
| 0h | In-app "Set visit time" prompt on accept + persistent banner on the job |
| +24h | [WA] `prompt_nudge` to the handyman ("Job #… needs a visit time — the customer is waiting") |
| +48h | Second nudge + job enters the admin "Attention needed" queue |
| +72h | Admin forcing actions: set the time admin-as-actor (after calling both parties), force-unassign → re-release (Scenario 2 machinery, handyman's cancellationCount incremented), or offer the customer cancel + refund [9]. Customer gets a "we're on it" notice so they're not in the dark. |

**Flow.**
```
ASAP job accepted [A] → handyman prompted: "Set visit time"
      → [F] proposeSchedule → [WA] customer: Approve / Decline
      ├─ Approve → [F] scheduleChange: concrete date set (job now behaves as scheduled)
      │       → continues at Scenario 1
      ├─ Decline → handyman proposes another slot (max 3 open rounds, then admin)
      └─ No proposal → F5 ladder above (24h nudge → 48h admin queue → 72h forcing action)
```

---

### Scenario 5 — Same-day "running late" notice (one-way, no approval)

**Solution.** Button on the handyman's job page, enabled on the visit day: "Running late" with picks (+30 min / +1 h / +2 h / custom note). Sends the customer a one-way notice, appends to `lateNotices[]` on the job, no prompt opened, no reply expected (replies fall to F3 → admin). Rate-limited to 3/day/job. Reduces premature no-show reports (Scenario 7).

**Flow.**
```
Visit day → handyman [A] "Running late: +1h"
      → [WA] customer: "Ah Seng is running ~1h late, new ETA ~3pm. Sorry!"
      → logged on job → job continues normally
```

---

### Scenario 6 — Handyman swap after inspection (late lifecycle)

**Problem.** The shipped cancel is blocked once `completionPollSentAt` is set — but the auto-poll fires the day *after* `preferredDate`, which is exactly when a post-inspection "I'm not fit for this" surfaces. The customer may simultaneously hold a "did the handyman complete the job?" poll for a job that now needs a new handyman.

**Solution.** Relax the cancel window with a corrective path instead of a hard block: cancel remains allowed while `status === 'in_progress'` even if the poll was sent, PROVIDED the poll prompt is still open (customer hasn't answered). The cancel then: supersedes the open completion prompt, sends the customer a corrective message ("This job is not complete — your handyman couldn't continue; we're finding a new one. Your payment stays protected."), clears `completionPollSentAt`, and proceeds exactly as Scenario 2 (re-release, fan-out, exclusions). After re-claim, the new handyman re-fixes the time via Scenario 3/4. If the customer already answered YES (job in `pending_admin_approval`), self-serve cancel stays blocked — that contradiction goes to the admin.

**Flow.**
```
Scheduled visit happens → handyman inspects → not fit for job
      → [A] "Can't do this job?" (reason: job_bigger_than_expected / …)
      → [F] cancelJobAssignment (extended window):
            supersede open completion prompt, clear poll marker,
            history appended, job re-released
      → [WA] customer corrective notice → fan-out round N+1 [2]
      → new handyman accepts → "Set visit time" [3/4] → Scenario 1 on new date
```

---

### Scenario 7 — Handyman no-show (customer-reported)

**Solution.** Two report entry points: (a) a third quick-reply option on the completion poll — "Handyman never came"; (b) free-text intents ("no show", "never came", "didn't come") recognized by the router any time on/after the visit date. Report → job flagged (`noShowReports[]`, handyman profile `noShowCount` incremented — display-only, like `cancellationCount`), admin alerted, and the customer immediately gets a **choice prompt**: 1 = reschedule with the same handyman (→ Scenario 3, handyman must approve this time), 2 = new handyman (→ admin-confirmed forced un-assign, then Scenario 2's re-release; v1 keeps a human in the loop rather than letting one WhatsApp reply strip a job), 3 = cancel and refund (→ Scenario 9). The handyman is notified a no-show was reported and can dispute to the admin (protects against wrong-address/customer-error cases).

**Flow.**
```
preferredDate passes, nobody came
      → customer replies "no show" / taps poll option 3 [WA]
      → [F] record report, handyman notified + admin alerted
      → [WA] customer choice: 1 Reschedule / 2 New handyman / 3 Cancel & refund
      ├─ 1 → reschedule proposal to HANDYMAN for approval [3, roles flipped]
      ├─ 2 → [ADM] confirms un-assign → re-release + fan-out [2] → [4] for new time
      └─ 3 → cancellation + refund [9]
```

---

### Scenario 8 — Customer no-show / no access (handyman-reported)

**Solution.** Button on the handyman's job page, enabled on the visit day: "Can't access / customer not home" (optional photo later; v1 text note). Logs `accessIssues[]` on the job, notifies the admin, and sends the customer a prompt: 1 = reschedule (→ Scenario 3 with the handyman as approver), 2 = contact support. No fees in v1 (the Express-Interest modal's penalty copy is a separate, still-open product decision); repeated occurrences are visible to the admin via the log.

**Flow.**
```
Visit day → handyman at door, no access
      → [A] "Customer not home" (+note) → logged, admin alerted
      → [WA] customer: "Ah Seng couldn't reach you today.
             1 Reschedule / 2 Contact support"
      ├─ 1 → reschedule flow [3], handyman approves the new slot
      ├─ 2 / free text → F3 → admin mediates
      └─ No reply 48h → nudge → admin queue [12]
```

---

### Scenario 9 — Customer cancellation + refund

**Constraint.** Customers are anonymous-auth with no dashboard — WhatsApp is their only channel. Refunds stay admin-executed (golden rule: money movement is deliberate), but the request/confirmation is structured.

**Solution.** Customer texts "cancel" (intent-recognized any time pre-release) → router resolves which job (single active → direct; multiple → numbered picker) → confirmation prompt stating the policy ("Reply 1 to confirm cancelling Job #a1b2c3. Refund: full, minus payment-processing costs." — exact policy copy is an owner decision, see §6) → on confirm: job → `cancellation_requested`, assigned handyman (if any) is un-assigned + notified ("customer cancelled — no action needed"), job leaves the board, admin gets an actionable alert → admin executes the refund with the existing `refundPayment` → customer gets a refund-processed message. Jobs in `pending_confirmation` or later can't self-serve cancel (that's the dispute path).

**Flow.**
```
Customer [WA] "cancel"
      → [F] router: resolve job (picker if several) → confirm prompt with policy
      → customer confirms [WA]
      → [F] status='cancellation_requested', handyman un-assigned + notified [WA],
            off board, admin alerted
      → [ADM] refundPayment (existing, admin-only) → paymentStatus 'refunded'
      → [WA] customer: "Refund of $X processed — 5–10 business days"
```

---

### Scenario 10 — Price/scope change after inspection

Detailed in `docs/features/price-adjustment-flow.md`; this spec only fixes its integration points. The approval ride on F2 (`price_adjustment_approval` prompt, quick-reply Approve/Decline). **Delta collection (owner decision, §6):** (a) off-session charge on a saved card — requires adding `setup_future_usage` at booking; or (b) a Stripe Payment Link sent in the same thread — no card storage, customer taps and pays; recommended for v1. Declined adjustment → handyman chooses: proceed at original scope, or cancel via Scenario 2 (reason `job_bigger_than_expected`) with the customer offered Scenario 9. Frequently pairs with Scenario 11 (adjustment approved → second visit scheduled).

**Flow.**
```
Visit 1: inspection → bigger than booked
      → handyman [A] "Request price adjustment" (+amount, reason, photo optional)
      → [WA] customer: "+$120 — corroded pipe replacement. Approve / Decline"
      ├─ Approve → [WA] payment link for delta → paid → [F] job amount updated
      │       → proceed (often → second visit [11])
      ├─ Decline → handyman: proceed at original scope, or cancel [2] → customer may [9]
      └─ No reply 48h → nudge → admin queue [12]
```

---

### Scenario 11 — Second visit needed

**Solution.** Handyman taps "Needs another visit" (reason: parts/materials, bigger job, customer request + proposed date) → customer Approve/Decline prompt → on approve, a `visits[]` entry is appended and F4 `scheduleChange` moves the working date to the new visit (poll re-arms for it; Mark Complete's gate follows). The job stays `in_progress` across visits; Mark Complete is expected after the final visit. Repeatable (visit 3+) but each round is admin-visible; >2 visits alerts the admin.

**Flow.**
```
Visit 1 done, more work needed
      → handyman [A] "Needs another visit" (reason + proposed date)
      → [WA] customer: Approve / Decline
      ├─ Approve → [F] scheduleChange: visits[] appended, working date moved,
      │       poll re-armed for the new date
      │       → visit 2 happens → Mark Complete [A] → completion poll → Scenario 1 tail
      ├─ Decline → F3/admin mediates (often becomes [10] price talk or [9] cancel)
      └─ No reply 48h → nudge → admin queue [12]
```

---

### Scenario 12 — Stuck-state timeouts (the safety net)

**Solution.** One scheduled function (daily, alongside `autoTriggerCompletionPoll`) sweeps for jobs stuck in any wait state, applies **one automated nudge**, then escalates to an admin "Attention needed" queue (a new section on the existing admin dashboard + the existing email transport). Since captured money now sits in the platform balance, every stuck job ends in an explicit admin decision: release, refund, reassign, or contact.

| Stuck state | Detection | Nudge | Escalate |
|---|---|---|---|
| Paid, never accepted | `status='pending'`, no handyman, age > 3d | re-run fan-out (new marker round, exclusions respected) | 7d: admin + offer customer cancel/refund [9] |
| Re-released, never re-claimed | same, with `reassignmentCount > 0`, age > 2d | fan-out nudge | 4d: admin |
| Completion poll unanswered | prompt `open` > 48h | resend poll once | 5d: admin decides (call customer / release / refund) |
| Any other open prompt expired | F2 `expiresAt` passed | one nudge template | admin queue |
| ASAP job, no time fixed | accepted, no `preferredDate`, > 24h | nudge handyman (24h, again 48h) | 72h: admin forcing actions (set time / force-unassign / offer refund) — full ladder in Scenario 4 |
| Handyman-addressed prompt unanswered | prompt `toRole: 'handyman'` open > 24h | nudge handyman | 48h: admin answers on their behalf or force-unassigns (F5 admin-as-actor) |
| Customer reschedule request idle | forwarded F3 request, no handyman action | — | 24h: admin applies scheduleChange admin-as-actor |
| Cancellation requested, refund not executed | `cancellation_requested` > 2d | — | admin (it's already their queue; this re-alerts) |

**Flow.**
```
[F] nightly sweep → stuck job detected
      → nudge the owing party per the F5 ladder (bounded: one or two per stuck state)
      → still stuck at threshold → admin "Attention needed" queue + email
      → [ADM] resolves: release / refund / force re-release / apply step
         admin-as-actor / mark resolved
```

## 5. What this does NOT change

- Fund release remains admin-only; no flow here moves money to a handyman automatically (golden rule).
- The dispute path (customer replies NO to the poll) is untouched.
- Job board, fan-out, reassignment mechanics stay as shipped; Scenarios 3/4/6 compose with them.
- No customer accounts/logins are introduced; WhatsApp remains the customer's only interface.

## 6. Open owner decisions (to settle at plan time)

1. **Refund policy copy** (Scenario 9): full refund vs minus processing fee; different pre/post-acceptance?
2. **Price-adjustment delta collection** (Scenario 10): payment link (recommended) vs saved-card off-session.
3. **Penalty copy** in the Express-Interest modal ("$20 penalty") — implement, soften, or remove; interacts with Scenarios 2/7/8 counters.
4. **No-show → new handyman** (Scenario 7 option 2): keep admin confirmation in the loop (recommended) or fully automatic un-assign.

## 7. Suggested build order

1. **Scenario 0** (capture at booking) — smallest change, fixes a live financial bug and probably the fan-out trigger; ship independently and first.
2. **F2 + F3** (pending prompts + no-silent-drops) — the router foundation; migrate the completion poll onto it.
3. **Scenarios 3 + 4 + F4** (reschedule + ASAP time-fixing + schedule single-writer) — one machinery, two triggers; highest frequency.
4. **Scenario 12** (stuck sweeps + admin attention queue) — the net under everything above.
5. **Scenarios 7 + 8 + 5** (no-shows + running late) — reporting + choice prompts reusing 3/4.
6. **Scenario 9** (customer cancel + refund request).
7. **Scenarios 10 + 11** (price adjustment integration + second visits), alongside the existing price-adjustment spec.
8. **Scenario 6** (late-lifecycle swap window relaxation) — small delta on shipped code, but depends on F2 (prompt supersede).

Each stage is independently shippable and testable; every stage after 1 rides on the F2 router.
