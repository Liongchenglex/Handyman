const {
  CANCEL_REASONS,
  CancelError,
  validateCancelRequest,
  buildCancelUpdate,
} = require('../jobReassignment');

const baseJob = () => ({
  handymanId: 'hm_1',
  status: 'in_progress',
  customerId: 'cust_1',
  customerPhone: '+6591234567',
  serviceType: 'Plumbing',
  acceptedAt: '2026-07-01T02:00:00.000Z',
  acceptedBy: { uid: 'hm_1', name: 'Ah Seng', email: 'seng@x.com' },
});

describe('validateCancelRequest', () => {
  test('accepts a valid cancel', () => {
    expect(() =>
      validateCancelRequest(baseJob(), 'hm_1', 'schedule_conflict', ''),
    ).not.toThrow();
  });

  test('rejects missing job', () => {
    expect(() => validateCancelRequest(null, 'hm_1', 'other', 'x'))
      .toThrow(CancelError);
    try { validateCancelRequest(null, 'hm_1', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('not_found');
    }
  });

  test('rejects caller who is not the assigned handyman', () => {
    try { validateCancelRequest(baseJob(), 'hm_2', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('not_assigned');
    }
    expect.assertions(1);
  });

  test('rejects when status is not in_progress', () => {
    const job = { ...baseJob(), status: 'pending_confirmation' };
    try { validateCancelRequest(job, 'hm_1', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('wrong_status');
    }
    expect.assertions(1);
  });

  test('rejects after completion poll was sent', () => {
    const job = { ...baseJob(), completionPollSentAt: '2026-07-09T01:00:00.000Z' };
    try { validateCancelRequest(job, 'hm_1', 'other', 'x'); } catch (e) {
      expect(e.code).toBe('completion_poll_sent');
    }
    expect.assertions(1);
  });

  test('rejects unknown reason', () => {
    try { validateCancelRequest(baseJob(), 'hm_1', 'because', ''); } catch (e) {
      expect(e.code).toBe('bad_reason');
    }
    expect.assertions(1);
  });

  test("rejects reason 'other' without a note", () => {
    try { validateCancelRequest(baseJob(), 'hm_1', 'other', '  '); } catch (e) {
      expect(e.code).toBe('note_required');
    }
    expect.assertions(1);
  });
});

describe('buildCancelUpdate', () => {
  const NOW = '2026-07-10T05:00:00.000Z';

  test('appends a closed history entry and resets the job', () => {
    const update = buildCancelUpdate(baseJob(), 'hm_1', {
      reason: 'location_too_far', note: '', nowIso: NOW,
    });

    expect(update.status).toBe('pending');
    expect(update.handymanId).toBeNull();
    expect(update.reassignmentCount).toBe(1);
    expect(update.previousHandymanIds).toEqual(['hm_1']);
    expect(update.cancelledLastBy).toBe('hm_1');
    expect(update.lastCancelledAt).toBe(NOW);
    expect(update.assignmentHistory).toEqual([{
      handymanId: 'hm_1',
      handymanName: 'Ah Seng',
      assignedAt: '2026-07-01T02:00:00.000Z',
      endedAt: NOW,
      endReason: 'cancelled',
      cancelReason: 'location_too_far',
      cancelNote: null,
    }]);
    // Accept-flow fields are cleared with Firestore delete sentinels.
    expect(update.acceptedAt).toBeDefined();
    expect(update.acceptedBy).toBeDefined();
    expect(update.completionPollSentAt).toBeDefined();
    expect(update.completionPollSentBy).toBeDefined();
    // paymentStatus must never appear in the update.
    expect(update).not.toHaveProperty('paymentStatus');
  });

  test('second cancel round appends, dedupes previousHandymanIds, bumps count', () => {
    const job = {
      ...baseJob(),
      handymanId: 'hm_2',
      acceptedBy: { uid: 'hm_2', name: 'Bala' },
      acceptedAt: '2026-07-05T02:00:00.000Z',
      reassignmentCount: 1,
      previousHandymanIds: ['hm_1'],
      assignmentHistory: [{
        handymanId: 'hm_1', handymanName: 'Ah Seng',
        assignedAt: '2026-07-01T02:00:00.000Z', endedAt: '2026-07-04T02:00:00.000Z',
        endReason: 'cancelled', cancelReason: 'schedule_conflict', cancelNote: null,
      }],
    };
    const update = buildCancelUpdate(job, 'hm_2', {
      reason: 'other', note: 'Customer address is a construction site', nowIso: NOW,
    });

    expect(update.reassignmentCount).toBe(2);
    expect(update.previousHandymanIds).toEqual(['hm_1', 'hm_2']);
    expect(update.assignmentHistory).toHaveLength(2);
    expect(update.assignmentHistory[1].cancelNote)
      .toBe('Customer address is a construction site');
  });

  test('truncates the note to 500 chars', () => {
    const update = buildCancelUpdate(baseJob(), 'hm_1', {
      reason: 'other', note: 'x'.repeat(600), nowIso: NOW,
    });
    expect(update.assignmentHistory[0].cancelNote).toHaveLength(500);
  });
});
