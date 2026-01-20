# Production Deployment Checklist

This checklist ensures proper environment configuration when deploying to production.

## Pre-Deployment Checklist

### 1. Branch Setup
- [ ] Switch to main branch: `git checkout main`
- [ ] Pull latest changes: `git pull origin main`
- [ ] Merge dev branch if needed: `git merge dev`

### 2. Environment Variables (.env.local)

**CRITICAL:** Update `.env.local` file in main branch with production settings:

#### Firebase Database
```env
# ✅ PRODUCTION: Use (default) database
REACT_APP_FIRESTORE_DATABASE=(default)
```

#### Approval URLs
```env
# ✅ PRODUCTION: Use production URL for approval links
REACT_APP_APPROVAL_BASE_URL=https://eazydone-d06cf.web.app/admin/approve-handyman
```

#### Stripe Configuration
```env
# ⚠️ PRODUCTION: Switch to LIVE keys (remove test keys!)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx  # NOT pk_test_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx  # NOT sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Production webhook secret
```

#### WhatsApp Configuration
```env
# ✅ PRODUCTION: Use permanent access token
REACT_APP_WHATSAPP_ACCESS_TOKEN=<permanent_token>  # NOT test token
REACT_APP_WHATSAPP_PHONE_NUMBER_ID=<production_phone_number_id>
```

#### Other Production Settings
```env
# Operations email (where handyman registrations are sent)
REACT_APP_OPERATIONS_EMAIL=operations@eazydone.com

# EmailJS (same for dev and prod)
REACT_APP_EMAILJS_SERVICE_ID=service_xxxxx
REACT_APP_EMAILJS_TEMPLATE_HANDYMAN=template_xxxxx
REACT_APP_EMAILJS_TEMPLATE_OPERATIONS=template_xxxxx
REACT_APP_EMAILJS_PUBLIC_KEY=xxxxx
```

### 3. Firebase Configuration

#### Check firebase.json
```json
{
  "firestore": [
    {
      "database": "(default)",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    },
    {
      "database": "devs",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    }
  ],
  "hosting": {
    "public": "build",
    ...
  }
}
```

#### Deploy Firestore Rules (if updated)
- [ ] Deploy rules: `firebase deploy --only firestore:rules`
- [ ] Verify rules applied to both databases in Firebase Console

### 4. Code Review

#### Check for Test/Debug Code
- [ ] Remove console.log statements (or use production-safe logging)
- [ ] Remove debug flags and test modes
- [ ] Check for hardcoded test data
- [ ] Verify no localhost URLs in code (except in .env)

#### Review Recent Changes
- [ ] Review all commits since last deployment
- [ ] Check for breaking changes
- [ ] Verify all features tested in dev environment

### 5. Build & Test

#### Local Production Build
- [ ] Run production build: `npm run build`
- [ ] Check for build errors
- [ ] Test build locally: `npx serve -s build`
- [ ] Verify app works at http://localhost:3000

#### Database Verification
- [ ] Confirm .env.local has `REACT_APP_FIRESTORE_DATABASE=(default)`
- [ ] Restart dev server to load new env: `npm start`
- [ ] Check console shows: `🔥 Firebase initialized with database: (default)`
- [ ] Test that reads/writes go to (default) database, not devs

## Deployment Steps

### 1. Deploy to Firebase Hosting
```bash
# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# OR deploy everything (hosting + functions + rules)
firebase deploy
```

### 2. Verify Deployment
- [ ] Open production URL: https://eazydone-d06cf.web.app
- [ ] Check browser console for errors
- [ ] Verify database connection in console: should show `(default)`
- [ ] Test core functionality (see Testing section below)

### 3. Deploy Cloud Functions (if updated)
```bash
firebase deploy --only functions
```

### 4. Stripe Webhook Configuration
- [ ] Update Stripe webhook URL to production endpoint
- [ ] Test webhook with Stripe CLI: `stripe trigger payment_intent.succeeded`
- [ ] Verify webhook events logged in Firebase Functions

## Post-Deployment Testing

### Critical User Flows

#### 1. Customer Job Creation Flow
- [ ] Navigate to homepage
- [ ] Click "I need a handyman"
- [ ] Fill out job request form
- [ ] Verify Stripe payment form appears
- [ ] Test payment with Stripe test card: 4242 4242 4242 4242
- [ ] Verify job created in (default) database
- [ ] Check payment record in Firestore

