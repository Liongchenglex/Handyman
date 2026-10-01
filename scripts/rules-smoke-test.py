#!/usr/bin/env python3
"""
Firestore security-rules smoke test — runs real allow/deny scenarios against
the LOCAL Firestore emulator (never touches prod data).

Covers the rules most likely to matter if they regress:
  - test mode (LAUNCH-CHECKLIST Phase 8): test jobs claimable only by test
    accounts and vice versa; clients can't set isTest / isTestAccount
  - handyman self-registration can't pre-grant verified / active / onboarded

Usage (from the project root):
  1. /Users/liongchenglex/.npm-global/bin/firebase emulators:start --only firestore -P prod
     (wait for "All emulators ready"; Firestore listens on 127.0.0.1:8080)
  2. python3 scripts/rules-smoke-test.py          # in another terminal
  3. Ctrl+C the emulator. Exit code 0 = all scenarios passed.

Auth: the emulator accepts unsigned ("alg: none") ID tokens, and the literal
token "owner" bypasses rules — used here only to seed fixture docs.
"""
import base64
import json
import sys
import urllib.error
import urllib.request

PROJECT = 'handyman-sg-3b418'
PORT = sys.argv[1] if len(sys.argv) > 1 else '8080'
BASE = f'http://127.0.0.1:{PORT}/v1/projects/{PROJECT}/databases/(default)/documents'


def token(uid):
    """Unsigned Firebase ID token for user `uid` (emulator only)."""
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
    claims = {'sub': uid, 'user_id': uid, 'aud': PROJECT, 'iss': f'https://securetoken.google.com/{PROJECT}',
              'iat': 1, 'exp': 9999999999, 'auth_time': 1, 'firebase': {'sign_in_provider': 'password'}}
    return enc({'alg': 'none', 'typ': 'JWT'}) + '.' + enc(claims) + '.'


def value(v):
    if isinstance(v, bool):
        return {'booleanValue': v}
    if v is None:
        return {'nullValue': None}
    if isinstance(v, int):
        return {'integerValue': str(v)}
    if isinstance(v, list):
        return {'arrayValue': {'values': [value(x) for x in v]}}
    return {'stringValue': v}


def write(path, fields, who, mask=None):
    """PATCH a doc as `who` ('owner' = rules bypass). Returns ALLOW / DENY / ERRnnn."""
    url = f'{BASE}/{path}'
    if mask:
        url += '?' + '&'.join('updateMask.fieldPaths=' + m for m in mask)
    body = json.dumps({'fields': {k: value(v) for k, v in fields.items()}}).encode()
    auth = who if who == 'owner' else token(who)
    req = urllib.request.Request(url, data=body, method='PATCH',
                                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth})
    try:
        urllib.request.urlopen(req)
        return 'ALLOW'
    except urllib.error.HTTPError as err:
        return 'DENY' if err.code == 403 else f'ERR{err.code}'


def main():
    # Fixtures (rules bypassed)
    write('handymen/real1', {'verified': True, 'status': 'active', 'isTestAccount': False}, 'owner')
    write('handymen/test1', {'verified': True, 'status': 'active', 'isTestAccount': True}, 'owner')
    for job_id, is_test in [('realjob1', False), ('realjob2', False), ('testjob1', True), ('testjob2', True)]:
        write(f'jobs/{job_id}', {'status': 'pending', 'customerId': 'cust1', 'handymanId': None,
                                 'isTest': is_test, 'paymentStatus': 'succeeded'}, 'owner')

    claim = lambda uid: {'handymanId': uid, 'status': 'in_progress'}
    claim_mask = ['handymanId', 'status']
    form_signup = {'handymanId': 'new1', 'name': 'A', 'verified': False, 'status': 'pending', 'role': 'handyman',
                   'stripeConnectedAccountId': None, 'stripeAccountStatus': None,
                   'stripeOnboardingCompleted': False, 'rating': 0, 'totalJobs': 0,
                   'isAvailable': True, 'serviceTypes': ['Plumbing']}

    scenarios = [
        ('real handyman claims REAL job', 'ALLOW', write('jobs/realjob1', claim('real1'), 'real1', claim_mask)),
        ('real handyman claims TEST job', 'DENY', write('jobs/testjob1', claim('real1'), 'real1', claim_mask)),
        ('test account claims TEST job', 'ALLOW', write('jobs/testjob2', claim('test1'), 'test1', claim_mask)),
        ('test account claims REAL job', 'DENY', write('jobs/realjob2', claim('test1'), 'test1', claim_mask)),
        ('customer sets isTest on own job', 'DENY', write('jobs/realjob2', {'isTest': True}, 'cust1', ['isTest'])),
        ('customer creates job with isTest', 'DENY',
         write('jobs/newjob', {'customerId': 'cust1', 'status': 'awaiting_payment', 'isTest': True}, 'cust1')),
        ('customer creates normal job', 'ALLOW',
         write('jobs/newjob2', {'customerId': 'cust1', 'status': 'awaiting_payment'}, 'cust1')),
        ('handyman sets own isTestAccount', 'DENY',
         write('handymen/real1', {'isTestAccount': True}, 'real1', ['isTestAccount'])),
        ('sign-up as verified/active', 'DENY',
         write('handymen/evil1', {'verified': True, 'status': 'active', 'stripeOnboardingCompleted': True}, 'evil1')),
        ('sign-up with isTestAccount', 'DENY',
         write('handymen/evil2', {'verified': False, 'status': 'pending', 'isTestAccount': True}, 'evil2')),
        ('normal sign-up (form payload)', 'ALLOW', write('handymen/new1', form_signup, 'new1')),
    ]

    failures = 0
    for name, expected, got in scenarios:
        ok = expected == got
        failures += not ok
        print(('PASS ' if ok else 'FAIL ') + f'{name:34s} expected {expected:5s} got {got}')
    print(f'failures: {failures}')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
