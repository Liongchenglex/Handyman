/**
 * visitService — Scenario 11 (second visit) + Scenario 8 (visit issue)
 * pure domain logic. See docs/superpowers/specs/2026-07-12-job-lifecycle-scenarios-design.md
 */
const {
  VisitError,
  SECOND_VISIT_REASONS,
  VISIT_ISSUE_KINDS,
  validateSecondVisitRequest,
  upsertPendingVisit,
  buildVisitScheduledUpdate,
  buildVisitDeclinedUpdate,
  hasPendingSecondVisit,
  findUnproposedVisitIndex,
  shouldSendDisposition,
  validateVisitIssueReport,
  buildVisitIssueEntry,
  buildVisitProposalReset,
} = require('../visitService');

const NOW_ISO = '2026-07-29T11:00:00.000Z';
const TODAY_SGT = '2026-07-29';

const job = (over = {}) => ({
  status: 'in_progress',
  handymanId: 'hm-1',
  preferredTiming: 'Schedule',
  preferredDate: TODAY_SGT,
  preferredTime: '2:00 PM',
  customerPhone: '+6591234567',
  ...over,
});

describe('validateSecondVisitRequest', () => {
  test('accepts a valid request', () => {
    expect(() => validateSecondVisitRequest(job(), 'hm-1', 'parts_materials', '')).not.toThrow();
  });
  test('rejects missing job', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(null, 'hm-1', 'parts_materials', ''); }
    catch (e) { expect(e.code).toBe('not_found'); }
  });
  test('rejects a non-assigned caller', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job(), 'hm-2', 'parts_materials', ''); }
    catch (e) { expect(e.code).toBe('not_assigned'); }
  });
  test('rejects wrong status', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job({ status: 'pending_admin_approval' }), 'hm-1', 'parts_materials', ''); }
    catch (e) { expect(e.code).toBe('wrong_status'); }
  });
  test('rejects unknown reason', () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job(), 'hm-1', 'because', ''); }
    catch (e) { expect(e.code).toBe('bad_reason'); }
  });
  test("requires a note for reason 'other'", () => {
    expect.assertions(1);
    try { validateSecondVisitRequest(job(), 'hm-1', 'other', '  '); }
    catch (e) { expect(e.code).toBe('note_required'); }
  });
});

describe('upsertPendingVisit', () => {
  test('appends a new entry when none pending', () => {
    const { visits, visitIndex } = upsertPendingVisit(job(), {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'parts_materials', note: '', reportedVia: 'app', promptId: null, nowIso: NOW_ISO,
    });
    expect(visitIndex).toBe(0);
    expect(visits[0]).toMatchObject({
      status: 'pending_schedule', proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'parts_materials', reportedVia: 'app', createdAt: NOW_ISO,
    });
  });
  test('fills an existing unproposed entry instead of appending', () => {
    const j = job({ visits: [{ status: 'pending_schedule', proposedDate: null, reason: null, reportedVia: 'customer_poll', createdAt: '2026-07-28T02:00:00.000Z' }] });
    const { visits, visitIndex } = upsertPendingVisit(j, {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'customer_request', note: 'per customer', reportedVia: 'app', promptId: 'p1', nowIso: NOW_ISO,
    });
    expect(visitIndex).toBe(0);
    expect(visits).toHaveLength(1);
    expect(visits[0].proposedDate).toBe('2026-08-02');
    expect(visits[0].reportedVia).toBe('customer_poll'); // origin preserved
    expect(visits[0].promptId).toBe('p1');
  });
  test('preserves original promptId when refilling an existing entry without promptId in args', () => {
    const j = job({ visits: [{ status: 'pending_schedule', proposedDate: null, promptId: 'poll-prompt-1', reportedVia: 'customer_poll', createdAt: '2026-07-28T02:00:00.000Z' }] });
    const { visits, visitIndex } = upsertPendingVisit(j, {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'customer_request', note: '', reportedVia: 'app', promptId: null, nowIso: NOW_ISO,
    });
    expect(visitIndex).toBe(0);
    expect(visits).toHaveLength(1);
    expect(visits[0].promptId).toBe('poll-prompt-1'); // original preserved
  });
  test('re-proposing an already-dated pending entry fills it rather than appending (retry idempotency)', () => {
    const j = job({
      visits: [{
        status: 'pending_schedule', proposedDate: '2026-08-01', proposedTime: '9:00 AM',
        reason: 'parts_materials', reportedVia: 'app', createdAt: '2026-07-28T02:00:00.000Z',
      }],
    });
    const { visits, visitIndex } = upsertPendingVisit(j, {
      proposedDate: '2026-08-03', proposedTime: '3:00 PM',
      reason: 'parts_materials', note: '', reportedVia: 'app', promptId: null, nowIso: NOW_ISO,
    });
    expect(visitIndex).toBe(0);
    expect(visits).toHaveLength(1);
    expect(visits[0].proposedDate).toBe('2026-08-03');
    expect(visits[0].proposedTime).toBe('3:00 PM');
  });
  test('truncates the note to 300 chars and nulls empty notes', () => {
    const { visits } = upsertPendingVisit(job(), {
      proposedDate: '2026-08-02', proposedTime: '10:00 AM',
      reason: 'other', note: 'x'.repeat(400), reportedVia: 'app', promptId: null, nowIso: NOW_ISO,
    });
    expect(visits[0].note).toHaveLength(300);
  });
});

