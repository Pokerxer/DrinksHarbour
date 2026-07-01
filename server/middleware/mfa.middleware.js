// middleware/mfa.middleware.js
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Require MFA verification for privileged roles.
 *
 * If the user has MFA enabled AND hasn't completed MFA verification in this
 * session (indicated by req.mfaVerified), the request is rejected with 403
 * and a clear message telling the client to complete MFA.
 *
 * Place this AFTER protect() but BEFORE tenantAdminOrSuperAdmin() on
 * super-admin-only routes.
 *
 * The actual MFA verification endpoint sets req.mfaVerified via a short-lived
 * session token (e.g. a separate JWT or a cookie flag). For now this is a
 * foundation: it checks the flag but the verification flow is a TODO.
 */
const requireMfa = (req, res, next) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Only enforce MFA for roles that have it enabled
  const PRIVILEGED_ROLES = ['super_admin', 'admin', 'tenant_owner'];
  if (!PRIVILEGED_ROLES.includes(req.user.role)) {
    return next();
  }

  // If user has MFA enabled but hasn't verified in this session
  if (req.user.mfaEnabled && !req.mfaVerified) {
    throw new ForbiddenError('MFA verification required. Please complete MFA verification to access this resource.');
  }

  next();
};

/**
 * Set MFA verified flag on the request.
 * Called by the MFA verification endpoint after successful TOTP/SMS code check.
 * In production this should set a short-lived signed cookie or session flag,
 * not just req.mfaVerified (which is per-request only).
 */
const setMfaVerified = (req) => {
  req.mfaVerified = true;
};

module.exports = { requireMfa, setMfaVerified };