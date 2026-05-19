// middleware/tenant.middleware.js

const Tenant = require('../models/Tenant');
const { ForbiddenError } = require('../utils/errors');

/**
 * Reads x-tenant-slug from request header, looks up tenant, attaches to req.tenant.
 * Non-blocking — if lookup fails or slug is missing, continues without tenant context.
 */
const resolveTenant = async (req, res, next) => {
  const slug = req.headers['x-tenant-slug'];
  if (!slug) return next();
  try {
    const tenant = await Tenant.findOne({ slug, status: 'approved' })
      .select('_id name slug primaryColor logo plan subscriptionStatus defaultCurrency enforceAgeVerification')
      .lean();
    if (tenant) req.tenant = tenant;
  } catch (err) {
    // Non-blocking — if lookup fails, just continue without tenant
  }
  next();
};

/**
 * Verify tenant belongs to authenticated user
 * Use after attachTenant middleware
 */
const verifyTenantOwnership = (req, res, next) => {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError('Tenant and user context required');
  }

  if (req.user.tenant?.toString() !== req.tenant._id.toString()) {
    throw new ForbiddenError('You do not have access to this tenant');
  }

  next();
};

/**
 * Verify tenant is in active subscription
 */
const verifyActiveSubscription = (req, res, next) => {
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required');
  }

  if (!['active', 'trialing'].includes(req.tenant.subscriptionStatus)) {
    throw new ForbiddenError('Tenant subscription is not active');
  }

  next();
};

module.exports = {
  resolveTenant,
  verifyTenantOwnership,
  verifyActiveSubscription,
};