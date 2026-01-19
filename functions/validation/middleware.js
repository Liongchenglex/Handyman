/**
 * Validation Middleware for Cloud Functions
 *
 * Provides validation utilities using Joi schemas
 */

/**
 * Validate data against a Joi schema
 *
 * @param {Object} schema - Joi schema to validate against
 * @returns {Function} Validation function that returns sanitized data
 * @throws {Error} If validation fails
 */
const validate = (schema) => {
  return (data) => {
    const { error, value } = schema.validate(data, {
      abortEarly: false,     // Return all errors, not just the first
      stripUnknown: true,    // Remove unknown fields
      convert: true          // Convert values to correct types
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }

    return value; // Return sanitized data
  };
};

module.exports = { validate };
