import { getAttentionLabel, deriveScheduleStatus } from './adminJobStatus';

const NOW = Date.parse('2026-10-01T10:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();
const scheduledJob = (extra = {}) => ({
  preferredTiming: 'Schedule', preferredDate: '2026-10-03', preferredTime: '2:00 PM', ...extra,
});

describe('getAttentionLabel', () => {
  test('known type → readable label + next-step hint', () => {
    const { label, hint } = getAttentionLabel('schedule_deadlock');
    expect(label).toBe('Schedule deadlock');
    expect(hint).toMatch(/Set time/);
  });

  test('unknown type → readable fallback, no hint', () => {
    expect(getAttentionLabel('some_new_code')).toEqual({ label: 'Some new code', hint: null });
  });
});

describe('deriveScheduleStatus', () => {
  test('no schedule activity → null', () => {
    expect(deriveScheduleStatus(scheduledJob(), [], NOW)).toBeNull();
  });

  test('deadlock flag wins over everything', () => {
    const s = deriveScheduleStatus(scheduledJob({ attentionNeeded: { type: 'schedule_deadlock' } }), [], NOW);
    expect(s.tone).toBe('alert');
    expect(s.text).toMatch(/Deadlock/);
  });

  test('open schedule_approval → waiting for customer, names the proposed time', () => {
    const prompts = [{ type: 'schedule_approval', status: 'open', createdAt: hoursAgo(2),
      payload: { proposedDate: '2026-10-05', proposedTime: '3:00 PM' } }];
    const s = deriveScheduleStatus(scheduledJob(), prompts, NOW);
    expect(s.tone).toBe('waiting');
    expect(s.text).toMatch(/waiting for customer/i);
    expect(s.text).toMatch(/3:00 PM/);
  });

  test('open schedule_pick_approval → waiting for handyman, names the picked time', () => {
    const prompts = [{ type: 'schedule_pick_approval', status: 'open', createdAt: hoursAgo(1),
      payload: { pickedDate: '2026-10-06', pickedTime: '10:00 AM' } }];
    const s = deriveScheduleStatus(scheduledJob(), prompts, NOW);
    expect(s.text).toMatch(/waiting for handyman/i);
    expect(s.text).toMatch(/10:00 AM/);
  });

  test('declined proposal (link sent) → waiting for customer to pick', () => {
    const prompts = [{ type: 'schedule_approval', status: 'answered', resultingAction: 'declined',
      createdAt: hoursAgo(5), answeredAt: hoursAgo(4) }];
    const s = deriveScheduleStatus(scheduledJob(), prompts, NOW);
    expect(s.text).toMatch(/pick/i);
    expect(s.tone).toBe('waiting');
  });

  test('link_sent older than 72h → link expired', () => {
    const prompts = [{ type: 'no_show_choice', status: 'answered', resultingAction: 'link_sent',
      createdAt: hoursAgo(80), answeredAt: hoursAgo(80) }];
    const s = deriveScheduleStatus(scheduledJob(), prompts, NOW);
    expect(s.text).toMatch(/expired/i);
  });

  test('a later schedule change settles an earlier declined proposal', () => {
    const prompts = [{ type: 'schedule_approval', status: 'answered', resultingAction: 'declined',
      createdAt: hoursAgo(5), answeredAt: hoursAgo(4) }];
    const job = scheduledJob({ scheduleHistory: [{ changedAt: hoursAgo(1) }] });
    expect(deriveScheduleStatus(job, prompts, NOW)).toBeNull();
  });

  test('ASAP job with no agreed time and nothing pending', () => {
    const s = deriveScheduleStatus({ preferredTiming: 'Immediate' }, [], NOW);
    expect(s.text).toMatch(/no visit time/i);
  });

  test('open second_visit_approval → waiting for customer on second visit', () => {
    const prompts = [{ type: 'second_visit_approval', status: 'open', createdAt: hoursAgo(2),
      payload: { proposedDate: '2026-10-07', proposedTime: '9:00 AM' } }];
    const s = deriveScheduleStatus(scheduledJob(), prompts, NOW);
    expect(s.text).toMatch(/second visit/i);
  });
});
