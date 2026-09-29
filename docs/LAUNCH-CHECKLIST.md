# Launch Checklist — Job Lifecycle Flows (prod)

Written 2026-09-28 to restart the project after a break. Work top to bottom,
ticking boxes as you go. Every command below is copy-paste ready: each one
starts with `cd` into the right folder.

## Quick reference

| Thing | Exact value |
|---|---|
| Project folder | `/Users/liongchenglex/Desktop/AI_Projects/Handyman` |
| Prod Firebase project | `handyman-sg-3b418` (alias `prod`) — Stripe **LIVE** |
| Dev Firebase project | `eazydone-d06cf` (alias `dev`) — Stripe TEST |
| Prod backend env file | `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/.env.handyman-sg-3b418` |
| Prod frontend env file | `/Users/liongchenglex/Desktop/AI_Projects/Handyman/.env.prod` |
| Firebase CLI | `/Users/liongchenglex/.npm-global/bin/firebase` |
| Prod website | https://www.easydonehandyman.sg |
| Customer books a job | https://www.easydonehandyman.sg/request-job |
| Handyman dashboard | https://www.easydonehandyman.sg/handyman-dashboard |
| Admin dashboard (Active jobs table, "Needs attention" chip, Refund / Set time / Force unassign / Mark resolved buttons) | https://www.easydonehandyman.sg/admin |
| Admin fund release ("Release Funds" button) | https://www.easydonehandyman.sg/admin/fund-release |
| Prod Firestore — jobs | https://console.firebase.google.com/project/handyman-sg-3b418/firestore/data/~2Fjobs |
| Prod Firestore — indexes | https://console.firebase.google.com/project/handyman-sg-3b418/firestore/indexes |
| Prod function logs | https://console.cloud.google.com/logs/query?project=handyman-sg-3b418 |
| Prod scheduled jobs (force-run) | https://console.cloud.google.com/cloudscheduler?project=handyman-sg-3b418 |
| Stripe payments (live) | https://dashboard.stripe.com/payments |
| Stripe transfers to handymen | https://dashboard.stripe.com/connect/transfers |
| Stripe webhooks (live) | https://dashboard.stripe.com/webhooks |
| Twilio templates | https://console.twilio.com/us1/develop/sms/content-template-builder |

**Where things stand**

- Built and merged to `master`: Scenarios 0, 1, 2, 3, 4, 7, 8, 10, 11, 12
  (spec: `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md`).
- Not built (not launch blockers): Scenario 5 (running late), Scenario 6
  (self-serve swap after inspection). Scenario 9 (customer cancel) is
  manual by design — admin clicks **Refund**.
- **The gap:** the WhatsApp templates exist in Twilio, but 9 of their SIDs
  are missing from the env files, so the app falls back to plain messages
  that WhatsApp only delivers inside a 24h customer-initiated window.

---

## Phase 0 — Tidy up

- [x] Commit pending doc edits + support-email change (done: commit `f51bc6d`).
- [ x] Delete iCloud duplicates (verified as older copies or empty folders).
      Paste into Terminal:

  ```sh
  cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
  rm -f "src/components/handyman/JobBoard 2.jsx" "package-lock 2.json" ".git/index 2"
  rmdir "docs/features 2" "docs/setup 2" "docs/deployment 2"
  rm -rf "node_modules 2"
  git status --short
  ```

  Expected `git status` output afterwards: only `brand/` and
  `Testing and Validation Guide (1).docx` left as `??`.
- [ x] `brand/` and `Testing and Validation Guide (1).docx` (in the project
      folder): commit them (`git add brand && git commit -m "add brand assets"`)
      or move them out of the project folder.
- [x ] Push `master` to GitHub:

  ```sh
  cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
  git push origin master
  ```

## Phase 1 — Connect the templates to the app

- [x] Collected SIDs from Twilio (browser brief at the bottom of this file).
- [x] All 10 SIDs written to both env files (2026-09-29). Prod uses the
      `_prod` variants of `second_visit_needed` / `visit_disposition` (URL
      button); dev uses the `_dev` variants (link in body).
- [x] `TWILIO_TEMPLATE_LINK_MODE=button` added to the prod env only, and the
      code now sends just the job-id suffix to button templates (without it
      the button link would double up the domain).
- [ ] Double-check — this should print 10 `HX…` lines plus `LINK_MODE=button`:

  ```sh
  cd /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions
  grep -E "NO_SHOW|PRICE_ADJ|ADJUSTMENT_PAID|SECOND_VISIT|VISIT_DISP|ACCESS_ISSUE|VISIT_PROBLEM|JOB_COMPLETION|LINK_MODE" .env.handyman-sg-3b418
  ```

