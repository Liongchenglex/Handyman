const {
  SWEEP,
  toMs,
  evaluatePrompt,
  evaluateLink,
  evaluateAsapJob,
  evaluateUnclaimedJob,
  buildAttentionUpdate,
} = require('../sweepService');

// Fixed clock: 2026-07-14T02:30:00Z (= 10:30 SGT)
const NOW_MS = Date.UTC(2026, 6, 14, 2, 30, 0);
const hoursAgo = (h) => new Date(NOW_MS - h * 3600 * 1000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

describe('toMs', () => {
  test('parses ISO strings, Date, ms, and Timestamp-like objects', () => {
    expect(toMs('2026-07-14T02:30:00.000Z')).toBe(NOW_MS);
    expect(toMs(new Date(NOW_MS))).toBe(NOW_MS);
    expect(toMs(NOW_MS)).toBe(NOW_MS);
    expect(toMs({ toMillis: () => NOW_MS })).toBe(NOW_MS);
    expect(toMs(null)).toBeNull();
    expect(toMs('garbage')).toBeNull();
  });
});

describe('evaluatePrompt', () => {
  test('unexpired prompt is ok', () => {
    expect(evaluatePrompt({ status: 'open', expiresAt: hoursAgo(-2) }, NOW_MS)).toBe('ok');
  });
  test('expired, never nudged → nudge', () => {
    expect(evaluatePrompt({ status: 'open', expiresAt: hoursAgo(1) }, NOW_MS)).toBe('nudge');
  });
  test('expired after a nudge → escalate', () => {
    expect(evaluatePrompt({ status: 'open', expiresAt: hoursAgo(1), nudgedAt: hoursAgo(25) }, NOW_MS)).toBe('escalate');
  });
});

describe('evaluateLink', () => {
  test('unexpired active link is ok', () => {
    expect(evaluateLink({ status: 'active', expiresAt: hoursAgo(-1) }, NOW_MS)).toBe('ok');
  });
  test('expired original link → renew (one fresh link)', () => {
    expect(evaluateLink({ status: 'active', expiresAt: hoursAgo(1), createdBy: 'system_decline' }, NOW_MS)).toBe('renew');
  });
  test('expired system_nudge link → escalate (no third link)', () => {
    expect(evaluateLink({ status: 'active', expiresAt: hoursAgo(1), createdBy: 'system_nudge' }, NOW_MS)).toBe('escalate');
  });
});

describe('evaluateAsapJob', () => {
  const asap = (over = {}) => ({
    status: 'in_progress',
    preferredTiming: 'Immediate',
    acceptedAt: hoursAgo(30),
    ...over,
  });
  test('scheduled or already-fixed jobs are ok', () => {
    expect(evaluateAsapJob(asap({ preferredTiming: 'Schedule' }), {}, NOW_MS)).toBe('ok');
    expect(evaluateAsapJob(asap({ scheduledFromAsapAt: hoursAgo(1) }), {}, NOW_MS)).toBe('ok');
  });
  test('something in flight (open prompt or active link) is ok', () => {
    expect(evaluateAsapJob(asap(), { hasOpenSchedulePrompt: true }, NOW_MS)).toBe('ok');
    expect(evaluateAsapJob(asap(), { hasActiveLink: true }, NOW_MS)).toBe('ok');
  });
  test('under 24h is ok; over 24h with no nudge → nudge', () => {
    expect(evaluateAsapJob(asap({ acceptedAt: hoursAgo(10) }), {}, NOW_MS)).toBe('ok');
    expect(evaluateAsapJob(asap({ acceptedAt: hoursAgo(30) }), {}, NOW_MS)).toBe('nudge');
  });
  test('over 48h after a nudge → escalate; nudged but under 48h → ok', () => {
    expect(evaluateAsapJob(
      asap({ acceptedAt: hoursAgo(50), sweepNudges: { asap_no_time: hoursAgo(20) } }), {}, NOW_MS
    )).toBe('escalate');
    expect(evaluateAsapJob(
      asap({ acceptedAt: hoursAgo(30), sweepNudges: { asap_no_time: hoursAgo(2) } }), {}, NOW_MS
    )).toBe('ok');
  });
  test('missing acceptedAt is defensively ok', () => {
    expect(evaluateAsapJob(asap({ acceptedAt: undefined }), {}, NOW_MS)).toBe('ok');
  });
});

describe('evaluateUnclaimedJob', () => {
  const pending = (over = {}) => ({
    status: 'pending',
    paymentStatus: 'succeeded',
    handymanId: null,
    createdAt: daysAgo(4),
    ...over,
  });
  test('unpaid or assigned jobs are ok', () => {
    expect(evaluateUnclaimedJob(pending({ paymentStatus: 'pending' }), NOW_MS).verdict).toBe('ok');
    expect(evaluateUnclaimedJob(pending({ handymanId: 'hm1' }), NOW_MS).verdict).toBe('ok');
  });
  test('fresh unclaimed: 4d → fanout once, then ok until 7d, then escalate', () => {
    expect(evaluateUnclaimedJob(pending(), NOW_MS)).toEqual({ verdict: 'fanout', kind: 'unclaimed' });
    expect(evaluateUnclaimedJob(
      pending({ sweepNudges: { unclaimed_refanout: daysAgo(1) } }), NOW_MS
    ).verdict).toBe('ok');
    expect(evaluateUnclaimedJob(pending({ createdAt: daysAgo(8) }), NOW_MS))
      .toEqual({ verdict: 'escalate', kind: 'unclaimed' });
  });
  test('re-released job uses lastCancelledAt and 2d/4d thresholds', () => {
    const j = pending({ reassignmentCount: 1, createdAt: daysAgo(20), lastCancelledAt: daysAgo(3) });
    expect(evaluateUnclaimedJob(j, NOW_MS)).toEqual({ verdict: 'fanout', kind: 'reclaim_stalled' });
    expect(evaluateUnclaimedJob({ ...j, lastCancelledAt: daysAgo(5) }, NOW_MS))
      .toEqual({ verdict: 'escalate', kind: 'reclaim_stalled' });
  });
  test('under threshold is ok', () => {
    expect(evaluateUnclaimedJob(pending({ createdAt: daysAgo(1) }), NOW_MS).verdict).toBe('ok');
  });
});

describe('buildAttentionUpdate', () => {
  test('builds the exact escalation fields', () => {
    const nowIso = new Date(NOW_MS).toISOString();
    expect(buildAttentionUpdate('asap_no_time', { detail: 'no confirmed time', nowIso }))
      .toEqual({
        needsAttention: true,
        attentionNeeded: { type: 'asap_no_time', at: nowIso, detail: 'no confirmed time', promptId: null },
      });
  });
});
