# Scheduled Jobs Documentation

## Overview

This document covers all scheduled background jobs (Cloud Functions) that run automatically to maintain the platform's data integrity and performance.

---

## Cleanup Abandoned Jobs

### Purpose
Automatically removes job records that were created but never completed payment. This prevents the database from filling with incomplete job requests and ensures handymen only see jobs with authorized payments.

### Function Name
`cleanupAbandonedJobs`

### File Location
`/functions/index.js` (lines 806-855)

### Trigger Schedule
- **Frequency:** Every 1 hour
- **Timezone:** Asia/Singapore
- **Type:** Cloud Pub/Sub scheduled function

### What It Does

The function performs the following actions:

1. **Calculate Cutoff Time**
   - Determines jobs older than 30 minutes
   - Uses current time minus 30 minutes as threshold

2. **Query Abandoned Jobs**
   - Finds jobs with status `'awaiting_payment'`
   - Filters for jobs created before the cutoff time
   - These are jobs where customers started but didn't complete payment

3. **Batch Delete**
   - Deletes all matching job documents from Firestore
   - Uses batched writes for efficiency
   - Logs deleted job IDs for audit trail

### Business Logic

**Why 30 minutes?**
- Gives customers reasonable time to complete payment
- Stripe payment sessions typically timeout after 30-60 minutes
- Prevents indefinite accumulation of incomplete jobs

**What triggers `'awaiting_payment'` status?**
- Job is created when customer fills out the job request form
- Status is set to `'awaiting_payment'` before payment intent is created
- Status changes to `'pending'` after successful payment authorization

### Code Implementation

```javascript
/**
 * Cleanup Abandoned Jobs
 *
 * Runs every hour to delete jobs that have been in 'awaiting_payment' status
 * for more than 30 minutes. These are jobs where the customer started the
 * payment process but never completed it (closed browser, card declined, etc.)
 *
 * This prevents unpaid jobs from cluttering the database and ensures
 * handymen only see jobs with authorized payments.
 */
exports.cleanupAbandonedJobs = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('Asia/Singapore')
  .onRun(async () => {
    try {
      console.log('🧹 Starting cleanup of abandoned jobs...');

      // Calculate cutoff time (30 minutes ago)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const cutoffTime = admin.firestore.Timestamp.fromDate(thirtyMinutesAgo);

      // Query jobs in 'awaiting_payment' status older than 30 minutes
      const abandonedJobsSnapshot = await admin.firestore()
        .collection('jobs')
        .where('status', '==', 'awaiting_payment')
        .where('createdAt', '<', cutoffTime.toDate().toISOString())
        .get();

      if (abandonedJobsSnapshot.empty) {
        console.log('✅ No abandoned jobs found');
        return null;
      }

      console.log(`Found ${abandonedJobsSnapshot.size} abandoned jobs to delete`);

      // Delete abandoned jobs in batch
      const batch = admin.firestore().batch();
      const deletedJobIds = [];

      abandonedJobsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedJobIds.push(doc.id);
        console.log(`Deleting abandoned job: ${doc.id}`);
      });

      await batch.commit();

      console.log(`✅ Successfully deleted ${deletedJobIds.length} abandoned jobs`);
      console.log('Deleted job IDs:', deletedJobIds);

      return {
        success: true,
        deletedCount: deletedJobIds.length,
        deletedJobIds: deletedJobIds
      };
    } catch (error) {
      console.error('❌ Error cleaning up abandoned jobs:', error);
      throw error;
    }
  });
```

---

## Job Status Lifecycle with Cleanup

```
Customer fills form
  ↓
Job created with status: 'awaiting_payment'
  ↓
  ├─→ [Payment completed within 30 min]
  │     ↓
  │   Status → 'pending'
  │     ↓
  │   Job visible to handymen ✅
  │
  └─→ [Payment not completed after 30 min]
        ↓
      Cleanup function runs (hourly)
        ↓
      Job deleted from database 🗑️
```

---

## Configuration

### Schedule Configuration

The schedule can be modified in the function definition:

```javascript
// Current: Every 1 hour
.schedule('every 1 hours')

// Other options:
.schedule('every 30 minutes')  // More frequent cleanup
.schedule('every 2 hours')     // Less frequent
.schedule('0 */3 * * *')       // Every 3 hours (cron syntax)
```

### Timeout Configuration

The 30-minute threshold can be adjusted:

```javascript
// Current: 30 minutes
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

// Examples:
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);  // 15 min
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);         // 1 hour
```

### Timezone

Currently set to Singapore time zone:

```javascript
.timeZone('Asia/Singapore')

// Other options:
.timeZone('UTC')
.timeZone('America/New_York')
```

---

## Monitoring & Logs

### Viewing Logs

**Firebase Console:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Functions** → **Logs**
4. Filter by function name: `cleanupAbandonedJobs`

**Firebase CLI:**
```bash
# View recent logs
firebase functions:log

# Tail logs in real-time
firebase functions:log --only cleanupAbandonedJobs
```

### Log Messages

