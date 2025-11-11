import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { STRIPE_CONFIG, calculateSplits, areConnectedAccountsConfigured } from './src/services/stripe/config.mjs';

console.log('\n🧪 Testing Stripe Configuration\n');
console.log('================================\n');
console.log('Platform Fee: $' + STRIPE_CONFIG.platformFee);
console.log('Escrow Period: ' + STRIPE_CONFIG.escrowAutoReleaseDays + ' working days');
console.log('Payout Schedule: ' + STRIPE_CONFIG.payoutSchedule);

const { cofounder, operator, handyman } = STRIPE_CONFIG.splits;
const total = cofounder + operator + handyman;
console.log('\nSplit percentages:');
console.log('  Cofounder: ' + (cofounder * 100) + '%');
console.log('  Operator: ' + (operator * 100) + '%');
console.log('  Handyman: ' + (handyman * 100) + '%');
console.log('  Total: ' + (total * 100) + '% ' + (total === 1.0 ? '✅' : '❌'));

const splits = calculateSplits(120);
console.log('\nSplit calculation for $120:');
console.log('  Cofounder: $' + splits.cofounder);
console.log('  Operator: $' + splits.operator);
console.log('  Handyman: $' + splits.handyman);
console.log('  Total: $' + splits.total);

console.log('\nConnected accounts: ' + (areConnectedAccountsConfigured() ? 'Yes ✅' : 'No ⚠️'));
console.log('\n✅ Configuration test completed!\n');
