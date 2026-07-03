// services/mfa.service.js
//
// TOTP MFA implementation using otplib (RFC 6238 compliant).
// Replaces the placeholder "accept any 6-digit code" foundation.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const User = require('../models/User');
const { NotFoundError, ValidationError } = require('../utils/errors');

const ISSUER = 'DrinksHarbour';

/**
 * Generate a new TOTP secret (Base32, RFC 4648) using otplib.
 */
const generateTotpSecret = () => otplib.generateSecret();

/**
 * Build the otpauth:// URL for QR code generators (Google Authenticator, Authy, etc.)
 * Format: otpauth://totp/DrinksHarbour:user@example.com?secret=...&issuer=DrinksHarbour
 */
const buildOtpauthUrl = (secret, userEmail, issuer = ISSUER) =>
  otplib.generateURI({
    secret,
    strategy: 'totp',
    label: userEmail,
    issuer,
  });

/**
 * Verify a TOTP code against a secret using otplib (RFC 6238).
 * Allows a ±1 time-step window to tolerate clock drift.
 */
const verifyTotp = (secret, code) => {
  if (!secret || !/^\d{6}$/.test(code)) return false;
  const result = otplib.verifySync({ token: code, secret, strategy: 'totp' });
  return !!(result && result.valid);
};

/**
 * Enable MFA for a user.
 * 1. Generate a new TOTP secret
 * 2. Store it on the user (mfaEnabled stays false until verified)
 * 3. Return the secret + otpauth URL for the client to display as a QR code
 * 4. Client scans QR, enters a verification code → calls verifyMfaSetup()
 */
const enableMfa = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  if (user.mfaEnabled) {
    throw new ValidationError('MFA is already enabled for this account');
  }

  const secret = generateTotpSecret();
  user.mfaSecret = secret;
  user.mfaMethod = 'totp';
  // mfaEnabled stays false until the user verifies they can generate codes
  await user.save();

  const otpauthUrl = buildOtpauthUrl(secret, user.email);

  return {
    secret,
    otpauthUrl,
    message: 'Scan the QR code with your authenticator app, then verify with a code.',
  };
};

/**
 * Verify MFA setup — called after the user scans the QR code and enters a TOTP code.
 * If the code matches (real otplib verification), set mfaEnabled = true and
 * generate 8 one-time backup codes.
 */
const verifyMfaSetup = async (userId, code) => {
  const user = await User.findById(userId).select('+mfaSecret');
  if (!user) throw new NotFoundError('User not found');

  if (!user.mfaSecret) {
    throw new ValidationError('MFA setup not initiated. Call enableMfa first.');
  }

  if (user.mfaEnabled) {
    throw new ValidationError('MFA is already enabled');
  }

  if (!verifyTotp(user.mfaSecret, code)) {
    throw new ValidationError('Invalid verification code. Please try again.');
  }

  user.mfaEnabled = true;
  user.mfaEnabledAt = new Date();

  // Generate 8 one-time backup codes (8-char hex, uppercase)
  user.mfaBackupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  await user.save();

  return {
    message: 'MFA enabled successfully. Save your backup codes — you will need them if you lose access to your authenticator app.',
    backupCodes: user.mfaBackupCodes,
  };
};

/**
 * Disable MFA for a user.
 * Requires the current TOTP code or a backup code to prevent accidental lockout.
 */
const disableMfa = async (userId, code) => {
  const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
  if (!user) throw new NotFoundError('User not found');

  if (!user.mfaEnabled) {
    throw new ValidationError('MFA is not enabled for this account');
  }

  // Accept either a TOTP code or a backup code
  const isTotpValid = verifyTotp(user.mfaSecret, code);
  const backupIndex = user.mfaBackupCodes.findIndex(
    (c) => c.toUpperCase() === code.toUpperCase()
  );

  if (!isTotpValid && backupIndex === -1) {
    throw new ValidationError('Invalid verification code. Please try again.');
  }

  // Consume the backup code if that's what was used
  if (backupIndex !== -1) {
    user.mfaBackupCodes.splice(backupIndex, 1);
  }

  user.mfaEnabled = false;
  user.mfaMethod = 'none';
  user.mfaSecret = undefined;
  user.mfaBackupCodes = [];
  user.mfaEnabledAt = undefined;
  await user.save();

  return { message: 'MFA disabled successfully' };
};

/**
 * Verify a TOTP/backup code for a login MFA challenge.
 * Does NOT modify the user record (the login flow handles session issuance).
 * Returns the backup code index consumed, or -1 if a TOTP code was used.
 */
const verifyLoginMfa = async (userId, code) => {
  const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
  if (!user) throw new NotFoundError('User not found');

  if (!user.mfaEnabled) {
    throw new ValidationError('MFA is not enabled for this account');
  }

  // Try TOTP first
  if (verifyTotp(user.mfaSecret, code)) {
    return { method: 'totp' };
  }

  // Then try a backup code
  const backupIndex = user.mfaBackupCodes.findIndex(
    (c) => c.toUpperCase() === code.toUpperCase()
  );
  if (backupIndex !== -1) {
    // Consume the backup code
    user.mfaBackupCodes.splice(backupIndex, 1);
    await user.save();
    return { method: 'backup' };
  }

  throw new ValidationError('Invalid MFA code. Please try again.');
};

/**
 * Issue a short-lived MFA-verified JWT.
 * The client sends this as the Bearer token to MFA-protected routes.
 * Expires in 10 minutes. Payload: { userId, type: 'mfa', jti }.
 */
const generateMfaVerifiedToken = (userId) => {
  const payload = {
    userId,
    type: 'mfa',
    jti: crypto.randomUUID(),
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });
};

/**
 * Verify an MFA-verified JWT.
 * Returns the decoded payload if valid and of type 'mfa', else null.
 */
const verifyMfaVerifiedToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.type === 'mfa' && decoded.userId) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
};

module.exports = {
  generateTotpSecret,
  buildOtpauthUrl,
  verifyTotp,
  enableMfa,
  verifyMfaSetup,
  disableMfa,
  verifyLoginMfa,
  generateMfaVerifiedToken,
  verifyMfaVerifiedToken,
};