// middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');
const { resolveTenantContext } = require('./tenant.middleware');

// super_admin has all tenant_owner privileges
const TENANT_OWNER_ROLES = ['super_admin', 'admin', 'tenant_owner'];

/**
 * Protect routes - verifies JWT and attaches user to req
 * Alias: authenticate
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Optional: also allow token in cookie for web clients
  // else if (req.cookies?.token) { token = req.cookies.token; }

  if (!token) {
    throw new UnauthorizedError('Not authorized - no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user (lean + select minimal fields + passwordChangedAt for token invalidation)
    // JWT payload uses userId, not id
    const userId = decoded.userId || decoded.id;
    req.user = await User.findById(userId)
      .select('_id email role tenant status firstName lastName passwordChangedAt mfaEnabled')
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

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // JWT payload uses userId, not id
    const userId = decoded.userId || decoded.id;
    req.user = await User.findById(userId)
      .select('_id email role tenant status firstName lastName passwordChangedAt')
      .lean();

    // Invalidate JWTs issued before a password change (same as protect)
    if (req.user?.passwordChangedAt && decoded.iat) {
      const passwordChangedTimestamp = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < passwordChangedTimestamp) {
        // Token is stale — treat as guest (don't attach user)
        req.user = null;
      }
    }

    next();
  } catch (error) {
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
 * Require tenant context (use after attachTenant)
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required for this operation');
  }

  if (req.tenant.status !== 'approved') {
    throw new ForbiddenError('Tenant account is not approved');
  }

  if (!['active', 'trialing'].includes(req.tenant.subscriptionStatus)) {
    throw new ForbiddenError('Tenant subscription is not active');
  }

  next();
};

/**
 * Super-admin only
 */
const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    throw new ForbiddenError('Super-admin access required');
  }
  next();
};

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

/**
 * Authorize by role(s) - allows multiple roles
 * @param {...string} roles - Roles to allow
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authorized - no user found');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

module.exports = {
  protect,
  authenticate,
  authorize,
  attachTenant,
  requireTenant,
  superAdminOnly,
  tenantAdminOnly,
  tenantAdminOrSuperAdmin,
  tenantUserOnly,
  optionalProtect,
};