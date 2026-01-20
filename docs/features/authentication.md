# Authentication Feature Documentation

## Overview

The EazyDone platform supports two types of authentication:
1. **Handyman Authentication**: Email/password-based authentication for service providers
2. **Customer Authentication**: Anonymous authentication for customers (no registration required)

## Current Implementation Status

✅ **Implemented**
- Handyman email/password registration
- Handyman login/logout
- Password reset functionality
- Anonymous customer authentication
- Role-based access control
- Auth state persistence

❌ **Not Implemented**
- Social login (Google, Facebook)
- Two-factor authentication
- Customer account registration (currently anonymous only)

---

## Key Files & Functions

### Frontend

#### `/src/services/firebase/auth.js`
Main authentication service with all auth operations.

**Key Functions:**
- `registerHandyman(registrationData)` - Register new handyman with email/password (Line 36)
- `signInHandyman(email, password)` - Handyman login (Line 114)
- `createAnonymousUser(userData)` - Create anonymous customer session (Line 174)
- `signOutUser()` - Sign out current user (Line 192)
- `getCurrentUser()` - Get currently authenticated user (Line 205)
- `getCurrentUserRole()` - Get user's role (handyman/customer/admin) (Line 221)
- `resetPassword(email)` - Send password reset email (Line 238)
- `isAuthenticated()` - Check if user is logged in (Line 213)

#### `/src/context/AuthContext.js`
React context provider for global auth state management.

**Provides:**
- `user` - Current Firebase auth user
- `userProfile` - Handyman's Firestore profile data (for handymen) or null (for anonymous customers)
- `loading` - Auth state loading status
- `isHandyman` - Boolean flag (userProfile?.role === 'handyman')
- `isCustomer` - Boolean flag (userProfile?.role === 'customer')
- `isAuthenticated` - Boolean flag (!!user)
- Auth state listeners and auto-refresh

**Important:** For handymen, `userProfile` contains the complete handyman document from the `handymen` collection (not nested). For anonymous customers, `userProfile` is null.

#### `/src/hooks/useAuth.js`
Custom React hook for accessing auth context.

**Usage:**
```javascript
const { currentUser, userProfile, loading } = useAuth();
```

#### `/src/pages/HandymanAuth.jsx`
Handyman login/register page component.

**Features:**
- Login form with email/password
- Password reset link
- Error handling
- Redirect to dashboard after login

#### `/src/services/firebase/collections.js`
Firestore profile management.

**Key Functions:**
- `createHandyman(handymanId, handymanData)` - Create handyman document in Firestore
- `getHandyman(handymanId)` - Fetch handyman profile
- `updateHandyman(handymanId, updates)` - Update handyman profile

**Note:** `createUser`, `getUser`, `updateUser` functions are no longer used for handymen. The handymen collection is the single source of truth.

---

## Authentication Flow

### Handyman Registration Flow

```
1. User fills registration form
   ↓
2. Frontend calls registerHandyman()
   → /src/services/firebase/auth.js:36
   ↓
3. Create Firebase Auth user
   → createUserWithEmailAndPassword()
   ↓
4. Update auth profile
   → updateProfile(user, { displayName: name })
   ↓
5. Create handyman document in Firestore (single source of truth)
   → /src/services/firebase/collections.js → createHandyman()
   ↓
6. Upload documents and send registration emails
   ↓
7. Page reload to refresh AuthContext
   → window.location.href = '/handyman-auth'
   ↓
8. AuthContext fetches handyman profile
   → Auto-redirect to dashboard
```

### Handyman Login Flow

```
1. User enters email/password
   ↓
2. Frontend calls signInHandyman()
   → /src/services/firebase/auth.js:107
   ↓
3. Authenticate with Firebase
   → signInWithEmailAndPassword()
   ↓
4. Fetch handyman profile from Firestore
   → getHandyman(uid)
   ↓
5. Verify role is 'handyman'
   ↓
6. AuthContext automatically updates via onAuthStateChanged
   → /src/context/AuthContext.js
   ↓
7. HandymanAuth page detects user && isHandyman
   ↓
8. Auto-redirect to dashboard
   → /src/pages/HandymanDashboard.jsx
```

### Customer Anonymous Auth Flow

```
1. Customer fills job request form
   ↓
2. Frontend calls createAnonymousUser()
   → /src/services/firebase/auth.js:174
   ↓
3. Create anonymous Firebase user
   → signInAnonymously()
   ↓
4. Update display name (optional)
   → updateProfile()
   ↓
5. Return anonymous user object
```

---

## Firestore Database Structure

### Handymen Collection (`handymen/{uid}`)

**Single source of truth for handyman data** (no separate users collection):

```javascript
{
  handymanId: "firebase_user_id", // Same as document ID
  uid: "firebase_user_id", // Deprecated, kept for backward compatibility
  name: "John Tan",
  email: "john@example.com",
  phone: "+6591234567",
  role: "handyman", // Required for authentication checks
  serviceTypes: ["Plumbing", "Electrical"],
  experience: "5 years",
  bio: "Professional plumber...",
  verified: false,
  status: "pending" | "active" | "rejected" | "suspended",
  isAvailable: true,
  rating: 0,
  totalJobs: 0,
  // Stripe Connect fields
  stripeConnectedAccountId: "acct_xxxxx", // Added after Stripe onboarding
  stripeAccountStatus: "pending" | "complete" | "disabled",
  stripeOnboardingCompleted: false,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Note:** The `users` collection has been eliminated to follow DRY principles. All handyman data is stored in the `handymen` collection only.

---

## Security Rules

**Firestore Security Rules** (`firestore.rules`):

```javascript
// Handymen profiles - single source of truth
match /handymen/{handymanId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.auth.uid == handymanId;
  allow update: if request.auth != null && request.auth.uid == handymanId;
}

