# WhatsApp Message Templates (Twilio)

This document contains the WhatsApp message templates that need to be created in Twilio Console and submitted for WhatsApp approval.

## Overview

WhatsApp requires all proactive messages (messages sent outside the 24-hour customer service window) to use pre-approved templates. These templates must be created in the Twilio Console and submitted to WhatsApp for approval.

---

## Required Templates

### 1. Job Payment Confirmation (After Payment Success)

**Template Name:** `job_payment_confirmation`
**Purpose:** Notify customer that their job has been posted successfully after payment
**Trigger:** After payment is captured and job status changes to `pending`
**Language:** English
**Category:** TRANSACTIONAL

**Template Content:**
```
Hi {{1}}, your job request for "{{2}}" has been posted successfully!

Service Fee: {{3}}
Job ID: {{4}}
Timing: {{5}}

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

**Template Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Service type (e.g., "Plumbing Repair", "Aircon Servicing")
- `{{3}}` - Service fee (e.g., "$150.00")
- `{{4}}` - Job ID
- `{{5}}` - Timing preference (e.g., "ASAP" or "2025-01-25 at 2:00 PM")

**Sample Message:**
```
Hi John Tan, your job request for "Plumbing Repair" has been posted successfully!

Service Fee: $150.00
Job ID: abc123xyz
Timing: 2025-01-25 at 2:00 PM

A qualified handyman will accept your job shortly. You'll receive a notification when someone accepts.

Thank you for using EazyDone!
```

**Code Reference:**
Environment Variable: `REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT`
File: `src/services/whatsappService.js:286`
Function: `sendJobCreationNotification()`

---

### 2. Handyman Accepted Job (Job Acceptance Notification)

**Template Name:** `handyman_accepted_job`
**Purpose:** Notify customer that a handyman has accepted their job
**Trigger:** When handyman clicks "Express Interest" and job status changes to `in_progress`
**Language:** English
**Category:** TRANSACTIONAL

**Template Content:**
```
Your job has been accepted by "{{1}}"

Service Fee: ${{2}}
Job ID: {{3}}
Scheduled Time: {{4}}

Important:
If the handyman does not show up at the scheduled appointment time, please contact us at easydonehandyman@gmail.com.
```

**Template Variables:**
- `{{1}}` - Handyman name
- `{{2}}` - Service fee (e.g., "150.00")
- `{{3}}` - Job ID
- `{{4}}` - Scheduled time (e.g., "As soon as possible" or "2025-01-25 at 2:00 PM")

**Sample Message:**
```
Your job has been accepted by "Michael Lee"

Service Fee: $150.00
Job ID: abc123xyz
Scheduled Time: 2025-01-25 at 2:00 PM

