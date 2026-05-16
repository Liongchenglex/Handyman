# Production Launch Checklist

End-to-end checklist for taking the Handyman platform live on the
**company's own Firebase project** (separate from the personal dev
project `eazydone-d06cf`).

Work top to bottom. Sections 1–4 set up the new project; 5–9 wire up
the integrations; 10–12 verify and launch. The ⚠️ items are the ones
people most often miss.

---

## 1. Provision the company Firebase project

- [ ] Create a new Firebase project under the **company's** Google
      account / organisation. Note the **project ID** (e.g.
      `eazydone-prod`) — everything else derives from it.
- [ ] ⚠️ Upgrade the project to the **Blaze (pay-as-you-go) plan**.
      Cloud Functions and outbound network calls (Stripe, Twilio,
      EmailJS) do not work on the free Spark plan.
- [ ] Enable **Authentication** → sign-in methods: **Email/Password**
      and **Anonymous** (customers sign in anonymously).
- [ ] Create **Cloud Firestore** (production mode) — pick the region
      closest to your users (e.g. `asia-southeast1` for Singapore).
- [ ] Enable **Cloud Storage**.
- [ ] Enable **Hosting**.
- [ ] Register a **Web App** in Project Settings → General → copy the
      Firebase SDK config values (apiKey, authDomain, etc.).

## 2. Frontend configuration

The project ID is parameterized (`src/config/firebaseProject.js`), so
switching projects is a config change — no source edits.

Frontend env is managed with two gitignored files and two npm scripts:
- `.env.dev`  — the personal/dev project's values (already set up)
- `.env.prod` — the company/production project's values (the template
  to fill in below)

`npm run deploy:prod` copies `.env.prod` onto `.env.production.local`,
builds, points the CLI at the company project, and deploys. You never
edit `.env.production.local` by hand — it's generated each deploy.

- [ ] Fill in **`.env.prod`** — replace every `CHANGE_ME` with the
      company project's values:
  - [ ] `REACT_APP_FIREBASE_API_KEY`
  - [ ] `REACT_APP_FIREBASE_AUTH_DOMAIN`
  - [ ] `REACT_APP_FIREBASE_PROJECT_ID` ← drives all Cloud Function /
        hosting / console URLs
  - [ ] `REACT_APP_FIREBASE_STORAGE_BUCKET`
  - [ ] `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
  - [ ] `REACT_APP_FIREBASE_APP_ID`
  - [ ] `REACT_APP_FUNCTIONS_REGION` (only if not `us-central1`)
  - [ ] `REACT_APP_STRIPE_PUBLISHABLE_KEY` = **live** key (`pk_live_…`)
  - [ ] `REACT_APP_EMAILJS_*` (service / template / public key)
  - [ ] `REACT_APP_OPERATIONS_EMAIL`
  - [ ] `REACT_APP_APPROVAL_BASE_URL` = production URL
        (`https://<domain>/admin/approve-handyman`)
  - [ ] `REACT_APP_SENTRY_DSN` (see §11)
- [ ] ⚠️ `public/index.html` SEO tags (`og:url`, `twitter:url`,
      `canonical`, the two JSON-LD `url` fields) still hardcode
      `eazydone-d06cf.web.app`. Create React App cannot env-substitute
      these — update them by hand to the production domain.

## 3. Functions configuration (`functions/.env.<project-id>`)

Firebase Functions auto-loads `functions/.env.<projectId>` based on
which project you deploy to — no scripts needed. The dev secrets live
in `functions/.env.eazydone-d06cf`. Create
`functions/.env.<company-project-id>` with the company's production
secrets (gitignored). Never commit them.

- [ ] `STRIPE_SECRET_KEY` = **live** key (`sk_live_…`)
- [ ] `STRIPE_WEBHOOK_SECRET` = live webhook signing secret — set
      **after** creating the webhook in §5.
