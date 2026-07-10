// src/middleware/validate.js
const { body, validationResult } = require('express-validator');

const signupValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('accountType')
    .optional()
    .isIn(['customer', 'provider'])
    .withMessage('Invalid account type'),
  body('companyName')
    .if(body('accountType').equals('provider'))
    .trim()
    .notEmpty()
    .withMessage('Company name is required for service providers'),
  body('serviceType')
    .if(body('accountType').equals('provider'))
    .trim()
    .notEmpty()
    .withMessage('Service type is required for service providers')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
 
};

module.exports = {
  signupValidation,
  loginValidation,
  handleValidationErrors
};