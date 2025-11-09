# Verification & Status Structure

This document clarifies the verification fields and status workflow for handymen.

---

## Overview

We use **operations approval** to verify handymen before they can accept jobs.

**Note:** We do NOT use Firebase Auth email verification (`sendEmailVerification`). Instead, we send our own branded acknowledgment emails through EmailJS, and the operations team manually reviews and approves each handyman.

---

## Database Schema

### users collection

```javascript
{
  uid: "user123",
  email: "handyman@example.com",
  name: "John Doe",
  phone: "91234567",
  role: "handyman",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Note:** No `emailVerified` field - we don't use Firebase Auth email verification

---

### handymen collection

```javascript
{
  uid: "user123",
  email: "handyman@example.com",
  name: "John Doe",
  phone: "91234567",
  serviceTypes: ["Plumbing", "Electrical"],

  // VERIFICATION FIELDS
  verified: false,           // ← Boolean: Operations team approved?
  status: "pending",         // ← String: Current account status

  // Metadata
  verifiedAt: null,          // Set when approved
  rejectedAt: null,          // Set when rejected
  rejectedReason: "",        // Optional rejection reason

  // Other fields
  isAvailable: true,
  rating: 0,
  totalJobs: 0,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## Status Workflow

### 1. Registration (Initial State)

When a handyman registers:

```javascript
{
  verified: false,
  status: "pending",
  verifiedAt: null,
  rejectedAt: null
}
```

**What happens:**
- Handyman completes registration form
- Profile created in Firestore
- Email acknowledgment sent to handyman
- Operations notification sent to ops team
- Handyman **cannot accept jobs** yet

---

### 2. Operations Team Approves

When ops team clicks "Approve" in email:

```javascript
{
  verified: true,
  status: "active",
  verifiedAt: "2024-01-15T10:30:00.000Z",
  rejectedAt: null
}
```

**What happens:**
- `verified` set to `true`
- `status` changed to `"active"`
- `verifiedAt` timestamp recorded
- Handyman **can now accept jobs**
- TODO: Confirmation email sent to handyman

---

### 3. Operations Team Rejects

When ops team clicks "Reject" in email:

```javascript
{
  verified: false,
  status: "rejected",
  verifiedAt: null,
  rejectedAt: "2024-01-15T10:30:00.000Z",
  rejectedReason: "" // Can be added later
}
```

**What happens:**
- `verified` remains `false`
- `status` changed to `"rejected"`
- `rejectedAt` timestamp recorded
- Handyman **cannot accept jobs**
- TODO: Rejection email sent to handyman

---

### 4. Suspended (Future Feature)

If a handyman needs to be suspended later:

```javascript
{
  verified: true,              // Was verified before
  status: "suspended",
  verifiedAt: "2024-01-15T10:30:00.000Z",
  suspendedAt: "2024-02-20T14:00:00.000Z",
  suspendedReason: "Violation of terms"
}
```

**What happens:**
- `verified` stays `true` (they were verified)
- `status` changed to `"suspended"`
- Handyman **cannot accept jobs** while suspended
- Can be reactivated by changing status back to `"active"`

---

## Status Values

| Status | Meaning | Can Accept Jobs? | Next Actions |
|--------|---------|------------------|--------------|
| `pending` | Awaiting operations review | ❌ No | Ops approves/rejects |
| `active` | Approved and active | ✅ Yes | Can work on jobs |
| `rejected` | Application rejected | ❌ No | Can reapply (future) |
| `suspended` | Temporarily suspended | ❌ No | Ops can reactivate |

---

## Querying Handymen

### Get all active handymen (can accept jobs)

```javascript
const activeHandymen = await queryDocuments('handymen', [
  { field: 'verified', operator: '==', value: true },
  { field: 'status', operator: '==', value: 'active' },
  { field: 'isAvailable', operator: '==', value: true }
]);
```

### Get pending handymen (awaiting approval)

```javascript
const pendingHandymen = await queryDocuments('handymen', [
  { field: 'status', operator: '==', value: 'pending' }
]);
```

### Get rejected handymen

```javascript
const rejectedHandymen = await queryDocuments('handymen', [
  { field: 'status', operator: '==', value: 'rejected' }
]);
```

---

## UI Display Logic

### Handyman Dashboard

```javascript
if (handyman.status === 'pending') {
  // Show: "Your application is under review"
} else if (handyman.status === 'active') {
  // Show: Job board, available jobs
} else if (handyman.status === 'rejected') {
  // Show: "Your application was not approved"
} else if (handyman.status === 'suspended') {
  // Show: "Your account is suspended. Contact support."
}
```

### Job Board (Customer View)

Only show handymen with:
```javascript
verified === true && status === 'active' && isAvailable === true
```

---

## Why Both `verified` and `status`?

**Couldn't we just use `status`?**

We keep both for:

1. **Backward compatibility**: Existing code uses `verified` boolean
2. **Simple queries**: `verified === true` is simpler than `status === 'active'`
3. **Semantic clarity**:
   - `verified` = "Was this handyman ever approved?"
   - `status` = "What's their current state?"
4. **Future flexibility**: Can have verified handymen who are suspended

**Example:**
- Suspended handyman: `verified: true, status: 'suspended'`
- This shows they WERE verified, but are currently not active

---

## Migration Notes

If you have existing handymen in Firestore without the `status` field:

```javascript
// Run this migration script once
const handymen = await queryDocuments('handymen', []);

for (const handyman of handymen) {
  let status = 'pending';

  if (handyman.verified === true) {
    status = 'active';
  } else if (handyman.rejected === true) {
    status = 'rejected';
  }

  await updateDocument('handymen', handyman.uid, {
    status: status,
    // Remove old rejected field if using new structure
    rejected: null
  });
}
```

---

## Summary

✅ **Verification System:**
- We do NOT use Firebase Auth email verification
- We send custom branded emails via EmailJS instead
- Only operations approval matters for handyman verification

✅ **Use `verified` + `status` in handymen collection:**
- `verified`: Boolean - Is handyman approved?
- `status`: String - Current state ('pending', 'active', 'rejected', 'suspended')

✅ **Use `status` for UI logic:**
- Check `status === 'active'` to show job board
- Check `status === 'pending'` to show "under review" message
- Check `status === 'rejected'` to show rejection message

✅ **Operations approval determines:**
- `verified` field (boolean)
- `status` field (string: 'pending', 'active', 'rejected', 'suspended')
- When these are set (verifiedAt, rejectedAt timestamps)
