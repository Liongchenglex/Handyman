/**
 * Validation Schemas for Cloud Functions
 *
 * Uses Joi to validate all inputs to Cloud Functions
 * Prevents malicious input, injection attacks, and invalid data
 */

const Joi = require('joi');

/**
 * Payment Intent Schema
 * Validates createPaymentIntent request body
 */
exports.paymentIntentSchema = Joi.object({
  jobId: Joi.string().required().min(10).max(100)
    .description('Job ID (Firebase document ID or temporary ID)'),

  customerId: Joi.string().required().min(10).max(100)
    .description('Customer Firebase UID'),

  handymanId: Joi.string().allow(null, '').min(10).max(100)
    .description('Handyman Firebase UID (optional for new jobs)'),

  serviceFee: Joi.number().required().min(20).max(10000)
    .description('Service fee in dollars (SGD 20 - SGD 10,000)'),

  serviceType: Joi.string().required().min(3).max(100)
    .description('Type of service requested'),

  customerEmail: Joi.string().email().allow(null, '')
    .description('Customer email (optional)')
}).strict(); // Reject unknown fields

/**
 * Connected Account Schema
 * Validates createConnectedAccount request body
 */
exports.connectedAccountSchema = Joi.object({
  email: Joi.string().email().required()
    .description('Handyman email address'),

  name: Joi.string().required().min(2).max(100)
    .description('Handyman full name'),

  phone: Joi.string().pattern(/^\+65[0-9]{8}$/).allow(null, '')
    .description('Singapore phone number (+65 followed by 8 digits)'),

  uid: Joi.string().required().min(10).max(100)
    .description('Handyman Firebase UID')
}).strict();

/**
 * Account Link Schema
 * Validates createAccountLink request body
 */
exports.accountLinkSchema = Joi.object({
  accountId: Joi.string().required().pattern(/^acct_[a-zA-Z0-9]+$/)
    .description('Stripe account ID (format: acct_xxx)'),

  refreshUrl: Joi.string().uri().allow(null, '')
    .description('URL to redirect if link expires'),

  returnUrl: Joi.string().uri().allow(null, '')
    .description('URL to redirect after onboarding complete')
}).strict();

/**
 * Account ID Schema
 * Validates single accountId parameter
 */
exports.accountIdSchema = Joi.object({
  accountId: Joi.string().required().pattern(/^acct_[a-zA-Z0-9]+$/)
    .description('Stripe account ID (format: acct_xxx)')
}).strict();

/**
 * Payment Intent ID Schema
 * Validates single paymentIntentId parameter
 */
exports.paymentIntentIdSchema = Joi.object({
  paymentIntentId: Joi.string().required().pattern(/^pi_[a-zA-Z0-9]+$/)
    .description('Stripe payment intent ID (format: pi_xxx)')
}).strict();

/**
 * Escrow Release Schema
 * Validates releaseEscrowAndSplit request body
 */
exports.escrowReleaseSchema = Joi.object({
  paymentIntentId: Joi.string().required().pattern(/^pi_[a-zA-Z0-9]+$/)
    .description('Stripe payment intent ID'),

  jobId: Joi.string().required().min(10).max(100)
    .description('Job ID'),

  serviceFee: Joi.number().required().min(20).max(10000)
    .description('Service fee in dollars'),

  platformFee: Joi.number().min(0).max(1000).default(5)
    .description('Platform fee in dollars'),

  handymanAccountId: Joi.string().required().pattern(/^acct_[a-zA-Z0-9]+$/)
    .description('Handyman Stripe account ID'),

  cofounderAccountId: Joi.string().required().pattern(/^acct_[a-zA-Z0-9]+$/)
    .description('Cofounder Stripe account ID'),

  operatorAccountId: Joi.string().required().pattern(/^acct_[a-zA-Z0-9]+$/)
    .description('Operator Stripe account ID')
}).strict();

/**
 * Refund Schema
 * Validates refundPayment request body
 */
exports.refundSchema = Joi.object({
  paymentIntentId: Joi.string().required().pattern(/^pi_[a-zA-Z0-9]+$/)
    .description('Stripe payment intent ID'),

  reason: Joi.string().valid(
    'requested_by_customer',
    'duplicate',
    'fraudulent',
    'customer_service'
  ).default('requested_by_customer')
    .description('Reason for refund')
}).strict();

/**
 * Query Parameter Schemas
 */

// Account status query
exports.accountStatusQuerySchema = Joi.object({
  accountId: Joi.string().required().pattern(/^acct_[a-zA-Z0-9]+$/)
    .description('Stripe account ID')
});

// Payment status query
exports.paymentStatusQuerySchema = Joi.object({
  paymentIntentId: Joi.string().required().pattern(/^pi_[a-zA-Z0-9]+$/)
    .description('Stripe payment intent ID')
});
