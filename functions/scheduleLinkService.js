/**
 * Secure schedule links (job lifecycle spec §3 F6).
 *
 * Customers have no accounts, so a one-time job-scoped URL is how they
 * pick a visit time. The URL's token is the credential; this module's
 * invariants assume URLs leak:
 *  - Firestore stores ONLY sha256(token) (as the doc id) — a DB read
 *    leak yields no usable links.
 *  - One active link per job: issuing revokes prior actives, and F4's
 *    applyScheduleChange call sites revoke on any settled change, so a
 *    stale link can never resurrect a settled schedule.
 *  - 72h expiry, single-use (consumption happens transactionally in
 *    the submitSchedulePick endpoint, not here).
 *
 * Same DI style as jobReassignment.js / scheduleService.js: pure
 * builders are unit-tested; db functions take the Firestore handle.
 */

const crypto = require('crypto');

/** Links expire this many hours after issuance. */
const LINK_TTL_HOURS = 72;

/** sha256 hex of a token string. Null-safe: hashing '' is fine (never matches). */
function hashLinkToken(token) {
  return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}

/**
 * 128-bit crypto-random token + its hash. The raw token goes into the
 * WhatsApp URL and is NEVER persisted; the hash is the Firestore doc id.
 */
function generateLinkToken() {
  const token = crypto.randomBytes(16).toString('base64url');
  return { token, tokenHash: hashLinkToken(token) };
}

/** Fields for a fresh scheduleLinks/{tokenHash} doc. */
function buildScheduleLinkDoc({ jobId, customerPhone, createdBy, nowMs }) {
  return {
    jobId,
    customerPhone: String(customerPhone),
    purpose: 'pick_time',
    status: 'active',
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + LINK_TTL_HOURS * 3600 * 1000).toISOString(),
    createdBy,
    usedAt: null,
  };
}

/**
 * Revoke every active link for a job. Called before issuing a new link
 * and whenever a schedule change settles (approved pick or proposal).
 * Equality-only query — no composite index needed.
 */
async function revokeActiveLinks({ db, jobId, nowMs = Date.now() }) {
  const snap = await db.collection('scheduleLinks')
    .where('jobId', '==', jobId)
    .where('status', '==', 'active')
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.update({
    status: 'revoked',
    revokedAt: new Date(nowMs).toISOString(),
  })));
  return snap.docs.length;
}

/**
 * Issue a fresh link for a job, revoking prior actives first so at most
 * one link is live per job. Returns the RAW token for the URL — the
 * caller must send it and forget it.
 */
async function issueScheduleLink({ db, jobId, customerPhone, createdBy, nowMs = Date.now() }) {
  const revoked = await revokeActiveLinks({ db, jobId, nowMs });
  const { token, tokenHash } = generateLinkToken();
  await db.collection('scheduleLinks').doc(tokenHash).set(
    buildScheduleLinkDoc({ jobId, customerPhone, createdBy, nowMs })
  );
  return { token, tokenHash, revoked };
}

module.exports = {
  LINK_TTL_HOURS,
  hashLinkToken,
  generateLinkToken,
  buildScheduleLinkDoc,
  revokeActiveLinks,
  issueScheduleLink,
};
