/**
 * Admin email allow-list.
 *
 * This is the interim authorization source for admin UI surfaces (the
 * fund-release dashboard, handyman approval queue, dispute resolution,
 * etc.). The list is also enforced server-side by verifyAdminAccess in
 * functions/index.js — keep the two in sync until Batch B migrates to
 * Firebase Auth custom claims, after which both sides will read
 * decodedToken.admin instead.
 */
export const ADMIN_EMAILS = [
  'easydonehandyman@gmail.com',
];

/**
 * Returns true if the given Firebase auth user is on the admin list.
 * Accepts either the raw `user` object from useAuth() or `null`.
 */
export const isAdminUser = (user) => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(user.email);
};
