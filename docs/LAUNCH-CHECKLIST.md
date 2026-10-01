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

- [ x ] Backend (functions + database rules + indexes), ~5 min:

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
- [x ] **Test accounts ready:**
  - CUST — your own WhatsApp number (you book as a guest at `/request-job`).
  - HM-A and HM-B — two handyman accounts on phones you control. Prod is
    live Stripe, so each must complete the real Stripe payout onboarding
    (real ID + bank account — use your own / your partner's details),
    otherwise Release Funds has nowhere to send money. In Firestore
    `handymen/{id}` each must have: `status: "active"`, `verified: true`,
    `stripeOnboardingCompleted: true`, and `serviceTypes` containing
    `Appliance Repair`.
  - ADMIN — your admin login at https://www.easydonehandyman.sg/admin
- [ x] Type `TEST` at the start of every job description so you can find
      and clean up test jobs later.
- [ x] **Running scheduled jobs on demand** (don't wait for the timer): open
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

- [ x] **T1 Happy path.**
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
  2. Payout schedule (confirmed in Stripe 2026-09-30): **Daily – 7 day
     rolling basis**. Each charge's money becomes *available* on HM-A's
     account 7 days after the customer paid, then pays out daily — so
     expect the bank payout ~7 days after the T1 booking. Stripe shows the
     expected date on the payout.
  3. Pass = HM-A's bank statement shows the Stripe payout for the T1 amount
     minus Stripe fee and platform fee (breakdown in the transfer metadata).
  4. Only the money reaching the connected account (step 1) is our code; the
     bank payout is Stripe's. Don't block launch waiting for step 3 — tick it
     when it arrives.
- [ x] **T2 Handyman cancels.** New job; HM-A claims → job page → **Can't do
      this job?** → pick a reason. Check: job reappears on the job board,
      HM-A can't claim it again, HM-B can, CUST gets a WhatsApp.
- [ x] **T3 Reschedule.** Job claimed by HM-A → **Propose new time** → CUST
      taps **Decline** → CUST receives a `/pick-time` link → picks a slot →
      HM-A gets Approve/Decline → **Approve** → both get "new time
      confirmed". Firestore: job `preferredDate` changed.
- [ x ] **T4 ASAP job.** Book with the ASAP option → HM-A's **Express
      Interest** must ask for a date/time → CUST taps **Approve** → Firestore:
      job now has `preferredDate` and `scheduledFromAsapAt`.
- [ x ] **T5 Price adjustment (pay).** Book at S$4. HM-A → **Request price
      adjustment** → amount `5`, any reason → CUST gets a WhatsApp with a pay
      link → pay → both get "adjustment paid". Firestore:
      `priceAdjustment.status: "paid"`, `estimatedBudget` up by 5. Then do
      T1 steps 5–8: Stripe should show **two** transfers to HM-A.
- [ x] **T6 Price adjustment (decline).** Same, but CUST replies `NO` →
      HM-A gets "customer declined". Firestore:
      `priceAdjustment.status: "declined"`.
- [ ] ~~T7 No-show.~~ → replaced by **Phase 5b** below. Old text: Job dated today, HM-A claimed, don't mark complete →
      force-run `autoTriggerCompletionPoll` (only fires the day after the
      date; alternatively have HM-A tap **Mark Complete**) → CUST taps
      **Report Issue** → replies `2` ("never came") → CUST gets 3 choices.
      Repeat on 3 jobs, replying `1`, `2`, `3`:
      - `1` → CUST gets a `/pick-time` link.
      - `2` → job shows **Needs attention** on `/admin` → **Force unassign**
        → job back on the board. x 
      - `3` → job shows **Needs attention** → used in refund test R4.
- [ x ] **T8 Second visit.** HM-A → **Mark Complete** → CUST taps **He's
      coming back** → HM-A gets a WhatsApp link → opens → **Needs another
      visit** → pick date → CUST **Approve**.
- [ x ] **T9 Customer not home.** Job dated **today**, HM-A claimed → job page
      → **Customer not home** → CUST gets Reschedule / Contact support →
      tap **Reschedule** → CUST gets a `/pick-time` link.
- [ x ] **T10 Evening check-in.** Job dated today, HM-A does nothing →
      force-run `eveningVisitDisposition` → HM-A gets "How did today's job
      go?" link → opens with **Job's done / Needs another visit / Problem —
      can't finish** options.
- [ ] ~~T11 Stuck-job sweep.~~ → replaced by **Phase 5b** below. Old text: Leave any Approve/Decline prompt unanswered
      for 2 days → force-run `stuckStateSweep` → nudge WhatsApp sent → after
      the next threshold, job shows **Needs attention** on `/admin` and you
      get a digest email.
- [ ] ~~T12 Templates really used.~~ → replaced by **Phase 5b** below. Old text: Trigger each new template to a phone
      that hasn't messaged the business number for 24h+. Then open the logs
      link in the Quick reference and search `63016` — any hit means that
      template's SID isn't set (Phase 1).

- [ x ] **T13 Forgot password** (added 2026-09-30). Deploy hosting first
      (Phase 3 frontend commands). https://www.easydonehandyman.sg/handyman-auth
      → type HM-A's email → **Forgot password?** → green "we've emailed a
      link" message → email arrives (check spam; sender is Firebase's
      `noreply@handyman-sg-3b418.firebaseapp.com`) → link opens a
      Firebase page to set a new password → log in with it.
      Optional polish: Firebase Console → Authentication → **Templates** →
      Password reset, to change the sender name/wording.

- [ x ] **T14 Admin job page + status lines** (added 2026-09-30). Deploy
      functions + hosting first (Phase 3 commands).
  1. https://www.easydonehandyman.sg/admin → **Active jobs**: a flagged job
     shows only a red "⚠️ Needs attention — see details" badge.
  2. Click the badge (or **Details →**) on the T3 deadlock job → page
     `/admin/jobs/<id>` shows the red "Needs attention: Schedule deadlock"
     box with a **Next step**, the 🕒 schedule-status line, Customer /
     Handyman / Job / Money cards, and a **Timeline** with the whole T3
     back-and-forth (proposal → declined → pick → declined).
  3. https://www.easydonehandyman.sg/admin/jobs → **Details →** on any job
     opens the same page.
  4. On a phone-width window: cards stack in one column, nothing is cut off.
- [ x ] **T15 Admin price adjustment on the handyman's behalf.** Job in
      progress, HM-A assigned, no adjustment yet (book S$4).
  1. `/admin/jobs/<id>` → Money → **Request price adjustment** → amount `5`,
     any reason → **Send request**.
  2. CUST gets the pay link on WhatsApp; HM-A gets "Our team has requested a
     price adjustment … on your behalf" (only arrives if HM-A messaged the
     business number in the last 24h — plain message, not a template).
  3. Money card shows `+S$5.00 · pending payment · by admin`. Firestore:
     `priceAdjustment.requestedVia: "admin"`.
  4. CUST pays → same result as T5 (both confirmed, fee goes up).
  5. The button is hidden while an adjustment is pending or paid.

