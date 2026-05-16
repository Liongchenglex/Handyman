# Firestore Backups & Disaster Recovery

Authoritative source for: where Firestore data lives, how it is backed up,
how long backups are retained, and how to restore.

If you are operating this platform and have NOT confirmed backups are
running, do that today. Without a backup schedule, a single bad write
(buggy migration, accidental admin delete, ransomware on an admin
account) can wipe customer history, payment metadata, and audit logs.
Firestore has no built-in "undo".

---

## 1. What we back up

| Collection | Why it matters |
|---|---|
| `jobs` | Every job request, payment intent, status history. |
| `handymen` | Profiles, Stripe Connect account IDs, verification state. |
| `users` | Customer accounts (legacy + active). |
| `payments` | Payment records, including links to Stripe charges. |
| `notifications` | Outbound notifications log. |
| `auditLog` | Money-movement and admin actions (fund release, refund, admin grant). |
| `stripeEvents` | Webhook deduplication ledger; loss = potential double-processing on next replay. |
| `rateLimits` | Sliding-window counters. Low value; safe to skip if you want to keep export size down. |

Storage (file uploads such as handyman portfolio / job images) is a
separate concern — covered briefly in section 6.

---

## 2. Manual export (one-off)

Useful before a risky migration or as a sanity check.

```bash
# 1. Pick the project and a destination bucket. The bucket must live
#    in the same region as your Firestore database, or in a
#    multi-region location (e.g. asia, us, eur).
export PROJECT_ID="eazydone-d06cf"
export BACKUP_BUCKET="gs://${PROJECT_ID}-firestore-backups"

# 2. Create the bucket if it doesn't exist. Pick a region near your
#    Firestore database — Singapore Firestore + asia-southeast1 bucket
#    is the normal pairing for this platform.
gsutil mb -l asia-southeast1 ${BACKUP_BUCKET}

# 3. Run an export. The output_uri_prefix takes a timestamped subdir
#    so successive exports don't overwrite each other.
gcloud firestore export \
  ${BACKUP_BUCKET}/$(date -u +%Y%m%d-%H%M%S) \
  --project=${PROJECT_ID}

# 4. (Optional) Restrict to specific collections — useful for quick
#    pre-migration snapshots of only the affected data.
gcloud firestore export \
  ${BACKUP_BUCKET}/$(date -u +%Y%m%d-%H%M%S)-jobs-only \
  --collection-ids=jobs,payments,auditLog \
  --project=${PROJECT_ID}
```

The exported data lands as a directory of Firestore-specific files
(LevelDB-backed) — it's NOT human-readable JSON. Restoration uses
`gcloud firestore import` and writes back into the same or a different
project.

---

## 3. Scheduled daily export (recommended)

Run this once per project to set up an autonomous daily export.

```bash
# Service account that the scheduler will impersonate. The
# datastore.importExportAdmin and storage.admin roles are the minimum.
export PROJECT_ID="eazydone-d06cf"
export BACKUP_BUCKET="gs://${PROJECT_ID}-firestore-backups"
export SA_NAME="firestore-backup"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create ${SA_NAME} \
  --display-name="Firestore daily backup" \
  --project=${PROJECT_ID}

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.importExportAdmin"

gsutil iam ch serviceAccount:${SA_EMAIL}:roles/storage.objectAdmin ${BACKUP_BUCKET}

# Cloud Scheduler job, 02:00 SGT daily. The endpoint is the Firestore
# Admin v1 exportDocuments REST call; gcloud doesn't yet wrap this
# directly, so we POST to the API.
gcloud scheduler jobs create http firestore-daily-backup \
  --project=${PROJECT_ID} \
  --location=asia-southeast1 \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Singapore" \
  --http-method=POST \
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments" \
  --oauth-service-account-email=${SA_EMAIL} \
  --headers="Content-Type=application/json" \
  --message-body="{\"outputUriPrefix\":\"${BACKUP_BUCKET}\"}"
```

Verify after first fire:

```bash
gsutil ls -l ${BACKUP_BUCKET}/   # should see a timestamped subdir
gcloud scheduler jobs describe firestore-daily-backup --location=asia-southeast1
```

---

## 4. Retention policy

Apply a 30-day lifecycle rule to the bucket so backups self-clean:

```bash
cat > /tmp/lifecycle.json <<'JSON'
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 30 }
      }
    ]
  }
}
JSON
gsutil lifecycle set /tmp/lifecycle.json ${BACKUP_BUCKET}
```

30 days is enough to recover from a delayed-discovery incident (e.g. a
buggy migration that only surfaces a week later). If you need longer
horizons for compliance, increase the age value, and budget for the
extra storage spend — daily exports compound.

---

## 5. Restore (drill instructions)

**Important**: restoring INTO production overwrites whatever is there.
The safe pattern is to restore into a NEW Firestore database (or a
non-prod project) first, validate, and then either migrate the data
back or fail forward.

```bash
# Pick an export directory to restore from.
gsutil ls ${BACKUP_BUCKET}/    # find the snapshot you want
export RESTORE_FROM="${BACKUP_BUCKET}/20260520-020000"

# Restore into a separate (e.g. dev) project for verification.
gcloud firestore import ${RESTORE_FROM} \
  --project=eazydone-d06cf-dev

# Once verified, you can either point the app at the dev project for
# emergency operations or selectively re-import collections back into
# the live project.
```

Run a restore drill at least once per quarter. The first time you try
this should NOT be during an actual incident.

---

## 6. Cloud Storage (file uploads)

Job images, handyman portfolio, and CV-style work-experience files
live in the default Cloud Storage bucket. These are versioned at the
GCS layer only if you enable Object Versioning:

```bash
gsutil versioning set on gs://${PROJECT_ID}.firebasestorage.app
```

For belt-and-braces, you can also schedule a nightly `gsutil rsync`
into a sibling bucket. That's lower priority than the Firestore
backup because the live bucket is already replicated within its
location, and most platform recovery scenarios don't require image
restore — but if you've taken evidentiary photos for a dispute, you
want to keep them.

---

## 7. What this does NOT cover

- **Stripe-side data** (charges, transfers, refunds, Connect account
  balances). Stripe is the source of truth for actual money movement;
  this backup only restores OUR view of it. Reconciliation lives in
  the Stripe Dashboard.
- **Firebase Auth users**. These are not in Firestore. Export with
  `firebase auth:export auth-users.json --project ${PROJECT_ID}` on a
  weekly cadence if you need to rebuild the user pool.
- **Cloud Functions config / secrets**. Source of truth is the repo
  (functions/.env is intentionally not in git — keep the secrets in a
  password manager separately).

---

## 8. Verify-this-week checklist

- [ ] Bucket `gs://${PROJECT_ID}-firestore-backups` exists in the right region.
- [ ] Scheduler job `firestore-daily-backup` shows a successful run within the last 24 hours.
- [ ] Bucket has the 30-day lifecycle rule active (`gsutil lifecycle get`).
- [ ] A restore drill into a non-prod project completed in the last 90 days.
- [ ] Object Versioning is on for `gs://${PROJECT_ID}.firebasestorage.app`.
