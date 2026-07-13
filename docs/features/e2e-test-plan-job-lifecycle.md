# E2E Test Plan — Job Lifecycle Branch (`feature/job-lifecycle-flows`)

Covers everything built on this branch: **Stage 1** (capture at booking), **Stage 2** (prompt router + no-silent-drops), **Stage 3** (schedule flows), **Stage 3b** (schedule links), **Stage 4** (stuck-state sweep + attention queue), plus cross-cutting money/rules invariants and the manual Scenario-9 path.

Run the suites in order — later suites assume earlier machinery works.

---

## 0. Setup (once)

**Deploy:** `firebase deploy --only functions,firestore:rules,firestore:indexes` (use `/Users/liongchenglex/.npm-global/bin/firebase`), then hosting. Wait for both new composite indexes (prompts CG `status+expiresAt`; scheduleLinks `status+expiresAt`) to finish building before Suite E.

**Stripe Dashboard:** both webhook endpoints subscribed to `payment_intent.amount_capturable_updated` AND `payment_intent.canceled` (in addition to existing events).

**Env / templates** (`functions/.env` for the project under test): `APP_URL` = the real frontend origin; template SIDs if approved — `TWILIO_TEMPLATE_SCHEDULE_PROPOSAL`, `TWILIO_TEMPLATE_SCHEDULE_LINK`, `TWILIO_TEMPLATE_PROMPT_NUDGE`, `TWILIO_TEMPLATE_HANDYMAN_CANCELLED`, `TWILIO_TEMPLATE_JOB_COMPLETION`. Unset SIDs fall back to freeform (fine in sandbox / inside a 24h session window).

**Actors:** CUST = a WhatsApp-reachable phone you control (books jobs); HM-A and HM-B = two verified handymen with WhatsApp-reachable phones in `handymen/{id}.phone`; ADMIN = admin login. Stripe test card `4242 4242 4242 4242`.

**Triggering scheduled functions manually:** `firebase functions:shell` → `autoTriggerCompletionPoll()` / `stuckStateSweep()` (or the Cloud Console "Test" tab). Never wait for 10:00/10:30 SGT.

**Conventions:** `[CUST]`/`[HM]`/`[ADM]` = who acts; **Verify** items are pass/fail checkboxes. "Firestore:" means check the doc in the console.

---

## Suite A — Stage 1: capture at booking (Scenario 0)

### A1. Money is captured at booking, not at release
Flow: `[CUST] book a job (Scheduled, date ≈ tomorrow) with test card → pay`
- [ ] Stripe Dashboard: the PaymentIntent shows **Succeeded/captured** (not "Uncaptured") within ~a minute of booking.
- [ ] Firestore job: `paymentStatus: 'succeeded'`, `paymentIntentId` present.
- [ ] HM-A and HM-B each receive the new-job WhatsApp fan-out (this proves the `payment_intent.succeeded` fan-out trigger fires).
- [ ] Job appears on the job board.

### A2. Lost authorization alarm
Flow: `Stripe Dashboard → cancel an UNCAPTURED test PaymentIntent for a booked job (create one by blocking the capture webhook temporarily, or use a stale pre-deploy booking)`
- [ ] Admin email arrives flagging the canceled authorization (re-collect needed).
- [ ] No crash/retry-loop in function logs.

*(Skip A2 if no uncaptured intent is available — it only exists in failure modes.)*

---

## Suite B — Stage 2: prompt router + F3 (completion flows)

### B1. Happy completion via handyman
Flow: `[HM-A] accept A1's job → on the visit day [HM-A] Mark Complete → [CUST] receives poll → reply YES`
- [ ] Job → `pending_admin_approval`; `customerConfirmedAt` set.
- [ ] Admin fund-release email arrives; job listed on `/admin/fund-release`.
- [ ] CUST gets the "thank you for confirming" reply.

