/**
 * Service pricing (server side).
 *
 * MUST stay in sync with src/config/servicePricing.js. The two files
 * carry identical data because Cloud Functions cannot import from
 * src/ without a build pipeline change, and Create React App can't
 * import CommonJS from functions/ at build time. When either side
 * changes, update both — the Firestore rule and Stripe-amount layer
 * trust this table to detect under-charge attacks.
 *
 * If you find yourself editing prices in only one place, the
 * createPaymentIntent endpoint will reject the customer's checkout
 * because the client-computed amount won't match the server's.
 */

const SERVICE_PRICING = {
  'General handyman':  { min: 80,  max: 100 },
  'Appliance Repair':  { min: 90,  max: 130 },
  'Plumbing':          { min: 120, max: 160 },
  'Electrical':        { min: 130, max: 180 },
  'Carpentry':         { min: 150, max: 220 },
  'Painting':          { min: 180, max: 300 },
};

// Default fallback used when an unknown service type is requested.
// Kept identical to the frontend default so the server doesn't reject
// a job that the customer's UI thought was valid.
const DEFAULT_RANGE = { min: 120, max: 160 };

const getServicePriceRange = (serviceType) => {
  return SERVICE_PRICING[serviceType] || DEFAULT_RANGE;
};

const getServicePrice = (serviceType) => {
  return getServicePriceRange(serviceType).min;
};

const getServicePriceMax = (serviceType) => {
  return getServicePriceRange(serviceType).max;
};

const isKnownServiceType = (serviceType) => {
  return Object.prototype.hasOwnProperty.call(SERVICE_PRICING, serviceType);
};

module.exports = {
  SERVICE_PRICING,
  getServicePriceRange,
  getServicePrice,
  getServicePriceMax,
  isKnownServiceType,
};
