// middleware/mfa.middleware.js
//
// Enforces MFA verification for privileged roles.
//
// The MFA verification endpoint (POST /api/users/mfa/verify) issues a
// short-lived mfa-verified JWT (type: 'mfa', 10-min expiry). The client sends
// it as the x-mfa-token header on requests to MFA-protected routes.

const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const mfaService = require('../services/mfa.service');

/**
 * Require MFA verification for privileged roles.
 *
 * If the user has MFA enabled AND hasn't completed MFA verification in this
 * session (indicated by a valid x-mfa-token header), the request is rejected
 * with 403 and a clear message telling the client to complete MFA.
 *
 * Place this AFTER protect() on privileged routes.
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

  // If the user doesn't have MFA enabled, no verification needed
  if (!req.user.mfaEnabled) {
    return next();
  }

  // Check for a valid mfa-verified token in the x-mfa-token header or dh_mfa cookie
  const mfaToken = req.headers['x-mfa-token'] || req.cookies?.dh_mfa;
  if (!mfaToken) {
    throw new ForbiddenError('MFA verification required. Please complete MFA verification to access this resource.');
  }

  const decoded = mfaService.verifyMfaVerifiedToken(mfaToken);
  if (!decoded || decoded.userId !== String(req.user._id)) {
    throw new ForbiddenError('Invalid or expired MFA verification. Please re-verify.');
  }

  // MFA verified for this session
  req.mfaVerified = true;
  next();
};

module.exports = { requireMfa };