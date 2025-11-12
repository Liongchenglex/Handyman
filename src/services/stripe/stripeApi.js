import axios from 'axios';

/**
 * Stripe API Service
 *
 * This file contains all API calls to Firebase Cloud Functions for Stripe operations.
 * After deploying functions, replace BASE_URL with your actual Firebase Functions URL.
 */

// Firebase Functions Base URL
const BASE_URL = 'https://us-central1-eazydone-d06cf.cloudfunctions.net';

// ===========================================
// PAYMENT FUNCTIONS
// ===========================================

/**
 * Create a payment intent for a job
 *
 * @param {Object} paymentData
 * @param {string} paymentData.jobId - Job ID
 * @param {string} paymentData.customerId - Customer Firebase UID
 * @param {string} paymentData.handymanId - Handyman Firebase UID
 * @param {number} paymentData.serviceFee - Service fee in dollars
 * @param {string} paymentData.serviceType - Type of service
 * @param {string} [paymentData.customerEmail] - Customer email (optional)
 * @returns {Promise<Object>} Payment intent with clientSecret
 */
export const createPaymentIntent = async (paymentData) => {
  try {
    const response = await axios.post(`${BASE_URL}/createPaymentIntent`, paymentData);
    return response.data;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Get payment status
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Payment status
 */
export const getPaymentStatus = async (paymentIntentId) => {
  try {
    const response = await axios.get(`${BASE_URL}/getPaymentStatus?paymentIntentId=${paymentIntentId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching payment status:', error);
    throw error;
  }
};

/**
 * Confirm and capture payment
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Captured payment result
 */
export const confirmPayment = async (paymentIntentId) => {
  try {
    const response = await axios.post(`${BASE_URL}/confirmPayment`, { paymentIntentId });
    return response.data;
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * Release escrow and split payment (10% cofounder, 10% operator, 80% handyman)
 *
 * @param {Object} releaseData
 * @param {string} releaseData.paymentIntentId - Payment intent ID
 * @param {string} releaseData.jobId - Job ID
 * @param {number} releaseData.serviceFee - Service fee in dollars
 * @param {string} releaseData.handymanAccountId - Handyman's Stripe account ID
 * @param {string} releaseData.cofounderAccountId - Cofounder's Stripe account ID
 * @param {string} releaseData.operatorAccountId - Operator's Stripe account ID
 * @returns {Promise<Object>} Transfer results
 */
export const releaseEscrowAndSplit = async (releaseData) => {
  try {
    const response = await axios.post(`${BASE_URL}/releaseEscrowAndSplit`, releaseData);
    return response.data;
  } catch (error) {
    console.error('Error releasing escrow:', error);
    throw error;
  }
};

/**
 * Refund a payment
 *
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} [reason] - Reason for refund
 * @returns {Promise<Object>} Refund result
 */
export const refundPayment = async (paymentIntentId, reason = 'requested_by_customer') => {
  try {
    const response = await axios.post(`${BASE_URL}/refundPayment`, {
      paymentIntentId,
      reason
    });
    return response.data;
  } catch (error) {
    console.error('Error refunding payment:', error);
    throw error;
  }
};

// ===========================================
// STRIPE CONNECT FUNCTIONS (for handymen)
// ===========================================

/**
 * Create a Stripe Connect account for a handyman
 *
 * @param {Object} handymanData
 * @param {string} handymanData.uid - Handyman's Firebase UID
 * @param {string} handymanData.email - Handyman's email
 * @param {string} handymanData.name - Handyman's full name
 * @param {string} [handymanData.phone] - Handyman's phone number (optional)
 * @returns {Promise<Object>} Created account with accountId
 */
export const createConnectedAccount = async (handymanData) => {
  try {
    const response = await axios.post(`${BASE_URL}/createConnectedAccount`, handymanData);
    return response.data;
  } catch (error) {
    console.error('Error creating connected account:', error);
    throw error;
  }
};

/**
 * Generate Stripe onboarding link for handyman
 *
 * @param {Object} linkData
 * @param {string} linkData.accountId - Stripe account ID
 * @param {string} linkData.refreshUrl - URL to redirect if link expires
 * @param {string} linkData.returnUrl - URL to redirect after onboarding complete
 * @returns {Promise<Object>} Onboarding link with URL
 */
export const createAccountLink = async (linkData) => {
  try {
    const response = await axios.post(`${BASE_URL}/createAccountLink`, linkData);
    return response.data;
  } catch (error) {
    console.error('Error creating account link:', error);
    throw error;
  }
};

/**
 * Get Stripe account status for handyman
 *
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<Object>} Account status
 */
export const getAccountStatus = async (accountId) => {
  try {
    const response = await axios.get(`${BASE_URL}/getAccountStatus?accountId=${accountId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching account status:', error);
    throw error;
  }
};

/**
 * Create Stripe dashboard login link for handyman
 *
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<Object>} Login link with URL
 */
export const createLoginLink = async (accountId) => {
  try {
    const response = await axios.post(`${BASE_URL}/createLoginLink`, { accountId });
    return response.data;
  } catch (error) {
    console.error('Error creating login link:', error);
    throw error;
  }
};
