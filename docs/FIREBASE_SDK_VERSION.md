# Firebase SDK Version Information

## Current Version

**Firebase JavaScript SDK:** `v12.6.0` (Modular API - v9+)

See `package.json`:
```json
"firebase": "^12.6.0"
```

---

## Modular API (v9+)

This project uses the modern **modular API** introduced in Firebase v9, which offers:

✅ **Tree-shaking support** - Smaller bundle sizes
✅ **Better performance** - Only import what you need
✅ **Modern syntax** - ESM imports
✅ **Future-proof** - Recommended by Firebase team

---

## Import Syntax

### ✅ Current (v9+ Modular API)

```javascript
// Firebase App
import { initializeApp } from 'firebase/app';
const app = initializeApp(firebaseConfig);

// Firestore
import { getFirestore, collection, addDoc } from 'firebase/firestore';
const db = getFirestore(app);

// Auth
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
const auth = getAuth(app);

// Storage
import { getStorage, ref, uploadBytes } from 'firebase/storage';
const storage = getStorage(app);
```

### ❌ Old (v8 Namespaced API) - NOT USED

```javascript
// DON'T USE - This is v8 syntax
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';

const db = firebase.firestore();
const auth = firebase.auth();
```

---

## Migration Notes

If you see code examples online using the v8 syntax, here's how to convert:

| v8 (Old) | v9+ (New - Current) |
|----------|---------------------|
| `firebase.firestore()` | `getFirestore(app)` |
| `firebase.auth()` | `getAuth(app)` |
| `firebase.storage()` | `getStorage(app)` |
| `db.collection('users').add(data)` | `addDoc(collection(db, 'users'), data)` |
| `db.collection('users').doc(id).get()` | `getDoc(doc(db, 'users', id))` |
| `auth.signInWithEmailAndPassword()` | `signInWithEmailAndPassword(auth, email, password)` |

---

## Benefits of v9+ in This Project

### 1. **Smaller Bundle Size**
- **v8:** ~200-300KB (full SDK loaded)
- **v9+:** ~50-100KB (only what you import)

### 2. **Better Code Organization**
```javascript
// Clear separation of concerns
import { getFirestore } from 'firebase/firestore';  // Firestore only
import { getAuth } from 'firebase/auth';            // Auth only
```

### 3. **Type Safety**
Works seamlessly with TypeScript (if you migrate to TS in the future)

---

## Dependencies

All Firebase packages are at v12.6.0:

```json
{
  "firebase": "^12.6.0",
  "firebase-admin": "^13.6.0"  // Backend only
}
```

**Note:** Backend functions use `firebase-admin@13.6.0` which has its own API (not modular)

---

## Common Firebase Operations in This Project

### Firestore Operations

```javascript
// File: src/services/firebase/collections.js
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';

// Add document
await addDoc(collection(db, 'jobs'), jobData);

// Get document
const docSnap = await getDoc(doc(db, 'jobs', jobId));

// Query
const q = query(collection(db, 'jobs'), where('status', '==', 'pending'));
const querySnapshot = await getDocs(q);
```

### Authentication Operations

```javascript
// File: src/services/firebase/auth.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Register
await createUserWithEmailAndPassword(auth, email, password);

// Sign in
await signInWithEmailAndPassword(auth, email, password);

// Sign out
await signOut(auth);
```

### Storage Operations

```javascript
// File: src/services/firebase/storage.js
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Upload file
const storageRef = ref(storage, `handyman-documents/${uid}/nric.pdf`);
await uploadBytes(storageRef, file);

// Get URL
const url = await getDownloadURL(storageRef);
```

---

## Updating Firebase SDK

To update to a newer version:

```bash
# Check for updates
npm outdated firebase

# Update to latest v12.x
npm install firebase@latest

# Or specific version
npm install firebase@12.7.0
```

**Important:** Stay within v12.x range for compatibility. v13+ may introduce breaking changes.

---

## Documentation Resources

- **Firebase v9+ Docs:** https://firebase.google.com/docs/web/modular-upgrade
- **API Reference:** https://firebase.google.com/docs/reference/js
- **Migration Guide:** https://firebase.google.com/docs/web/modular-upgrade

---

**Last Updated:** 2025-12-11
**Current SDK Version:** 12.6.0
**API Type:** Modular (v9+)