### B2. Dispute via NO
Flow: `same as B1 but [CUST] replies NO`
- [ ] Job → `disputed`; appears on `/admin/disputed-jobs`.
- [ ] CUST gets the dispute acknowledgement.

### B3. Double answer is inert
Flow: `after B1, [CUST] replies YES again (and NO)`
- [ ] Reply gets the "already recorded as ✅ Confirmed" message; job status unchanged.

### B4. Unmatched free text → F3, never dropped
Flow: `[CUST] (no open prompts) sends "hello can you help me with something"`
- [ ] `inboundMessages` doc created (sender, body, best-guess job).
- [ ] Admin email with the message content.
- [ ] CUST gets the generic ack — and a SECOND free text within 12h gets **no** second ack (rate limit 1/12h) but still lands in `inboundMessages` + email.

### B5. Media-only message
Flow: `[CUST] sends a photo with no text`
- [ ] Reaches F3 (inboundMessages with media refs + admin email), webhook returns 200 (no 400 in logs).

### B6. Numbered disambiguation
Flow: `give CUST two open prompts (e.g. two jobs with completion polls) → [CUST] replies "YES"`
- [ ] CUST receives the numbered list ("You have 2 pending questions… reply e.g. 1 YES").
- [ ] `[CUST] "1 YES"` → the right job transitions; the other prompt stays open.

---

## Suite C — Stage 3: schedule flows (Scenarios 3 + 4, in-app direction)

### C1. ASAP claim requires a proposed time
Flow: `[CUST] book an ASAP job (pay) → [HM-A] Express Interest`
- [ ] Modal shows required date+time pickers; Confirm disabled until both filled; date input bounded today…+90d.
- [ ] On confirm: job assigned AND CUST receives acceptance + the proposal ("proposes to visit on … YES/NO"); HM-A's success alert names the proposal.
- [ ] Firestore: open `schedule_approval` prompt under `jobs/{id}/prompts` with the payload.

### C2. Customer approves the ASAP proposal
Flow: `[CUST] reply YES to C1`
- [ ] Job: `preferredDate`/`preferredTime` written, `preferredTiming: 'Schedule'`, `scheduledFromAsapAt` stamped, `scheduleHistory` entry `via: 'whatsapp_reply'`.
- [ ] Both parties get confirmations; prompt `answered`.

### C3. Reschedule a scheduled job (handyman-initiated)
Flow: `[HM-A] job page → "Propose new time" (new date/time + note) → [CUST] reply YES`
- [ ] CUST message includes the note; on YES the schedule updates, `completionPollSentAt` cleared (if it was set), history appended.
- [ ] A second proposal before the customer answers **supersedes** the first prompt (Firestore: old prompt `superseded`).

### C4. F4 single-writer enforced
Flow: `browser console as HM-A (job owner): updateDoc(jobs/{id}, { preferredDate: '2026-12-25' })`
- [ ] **Permission denied** (schedule fields are server-only on update).

### C5. Proposal validation
Flow: `[HM-A] propose with a past date (use curl with yesterday's date to bypass the min attribute)`
- [ ] 400 with code `date_past`; nothing sent to the customer, no prompt opened.

---

## Suite D — Stage 3b: schedule links (Scenarios 3 Trigger B + 4 decline flow)

### D1. Decline → auto-link
Flow: `fresh ASAP claim (C1 on a new job) → [CUST] reply NO`
- [ ] CUST receives the pick-time link (valid-72h copy); HM gets "they've been sent a link to pick a time".
- [ ] Firestore: `scheduleLinks/{hash}` doc `status: 'active'`, `createdBy: 'system_decline'`; the raw token appears NOWHERE in Firestore or logs.

### D2. Customer picks on /pick-time
Flow: `[CUST] open the link → page shows service, handyman name, current schedule → pick date/time + note → submit`
- [ ] Success screen ("will confirm your picked time"). Link doc → `used` with `pickedDate/pickedTime`.
- [ ] Any open `schedule_approval` prompt on the job → `superseded`.
- [ ] HM receives "Customer picked … Reply YES/NO"; open `schedule_pick_approval` prompt exists.