describe('buildVisitScheduledUpdate / buildVisitDeclinedUpdate', () => {
  const pending = () => job({ visits: [{ status: 'pending_schedule', proposedDate: '2026-08-02', createdAt: NOW_ISO }] });
  test('marks the entry scheduled', () => {
    const { visits } = buildVisitScheduledUpdate(pending(), { visitIndex: 0, nowIso: NOW_ISO });
    expect(visits[0].status).toBe('scheduled');
    expect(visits[0].scheduledAt).toBe(NOW_ISO);
  });
  test('marks the entry declined', () => {
    const { visits } = buildVisitDeclinedUpdate(pending(), { visitIndex: 0, nowIso: NOW_ISO });
    expect(visits[0].status).toBe('declined');
    expect(visits[0].declinedAt).toBe(NOW_ISO);
  });
  test('throws bad_visit when index is stale or entry not pending', () => {
    expect.assertions(2);
    try { buildVisitScheduledUpdate(pending(), { visitIndex: 3, nowIso: NOW_ISO }); }
    catch (e) { expect(e.code).toBe('bad_visit'); }
    const done = job({ visits: [{ status: 'done', createdAt: NOW_ISO }] });
    try { buildVisitScheduledUpdate(done, { visitIndex: 0, nowIso: NOW_ISO }); }
    catch (e) { expect(e.code).toBe('bad_visit'); }
  });
});

describe('hasPendingSecondVisit / findUnproposedVisitIndex', () => {
  test('detects pending entries', () => {
    expect(hasPendingSecondVisit(job())).toBe(false);
    expect(hasPendingSecondVisit(job({ visits: [{ status: 'scheduled' }] }))).toBe(false);
    expect(hasPendingSecondVisit(job({ visits: [{ status: 'pending_schedule' }] }))).toBe(true);
  });
  test('finds only unproposed pending entries', () => {
    expect(findUnproposedVisitIndex(job())).toBe(-1);
    expect(findUnproposedVisitIndex(job({ visits: [{ status: 'pending_schedule', proposedDate: '2026-08-02' }] }))).toBe(-1);
    expect(findUnproposedVisitIndex(job({ visits: [{ status: 'declined' }, { status: 'pending_schedule', proposedDate: null }] }))).toBe(1);
  });
});

