// middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { loadCustomPermissions, TENANT_ACTION_PERMISSIONS } = require('../services/effectivePermissions.service');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');
const {
  resolveTenantContext,
  requireOwnTenant,
  requireTenant: requireTenantContext,
  allowBillingWrites,
} = require('./tenant.middleware');

/**
 * Protect routes - verifies JWT and attaches user to req
 * Alias: authenticate
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Read from Authorization: Bearer header (mobile apps, API clients)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fall back to httpOnly cookie (web clients — Phase 5 cookie migration)
  else if (req.cookies?.dh_access) {
    token = req.cookies.dh_access;
  }

  if (!token) {
    throw new UnauthorizedError('Not authorized - no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Expose the raw token + decoded payload to downstream handlers
    // (e.g. logout needs the jti to revoke the refresh-token chain)
    req.token = token;
    req.tokenPayload = decoded;

    // Attach user (lean + select minimal fields + passwordChangedAt for token invalidation)
    // JWT payload uses userId, not id
    const userId = decoded.userId || decoded.id;
    req.user = await User.findById(userId)
      .select('_id email role tenant status firstName lastName passwordChangedAt mfaEnabled customRole')
      .lean();

    if (!req.user) {
      throw new UnauthorizedError('User not found');
    }

    if (req.user.status !== 'active') {
      throw new ForbiddenError('Account is not active');
    }

    // ── Invalidate JWTs issued before a password change/reset ────────────────
    // If passwordChangedAt exists and the token was issued before it, reject.
    if (req.user.passwordChangedAt && decoded.iat) {
      const passwordChangedTimestamp = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < passwordChangedTimestamp) {
        throw new UnauthorizedError('Token invalidated by recent password change — please log in again');
      }
    }

    req.user.customPermissions = await loadCustomPermissions(req.user);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Not authorized - invalid token');
    }
    throw error;
  }
});

// Alias for consistency with route definitions
const authenticate = protect;

/**
 * Optional authentication - attaches user if token is valid, but doesn't throw if no token
 */
const optionalProtect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Also read from httpOnly cookie (web clients)
  else if (req.cookies?.dh_access) {
    token = req.cookies.dh_access;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // JWT payload uses userId, not id
    const userId = decoded.userId || decoded.id;
    req.user = await User.findById(userId)
      .select('_id email role tenant status firstName lastName passwordChangedAt customRole')
      .lean();

    if (req.user?.status !== 'active') req.user = null;
    // Invalidate JWTs issued before a password change (same as protect)
    if (req.user?.passwordChangedAt && decoded.iat) {
      const passwordChangedTimestamp = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < passwordChangedTimestamp) {
        // Token is stale — treat as guest (don't attach user)
        req.user = null;
      }
    }

    if (req.user) req.user.customPermissions = await loadCustomPermissions(req.user);
    next();
  } catch (error) {
    req.user = null;
    // If token is invalid, just proceed without user (treat as guest)
    next();
  }
});

/**
 * Tenant context middleware — resolves req.tenant from JWT authority first.
 * Delegates to the single source of truth: resolveTenantContext in tenant.middleware.js.
 * Alias kept for backward compatibility with route files that import attachTenant.
 */
const attachTenant = resolveTenantContext;

/**
 * Require tenant context (use after attachTenant).
 *
 * Was a byte-for-byte copy of the one in tenant.middleware.js, which meant the
 * dunning rule existed twice and every route file picked a copy at random by
 * where it imported from. Delegated now, so relaxing the status list for
 * past_due (and enforcing read-only in its place) applies to both.
 */
const requireTenant = requireTenantContext;

/**
 * Super-admin only
 */
const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    throw new ForbiddenError('Super-admin access required');
  }
  next();
};
superAdminOnly.authorizedRoles = ['super_admin'];

/**
 * Tenant admin / owner only (super_admin bypasses tenant check)
 */
const tenantAdminOnly = (req, res, next) => {
  if (!req.user || !['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Tenant admin access required');
  }
  // super_admin/admin bypass tenant membership check
  if (['super_admin', 'admin'].includes(req.user.role)) return next();
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }
  if (req.user.tenant?.toString() !== req.tenant._id.toString()) {
    throw new ForbiddenError('You do not belong to this tenant');
  }
  next();
};
tenantAdminOnly.authorizedRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

/**
 * Tenant admin, owner, or super admin
 * Super admins can create subproducts without tenant context (for their own use)
 * or with a tenant context (to assign to a specific tenant)
 */
const tenantAdminOrSuperAdmin = (req, res, next) => {
  // Allow super_admin and admin without requiring tenant context
  if (['super_admin', 'admin'].includes(req.user?.role)) return next();

  // Allow tenant owners and admins
  if (!req.user || !['tenant_owner', 'tenant_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Tenant admin or super admin access required');
  }
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }
  if (req.user.tenant?.toString() !== req.tenant._id.toString()) {
    throw new ForbiddenError('You do not belong to this tenant');
  }
  next();
};
tenantAdminOrSuperAdmin.authorizedRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

/**
 * Any authenticated tenant user (owner, admin, staff) — super_admin bypasses
 */
const tenantUserOnly = (req, res, next) => {
  if (['super_admin', 'admin'].includes(req.user?.role)) return next();
  if (!req.user || !['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(req.user.role)) {
    throw new ForbiddenError('Tenant user access required');
  }
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }
  if (req.user.tenant?.toString() !== req.tenant._id.toString()) {
    throw new ForbiddenError('You do not belong to this tenant');
  }
  next();
};
tenantUserOnly.authorizedRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff'];

/**
 * Authorize by role(s) - allows multiple roles
 *
 * The returned guard carries `authorizedRoles` so tests can read the enforced
 * role set off a live Express router — Express cannot otherwise reveal what a
 * closure captured. authorizedRolesMetadata.test.js proves the tag matches
 * behaviour, so it cannot drift.
 *
 * @param {...string} roles - Roles to allow
 */
const authorize = (...roles) => {
  const guard = (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authorized - no user found');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
  guard.authorizedRoles = roles;
  return guard;
};

// Opt-in only. Existing authorize/platform guards never consult custom grants.
const authorizeTenantAction = (permission, baseGuard = tenantAdminOrSuperAdmin) => {
  if (!TENANT_ACTION_PERMISSIONS.has(permission)) throw new Error('Unsupported tenant action');
  const guard = (req, res, next) => {
    const ownTenant = req.user?.tenant && req.tenant?._id &&
      String(req.user.tenant) === String(req.tenant._id);
    if (ownTenant && ['tenant_admin', 'tenant_staff'].includes(req.user.role) &&
        req.user.customPermissions?.includes(permission)) return next();
    return baseGuard(req, res, next);
  };
  guard.authorizedRoles = baseGuard.authorizedRoles;
  guard.requiredPermission = permission;
  return guard;
};

module.exports = {
  protect,
  authenticate,
  authorize,
  authorizeTenantAction,
  attachTenant,
  requireTenant,
  // Strict own-tenant gate for tenant-owned modules (POS, sales, purchases,
  // inventory). Re-exported so routers keep importing auth middleware from one
  // place; the implementation lives in tenant.middleware.js.
  requireOwnTenant,
  // Billing routes only: lets a read-only (past_due / expired-trial) tenant
  // still POST its way back to paying.
  allowBillingWrites,
  superAdminOnly,
  tenantAdminOnly,
  tenantAdminOrSuperAdmin,
  tenantUserOnly,
  optionalProtect,
};
