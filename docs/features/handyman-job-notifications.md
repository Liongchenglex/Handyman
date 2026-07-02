# Handyman Job Notifications (WhatsApp Fan-out)

## Overview

When a customer submits and pays for a new job, notify eligible handymen via
WhatsApp with the job details and a deep link back to the job on the site.
Handymen tap the link, land on the job details page, and can express interest.

This document is the **Phase 1 design spec** — the initial per-job instant
fan-out implementation and the seams that let us layer a batched-digest
model (Phase 2) on later without rewriting job creation.

## Current Implementation Status

❌ **Not Implemented** (this document is the plan)

Existing infrastructure this feature will build on:
- Twilio WhatsApp integration via `sendWhatsAppNotification` HTTPS function
  (`functions/index.js`).
- Templated messaging helper `sendTwilioTemplateMessage`.
- Rate-limit helper `checkRateLimit(key, max, windowSec)`.
- Handyman opt-out surface at `NotificationPreferences.jsx`.

---

## Goals

- Instant push: an eligible handyman gets a WhatsApp message seconds after
  a matching job is paid for.
- Bounded cost: a single job cannot fan out to unbounded recipients — cap
  is a config value, not a code change.
- No spam: any single handyman can only be pinged N times per hour across
  the whole platform.
- No duplicates: retries (Firestore trigger retries, deploy races, manual
  re-runs) must never send the same handyman the same job twice.
- Zero-cost Phase 2 migration: switching individual handymen to a digest
  cadence later requires no changes to job creation.

## Non-Goals (deferred)

- **Distance / geo matching** — service-category filter only for now.
- **Skill scoring / preferred handymen** — no ranking beyond category match.
- **Multi-channel fallback** (SMS, push, email) — WhatsApp only.
- **Retry queue with exponential backoff** — Firestore's built-in trigger
  retry handles transient failures; anything more waits.
- **Batched digest** — Phase 2. The seam is designed in; the worker isn't.

---

## Prerequisites

These must ship **before or alongside** the notification feature, not after.
Landing the notification feature first would meaningfully increase the
blast radius of the pre-existing gap below.

### Firestore rules gap on the "claim job" branch

`firestore.rules`, the `allow update` block on `/jobs/{jobId}`, currently
lets *any* signed-in user set `handymanId` to their own UID on an
unassigned job:

```
resource.data.handymanId == null && request.resource.data.handymanId == request.auth.uid
```

This branch does not require the caller to actually be a handyman. Today
that's a latent gap because deep links to job pages are rare. Once we
start pushing job URLs into WhatsApp — where messages get forwarded — the
population who could exploit it grows to *anyone signed in on the
platform* (customers included, since they get anonymous auth
automatically).

**Fix**: gate the claim branch on `isHandyman()` (the helper already
exists in the same file, line 28). This also picks up the
`verified == true` check the helper enforces, so a rejected handyman
can't claim either.

