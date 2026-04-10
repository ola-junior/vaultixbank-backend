const { body, validationResult } = require('express-validator');

exports.validateRegistration = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Name must be between 3 and 50 characters')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

exports.validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

exports.validateTransfer = [
  body('recipientAccount')
    .notEmpty()
    .withMessage('Recipient account is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Account number must be 10 digits')
    .matches(/^[0-9]+$/)
    .withMessage('Account number must contain only numbers'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least 1 Naira')
    .custom((value) => {
      if (value > 10000000) {
        throw new Error('Amount cannot exceed 10,000,000 Naira');
      }
      return true;
    }),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
    .trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

exports.validateDepositWithdrawal = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least 1 Naira')
    .custom((value) => {
      if (value > 1000000) {
        throw new Error('Amount cannot exceed 1,000,000 Naira per transaction');
      }
      return true;
    }),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
    .trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];