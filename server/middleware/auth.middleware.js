// middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Tenant = require('../models/tenant');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

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

    // Attach user (lean + select minimal fields)
    // JWT payload uses userId, not id
    const userId = decoded.userId || decoded.id;
    req.user = await User.findById(userId)
      .select('_id email role tenant status firstName lastName')
      .lean();

    if (!req.user) {
      throw new UnauthorizedError('User not found');
    }

    if (req.user.status !== 'active') {
      throw new ForbiddenError('Account is not active');
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
      .select('_id email role tenant status firstName lastName')
      .lean();

    next();
  } catch (error) {
    // If token is invalid, just proceed without user (treat as guest)
    next();
  }
});

/**
 * Tenant context middleware (renamed from tenantAuth to attachTenant)
 * Sets req.tenant based on:
 *  1. Subdomain (shopname.drinksharbour.com → slug = "shopname")
 *  2. X-Tenant-Slug header (for API calls)
 *  3. User.tenant (if user belongs to a tenant)
 *
 * Does NOT throw - just attaches tenant if available
 */
const attachTenant = asyncHandler(async (req, res, next) => {
  let tenant;

  // 1. Try subdomain (most common for tenant storefronts)
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0].toLowerCase();

  if (subdomain && subdomain !== 'www' && subdomain !== 'drinksharbour' && subdomain !== 'localhost') {
    tenant = await Tenant.findOne({ slug: subdomain })
      .select('_id name slug status subscriptionStatus revenueModel markupPercentage commissionPercentage defaultCurrency')
      .lean();

    if (tenant && (tenant.status !== 'approved' || !['active', 'trialing'].includes(tenant.subscriptionStatus))) {
      throw new ForbiddenError('Tenant account is not active');
    }
  }

  // 2. Try custom header (useful for tenant dashboard API calls)
  if (!tenant && req.headers['x-tenant-slug']) {
    const tenantSlug = req.headers['x-tenant-slug'].toLowerCase();
    tenant = await Tenant.findOne({ slug: tenantSlug })
      .select('_id name slug status subscriptionStatus revenueModel markupPercentage commissionPercentage defaultCurrency')
      .lean();
  }

  // Alternative: X-Tenant-Id header (if using IDs instead of slugs)
  if (!tenant && req.headers['x-tenant-id']) {
    tenant = await Tenant.findById(req.headers['x-tenant-id'])
      .select('_id name slug status subscriptionStatus revenueModel markupPercentage commissionPercentage defaultCurrency')
      .lean();
  }

  // 3. Fallback to user.tenant (if authenticated user belongs to tenant)
  if (!tenant && req.user?.tenant) {
    tenant = await Tenant.findById(req.user.tenant)
      .select('_id name slug status subscriptionStatus revenueModel markupPercentage commissionPercentage defaultCurrency')
      .lean();
  }

  req.tenant = tenant || null;

  next();
});

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
 * Tenant admin / owner only
 */
const tenantAdminOnly = (req, res, next) => {
  if (!req.user || !['tenant_owner', 'tenant_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Tenant admin access required');
  }
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }
  // Verify user belongs to this tenant
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
  // Allow superadmins without requiring tenant context
  if (req.user?.role === 'super_admin') {
    // For superadmins, we still try to get tenant if provided
    // but don't block if no tenant - superadmin can create for themselves
    return next();
  }
  
  // Allow tenant owners and admins
  if (!req.user || !['tenant_owner', 'tenant_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Tenant admin or super admin access required');
  }
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }
  // Verify user belongs to this tenant
  if (req.user.tenant?.toString() !== req.tenant._id.toString()) {
    throw new ForbiddenError('You do not belong to this tenant');
  }
  next();
};

/**
 * Any authenticated tenant user (owner, admin, staff)
 */
const tenantUserOnly = (req, res, next) => {
  if (!req.user || !['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(req.user.role)) {
    throw new ForbiddenError('Tenant user access required');
  }
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }
  // Verify user belongs to this tenant
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