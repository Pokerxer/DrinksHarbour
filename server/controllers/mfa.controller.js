// controllers/mfa.controller.js
//
// Thin pass-through to mfa.service for the MFA HTTP endpoints.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const mfaService = require('../services/mfa.service');
const { setAuthCookies, setCsrfCookie, setMfaCookie, generateCsrfToken } = require('../utils/cookies');

/**
 * @desc    Start MFA setup — generate TOTP secret + QR otpauth URL
 * @route   POST /api/users/mfa/enable
 * @access  Private
 */
exports.enableMfa = asyncHandler(async (req, res) => {
  const result = await mfaService.enableMfa(req.user._id);
  successResponse(res, result, 'MFA setup initiated');
});

/**
 * @desc    Verify MFA setup — confirm the user can generate codes, enable MFA
 * @route   POST /api/users/mfa/verify-setup
 * @access  Private
 */
exports.verifyMfaSetup = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Please provide the verification code' });
  }
  const result = await mfaService.verifyMfaSetup(req.user._id, code);
  successResponse(res, result, 'MFA enabled');
});

/**
 * @desc    Disable MFA — requires current TOTP or backup code
 * @route   POST /api/users/mfa/disable
 * @access  Private
 */
exports.disableMfa = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Please provide the verification code' });
  }
  const result = await mfaService.disableMfa(req.user._id, code);
  successResponse(res, result, 'MFA disabled');
});

/**
 * @desc    Verify MFA challenge at login — accept TOTP/backup code, issue mfa-verified token
 * @route   POST /api/users/mfa/verify
 * @access  Public (uses pending-mfa token in body to identify the user)
 */
exports.verifyLoginMfa = asyncHandler(async (req, res) => {
  const { pendingMfaToken, code } = req.body;
  if (!pendingMfaToken || !code) {
    return res.status(400).json({
      success: false,
      message: 'Please provide the pending MFA token and verification code',
    });
  }

  // Verify the pending-mfa token (issued by loginUser when MFA is required)
  const jwt = require('jsonwebtoken');
  let userId;
  try {
    const decoded = jwt.verify(pendingMfaToken, process.env.JWT_SECRET);
    if (decoded.type !== 'pending_mfa' || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Invalid or expired MFA session' });
    }
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ success: false, message: 'MFA session expired. Please log in again.' });
  }

  // Verify the TOTP/backup code
  const result = await mfaService.verifyLoginMfa(userId, code);

  // Issue a full access + refresh token (the user is now fully authenticated)
  const userService = require('../services/user.service');
  const authResult = await userService.completeMfaLogin(userId, {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Set auth cookies for the now-fully-authenticated session
  if (authResult.token) {
    setAuthCookies(res, authResult.token, authResult.refreshToken || '');
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
  }

  successResponse(res, authResult, 'MFA verification successful');
});