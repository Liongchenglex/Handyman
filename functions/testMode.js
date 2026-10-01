/**
 * testMode.js — "safe prod testing" (LAUNCH-CHECKLIST Phase 8).
 *
 * Lets the owner test in production (real Stripe, real WhatsApp) without
 * real handymen ever hearing about or seeing test jobs:
 *
 *  - A job is a TEST job when its customer phone is listed in the env var
 *    TEST_CUSTOMER_PHONES (comma-separated, any format). The backend stamps
 *    `isTest: true` on the job when its payment is created — before payment
 *    and before any handyman is notified. Server-side only; clients can't
 *    write `isTest` (firestore.rules).
 *  - A handyman is a TEST ACCOUNT when their doc has `isTestAccount: true`
 *    (set by an admin in the console; handymen can't set it themselves).
 *  - Rule everywhere a handyman can reach a job (WhatsApp fan-out, job board,
 *    claiming via rules): test jobs ↔ test accounts only; real jobs ↔ real
 *    handymen only.
 *  - TEST_SERVICE_TYPE is a cheap service (see servicePricing.js) bookable
 *    ONLY by test customer phones, so prod tests don't cost S$90+ each.
 *
 * Pure functions — no Firestore — so they are unit-tested.
 */
const { normalizePhoneKey } = require('./promptService');

/** Cheap service for prod tests. Must match src/config/servicePricing.js. */
const TEST_SERVICE_TYPE = 'Platform Test';

/** @returns {Set<string>} normalised phone keys from a comma-separated list */
function parseTestPhones(envValue) {
  return new Set(
    String(envValue || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map(normalizePhoneKey)
      .filter(Boolean)
  );
}

/** Is this customer phone on the test list? (defaults to the live env var) */
function isTestCustomerPhone(phone, envValue = process.env.TEST_CUSTOMER_PHONES) {
  if (!phone) return false;
  return parseTestPhones(envValue).has(normalizePhoneKey(phone));
}

/** Test jobs only reach test accounts; real jobs only reach real handymen. */
function handymanMatchesJob(handyman, job) {
  return !!(handyman && handyman.isTestAccount === true) === !!(job && job.isTest === true);
}

/**
 * Booking guard: the cheap test service may only be paid for by a test
 * customer phone. Any other service type is unaffected.
 * @returns {{ allowed: true } | { allowed: false, reason: string }}
 */
function checkTestServiceAllowed(serviceType, job, envValue = process.env.TEST_CUSTOMER_PHONES) {
  if (serviceType !== TEST_SERVICE_TYPE) return { allowed: true };
  if (job && isTestCustomerPhone(job.customerPhone, envValue)) return { allowed: true };
  return { allowed: false, reason: `"${TEST_SERVICE_TYPE}" is for internal testing only` };
}

module.exports = {
  TEST_SERVICE_TYPE,
  parseTestPhones,
  isTestCustomerPhone,
  handymanMatchesJob,
  checkTestServiceAllowed,
};
