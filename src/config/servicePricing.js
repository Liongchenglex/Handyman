/**
 * Service Pricing Configuration
 *
 * This file contains the pricing information for all service types.
 * Update prices here to reflect across the entire application.
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
 * Platform fee charged on top of service fee
 * This is a flat fee added to all services
 */
export const PLATFORM_FEE = 5;

/**
 * Get the price for a specific service type
 * @param {string} serviceType - The service type
 * @returns {number} The price for the service, or 120 as default
 */
export const getServicePrice = (serviceType) => {
  return SERVICE_PRICING[serviceType] || 120;
};

/**
 * Get the total amount including platform fee
 * @param {string} serviceType - The service type
 * @returns {number} The total amount (service price + platform fee)
 */
export const getTotalAmount = (serviceType) => {
  const servicePrice = getServicePrice(serviceType);
  return servicePrice + PLATFORM_FEE;
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
