// routes/verification.routes.js
const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification.controller');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');

// Validation rules
const sendCodeValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number'),
];

const verifyCodeValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Please provide a valid 6-digit code'),
];

const resendCodeValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
];

const checkStatusValidation = [
  param('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
];

/**
 * @route   POST /api/verification/send-code
 * @desc    Send verification code to email
 * @access  Public
 */
router.post(
  '/send-code',
  sendCodeValidation,
  validate,
  verificationController.sendVerificationCode
);

/**
 * @route   POST /api/verification/verify-code
 * @desc    Verify code and complete registration
 * @access  Public
 */
router.post(
  '/verify-code',
  verifyCodeValidation,
  validate,
  verificationController.verifyCodeAndRegister
);

/**
 * @route   POST /api/verification/resend-code
 * @desc    Resend verification code
 * @access  Public
 */
router.post(
  '/resend-code',
  resendCodeValidation,
  validate,
  verificationController.resendVerificationCode
);

/**
 * @route   GET /api/verification/status/:email
 * @desc    Check verification status
 * @access  Public
 */
router.get(
  '/status/:email',
  checkStatusValidation,
  validate,
  verificationController.checkVerificationStatus
);

module.exports = router;
