/**
 * Service Pricing Configuration
 *
 * This file contains the pricing information for all service types.
 * Update prices here to reflect across the entire application.
 * *you can simply add to thise SERVICEPRICing
 *
 * All prices are in SGD (Singapore Dollars).
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
 * Platform fee percentage (10% of service fee)
 */
export const PLATFORM_FEE_PERCENTAGE = 0.10;

/**
 * Get the price for a specific service type
 * @param {string} serviceType - The service type
 * @returns {number} The price for the service, or 120 as default
 */
export const getServicePrice = (serviceType) => {
  return SERVICE_PRICING[serviceType] || 120;
};

/**
 * Calculate the platform fee (10% of service price)
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
 * @param {string} serviceType - The service type
 * @returns {number} The total amount (service price + platform fee)
 */
export const getTotalAmount = (serviceType) => {
  const servicePrice = getServicePrice(serviceType);
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
