'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Industry scoping of the public Category / SubCategory LIST endpoints
// (GET /api/categories, GET /api/subcategories,
// GET /api/subcategories/by-category/:categoryId) — consumed by
// controllers/category.controller.js and controllers/subcategory.controller.js.
//
// Only INDUSTRY_TAXONOMY_SCOPE_ENABLED === 'true' (constants/industries.js)
// and an authenticated TENANT caller get a filter. Platform admins
// (super_admin/admin), anonymous callers and unprofiled/legacy tenants
// ('Other' business type, empty profile) apply NO filter — the legacy view is
// byte-identical. Tenant authority comes from req.user.tenant (JWT,
// Workstream A) — NEVER from query params.
// ─────────────────────────────────────────────────────────────────────────────

const Tenant = require('../models/Tenant');
const industries = require('../constants/industries');

// Real role names on the User schema; canon's "staff" is `tenant_staff`.
const TENANT_ROLES = Object.freeze(['tenant_owner', 'tenant_admin', 'tenant_staff']);

/**
 * Resolve the industry profile applied to taxonomy list requests.
 *
 * @param {object} req — Express request (optionalProtect may have set req.user)
 * @returns {Promise<string[]|null>} the applied tenant industries, or null
 *   meaning "apply no filter" (flag OFF / anon / platform admin / legacy
 *   tenant without a profile).
 */
const listIndustriesFor = async (req) => {
  if (!industries.enabled()) return null;
  const role = req.user?.role;
  if (!role || !TENANT_ROLES.includes(role)) return null;
  // JWT authority only (getTenantId contract): never req.query/req.params.
  if (!req.user.tenant) return null;
  let tenant = null;
  try {
    tenant = await Tenant.findById(req.user.tenant)
      .select('businessType industries')
      .lean();
  } catch (_) {
    tenant = null; // non-blocking: an unresolvable tenant keeps the legacy view
  }
  if (!tenant) return null;
  return industries.resolveTenantIndustries(tenant);
};

// Active rows with the seed markers are staged taxonomy options. Public
// taxonomy lists retain their own status filters.
function taxonomyPickerFilter(industryPredicate) {
  const statuses = {
    $or: [
      { status: 'published' },
      { status: 'active', displayOrder: 500, industry: { $ne: null } },
    ],
  };
  return industryPredicate ? { $and: [statuses, industryPredicate] } : statuses;
}

module.exports = { listIndustriesFor, taxonomyPickerFilter, TENANT_ROLES };
