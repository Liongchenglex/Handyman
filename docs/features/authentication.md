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
- `currentUser` - Current Firebase auth user
- `userProfile` - User's Firestore profile data
- `loading` - Auth state loading status
- Auth state listeners and auto-refresh

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
Firestore user profile management.

**Key Functions:**
- `createUser(uid, userData)` - Create user document in Firestore
- `getUser(uid)` - Fetch user profile
- `updateUser(uid, updates)` - Update user profile

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
5. Create user document in Firestore
   → /src/services/firebase/collections.js → createUser()
   ↓
6. Create handyman profile document
   → /src/services/firebase/collections.js → createHandyman()
   ↓
7. Return user object with profile
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
4. Fetch user profile from Firestore
   → getUser(uid)
   ↓
5. Verify role is 'handyman'
   ↓
6. Update AuthContext
   → /src/context/AuthContext.js
   ↓
7. Redirect to dashboard
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

### Users Collection (`users/{uid}`)

```javascript
{
  uid: "firebase_user_id",
  email: "user@example.com",
  name: "John Tan",
  phone: "+6591234567",
  role: "handyman" | "customer" | "admin",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Handymen Collection (`handymen/{uid}`)

Created alongside user document for handyman accounts:

```javascript
{
  uid: "firebase_user_id",
  name: "John Tan",
  email: "john@example.com",
  phone: "+6591234567",
  serviceTypes: ["Plumbing", "Electrical"],
  experience: "5 years",
  bio: "Professional plumber...",
  verified: false,
  verificationStatus: "pending" | "approved" | "rejected",
  isAvailable: true,
  rating: 0,
  totalJobs: 0,
  stripeAccountId: "acct_xxxxx", // Added after Stripe onboarding
  stripeOnboardingComplete: false,
  createdAt: Timestamp
}
```

---

## Security Rules

**Firestore Security Rules** (`firestore.rules`):

```javascript
// Users can read their own profile
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null;
  allow update: if request.auth != null && request.auth.uid == userId;
}

// Handymen profiles
match /handymen/{handymanId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.auth.uid == handymanId;
  allow update: if request.auth != null && request.auth.uid == handymanId;
}
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
