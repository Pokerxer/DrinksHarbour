// services/verification.service.js
const crypto = require('crypto');

// In-memory store for verification codes (use Redis in production)
const verificationStore = new Map();

/**
 * Generate a 6-digit verification code
 * @returns {string} 6-digit code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store verification code for email
 * @param {string} email - User email
 * @param {string} code - Verification code
 * @param {object} userData - Temporary user data
 */
const storeVerificationCode = (email, code, userData = null) => {
  const key = email.toLowerCase();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  verificationStore.set(key, {
    code,
    userData,
    expiresAt,
    attempts: 0,
  });
  
  // Auto-cleanup after expiration
  setTimeout(() => {
    verificationStore.delete(key);
  }, 10 * 60 * 1000);
};

/**
 * Verify code for email
 * @param {string} email - User email
 * @param {string} code - Verification code
 * @returns {object|null} User data if verified, null otherwise
 */
const verifyCode = (email, code) => {
  const key = email.toLowerCase();
  const record = verificationStore.get(key);
  
  if (!record) {
    return { valid: false, message: 'Verification code expired. Please request a new one.' };
  }
  
  if (record.expiresAt < Date.now()) {
    verificationStore.delete(key);
    return { valid: false, message: 'Verification code expired. Please request a new one.' };
  }
  
  // Max 3 attempts
  if (record.attempts >= 3) {
    verificationStore.delete(key);
    return { valid: false, message: 'Too many failed attempts. Please request a new code.' };
  }
  
  if (record.code !== code) {
    record.attempts += 1;
    return { valid: false, message: `Invalid code. ${3 - record.attempts} attempts remaining.` };
  }
  
  // Code verified - clean up and return user data
  const userData = record.userData;
  verificationStore.delete(key);
  
  return { valid: true, userData };
};

/**
 * Get pending verification data
 * @param {string} email - User email
 * @returns {object|null} Verification record
 */
const getVerificationData = (email) => {
  return verificationStore.get(email.toLowerCase()) || null;
};

/**
 * Check if email has pending verification
 * @param {string} email - User email
 * @returns {boolean}
 */
const hasPendingVerification = (email) => {
  const record = verificationStore.get(email.toLowerCase());
  return record && record.expiresAt > Date.now();
};

/**
 * Resend verification code
 * @param {string} email - User email
 * @returns {object} New code info
 */
const resendVerificationCode = (email) => {
  const key = email.toLowerCase();
  const record = verificationStore.get(key);
  
  if (!record) {
    return { success: false, message: 'No pending verification found. Please register again.' };
  }
  
  // Generate new code
  const newCode = generateVerificationCode();
  record.code = newCode;
  record.expiresAt = Date.now() + 10 * 60 * 1000; // Reset to 10 minutes
  record.attempts = 0;
  
  return { success: true, code: newCode };
};

module.exports = {
  generateVerificationCode,
  storeVerificationCode,
  verifyCode,
  getVerificationData,
  hasPendingVerification,
  resendVerificationCode,
};