## Phase 5b — Final run: no-show → refund (replaces T7, T11, T12, R2, R3)

Written 2026-10-01 after the T7 hiccups (all fixed and deployed: no-show now
moves the job back to `in_progress`; a bare "1"/"2" reply now answers the right
question; admin emails now work). Do the scenarios **in order**.

**Before you start (2 min):**
- [ x] One WhatsApp number for CUST and the handymen is **OK**. Rules: one
      scenario at a time; tap buttons instead of typing; if you get "You have
      N pending questions", reply `<number> <word>` (e.g. `1 YES`); check the
      Job # on each message — both sides' messages land on the same phone.
- [ x] CUST has **no leftover open questions**: finish or refund old test jobs
      first. If CUST gets "You have 2 pending questions", that's a leftover —
      answer it with the number + word it shows (e.g. `1 YES`).
- [ x] Hard refresh (Cmd + Shift + R) the admin and handyman pages.
- [ x] Book every job as **Appliance Repair (S$4)** with **today's date**, a
      time slot later today (or ASAP + approve the proposed time).

### S1 — No-show → customer wants a refund (covers T7 choice 3 + R2)
1. [ x ] CUST books `TEST S1`. HM-A claims it.
2. [ x ] HM-A → **Request price adjustment** → `1`, reason `extra part`. CUST pays
       the link (S$1.10) → "Payment received" popup → both phones get "paid".
