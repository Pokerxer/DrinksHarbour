// middleware/csrf.middleware.js
//
// CSRF protection using the double-submit cookie pattern.
//
// When the user authenticates, the backend sets a `dh_csrf` cookie
// (NOT httpOnly — frontend JS must read it). The frontend reads this cookie
// and sends its value as the `x-csrf-token` header on every state-changing
// request (POST/PUT/PATCH/DELETE).
//
// This middleware compares the header against the cookie. If they match,
// the request is legitimate (same-origin). A cross-site attacker cannot
// read the cookie (SameSite=Strict + different origin) so cannot forge
// the header.
//
// Exemptions:
// - GET/HEAD/OPTIONS are safe (no CSRF check)
// - Requests with an Authorization: Bearer header are Bearer-token-authenticated
//   (POS, mobile, API clients) — they are inherently immune to CSRF because
//   the attacker cannot read the token from another origin
// - /api/pos and /api/pos-combos use their own JWT auth (not cookies) — exempt

const { UnauthorizedError } = require('../utils/errors');
const { COOKIE_NAMES } = require('../utils/cookies');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Paths that use Bearer-token auth exclusively (no cookie-based sessions)
const BEARER_ONLY_PREFIXES = ['/api/pos', '/api/pos-combos'];

function isBearerAuth(req) {
  const auth = req.headers.authorization;
  return !!auth && auth.startsWith('Bearer ') && auth.split(' ')[1]?.length > 0;
}

function isBearerOnlyPath(req) {
  return BEARER_ONLY_PREFIXES.some((p) => req.path.startsWith(p));
}

/**
 * CSRF double-submit verification.
 * Apply to all routes (or just mutation routes) AFTER cookie-parser.
 *
 * Logic:
 * 1. Safe methods (GET/HEAD/OPTIONS) → pass
 * 2. Bearer-token auth (POS, mobile, API clients) → pass (immune to CSRF)
 * 3. POS routes (own JWT auth) → pass
 * 4. No auth cookie present (public POST like login/register/reset-password)
 *    → pass (no session to forge)
 * 5. Auth cookie present but no CSRF cookie/header → reject
 * 6. CSRF cookie + header mismatch → reject
 */
const csrfProtection = (req, res, next) => {
  // Safe methods don't need CSRF checks
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Bearer-token-authenticated requests are immune to CSRF
  if (isBearerAuth(req) || isBearerOnlyPath(req)) {
    return next();
  }

  // If there's no auth cookie, this is a public request (login, register,
  // forgot-password, reset-password, verify-email) — no session to forge.
  // Only enforce CSRF when the user IS cookie-authenticated.
  const hasAuthCookie = !!req.cookies?.[COOKIE_NAMES.access];
  if (!hasAuthCookie) {
    return next();
  }

  // Cookie-authenticated request → require CSRF double-submit
  const cookieToken = req.cookies?.[COOKIE_NAMES.csrf];
  const headerToken = req.headers['x-csrf-token'];

  // Both must be present and match
  if (!cookieToken || !headerToken) {
    throw new UnauthorizedError('CSRF token missing — please refresh the page and try again.');
  }

  if (cookieToken !== headerToken) {
    throw new UnauthorizedError('CSRF token mismatch — request rejected.');
  }

  next();
};

module.exports = { csrfProtection };