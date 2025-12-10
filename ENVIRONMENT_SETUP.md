# Environment Setup Guide

This document explains the dev/production environment setup for the EazyDone Handyman Platform.

## Overview

The project now supports two environments:
- **Development (`dev` branch)**: For local testing and development
- **Production (`main` branch)**: For deployed production use

## Branch Structure

```
master (legacy) → Will be deprecated
├── main (production) → Deploy to Firebase
└── dev (development) → Local development
```

## Environment Detection

The application **automatically detects** the environment based on the hostname:

### Development Environment
- **Hostname**: `localhost`, `127.0.0.1`, or `192.168.*`
- **Database**: `dev` (Firestore database)
- **Approval URL**: `http://localhost:3000/admin/approve-handyman`
- **Functions**: Local emulator (if running) or deployed functions

### Production Environment
- **Hostname**: `eazydone-d06cf.web.app` or `eazydone-d06cf.firebaseapp.com`
- **Database**: `(default)` (Firestore database)
- **Approval URL**: `https://eazydone-d06cf.web.app/admin/approve-handyman`
- **Functions**: Deployed Firebase Functions

## Database Setup

### Step 1: Create Dev Database (One-time setup)

1. Go to [Firebase Console - Firestore](https://console.firebase.google.com/project/eazydone-d06cf/firestore)
2. Click on the database dropdown (shows `(default)`)
3. Click "Create database"
4. Database ID: `dev`
5. Location: `us-central` (same as default)
6. Mode: Production mode (we'll copy rules later)
7. Click "Create"

### Step 2: Copy Security Rules to Dev Database

After creating the dev database, you need to apply the same security rules:

```bash
# Deploy rules to dev database
firebase deploy --only firestore:rules --project eazydone-d06cf
```

Or manually copy rules from `firestore.rules` in the Firebase Console.

## Environment Configuration

### No Manual Environment Variables Needed!

The `.env.local` file remains the same for both environments. The application automatically determines:
- Which database to use (`dev` or `(default)`)
- Which approval URL to use (localhost or production)
- API endpoints
- Debug logging

### How It Works

The `/src/config/environment.js` module:
1. Detects hostname
2. Returns appropriate database ID
3. Returns appropriate URLs
4. Enables/disables features per environment

## Workflow

### Development Workflow (on `dev` branch)

```bash
# Switch to dev branch
git checkout dev

# Start local development
npm start

# App runs on localhost:3000
# → Automatically uses 'dev' database
# → Approval emails link to localhost
```

### Production Deployment (on `main` branch)

```bash
# Switch to main branch
git checkout main

# Merge tested changes from dev
git merge dev

# Build and deploy
npm run build
firebase deploy

# App deployed to eazydone-d06cf.web.app
# → Automatically uses '(default)' database
# → Approval emails link to production
```

### Testing Locally Before Deploy

```bash
# On main branch, build and serve locally
npm run build
firebase serve

# This serves the production build locally
# Still uses 'dev' database (because localhost)
```

## Key Files

### Environment Configuration
- `/src/config/environment.js` - Environment detection and configuration
- `/src/services/firebase/config.js` - Firebase initialization with database selection
- `/src/config/emailConfig.js` - Email config with dynamic approval URLs

### Git Branches
- `main` - Production branch (deploy from here)
- `dev` - Development branch (work here)
- `master` - Legacy (can be deleted later)

## Common Tasks

### Starting Development

```bash
git checkout dev
npm start
```

### Creating a Feature

```bash
git checkout dev
git pull origin dev
git checkout -b feature/my-feature

# Work on feature
git add .
git commit -m "Add my feature"

# Merge back to dev
git checkout dev
git merge feature/my-feature
git push origin dev
```

### Deploying to Production

```bash
# Ensure dev is tested and working
git checkout dev
npm start  # Test locally

# Merge to main
git checkout main
git merge dev
git push origin main

# Deploy
npm run build
firebase deploy
```

## Troubleshooting

### Wrong Database Being Used

Check the console log:
```
🔥 Firebase initialized with database: dev
```

If you see `(default)` but expect `dev`:
- Verify you're on `localhost`
- Check browser console for errors
- Clear cache and hard refresh

### Approval Links Going to Wrong URL

Check environment detection:
```javascript
import { getConfig } from './config/environment';
console.log(getConfig());
```

### "Permission Denied" Errors

Ensure Firestore security rules are deployed to BOTH databases:
```bash
firebase deploy --only firestore:rules
```

## Feature Flags

You can add environment-specific features in `/src/config/environment.js`:

```javascript
features: {
  debugLogging: isDevelopment(),  // Only log in dev
  analytics: isProduction(),       // Only track in prod
  stripeTestMode: true,            // Test mode for both (as requested)
}
```

## Migration to Separate Projects (Future)

When you're ready to move to separate Firebase projects:

1. Create new project: `eazydone-d06cf-dev`
2. Update `.firebaserc`:
```json
{
  "projects": {
    "default": "eazydone-d06cf",
    "dev": "eazydone-d06cf-dev"
  }
}
```
3. Update `/src/config/environment.js` to return different project IDs
4. That's it!

## Best Practices

1. ✅ **Always develop on `dev` branch**
2. ✅ **Test thoroughly before merging to `main`**
3. ✅ **Never push directly to `main`** (except for hotfixes)
4. ✅ **Keep databases separate** (dev for testing, default for production)
5. ✅ **Review approval emails** work in both environments before deploying

## Questions?

Check the console logs - the app logs environment info on startup:
```
🔧 Environment Configuration: {
  environment: 'development',
  database: 'dev',
  approvalBaseUrl: 'http://localhost:3000/admin/approve-handyman',
  ...
}
```
