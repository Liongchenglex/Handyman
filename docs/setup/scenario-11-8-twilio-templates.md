# Twilio Template Setup — Scenario 11 (Second Visit) + Scenario 8 (Access Issue)

One-stop runbook for creating the WhatsApp templates that the second-visit and
access-issue flows use, and wiring their SIDs into the Cloud Functions env.

**Until a template's env var is set, the code automatically falls back to a
freeform message** (`sendTwilioTemplateMessage` short-circuits on an unset SID).
Freeform only delivers inside a customer's 24h session window, so the flows
half-work without templates — set them up before real traffic.

Source of truth for body copy: `WHATSAPP_TEMPLATES.md` (T5, T8, T13, T17–T19,
corrected 2026-07-30 to match the shipped `contentVariables`). This doc extracts
just what you need to click through the Twilio Content Editor.

---

## Setup steps (per template)

1. Twilio Console → **Content Editor** → Create new content → type
   **Text** (or **Quick reply** where buttons are listed below). Language: English.
2. Paste the body, declare the `{{n}}` variables with the sample values given.
3. Add the quick-reply buttons exactly as written (button text is what the
   webhook router matches against).
4. Submit for **WhatsApp approval**, category **Utility** (all six).
5. Once approved, copy the Content SID (`HX…`) into the matching env var in
   `functions/.env.<project>` for each environment.
6. Redeploy functions (`firebase deploy --only functions`) — SIDs are read at
   call time via `process.env`, but a redeploy picks up the new env file.

---

## 1. `second_visit_proposal` → `TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL`

- **To:** customer · **Trigger:** handyman taps "Needs another visit" (Door 1) — outside session window
- **Code:** `requestSecondVisit`, `functions/index.js:4963`

```
Hi there, your handyman {{1}} says another visit is needed to finish job #{{2}}. Proposed date and time: {{3}}, {{4}}.

Please let us know if this works for you.
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | handyman name | Ah Seng |
| {{2}} | job short id | a1b2c3 |
| {{3}} | display date | Tuesday, 15 July |
| {{4}} | time | 2:00 PM |

Quick replies: **Approve** / **Decline** (router also accepts YES/NO/OK).

## 2. `second_visit_needed` → `TWILIO_TEMPLATE_SECOND_VISIT_NEEDED`

- **To:** handyman · **Trigger:** customer answers "He's coming back" on the completion poll — business-initiated
- **Code:** `coming_back` poll handler, `functions/index.js:2942`

```
🔁 The customer says job #{{1}} needs another visit. Propose the return time here:
{{2}}
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | job short id | a1b2c3 |
| {{2}} | full deep link | https://www.easydonehandyman.sg/job-details/abc123?action=disposition |

No buttons — the link is the answer path.
⚠️ Body ends with a URL variable; if WhatsApp rejects it, move the link to a
**CTA URL button** with a `{{1}}`-suffixed URL instead (same approach as the
existing `handyman_new_job` template) and keep only {{1}} in the body.

## 3. `visit_disposition` → `TWILIO_TEMPLATE_VISIT_DISPOSITION`

- **To:** handyman · **Trigger:** 7pm evening sweep on the visit day when the handyman went silent (Door 2)
- **Code:** `eveningVisitDisposition`, `functions/index.js:4229`

```
👷 How did today's job go — {{1}} (#{{2}})?

Tap to update (done / needs another visit / problem):
{{3}}
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | service type | Plumbing |
| {{2}} | job short id | a1b2c3 |
| {{3}} | full deep link | https://www.easydonehandyman.sg/job-details/abc123?action=disposition |

No buttons — the deep link opens the in-app disposition sheet. Same
ends-with-URL caveat as template 2 (same CTA-button escape hatch).

## 4. `access_issue_choice` → `TWILIO_TEMPLATE_ACCESS_ISSUE`

- **To:** customer · **Trigger:** handyman reports "Customer not home / no access" on the visit day — outside session window
- **Code:** `reportVisitIssue` (`no_access`), `functions/index.js:5063`

```
Hi there, your handyman {{1}} couldn't reach you today for job #{{2}}. How would you like to proceed?
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | handyman name | Ah Seng |
| {{2}} | job short id | a1b2c3 |

Quick replies: **Reschedule** / **Contact support** (router also accepts 1/2/SUPPORT/HELP).

## 5. `visit_problem` → `TWILIO_TEMPLATE_VISIT_PROBLEM`

- **To:** customer · **Trigger:** handyman reports "Problem — can't finish" (holding notice) — outside session window
- **Code:** `reportVisitIssue` (`cannot_finish`), `functions/index.js:5085`

```
ℹ️ There's a snag with job #{{1}} — our team is looking into it and will contact you shortly. Your payment stays protected.
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | job short id | a1b2c3 |

No buttons — informational only.

## 6. `job_completion_request_v2` → swap into `TWILIO_TEMPLATE_JOB_COMPLETION`

The existing approved completion-poll template has only 2 buttons and approved
templates are **immutable** — submit this as a NEW template, then point the
EXISTING env var `TWILIO_TEMPLATE_JOB_COMPLETION` at the new SID (no code change).

- **To:** customer · **Trigger:** handyman marks complete, or next-morning auto-poll
- **Code:** `functions/index.js:2574` and `:4127`

```
Hello {{1}},

Your handyman {{2}} has marked your "{{3}}" job as complete.

Job ID: {{4}}

Please review the work and confirm completion, or report any issues.
```

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | customer name | Sarah |
| {{2}} | handyman name | Ah Seng |
| {{3}} | service type | Plumbing |
| {{4}} | job id (full) | abc123xyz |

Quick replies: **✅ Confirm Complete** / **⚠️ Report Issue** / **🔁 He's coming back**.
Button text matters: the router matches "CONFIRM COMPLETE" → confirm,
"REPORT ISSUE" → reject (opens the what-happened follow-up), "HE'S COMING BACK"
→ coming_back (records second-visit intent). Until this v2 is approved, the old
2-button template keeps working — customers can still type 3/"coming back" as a
text reply and the router understands it.

---

## Env var block (copy into `functions/.env.<project>` once SIDs exist)

```
TWILIO_TEMPLATE_SECOND_VISIT_PROPOSAL=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_SECOND_VISIT_NEEDED=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_VISIT_DISPOSITION=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_ACCESS_ISSUE=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TEMPLATE_VISIT_PROBLEM=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# When job_completion_request_v2 (3-button) is approved, swap the SID here:
TWILIO_TEMPLATE_JOB_COMPLETION=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## After setup — quick verification

1. Deploy functions + rules together, then run the "Second visit + access
   issue" section of `docs/features/e2e-test-plan-job-lifecycle.md`.
2. Spot-check one out-of-window send per template (e.g. trigger
   `requestSecondVisit` >24h after the customer's last inbound message) — a
   Twilio 63016 error in the function logs means the template SID isn't being
   used.