### D3. Handyman approves the pick
Flow: `[HM] reply YES to D2`
- [ ] Schedule applied; `scheduleHistory` entry `via: 'customer_link'`; active links revoked; both parties confirmed.

### D4. Handyman declines the pick → deadlock (ping-pong cap)
Flow: `repeat D1–D2 on a fresh round → [HM] reply NO`
- [ ] Job: `needsAttention: true` + `attentionNeeded.type: 'schedule_deadlock'`.
- [ ] Immediate admin email; AdminDashboard row highlighted red, sorted first, "Mark resolved" visible.
- [ ] HM gets "our team will step in"; CUST gets "we're arranging it".
- [ ] **No** new proposal round or link is auto-sent — the flow is terminal until an admin acts.

### D5. Admin sends a link (Trigger B)
Flow: `[CUST] free-text "can we change the timing?" → (lands in F3 per B4) → [ADM] AdminDashboard → Active jobs → Send reschedule link → confirm`
- [ ] CUST receives the link (template after Meta approval — single working URL, no doubled link; freeform fallback otherwise).
- [ ] Firestore: prior active links for the job → `revoked`; audit log `schedule_link_sent`.

### D6. Link security
- [ ] **Single-use:** re-open a used link → "already been used"; curl re-submit → 410.
- [ ] **Supersede:** send two admin links back-to-back → first doc `revoked`, first URL shows "used or replaced".
- [ ] **Expiry:** set an active link's `expiresAt` into the past → page shows "expired"; doc flips to `expired` on open.
- [ ] **Rules:** browser console as ADMIN: `getDoc(doc(db,'scheduleLinks','x'))` → permission denied.
- [ ] **Bad token:** `/pick-time?t=garbage` → "not valid"; missing `t` → error screen, no request loop.

---

## Suite E — Stage 4: sweep + attention queue (Scenario 12)

Pattern for every ladder: **manufacture the stuck state by hand-editing timestamps → run `stuckStateSweep()` once → exactly one nudge + marker → run again (after re-aging) → escalation + digest row + red queue row.**

### E1. Inert auto-poll fix (Scenario 1 repair)
Flow: `scheduled job past its date, [HM] never taps Mark Complete → run autoTriggerCompletionPoll() → [CUST] receives poll while job is still in_progress → reply YES`
- [ ] Job → `pending_admin_approval` (pre-fix this was a silent no-op).
- [ ] NO variant → `disputed`.

### E2. Stale Mark-Complete race is blocked
Flow: `after E1's YES, [HM] (stale tab still showing in_progress) taps Mark Complete`
- [ ] Alert "job was just updated — please refresh"; job status remains `pending_admin_approval` (not overwritten to `pending_confirmation`).

### E3. Prompt-expiry ladder
Flow: `open schedule_approval prompt → set its expiresAt into the past → sweep → sweep again (re-past the extended expiresAt)`
- [ ] Run 1: CUST gets the reminder; prompt gains `nudgedAt`, `expiresAt` moved +24h. Run 1 repeated immediately: **no second nudge**.
- [ ] Run 2: prompt → `expired`; job flagged `prompt_expired`; digest email row.
- [ ] A nudged prompt answered before run 2 behaves normally (schedule applies).

### E4. Link ladder
Flow: `active link → expiresAt into the past → sweep → expire the fresh link too → sweep`
- [ ] Run 1: old link `expired`/`revoked`; CUST gets ONE fresh link (`createdBy: 'system_nudge'`).
- [ ] Run 2: `link_ignored` flag; **no third link**.

### E5. ASAP-gap ladder
Flow: `ASAP job accepted, proposal declined, auto-link expired (or revoked); backdate acceptedAt > 24h → sweep → backdate > 48h → sweep`
- [ ] Run 1: HM nudged ("set visit time"); `sweepNudges.asap_no_time` stamped; no re-nudge on immediate rerun.
- [ ] Run 2: `asap_no_time` flag + digest.
- [ ] Negative control: same state but with an open schedule prompt OR active link → sweep does nothing.

