// middleware/tenant.middleware.js

const Tenant = require('../models/Tenant');
const { ForbiddenError, NotFoundError } = require('../utils/errors');
const { resolveEntitlements, readOnlyMessage } = require('../services/entitlements.service');

// A field omitted here is SILENTLY undefined at every consumer, not an error.
// `trialEndsAt`, `addOns`, `customCapabilities` and `posSettings.shops` are on
// this list for the plan-entitlement gates (middleware/plan.middleware.js,
// services/entitlements.service.js): without them a trial never expires, a
// custom tenant silently falls back to the default set, and the add-on quota
// reads as "one, free" for everyone regardless of what they bought.
const TENANT_SELECT_FIELDS =
  '_id name slug status subscriptionStatus revenueModel markupPercentage commissionPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits platformMarkupPercentage defaultCurrency enforceAgeVerification primaryColor logo plan trialEndsAt addOns customCapabilities posSettings.shops posSettings.retailWarehouse email businessName paystackCustomerId paystackSubscriptionCode currentPeriodEnd cancelAtPeriodEnd';
const ADMIN_ROLES = ['super_admin', 'admin'];
const RESERVED_SUBDOMAINS = ['www', 'drinksharbour', 'localhost', 'admin', 'platform', 'api'];

// ─── Dunning: which statuses get a tenant context, and who may write ─────────
//
// `past_due` is on this list DELIBERATELY, and it did not used to be. The old
// rule ("active or trialing, else no req.tenant at all") was a total lockout:
// the instant the invoice.payment_failed webhook wrote 'past_due', that tenant
// lost the entire admin dashboard — INCLUDING /settings/billing, because
// /api/erm sits behind requireTenant. Dunning that makes it impossible to pay
// is not dunning; it is an outage with a support ticket attached.
//
// So the EXISTENCE gate is relaxed for past_due and the WRITE gate is enforced
// here instead, next to it, rather than only inside requireCapability. That
// placement matters: most tenant-owned routers carry requireOwnTenant and no
// capability gate at all, so relaxing the status list without this would have
// handed a non-paying tenant full write access to exactly those routes.
//
// The full rule, and why lapsed tenants keep read access, is in
// server/config/README-plan-entitlements.md §4.
const TENANT_CONTEXT_STATUSES = ['active', 'trialing', 'past_due'];

const BILLING_RECOVERY_STATUSES = ['canceled', 'incomplete', 'incomplete_expired'];
function contextStatusAllowed(req, status) {
  return TENANT_CONTEXT_STATUSES.includes(status) ||
    (req.billingWriteExempt === true && BILLING_RECOVERY_STATUSES.includes(status));
}

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Let a route accept writes from a tenant who is otherwise read-only.
 *
 * Exactly one caller is legitimate: the billing router. A past_due tenant has
 * to be able to POST /api/erm/subscribe, or the read-only state it is in has
 * no exit. Mount it BEFORE the tenant guard on that router.
 */
const allowBillingWrites = (req, res, next) => {
  req.billingWriteExempt = true;
  next();
};

/**
 * Throw unless this request may change data. Reads always pass.
 *
 * resolveEntitlements owns the policy — past_due and an elapsed trial are both
 * read-only, and it is the same function the admin client uses, so the two
 * sides cannot disagree about what "read-only" means.
 */
