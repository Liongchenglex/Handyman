# Twilio Template Setup — Scenario 7 (No-show) + Scenario 10 (Price Adjustment)

One-stop runbook for creating the WhatsApp templates that the no-show and
price-adjustment flows use, and wiring their SIDs into the Cloud Functions env.

**Until a template's env var is set, the code automatically falls back to a
freeform message** (`sendTwilioTemplateMessage` short-circuits on an unset SID).
Freeform only delivers inside a recipient's 24h session window, so the flows
half-work without templates — set them up before real traffic. This matters
more here than for most packs: `price_adjustment` is business-initiated after
an app action (handyman is very often outside the customer's session window),
and both `no_show_choice`/`no_show_reported` fire off automated polls or
free-text detection, not a fresh inbound message.

Source of truth for body copy: `WHATSAPP_TEMPLATES.md` (T6, T7, T12, T20,
corrected/added 2026-07-30 to match the shipped `contentVariables`). This doc
extracts just what you need to click through the Twilio Content Editor.

---

## Setup steps (per template)

1. Twilio Console → **Content Editor** → Create new content → type
   **Text** (or **Quick reply** where buttons are listed below). Language: English.
2. Paste the body, declare the `{{n}}` variables with the sample values given.
3. Add the quick-reply buttons exactly as written (button text is what the
   webhook router matches against).
4. Submit for **WhatsApp approval**, category **Utility** (all four).
5. Once approved, copy the Content SID (`HX…`) into the matching env var in
   `functions/.env.<project>` for each environment.
6. Redeploy functions (`firebase deploy --only functions`) — SIDs are read at
   call time via `process.env`, but a redeploy picks up the new env file.

---

## 1. `no_show_choice` → `TWILIO_TEMPLATE_NO_SHOW_CHOICE`

- **To:** customer · **Trigger:** `runNoShowReport` — a no-show is recorded (poll follow-up 2, or free-text detection) — offers the three-way choice
- **Code:** `runNoShowReport`, `functions/index.js:3136`

```
😔 We're very sorry — we've recorded that your handyman didn't turn up for Job #{{1}} ({{2}}). How would you like to proceed?

👉 Reply *1* — Reschedule with the same handyman
👉 Reply *2* — Get a new handyman
👉 Reply *3* — Cancel and get a refund
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | job short id | a1b2c3 |
| {{2}} | display date | Tuesday, 15 July |

Quick replies (exactly 3 — within the button cap): **Reschedule** / **New handyman** /
**Cancel & refund** (router matches `NO_SHOW_CHOICE_OPTIONS`, `functions/index.js:187`
— also accepts 1/2/3 and RESCHEDULE/NEW HANDYMAN/CANCEL/REFUND text replies).

## 2. `no_show_reported` → `TWILIO_TEMPLATE_NO_SHOW_REPORTED`

- **To:** handyman · **Trigger:** same `runNoShowReport` call, informs the handyman a no-show was logged against them — business-initiated, outside any session window
- **Code:** `runNoShowReport`, `functions/index.js:3118`

```
⚠️ The customer reported that nobody arrived for Job #{{1}} ({{2}}). If this was reported in error, reply here and our team will look into it.
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | job short id | a1b2c3 |
| {{2}} | display date | Tuesday, 15 July |

No buttons — a dispute reply falls through to F3 (reply parsing → admin).

## 3. `price_adjustment` → `TWILIO_TEMPLATE_PRICE_ADJUSTMENT`

- **To:** customer · **Trigger:** handyman submits "Request price adjustment" after inspection — business-initiated. Also re-sent (fresh link, same SID/vars) on the first `checkout.session.expired` — see caveat below.
- **Code:** `requestPriceAdjustment`, `functions/index.js:5796` (send); re-issue at `functions/index.js:2596`

```
💰 Your handyman has requested a price adjustment of +S${{1}} for Job #{{3}}.

Reason: {{2}}

👉 Pay here to approve (valid 24h):
{{4}}

👉 Reply *NO* to decline
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | total amount (delta + platform fee, 2dp) | 42.00 |
| {{2}} | reason (truncated to 150 chars) | Corroded pipe replacement |
| {{3}} | job short id | a1b2c3 |
| {{4}} | Stripe Checkout URL | https://checkout.stripe.com/c/pay/cs_test_... |

Quick replies: **ONE** button, **Decline** only (router: `PRICE_ADJUSTMENT_CHOICE_OPTIONS`,
`functions/index.js:182` — also accepts NO/N/2 text replies). There is deliberately no
"Approve" button or reply — paying the Checkout link IS the approval (Scenario 10 design,
plan `2026-07-30-no-show-and-price-adjustment.md`).

⚠️ Body ends with a variable (the Checkout URL) — breaks this pack's own "must not end
with a variable" rule and the `schedule_link` "bare token, not a full URL" guidance (see
`WHATSAPP_TEMPLATES.md` top-of-section notes), because the shipped fallback sends the
complete URL as-is. If WhatsApp rejects it, fall back to a **CTA URL button** with a
`{{1}}`-suffixed URL (same escape hatch as `visit_disposition`/`second_visit_needed`)
and keep only the amount/reason/job-id variables in the body.

## 4. `price_adjustment_paid` → `TWILIO_TEMPLATE_ADJUSTMENT_PAID`

- **To:** BOTH parties · **Trigger:** `checkout.session.completed` webhook applies the paid delta — confirms the customer and unblocks the handyman
- **Code:** customer send `functions/index.js:2533`, handyman send `functions/index.js:2541`

```
✅ The +S${{1}} adjustment for Job #{{2}} has been paid.
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | amount (2dp) | 42.00 |
| {{2}} | job short id | a1b2c3 |

No buttons — informational only. Same content SID is sent to both roles with identical
variables; only the **freeform fallback** text differs (customer: "Payment received —
... is confirmed. Thank you!"; handyman: "...you're clear to proceed.") — keep the
approved template body neutral enough to read correctly for either recipient.

---

## Env var block (copy into `functions/.env.<project>` once SIDs exist)

```
TWILIO_TEMPLATE_NO_SHOW_CHOICE=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_NO_SHOW_REPORTED=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_PRICE_ADJUSTMENT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_ADJUSTMENT_PAID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Owner gates before go-live

1. **Stripe Dashboard:** subscribe `checkout.session.completed` **and**
   `checkout.session.expired` on **BOTH** webhook endpoints — the same console
   step used earlier for `payment_intent.amount_capturable_updated`. Without
   these, paid deltas never apply and expired sessions never re-issue or
   terminate (the job wedges on a dead Checkout link).
2. Set the 4 template env vars above (per environment) once Meta approves them.
   Freeform fallback covers the gap until then, inside session windows only.
3. Deploy functions + rules together (`firebase deploy --only functions,firestore:rules`)
   — the rules deny-list additions (handyman cannot write `noShowCount`/
   `cancellationCount`; client cannot write `priceAdjustment`) must land with
   the functions that assume them.
4. Run the new "No-show + price adjustment" section of
   `docs/features/e2e-test-plan-job-lifecycle.md` on the test project with
   Stripe test mode (card `4242 4242 4242 4242`).

## After setup — quick verification

1. Spot-check one out-of-window send per template (e.g. trigger
   `requestPriceAdjustment` >24h after the customer's last inbound message) — a
   Twilio 63016 error in the function logs means the template SID isn't being
   used.
2. Trigger a `checkout.session.expired` manually (Stripe CLI or dashboard) on a
   test session to confirm the re-issue-once-then-terminal behavior before
   relying on the 24h natural expiry.
