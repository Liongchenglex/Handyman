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
| 0 | Capture escrow at booking | **Built** (2026-07-12, stage 1 — capture at booking + canceled-auth alarm) |
| 1 | Happy flow (done on schedule) | Built (auto-poll YES now counts — inert-confirm fix shipped with stage 4) |
| 2 | Handyman cancels → re-release | Built (2026-07-11) |
| 3 | Reschedule | **Built** (2026-07-13 — both directions: handyman proposal + customer pick via F6 links; admin Trigger B) |
| 4 | ASAP job: fixing the visit time | **Built** (2026-07-13 — accept-with-proposal, decline→link, admin doors) |
| 5 | Same-day "running late" notice | New |
| 6 | Handyman swap after inspection (late lifecycle) | Partial — self-serve cancel still blocked once completion poll sent; admin force-unassign (stage 4) covers the wedge |
| 7 | Handyman no-show | ✅ **DONE** 2026-07-30 (plan `2026-07-30-no-show-and-price-adjustment.md`) |
| 8 | Customer no-show / no access | New |
| 9 | Customer cancellation + refund | **Deferred — manual via admin** (owner decision 2026-07-13; queue Refund button / Stripe Dashboard) |
| 10 | Price/scope change after inspection | ✅ **DONE** 2026-07-30 (plan `2026-07-30-no-show-and-price-adjustment.md`) |
| 11 | Second visit needed | New — design expanded 2026-07-25, rev 2026-07-29 (disposition prompt; poll 3rd button + NO follow-up) |
| 12 | Stuck-state timeouts | **Built** (2026-07-13, stage 4 — sweep ladders + attention queue with forcing actions) |

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
  type: schedule_approval | schedule_pick_approval | second_visit_approval |
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