3. [x ] HM-A → **Mark Complete**. CUST gets the 3-button poll → tap **Report Issue**.
4. [ x] CUST gets "What happened? 1 problem / 2 never came" → reply `2`.
5. [x] Check **all** of:
   - CUST gets the 3 choices (Reschedule / New handyman / Cancel & refund).
   - HM-A gets "The customer reported that nobody arrived…".
   - Admin email "no-show reported" arrives at easydonehandyman@gmail.com.
   - Firestore job: `status: "in_progress"` (back from pending_confirmation),
     one `noShowReports` entry. HM-A's handyman doc: `noShowCount` +1.
6. [x ] CUST replies `3`. → CUST gets "our team will process your refund shortly";
       admin email arrives; `/admin` row shows **⚠️ Needs attention**; Details
       page says **"No-show — customer wants a refund"**.
7. [ x ] `/admin` → **Refund** on that row → confirm.
8. [x  ] **R2 check** — Stripe https://dashboard.stripe.com/payments: **both** the
       S$4.40 and the S$1.10 payments show **Refunded**. Firestore job:
       `paymentStatus: "refunded"`, `status: "cancelled"`,
       `priceAdjustment.status: "refunded"`. CUST gets Stripe refund email(s).

### S2 — No-show → new handyman → paid adjustment follows the job (T7 choice 2 + T16)
1. [x ] CUST books `TEST S2`. HM-A claims. HM-A requests `+1`, CUST pays.
2. [ x] HM-A **Mark Complete** → CUST **Report Issue** → `2` → then `2` (new handyman).
3. [ x ] Check: CUST gets "we're finding you a new handyman"; admin email;
       `/admin` row ⚠️ → Details: **"No-show — customer wants a new handyman"**.
4. [ x ] `/admin` → **Force unassign** (add a note) → check:
       HM-A notified and **cannot** re-claim; CUST notified; HM-B gets the
       new-job WhatsApp; on HM-B's job board the card shows
       **"💰 Price includes +S$1 agreed with the customer: extra part"**.
5. [  x] HM-B claims → (ASAP: CUST approves time) → HM-B **Mark Complete** →
       CUST **Confirm Complete** → `/admin/fund-release` → **Release Funds**.
6. [x  ] Stripe https://dashboard.stripe.com/connect/transfers: **two** transfers
       to **HM-B** (≈S$3.41 + ≈S$0.51), **none** to HM-A for this job.

### S3 — No-show → reschedule with the same handyman (T7 choice 1)
1. [ x] CUST books `TEST S3`. HM-A claims → **Mark Complete** → CUST
       **Report Issue** → `2` → then `1` (reschedule).
2. [x  ] CUST gets a pick-time link → opens `/pick-time` → picks tomorrow.
3. [ x] HM-A gets "Customer picked … Approve / Decline" → **Approve** →
       both get "new time confirmed". Firestore: new `preferredDate`,
       `status: "in_progress"`.
4. [ x ] **Keep this job** for S5 (stuck-job sweep).

### S4 — Refund a job nobody claimed (R3)
1. [x ] CUST books `TEST S4`. **Nobody claims it** (HM-A/HM-B ignore the WhatsApp).
2. [ x] https://dashboard.stripe.com/payments → open the S$4.40 payment →
       **Refund** → full amount → Refund.
