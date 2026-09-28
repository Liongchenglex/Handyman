# Launch Checklist — Job Lifecycle Flows (prod)

Written 2026-09-28 to restart the project after a break. Work top to bottom.
Tick boxes as you go. Details live in the linked docs; this is the
"what do I actually do" list.

**Where things stand**

- Built and merged to `master`: Scenarios 0, 1, 2, 3, 4, 7, 8, 10, 11, 12
  (spec: `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md`).
- Not built (not launch blockers): Scenario 5 (running late), Scenario 6
  (self-serve swap after inspection). Scenario 9 (customer cancel) is
  manual by design — admin clicks **Refund**.
- **The gap:** the WhatsApp templates exist in Twilio, but 9 of their SIDs
  are not in the env files, so the code falls back to freeform messages
  (which WhatsApp only delivers inside a 24h customer-initiated window).

**Environments** (`.firebaserc`)

| Alias | Firebase project | Env file | Stripe |
|---|---|---|---|
| `dev` / default | `eazydone-d06cf` | `functions/.env.eazydone-d06cf` | TEST mode |
| `prod` | `handyman-sg-3b418` | `functions/.env.handyman-sg-3b418` | **LIVE** — real money |

---

## Phase 0 — Tidy up

- [x] Commit pending doc edits (emoji removal in template runbooks) and the
      support-email change in `SuspendedStatusView.jsx`.
- [ ] Delete iCloud duplicates (all verified as older copies / empty — the
      originals are newer). Run from the repo root:

  ```sh
  rm -f "src/components/handyman/JobBoard 2.jsx" "package-lock 2.json" ".git/index 2"
  rmdir "docs/features 2" "docs/setup 2" "docs/deployment 2"
  rm -rf "node_modules 2"
  ```

- [ ] Decide what to do with the untracked `brand/` folder and
      `Testing and Validation Guide (1).docx` (commit, move, or ignore).

## Phase 1 — Connect the templates to the app

- [ ] Use the **browser brief** at the bottom of this file to have browser
      Claude collect the SIDs from Twilio.
- [ ] Confirm every template below shows **Approved** for WhatsApp.
      Anything still pending/rejected: leave its env var unset (freeform
      fallback) and note it here.
- [ ] Paste the SIDs into `functions/.env.handyman-sg-3b418` (prod), and
      into `functions/.env.eazydone-d06cf` too if you test on dev:

  ```
  TWILIO_TEMPLATE_NO_SHOW_CHOICE=
  TWILIO_TEMPLATE_NO_SHOW_REPORTED=
  TWILIO_TEMPLATE_PRICE_ADJUSTMENT=
  TWILIO_TEMPLATE_ADJUSTMENT_PAID=
  TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL=
  TWILIO_TEMPLATE_SECOND_VISIT_NEEDED=
  TWILIO_TEMPLATE_VISIT_DISPOSITION=
  TWILIO_TEMPLATE_ACCESS_ISSUE=
  TWILIO_TEMPLATE_VISIT_PROBLEM=
  # REPLACE the existing value with the 3-button v2 template's SID:
  TWILIO_TEMPLATE_JOB_COMPLETION=
  ```

  Or paste the brief's output to Claude Code and it will fill these in.

## Phase 2 — Stripe Dashboard (LIVE mode)

- [ ] Developers → Webhooks → the prod endpoint is subscribed to all of:
  - `payment_intent.amount_capturable_updated` (capture at booking)
  - `payment_intent.succeeded`
  - `payment_intent.canceled` (lost-authorization alarm)
  - `charge.refunded`
  - `checkout.session.completed` (price-adjustment paid)
  - `checkout.session.expired` (price-adjustment link expiry)

## Phase 3 — Deploy to prod

- [ ] `~/.npm-global/bin/firebase deploy -P prod --only functions,firestore:rules,firestore:indexes`
- [ ] Firebase Console → Firestore → Indexes: wait until all show **Enabled**.
- [ ] `npm run build` then `~/.npm-global/bin/firebase deploy -P prod --only hosting`

## Phase 4 — Prod test setup (read before testing)

Testing on prod means:

