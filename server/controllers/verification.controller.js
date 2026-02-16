// controllers/verification.controller.js
const verificationService = require('../services/verification.service');
const emailService = require('../services/email.service');
const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { ValidationError, ConflictError } = require('../utils/errors');

/**
 * @desc    Send verification code to email
 * @route   POST /api/verification/send-code
 * @access  Public
 */
exports.sendVerificationCode = asyncHandler(async (req, res) => {
  const { email, firstName, lastName, password, phoneNumber } = req.body;

  if (!email || !firstName || !password) {
    throw new ValidationError('Please provide email, first name, and password');
  }

  // Check if email already exists
  const existingUser = await userService.findUserByEmail(email);
  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  // Check if there's already a pending verification
  if (verificationService.hasPendingVerification(email)) {
    throw new ValidationError('A verification code has already been sent. Please wait 1 minute before requesting a new one.');
  }

  // Generate verification code
  const code = verificationService.generateVerificationCode();

  // Store user data temporarily
  const userData = {
    email,
    firstName,
    lastName,
    password,
    phoneNumber,
  };

  verificationService.storeVerificationCode(email, code, userData);

  // Send email
  const emailResult = await emailService.sendVerificationCodeEmail({
    email,
    code,
    firstName,
  });

  if (!emailResult.success) {
    // For development, return the code in response
    if (process.env.NODE_ENV === 'development') {
      return successResponse(res, {
        email,
        code, // Only in development!
        message: 'Development mode: Email service not configured. Use this code.',
      }, 'Verification code generated (development mode)');
    }
    throw new Error('Failed to send verification email. Please try again.');
  }

  successResponse(res, {
    email,
    message: 'Verification code sent successfully. Please check your email.',
  }, 'Verification code sent');
});

/**
 * @desc    Verify code and complete registration
 * @route   POST /api/verification/verify-code
 * @access  Public
 */
exports.verifyCodeAndRegister = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    throw new ValidationError('Please provide email and verification code');
  }

  // Verify the code
  const verification = verificationService.verifyCode(email, code);

  if (!verification.valid) {
    throw new ValidationError(verification.message);
  }

  // Get user data from verification store
  const userData = verification.userData;

  if (!userData) {
    throw new ValidationError('Registration data not found. Please register again.');
  }

  // Create the user with super_admin role
  const result = await userService.registerUser({
    ...userData,
    role: 'super_admin',
    isEmailVerified: true, // Mark as verified since they used the code
  });

  successResponse(res, {
    user: result.user,
    token: result.token,
  }, 'Email verified and account created successfully');
});

/**
 * @desc    Resend verification code
 * @route   POST /api/verification/resend-code
 * @access  Public
 */
exports.resendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('Please provide email address');
  }

  const result = verificationService.resendVerificationCode(email);

  if (!result.success) {
    throw new ValidationError(result.message);
  }

  // Get stored user data to send email
  const verificationData = verificationService.getVerificationData(email);
  if (!verificationData || !verificationData.userData) {
    throw new ValidationError('Registration data not found. Please register again.');
  }

  // Send new code via email
  const emailResult = await emailService.sendVerificationCodeEmail({
    email,
    code: result.code,
    firstName: verificationData.userData.firstName,
  });

  if (!emailResult.success && process.env.NODE_ENV !== 'development') {
    throw new Error('Failed to send verification email. Please try again.');
  }

  successResponse(res, {
    email,
    code: process.env.NODE_ENV === 'development' ? result.code : undefined,
    message: 'New verification code sent. Please check your email.',
  }, 'Verification code resent');
});

/**
 * @desc    Check if email has pending verification
 * @route   GET /api/verification/status/:email
 * @access  Public
 */
exports.checkVerificationStatus = asyncHandler(async (req, res) => {
  const { email } = req.params;

  if (!email) {
    throw new ValidationError('Please provide email address');
  }

  const hasPending = verificationService.hasPendingVerification(email);

  successResponse(res, {
    email,
    hasPendingVerification: hasPending,
  }, 'Verification status retrieved');
});
