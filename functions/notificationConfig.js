/**
 * Handyman notification config — single source of truth for tuning
 * the "new job" WhatsApp fan-out.
 *
 * All values are overridable via env vars in functions/.env.<projectId>,
 * so we can tune per environment (dev vs prod) without a code deploy —
 * change the env var and re-run `firebase deploy --only functions`.
 *
 * See docs/features/handyman-job-notifications.md for rationale and
 * the Phase 2 seam these constants leave open.
 */

module.exports = {
  // Max handymen notified per job. Bounds Twilio cost per job — a burst
  // of matching handymen can't blow the budget. Chosen to comfortably
  // cover current scale; revisit once we cross ~50 active handymen or
  // begin seeing regular budget alerts.
  NOTIFY_FANOUT_CAP:
    parseInt(process.env.NOTIFY_FANOUT_CAP, 10) || 20,

  // Rolling-hour per-handyman ceiling. Anti-spam: a handyman getting
  // more than this in an hour is almost certainly being over-notified.
  // Excess sends are recorded on the marker as `skipped_rate_limited`
  // (see handymanNotifier.js) so a Phase 2 digest can still pick them
  // up later without re-sending duplicates.
  NOTIFY_MAX_PER_HANDYMAN_PER_HOUR:
    parseInt(process.env.NOTIFY_MAX_PER_HANDYMAN_PER_HOUR, 10) || 5,

  // Feature kill switch. Setting NOTIFY_ENABLED=false in the env lets
  // ops disable notifications without a code rollback (e.g. during a
  // Twilio outage or if we spot a runaway fan-out). Env var must be the
  // literal string "false"; any other value (unset, "true", "0", "") is
  // treated as enabled, on purpose — accidentally clearing the var
  // should NOT disable notifications.
  NOTIFY_ENABLED: process.env.NOTIFY_ENABLED !== 'false',
};
