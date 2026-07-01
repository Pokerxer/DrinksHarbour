// middleware/tenant.middleware.js

const Tenant = require('../models/Tenant');
const { ForbiddenError } = require('../utils/errors');

const TENANT_SELECT_FIELDS =
  '_id name slug status subscriptionStatus revenueModel markupPercentage commissionPercentage platformMarkupPercentage defaultCurrency enforceAgeVerification primaryColor logo plan';
const ADMIN_ROLES = ['super_admin', 'admin'];
const RESERVED_SUBDOMAINS = ['www', 'drinksharbour', 'localhost', 'admin', 'platform', 'api'];

/**
 * Single source of truth for req.tenant.
 * Must run AFTER protect() so req.user is populated.
 *
 * Resolution priority (JWT is authority, not client input):
 *   1. req.user.tenant (JWT claim, DB-validated in protect) — for tenant users
 *   2. x-tenant-slug header OR ?tenant= query — for super_admin/admin cross-tenant ops only
 *   3. Subdomain (host header) — for unauthenticated storefront browsing only (display context)
 *
 * Non-blocking: sets req.tenant if resolvable, leaves null otherwise.
 * Super_admin/admin with no target tenant = platform-wide scope (req.tenant = null is intentional).
 */
const resolveTenantContext = async (req, res, next) => {
  // 1. AUTHORITY: JWT-embedded tenant (validated in protect via DB lookup)
  if (req.user?.tenant) {
    try {
      const tenant = await Tenant.findById(req.user.tenant)
        .select(TENANT_SELECT_FIELDS)
        .lean();
      if (tenant && tenant.status === 'approved' && ['active', 'trialing'].includes(tenant.subscriptionStatus)) {
        req.tenant = tenant;
      }
    } catch (_) {
      // Non-blocking — tenant lookup failure leaves req.tenant unset
    }
    return next();
  }

  // 2. SUPER_ADMIN / ADMIN cross-tenant operations: x-tenant-slug header or ?tenant= query param
  //    These roles have no tenant in JWT, so they MAY specify a target tenant.
  if (ADMIN_ROLES.includes(req.user?.role)) {
    const tenantSlug = (req.headers['x-tenant-slug'] || req.query.tenant || '').toString().toLowerCase().trim();
    if (tenantSlug) {
      try {
        const tenant = await Tenant.findOne({ slug: tenantSlug, status: 'approved' })
          .select(TENANT_SELECT_FIELDS)
          .lean();
        if (tenant && ['active', 'trialing'].includes(tenant.subscriptionStatus)) {
          req.tenant = tenant;
        }
      } catch (_) {
        // Non-blocking
      }
    }
    // No header/query = platform-wide scope (req.tenant stays null — intentional for super_admin)
    return next();
  }

  // 3. SUBDOMAIN — display context for unauthenticated storefront browsing
  //    Used for public routes (storefront, product listing) to determine which tenant's store is viewed.
  //    NEVER used for authorization — only authenticated users with JWT tenant get auth scope.
  if (!req.user) {
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0].toLowerCase();
    if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      try {
        const tenant = await Tenant.findOne({ slug: subdomain, status: 'approved' })
          .select('_id name slug status subscriptionStatus defaultCurrency enforceAgeVerification primaryColor logo plan')
          .lean();
        if (tenant && ['active', 'trialing'].includes(tenant.subscriptionStatus)) {
          req.tenant = tenant;
        }
      } catch (_) {
        // Non-blocking
      }
    }
  }

  next();
};

/**
 * Require tenant context (use after resolveTenantContext)
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
 * Verify tenant belongs to authenticated user
 * Use after resolveTenantContext
 */
const verifyTenantOwnership = (req, res, next) => {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError('Tenant and user context required');
  }

  // super_admin/admin bypass ownership check (cross-tenant access is allowed for platform admins)
  if (ADMIN_ROLES.includes(req.user.role)) return next();

  const userTenant = req.user.tenant;
  const userTenantId = userTenant?._id ? userTenant._id.toString() : (userTenant ? userTenant.toString() : null);

  if (!userTenantId || userTenantId !== req.tenant._id.toString()) {
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
  resolveTenantContext,
  requireTenant,
  verifyTenantOwnership,
  verifyActiveSubscription,
};