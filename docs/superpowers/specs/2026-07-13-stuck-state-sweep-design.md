# Design: Stage 4 — Stuck-State Sweep + Admin Attention Queue (Scenario 12)

Companion to `2026-07-12-job-lifecycle-scenarios-design.md` (§3 F5, Scenario 12). That spec defines the policy — every wait state gets a deadline, bounded nudges, then an admin who can always force resolution. This doc fixes the v1 machinery: what sweeps, when it nudges, how the admin queue works, and the auto-poll bug fix that rides along.

## 1. Scope (owner decisions, 2026-07-13)

**In:** three sweep ladders (prompt expiry, schedule gaps, unclaimed jobs); the attention queue on AdminDashboard with four actions (mark resolved, set time admin-as-actor, force-unassign, refund); the inert auto-poll confirm fix.

**Out (deferred):** the refund-lag re-alert row (`cancellation_requested` > 2d) — it is already the admin's queue; full Scenario 9 refund flows (policy copy, customer-initiated) — the queue's refund button is deliberately minimal.

## 2. Sweep architecture

- **One scheduled function `stuckStateSweep`** — daily at **10:30 SGT**, 30 minutes after `autoTriggerCompletionPoll` so freshly-sent polls are never inspected in the same run they were created.
- **Domain module `functions/sweepService.js`** (DI style, like `scheduleService.js`): pure detectors — `(entity, nowMs) → { verdict: 'ok' | 'nudge' | 'escalate', reason }` — are unit-tested; Firestore queries and Twilio/email sends stay in `index.js`.
- **Bounded nudges, marker-stamped.** A nudge is sent at most once per state: prompts and links carry `nudgedAt`; jobs carry a `sweepNudges` map (`{ asap_no_time: iso, unclaimed_r2: iso, ... }`). A rerun (or a crashed run retried) never double-nudges.
- **Escalation** writes to the job: `needsAttention: true` (queryable boolean) + `attentionNeeded: { type, at, detail?, promptId? }`. Type enum: `schedule_deadlock` (written immediately by the 3b decline path, not the sweep) `| prompt_expired | link_ignored | asap_no_time | unclaimed | reclaim_stalled`. Both fields are server-only (already in the rules deny lists; `needsAttention` gets added alongside).
- **One digest email per run** via the existing SMTP transport (no per-job spam; zero marginal cost): newly-escalated jobs with type, short id, parties, and age. Deadlocks keep their immediate email from Stage 3b.
- Daily cadence means thresholds are *evaluated* daily: "24h" in practice fires at the first 10:30 run after the state is a day old.

## 3. The three ladders

| Ladder | Detect | First action (once) | Escalate |
|---|---|---|---|
| **Prompt expiry** (covers completion polls, `schedule_approval`, `schedule_pick_approval`, any handyman-addressed prompt) | prompt `status=='open'`, `expiresAt` passed, no `nudgedAt` | nudge the owing party (`toPhone`): completion polls get a poll-resend in the existing copy; all others get `prompt_nudge` copy. Extend `expiresAt` +24h, stamp `nudgedAt`. | next pass still open → prompt marked `expired`, job escalated `prompt_expired` |
| **Link unused** | scheduleLink `status=='active'`, `expiresAt` passed | mark `expired`; issue ONE fresh link (`createdBy: 'system_nudge'`) and send it with nudge copy — a nudge without a working link is useless | a `system_nudge` link expiring → escalate `link_ignored` (no third link) |
| **ASAP, no confirmed time** | job `in_progress`, `preferredTiming !== 'Schedule'`, no `scheduledFromAsapAt`, NO open `schedule_approval`/`schedule_pick_approval` prompt, NO active link, `acceptedAt` > 24h ago | WhatsApp nudge to the handyman ("set the visit time from the job page"), stamp `sweepNudges.asap_no_time` | > 48h → escalate `asap_no_time` |
| **Unclaimed (paid, never accepted)** | job `pending`, `paymentStatus=='succeeded'`, no `handymanId`, `createdAt` > 3d | re-run the fan-out (existing round-marker `_r{N}` machinery, exclusions respected), stamp `sweepNudges.unclaimed_refanout` | > 7d → escalate `unclaimed` |
| **Re-released, never re-claimed** | same, with `reassignmentCount > 0`, age since last release > 2d | fan-out nudge (same machinery) | > 4d → escalate `reclaim_stalled` |

Escrow effect of every row: **none** — money moves only via the queue's explicit refund button or the existing fund-release page.

## 4. Admin attention queue (AdminDashboard)

`ActiveJobsTable` grows into the queue:

- **Query:** merge of `status == 'in_progress'` and `needsAttention == true` (second query catches escalated `pending`/unclaimed jobs). Attention rows first, reason chip shows `attentionNeeded.type` + age.
- **Mark resolved** → new admin endpoint `resolveAttention` (clears `needsAttention`/`attentionNeeded`, audit-logged `attention_resolved`). Rules already let admin clients write these fields, but the endpoint is the sanctioned path so every resolution is audited.
- **Set time (admin-as-actor)** → modal (ProposeTimeModal pattern, bounded date) → new endpoint `adminSetSchedule` → `applyScheduleChange(via: 'admin')` + notify both parties + supersede open schedule prompts + revoke active links + clear attention. This is F5's "set the time after phoning both parties" made real.
- **Force-unassign** → new endpoint `adminUnassignJob` reusing the Scenario-2 cancel/re-release machinery: previousHandymanIds exclusion, `assignmentHistory` entry recorded `via: 'admin'`, `cancellationCount` incremented, re-release + fan-out, both parties notified. Confirm dialog in the UI. (Also the answer to the stale-handyman edge from the 3b review.)
- **Refund** → button wiring the EXISTING `refundPayment` endpoint (already admin-authorized) with the job's paymentIntentId, then the job is marked `cancelled` and attention cleared. Confirm dialog with the amount.

## 5. Bug fix riding along: inert auto-poll confirm

`applyCompletionAnswer`'s transaction currently requires `status === 'pending_confirmation'`, but the nightly auto-poll leaves jobs `in_progress` — a customer's YES to an auto-fired poll is a no-op. Fix (owner decision, option 1): the transaction also accepts `status === 'in_progress'` **with `completionPollSentAt` set**, transitioning identically (YES → `pending_admin_approval`, NO → `disputed`). The handyman's cancel window (Scenario 6) and Mark-Complete flow are untouched.

## 6. New surface summary

Backend: `sweepService.js`, `stuckStateSweep` (scheduled), `resolveAttention`, `adminSetSchedule`, `adminUnassignJob` (all admin-authed, audit-logged), `applyCompletionAnswer` condition widened. Frontend: `ActiveJobsTable` queue upgrade + set-time modal + confirm dialogs. Rules: `needsAttention` added to the jobs system-field deny lists. Owner ops: `prompt_nudge` Meta template (freeform fallback until approved); Firestore may prompt for a composite index on the `needsAttention` query (single equality — none expected).

## 7. Testing

Pure detectors unit-tested in `functions/__tests__/sweepService.test.js` under fixed clocks (both TZ=UTC and TZ=Asia/Singapore). Endpoint and sweep wiring verified by review + `node --check` + the E2E checklist (to be written in the plan): manufacture each stuck state by hand-editing timestamps, run the sweep once (`firebase functions:shell` or temporary HTTP trigger), assert exactly one nudge, run again, assert escalation + digest + queue row + each of the four admin actions.
