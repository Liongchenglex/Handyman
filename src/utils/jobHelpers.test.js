import { compareByDateNeeded } from './jobHelpers';

const asap = (createdAt) => ({ preferredTiming: 'Immediate', createdAt });
const scheduled = (preferredDate) => ({ preferredTiming: 'Schedule', preferredDate, createdAt: '2026-07-01' });

describe('compareByDateNeeded', () => {
  test('ASAP jobs come before scheduled jobs', () => {
    const jobs = [scheduled('2026-07-12'), asap('2026-07-01')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredTiming).toBe('Immediate');
  });

  test('ASAP jobs order newest-posted first', () => {
    const jobs = [asap('2026-07-01T10:00:00Z'), asap('2026-07-02T10:00:00Z')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].createdAt).toBe('2026-07-02T10:00:00Z');
  });

  test('scheduled jobs order soonest date first', () => {
    const jobs = [scheduled('2026-07-20'), scheduled('2026-07-12')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredDate).toBe('2026-07-12');
  });

  test('scheduled job with missing date sinks to the end', () => {
    const jobs = [scheduled(undefined), scheduled('2026-07-30'), asap('2026-07-01')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredTiming).toBe('Immediate');
    expect(jobs[1].preferredDate).toBe('2026-07-30');
    expect(jobs[2].preferredDate).toBeUndefined();
  });
});
