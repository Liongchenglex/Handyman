/**
 * EmailJS Configuration Test Script
 *
 * Run this to verify your EmailJS setup is correct
 * Usage: node scripts/test-emailjs.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('=================================');
console.log('EmailJS Configuration Test');
console.log('=================================\n');

// Check environment variables
console.log('Environment Variables:');
console.log('✓ SERVICE_ID:', process.env.REACT_APP_EMAILJS_SERVICE_ID || '❌ MISSING');
console.log('✓ TEMPLATE_HANDYMAN:', process.env.REACT_APP_EMAILJS_TEMPLATE_HANDYMAN || '❌ MISSING');
console.log('✓ TEMPLATE_OPERATIONS:', process.env.REACT_APP_EMAILJS_TEMPLATE_OPERATIONS || '❌ MISSING');
console.log('✓ PUBLIC_KEY:', process.env.REACT_APP_EMAILJS_PUBLIC_KEY ? '✓ Set' : '❌ MISSING');
console.log('✓ OPERATIONS_EMAIL:', process.env.REACT_APP_OPERATIONS_EMAIL || '❌ MISSING');
console.log('\n');

// Validation
const serviceId = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const templateHandyman = process.env.REACT_APP_EMAILJS_TEMPLATE_HANDYMAN;
const templateOps = process.env.REACT_APP_EMAILJS_TEMPLATE_OPERATIONS;
const publicKey = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

let hasErrors = false;

console.log('Validation:');

if (!serviceId || !serviceId.startsWith('service_')) {
  console.log('❌ SERVICE_ID must start with "service_"');
  hasErrors = true;
} else {
  console.log('✓ SERVICE_ID format is correct');
}

if (!templateHandyman || !templateHandyman.startsWith('template_')) {
  console.log('❌ TEMPLATE_HANDYMAN must start with "template_"');
  hasErrors = true;
} else {
  console.log('✓ TEMPLATE_HANDYMAN format is correct');
}

if (!templateOps || !templateOps.startsWith('template_')) {
  console.log('❌ TEMPLATE_OPERATIONS must start with "template_"');
  hasErrors = true;
} else {
  console.log('✓ TEMPLATE_OPERATIONS format is correct');
}

if (!publicKey) {
  console.log('❌ PUBLIC_KEY is missing');
  hasErrors = true;
} else {
  console.log('✓ PUBLIC_KEY is set');
}

console.log('\n');

if (hasErrors) {
  console.log('❌ Configuration has errors. Please fix them and try again.\n');
  console.log('Next steps:');
  console.log('1. Go to https://dashboard.emailjs.com/admin');
  console.log('2. Check your Email Services for Service ID');
  console.log('3. Check your Email Templates for Template IDs');
  console.log('4. Check Account → General for Public Key');
  console.log('5. Update .env.local with correct values');
} else {
  console.log('✅ All configuration looks good!\n');
  console.log('If you still get 412 errors, check these in EmailJS dashboard:');
  console.log('1. Each template has an Email Service selected (not "Auto-detect")');
  console.log('2. Template content uses {{{message_html}}} with triple braces');
  console.log('3. Your email service is connected and active');
  console.log('4. Try sending a test email from EmailJS dashboard first');
}

console.log('\n=================================\n');
