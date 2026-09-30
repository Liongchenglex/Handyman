import { toMillis, buildJobTimeline } from './jobTimeline';

describe('toMillis', () => {
  test('ISO string', () => {
    expect(toMillis('2026-10-01T00:00:00Z')).toBe(Date.parse('2026-10-01T00:00:00Z'));
  });
  test('Firestore Timestamp-like', () => {
    expect(toMillis({ toMillis: () => 123 })).toBe(123);
  });
  test('missing / junk → null', () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis('not a date')).toBeNull();
  });
});

describe('buildJobTimeline', () => {
  const job = {
    createdAt: '2026-10-01T01:00:00Z',
    acceptedAt: '2026-10-01T02:00:00Z',
    acceptedBy: { name: 'Ah Seng' },
    scheduleHistory: [{ changedAt: '2026-10-01T05:00:00Z', via: 'admin', toDate: '2026-10-02', toTime: '2:00 PM' }],
    assignmentHistory: [{ endedAt: '2026-10-01T03:00:00Z', handymanName: 'Bob', cancelReason: 'schedule_conflict' }],
    noShowReports: [{ reportedAt: '2026-10-01T06:00:00Z', via: 'poll' }],
    attentionNeeded: { type: 'schedule_deadlock', at: '2026-10-01T07:00:00Z' },
  };
  const prompts = [{
    type: 'schedule_approval', toRole: 'customer', question: 'Approve Tue 2pm?',
    createdAt: '2026-10-01T04:00:00Z', status: 'answered',
    answeredAt: '2026-10-01T04:30:00Z', answer: 'NO', resultingAction: 'declined',
  }];

  test('merges all sources, newest first', () => {
    const events = buildJobTimeline(job, prompts);
    const times = events.map((e) => e.ms);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(events[0].title).toMatch(/attention/i);
    expect(events[events.length - 1].title).toMatch(/created/i);
  });

  test('a prompt yields a "sent" and an "answered" event', () => {
    const events = buildJobTimeline({}, prompts);
    expect(events).toHaveLength(2);
    expect(events[0].title).toMatch(/replied/i);
    expect(events[0].detail).toMatch(/NO/);
    expect(events[1].title).toMatch(/asked customer/i);
  });

  test('events without a usable time are dropped, never crash', () => {
    expect(buildJobTimeline({ scheduleHistory: [{}], noShowReports: [null] }, [{}])).toEqual([]);
  });
});