1. **Deadline** — every expected initiation/answer has an explicit clock (stored on the prompt's `expiresAt`, or on the job for initiations that have no prompt yet, e.g. "ASAP time still unconfirmed after the customer declined the proposed slot").
2. **One or two automated nudges** — WhatsApp `prompt_nudge` to the owing party (plus in-app visibility for handymen); nudge counts are bounded, never infinite.
3. **Admin queue with forcing actions** — after the ladder is exhausted, the job lands in Scenario 12's "Attention needed" queue, where the admin can always resolve it because of the **admin-as-actor principle**: the admin may perform any party's step on their behalf (set a visit time after a phone call, apply a reschedule, force-unassign a handyman and re-release, or offer the customer cancel + refund). Every admin-as-actor write records the actor (`...By`, `via: 'admin'`) so the audit trail never pretends the party did it themselves.

The sweep engine for all of this is Scenario 12 — F5 is the policy, 12 is the machinery.

**F6 — Secure schedule links (customer deep-link picker).** Customers have no accounts, so when *they* need to choose a visit time (Scenario 3 Trigger B, or after declining a handyman's proposal), we send a one-time, job-scoped URL to a new public `/pick-time` page instead of making them dictate times over free text. The link itself is the credential; its design assumes URLs leak:

```
scheduleLinks/{tokenHash}            // SHA-256 of the token — raw token is never stored
  jobId, customerPhone
  purpose: 'pick_time'
  status: active | used | revoked | expired
  createdAt, expiresAt (72h), createdBy ('system_decline' | admin uid), usedAt
```

- **Token**: 128-bit crypto-random, delivered as `https://<app>/pick-time?t=<token>`. Firestore holds only the hash, so a DB read leak yields no usable links; a leaked URL is scoped to one job, one action (picking a time), 72 hours.
- **Server-mediated only**: the page calls two rate-limited Cloud Function endpoints — one validates the token (hash exists, `active`, unexpired, job still `in_progress`) and returns minimal context (job title, current schedule, handyman first name); one submits the pick (validated with the same `validateScheduleProposal` rules: strict date, min today, max +90d, bounded time string). Firestore rules deny ALL client access to `scheduleLinks`; the token grants nothing beyond these two endpoints.
- **Single-use and revocable**: submitting consumes the link in the same transaction that opens the follow-up prompt. Issuing a new link revokes prior active ones for the job, and applying any `scheduleChange` (F4) revokes open links — a stale link can never resurrect a settled schedule.
- **The pick never applies directly** — it opens a roles-flipped `schedule_pick_approval` prompt to the handyman (see Scenario 3). Links move no money (§2b holds).

**Template pack** (all Utility; submit early; freeform fallback until approved, matching existing pattern): `schedule_proposal` (shared by Scenario 3 reschedules and Scenario 4 ASAP time-fixing — shipped, env `TWILIO_TEMPLATE_SCHEDULE_PROPOSAL`), `schedule_link` (carries the F6 URL — required because admin-triggered sends can fall outside the 24h session window), `second_visit_proposal`, `visit_disposition` (per-job deep-link message, Scenario 11 Door 2), `running_late_notice`, `no_show_choice`, `customer_cancel_confirm`, `refund_processed`, `prompt_nudge`. Note: the completion poll template gains a third quick-reply button ("He's coming back") and a NO reply opens a follow-up disambiguation prompt (Scenario 11 Door 3) — the follow-up's "never came" branch is Scenario 7's poll entry point.

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
      → handyman taps Mark Complete [A] → completion poll [WA, quick-reply YES/NO
        as built; stage 6 adds a "coming back" button + NO follow-up — Scenario 11 Door 3]
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

**Trigger.** Handyman needs a different time (initiates in-app), or customer asks (arrives as free text → F3 → admin sends the customer an F6 schedule link so they pick the time themselves; auto-detecting reschedule intent from free text is v2).

**Solution — handyman-initiated (Trigger A).** Handyman taps "Propose new time" on the job (date+time picker + optional note) → `proposeSchedule` [F] opens a `schedule_approval` prompt and sends the customer a quick-reply template ("Ah Seng proposes Tue 15 Jul, 2pm — Approve / Decline"). Approve → F4 `scheduleChange` applies it, both parties get confirmations. **Decline → the customer is immediately sent an F6 schedule link** ("No problem — pick a time that works for you: <link>"; rides the free 24h session window since the customer just replied) and the handyman is notified ("Customer declined; they've been asked to pick a time"). Prompt expires in 48h → nudge → admin (Scenario 12). A new proposal supersedes an open one and revokes any active link.

**Solution — customer-initiated (Trigger B).** Free text lands in F3 (admin inbox) as today. The admin, from the AdminDashboard **Active-jobs table** (new: lists `in_progress` jobs with customer, handyman, current schedule, and schedule state), clicks **"Send reschedule link"** → admin-authed endpoint issues an F6 token (revoking prior ones) and sends the customer the `schedule_link` template. Admin stays the bottleneck for v1 by design.

**Customer pick → handyman approves (both triggers converge here).** The customer's pick on `/pick-time` does NOT apply directly — it opens a roles-flipped `schedule_pick_approval` prompt to the **handyman** ([WA] "Customer picked Tue 15 Jul, 2pm — Approve / Decline"; the job page also shows the pending pick read-only). Approve → F4 `scheduleChange` (history records `via: 'customer_link'`) → both parties confirmed. **Handyman declines → straight to the admin "Attention needed" queue — no third automated round, ever.** The bounded worst case is: handyman proposal → customer decline → customer pick → handyman decision → done or admin.

**Flow.**
```
── How a reschedule starts (or doesn't) ──────────────────────────────
Trigger A: handyman wants a new time
      → [A] "Propose new time" → proposal→approval below
Trigger B: customer asks for a change
      → [WA] free text → F3 → admin inbox
      → [ADM] Active-jobs table: "Send reschedule link"
      → [F] issue F6 token → [WA] customer: schedule_link template
      → customer pick→approval below
Nobody moves and the date passes anyway (silent handyman)
      → day after preferredDate: completion poll fires [1]
      → customer replies "never came" → Scenario 7 takes over
── Proposal → approval (handyman proposed) ──────────────────────────
Handyman [A] "Propose new time" (new date/time + note)
      → [F] proposeSchedule: open prompt → [WA] customer: Approve / Decline
      ├─ Approve → [F] scheduleChange: preferredDate/Time updated,
      │       completionPollSentAt cleared, scheduleHistory appended
      │       → [WA] both parties: "New time confirmed: Tue 15 Jul, 2pm"
      │       → continues at Scenario 1 on the new date
      ├─ Decline → [F] issue F6 link → [WA] customer: "Pick a time: <link>"
      │       + [WA] handyman: "Customer declined; they're picking a time"
      │       → customer pick→approval below
      └─ No reply 48h → [WA] nudge once → still nothing → admin queue [12]
── Customer pick → approval (roles flipped) ─────────────────────────
Customer opens /pick-time (token validated server-side)
      → picks date/time (+ note) → [F] submitSchedulePick:
        link consumed + schedule_pick_approval prompt opened (transaction)
      → [WA] handyman: "Customer picked Tue 15 Jul, 2pm — Approve / Decline"
      ├─ Approve → [F] scheduleChange (via 'customer_link')
      │       → [WA] both parties confirmed → Scenario 1 on the new date
      ├─ Decline → admin queue [12] (schedule deadlock — no third round)
      │       → [WA] customer: "We're arranging it — you'll hear from us"
      ├─ No reply → 24h nudge → 48h admin queue [12]
      └─ Link unused 72h → expires → nudge once → admin queue [12]
```

**Reconciliation when nobody initiates (F5).** A reschedule is inherently voluntary — nobody *must* propose one — so non-initiation matters in three specific cases:
- **The customer asked for a change** (free text via F3): the admin sends the F6 link (Trigger B above). If the customer never uses it, the 72h expiry → nudge → admin queue ladder catches it.
- **A pick or proposal is addressed TO the handyman** (`schedule_pick_approval` here; roles-flipped reschedules from Scenarios 7/8): 24h nudge, 48h admin queue; the admin can accept/decline on the handyman's behalf or force-unassign (Scenario 2 machinery) if the handyman has gone dark.
- **Schedule deadlock** (handyman declined the customer's pick): lands in the admin queue immediately — this is the ping-pong cap. Admin forcing actions as in Scenario 4's ladder.

---

### Scenario 4 — ASAP job: fixing the visit time after acceptance

**Problem.** ASAP jobs have no `preferredDate`, so the completion poll never auto-fires for them, the date gate is inert, and nothing ever pins down when the visit actually happens.

**Solution.** Reuse Scenario 3's machinery, but the initial proposal is **part of the accept step itself**: for ASAP jobs, the Express Interest confirmation modal includes a required date/time picker — the handyman cannot claim the job without proposing a visit time, and claiming submits the claim and the proposal together. That eliminates the "accepted but never proposed" window at the source. On customer approval, `scheduleChange` writes the concrete `preferredDate`/`preferredTime` and marks `scheduledFromAsapAt`, which makes the poll and date gate work normally from then on. The customer's acceptance message names the proposed time and asks for the approval right away.

**Decline flow (shared with Scenario 3).** Customer declines the proposed slot → the customer is immediately sent an F6 schedule link to pick their own time, and the pick goes back to the handyman as a `schedule_pick_approval` prompt — Scenario 3's "customer pick → approval" branch verbatim. This replaces the old "handyman re-proposes, max 3 rounds" loop: the sequence is bounded at one handyman proposal → one customer pick → handyman decision → done or admin.

**How the admin steps in (F5).** Exactly three doors, all landing in the same "Attention needed" queue (Scenario 12 + Active-jobs table flag + F3 email):

| Door | When |
|---|---|
| Schedule deadlock | Handyman declines the customer's pick — **immediate**, no further automated rounds |
| Link ignored | Customer declined but never used the link — 72h expiry → one nudge → queue |
| Handyman silent | No reply to the customer's pick — 24h `prompt_nudge` → 48h queue |

Forcing actions (all admin-as-actor, recorded `via: 'admin'` in `scheduleHistory`): set the time directly after phoning both parties; force-unassign → re-release (Scenario 2 machinery, cancellationCount incremented); or offer the customer cancel + refund [9]. The customer gets a "we're arranging it" notice when a job enters the queue.

**Flow.**
```
ASAP job: [A] accept modal REQUIRES proposed date/time → claim + proposal submitted together
      → [F] proposeSchedule → [WA] customer: Approve / Decline
      ├─ Approve → [F] scheduleChange: concrete date set (job now behaves as scheduled)
      │       → continues at Scenario 1
      ├─ Decline → [F] issue F6 link → [WA] customer picks own time
      │       → [WA] handyman: Approve / Decline (Scenario 3 pick→approval branch)
      │       ├─ Approve → [F] scheduleChange → Scenario 1
      │       └─ Decline / silent / link unused → admin doors above
      └─ No reply 48h → nudge → admin queue [12]
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

*(Rev 2026-07-30 — owner decision §6.4 resolved: **admin confirms** the new-handyman un-assign (recommended option). Option-3 routing updated for the Scenario 9 deferral: cancel-and-refund lands in the admin attention queue's existing Refund machinery, not a structured WA cancel flow. The stage-6 stub (poll follow-up "never came" → attention flag + email only) is replaced by this full flow.)*

**Solution.** Two report entry points: (a) the "handyman never came" branch of the completion poll's NO follow-up prompt (see Scenario 11 Door 3 — shipped as `completion_no_followup` action `never_came`, currently stubbed to the admin queue; this scenario replaces the stub); (b) free-text intents ("no show", "never came", "didn't come") recognized by the router on/after the visit date — v1 implements this in the no-open-prompt path (an unmatched reply while other prompts are open still falls to F3/admin, unchanged). Report → job flagged (`noShowReports[]` entry with `via`, handyman profile `noShowCount` incremented — display-only, like `cancellationCount`), admin alerted, handyman notified (`no_show_reported` template) with a dispute path (reply → F3 → admin; protects against wrong-address/customer-error cases), and the customer immediately gets a **choice prompt** (`type: 'no_show_choice'`):

- **1 = Reschedule with the same handyman** → customer is sent an F6 pick-time link (rides the session window they just opened) → their pick goes to the handyman as `schedule_pick_approval` — Scenario 3's roles-flipped rails verbatim.
- **2 = New handyman** → `buildAttentionUpdate('no_show_new_handyman')` + admin email; the admin confirms via the existing force-unassign queue action (→ Scenario 2 re-release; the new claimant re-fixes the time via 3/4). One WhatsApp reply never strips a job without a human look. Customer ack: "we're finding you a new handyman."
- **3 = Cancel and refund** → Scenario 9 is deferred-manual, so this flags `buildAttentionUpdate('no_show_refund_requested')` + admin email; the admin executes via the queue's existing Refund button. Customer ack: "our team will process your refund shortly."
- **No reply** → generic prompt ladder (48h expiry → nudge → admin queue [12]).

**Flow.**
```
preferredDate passes, nobody came
      → customer: poll NO → follow-up "never came" [11 Door 3], or free text [WA]
      → [F] noShowReports[] + noShowCount++, handyman notified (can dispute),
            admin alerted
      → [WA] customer choice: 1 Reschedule / 2 New handyman / 3 Cancel & refund
      ├─ 1 → [F] F6 pick-time link → customer picks
      │       → handyman schedule_pick_approval [3, roles flipped]
      ├─ 2 → attention queue → [ADM] force-unassign → re-release + fan-out [2]
      ├─ 3 → attention queue → [ADM] Refund button (Scenario 9 machinery, manual)
      └─ No reply 48h → nudge → admin queue [12]
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

> **DEFERRED — handled manually in v1 (owner decision 2026-07-13).** No structured in-WA cancel flow ships. The manual path: customer emails easydonehandyman@gmail.com (or their free-text "cancel" lands in the F3 admin inbox) → admin refunds via the attention queue's **Refund** button (available for in-progress and flagged jobs; refund-then-cancel with the Finish-cancelling recovery) or, for a paid job not listed in the queue (e.g. unclaimed and not yet swept), directly in the **Stripe Dashboard** — the unclaimed sweep will surface such jobs within 3–7 days anyway. The `refundPayment` endpoint stays admin-authorized; escrow rules (§2b row 9) are unchanged. The structured flow below is kept as the v2 design.

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

*(Rev 2026-07-30 — owner decision §6.2 resolved: **approve-by-paying**. Supersedes `price-adjustment-flow.md`'s locked decisions 1 and 3 — the magic-link breakdown page and off-session saved-card charge are dropped; that doc's range-cap rule (decision 2: delta capped at the service's published `priceMax`) and its reason-required rule survive. Chosen for least downstream problems: payment and approval are one event, so an "approved but unpaid" limbo state can never exist and needs no ladder; no card-on-file compliance surface; rides existing rails (template send, F2 prompt, `stripeWebhook`).)*

**Solution.** The customer's payment IS the approval. Handyman taps "Request price adjustment" in-app (delta amount + mandatory reason + optional note; server validates `job.status === 'in_progress'`, delta > 0, and original + delta ≤ the service's `priceMax`) → `requestPriceAdjustment` [F] creates a Stripe **Payment Link / Checkout Session** for the delta (metadata: `jobId`, `adjustmentId`; line item named for the reason), sets a `priceAdjustment` entry (`status: 'pending_payment'`) — singular object, not an array (plan 2026-07-30: singular, one adjustment at a time in v1) — sends the customer the `price_adjustment` template (amount, reason, link), and opens an F2 prompt (`type: 'price_adjustment_choice'`, **decline-only options** — the pay-link is the approve path, mirroring how `visit_disposition`'s deep link is its answer path).

- **Customer pays** → `stripeWebhook` (`checkout.session.completed`, matched by metadata) → transaction: adjustment `status: 'paid'` (+ delta PaymentIntent id recorded), job amount increased, decline prompt superseded → both parties confirmed [WA], admin FYI email. The delta sits in the platform balance as a **second held pot** (§2b row 10 unchanged): released together with the original at admin release, refundable before it.
- **Customer replies Decline** → adjustment `status: 'declined'`, payment link deactivated, handyman notified [WA]: proceed at the original scope (no action needed — just do the work) or cancel via Scenario 2 (reason `job_bigger_than_expected`, existing button); admin FYI. No automated renegotiation round.
- **No reply** → the prompt rides the generic 48h expiry → nudge → admin-queue ladder (Scenario 12, existing). A payment that arrives after expiry/decline is guarded in the webhook: applied only if the job is still `in_progress` and the adjustment still `pending_payment`; otherwise flagged to the admin queue for a manual delta refund — money never silently sticks.
- **Gates while `pending_payment`:** Mark Complete is blocked in-app, and the auto-poll + Door 2 disposition prompt skip the job (same pattern as `hasPendingSecondVisit`) — a job mid-price-talk must not be polled "is it done?".
- Frequently pairs with Scenario 11 (adjustment paid → second visit scheduled). Admin fund-release view shows original + delta and the adjustment history.

**Flow.**
```
Visit 1: inspection → bigger than booked
      → handyman [A] "Request price adjustment" (+amount ≤ priceMax, reason)
      → [F] requestPriceAdjustment: Stripe payment link created,
            priceAdjustment entry 'pending_payment' (singular), Mark-Complete gate on
      → [WA] customer: "+$120 — corroded pipe replacement.
             Pay here to approve: <link> — or reply NO to decline"
      ├─ Pays → [F] stripeWebhook checkout.session.completed:
      │       adjustment 'paid', job amount += delta, prompt superseded
      │       → [WA] both parties confirmed → proceed (often → [11])
      ├─ Decline → adjustment 'declined', link deactivated
      │       → [WA] handyman: proceed at original scope, or cancel [2]
      └─ No reply 48h → nudge → admin queue [12]; late payment → webhook
              guard applies-or-flags (no silent stick)
```

---

### Scenario 11 — Second visit needed

*(Expanded 2026-07-25 — owner brainstorm: entry into this flow must not depend on the handyman remembering to tap a button.)*

**Problem.** As originally sketched, the flow fired only if the handyman tapped "Needs another visit." If they finished visit 1 and forgot, the day-after completion poll asked the customer to verify completion of a job both parties knew was half-done; the customer's NO landed a routine second visit in `disputed`. Goal: make entry near-unmissable without depending on anyone's initiative — "forget" must become "ignored a direct question," which the F5 ladders already handle.

**Solution — three independent entry doors.**

**Door 1 — in-app button (original design, unchanged).** Handyman taps "Needs another visit" (reason: parts/materials, bigger job, customer request + proposed date) → customer Approve/Decline prompt → on approve, a `visits[]` entry is appended and F4 `scheduleChange` moves the working date to the new visit (poll re-arms for it; Mark Complete's gate follows). The job stays `in_progress` across visits; Mark Complete is expected after the final visit. Repeatable (visit 3+) but each round is admin-visible; >2 visits alerts the admin.

**Door 2 — evening visit-disposition prompt (new; the "can't forget" net).** A scheduled function (early evening daily, ~7pm SGT, separate from the morning sweep) finds visit-day jobs the handyman went silent on — `preferredDate` = today, `status='in_progress'`, no `completionPollSentAt`, no pending second-visit entry — and sends the handyman a **per-job deep link**, not numbered reply options:

> "How did today's job go — {title} @ {area}? Tap to update: `https://<app>/jobs/{id}?action=disposition`"

The link opens the handyman's normal authed job page with a disposition sheet auto-opened: **Job's done** (= the existing Mark Complete, one tap) / **Needs another visit** (= Door 1's modal, date picker inline) / **Problem — can't finish** (note → admin via F3 transport; customer told "we're looking into it" — often resolves into [6] swap or [10] price talk). Deep link over numbered WA replies is a deliberate v1 choice: handymen have accounts (no F6 token machinery needed — just normal auth), per-job links stay unambiguous on multi-job days (compound numbered disambiguation risks binding a reply to the *wrong* job — a mis-marked completion), and the most important branch (needs-another-visit) requires the in-app date picker anyway, so the link makes it one continuous flow. An F2 prompt record (`type: visit_disposition`) is still written so sweeps and audit ride the standard rails; a text reply instead of a tap falls through to F3 (reply parsing for single-open-prompt cases is v2).

**Door 3 — customer poll third option (backstop when the handyman ignores Door 2).** The completion poll gains one option — staying within WhatsApp's 3-button quick-reply cap, so it remains a button template (no numbered-list rework):

> "Did {name} complete your job? **1** Yes, all done / **2** No / **3** He's coming back for another visit"

1 → `pending_admin_approval` (unchanged tail). **3 → second-visit intent recorded from the customer side**: `visits[]` entry `pending_schedule`, customer reassured, handyman pinged to propose the return date via Door 1's picker (ladder below if silent). **2 (No) no longer lands in `disputed` directly — it opens a follow-up disambiguation prompt** (F2 `type: completion_no_followup`; rides the session window the customer just opened, so freeform is fine):

> "Sorry to hear that — what happened? **1** There's a problem with the work / **2** The handyman never came"

Follow-up 1 → `disputed`, admin mediates (today's NO tail, unchanged semantics). Follow-up 2 → Scenario 7 no-show flow (this branch is the poll entry point Scenario 7 needs). Follow-up silence → 24h nudge → 48h admin queue [12], flagged "unresolved NO" — a bare NO with no reason is exactly the ambiguity that used to mislabel routine second visits as disputes, so it is never left hanging.

**When the poll fires — and how conflicts resolve.** The poll is the customer-verification gate before any release (golden rule), so it is never skipped when a completion claim exists; what varies is trigger and timing:

| Handyman state by visit-day evening | Disposition link (Door 2) | Customer poll |
|---|---|---|
| Marked complete (app or via link) | not sent / already used | fires **immediately** at mark-complete, as today — verifies the claim |
| Flagged "needs another visit" | not sent / already used | **suppressed** — nothing to verify yet; re-arms for the visit-2 date via F4 |
| Silent | sent ~7pm | fires **next morning** as backstop — customer becomes the reporter |

Conflicts when the handyman claimed complete but the customer answers otherwise — bounded at one automated round, then admin:
- **NO → "problem with the work"** → `disputed`, admin mediates (unchanged).
- **NO → "never came"** → hard contradiction (he claimed complete) → Scenario 7 report + immediate admin flag (handyman dispute path per Scenario 7).
- **3 (coming back)** → soft contradiction (commonly benign — "done for today" vs "he'll be back"): `pending_schedule` intent recorded, handyman prompted **once** — "Customer expects a return visit: propose a time, or confirm the job is complete." Proposing converges to Door 1; insisting complete or 24h silence → admin queue [12] (release / call / refund — admin decides). No automated ping-pong.

**Reconciliation ladders (F5; rows join the Scenario 12 sweep at build time).**

| Stuck state | Detection | Nudge | Escalate |
|---|---|---|---|
| Disposition link unanswered | `visit_disposition` open past visit-day midnight | none extra — the next-morning customer poll IS the backstop | normal poll ladders apply |
| Second visit needed, no date | `visits[]` entry `pending_schedule` > 24h, no open schedule prompt | `prompt_nudge` to handyman | 48h: admin queue — set time admin-as-actor / force-unassign [2] / offer refund [9] |
| Poll NO follow-up unanswered | `completion_no_followup` open > 24h | one nudge to customer | 48h: admin queue, flagged "unresolved NO" |

**Data model.** `visits[]` entries: `{proposedDate?, status: 'pending_schedule'|'scheduled'|'done', reason, reportedVia: 'app'|'disposition_link'|'customer_poll'|'admin', createdAt, promptId?}`. New F2 prompt types `visit_disposition` and `completion_no_followup`. Completion-poll prompt gains option 3. No new money paths (§2b row 11 unchanged).

**Flow.**
```
Visit day ends, job still in_progress
      ├─ handyman [A] Mark Complete → poll (3-button) fires now
      │       → 1 done → Scenario 1 tail ; 2 no / 3 coming back → conflict handling above
      ├─ handyman [A or link] "Needs another visit" (reason + proposed date)
      │       → [WA] customer: Approve / Decline
      │       ├─ Approve → [F] scheduleChange: visits[] appended, working date moved,
      │       │       poll re-armed for the new date
      │       │       → visit 2 happens → Mark Complete [A] → poll → Scenario 1 tail
      │       ├─ Decline → F3/admin mediates (often becomes [10] price talk or [9] cancel)
      │       └─ No reply 48h → nudge → admin queue [12]
      ├─ handyman silent → ~7pm [F] disposition prompt [WA deep link]
      │       → still silent → next morning: customer poll (backstop, 3-button)
      │       ├─ 1 done → pending_admin_approval → Scenario 1 tail
      │       ├─ 2 no → follow-up: 1 problem → disputed / 2 never came → Scenario 7
      │       │       └─ no reply → 24h nudge → 48h admin queue [12] ("unresolved NO")
      │       └─ 3 coming back → visits[] pending_schedule → handyman picks date
      │               → no date 24h → nudge → 48h admin queue [12]
      └─ (>2 visits on any path → admin alerted)
```

---

### Scenario 12 — Stuck-state timeouts (the safety net)

**Solution.** One scheduled function (daily, alongside `autoTriggerCompletionPoll`) sweeps for jobs stuck in any wait state, applies **one automated nudge**, then escalates to an admin "Attention needed" queue (a new section on the existing admin dashboard + the existing email transport). Since captured money now sits in the platform balance, every stuck job ends in an explicit admin decision: release, refund, reassign, or contact.

> **V1 machinery is fixed in `2026-07-13-stuck-state-sweep-design.md`** (owner decisions 2026-07-13): concrete thresholds, nudge markers, digest email, queue actions (mark resolved / set time admin-as-actor / force-unassign / refund), and the inert auto-poll fix. Where the table below and that doc disagree on timings, **that doc governs**. The "Cancellation requested" row is deferred out of v1.

| Stuck state | Detection | Nudge | Escalate |
|---|---|---|---|
| Paid, never accepted | `status='pending'`, no handyman, age > 3d | re-run fan-out (new marker round, exclusions respected) | 7d: admin + offer customer cancel/refund [9] |
| Re-released, never re-claimed | same, with `reassignmentCount > 0`, age > 2d | fan-out nudge | 4d: admin |
| Completion poll unanswered | prompt `open` > 48h | resend poll once | 5d: admin decides (call customer / release / refund) |
| Any other open prompt expired | F2 `expiresAt` passed | one nudge template | admin queue |
| ASAP job, no confirmed time | accepted, no `scheduledFromAsapAt`, no open `schedule_approval`/`schedule_pick_approval` prompt and no active F6 link > 24h | nudge handyman | 48h: admin forcing actions (set time / force-unassign / offer refund) — doors in Scenario 4 |
| Handyman-addressed prompt unanswered | prompt `toRole: 'handyman'` open > 24h (incl. `schedule_pick_approval`) | nudge handyman | 48h: admin answers on their behalf or force-unassigns (F5 admin-as-actor) |
| Schedule link unused | F6 link `active`, `expiresAt` passed | mark `expired`, one nudge to customer | admin queue (send a fresh link, set time admin-as-actor, or call) |
| Schedule deadlock | handyman answered `schedule_pick_approval` with Decline | — (not a sweep — flagged immediately at decline time) | admin forcing actions per Scenario 4; customer gets "we're arranging it" notice |
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
- No customer accounts/logins are introduced; the customer's interfaces are WhatsApp plus token-gated, single-use F6 deep-link pages (no session, no stored credentials).

## 6. Open owner decisions (to settle at plan time)

1. **Refund policy copy** (Scenario 9): full refund vs minus processing fee; different pre/post-acceptance? — still open (Scenario 9 deferred-manual).
2. ~~**Price-adjustment delta collection** (Scenario 10)~~ — **RESOLVED 2026-07-30: approve-by-paying payment link** (payment IS approval; see Scenario 10 rev note). Supersedes `price-adjustment-flow.md` decisions 1 & 3.
3. **Penalty copy** in the Express-Interest modal ("$20 penalty") — implement, soften, or remove; interacts with Scenarios 2/7/8 counters. — still open.
4. ~~**No-show → new handyman** (Scenario 7 option 2)~~ — **RESOLVED 2026-07-30: admin confirmation stays in the loop** (existing force-unassign queue action).

## 7. Build order — status as of 2026-07-13

All on branch `feature/job-lifecycle-flows` (stacks on `feature/job-reassignment`; merge that first, regular merge not squash). Every completed stage passed a whole-stage adversarial review; each plan carries its own E2E checklist, consolidated in `docs/features/e2e-test-plan-job-lifecycle.md`.

| Stage | Scope | Status |
|---|---|---|
| 1 | **Scenario 0** — capture at booking + canceled-auth alarm | ✅ **DONE** 2026-07-12 |
| 2 | **F2 + F3** — pending-prompt router + no-silent-drops; completion poll migrated | ✅ **DONE** 2026-07-12 |
| 3 | **Scenarios 3 + 4 + F4** — propose-time flows, ASAP accept-with-proposal, schedule single-writer | ✅ **DONE** 2026-07-13 (plan `2026-07-12-schedule-flows.md`) |
| 3b | **F6** — schedule links, `/pick-time`, `schedule_pick_approval`, decline→link, admin send-link | ✅ **DONE** 2026-07-13 (plan `2026-07-13-schedule-links.md`) |
| 4 | **Scenario 12** — stuck-state sweep ladders, attention queue + forcing actions (set time / force-unassign / refund / resolve), inert auto-poll fix | ✅ **DONE** 2026-07-13 (plan `2026-07-13-stuck-state-sweep.md`, machinery spec `2026-07-13-stuck-state-sweep-design.md`) |
| — | **Scenario 9** — customer cancel + refund | ⛔ **DEFERRED — manual via admin** (owner decision 2026-07-13; see Scenario 9 note) |
| 5 | **Scenarios 7 + 8 + 5** — no-shows + running late (reporting + choice prompts reusing 3/4) | Scenario 8 ✅ **DONE** 2026-07-30 (plan `2026-07-29-second-visit-and-access-issue.md`); Scenario 7 ✅ **DONE** 2026-07-30 (plan `2026-07-30-no-show-and-price-adjustment.md`); Scenario 5 not started |
| 6 | **Scenarios 10 + 11** — price adjustment integration + second visits, incl. visit-disposition prompt (Door 2), poll 3rd button + NO follow-up (Door 3), conflict handling + sweep rows | Scenario 11 ✅ **DONE** 2026-07-30 (plan `2026-07-29-second-visit-and-access-issue.md`); Scenario 10 ✅ **DONE** 2026-07-30 (plan `2026-07-30-no-show-and-price-adjustment.md`) — **stage complete** |
| 7 | **Scenario 6** — late-lifecycle swap window relaxation (self-serve; admin force-unassign already covers the wedge) | Not started |

Owner gates before the built stages are live: Stripe webhook subscriptions (`payment_intent.amount_capturable_updated` + `payment_intent.canceled`, both endpoints); Meta templates `schedule_proposal`, `schedule_link`, `prompt_nudge` (+ env SIDs; freeform fallback until approved); deploy functions + rules + **indexes** together; run the consolidated E2E plan.