- **Real charges.** Refunds return the money, but Stripe keeps its fee
  (~3.4% + S$0.50 per charge). Always book the cheapest service.
- **Real handymen get pinged.** Fan-out goes to every handyman who is
  `active` + `verified` + Stripe-onboarded + lists the job's service type
  (`functions/handymanNotifier.js:62`). Book test jobs under a service type
  **only your test handymen list**, or warn your handymen first.
- **Test data stays in prod.** Put `TEST` in every job description.

- [ ] Actors ready:
  - CUST: your own WhatsApp phone
  - HM-A and HM-B: two handyman accounts with phones you control, verified
    and Stripe-onboarded
  - ADMIN: admin login
- [ ] Scheduled jobs are not waited on. Trigger them by hand from Google Cloud
      Console → Cloud Functions → function → **Testing** tab (or
      `firebase functions:shell -P prod`):
      `autoTriggerCompletionPoll`, `stuckStateSweep`, `eveningVisitDisposition`.

## Phase 5 — Test run (priority order)

Full scripts: `docs/features/e2e-test-plan-job-lifecycle.md`. Minimum set:

- [ ] **Happy path.** CUST books → Stripe payment shows **Succeeded** (not
      "Uncaptured") → HM-A gets WhatsApp, claims → CUST gets "accepted" →
      HM-A taps Mark Complete → CUST gets 3-button poll → taps Confirm
      Complete → admin `/admin/fund-release` → Release → HM-A's Stripe
      account receives the transfer.
- [ ] **Handyman cancels.** HM-A cancels from the job page → job back on
      the board → HM-A cannot reclaim → HM-B can → CUST notified.
- [ ] **Reschedule.** HM proposes a new time → CUST taps Decline → CUST gets
      a pick-time link → picks a slot → HM gets Approve/Decline → Approve →
      both confirmed.
- [ ] **ASAP job.** Claiming requires a proposed time → CUST approves →
      job now has a real date.
- [ ] **Price adjustment.** HM taps "Request price adjustment" (+S$X) → CUST
      gets the pay link → pays → both confirmed, job amount increased →
      at release, **two** transfers go out.
- [ ] **Price adjustment decline.** CUST replies NO → HM told to proceed at
      original price or cancel.
- [ ] **No-show.** On the poll CUST taps Report Issue → "never came" (2) →
      CUST gets 3 choices (Reschedule / New handyman / Cancel & refund).
      Try each choice on a different job.
- [ ] **Second visit.** CUST taps "He's coming back" on the poll → HM gets a
      link to propose the return date.
- [ ] **Customer not home.** On the visit day HM taps "Customer not home" →
      CUST gets Reschedule / Contact support.
- [ ] **Evening disposition.** Job dated today, HM does nothing → trigger
      `eveningVisitDisposition` → HM gets the deep link → it opens the
      disposition sheet.
- [ ] **Stuck-job sweep.** Leave a prompt unanswered past its expiry →
      trigger `stuckStateSweep` → nudge sent; later → job appears in the
      admin "Attention needed" queue.
- [ ] **Templates really used.** For each new template, trigger it when the
      recipient hasn't messaged the business number in >24h. Check function
      logs: a Twilio **63016** error = that template's SID is not set.

## Phase 6 — Refund testing

Refunds are admin-only: **Admin Dashboard → Active jobs / Attention queue →
Refund** (calls `refundPayment`, `functions/index.js:1997`).

- [ ] **R1 — Refund an in-progress job.** Book, HM-A claims, admin clicks
      Refund and confirms.
      Verify: Stripe payment shows **Refunded**; Firestore
      `jobs/{id}` has `paymentStatus: 'refunded'`, `status: 'cancelled'`;
      row leaves the queue.
- [ ] **R2 — Refund with a paid price adjustment.** Do the adjustment, pay
      it, then Refund. Verify **both** charges are refunded in Stripe.
- [ ] **R3 — Refund an unclaimed job** (not in the queue yet). Refund from the
      Stripe Dashboard → payment → Refund. Verify the `charge.refunded`
      webhook set `paymentStatus: 'refunded'` on the job; if the job status
      is still `pending`, cancel it manually in Firestore so it leaves the
      board.
