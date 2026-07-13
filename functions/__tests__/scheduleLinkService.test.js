const {
  generateLinkToken,
  hashLinkToken,
  buildScheduleLinkDoc,
  LINK_TTL_HOURS,
} = require('../scheduleLinkService');

// Fixed clock: 2026-07-13T04:00:00Z
const NOW_MS = Date.UTC(2026, 6, 13, 4, 0, 0);

describe('generateLinkToken', () => {
  test('produces a url-safe token and its sha256 hash', () => {
    const { token, tokenHash } = generateLinkToken();
    // 16 bytes base64url = 22 chars, no padding, no +/= characters
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLinkToken(token)).toBe(tokenHash);
  });

  test('two calls never collide', () => {
    const a = generateLinkToken();
    const b = generateLinkToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('hashLinkToken', () => {
  test('is deterministic and trims whitespace', () => {
    expect(hashLinkToken(' abc ')).toBe(hashLinkToken('abc'));
    expect(hashLinkToken('abc')).toMatch(/^[a-f0-9]{64}$/);
  });

  test('handles null/empty without throwing', () => {
    expect(hashLinkToken('')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLinkToken(null)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('buildScheduleLinkDoc', () => {
  test('builds an active pick_time doc with a 72h expiry', () => {
    const doc = buildScheduleLinkDoc({
      jobId: 'job_1',
      customerPhone: '+6591234567',
      createdBy: 'system_decline',
      nowMs: NOW_MS,
    });
    expect(doc).toEqual({
      jobId: 'job_1',
      customerPhone: '+6591234567',
      purpose: 'pick_time',
      status: 'active',
      createdAt: '2026-07-13T04:00:00.000Z',
      expiresAt: '2026-07-16T04:00:00.000Z', // exactly +72h
      createdBy: 'system_decline',
      usedAt: null,
    });
    expect(LINK_TTL_HOURS).toBe(72);
  });
});
