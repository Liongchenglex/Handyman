#!/usr/bin/env node
/**
 * grant-admin.js — one-shot bootstrap to seed the first platform admin.
 *
 * The setAdminClaim Cloud Function requires the caller to already be an
 * admin, so the very first admin has to be granted out-of-band. This
 * script uses a service-account key (downloaded from Firebase Console
 * → Project settings → Service accounts) to authenticate directly with
 * the Admin SDK and set the `admin: true` custom claim on a target user.
 *
 * Usage:
 *   node scripts/grant-admin.js --email user@example.com
 *   node scripts/grant-admin.js --uid abc123
 *   node scripts/grant-admin.js --email user@example.com --revoke
 *
 * The service-account key path defaults to ./service-account.json. Pass
 * --key /path/to/key.json or set GOOGLE_APPLICATION_CREDENTIALS to
 * override. Do NOT commit the key file; .gitignore already excludes it.
 *
 * After running this once, all subsequent admin promotions/demotions
 * happen via the setAdminClaim Cloud Function (admin-only).
 */

const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = { email: null, uid: null, revoke: false, key: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') args.email = argv[++i];
    else if (a === '--uid') args.uid = argv[++i];
    else if (a === '--key') args.key = argv[++i];
    else if (a === '--revoke') args.revoke = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/grant-admin.js (--email <e>|--uid <u>) [--revoke] [--key <path>]');
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.email && !args.uid) {
    console.error('ERROR: Specify --email <addr> or --uid <id>.');
    process.exit(2);
  }

  // Resolve service-account credentials. Either the explicit --key flag,
  // the GOOGLE_APPLICATION_CREDENTIALS env var, or the default file
  // path. We initialise the Admin SDK *with* the explicit credential
  // object so we don't accidentally pick up emulator credentials.
  const rawKeyPath = args.key
    || process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.resolve(__dirname, '..', 'service-account.json');

  // Resolve to an ABSOLUTE path against the current working directory.
  // Without this, a bare filename like "service-account-dev.json" would
  // be handed to require() as a module name and fail to resolve.
  const keyPath = path.resolve(process.cwd(), rawKeyPath);

  let serviceAccount;
  try {
    serviceAccount = require(keyPath);
  } catch (err) {
    console.error(`ERROR: Could not load service-account key at ${keyPath}.`);
    console.error('  Download one from Firebase Console → Project settings → Service accounts → Generate new private key.');
    console.error('  Then re-run with --key /path/to/key.json or set GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(3);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // Look up the target user.
  let user;
  try {
    user = args.uid
      ? await admin.auth().getUser(args.uid)
      : await admin.auth().getUserByEmail(args.email);
  } catch (err) {
    console.error(`ERROR: No Firebase Auth user matches ${args.email || args.uid}: ${err.message}`);
    process.exit(4);
  }

  // Merge with any existing custom claims so we don't clobber non-admin
  // claims the user might already have (kept symmetric with the
  // setAdminClaim Cloud Function so behaviour is identical regardless
  // of which path you grant through).
  const existing = user.customClaims || {};
  const next = { ...existing };
  if (args.revoke) delete next.admin;
  else next.admin = true;

  await admin.auth().setCustomUserClaims(user.uid, next);

  console.log(`✅ ${args.revoke ? 'Revoked' : 'Granted'} admin claim for ${user.email} (uid=${user.uid}).`);
  console.log('   The user must sign out and back in (or call getIdToken(true)) for the new claim to appear on their ID token.');
  process.exit(0);
}

main().catch((err) => {
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
});