## Phase 2 — Stripe webhooks (LIVE mode)

- [ x ] Open https://dashboard.stripe.com/webhooks. Make sure the **Test mode**
      toggle (top right) is OFF.
- [ x] Click the endpoint whose URL ends in `/stripeWebhook` and contains
      `handyman-sg-3b418`.
- [ x ] "Listening to" must include all 6 events below. If any are missing:
      **⋯ → Update details → Select events**, tick them, **Update endpoint**.
  - [ x] `payment_intent.amount_capturable_updated` — takes the money at booking
  - [x ] `payment_intent.succeeded` — marks the job paid, notifies handymen
  - [ x] `payment_intent.canceled` — alerts you if a card authorisation is lost
  - [ x] `charge.refunded` — marks the job refunded
  - [ x] `checkout.session.completed` — price-adjustment paid
  - [ x] `checkout.session.expired` — price-adjustment link expired

## Phase 3 — Deploy to prod

- [ ] Backend (functions + database rules + indexes), ~5 min:

  ```sh
  cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
  /Users/liongchenglex/.npm-global/bin/firebase deploy -P prod --only functions,firestore:rules,firestore:indexes
  ```

  Pass = ends with `Deploy complete!`. If it asks to delete functions that
  aren't in the code, answer **N** and send me the list.
- [x ] Open https://console.firebase.google.com/project/handyman-sg-3b418/firestore/indexes
      and wait until every row says **Enabled** (not "Building").
- [x ] Frontend (website):

  ```sh
  cd /Users/liongchenglex/Desktop/AI_Projects/Handyman
  cp .env.prod .env.production.local
  npm run build
  /Users/liongchenglex/.npm-global/bin/firebase deploy -P prod --only hosting
  ```

  (Don't run a bare `npm install` — see the note in memory; `npm run build`
  uses the existing `node_modules`.)
- [ x] Open https://www.easydonehandyman.sg in a private window and confirm it
      loads.

## Phase 4 — Prod test setup (read before testing)

**Use the `Appliance Repair` service for every test job.** It's temporarily
priced at **S$4–20** in both `src/config/servicePricing.js:21` and
`functions/servicePricing.js:18`, so each test booking costs a few dollars
and loses only ~S$0.64 in Stripe fees when refunded. The S$20 max also
leaves room to test a price adjustment.

- [x] ~~**Stop real handymen being pinged.**~~ SKIPPED 2026-09-29 — no real
      handymen registered yet. Revisit before the first real handyman signs up.
      Original step kept below for then:
      **Stop real handymen being pinged.** By default EVERY active,
      verified, Stripe-onboarded handyman gets a WhatsApp for EVERY new job,
      whatever the service type (`NOTIFY_FILTER_BY_SERVICE_TYPE` is off —
      `functions/notificationConfig.js`). Pick one:
  - **Option A (recommended):** turn on trade matching for prod, so only
    handymen listing `Appliance Repair` get your test jobs. Add this line to
    `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/.env.handyman-sg-3b418`
    **before** the Phase 3 deploy:

    ```
    NOTIFY_FILTER_BY_SERVICE_TYPE=true
    ```

    Then open
    https://console.firebase.google.com/project/handyman-sg-3b418/firestore/data/~2Fhandymen
    → **Filter** → `serviceTypes` **array-contains** `Appliance Repair`, and
    make sure only your test handymen appear. Real handymen who list it: warn
    them or set their `notifyOnNewJob` to `false`.
    After testing, decide whether to keep the line (real jobs then only go to
    matching trades) or delete it and redeploy functions.
  - **Option B:** leave it off and set `notifyOnNewJob` to `false` on
    **every** non-test handyman in that collection for the test period.

  Note: the job board in the app still shows test jobs to every logged-in
  handyman either way — the setting only controls WhatsApp.
