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
    // Stale sweep markers from the previous handyman must not survive into
    // the new assignment era.
    expect(update.sweepNudges).toBeDefined();
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

  test('voids a pending second-visit entry, leaves a scheduled entry untouched', () => {
    const job = {
      ...baseJob(),
      visits: [
        { status: 'scheduled', proposedDate: '2026-07-15', scheduledAt: '2026-07-09T01:00:00.000Z' },
        { status: 'pending_schedule', proposedDate: '2026-07-20', proposedTime: '10:00 AM' },
      ],
    };
    const update = buildCancelUpdate(job, 'hm_1', {
      reason: 'schedule_conflict', note: '', nowIso: NOW,
    });
    expect(update.visits).toHaveLength(2);
    expect(update.visits[0]).toEqual(job.visits[0]); // scheduled entry untouched
    expect(update.visits[1]).toEqual({
      ...job.visits[1], status: 'cancelled_assignment', cancelledAt: NOW,
    });
    // Stale open second-visit approval prompt must not survive into the new era.
    expect(update.visitDispositionSentFor).toBeDefined();
  });

  test('omits visits from the update when there are no pending entries', () => {
    const job = {
      ...baseJob(),
      visits: [{ status: 'declined', proposedDate: '2026-07-15' }],
    };
    const update = buildCancelUpdate(job, 'hm_1', {
      reason: 'schedule_conflict', note: '', nowIso: NOW,
    });
    expect(update).not.toHaveProperty('visits');
  });

  test('omits visits from the update when job has no visits at all', () => {
    const update = buildCancelUpdate(baseJob(), 'hm_1', {
      reason: 'schedule_conflict', note: '', nowIso: NOW,
    });
    expect(update).not.toHaveProperty('visits');
  });

  test('voids a pending price adjustment on cancel', () => {
    const jobWithAdj = { ...baseJob(), priceAdjustment: { status: 'pending_payment', deltaServiceFee: 30 } };
    const update = buildCancelUpdate(jobWithAdj, 'hm_1', { reason: 'personal_emergency', note: '', nowIso: NOW });
    expect(update.priceAdjustment.status).toBe('cancelled_assignment');
    expect(update.priceAdjustment.cancelledAt).toBe(NOW);
  });

  test('leaves a paid adjustment untouched on cancel', () => {
    const jobWithPaid = { ...baseJob(), priceAdjustment: { status: 'paid', deltaServiceFee: 30 } };
    const update = buildCancelUpdate(jobWithPaid, 'hm_1', { reason: 'personal_emergency', note: '', nowIso: NOW });
    expect(update.priceAdjustment).toBeUndefined(); // key absent — no write
  });
});