function assertWritesAllowed(req) {
  if (!WRITE_METHODS.includes(req.method)) return;
  if (req.billingWriteExempt) return;

  const { writesAllowed, reason, plan } = resolveEntitlements(req.tenant);
  if (writesAllowed) return;

  // The sentence lives in entitlements.service.js so this gate, the capability
  // gate and the billing screen cannot tell the tenant three different things.
  const err = new ForbiddenError(readOnlyMessage(reason));
  // Same code requireCapability raises, so the client has one branch to handle.
  err.code = 'SUBSCRIPTION_READ_ONLY';
  err.details = { reason, currentPlan: plan };
  throw err;
}

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
      if (tenant && tenant.status === 'approved' && contextStatusAllowed(req, tenant.subscriptionStatus)) {
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
        if (tenant && contextStatusAllowed(req, tenant.subscriptionStatus)) {
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
        // Same silent-projection hazard as TENANT_SELECT_FIELDS: anything that
        // resolves entitlements from this document reads an absent trialEndsAt
        // or customCapabilities as "no trial, default set" without error.
        const tenant = await Tenant.findOne({ slug: subdomain, status: 'approved' })
          .select('_id name slug status subscriptionStatus defaultCurrency enforceAgeVerification primaryColor logo plan trialEndsAt customCapabilities')
          .lean();
        // A past_due storefront stays up on purpose. Taking a merchant's shop
        // offline over one failed card punishes their customers, and the
        // platform still earns commission on what sells; what dunning stops is
        // the tenant's own writes, enforced by the guards below.
        if (tenant && contextStatusAllowed(req, tenant.subscriptionStatus)) {
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
 * Require tenant context (use after resolveTenantContext).
 *
 * A past_due tenant gets through and is read-only — see the dunning note above
 * TENANT_CONTEXT_STATUSES.
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required for this operation');
  }

  if (req.tenant.status !== 'approved') {
    throw new ForbiddenError('Tenant account is not approved');
  }

  if (!contextStatusAllowed(req, req.tenant.subscriptionStatus)) {
    throw new ForbiddenError('Tenant subscription is not active');
  }

  assertWritesAllowed(req);

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

  if (!contextStatusAllowed(req, req.tenant.subscriptionStatus)) {
    throw new ForbiddenError('Tenant subscription is not active');
  }

  assertWritesAllowed(req);

  next();
};

/**
 * Strict own-tenant enforcement for tenant-owned business modules
 * (point of sale, sales, purchases, inventory, warehouses).
 *
 * Use INSTEAD OF requireTenant on those routers. Run after resolveTenantContext
 * (a.k.a. attachTenant) so req.tenant is already loaded from the DB.
 *
 * The data in these modules belongs to exactly one tenant and nobody outside it
 * — including platform admins — may read or write it. So unlike requireTenant,
 * this middleware takes the tenant from the JWT claim ONLY:
 *
 *   - No x-tenant-slug / ?tenant= pivot. resolveTenantContext offers that path to
 *     admins with no tenant of their own; here a missing claim is simply a deny,
 *     which makes the pivot unreachable rather than merely unused.
 *   - No client-supplied tenantId. Any tenantId in the query or body is stripped
 *     so a controller reaching for it cannot widen its own scope by accident.
 *   - Admin roles get no bypass. An admin who owns a tenant works inside it like
 *     any other user; an admin who owns none is denied outright.
 */
const requireOwnTenant = (req, res, next) => {
  // Client input can never name the tenant on these routes.
  if (req.query) delete req.query.tenantId;
  if (req.body && typeof req.body === 'object') delete req.body.tenantId;

  const claim = req.user?.tenant;
  const claimedTenantId = claim?._id ? claim._id.toString() : claim?.toString();

  if (!claimedTenantId) {
    throw new ForbiddenError(
      'This module is tenant-owned. Your account is not attached to a tenant.'
    );
  }

  // resolveTenantContext leaves req.tenant unset when the tenant is unapproved or
  // its subscription lapsed. Failing closed here keeps controllers from falling
  // back to an unscoped query.
  if (!req.tenant) {
    throw new ForbiddenError('Tenant context required for this operation');
  }

  // Belt and braces: if anything upstream resolved a different tenant (header,
  // query, subdomain), the JWT claim wins and the request is refused.
  if (req.tenant._id.toString() !== claimedTenantId) {
    throw new ForbiddenError('You do not have access to this tenant');
  }

  if (req.tenant.status !== 'approved') {
    throw new ForbiddenError('Tenant account is not approved');
  }

  if (!contextStatusAllowed(req, req.tenant.subscriptionStatus)) {
    throw new ForbiddenError('Tenant subscription is not active');
  }

  // Relaxing the status list above without this would hand a non-paying tenant
  // full write access to every requireOwnTenant router — most of which carry
  // no capability gate, so requireCapability's read-only branch never runs.
  assertWritesAllowed(req);

  next();
};

/**
 * Throw for a document that either does not exist or belongs to another tenant.
 *
 * Both cases must be indistinguishable: a 403 on a cross-tenant hit confirms the
 * id is real and lets a caller enumerate another tenant's records, so callers
 * report 404 for both.
 */
const notFoundOrForeign = (resource = 'Resource') => {
  throw new NotFoundError(`${resource} not found`);
};

module.exports = {
  resolveTenantContext,
  requireTenant,
  requireOwnTenant,
  notFoundOrForeign,
  verifyTenantOwnership,
  verifyActiveSubscription,
  allowBillingWrites,
  assertWritesAllowed,
  TENANT_CONTEXT_STATUSES,
};