Ship this in the same PR as the notification feature. The rules fix is
tiny and testable in isolation, but leaving it out defeats Concern B
below (see [Decisions](#decisions)).

---

## Architecture

### The trigger

Firestore `onCreate` on the `jobs` collection, gated on `paymentStatus`.

Why `onCreate` on `jobs` rather than piggybacking on `createPaymentIntent`
success? Two reasons:
1. Trigger fires exactly once per new job doc, regardless of which code path
   created it (customer checkout, admin backfill, future scripted seeding).
2. Firestore trigger retries protect us from transient Twilio 5xx without
   any custom retry code — as long as the send is idempotent (see below).

Because a job is created *before* payment succeeds in our flow, the
handler must **only fan out once payment is confirmed**. Two options:
- Trigger on `onCreate`, exit early if `paymentStatus !== 'succeeded'`.
  Rely on a second `onUpdate` trigger to catch the payment-succeeded
  transition.
- Trigger on `onWrite`, treat the "went from not-paid to paid" transition
  as the notification event.

We use the second — a single `onWrite` handler with a clear
"paid transition" guard — because it collapses to one code path and is
easier to reason about.

### The fan-out

Query `handymen` collection filtered by:
- `status == 'active'`
- `verified == true`
- `stripeOnboardingCompleted == true`
- `services array-contains <job.serviceType>`
- (Optional, per NotificationPreferences) `notifyOnNewJob != false`

Apply `.limit(NOTIFY_FANOUT_CAP)` (config, see below). All matching
handymen up to the cap get the message. No further ranking in Phase 1.

### Per-message idempotency (load-bearing)

Before every Twilio call, create/read a marker doc at:

```
jobs/{jobId}/notifications/{handymanId}
```

If the doc exists → skip. If not → create it with a `sending` status, send
the Twilio message, then update the doc to `sent` (with `twilioSid`) or
`failed` (with the error). Store `sentAt` / `failedAt` timestamps.

This one pattern does three things:
1. Guards against Firestore trigger retries.
2. Guards against deploy races (two function versions running briefly).
3. Provides the exact query Phase 2's digest worker needs — "for handyman X,
   which jobs since T have no notification doc?"

Consequence: the notification collection accumulates one small doc per
(job, handyman) pair. That's fine — it's the audit log, and it powers
Phase 2. Prune with a scheduled cleanup only if the collection ever gets
uncomfortable to scan.

### Rate limiting

Per-handyman rate limit via existing `checkRateLimit` helper, keyed:
`whatsapp_handyman_new_job_${handymanId}` — max `NOTIFY_MAX_PER_HANDYMAN_PER_HOUR`
in a rolling hour window. Excess sends are dropped (idempotency marker is
still written so we don't retry).

If a handyman is rate-limited we mark the notification doc `deferred` (not
`sent`) so Phase 2's digest can pick it up later, if we want that behavior.
Same seam. No extra code.

---

## Configuration

All tunables live in one exported constants block in
`functions/notificationConfig.js` (new file) so tuning is a
one-file change — no hunt through business logic.

```js
module.exports = {
  // Max handymen notified per job. Bounds cost per job.
  NOTIFY_FANOUT_CAP: parseInt(process.env.NOTIFY_FANOUT_CAP, 10) || 20,

  // Max notifications per handyman per rolling hour. Anti-spam.
  NOTIFY_MAX_PER_HANDYMAN_PER_HOUR: parseInt(process.env.NOTIFY_MAX_PER_HANDYMAN_PER_HOUR, 10) || 5,

  // Feature kill switch. Deploy this off to disable notifications
  // without rolling back code.
  NOTIFY_ENABLED: process.env.NOTIFY_ENABLED !== 'false',
};
```

Environment variables live in `functions/.env.<projectId>` — different
values per project (dev vs prod). Change without a code deploy: set the
env var and re-run `firebase deploy --only functions`.

### Choosing initial values

- `NOTIFY_FANOUT_CAP = 20` — comfortably covers current scale. Every $1
  Twilio spend covers roughly one job at this cap.
- `NOTIFY_MAX_PER_HANDYMAN_PER_HOUR = 5` — a handyman getting more than
  5 job pings an hour is almost certainly getting spammed.
- `NOTIFY_ENABLED = true` in dev, revisit for prod launch.

---

## Message Template

**New Twilio template** — `TWILIO_TEMPLATE_HANDYMAN_NEW_JOB` (approve
before deploying to live).

Content variables:
- `{{1}}` — Service type (e.g. "Plumbing")
- `{{2}}` — Service fee (e.g. "$120")
- `{{3}}` — Preferred timing (e.g. "Today, ASAP" or "Fri 5 Jul, 2pm")
- `{{4}}` — Postal district (first 2 digits, not full address — see
  Privacy below)
- `{{5}}` — Deep link URL (e.g. `https://easydonehandyman.com/job/JOB123`)

Fallback text (used when template SID isn't configured, e.g. sandbox):

```
📋 New job available!

Service: {serviceType}
Fee: ${estimatedBudget}
When: {timing}
Area: District {district}

Tap to view and accept:
{deepLink}
```

### Privacy note (why not the full address)

Full customer address is only revealed after a handyman accepts the job.
The pre-accept WhatsApp message contains district only — same policy the
frontend job board uses. Never expose the customer's phone in the
handyman notification.

---

## Data Model Changes

### `jobs/{jobId}` — additions

None strictly required for Phase 1. All state lives in the subcollection.
Optional aggregate for UI ("this job has been sent to N handymen"):

```
notifiedCount: number     // increment on each successful send
```

### `jobs/{jobId}/notifications/{handymanId}` — new subcollection

```
{
  status: 'sent' | 'failed' | 'deferred' | 'skipped_rate_limited',
  sentAt?: Timestamp,
  failedAt?: Timestamp,
  twilioSid?: string,
  error?: string,          // truncated Twilio error message
  attemptCount: number,    // for observability, not decision-making
}
```

### `handymen/{uid}` — additions (optional)

```
notifyOnNewJob: boolean   // default true. UI toggle in NotificationPreferences.
```

### Firestore rules

- Handymen may read `jobs/{jobId}/notifications/{their-uid}` only.
- No client writes to the notifications subcollection.
- No changes to existing `jobs` rules.

### Indexes

Composite index on `handymen`:
`status ASC, verified ASC, stripeOnboardingCompleted ASC, services array-contains, notifyOnNewJob ASC`

Firestore will suggest the index on first query; add it to
`firestore.indexes.json` when it does.

---

## Failure Modes & Handling

| Failure | Handling |
|---|---|
| Twilio 5xx / network | Marker doc set to `failed`; Firestore trigger retries automatically (default 7 retries with backoff). |
| Twilio 4xx (bad number, opted out) | Marker doc set to `failed`; **no retry** (retryable check in code). Log for later cleanup. |
| Handyman rate-limited | Marker doc set to `skipped_rate_limited`. Phase 2 digest may pick up. |
| Function timeout mid-fanout | Handymen with markers = already handled. Retry re-runs from the top; existing markers skip. |
| Twilio template not yet approved | Fallback text is sent. Same deep link. |
| Notifications disabled (`NOTIFY_ENABLED=false`) | Function exits immediately. No markers written, no cost. |

---

## Phase 2 Seam (Deferred)

When a handyman opts into digest, or when volume calls for it:

1. Add `notificationMode: 'instant' | 'digest'` on `handymen`. Default
   `instant`.
2. In the fan-out, skip handymen with `notificationMode === 'digest'` —
   but **still write the notification marker with `status: 'deferred'`**.
3. New scheduled function (e.g., every 15 minutes) reads
   `jobs/{*}/notifications/{handymanId}` where `status = 'deferred'` and
   `sentAt` is null, and batches per handyman into one WhatsApp message.

No changes required to job creation. That's the point.

---

## Testing Plan

### Emulator (functions + Firestore)

1. Seed 3 handymen: matching category, matching (opted-out), non-matching.
2. Create a job doc, then update `paymentStatus` to `succeeded`.
3. Assert:
   - 1 message sent (only the eligible handyman).
   - 1 marker at `jobs/{id}/notifications/{eligibleUid}` with status `sent`.
   - Re-fire the trigger — no second message, marker unchanged.
4. Bump `NOTIFY_FANOUT_CAP` to 1, seed 5 eligible handymen, run — assert
   exactly 1 send.
5. Set `NOTIFY_ENABLED=false`, run — assert 0 sends, 0 markers.

### Live dev (single test handyman)

1. Deploy to dev with `NOTIFY_FANOUT_CAP=1` for safety.
2. Create + pay for a real test job as a customer.
3. Confirm test handyman receives WhatsApp within ~10s of payment success.
4. Confirm deep link opens the correct job details page.
5. Check `jobs/{id}/notifications/{handymanUid}` — should be `sent` with a
   Twilio SID.

### Live prod (post-launch smoke)

- Same as live dev with real cap.
- Watch Cloud Function logs for the first 24 hours; watch Twilio spend.

---

## Key Files (planned)

**`functions/index.js`** — new export:
- `onJobPaymentSucceeded` — Firestore `onWrite` trigger on
  `jobs/{jobId}`. Detects the paid-transition, fans out.

**`functions/notificationConfig.js`** — new file:
- Exports the constants block above. Single source for tuning.

**`functions/handymanNotifier.js`** — new file (extracted for testability):
- `pickEligibleHandymen(job, db)` — returns capped list.
- `sendJobNotification(job, handyman, db, twilio)` — idempotent single-send.
- `runFanOut(job, db, twilio)` — orchestrates the above.

**`firestore.rules`** — additions:
- Handyman can read own notification markers.
- No client writes to `notifications` subcollection.

**`firestore.indexes.json`** — composite index for the eligibility query.

**`src/pages/JobDetails.jsx`** — no code changes required; deep link
already routes here. Verify the page renders correctly for a
not-yet-authenticated handyman (redirects to `/handyman-auth` and back).

**`src/components/handyman/NotificationPreferences.jsx`** — add a toggle
for `notifyOnNewJob` (Phase 1); the `notificationMode` toggle lands in
Phase 2.

---

## Decisions

Confirmed during design. Nothing here is still open.

### Fan-out

- **All matching handymen** get the notification (subject to the cap and
  per-handyman rate limit). No favoritism, no "spread the work" logic in
  Phase 1.
- **Strict category match** — a handyman is only notified about jobs in
  a `serviceType` they offer. Broader opt-in ("notify me for all jobs")
  is a Phase 2 preference, not Phase 1.
- **`notifyOnNewJob` defaults to `true`** for existing handymen when
  the feature ships. Send a heads-up broadcast on the day of launch so
  handymen aren't startled by their first WhatsApp ping.

### Concern A — Redirect preservation after auth

When a handyman taps a WhatsApp deep link on a device where they're not
signed in (mobile default browser, expired session, cleared cookies),
the app bounces them through `/handyman-auth`. **After login, redirect
to the original job URL — not the generic dashboard.**

Implementation: the auth flow reads a `?next=<encoded-path>` query
param (or a `sessionStorage` key set by JobDetails on the pre-auth
redirect) and honors it on successful sign-in. Falls back to the
dashboard when absent.

### Concern B — Forwarded links must not let non-handymen claim jobs

WhatsApp messages get forwarded. JobDetails stays viewable by any
signed-in user (the page content isn't sensitive — customer address is
already gated post-accept), but **claiming a job requires being a
verified handyman**. This is enforced by the Firestore rules fix in
[Prerequisites](#prerequisites), not by the UI (the UI already hides
the button, but rules are the real authority).