describe('shouldSendDisposition', () => {
  test('true for a silent visit-day job', () => {
    expect(shouldSendDisposition(job(), TODAY_SGT)).toBe(true);
  });
  test.each([
    ['wrong day', job({ preferredDate: '2026-07-28' })],
    ['no date', job({ preferredDate: null })],
    ['ASAP timing', job({ preferredTiming: 'Immediate' })],
    ['not in_progress', job({ status: 'pending_confirmation' })],
    ['no handyman', job({ handymanId: null })],
    ['poll already sent', job({ completionPollSentAt: NOW_ISO })],
    ['second visit already pending', job({ visits: [{ status: 'pending_schedule' }] })],
    ['already sent for this date', job({ visitDispositionSentFor: TODAY_SGT })],
  ])('false when %s', (_label, j) => {
    expect(shouldSendDisposition(j, TODAY_SGT)).toBe(false);
  });
});

describe('validateVisitIssueReport', () => {
  test('no_access allowed on the visit day', () => {
    expect(() => validateVisitIssueReport(job(), 'hm-1', 'no_access', TODAY_SGT)).not.toThrow();
  });
  test('no_access rejected before the visit day', () => {
    expect.assertions(1);
    try { validateVisitIssueReport(job({ preferredDate: '2026-07-30' }), 'hm-1', 'no_access', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('not_visit_day'); }
  });
  test('cannot_finish allowed on or after the visit day', () => {
    expect(() => validateVisitIssueReport(job({ preferredDate: '2026-07-28' }), 'hm-1', 'cannot_finish', TODAY_SGT)).not.toThrow();
  });
  test('rejects unknown kind', () => {
    expect.assertions(1);
    try { validateVisitIssueReport(job(), 'hm-1', 'meteor', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('bad_kind'); }
  });
  test('rejects non-assigned caller and wrong status', () => {
    expect.assertions(2);
    try { validateVisitIssueReport(job(), 'hm-2', 'no_access', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('not_assigned'); }
    try { validateVisitIssueReport(job({ status: 'completed' }), 'hm-1', 'no_access', TODAY_SGT); }
    catch (e) { expect(e.code).toBe('wrong_status'); }
  });
});

describe('buildVisitIssueEntry', () => {
  test('builds a trimmed entry', () => {
    expect(buildVisitIssueEntry({ kind: 'no_access', note: '  locked gate  ', reportedBy: 'hm-1', nowIso: NOW_ISO }))
      .toEqual({ kind: 'no_access', note: 'locked gate', reportedBy: 'hm-1', reportedAt: NOW_ISO });
  });
  test('nulls an empty note', () => {
    expect(buildVisitIssueEntry({ kind: 'cannot_finish', note: '', reportedBy: 'hm-1', nowIso: NOW_ISO }).note).toBeNull();
  });
});

describe('buildVisitProposalReset', () => {
  test('resets a dated pending entry, stripping the proposal', () => {
    const j = job({
      visits: [{ status: 'pending_schedule', proposedDate: '2026-08-02', proposedTime: '10:00 AM', reason: 'parts_materials', createdAt: NOW_ISO }],
    });
    const result = buildVisitProposalReset(j, { visitIndex: 0, nowIso: NOW_ISO });
    expect(result).not.toBeNull();
    expect(result.visits[0]).toMatchObject({
      status: 'pending_schedule', proposedDate: null, proposedTime: null,
      proposalExpiredAt: NOW_ISO, reason: 'parts_materials',
    });
  });
  test('returns null for a missing index', () => {
    const j = job({ visits: [{ status: 'pending_schedule', proposedDate: '2026-08-02' }] });
    expect(buildVisitProposalReset(j, { visitIndex: 3, nowIso: NOW_ISO })).toBeNull();
  });
  test('returns null for a non-pending entry', () => {
    const j = job({ visits: [{ status: 'scheduled', proposedDate: '2026-08-02' }] });
    expect(buildVisitProposalReset(j, { visitIndex: 0, nowIso: NOW_ISO })).toBeNull();
  });
  test('returns null for an already-dateless entry (idempotent)', () => {
    const j = job({ visits: [{ status: 'pending_schedule', proposedDate: null }] });
    expect(buildVisitProposalReset(j, { visitIndex: 0, nowIso: NOW_ISO })).toBeNull();
  });
});
