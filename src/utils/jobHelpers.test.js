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

  test('two scheduled jobs both missing dates compare as equal', () => {
    expect(compareByDateNeeded(scheduled(undefined), scheduled(undefined))).toBe(0);
  });

  test('sorting scheduled jobs that both lack dates does not throw and keeps them after dated jobs', () => {
    const jobs = [scheduled(undefined), scheduled('2026-07-15'), scheduled(undefined)];
    expect(() => jobs.sort(compareByDateNeeded)).not.toThrow();
    expect(jobs[0].preferredDate).toBe('2026-07-15');
    expect(jobs[1].preferredDate).toBeUndefined();
    expect(jobs[2].preferredDate).toBeUndefined();
  });

  test('a malformed preferredDate sinks to the end like a missing one', () => {
    const jobs = [scheduled('not-a-real-date'), scheduled('2026-07-12')];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].preferredDate).toBe('2026-07-12');
    expect(jobs[1].preferredDate).toBe('not-a-real-date');
  });

  test('ASAP jobs with Firestore Timestamp createdAt order newest first', () => {
    // In production createdAt is written with serverTimestamp() and
    // arrives as a Firestore Timestamp object, not an ISO string —
    // new Date(Timestamp) is Invalid Date, so the comparator must use
    // toMillis() for the tie-break to actually work on live data.
    const ts = (millis) => ({ toMillis: () => millis, seconds: Math.floor(millis / 1000) });
    const older = { preferredTiming: 'Immediate', createdAt: ts(1000) };
    const newer = { preferredTiming: 'Immediate', createdAt: ts(2000) };
    expect(compareByDateNeeded(older, newer)).toBeGreaterThan(0);
    expect(compareByDateNeeded(newer, older)).toBeLessThan(0);
    const jobs = [older, newer];
    jobs.sort(compareByDateNeeded);
    expect(jobs[0].createdAt.toMillis()).toBe(2000);
  });
});
