const {
  ScheduleError,
  validateScheduleProposal,
  buildScheduleChangeUpdate,
} = require('../scheduleService');

// Fixed clock: 2026-07-12T04:00:00Z
const NOW_MS = Date.UTC(2026, 6, 12, 4, 0, 0);

const asapJob = () => ({
  status: 'in_progress',
  preferredTiming: 'Immediate',
  preferredDate: undefined,
  preferredTime: undefined,
  handymanId: 'hm_1',
});

const scheduledJob = () => ({
  status: 'in_progress',
  preferredTiming: 'Schedule',
  preferredDate: '2026-07-20',
  preferredTime: '10:00 AM',
  handymanId: 'hm_1',
});

describe('validateScheduleProposal', () => {
  test('accepts a near-future date with a time', () => {
    expect(() => validateScheduleProposal({ date: '2026-07-15', time: '2:00 PM', nowMs: NOW_MS }))
      .not.toThrow();
  });

  test('accepts today', () => {
    expect(() => validateScheduleProposal({ date: '2026-07-12', time: '6:00 PM', nowMs: NOW_MS }))
      .not.toThrow();
  });

  test('rejects unparseable dates', () => {
    expect(() => validateScheduleProposal({ date: 'next tuesday', time: '2 PM', nowMs: NOW_MS }))
      .toThrow(ScheduleError);
    try { validateScheduleProposal({ date: 'next tuesday', time: '2 PM', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('bad_date');
    }
  });

  test('rejects past dates', () => {
    try { validateScheduleProposal({ date: '2026-07-10', time: '2 PM', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('date_past');
    }
    expect.assertions(1);
  });

  test('rejects dates beyond 90 days', () => {
    try { validateScheduleProposal({ date: '2026-11-15', time: '2 PM', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('date_too_far');
    }
    expect.assertions(1);
  });

  test('rejects a missing or overlong time', () => {
    try { validateScheduleProposal({ date: '2026-07-15', time: '', nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('bad_time');
    }
    try { validateScheduleProposal({ date: '2026-07-15', time: 'x'.repeat(30), nowMs: NOW_MS }); } catch (e) {
      expect(e.code).toBe('bad_time');
    }
    expect.assertions(2);
  });
});

describe('buildScheduleChangeUpdate', () => {
  const NOW_ISO = '2026-07-12T04:00:00.000Z';

  test('reschedules a scheduled job: new date/time, history entry, poll cleared', () => {
    const update = buildScheduleChangeUpdate(scheduledJob(), {
      newDate: '2026-07-22', newTime: '3:00 PM',
      actor: 'cust_1', via: 'whatsapp_reply', note: '', promptId: 'p1', nowIso: NOW_ISO,
    });

    expect(update.preferredDate).toBe('2026-07-22');
    expect(update.preferredTime).toBe('3:00 PM');
    expect(update.preferredTiming).toBe('Schedule');
    // Not previously ASAP → no scheduledFromAsapAt
    expect(update).not.toHaveProperty('scheduledFromAsapAt');
    // Poll marker cleared with delete sentinels
    expect(update.completionPollSentAt).toBeDefined();
    expect(update.completionPollSentBy).toBeDefined();
    expect(update.scheduleHistory).toEqual([{
      changedAt: NOW_ISO,
      changedBy: 'cust_1',
      via: 'whatsapp_reply',
      fromDate: '2026-07-20',
      fromTime: '10:00 AM',
      toDate: '2026-07-22',
      toTime: '3:00 PM',
      note: null,
      promptId: 'p1',
    }]);
    expect(update).not.toHaveProperty('paymentStatus');
  });

  test('fixing an ASAP job stamps scheduledFromAsapAt and appends to existing history', () => {
    const job = { ...asapJob(), scheduleHistory: [{ changedAt: 'earlier' }] };
    const update = buildScheduleChangeUpdate(job, {
      newDate: '2026-07-14', newTime: '9:00 AM',
      actor: 'cust_1', via: 'whatsapp_reply', note: 'morning ok', promptId: 'p2', nowIso: NOW_ISO,
    });

    expect(update.scheduledFromAsapAt).toBe(NOW_ISO);
    expect(update.preferredTiming).toBe('Schedule');
    expect(update.scheduleHistory).toHaveLength(2);
    expect(update.scheduleHistory[1]).toMatchObject({
      fromDate: null, fromTime: null, toDate: '2026-07-14', note: 'morning ok',
    });
  });

  test('truncates the note to 300 chars', () => {
    const update = buildScheduleChangeUpdate(scheduledJob(), {
      newDate: '2026-07-22', newTime: '3:00 PM',
      actor: 'hm_1', via: 'admin', note: 'x'.repeat(400), promptId: null, nowIso: NOW_ISO,
    });
    expect(update.scheduleHistory[0].note).toHaveLength(300);
  });
});