#### 2. Handyman Registration Flow
- [ ] Click "I am a handyman"
- [ ] Fill out registration form
- [ ] Upload documents
- [ ] Submit registration
- [ ] Verify handyman profile in (default) database
- [ ] Check operations team received approval email
- [ ] Test approval/rejection links in email

#### 3. Authentication
- [ ] Test handyman login
- [ ] Test password reset
- [ ] Verify dashboard access
- [ ] Test logout

### Database Verification
- [ ] Open Firebase Console
- [ ] Select **(default)** database
- [ ] Verify new data appears here (not in devs)
- [ ] Check users collection
- [ ] Check jobs collection
- [ ] Check handymen collection
- [ ] Check payments collection

### Email Notifications
- [ ] Verify handyman registration sends acknowledgment email
- [ ] Verify operations team receives notification
- [ ] Test approval email links work
- [ ] Check email formatting and branding

### Payment Flow
- [ ] Verify Stripe dashboard shows live payments
- [ ] Check payment intents created correctly
- [ ] Verify escrow/hold functionality
- [ ] Test payment method storage

### Performance & Monitoring
- [ ] Check Firebase Console for errors
- [ ] Monitor Cloud Functions logs
- [ ] Check Stripe dashboard for errors
- [ ] Verify page load times acceptable
- [ ] Test mobile responsiveness

## Rollback Plan

If critical issues found:

### Quick Rollback
```bash
# Rollback to previous hosting deployment
firebase hosting:rollback

# OR redeploy from main branch commit
git reset --hard <previous-commit-hash>
npm run build
firebase deploy --only hosting
```

### Database Rollback
- [ ] If bad data in (default) database, manually clean in Firebase Console
- [ ] Restore from backup if available
- [ ] Document issue for post-mortem

## Environment Comparison

| Setting | Development (dev branch) | Production (main branch) |
|---------|-------------------------|-------------------------|
| Database | `devs` | `(default)` |
| Approval URL | `http://localhost:3000/admin/approve-handyman` | `https://eazydone-d06cf.web.app/admin/approve-handyman` |
| Stripe Keys | Test keys (`pk_test_`, `sk_test_`) | Live keys (`pk_live_`, `sk_live_`) |
| WhatsApp Token | Test/temporary token | Permanent production token |
| Hosting URL | `http://localhost:3000` | `https://eazydone-d06cf.web.app` |
| Console Logs | Enabled | Minimal/disabled |

## Common Issues & Solutions

### Issue: Data going to devs database in production
**Solution:**
1. Check `.env.local` in main branch
2. Verify `REACT_APP_FIRESTORE_DATABASE=(default)`
3. Rebuild: `npm run build`
4. Redeploy: `firebase deploy --only hosting`

### Issue: Approval links point to localhost
**Solution:**
1. Update `.env.local`: `REACT_APP_APPROVAL_BASE_URL=https://eazydone-d06cf.web.app/admin/approve-handyman`
2. Rebuild and redeploy

### Issue: Stripe test keys in production
**Solution:**
1. Update `.env.local` with live keys
2. Update Stripe webhook endpoint
3. Rebuild and redeploy

### Issue: Permission denied errors
**Solution:**
1. Verify Firestore rules deployed: `firebase deploy --only firestore:rules`
2. Check rules in Firebase Console
3. Verify rules applied to (default) database

## Post-Deployment Checklist

- [ ] Update deployment log with date, time, and changes
- [ ] Notify team of deployment
- [ ] Monitor error logs for 24 hours
- [ ] Document any issues encountered
- [ ] Update main branch `.env.local.example` if needed
- [ ] Tag release in git: `git tag -a v1.0.0 -m "Production release"`
- [ ] Push tags: `git push origin --tags`

## Emergency Contacts

- Firebase Console: https://console.firebase.google.com/project/eazydone-d06cf
- Stripe Dashboard: https://dashboard.stripe.com
- Operations Email: operations@eazydone.com

## Notes

- Always test in dev environment first
- Never commit `.env.local` to git
- Keep production credentials secure
- Document all environment changes
- Maintain separate test and live Stripe accounts
