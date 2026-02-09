import Joi from 'joi';

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

    req.body = value;
    next();
  };
};


export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') 
    .substring(0, 500); 
};