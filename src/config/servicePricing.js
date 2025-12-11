/**
 * Service Pricing Configuration
 *
 * This file contains the pricing information for all service types.
 * Update prices here to reflect across the entire application.
 *
 * All prices are in SGD (Singapore Dollars).
 *
 * Platform fee is configurable via environment variable REACT_APP_PLATFORM_FEE_PERCENTAGE
 * Set as decimal (e.g., 0.10 for 10%, 0.05 for 5%)
 * Defaults to 10% if not specified.
 */

export const SERVICE_PRICING = {
  'Plumbing': 120,
  'Electrical': 150,
  'Carpentry': 180,
  'Appliance Repair': 100,
  'Painting': 200,
  'General handyman': 100
};

/**
 * Platform fee percentage configuration
 * Configurable via REACT_APP_PLATFORM_FEE_PERCENTAGE environment variable
 * Examples:
 * - 0.10 = 10%
 * - 0.05 = 5%
 * - 0.15 = 15%
 */
export const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.REACT_APP_PLATFORM_FEE_PERCENTAGE) || 0.10;

/**
 * Get the price for a specific service type
 * @param {string} serviceType - The service type
 * @returns {number} The price for the service, or 120 as default
 */
export const getServicePrice = (serviceType) => {
  return SERVICE_PRICING[serviceType] || 120;
};

/**
 * Calculate the platform fee as percentage of service price
 * Uses configurable PLATFORM_FEE_PERCENTAGE
 *
 * @param {string|number} serviceTypeOrPrice - The service type or price
 * @returns {number} The platform fee amount
 */
export const getPlatformFee = (serviceTypeOrPrice) => {
  const servicePrice = typeof serviceTypeOrPrice === 'string'
    ? getServicePrice(serviceTypeOrPrice)
    : serviceTypeOrPrice;

  return servicePrice * PLATFORM_FEE_PERCENTAGE;
};

/**
 * Get the total amount including platform fee
 * @param {string|number} serviceTypeOrPrice - The service type or price
 * @returns {number} The total amount (service price + platform fee)
 */
export const getTotalAmount = (serviceTypeOrPrice) => {
  const servicePrice = typeof serviceTypeOrPrice === 'string'
    ? getServicePrice(serviceTypeOrPrice)
    : serviceTypeOrPrice;
  const platformFee = getPlatformFee(servicePrice);
  return servicePrice + platformFee;
};

/**
 * Get all service types with their prices
 * @returns {Array} Array of objects containing service type and price
 */
export const getServiceTypes = () => {
  return Object.entries(SERVICE_PRICING).map(([type, price]) => ({
    type,
    price
  }));
};
