// utils/cookies.js
//
// Centralized auth-cookie helpers.
//
// Access token  → dh_access  (httpOnly, SameSite=Strict, path=/, 7d)
// Refresh token → dh_refresh (httpOnly, SameSite=Strict, path=/api/users, 30d)
// CSRF token    → dh_csrf    (NOT httpOnly, SameSite=Strict, path=/, session)
//
// In production (NODE_ENV=production) cookies are Secure=true.
// In dev, Secure is false so cookies work over http://localhost.

const COOKIE_NAMES = {
  access:  'dh_access',
  refresh: 'dh_refresh',
  csrf:    'dh_csrf',
  mfa:     'dh_mfa',
};

const isProd = process.env.NODE_ENV === 'production';

const ACCESS_MAX_MS  = 7  * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_MAX_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Set auth cookies on the response after a successful login/register/refresh/MFA.
 */
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(COOKIE_NAMES.access, accessToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'strict',
    path:     '/',
    maxAge:   ACCESS_MAX_MS,
  });
  res.cookie(COOKIE_NAMES.refresh, refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'strict',
    path:     '/api/users', // only sent on /api/users/* requests
    maxAge:   REFRESH_MAX_MS,
  });
}

/**
 * Set the CSRF double-submit token cookie.
 * This cookie is NOT httpOnly (the frontend JS must read it to send the matching header).
 * Value is a random hex string.
 */
function setCsrfCookie(res, csrfToken) {
  res.cookie(COOKIE_NAMES.csrf, csrfToken, {
    httpOnly: false,
    secure:   isProd,
    sameSite: 'strict',
    path:     '/',
    maxAge:   ACCESS_MAX_MS, // same lifetime as the access token
  });
}

/**
 * Generate a random CSRF token (32-byte hex).
 */
function generateCsrfToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Set the MFA-verified cookie (short-lived, 10 min).
 * httpOnly so JS can't read it; the middleware reads it server-side.
 */
function setMfaCookie(res, mfaToken) {
  res.cookie(COOKIE_NAMES.mfa, mfaToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'strict',
    path:     '/',
    maxAge:   10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Clear all auth cookies (used on logout).
 */
function clearAuthCookies(res) {
  [COOKIE_NAMES.access, COOKIE_NAMES.refresh, COOKIE_NAMES.csrf, COOKIE_NAMES.mfa].forEach((name) => {
    res.clearCookie(name, {
      httpOnly: name !== COOKIE_NAMES.csrf,
      secure:   isProd,
      sameSite: 'strict',
      path:     name === COOKIE_NAMES.refresh ? '/api/users' : '/',
    });
  });
}

module.exports = {
  COOKIE_NAMES,
  setAuthCookies,
  setCsrfCookie,
  setMfaCookie,
  generateCsrfToken,
  clearAuthCookies,
};