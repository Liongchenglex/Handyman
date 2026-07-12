const {
  normalizePhoneKey,
  interpretReply,
  buildDisambiguationList,
  openPrompt,
} = require('../promptService');

const prompt = (over = {}) => ({
  id: 'p1',
  jobId: 'job_aaa111',
  type: 'completion_confirmation',
  toPhoneKey: '6591234567',
  question: 'Has the work been completed?',
  options: { YES: 'confirm', 'CONFIRM COMPLETE': 'confirm', NO: 'reject', 'REPORT ISSUE': 'reject' },
  status: 'open',
  ...over,
});

describe('normalizePhoneKey', () => {
  test('strips whatsapp prefix, plus, spaces; adds SG country code to 8-digit locals', () => {
    expect(normalizePhoneKey('whatsapp:+6591234567')).toBe('6591234567');
    expect(normalizePhoneKey('9123 4567')).toBe('6591234567');
    expect(normalizePhoneKey('+65 9123-4567')).toBe('6591234567');
  });
});

describe('interpretReply — single open prompt', () => {
  test('matches an option key as a whole word, case-insensitively', () => {
    const r = interpretReply([prompt()], 'yes');
    expect(r).toMatchObject({ kind: 'answer', action: 'confirm' });
    expect(r.prompt.id).toBe('p1');
  });

  test('matches a multi-word quick-reply button text', () => {
    expect(interpretReply([prompt()], 'Report Issue'))
      .toMatchObject({ kind: 'answer', action: 'reject' });
  });

  test('does not match option keys inside other words', () => {
    // 'KNOW' contains the letters NO but not the word NO
    expect(interpretReply([prompt()], 'know')).toEqual({ kind: 'unmatched' });
  });

  test('conflicting matches are unmatched, not guessed', () => {
    expect(interpretReply([prompt()], 'yes no')).toEqual({ kind: 'unmatched' });
  });

  test('free text is unmatched', () => {
    expect(interpretReply([prompt()], 'can you come at 3pm instead?'))
      .toEqual({ kind: 'unmatched' });
  });
});

describe('interpretReply — multiple open prompts', () => {
  const two = [
    prompt(),
    prompt({ id: 'p2', jobId: 'job_bbb222', type: 'reschedule_approval', options: { YES: 'approve', NO: 'decline' } }),
  ];

  test('a leading selector binds the answer to that prompt (1-based, list order)', () => {
    const r = interpretReply(two, '2 yes');
    expect(r).toMatchObject({ kind: 'answer', action: 'approve' });
    expect(r.prompt.id).toBe('p2');
  });

  test('an answer without a selector asks for disambiguation', () => {
    expect(interpretReply(two, 'yes')).toEqual({ kind: 'disambiguate' });
  });

  test('a selector out of range is unmatched', () => {
    expect(interpretReply(two, '5 yes')).toEqual({ kind: 'unmatched' });
  });

  test('no prompts at all → none', () => {
    expect(interpretReply([], 'yes')).toEqual({ kind: 'none' });
  });
});

describe('buildDisambiguationList', () => {
  test('numbers prompts and includes the reply format', () => {
    const text = buildDisambiguationList([
      prompt(),
      prompt({ id: 'p2', jobId: 'job_bbb222', question: 'Approve the new time?' }),
    ]);
    expect(text).toContain('1.');
    expect(text).toContain('2.');
    expect(text).toContain('#aaa111');
    expect(text).toContain('#bbb222');
    expect(text).toMatch(/reply with the number/i);
  });
});

describe('openPrompt', () => {
  // Minimal chainable fake for jobs/{id}/prompts: supports the supersede
  // query (where/where/get) and doc creation via doc().set().
  function fakeDb(existingOpenPrompts) {
    const writes = { set: [], updates: [] };
    const promptsCol = {
      where: () => promptsCol,
      get: async () => ({
        docs: existingOpenPrompts.map((p) => ({
          id: p.id,
          ref: { update: async (u) => writes.updates.push({ id: p.id, ...u }) },
        })),
      }),
      doc: () => ({
        id: 'new_prompt_id',
        set: async (data) => writes.set.push(data),
      }),
    };
    return {
      writes,
      collection: () => ({ doc: () => ({ collection: () => promptsCol }) }),
    };
  }

  test('creates the prompt doc and supersedes prior open prompts of the same type', async () => {
    const db = fakeDb([{ id: 'old1' }]);
    const result = await openPrompt({
      db,
      jobId: 'job_aaa111',
      type: 'completion_confirmation',
      toPhone: 'whatsapp:+6591234567',
      toRole: 'customer',
      question: 'Has the work been completed?',
      options: { YES: 'confirm', NO: 'reject' },
      nowMs: 1_700_000_000_000,
    });

    expect(result).toEqual({ promptId: 'new_prompt_id', superseded: 1 });
    expect(db.writes.updates[0]).toMatchObject({ id: 'old1', status: 'superseded' });
    const doc = db.writes.set[0];
    expect(doc).toMatchObject({
      jobId: 'job_aaa111',
      type: 'completion_confirmation',
      toPhoneKey: '6591234567',
      toRole: 'customer',
      status: 'open',
      options: { YES: 'confirm', NO: 'reject' },
    });
    // 48h default expiry from the injected clock
    expect(doc.expiresAt).toBe(new Date(1_700_000_000_000 + 48 * 3600 * 1000).toISOString());
  });
});