- [ ] **R4 — No-show → cancel & refund.** CUST picks option 3 → job flagged
      in the Attention queue → admin Refund works.
- [ ] **R5 — Money never moves by itself.** After all non-refund tests, every
      touched job still has `paymentStatus: 'succeeded'` until admin
      releases or refunds.

Real-card refunds take 5–10 business days to show on the statement;
"Refunded" in Stripe is the pass condition.

## Phase 7 — After launch

- [ ] Clean up TEST jobs in prod Firestore.
- [ ] Open owner decisions still pending (spec §6): refund policy copy
      (full vs minus fee); the "$20 penalty" copy in the Express Interest
      modal.

---

## Browser brief — collect Twilio template SIDs

Copy everything inside the box into Claude in Chrome while logged in to the
Twilio Console.

```text
TASK: Look up WhatsApp template Content SIDs in the Twilio Console. READ ONLY —
do not create, edit, delete, or submit anything.

1. Go to https://console.twilio.com → Messaging → Content Template Builder
   (a.k.a. Content Editor). If there are multiple Twilio accounts/subaccounts,
   list which one you are in.
2. For each template below, find the matching one in the list (match by
   friendly name first; if the name differs, match by the body text snippet
   and buttons). Open it and record: friendly name, Content SID (starts with
   "HX", 34 chars), WhatsApp approval status (Approved / Pending / Rejected +
   rejection reason if shown), and the button labels.
3. If two templates match one row (e.g. an old and a new version), report
   both with their created dates and statuses.
4. Output a table in this exact format, then the env block with SIDs filled
   in only for APPROVED templates (leave others blank):

   | Env var | Friendly name | SID | Status | Buttons |

TEMPLATES TO FIND

A. TWILIO_TEMPLATE_NO_SHOW_CHOICE — name like "no_show_choice"
   Body starts: "We're very sorry — we've recorded that your handyman didn't
   turn up for Job #{{1}}"  · Buttons: Reschedule / New handyman / a cancel-refund button (3)

B. TWILIO_TEMPLATE_NO_SHOW_REPORTED — name like "no_show_reported"
   Body starts: "The customer reported that nobody arrived for Job #{{1}}"
   · No buttons

C. TWILIO_TEMPLATE_PRICE_ADJUSTMENT — name like "price_adjustment"
   Body starts: "Your handyman has requested a price adjustment of +S${{1}}"
   · Contains "Pay here to approve (valid 24h)" and "Reply *NO* to decline"

D. TWILIO_TEMPLATE_ADJUSTMENT_PAID — name like "price_adjustment_paid"
   Body: "The +S${{1}} adjustment for Job #{{2}} has been paid."

E. TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL — name like "second_visit_proposal"
   Body starts: "Hi there, your handyman {{1}} says another visit is needed"
   · Buttons: Approve / Decline

F. TWILIO_TEMPLATE_SECOND_VISIT_NEEDED — name like "second_visit_needed"
   Body starts: "The customer says job #{{1}} needs another visit"
   · No quick-reply buttons (may have a URL button)

G. TWILIO_TEMPLATE_VISIT_DISPOSITION — name like "visit_disposition"
   Body starts: "How did today's job go — {{1}} (#{{2}})?"
   · No quick-reply buttons (may have a URL button)

H. TWILIO_TEMPLATE_ACCESS_ISSUE — name like "access_issue_choice"
   Body starts: "Hi there, your handyman {{1}} couldn't reach you today"
   · Buttons: Reschedule / Contact support

I. TWILIO_TEMPLATE_VISIT_PROBLEM — name like "visit_problem"
   Body starts: "There's a snag with job #{{1}}" · No buttons

J. TWILIO_TEMPLATE_JOB_COMPLETION (NEW v2) — name like
   "job_completion_request_v2"
   Body starts: "Hello {{1}}, Your handyman {{2}} has marked your "{{3}}" job
   as complete."  · MUST have 3 buttons: Confirm Complete / Report Issue /
   He's coming back. (An older 2-button version also exists — report it too
   but mark it OLD.)

ALSO list any other templates in the account whose names you don't recognise
from this list (name + SID + status only), so the owner can spot leftovers.
```