Important:
If the handyman does not show up at the scheduled appointment time, please contact us at easydonehandyman@gmail.com.
```

**Code Reference:**
Environment Variable: `REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED`
File: `src/services/whatsappService.js:255`
Function: `sendJobAcceptanceNotification()`

---

### 3. Job Completion Notification with Quick Reply Buttons

**Template Name:** `job_completion_request`
**Purpose:** Notify customer that handyman has marked the job as complete with action buttons
**Trigger:** When handyman marks job complete and status changes to `pending_confirmation`
**Language:** English
**Category:** TRANSACTIONAL

**Status:** ✅ Recommended for MVP - Includes Quick Reply buttons for instant customer response

**Template Content:**
```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```

**Template Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Handyman name
- `{{3}}` - Service type
- `{{4}}` - Job ID

**Quick Reply Buttons:**
1. **Button 1:** "✅ Confirm Complete"
   - When tapped: Sends "confirm_complete" to webhook
   - Action: Job status → `completed`, payment released to handyman

2. **Button 2:** "⚠️ Report Issue"
   - When tapped: Sends "report_issue" to webhook
   - Action: Job status → `disputed`, notify support team

**Twilio Configuration:**
In Twilio Content Editor, add these buttons:
- Button Type: **Quick Reply**
- Button 1 Text: `✅ Confirm Complete`
- Button 2 Text: `⚠️ Report Issue`

**Webhook Requirements:**
- Endpoint: `POST /api/whatsapp/webhook`
- Handles button responses
- Updates job status based on customer action
- Sends confirmation message back to customer

**Code Reference:**
File: `src/components/handyman/JobActionButtons.jsx:74`
Function: `sendJobCompletionNotification()`
Webhook: `functions/index.js` (to be created)

---

## How to Create Templates in Twilio Console

See detailed instructions in: `docs/setup/whatsapp-templates.md`

**Quick Steps:**
1. Login to Twilio Console
2. Navigate to **Messaging** → **Content Editor**
3. Click **Create new Content Template**
4. Select **WhatsApp** as the channel
5. Fill in template details:
   - **Name:** Use the template name from above
   - **Language:** English
   - **Category:** TRANSACTIONAL
   - **Content:** Copy the template content from above
6. Click **Submit for Approval**
7. Wait 24-48 hours for WhatsApp approval
8. Once approved, copy the **Content SID** (format: `HXxxxxx`)
9. Add the Content SID to your `.env.local` file

---

## Environment Variables

After templates are approved, add the Content SIDs to your `.env.local`:

```env
# Twilio WhatsApp Configuration
REACT_APP_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
REACT_APP_TWILIO_AUTH_TOKEN=your_auth_token_here
REACT_APP_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Twilio Content Template SIDs (HXxxxxx format)
REACT_APP_TWILIO_TEMPLATE_JOB_PAYMENT=HXxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_ACCEPTED=HXxxxxx
REACT_APP_TWILIO_TEMPLATE_JOB_COMPLETED=HXxxxxx
```

---

## Template Approval Guidelines

**WhatsApp Template Requirements:**
- ✅ Transactional templates typically approved within 24 hours
- ✅ Must provide value to the customer
- ✅ Must be clear and concise
- ✅ Variables should be clearly marked with `{{1}}`, `{{2}}`, etc.
- ❌ No promotional content
- ❌ No opt-out language (WhatsApp provides this automatically)
- ❌ No link shorteners or suspicious URLs

**Categories:**
- **TRANSACTIONAL** - For transaction updates, confirmations, status changes (fastest approval)
- **MARKETING** - For promotional messages (requires opt-in)
- **UTILITY** - For account updates, alerts, reminders

---

## Testing Templates

### Using Twilio WhatsApp Sandbox

Before production, test your templates using the Twilio WhatsApp Sandbox:

1. Join the sandbox by sending the sandbox code to your Twilio WhatsApp number
2. Use the sandbox number in `REACT_APP_TWILIO_WHATSAPP_FROM`
3. Test with your own phone number
4. Check console logs for debugging

**Note:** Sandbox allows testing without template approval, but production requires approved templates.

---

## Future Templates (Optional)

### 4. Payment Released to Handyman

**Purpose:** Notify handyman when payment is released after job completion
**Trigger:** After customer confirms completion and payment is transferred
**Status:** Not yet implemented

**Template Content:**
```
Great job, {{1}}!

Payment for your "{{2}}" job has been released.

Amount: {{3}}
Job ID: {{4}}

The funds will be transferred to your account within 3-5 business days.

