const { ForbiddenError } = require('./errors');

const ADMIN_ROLES = ['super_admin', 'admin'];

const normalizeTenantId = (tenant) => {
  if (!tenant) return null;
  if (typeof tenant === 'string') return tenant;
  if (tenant._id) return tenant._id.toString();
  if (tenant.toString) return tenant.toString();
  return String(tenant);
};

/**
 * Returns the authoritative tenantId for the current request.
 * NEVER reads from req.body, req.query, or req.params.
 *
 * @param {Object} req - Express request (must have req.user from protect)
 * @param {Object} [options]
 * @param {boolean} [options.required=true] - throw if no tenant can be resolved
 * @returns {string|null} tenantId — from req.user.tenant (JWT authority) or req.tenant (resolved by middleware)
 * @throws {ForbiddenError} if required and no tenant context exists
 */
const getTenantId = (req, { required = true } = {}) => {
  // 1. AUTHORITY: JWT-embedded tenant (validated in protect via DB lookup)
  if (req.user?.tenant) {
    return normalizeTenantId(req.user.tenant);
  }

  // 2. Super-admin/admin operating on a specific tenant (resolved via x-tenant-slug or ?tenant= query)
  if (ADMIN_ROLES.includes(req.user?.role) && req.tenant?._id) {
    return req.tenant._id.toString();
  }

  // 3. Fallback to req.tenant (set by resolveTenantContext middleware, e.g. subdomain storefront)
  if (req.tenant?._id) {
    return req.tenant._id.toString();
  }

  if (required) {
    throw new ForbiddenError(
      ADMIN_ROLES.includes(req.user?.role)
        ? 'Tenant context required — specify a target tenant via x-tenant-slug header or ?tenant= query param'
        : 'Tenant context required for this operation'
    );
  }
  return null;
};

/**
 * For super_admin cross-tenant operations: optionally scope by a target tenant.
 * Returns null for platform-wide (all tenants) scope.
 */
const getOptionalTenantId = (req) => getTenantId(req, { required: false });

/**
 * Builds a Mongoose tenant filter object.
 * - For tenant users: returns { tenant: tenantId } (always scoped)
 * - For super_admin/admin with target tenant: returns { tenant: tenantId }
 * - For super_admin/admin with NO target: returns {} (all tenants — platform-wide)
 */
const tenantFilter = (req) => {
  const tenantId = getTenantId(req, { required: false });
  return tenantId ? { tenant: tenantId } : {};
};

/**
 * For queries that MUST be scoped to a single tenant (never cross-tenant).
 * Always returns { tenant: id }.
 * Throws if no tenant — super_admin must specify a target tenant for scoped queries.
 */
const strictTenantFilter = (req) => {
  const tenantId = getTenantId(req, { required: true });
  return { tenant: tenantId };
};

/**
 * Verifies that a resource's tenant matches the caller's tenant.
 * Use for defense-in-depth on findById results.
 *
 * @param {Object} resource - Mongoose doc or lean object with a `tenant` field
 * @param {Object} req - Express request
 * @throws {ForbiddenError} if tenant mismatch (returns 404-friendly message to avoid enumeration)
 */
const assertTenantOwnership = (resource, req) => {
  if (!resource) return;
  // super_admin/admin can access any tenant's resources (with audit)
  if (ADMIN_ROLES.includes(req.user?.role)) return;
  const callerTenantId = getTenantId(req, { required: false });
  const resourceTenantId = normalizeTenantId(resource.tenant);
  if (callerTenantId && resourceTenantId && callerTenantId !== resourceTenantId) {
    throw new ForbiddenError('Resource not found');
  }
};

module.exports = {
  getTenantId,
  getOptionalTenantId,
  tenantFilter,
  strictTenantFilter,
  assertTenantOwnership,
  normalizeTenantId,
};