- [ ] **Test accounts ready:**
  - CUST — your own WhatsApp number (you book as a guest at `/request-job`).
  - HM-A and HM-B — two handyman accounts on phones you control. Prod is
    live Stripe, so each must complete the real Stripe payout onboarding
    (real ID + bank account — use your own / your partner's details),
    otherwise Release Funds has nowhere to send money. In Firestore
    `handymen/{id}` each must have: `status: "active"`, `verified: true`,
    `stripeOnboardingCompleted: true`, and `serviceTypes` containing
    `Appliance Repair`.
  - ADMIN — your admin login at https://www.easydonehandyman.sg/admin
- [ ] Type `TEST` at the start of every job description so you can find
      and clean up test jobs later.
- [ ] **Running scheduled jobs on demand** (don't wait for the timer): open
      https://console.cloud.google.com/cloudscheduler?project=handyman-sg-3b418,
      find the row whose name contains the function, click **⋮ → Force run**.

  | Function | Normally runs (SGT) | What it does |
  |---|---|---|
  | `autoTriggerCompletionPoll` | 10:00 daily | "Is the job done?" poll, day after the visit |
  | `stuckStateSweep` | 10:30 daily | Nudges + "Needs attention" flags |
  | `eveningVisitDisposition` | 19:00 daily | "How did today's job go?" link to handyman |

- [ ] **Checking a job's data:** open the jobs link in the Quick reference,
      find the job by ID (last 6 characters are shown as "Job #xxxxxx" in
      WhatsApp and the app).

## Phase 5 — Test run (priority order)

Full scripts: `docs/features/e2e-test-plan-job-lifecycle.md`. Minimum set:

- [ ] **T1 Happy path.**
  1. CUST: https://www.easydonehandyman.sg/request-job → Appliance Repair,
     date = tomorrow, description `TEST happy path` → pay with a real card.
  2. Stripe https://dashboard.stripe.com/payments: payment shows
     **Succeeded** (NOT "Uncaptured").
  3. HM-A: WhatsApp "new job" arrives → `/handyman-dashboard` →
     **Express Interest** → confirm.
  4. CUST: WhatsApp "your job was accepted".
  5. HM-A: open the job → **Mark Complete**.
  6. CUST: WhatsApp poll with 3 buttons → tap **Confirm Complete**.
  7. ADMIN: `/admin/fund-release` → **Release Funds** on the job.
  8. Stripe https://dashboard.stripe.com/connect/transfers: transfer to HM-A.
- [ ] **T1b Payout to the handyman's bank** (continues T1; nothing to click —
      Stripe does it automatically).
  1. Stripe https://dashboard.stripe.com/connect/accounts → HM-A's account →
     the T1 transfer shows under **Balance** as *pending*. This is normal:
     the transfer went out immediately (`source_transaction`), but the money
     only becomes *available* once the customer's charge settles.
  2. HM-A's connected accounts are set to **daily** automatic payouts
     (`functions/index.js:813`). Once the balance is available, a **Payout**
     appears on HM-A's account and lands in HM-A's bank the next business day
     or so. A brand-new Stripe account usually has a longer **first**
     payout (often ~7 days) — Stripe shows the expected date on the payout.
  3. Pass = HM-A's bank statement shows the Stripe payout for the T1 amount
     minus Stripe fee and platform fee (breakdown in the transfer metadata).
  4. Only the money reaching the connected account (step 1) is our code; the
     bank payout is Stripe's. Don't block launch waiting for step 3 — tick it
     when it arrives.
- [ ] **T2 Handyman cancels.** New job; HM-A claims → job page → **Can't do
      this job?** → pick a reason. Check: job reappears on the job board,
      HM-A can't claim it again, HM-B can, CUST gets a WhatsApp.
- [ ] **T3 Reschedule.** Job claimed by HM-A → **Propose new time** → CUST
      taps **Decline** → CUST receives a `/pick-time` link → picks a slot →
      HM-A gets Approve/Decline → **Approve** → both get "new time
      confirmed". Firestore: job `preferredDate` changed.
- [ ] **T4 ASAP job.** Book with the ASAP option → HM-A's **Express
      Interest** must ask for a date/time → CUST taps **Approve** → Firestore:
      job now has `preferredDate` and `scheduledFromAsapAt`.
- [ ] **T5 Price adjustment (pay).** Book at S$4. HM-A → **Request price
      adjustment** → amount `5`, any reason → CUST gets a WhatsApp with a pay
      link → pay → both get "adjustment paid". Firestore:
      `priceAdjustment.status: "paid"`, `estimatedBudget` up by 5. Then do
      T1 steps 5–8: Stripe should show **two** transfers to HM-A.
- [ ] **T6 Price adjustment (decline).** Same, but CUST replies `NO` →
      HM-A gets "customer declined". Firestore:
      `priceAdjustment.status: "declined"`.
- [ ] **T7 No-show.** Job dated today, HM-A claimed, don't mark complete →
      force-run `autoTriggerCompletionPoll` (only fires the day after the
      date; alternatively have HM-A tap **Mark Complete**) → CUST taps
      **Report Issue** → replies `2` ("never came") → CUST gets 3 choices.
      Repeat on 3 jobs, replying `1`, `2`, `3`:
      - `1` → CUST gets a `/pick-time` link.
      - `2` → job shows **Needs attention** on `/admin` → **Force unassign**
        → job back on the board.
      - `3` → job shows **Needs attention** → used in refund test R4.
- [ ] **T8 Second visit.** HM-A → **Mark Complete** → CUST taps **He's
      coming back** → HM-A gets a WhatsApp link → opens → **Needs another
      visit** → pick date → CUST **Approve**.
- [ ] **T9 Customer not home.** Job dated **today**, HM-A claimed → job page
      → **Customer not home** → CUST gets Reschedule / Contact support →
      tap **Reschedule** → CUST gets a `/pick-time` link.
- [ ] **T10 Evening check-in.** Job dated today, HM-A does nothing →
      force-run `eveningVisitDisposition` → HM-A gets "How did today's job
      go?" link → opens with **Job's done / Needs another visit / Problem —
      can't finish** options.
- [ ] **T11 Stuck-job sweep.** Leave any Approve/Decline prompt unanswered
      for 2 days → force-run `stuckStateSweep` → nudge WhatsApp sent → after
      the next threshold, job shows **Needs attention** on `/admin` and you
      get a digest email.
- [ ] **T12 Templates really used.** Trigger each new template to a phone
      that hasn't messaged the business number for 24h+. Then open the logs
      link in the Quick reference and search `63016` — any hit means that
      template's SID isn't set (Phase 1).

## Phase 6 — Refund testing

Refund button: https://www.easydonehandyman.sg/admin → **Active jobs** table
→ **Refund** on the job's row (calls `refundPayment`, `functions/index.js:1997`).

- [ ] **R1 Refund an in-progress job.** Book (S$4), HM-A claims, ADMIN clicks
      **Refund** → confirm. Check:
  - Stripe payments: payment shows **Refunded**.
  - Firestore job: `paymentStatus: "refunded"`, `status: "cancelled"`.
  - Row gone from the Active jobs table.
- [ ] **R2 Refund with a paid price adjustment.** Do T5 up to "paid", then
      **Refund**. Stripe payments: **both** the S$4 and the S$5 charges show
      Refunded.
- [ ] **R3 Refund a job nobody claimed** (not in the Active jobs table).
      https://dashboard.stripe.com/payments → click the payment → **Refund**
      → full amount. Firestore job should change to
      `paymentStatus: "refunded"` within a minute. If job `status` is still
      `"pending"`, edit it to `"cancelled"` by hand so it leaves the board.
- [ ] **R4 No-show → refund.** The job from T7 reply `3` → **Refund** on its
      row → same checks as R1.
- [ ] **R5 Money never moves by itself.** In Firestore, every test job that
      wasn't released or refunded still has `paymentStatus: "succeeded"`.

Real cards show the refund in 5–10 business days; **Refunded** in Stripe is
the pass condition.

## Phase 7 — Before real customers

- [ ] **Revert the test price.** In both files, change
      `'Appliance Repair':  { min: 4,   max: 20 },` to
      `'Appliance Repair':  { min: 90,  max: 130 },` and remove the `TEMP`
      comment:
  - `/Users/liongchenglex/Desktop/AI_Projects/Handyman/src/config/servicePricing.js` (line 21)
  - `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/servicePricing.js` (line 18)

  Then redeploy both parts (Phase 3 commands) and commit.
- [ ] Decide on `NOTIFY_FILTER_BY_SERVICE_TYPE` (keep or remove, Phase 4).
- [ ] Set any handyman `notifyOnNewJob` you switched off in Phase 4 back to
      `true`.
- [ ] Delete `TEST` jobs from prod Firestore (jobs collection → open job →
      **⋮ → Delete document**).
- [ ] Still-open product decisions (spec §6): refund policy wording (full vs
      minus fee), and the "$20 penalty" wording in the Express Interest pop-up.

---

## Browser brief — collect Twilio template SIDs

Copy everything inside the box into Claude in Chrome while logged in to the
Twilio Console.

```text
TASK: Look up WhatsApp template Content SIDs in the Twilio Console. READ ONLY —
do not create, edit, delete, or submit anything.

1. Go to https://console.twilio.com/us1/develop/sms/content-template-builder
   (Messaging → Content Template Builder, a.k.a. Content Editor). If there are multiple Twilio accounts/subaccounts,
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
