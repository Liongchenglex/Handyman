# Authentication Feature Documentation

> **Scope:** This document covers Firebase authentication mechanisms, auth state management, and security rules.
> **For:** Registration UI, document uploads, and approval workflows, see [Handyman Registration](./handyman-registration.md).

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
- `registerHandyman(registrationData)` - Creates Firebase auth user and handyman profile in Firestore
- `signInHandyman(email, password)` - Authenticates handyman and validates role from Firestore
- `createAnonymousUser(userData)` - Creates anonymous session for customers (no registration required)
- `signOutUser()` - Signs out current user and clears session
- `getCurrentUser()` - Returns currently authenticated user object
- `getCurrentUserRole()` - Fetches and returns user's role from Firestore (handyman/customer/admin)
- `resetPassword(email)` - Sends password reset email via Firebase Auth
- `isAuthenticated()` - Returns boolean indicating if user is currently logged in

#### `/src/context/AuthContext.js`
React context provider for global auth state management.

**Provides:**
- `user` - Current Firebase auth user
- `userProfile` - User's Firestore profile data (includes nested handyman profile for handymen)
- `loading` - Auth state loading status
- `isAuthenticated` - Boolean indicating if user is logged in
- `isHandyman` - Boolean indicating if user role is 'handyman'
- `isCustomer` - Boolean indicating if user role is 'customer'
- `login()` - Function to create anonymous user (for customers)
- `logout()` - Function to sign out current user

**Important Implementation Details:**
- Context always renders children (not conditional on loading state)
- Auth state changes propagate immediately to all consuming components
- Each component is responsible for handling its own loading states
- Automatically fetches user profile from Firestore when auth state changes

#### `/src/hooks/useAuth.js`
Custom React hook for accessing auth context.

**Usage:**
```javascript
const { currentUser, userProfile, loading } = useAuth();
```

#### `/src/pages/HandymanAuth.jsx`
Handyman login/register page wrapper component.

**Features:**
- Renders HandymanAuth component with callback handlers
- Redirects to dashboard if already logged in as handyman
- Handles successful login → navigates to `/handyman-dashboard` (with replace: true)
- Handles successful signup → navigates to `/handyman-registration` with email/password in state
- Shows loading spinner while checking authentication status

**Key Functions:**
- `handleLoginSuccess(userData)` - Called after successful login, redirects to dashboard
- `handleSignupSuccess(userData)` - Called after signup form validation, passes credentials to registration page
- `handleBackToHome()` - Returns to home page

#### `/src/services/firebase/collections.js`
Firestore handyman profile management.

**Key Functions:**
- `createHandyman(uid, handymanData)` - Create handyman document in Firestore (includes role field)
- `getHandyman(uid)` - Fetch handyman profile
- `updateHandyman(uid, updates)` - Update handyman profile

**Architecture Note:** This platform uses a single `handymen` collection for all authenticated users (no separate `users` collection). See [Architecture Changes](#architecture-changes) section below for details.

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
5. Create handyman profile document in Firestore
   → /src/services/firebase/collections.js → createHandyman()
   → Creates document in 'handymen' collection with role='handyman'
   ↓
6. Return user object with profile
```

### Handyman Login Flow

```
1. User enters email/password
   ↓
2. Frontend calls signInHandyman()
   → /src/services/firebase/auth.js:114
   ↓
3. Authenticate with Firebase
   → signInWithEmailAndPassword()
   ↓
4. Fetch handyman profile from Firestore
   → getHandyman(uid) - fetches from 'handymen' collection
   ↓
5. Verify role is 'handyman'
   → If not handyman, sign out and throw error
   ↓
6. Return user and profile data
   ↓
7. HandymanAuth component calls onLoginSuccess callback
   → /src/pages/HandymanAuth.jsx:25
   ↓
8. Navigate to dashboard with replace: true
   → navigate('/handyman-dashboard', { replace: true })
   ↓
9. AuthContext updates automatically via onAuthStateChanged listener
   → /src/context/AuthContext.js:25
   ↓
10. HandymanDashboard renders based on handyman status
    → /src/pages/HandymanDashboard.jsx
    → Shows PendingStatusView, RejectedStatusView, or full dashboard
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

All authenticated users are handymen. For the complete schema including all fields (NRIC, address, documents, Stripe details, etc.), see [Handyman Registration Documentation - Firestore Data Structure](./handyman-registration.md#firestore-data-structure).

**Core Authentication Fields:**
```javascript
{
  uid: "firebase_user_id",
  email: "john@example.com",
  name: "John Tan",
  phone: "+6591234567",
  role: "handyman", // Always 'handyman' for this platform
  status: "pending" | "active" | "rejected" | "suspended",
  verified: false,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Security Rules

**Firestore Security Rules** (`firestore.rules.backup`):

```javascript
// Handymen profiles (all authenticated users)
match /handymen/{handymanId} {
  // Anyone can read verified handyman profiles
  allow read: if request.auth != null;

  // Handyman can create their own profile
  allow create: if request.auth != null && request.auth.uid == handymanId;

  // Handyman can update their own profile (except verified/status fields)
  allow update: if request.auth != null && request.auth.uid == handymanId &&
                  (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['verified', 'status']));

  // Allow approval/rejection for pending handymen (for email approval links)
  allow update: if resource.data.status == 'pending';

  // Admin can update verification status anytime
  allow update: if isAdmin();
}
```

---

## Architecture Changes

### Refactoring: Removed Users Collection (2025-12-11)

**Previous Architecture:**
- Separate `users` and `handymen` collections
- Duplicate data: email, name, phone stored in both collections
- Two database writes on registration
- `users.role` always 'handyman'

**Current Architecture:**
- Single `handymen` collection for all authenticated users
- All user data stored in one place
- One database write on registration
- `handymen.role` field included (always 'handyman')

**Benefits:**
- ✅ Single source of truth - no data duplication
- ✅ Reduced database operations - 50% fewer writes
- ✅ Simplified code - easier to maintain
- ✅ Better performance - fewer Firestore reads
- ✅ Lower costs - reduced Firestore operations

**Migration Impact:**
- No migration needed for clean databases
- All auth logic updated to use `handymen` collection
- Security rules simplified
- AuthContext now fetches directly from `handymen`

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
- [ ] Creates both `users` and `handymen` documents in Firestore
- [ ] Sets correct role ('handyman')

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

**Last Updated:** 2025-12-11
**Status:** ✅ Fully Implemented and Production-Ready
