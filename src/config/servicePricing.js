/**
 * Service Pricing Configuration
 *
 * Defines an estimated price RANGE (min – max) for every service type.
 *
 * Pricing Rule (platform-wide):
 *  - The platform automatically charges the LOWER bound of the range at checkout.
 *  - The handyman may request an upward adjustment ONLY after the on-site
 *    inspection, and the increase requires:
 *        • Reason (mandatory)
 *        • Updated breakdown
 *        • Customer approval
 *
 * All prices are in SGD (Singapore Dollars).
 *
 * To add or modify a service, edit SERVICE_PRICING below.
 */

export const SERVICE_PRICING = {
  'General handyman':  { min: 80,  max: 100 },
  'Appliance Repair':  { min: 90,  max: 130 },
  'Plumbing':          { min: 120, max: 160 },
  'Electrical':        { min: 130, max: 180 },
  'Carpentry':         { min: 150, max: 220 },
  'Painting':          { min: 180, max: 300 }
};

/**
 * Platform fee percentage (10% of service fee — applied to the lower bound).
 */
export const PLATFORM_FEE_PERCENTAGE = 0.10;

/**
 * Default fallback range used when an unknown service type is requested.
 */
const DEFAULT_RANGE = { min: 120, max: 160 };

/**
 * Get the full price range for a service type.
 * @param {string} serviceType
 * @returns {{ min: number, max: number }}
 */
export const getServicePriceRange = (serviceType) => {
  return SERVICE_PRICING[serviceType] || DEFAULT_RANGE;
};

/**
 * Get the price the customer is actually charged at checkout — i.e. the
 * LOWER bound of the estimated range. This is the single source of truth
 * used by Stripe and the rest of the app for the initial charge.
 *
 * @param {string} serviceType
 * @returns {number}
 */
export const getServicePrice = (serviceType) => {
  return getServicePriceRange(serviceType).min;
};

/**
 * Get the upper bound of the estimated range (display-only;
 * actual upward adjustments require customer approval after inspection).
 * @param {string} serviceType
 * @returns {number}
 */
export const getServicePriceMax = (serviceType) => {
  return getServicePriceRange(serviceType).max;
};

/**
 * Format a service's price range for display, e.g. "$80–$100".
 * @param {string} serviceType
 * @returns {string}
 */
export const formatPriceRange = (serviceType) => {
  const { min, max } = getServicePriceRange(serviceType);
  return `$${min}–$${max}`;
};

/**
 * Calculate the platform fee (10%). Accepts either a service type
 * (uses the lower bound) or a numeric price.
 * @param {string|number} serviceTypeOrPrice
 * @returns {number}
 */
export const getPlatformFee = (serviceTypeOrPrice) => {
  const servicePrice = typeof serviceTypeOrPrice === 'string'
    ? getServicePrice(serviceTypeOrPrice)
    : serviceTypeOrPrice;
  return servicePrice * PLATFORM_FEE_PERCENTAGE;
};

/**
 * Total amount charged at checkout: lower-bound service fee + platform fee.
 * @param {string} serviceType
 * @returns {number}
 */
export const getTotalAmount = (serviceType) => {
  const servicePrice = getServicePrice(serviceType);
  const platformFee = getPlatformFee(servicePrice);
  return servicePrice + platformFee;
};

/**
 * Get all service types with their price ranges.
 * @returns {Array<{ type: string, min: number, max: number }>}
 */
export const getServiceTypes = () => {
  return Object.entries(SERVICE_PRICING).map(([type, range]) => ({
    type,
    min: range.min,
    max: range.max
  }));
};
