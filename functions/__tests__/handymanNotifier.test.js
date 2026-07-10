const {
  notificationMarkerId,
  pickEligibleHandymen,
} = require('../handymanNotifier');

/**
 * Minimal chainable fake for db.collection('handymen').where(...).limit(n).get().
 * Returns the provided docs regardless of filters — we're testing the JS
 * post-filtering (opt-out + exclusions), not Firestore's query engine.
 */
function fakeDb(handymen) {
  const query = {
    where: () => query,
    limit: () => query,
    get: async () => ({
      docs: handymen.map((h) => ({ id: h.id, data: () => h })),
    }),
  };
  return { collection: () => query };
}

describe('notificationMarkerId', () => {
  test('round 0 keeps the bare handyman id (backward compatible)', () => {
    expect(notificationMarkerId('hm_1', 0)).toBe('hm_1');
    expect(notificationMarkerId('hm_1', undefined)).toBe('hm_1');
  });

  test('later rounds get a round suffix', () => {
    expect(notificationMarkerId('hm_1', 1)).toBe('hm_1_r1');
    expect(notificationMarkerId('hm_1', 3)).toBe('hm_1_r3');
  });
});

describe('pickEligibleHandymen exclusions', () => {
  const job = { serviceType: 'Plumbing' };
  const handymen = [
    { id: 'hm_1', phone: '+65...', notifyOnNewJob: true },
    { id: 'hm_2', phone: '+65...' },
    { id: 'hm_3', phone: '+65...', notifyOnNewJob: false },
  ];

  test('no exclusions: returns opted-in handymen', async () => {
    const picked = await pickEligibleHandymen(job, fakeDb(handymen), 20);
    expect(picked.map((h) => h.id)).toEqual(['hm_1', 'hm_2']);
  });

  test('excludeIds removes previous cancellers', async () => {
    const picked = await pickEligibleHandymen(job, fakeDb(handymen), 20, ['hm_1']);
    expect(picked.map((h) => h.id)).toEqual(['hm_2']);
  });
});
