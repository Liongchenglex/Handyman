/**
 * Script to add handymanId field to existing jobs
 * Run with: node scripts/fix-jobs.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixJobs() {
  try {
    console.log('Fetching all jobs...');
    const jobsSnapshot = await db.collection('jobs').get();

    console.log(`Found ${jobsSnapshot.size} jobs`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of jobsSnapshot.docs) {
      const data = doc.data();

      // Check if handymanId field exists
      if (!('handymanId' in data)) {
        console.log(`Updating job ${doc.id} - adding handymanId field`);
        await doc.ref.update({
          handymanId: null
        });
        updatedCount++;
      } else {
        console.log(`Job ${doc.id} already has handymanId field - skipping`);
        skippedCount++;
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`   Updated: ${updatedCount} jobs`);
    console.log(`   Skipped: ${skippedCount} jobs`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing jobs:', error);
    process.exit(1);
  }
}

fixJobs();