3. [ x] Within ~1 min, Firestore job: `paymentStatus: "refunded"`. CUST gets
       the Stripe refund email.
4. [ x] The job is still `pending` (still on the board): `/admin/jobs` → find
       `TEST S4` → **Set status (override)** → **cancelled**. Check it's gone
       from HM-A's job board.

### S5 — Stuck-job sweep, fast-forwarded (replaces T11)
Instead of waiting 2+ days, move the deadline into the past by hand.
1. [ x] On the S3 job, HM-A → **Propose new time** (any slot). CUST does **not** reply.
2. [ x] Firestore → `jobs/<S3 job id>/prompts` → open the newest
       `schedule_approval` (status `open`) → edit `expiresAt` to
       `2026-09-30T00:00:00.000Z` → Update.
3. [ x] Cloud Scheduler → **Force run** `stuckStateSweep`.
       Check: CUST gets a reminder WhatsApp ( prompt_nudge); the prompt now has
       `nudgedAt` and a new `expiresAt` (+24h). No attention flag yet.
4. [ x ] Edit that same prompt's `expiresAt` to `2026-09-30T00:00:00.000Z` again →
       **Force run** `stuckStateSweep` again.
5. [ x ] Check: prompt `status: "expired"`; `/admin` row ⚠️ → Details:
       **"WhatsApp question left unanswered"**; admin digest email arrives.
6. [ x] Clean up: Refund the S3 job (R1 path) so CUST has no open questions.

### S6 — Template delivery check (replaces T12)
- [x] 2026-10-01: Claude checked prod logs + Twilio — 98 WhatsApp sent since
      29 Sep, **0 failed / undelivered**, no `63016` errors, no template-less
      fallbacks.
- [x] 2026-10-01 after S1–S5: re-checked — 158 WhatsApp sent, **all read**,
      0 failed, no `63016`, no template-less fallbacks, no admin-email failures.

## Phase 6 — Refund testing

Refund button: https://www.easydonehandyman.sg/admin → **Active jobs** table
→ **Refund** on the job's row (calls `refundPayment`, `functions/index.js:1997`).

- [x ] **R1 Refund an in-progress job.** Book (S$4), HM-A claims, ADMIN clicks
      **Refund** → confirm. Check:
  - Stripe payments: payment shows **Refunded**.
  - Firestore job: `paymentStatus: "refunded"`, `status: "cancelled"`.
  - Row gone from the Active jobs table.
- [x] **R2 Refund with a paid price adjustment.** Do T5 up to "paid", then
      **Refund**. Stripe payments: **both** the S$4 and the S$5 charges show
      Refunded.
- [x ] **R3 Refund a job nobody claimed** (not in the Active jobs table).
      https://dashboard.stripe.com/payments → click the payment → **Refund**
      → full amount. Firestore job should change to
      `paymentStatus: "refunded"` within a minute. If job `status` is still
      `"pending"`, edit it to `"cancelled"` by hand so it leaves the board.
- [ x ] **R4 No-show → refund.** The job from T7 reply `3` → **Refund** on its
      row → same checks as R1.
- [x] **R5 Money never moves by itself.** (2026-10-01: Claude cross-checked all 8 test jobs Firestore ↔ Stripe — 5 refunded incl. S1's adjustment, 3 released with correct transfers, S2's went to HM-B only; 0 mismatches.) In Firestore, every test job that
      wasn't released or refunded still has `paymentStatus: "succeeded"`.

Real cards show the refund in 5–10 business days; **Refunded** in Stripe is
the pass condition.

## Phase 7 — Before real customers