// Note: users collection has been removed - no longer needed
```

---

## Error Handling

**Common Auth Errors** (handled in `/src/services/firebase/auth.js`):

| Error Code | User-Friendly Message | Line |
|------------|----------------------|------|
| `auth/email-already-in-use` | "This email is already registered. Please sign in instead." | 96 |
| `auth/invalid-email` | "Invalid email address format." | 98 |
| `auth/weak-password` | "Password is too weak. Please use a stronger password." | 100 |
| `auth/invalid-credential` | "Invalid email or password." | 150 |
| `auth/user-not-found` | "No account found with this email." | 152 |
| `auth/wrong-password` | "Incorrect password." | 154 |
| `auth/too-many-requests` | "Too many failed attempts. Please try again later." | 156 |

---

## Usage Examples

### Register a New Handyman

```javascript
import { registerHandyman } from './services/firebase/auth';

const registrationData = {
  email: 'handyman@example.com',
  password: 'securePassword123',
  name: 'John Tan',
  phone: '+6591234567',
  serviceTypes: ['Plumbing', 'Electrical'],
  experience: '5 years',
  bio: 'Professional handyman with 5 years experience'
};

try {
  const { user, profile } = await registerHandyman(registrationData);
  console.log('Registered user:', user.uid);
} catch (error) {
  console.error('Registration failed:', error.message);
}
```

### Sign In Handyman

```javascript
import { signInHandyman } from './services/firebase/auth';

try {
  const { user, profile } = await signInHandyman('handyman@example.com', 'password123');
  console.log('Logged in as:', profile.name);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

### Create Anonymous Customer

```javascript
import { createAnonymousUser } from './services/firebase/auth';

const customerData = {
  name: 'Jane Customer',
  email: 'customer@example.com',
  phone: '+6581234567'
};

try {
  const user = await createAnonymousUser(customerData);
  console.log('Anonymous user created:', user.uid);
} catch (error) {
  console.error('Anonymous auth failed:', error);
}
```

---

## Environment Variables

**Required in `.env.local`:**

```env
# Firebase Config (from Firebase Console)
REACT_APP_FIREBASE_API_KEY=xxxxx
REACT_APP_FIREBASE_AUTH_DOMAIN=xxxxx
REACT_APP_FIREBASE_PROJECT_ID=eazydone-d06cf
```

---

## Testing

### Manual Testing Checklist

**Handyman Registration:**
- [ ] Can register with valid email/password
- [ ] Shows error for duplicate email
- [ ] Shows error for weak password (<6 chars)
- [ ] Shows error for invalid email format
- [ ] Creates handyman document in Firestore (no users document)
- [ ] Sets correct role ('handyman') in handyman document
- [ ] Sends registration emails successfully
- [ ] Redirects to dashboard after registration

**Handyman Login:**
- [ ] Can login with correct credentials
- [ ] Shows error for wrong password
- [ ] Shows error for non-existent email
- [ ] Redirects to dashboard after login
- [ ] Auth state persists on page refresh

**Customer Anonymous Auth:**
- [ ] Creates anonymous user successfully
- [ ] Anonymous user can create jobs
- [ ] Session persists during job creation flow

**Password Reset:**
- [ ] Sends reset email to valid address
- [ ] Shows error for non-existent email
- [ ] Reset link works correctly

---

## Future Enhancements

1. **Social Login**
   - Google Sign-In
   - Facebook Login
   - Apple Sign-In (for iOS)

2. **Two-Factor Authentication (2FA)**
   - SMS verification
   - Authenticator app support

3. **Customer Account System**
   - Email/password registration for customers
   - Account dashboard
   - Order history

4. **Email Verification**
   - Require email verification before account activation
   - Resend verification email

5. **Session Management**
   - Remember me functionality
   - Multiple device sessions
   - Session timeout configuration

---

## Related Documentation

- [Handyman Registration Flow](./handyman-registration.md)
- [Job Dashboard](./job-dashboard.md)
- [Firebase Setup](../setup/firebase-setup.md)
- [Environment Configuration](../setup/environment-setup.md)

---

## Recent Changes (2026-01-20)

### Architecture Refactoring
- **Eliminated `users` collection** - Now using only `handymen` collection as single source of truth
- **Fixed race condition** in registration flow where AuthContext tried to fetch profile before it was created
- **Updated data model** to follow DRY principles (no duplication between collections)

### Key Changes
1. `registerHandyman()` now only creates handyman document (no user document)
2. `AuthContext` fetches only from handymen collection for non-anonymous users
3. Registration flow uses page reload to ensure fresh AuthContext initialization
4. Login flow waits for AuthContext to update before redirecting
5. HandymanDashboard uses flat `userProfile` structure instead of nested `userProfile.handyman`

### Migration Notes
- Existing handyman documents must have `role: 'handyman'` field added manually in Firestore
- The `users` collection can be safely deleted (no longer used)
- All authentication flows have been tested and verified working

---

**Last Updated:** 2026-01-20
**Status:** ✅ Fully Implemented and Production-Ready
