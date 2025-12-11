# Simple Environment Setup Guide

## Overview

This project uses **simple `.env` file configuration** for different environments:
- **dev branch** → Uses `devs` database (development data)
- **main branch** → Uses `(default)` database (production data)

No complex hostname detection or environment logic - just straightforward environment variables!

## Setup Instructions

### Dev Branch (.env.local)

Create/update `.env.local` in the **dev** branch with:

```env
# Firestore Database (dev branch uses 'devs', main branch uses '(default)')
REACT_APP_FIRESTORE_DATABASE=devs

# Approval base URL for handyman registration emails
REACT_APP_APPROVAL_BASE_URL=http://localhost:3000/admin/approve-handyman
```

### Main Branch (.env.local)

Create/update `.env.local` in the **main** branch with:

```env
# Firestore Database (dev branch uses 'devs', main branch uses '(default)')
REACT_APP_FIRESTORE_DATABASE=(default)

# Approval base URL for handyman registration emails
REACT_APP_APPROVAL_BASE_URL=https://eazydone-d06cf.web.app/admin/approve-handyman
```

## How It Works

### Firebase Config (`src/services/firebase/config.js`)

```javascript
// Get database from environment variable
const databaseId = process.env.REACT_APP_FIRESTORE_DATABASE || '(default)';

// Initialize Firestore with the specified database
export const db = getFirestore(app, databaseId === '(default)' ? undefined : databaseId);
```

### Email Config (`src/config/emailConfig.js`)

```javascript
export const EMAIL_CONFIG = {
  APPROVAL_BASE_URL: process.env.REACT_APP_APPROVAL_BASE_URL || 'http://localhost:3000/admin/approve-handyman'
};
```

## Workflow

1. **Development** (dev branch):
   - Run `npm start` locally
   - Reads `REACT_APP_FIRESTORE_DATABASE=devs` from `.env.local`
   - All data goes to **devs** database
   - Email approval links point to `localhost:3000`

2. **Production** (main branch):
   - Deploy to Firebase Hosting
   - Reads `REACT_APP_FIRESTORE_DATABASE=(default)` from environment
   - All data goes to **(default)** database
   - Email approval links point to production URL

## Firestore Security Rules

Rules are deployed to **both** databases using `firebase.json`:

```json
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
]
```

Deploy with:
```bash
firebase deploy --only firestore:rules
```

## Benefits

✅ Simple and explicit configuration
✅ Easy to understand and debug
✅ No complex environment detection logic
✅ Standard industry practice
✅ Each branch has its own `.env.local` file
✅ Production and development data completely separated

## Switching Branches

When switching from **main** to **dev**:
1. Checkout dev branch: `git checkout dev`
2. Update `.env.local` to use `devs` database
3. Restart dev server

When switching from **dev** to **main**:
1. Checkout main branch: `git checkout main`
2. Update `.env.local` to use `(default)` database
3. Deploy or test production build

**Important:** `.env.local` is gitignored, so you need to manually configure it on each branch!