- [x] DONE 2026-10-01 — real pricing merged (`81f2901`) and deployed after the owner's Node-22 smoke test. **Revert the test price.** PREPARED 2026-10-01 on branch `launch/real-pricing` (`4532c6e`: S$90–130 + S$20 floor in all 3 files, tests pass). After the Node smoke test, tell Claude Code "ship real pricing" → merge + deploy functions + hosting. (Original instructions below.) In both files, change
      `'Appliance Repair':  { min: 4,   max: 20 },` to
      `'Appliance Repair':  { min: 90,  max: 130 },` and remove the `TEMP`
      comment:
  - `/Users/liongchenglex/Desktop/AI_Projects/Handyman/src/config/servicePricing.js` (line 21)
  - `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/servicePricing.js` (line 18)

  - `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/validation/schemas.js`
    (line ~27): change `.min(4)` back to `.min(20)` and the description to
    `'Service fee in dollars (SGD 20 - SGD 10,000)'` — the payment
    minimum was lowered to S$4 for testing (2026-09-30).

  Then redeploy both parts (Phase 3 commands) and commit.
- [x] **Set up admin email alerts** — DONE 2026-10-01 (Gmail app password, test email + live alerts verified). Was NOT working (found
      2026-10-01). `functions/.env` still has placeholder values
      (`SMTP_USER=your_gmail@gmail.com`, `ADMIN_EMAIL=your_admin_email@example.com`),
      so every admin email (Needs attention, no-show, dispute, unmatched
      WhatsApp replies, daily digest) fails with Gmail `535 Username and
      Password not accepted`.
  1. Sending Gmail (e.g. `easydonehandyman@gmail.com`): turn on 2-Step
     Verification, then create an App password at
     https://myaccount.google.com/apppasswords (name "Handyman alerts").
  2. Add to `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/.env.handyman-sg-3b418`:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=<sending gmail>
     SMTP_PASS=<16-char app password, no spaces>
     ADMIN_EMAIL=<address that receives alerts>
     ```
  3. Deploy functions (Phase 3 backend command).
  4. Verify: send an unrecognised WhatsApp message (e.g. "hello test") from
     the customer phone → an "unmatched message" email arrives at
     `ADMIN_EMAIL`. Function logs must show no `535` / `sendAdminEmail failed`.
- [x] **Upgrade the backend runtime Node 20 → 22 — deadline 30 Oct 2026.** DONE 2026-10-01 (`3859b51`): all 34 functions on `nodejs22`, 165 tests pass, live endpoint verified. Owner smoke test (T1 at S$4) still to do.
      Google retires Node 20 for Cloud Functions on 2026-10-30; after that,
      `firebase deploy --only functions` is refused until upgraded (the
      running functions keep working, but no fixes can ship).
  1. `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/package.json`:
     `"engines": { "node": "20" }` → `"node": "22"` (ask Claude Code).
  2. `cd /Users/liongchenglex/Desktop/AI_Projects/Handyman/functions && npx jest`
     — all tests pass.
  3. Deploy functions (Phase 3 backend command). If the upload fails with
     "Failed to make request to https://storage.googleapis.com/…", just
     re-run — it's intermittent on Google's side.
  4. Re-run a short smoke test: T1 (book → claim → complete → release) and
     one WhatsApp reply flow (T3 or T6).
  - Optional later: `firebase-functions` 4.9 → latest has breaking changes;
    do it separately, not together with the Node upgrade.
- [x] DECIDED 2026-10-01: off for now (every handyman gets every job). Decide on `NOTIFY_FILTER_BY_SERVICE_TYPE` (keep or remove, Phase 4).
- [x] N/A — nothing was switched off (Phase 4 ping step skipped). Set any handyman `notifyOnNewJob` you switched off in Phase 4 back to
      `true`.
- [x] DECIDED 2026-10-01: KEEP them (closed, off the board; the only in-app record of the live Stripe test payments). Delete `TEST` jobs from prod Firestore (jobs collection → open job →
      **⋮ → Delete document**).
- [x] DECIDED 2026-10-01 (`0312f6c`): refund policy = honest full refund before the job is done, no fees (Terms §7 + FAQ rewritten); $20/$50 handyman penalties removed. Still-open product decisions (spec §6): refund policy wording (full vs
      minus fee), and the "$20 penalty" wording in the Express Interest pop-up.

## Phase 8 — Safe prod testing after real handymen join ("test mode")

**Goal:** once real handymen are onboarded, you can still book test jobs in
prod (real Stripe, real WhatsApp) and only YOUR test handymen ever hear about
them — no WhatsApp, and not on their job board.

**How it works (design):**

- A job is a **test job** when the customer phone is on an allow-list in the
  prod env (`TEST_CUSTOMER_PHONES`). The backend stamps `isTest: true` on the
  job when payment succeeds — before any handyman is notified. The phone is
  checked server-side, so a real customer can never accidentally be "test"
  unless they use your number.
- A handyman is a **test account** when their Firestore doc has
  `isTestAccount: true` (you set this by hand in the console; handymen can't
  set it themselves — Firestore rules block it).
- The rule, applied in both places a handyman can see a job:
  test jobs → test accounts only; real jobs → real handymen only.
  1. **WhatsApp new-job messages**, incl. daily re-sends and re-release after a
     cancel — all go through one function, `pickEligibleHandymen`
     (`functions/handymanNotifier.js`), so one filter covers them all.
  2. **The in-app job board** (`getAvailableJobs`) hides test jobs from real
     handymen and real jobs from test accounts.
- Everything else (payment capture, prompts, refunds, release, payouts) runs
  exactly as for a real job, so tests stay realistic. Admin pages show test
  jobs with a `TEST` badge so you don't release/refund the wrong one.

**Build — DONE 2026-10-01 (`5543d21`), deployed (rules + functions + website):**

- [x] Fan-out: test jobs → `isTestAccount` handymen only; real jobs never reach test accounts.
- [x] Jobs from `TEST_CUSTOMER_PHONES` stamped `isTest` at payment creation (+ backstop before fan-out).
- [x] Firestore rules: claim split enforced; clients can't write `isTest` / `isTestAccount`.
      Also fixed a pre-existing hole: handyman sign-up could self-create as verified/active.
      Verify any time: `python3 scripts/rules-smoke-test.py` against the emulator (11 scenarios).
- [x] Job board hides the other kind of job.
- [x] 🧪 TEST badge on Active jobs, All jobs, job Details and Fund release.
- [x] **S$1 test service** "Platform Test" (S$1–5): only shown at
      https://www.easydonehandyman.sg/request-job?test=1, and the server refuses
      payment for it unless the customer phone is a test phone.

**Setup (you do these, once):**

- [x] DONE 2026-10-01: `TEST_CUSTOMER_PHONES=+6581505267` set + deployed. Add your test customer number(s) to
      `/Users/liongchenglex/Desktop/AI_Projects/Handyman/functions/.env.handyman-sg-3b418`
      (comma-separated, any format), then redeploy functions:

  ```
  TEST_CUSTOMER_PHONES=+6581505267
  ```

- [x] DONE 2026-10-01: `isTestAccount: true` on chenglex1+2@gmail.com and sooseeann@gmail.com (chenglex1+3 stays a REAL handyman). Firestore → `handymen` → open each TEST handyman account → **Add field**
      `isTestAccount` (boolean) = `true`. ⚠️ A test account stops receiving REAL
      jobs — only mark accounts that will never do real work.

**Verify it works (once, ~S$1.10):**

- [ ] Open https://www.easydonehandyman.sg/request-job?test=1 → 🧪 banner shows →
      book **Platform Test** (S$1 + fee = S$1.10) from the test phone.
- [ ] Firestore job has `isTest: true`; `/admin` row shows 🧪 TEST.
- [ ] Test handyman gets the WhatsApp + sees it on the board; a non-test
      handyman (if any) gets nothing and doesn't see it.
- [ ] Open the same URL but book with a NON-test phone → payment is refused
      ("Platform Test is for internal testing only").
- [ ] Refund or release the test job as usual.

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