- [ ] ⚠️ `APPROVAL_SECRET` = a fresh 32+ char random string
      (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
      Handyman-approval JWT signing fails closed without it.
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- [ ] `TWILIO_TEMPLATE_JOB_CREATED`, `TWILIO_TEMPLATE_JOB_ACCEPTED`,
      `TWILIO_TEMPLATE_JOB_COMPLETION` (approved production templates)
- [ ] `WHATSAPP_*` / `GREENAPI_*` if those channels are used
- [ ] Keep a copy of all secrets in a password manager — they are not
      in git.
- [ ] (Optional) platform fee: defaults to 10%. To change,
      `firebase functions:config:set platform.fee_percentage="0.10"`.

## 4. Firebase CLI targeting

The dev alias (`dev` → `eazydone-d06cf`) already exists in
`.firebaserc`. You only need to register the company project.

- [ ] `firebase use --add` → select the company project. Name the
      alias **exactly `prod`** — the `deploy:prod` npm script runs
      `firebase use prod`, so the alias name must match.
- [ ] You never switch projects by hand: `npm run deploy:dev` and
      `npm run deploy:prod` each call `firebase use` for you.

## 5. Stripe — switch to LIVE mode

- [ ] Complete Stripe **business verification / account activation**.
- [ ] Generate **live** API keys → `pk_live_…` (frontend),
      `sk_live_…` (functions/.env).
- [ ] **Stripe Connect**: ensure Connect is enabled in live mode;
      handymen onboard real connected accounts.
- [ ] ⚠️ Create a **webhook endpoint** in the Stripe Dashboard (live
      mode) pointing at:
      `https://<region>-<projectId>.cloudfunctions.net/stripeWebhook`
  - Events: `payment_intent.succeeded`, `charge.refunded`,
    `charge.dispute.created`, `account.updated`, `transfer.created`.
  - Copy the **signing secret** → `STRIPE_WEBHOOK_SECRET` in
    `functions/.env.<company-project-id>`.
- [ ] After deploy, run one **small real transaction** end-to-end
      (authorize → capture/release → confirm payout).

## 6. Twilio WhatsApp — production

- [ ] Complete WhatsApp Business / Meta business verification.
- [ ] Provision a **production WhatsApp sender** number.
- [ ] Submit and get **approval** for all message templates
      (job created / accepted / completion poll).
- [ ] Point the Twilio inbound webhook at:
      `https://<region>-<projectId>.cloudfunctions.net/whatsappWebhook`

## 7. EmailJS

- [ ] Verify the EmailJS **service** is connected and templates exist
      (handyman acknowledgment, operations notification, approval,
      rejection).
- [ ] ⚠️ Each template's **"To Email"** field must be `{{to_email}}`,
      or mail silently goes nowhere.
- [ ] Free tier is 200 emails/month — consider a paid tier for
      production volume.

## 8. Bootstrap the first admin  ⚠️ ORDER MATTERS

The Firestore/Storage rules grant admin **only** via the Firebase Auth
custom claim — there is no email fallback in the rules.

- [ ] The admin must sign into the deployed app once so their Auth
      user exists.
- [ ] Firebase Console (company project) → Project Settings → Service
      Accounts → **Generate new private key** → save as
      `service-account-prod.json` in the repo root (gitignored).
- [ ] Run: `node scripts/grant-admin.js --email <admin-email> --key service-account-prod.json`
- [ ] **Do this before or together with deploying the rules**, or the
      admin is locked out of every admin page.
- [ ] Admin signs out and back in so the claim lands on their token.
- [ ] Delete `service-account-prod.json` from the repo afterwards
      (keep a copy in a vault).
- [ ] Update `ADMIN_EMAILS_FALLBACK` in `functions/index.js` if the
      production admin email differs — or rely solely on custom claims.

## 9. Deploy

One command does it all — copies `.env.prod` → builds → points the
CLI at the company project → deploys hosting, functions, rules,
indexes and storage:

- [ ] `npm run deploy:prod`
- [ ] Confirm Firestore **indexes** finished building (Console →
      Firestore → Indexes).
- [ ] Smoke-test the deployed URLs for each Cloud Function (no 404s).

Because the script points the CLI at the company project, the
functions deploy automatically picks up
`functions/.env.<company-project-id>` — make sure that file exists
(§3) before running this.

## 10. Backups & monitoring

- [ ] Set up the scheduled Firestore export on the **prod** project —
      see `docs/deployment/firestore-backups.md`.
- [ ] Enable Cloud Storage Object Versioning on the prod bucket.
- [ ] Create a Sentry project; set `REACT_APP_SENTRY_DSN` for prod.
- [ ] Decide on Cloud Functions error alerting (Cloud Logging alerts).

## 11. Custom domain (if applicable)

- [ ] Connect the custom domain in Firebase Hosting → verify DNS.
- [ ] Re-check the CSP in `firebase.json` if the domain or any
      third-party origin changes.
- [ ] Update `public/index.html` SEO tags to the final public domain
      (see §2).

## 12. Pre-launch verification

Run the full flow on the production deployment:

- [ ] Customer creates a job → pays (real card, small amount) →
      payment authorized.
- [ ] Handyman registers → operations email received → approval link
      works → handyman approved.
- [ ] Handyman expresses interest → redirected to job details.
- [ ] Job completion → customer WhatsApp poll → confirm → job moves to
      admin fund release.
- [ ] Admin releases escrow → handyman payout lands → job shows in the
      Completed tab.
- [ ] Refund path: refund a released job → transfer is reversed.
- [ ] Dispute path: customer reports an issue → job marked disputed.
- [ ] Firestore rules: a customer cannot read another customer's job;
      a handyman cannot write payment fields (rules emulator or manual).
- [ ] Mobile / responsive QA on a real device.
- [ ] Legal: Privacy Policy & Terms reviewed by a lawyer for Singapore
      PDPA compliance.

## 13. Known tech debt (not blockers, track post-launch)

- [ ] **B11** — upgrade `firebase-functions` 4→7, `firebase-admin`
      12→13, `stripe` 11→22 in `functions/`. Needs an emulator-tested
      session (functions.config() is removed in firebase-functions v7).
- [ ] `react-scripts` 5.0.1 is unmaintained (CRA archived) — plan a
      migration to Vite. The high-severity npm advisories are all
      build-time/dev-server, not in the shipped bundle.
- [ ] WhatsApp multi-job disambiguation uses positional numbers
      (`1 YES`); a stale positional reply after one job resolves can
      target the wrong remaining job. A job-ID-tagged button payload
      would close this fully.
- [ ] Route the `whatsappWebhook` phone lookup through a server-only
      mirror collection so the `customerPhone` Firestore indexes can
      be dropped (PII-enumeration hardening).

## 14. Rollback

- [ ] Firebase Hosting keeps previous releases — roll back from
      Console → Hosting → release history.
- [ ] Cloud Functions: redeploy the previous git tag/commit.
- [ ] Keep the dev project (`eazydone-d06cf`) intact as a staging
      environment.