### E6. Unclaimed ladder
Flow: `paid pending job; backdate createdAt 4d → sweep → backdate 8d → sweep`
- [ ] Run 1: eligible handymen re-notified (fan-out markers `_r900`); immediate rerun sends nothing new.
- [ ] Run 2: `unclaimed` flag + digest.
- [ ] Re-released variant (job with `reassignmentCount ≥ 1`): thresholds 2d/4d from `lastCancelledAt`, flag `reclaim_stalled`.

### E7. Digest discipline
- [ ] A run with ≥1 NEW escalation sends exactly one email (Job / Type / Customer-Handyman / Age / Why).
- [ ] The NEXT run with nothing new sends **no** email and re-lists nothing (once-only `_escalated` markers).

### E8. Queue actions
On a flagged job in the AdminDashboard queue:
- [ ] **Mark resolved** (confirm) → chip clears; sweep the next day does NOT re-flag the same stall.
- [ ] **Set time** (modal, bounded date) → schedule applies with `via: 'admin'` in history; both parties notified; open schedule prompts superseded; links revoked; attention cleared; the ASAP ladder stops matching the job.
- [ ] **Force unassign** (prompt for note) → job re-released to the board; removed HM notified + blocked from re-claiming; CUST notified; `assignmentHistory` entry `cancelReason: 'admin_forced'`; open prompts superseded; `sweepNudges` cleared (a new stall by the NEXT handyman must nudge/escalate fresh — verify by re-running E5 with HM-B).
- [ ] **Refund** (confirm with amount) → Stripe refund appears; job `paymentStatus: 'refunded'`, `status: 'cancelled'`; chip cleared. Simulate the half-failure (kill network between the two calls): row shows "Finish cancelling" → clicking it completes the cancellation.

---

## Suite F — Cross-cutting invariants

### F1. Escrow never moves without an admin
- [ ] After ALL of suites B–E (excluding the explicit refund test), every touched job still has its original `paymentStatus: 'succeeded'` — no transfer, no refund happened as a side effect.
- [ ] Fund release still works only from `/admin/fund-release` and pays the CURRENT `handymanId` (re-check after a force-unassign + re-claim by HM-B: release goes to HM-B).

### F2. Scenario 9 — manual customer cancel (deferred flow)
Flow: `[CUST] emails admin asking to cancel a paid in-progress job → [ADM] queue → Refund`
- [ ] Refund lands in Stripe; job `cancelled`; CUST sees the refund in 5–10 days (Stripe test mode: instant).
- [ ] For a paid job NOT visible in the queue (pending, unclaimed, unflagged): refund via **Stripe Dashboard** works and the `stripeEvents`/audit trail records it. (Or wait for the E6 sweep to surface it, then refund from the queue.)

### F3. Reassignment regression (pre-existing feature this branch stacks on)
Flow: `[HM-A] cancels an in-progress job from the job page (reason picklist)`
- [ ] Job re-released; HM-A blocked from re-claiming (UI + rules); HM-B can claim; CUST notified; admin fund-release page shows the assignment history before release.

---

## Known gaps (do NOT file as bugs)

- Scenarios 5, 6 (self-serve relaxation), 7, 8, 10, 11 are not built.
- A persistently failing nudge send (bad phone) retries daily and never escalates — follow-up backlog.
- `resolveAttention(markCancelled)` doesn't supersede leftover prompts/revoke links on the refunded job — one spurious re-flag possible; follow-up backlog.
- The `refund_orphaned` recovery state is per-browser (client state); navigating away before "Finish cancelling" leaves recovery to the flagged row / refreshed queue.
- Silent stalls are only caught at the sweep's daily granularity — a "24h" threshold fires at the first 10:30 run after it's due.
