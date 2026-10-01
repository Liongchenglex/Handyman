/**
 * testMode — Phase 8 "safe prod testing" rules. See functions/testMode.js
 * and docs/LAUNCH-CHECKLIST.md Phase 8.
 */
const {
  TEST_SERVICE_TYPE,
  parseTestPhones,
  isTestCustomerPhone,
  handymanMatchesJob,
  checkTestServiceAllowed,
} = require('../testMode');

describe('parseTestPhones', () => {
  test('normalises a comma-separated list to phone keys', () => {
    const set = parseTestPhones('+65 9123 4567, 81505267 ,whatsapp:+6588887777');
    expect([...set].sort()).toEqual(['6581505267', '6588887777', '6591234567']);
  });
  test('empty / missing → empty set', () => {
    expect(parseTestPhones('').size).toBe(0);
    expect(parseTestPhones(undefined).size).toBe(0);
    expect(parseTestPhones(' , ').size).toBe(0);
  });
});

describe('isTestCustomerPhone', () => {
  const env = '+6591234567';
  test('matches regardless of formatting', () => {
    expect(isTestCustomerPhone('91234567', env)).toBe(true);
    expect(isTestCustomerPhone('+65 9123 4567', env)).toBe(true);
  });
  test('other numbers and missing phones are not test', () => {
    expect(isTestCustomerPhone('81234567', env)).toBe(false);
    expect(isTestCustomerPhone(null, env)).toBe(false);
    expect(isTestCustomerPhone('91234567', '')).toBe(false);
  });
});

describe('handymanMatchesJob', () => {
  test('test jobs only reach test accounts', () => {
    expect(handymanMatchesJob({ isTestAccount: true }, { isTest: true })).toBe(true);
    expect(handymanMatchesJob({}, { isTest: true })).toBe(false);
  });
  test('real jobs only reach real handymen', () => {
    expect(handymanMatchesJob({}, {})).toBe(true);
    expect(handymanMatchesJob({ isTestAccount: false }, { isTest: false })).toBe(true);
    expect(handymanMatchesJob({ isTestAccount: true }, {})).toBe(false);
  });
});

describe('checkTestServiceAllowed', () => {
  const env = '+6591234567';
  test('normal service types are always allowed', () => {
    expect(checkTestServiceAllowed('Plumbing', { customerPhone: '81234567' }, env)).toEqual({ allowed: true });
  });
  test('the test service is allowed only for listed customer phones', () => {
    expect(checkTestServiceAllowed(TEST_SERVICE_TYPE, { customerPhone: '91234567' }, env)).toEqual({ allowed: true });
    expect(checkTestServiceAllowed(TEST_SERVICE_TYPE, { customerPhone: '81234567' }, env).allowed).toBe(false);
    expect(checkTestServiceAllowed(TEST_SERVICE_TYPE, null, env).allowed).toBe(false);
    expect(checkTestServiceAllowed(TEST_SERVICE_TYPE, { customerPhone: '91234567' }, '').allowed).toBe(false);
  });
});
