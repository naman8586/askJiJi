import Joi from 'joi';

/**
 * Validation schemas for API requests
 */
export const schemas = {
  askJiji: Joi.object({
    query: Joi.string()
      .min(3)
      .max(500)
      .required()
      .trim()
      .messages({
        'string.empty': 'Query cannot be empty',
        'string.min': 'Query must be at least 3 characters long',
        'string.max': 'Query must not exceed 500 characters',
        'any.required': 'Query is required'
      }),
    userId: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'User ID must be a valid UUID'
      })
  })
};

/**
 * Middleware factory to validate request body against a schema
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 500); // Limit length
};