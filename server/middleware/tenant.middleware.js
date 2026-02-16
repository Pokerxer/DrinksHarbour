// middleware/tenant.middleware.js (OPTIONAL - for additional tenant utils)

const { ForbiddenError } = require('../utils/errors');

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
  verifyTenantOwnership,
  verifyActiveSubscription,
};