Thank you for using EazyDone!
```

**Template Variables:**
- `{{1}}` - Handyman name
- `{{2}}` - Service type
- `{{3}}` - Payment amount
- `{{4}}` - Job ID

---

## Job Lifecycle Template Pack (v1)

Source: `docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md` (§3 template pack + a sweep of every business-initiated message in the scenario flows). All templates below are **Category: UTILITY** (WhatsApp deprecated the TRANSACTIONAL label). Submit early; freeform fallback until approved, matching the existing pattern.

**WhatsApp formatting rules applied throughout:**
- A template body must NOT start or end with a variable — every body below opens with "Hi {{1}}," and closes with a fixed sentence.
- Quick-reply buttons: max 3 per template.
- URLs: prefer a fixed domain with only the token as a variable, or a Twilio call-to-action URL button with a dynamic suffix — a fully-variable URL risks rejection.

### Already approved / shipped — no action

| Template | Env var |
|---|---|
| Job created (fan-out) | `TWILIO_TEMPLATE_JOB_CREATED` |
| Handyman accepted job | `TWILIO_TEMPLATE_JOB_ACCEPTED` |
| Completion poll (2 buttons) | `TWILIO_TEMPLATE_JOB_COMPLETION` — superseded by v2 below |
| Handyman cancelled | `TWILIO_TEMPLATE_HANDYMAN_CANCELLED` |

### New templates to submit

#### T0. `schedule_proposal` — customer (Scenarios 3/4)
The sending code shipped (`proposeSchedule`, env `TWILIO_TEMPLATE_SCHEDULE_PROPOSAL`) but the template itself was never created — it currently relies on the freeform fallback. The code sends exactly these 4 variables (no customer name, no note — the note only appears in the freeform fallback), and the same template covers both a first-time ASAP proposal and a reschedule, so the copy stays neutral between the two.
```
Hi there, your handyman {{1}} has proposed a visit time for your job (#{{4}}):

{{2}} at {{3}}

Please approve or decline this proposed time.
```
Quick replies: **Approve** / **Decline** (router accepts YES/APPROVE/OK and NO/DECLINE — see `SCHEDULE_APPROVAL_OPTIONS` in `functions/index.js`).
`{{1}}` handyman name · `{{2}}` display date (e.g. "Tuesday, 15 July") · `{{3}}` time · `{{4}}` short job ID.
Code reference: `functions/index.js:4095` (`proposeSchedule`).

#### T1. `schedule_link` — customer (Scenarios 3/4, F6)
Carries the F6 pick-time URL. Needed because admin-triggered sends fall outside the 24h session window.

The link is `${APP_URL}/pick-time?t=<token>`, but the **production domain is hardcoded** in the template and only the token is a variable — WhatsApp tends to reject bodies where a variable carries a whole URL. Approved templates are only used in production; the dev project (`eazydone-d06cf.web.app`) rides the freeform fallback (template SID unset), which builds the URL from `APP_URL` as usual.
```
Hi {{1}}, you can pick a new visit time for your {{2}} job (#{{3}}) here:

https://www.easydonehandyman.sg/pick-time?t={{4}}

The link is valid for 72 hours and can only be used once. If you need help, just reply to this message.
```
`{{1}}` customer name · `{{2}}` service type · `{{3}}` job ID · `{{4}}` raw link token (NOT the full URL).

⚠️ Sending code must pass the bare token as `{{4}}`; the freeform fallback keeps using `${APP_URL}/pick-time?t=<token>`. Prod `APP_URL` (in `functions/.env.handyman-sg-3b418`) must match the hardcoded host exactly (`https://www.easydonehandyman.sg`, including the `www.`) so the fallback and template never point at different hosts. A domain change means submitting a new template (approved templates are immutable).
*Alternative:* a CTA URL button with dynamic suffix (`https://www.easydonehandyman.sg/pick-time?t={{1}}`) — same hardcoded-domain rule applies.

#### T2. `schedule_pick_approval` — handyman (Scenarios 3/4/7, roles-flipped)
The customer's pick from `/pick-time` arrives via a web page, so the handyman is outside any session window.
```
Hi {{1}}, the customer for your {{2}} job (#{{3}}) has picked a new visit time: {{4}}. Does this work for you?
```
Quick replies: **Approve** / **Decline**.
`{{1}}` handyman name · `{{2}}` service type · `{{3}}` job ID · `{{4}}` picked date/time.

#### T3. `schedule_confirmed` — both parties (F4 confirmations)
After any `scheduleChange`, at least one party is outside the session window.
```
Hi {{1}}, the visit for your {{2}} job (#{{3}}) is confirmed for {{4}}. See you then!
```

#### T4. `running_late_notice` — customer (Scenario 5)
```
Hi {{1}}, a quick update: your handyman {{2}} is running about {{3}} late for today's visit (job #{{4}}). New estimated arrival: {{5}}. Sorry for the wait — thank you for your patience!
```

#### T5. `job_completion_request_v2` — customer (Scenario 7 entry point a)
Approved templates are immutable, so adding the third no-show button means submitting a NEW template (same body as the existing completion poll).
```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```
Quick replies: **✅ Confirm Complete** / **⚠️ Report Issue** / **🔁 He's coming back**.
Third button maps to `COMPLETION_PROMPT_OPTIONS['3'] = 'coming_back'` (`functions/index.js:142`) — records second-visit intent directly. "Handyman never came" is no longer a top-level button; it now lives one level down, as option 2 of the `COMPLETION_NO_FOLLOWUP_OPTIONS` follow-up question asked after a bare "Report Issue"/NO reply (`functions/index.js:147`).

#### T6. `no_show_choice` — customer (Scenario 7)

⚠️ Corrected from an earlier 4-var draft (`{{1}}` greeting name, `{{2}}` service type, `{{3}}` job id, `{{4}}` date). The shipped code (`runNoShowReport`, `functions/index.js:3136`) sends only 2 `contentVariables` — no name, no service type — matching its freeform fallback verbatim.
```
😔 We're very sorry — we've recorded that your handyman didn't turn up for Job #{{1}} ({{2}}). How would you like to proceed?

👉 Reply *1* — Reschedule with the same handyman
👉 Reply *2* — Get a new handyman
👉 Reply *3* — Cancel and get a refund
```
`{{1}}` job short id · `{{2}}` display date (e.g. "Tuesday, 15 July").
Quick replies (exactly 3 — within the button cap, no overflow): **Reschedule** / **New handyman** / **Cancel & refund**, matching `NO_SHOW_CHOICE_OPTIONS` keys (`functions/index.js:187`).

#### T7. `no_show_reported` — handyman (Scenario 7)

⚠️ Corrected from an earlier 3-var draft (`{{1}}` handyman name, `{{2}}` job id, `{{3}}` date). The shipped code (`runNoShowReport`, `functions/index.js:3118`) sends only 2 `contentVariables` — the handyman-name variable was dropped (the body doesn't greet by name) — matching its freeform fallback verbatim.
```
⚠️ The customer reported that nobody arrived for Job #{{1}} ({{2}}). If this was reported in error, reply here and our team will look into it.
```
`{{1}}` job short id · `{{2}}` display date.
No quick-reply buttons — a text reply (dispute) falls through to F3.

#### T8. `access_issue_choice` — customer (Scenario 8)
Triggered by a handyman app action, so the customer is outside the session window. Different copy and button set from `no_show_choice`, so it's a separate template.

⚠️ Corrected from an earlier 3-var draft (`{{1}}` customer name, `{{2}}` handyman name, `{{3}}` job id): the shipped code (`reportVisitIssue`, `functions/index.js:5030`) sends only 2 `contentVariables` — no customer-name variable — matching its freeform fallback `😕 {{handymanName}} couldn't reach you today for Job #{{jobShortId}}.`
```
Hi there, your handyman {{1}} couldn't reach you today for job #{{2}}. How would you like to proceed?
```
`{{1}}` handyman name · `{{2}}` job short id.
Quick replies: **Reschedule** / **Contact support** (router: `ACCESS_ISSUE_OPTIONS`, `functions/index.js:162`).

#### T9. `customer_cancel_confirm` — customer (Scenario 9)
⚠️ Blocked on owner decision §6.1 (refund policy copy) — either settle the copy first or keep the policy line as variable `{{4}}` as below.
```
Hi {{1}}, you've asked to cancel your {{2}} job (#{{3}}).

Refund policy: {{4}}

Please confirm to proceed with the cancellation.
```
Quick replies: **Confirm cancel** / **Keep my job**.
Note: when the customer texts "cancel" this rides the free session window, but the template is still needed for admin-offered cancellations (Scenarios 7/12).

#### T10. `customer_cancelled` — handyman (Scenario 9)
```
Hi {{1}}, the customer has cancelled job #{{2}} ({{3}}). No action is needed from you — the job has been removed from your list.
```

#### T11. `refund_processed` — customer (Scenario 9)
Admin executes the refund days later — always outside the session window.
```
Hi {{1}}, your refund of {{2}} for job #{{3}} has been processed. The funds should reach your original payment method within 5–10 business days. Thank you for using EazyDone!
```

#### T12. `price_adjustment` — customer (Scenario 10)

*(Renamed from an earlier `price_adjustment_approval` draft — Scenario 10's design was revised 2026-07-30 to **approve-by-paying**: the Stripe Checkout link IS the approve path, so there's no separate "Approve" reply/button, only Decline.)*

⚠️ Corrected from the earlier 6-var draft above (customer name, service type, handyman name, and a combined amount+reason were reshaped). The shipped code (`requestPriceAdjustment`, `functions/index.js:5796`) sends exactly 4 `contentVariables`, matching its freeform fallback verbatim.
```
💰 Your handyman has requested a price adjustment of +S${{1}} for Job #{{3}}.

Reason: {{2}}

👉 Pay here to approve (valid 24h):
{{4}}

👉 Reply *NO* to decline
```
`{{1}}` total amount (delta + platform fee, 2dp) · `{{2}}` reason (truncated to 150 chars) · `{{3}}` job short id · `{{4}}` Stripe Checkout URL.
Quick replies: **ONE** button, **Decline** only (router: `PRICE_ADJUSTMENT_CHOICE_OPTIONS`, `functions/index.js:182` — NO/DECLINE/N/2).

⚠️ Body ends with a variable (the Checkout URL), same caveat as T17/T18 — this pack's "must not end with a variable" rule and T1's "bare token, not a full URL" guidance are both broken here because the shipped fallback sends the complete URL as-is. Owner should weigh the CTA URL button escape hatch (T1-style, dynamic suffix on a fixed domain) before submitting; until then, document as shipped.

Also sent on `checkout.session.expired` re-issue (`functions/index.js:2596`, same SID, same 4 vars, fresh `{{4}}` link) — one automatic re-send before the adjustment goes terminal.

#### T13. `second_visit_proposal` — customer (Scenario 11 Door 1)

⚠️ Corrected from an earlier 6-var draft (customer name, service type, reason, and a combined date+time were dropped). The shipped code (`requestSecondVisit`, `functions/index.js:4930`) sends exactly 4 `contentVariables` — no customer name, no service type, no reason, and date/time as two separate variables — matching its freeform fallback `🔁 {{handymanName}} says another visit is needed for Job #{{jobShortId}} and proposes {{displayDate}}, {{proposedTime}}.`
```
Hi there, your handyman {{1}} says another visit is needed to finish job #{{2}}. Proposed date and time: {{3}}, {{4}}.

Please let us know if this works for you.
```
`{{1}}` handyman name · `{{2}}` job short id · `{{3}}` display date (e.g. "Tuesday, 15 July") · `{{4}}` time.
Quick replies: **Approve** / **Decline** (router accepts YES/NO too — `SCHEDULE_APPROVAL_OPTIONS`, `functions/index.js:156`; prompt type `second_visit_approval`).

#### T14. `job_not_complete` — customer (Scenario 6 corrective notice)
Supersedes an open completion poll when the handyman cancels post-inspection.
```
Hi {{1}}, an update on your {{2}} job (#{{3}}): this job is not complete. Your handyman couldn't continue with the work, so we're finding you a replacement now. Your payment remains fully protected until the job is done.
```

#### T15. `arranging_notice` — customer (Scenarios 3/4/12, schedule deadlock)
```
Hi {{1}}, thanks for your patience — we're arranging the visit time for your {{2}} job (#{{3}}). Our team is on it and you'll hear from us shortly.
```

#### T16. `prompt_nudge` — either party (F5 ladder, Scenario 12 sweeps)
Generic reminder reused across all prompt types; `{{3}}` restates the pending question.
```
Hi {{1}}, a gentle reminder — we're still waiting for your reply on job #{{2}}:

{{3}}

Please respond when you can so we can keep things moving. Thank you!
```

#### T17. `visit_disposition` — handyman (Scenario 11 Door 2, evening sweep)
Body copy is the freeform fallback from `eveningVisitDisposition` (`functions/index.js:4226`) verbatim, converted to variables.
```
👷 How did today's job go — {{1}} (#{{2}})?

Tap to update (done / needs another visit / problem):
{{3}}
```
`{{1}}` service type · `{{2}}` job short id · `{{3}}` link (`${APP_URL}/job-details/{id}?action=disposition`, full URL).
⚠️ Body ends with a variable (the link), which breaks this pack's own "must not end with a variable" rule (see top of section) and the T1 "bare token, not a full URL" guidance — the shipped fallback sends the complete URL as-is, so documenting as shipped rather than reshaping; owner should weigh a CTA URL button (T1-style) before submitting.
No quick-reply buttons — the deep link is the answer path; text replies fall through to the generic F3 router.

#### T18. `second_visit_needed` — handyman (Scenario 11 Door 1, handyman ping after customer says "coming back")
Body copy is the freeform fallback from the `coming_back` poll-reply handler (`functions/index.js:2939`), minus the conditional Mark-Complete-conflict clause (that clause only exists in the fallback, not as a template variable).
```
🔁 The customer says job #{{1}} needs another visit. Propose the return time here:
{{2}}
```
`{{1}}` job short id · `{{2}}` link (`${APP_URL}/job-details/{id}?action=disposition`, full URL — same URL caveat as T17).
No quick-reply buttons — the deep link is the answer path.

#### T19. `visit_problem` — customer (Scenario 8 `cannot_finish` holding notice)
Body copy is the freeform fallback from `reportVisitIssue`'s `cannot_finish` branch (`functions/index.js:5052`) verbatim.
```
ℹ️ There's a snag with job #{{1}} — our team is looking into it and will contact you shortly. Your payment stays protected.
```
`{{1}}` job short id.
No quick-reply buttons — informational only; admin mediates separately (often becomes Scenario 6 swap or Scenario 10 price talk).

#### T20. `price_adjustment_paid` — both parties (Scenario 10)
Same content SID sent to both the customer (`functions/index.js:2533`) and the handyman (`functions/index.js:2541`) on `checkout.session.completed`, with identical `{{1}}`/`{{2}}` values — only the **freeform fallback** text differs by role, so the approved template body below stays neutral enough for both audiences.
```
✅ The +S${{1}} adjustment for Job #{{2}} has been paid.
```
`{{1}}` amount (2dp) · `{{2}}` job short id.
Freeform fallback (customer): `✅ Payment received — the +S${{1}} adjustment for Job #{{2}} is confirmed. Thank you!`
Freeform fallback (handyman): `✅ The customer paid the +S${{1}} adjustment for Job #{{2}} — you're clear to proceed.`
No quick-reply buttons — informational only.

### Messages that do NOT need templates
These always ride the free 24h session window because the recipient just messaged us: the decline→link send in Scenarios 3/4 (customer just replied Decline — though `schedule_link` covers the admin-triggered case anyway), the cancel-confirmation prompt when the customer texts "cancel", numbered job-picker disambiguation replies, and the Stripe payment link sent right after a price-adjustment Approve.

---

**Last Updated:** 2026-07-30
**Status:** 🔄 Job lifecycle pack (T1–T20) drafted — pending Twilio Content Editor creation and WhatsApp approval. T5, T8, T13 corrected 2026-07-30 to match the shipped `contentVariables`; T17–T19 added for `visit_disposition` / `second_visit_needed` / `visit_problem` (plan `2026-07-29-second-visit-and-access-issue.md`). T6, T7 corrected and T12 renamed/rewritten (`price_adjustment_approval` → `price_adjustment`, approve-by-paying) + T20 `price_adjustment_paid` added 2026-07-30 (plan `2026-07-30-no-show-and-price-adjustment.md`).