| Log Message | Meaning |
|-------------|---------|
| `🧹 Starting cleanup of abandoned jobs...` | Function started |
| `✅ No abandoned jobs found` | No jobs to clean up (good!) |
| `Found X abandoned jobs to delete` | X jobs will be deleted |
| `Deleting abandoned job: {jobId}` | Specific job being deleted |
| `✅ Successfully deleted X abandoned jobs` | Cleanup completed |
| `❌ Error cleaning up abandoned jobs:` | Something went wrong |

### Expected Behavior

**Normal Operation:**
- Runs every hour automatically
- Usually finds 0-5 abandoned jobs per run
- Logs success message
- Returns within 1-2 seconds

**High Abandonment Rate (Investigation Needed):**
- If consistently finding >10 jobs per run
- May indicate payment flow issues
- Check for:
  - Payment gateway errors
  - UI/UX issues in payment form
  - Browser compatibility problems

---

## Testing

### Manual Testing

**Test the function locally:**

```bash
# Install Firebase Functions Shell
npm install -g firebase-tools

# Start Functions Shell
firebase functions:shell

# Run the function manually
cleanupAbandonedJobs()
```

### Create Test Data

**Create an abandoned job for testing:**

1. **Via Frontend:**
   - Start job creation flow
   - Fill out form
   - Don't complete payment
   - Wait 30+ minutes
   - Check if cleaned up on next hourly run

2. **Via Firestore Console:**
   ```javascript
   // Manually create test job
   {
     customerId: "test_customer_123",
     serviceType: "Plumbing",
     status: "awaiting_payment",
     createdAt: "2025-12-11T10:00:00.000Z",  // 2+ hours ago
     // ... other fields
   }
   ```

3. **Verify Deletion:**
   - Wait for next scheduled run (or trigger manually)
   - Check Firestore - job should be deleted
   - Check function logs for confirmation

---

## Performance Considerations

### Database Impact

- **Read Operations:** 1 query per run (filtered by status and timestamp)
- **Write Operations:** 1 batched delete (up to 500 docs per batch)
- **Cost:** Minimal (usually 0-10 documents affected)

### Optimization

Current implementation is already optimized:
- ✅ Uses indexed queries (`status`, `createdAt`)
- ✅ Batched deletes (efficient)
- ✅ Early return if no jobs found

**If scaling to high volume:**
- Consider adjusting schedule frequency
- Add pagination for very large result sets
- Implement rate limiting

---

## Firestore Indexes Required

The function requires a composite index:

```json
{
  "collectionGroup": "jobs",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "createdAt",
      "order": "ASCENDING"
    }
  ]
}
```

**This index should be automatically created when you deploy the function.**

If you see an index error in logs:
1. Click the error link to create the index
2. Or manually create in Firestore Console → Indexes

---

## Deployment

### Deploy the Function

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy only this function
firebase deploy --only functions:cleanupAbandonedJobs
```

### Verify Deployment

```bash
# List all deployed functions
firebase functions:list

# Should show: cleanupAbandonedJobs [✓ Deployed]
```

### Check Schedule

After deployment, verify the schedule is active:
1. Go to [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler)
2. Look for job named: `firebase-schedule-cleanupAbandonedJobs-*`
3. Status should be **Enabled**

---

## Troubleshooting

### Function Not Running

**Check Cloud Scheduler:**
```bash
# View scheduled jobs
gcloud scheduler jobs list

# Manually trigger a run
gcloud scheduler jobs run firebase-schedule-cleanupAbandonedJobs-{region}
```

**Common Issues:**
- Function not deployed: `firebase deploy --only functions`
- Scheduler disabled: Enable in Cloud Scheduler Console
- Billing not enabled: Enable billing in Google Cloud Console

### Jobs Not Being Deleted

**Possible Causes:**

1. **Status Mismatch**
   - Jobs might have different status value
   - Check actual status in Firestore
   - Update query if needed

2. **Timestamp Format**
   - Verify `createdAt` is ISO string format
   - Check timezone issues

3. **Index Missing**
   - Deploy function to auto-create index
   - Or manually create in Firestore Console

### High Error Rate

**Investigation Steps:**

1. **Check logs for error details:**
   ```bash
   firebase functions:log --only cleanupAbandonedJobs
   ```

2. **Common errors:**
   - Permission denied → Check Firestore rules
   - Index not found → Create composite index
   - Timeout → Reduce batch size

---

## Future Enhancements

### Potential Improvements

1. **Notification Before Deletion**
   - Send email reminder 15 min before deletion
   - Give customer chance to complete payment

2. **Soft Delete**
   - Move to `abandoned_jobs` collection instead of deleting
   - Keep for analytics/debugging
   - Permanent delete after 30 days

3. **Analytics**
   - Track abandonment rate
   - Identify common abandonment points
   - A/B test payment flow improvements

4. **Configurable Timeout**
   - Store timeout value in Firestore config
   - Allow admin to adjust without redeploying
   - Different timeouts for different service types

---

## Related Documentation

- [Job Creation Flow](./job-creation-flow.md)
- [Stripe Payment Integration](./stripe-payment.md)
- [Firebase Functions Setup](../setup/firebase-setup.md)

---

**Last Updated:** 2025-12-11
**Status:** ✅ Deployed and Active
**Next Review:** Monthly (check abandonment metrics)
