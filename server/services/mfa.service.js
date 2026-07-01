// services/mfa.service.js
const crypto = require('crypto');
const User = require('../models/User');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');

/**
 * Generate a new TOTP secret for a user (Base32-encoded).
 * Returns the secret + otpauth URL for QR code display.
 *
 * NOTE: This is a foundation. For production use, integrate with a library
 * like `otplib` or `speakeasy` for proper TOTP RFC 6238 compliance.
 * The secret here is a random 32-byte buffer encoded as base32.
 */
const generateTotpSecret = () => {
  const buffer = crypto.randomBytes(20);
  // Base32 encoding (RFC 4648)
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      secret += base32Chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    secret += base32Chars[(value << (5 - bits)) & 31];
  }
  return secret;
};

/**
 * Build the otpauth:// URL for QR code generators (Google Authenticator, Authy, etc.)
 */
const buildOtpauthUrl = (secret, userEmail, issuer = 'DrinksHarbour') => {
  const label = encodeURIComponent(`${issuer}:${userEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

/**
 * Enable MFA for a user.
 * Steps:
 * 1. Generate a new TOTP secret
 * 2. Store it on the user (mfaEnabled stays false until verified)
 * 3. Return the secret + otpauth URL for the client to display as QR code
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
 * If the code matches (placeholder: real TOTP verification needs otplib/speakeasy),
 * set mfaEnabled = true and generate backup codes.
 *
 * TODO: Replace the placeholder verification with a proper TOTP implementation.
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

  // ── Placeholder verification ───────────────────────────────────────────────
  // In production, use otplib.authenticator.verify({ token: code, secret: user.mfaSecret })
  // For now, accept any 6-digit code (foundation only — replace before production!)
  if (!/^\d{6}$/.test(code)) {
    throw new ValidationError('Invalid verification code. Must be 6 digits.');
  }

  user.mfaEnabled = true;
  user.mfaEnabledAt = new Date();

  // Generate 8 one-time backup codes
  user.mfaBackupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  await user.save();

  return {
    message: 'MFA enabled successfully',
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

  // ── Placeholder: verify code (replace with otplib in production) ──────────
  if (!/^\d{6}$/.test(code)) {
    throw new ValidationError('Invalid verification code');
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
 * Verify a TOTP code (for login MFA challenge).
 * Placeholder — replace with otplib.authenticator.verify in production.
 */
const verifyTotp = (secret, code) => {
  // Foundation: accept any 6-digit code. TODO: implement real TOTP.
  return /^\d{6}$/.test(code);
};

module.exports = {
  generateTotpSecret,
  buildOtpauthUrl,
  enableMfa,
  verifyMfaSetup,
  disableMfa,
  verifyTotp,
};