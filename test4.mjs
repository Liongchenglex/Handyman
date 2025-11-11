import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { calculateSplits, STRIPE_CONFIG } from './src/services/stripe/config.mjs';

console.log('\n🧪 Testing Payment Splits Calculation\n');
console.log('================================\n');

// Test different service fee amounts
const testAmounts = [100, 120, 150, 200, 500];

console.log('Split Configuration:');
console.log('  Cofounder: ' + (STRIPE_CONFIG.splits.cofounder * 100) + '%');
console.log('  Operator: ' + (STRIPE_CONFIG.splits.operator * 100) + '%');
console.log('  Handyman: ' + (STRIPE_CONFIG.splits.handyman * 100) + '%');
console.log('\n================================\n');

let allTestsPassed = true;

for (const amount of testAmounts) {
  console.log(`Testing with service fee: $${amount}`);

  const splits = calculateSplits(amount);

  console.log('  Cofounder: $' + splits.cofounder);
  console.log('  Operator: $' + splits.operator);
  console.log('  Handyman: $' + splits.handyman);
  console.log('  Total: $' + splits.total);

  // Verify totals match
  const calculatedTotal = splits.cofounder + splits.operator + splits.handyman;
  const totalsMatch = calculatedTotal === amount && splits.total === amount;

  console.log('  Totals Match: ' + (totalsMatch ? '✅' : '❌'));

  // Verify approximate percentages (allowing for rounding)
  const cofounderPercent = (splits.cofounder / amount) * 100;
  const operatorPercent = (splits.operator / amount) * 100;
  const handymanPercent = (splits.handyman / amount) * 100;

  console.log('  Actual Percentages: ' + cofounderPercent.toFixed(1) + '% / ' +
              operatorPercent.toFixed(1) + '% / ' + handymanPercent.toFixed(1) + '%');

  if (!totalsMatch) {
    console.log('  ❌ ERROR: Split amounts do not add up to original amount!');
    allTestsPassed = false;
  }

  console.log('');
}

console.log('================================');
if (allTestsPassed) {
  console.log('✅ All payment split tests passed!\n');
} else {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
}
