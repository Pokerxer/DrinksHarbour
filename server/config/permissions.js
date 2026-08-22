// server/config/permissions.js
//
// The CANONICAL permission catalogue for custom access-control roles.
//
// Every `key` mirrors the `Permission` union in
// client/apps/admin/src/types/authorization.ts EXACTLY, one to one. Two tests
// keep the two layers from drifting:
//
//   - server/__tests__/rolePermissionCatalog.test.js  (catalog ↔ TS source)
//   - server/__tests__/rolePermissionMap.test.js      (ROLE_PERMISSIONS ↔ route
//     guards — the pre-existing pin on the same file)
//
// ENFORCEMENT CAVEAT, stated honestly: custom-role permissions are DECLARATIVE.
// They gate UI affordances; no requirePermission() middleware consults them at
// runtime yet. A checked box does not change server authorization until that
// middleware exists (explicit follow-up, not this module's job).

// Groups in display order for the admin UI's checkbox grid.
const PERMISSION_GROUPS = [
  'products',
  'subproducts',
  'orders',
  'customers',
  'categories',
  'brands',
  'inventory',
  'reports',
  'users',
  'settings',
  'billing',
  'analytics',
  'appraisals',
];

const PERMISSION_CATALOG = [
  // ── products ──────────────────────────────────────────────────────────────
  { key: 'products:read', label: 'View products', group: 'products', description: 'Read the central product catalog.' },
  { key: 'products:write', label: 'Create & edit products', group: 'products', description: 'Create products and edit existing ones.' },
  { key: 'products:delete', label: 'Delete products', group: 'products', description: 'Remove products from the catalog.' },

  // ── subproducts ───────────────────────────────────────────────────────────
  { key: 'subproducts:read', label: 'View store listings', group: 'subproducts', description: 'Read tenant SubProducts (price, stock, variants).' },
  { key: 'subproducts:write', label: 'Create & edit listings', group: 'subproducts', description: 'Link products and configure selling price, stock and variants.' },
  { key: 'subproducts:delete', label: 'Delete listings', group: 'subproducts', description: 'Remove tenant SubProducts.' },

  // ── orders ────────────────────────────────────────────────────────────────
  { key: 'orders:read', label: 'View orders', group: 'orders', description: 'Read orders routed to the business.' },
  { key: 'orders:write', label: 'Manage orders', group: 'orders', description: 'Update order status and fulfilment.' },
  { key: 'orders:delete', label: 'Delete orders', group: 'orders', description: 'Cancel or remove orders.' },

  // ── customers ─────────────────────────────────────────────────────────────
  { key: 'customers:read', label: 'View customers', group: 'customers', description: 'Read customer records and contact details.' },
  { key: 'customers:write', label: 'Manage customers', group: 'customers', description: 'Create and edit customer records.' },

  // ── categories ────────────────────────────────────────────────────────────
  { key: 'categories:read', label: 'View categories', group: 'categories', description: 'Browse the category tree.' },
  { key: 'categories:write', label: 'Create & edit categories', group: 'categories', description: 'Add and change categories.' },
  { key: 'categories:delete', label: 'Delete categories', group: 'categories', description: 'Remove categories.' },

  // ── brands ────────────────────────────────────────────────────────────────
  { key: 'brands:read', label: 'View brands', group: 'brands', description: 'Browse brands.' },
  { key: 'brands:write', label: 'Create & edit brands', group: 'brands', description: 'Add and change brands.' },
  { key: 'brands:delete', label: 'Delete brands', group: 'brands', description: 'Remove brands.' },

  // ── inventory ─────────────────────────────────────────────────────────────
  { key: 'inventory:read', label: 'View inventory', group: 'inventory', description: 'Read stock levels and movements.' },
  { key: 'inventory:write', label: 'Record movements', group: 'inventory', description: 'Receive stock, log transfers and returns.' },
  { key: 'inventory:adjust', label: 'Adjust stock', group: 'inventory', description: 'Directly correct stock quantities.' },

  // ── reports ───────────────────────────────────────────────────────────────
  { key: 'reports:read', label: 'View reports', group: 'reports', description: 'Read operational reports.' },
  { key: 'reports:export', label: 'Export reports', group: 'reports', description: 'Download report data.' },

  // ── users ─────────────────────────────────────────────────────────────────
  { key: 'users:read', label: 'View users', group: 'users', description: 'List user accounts across the platform.' },
  { key: 'users:write', label: 'Create & edit users', group: 'users', description: 'Create accounts and change roles or status.' },
  { key: 'users:delete', label: 'Delete users', group: 'users', description: 'Soft-delete user accounts.' },

  // ── settings ──────────────────────────────────────────────────────────────
  { key: 'settings:read', label: 'View settings', group: 'settings', description: 'Read workspace settings.' },
  { key: 'settings:write', label: 'Change settings', group: 'settings', description: 'Edit workspace settings.' },
  { key: 'tenant:manage', label: 'Manage tenants', group: 'settings', description: 'Approve, suspend and configure tenant businesses. PLATFORM ONLY.' },

  // ── billing ───────────────────────────────────────────────────────────────
  { key: 'billing:read', label: 'View billing', group: 'billing', description: 'Read subscription and invoice data. PLATFORM ONLY.' },
  { key: 'billing:write', label: 'Change billing', group: 'billing', description: 'Alter subscriptions and payment methods. PLATFORM ONLY.' },

  // ── analytics ─────────────────────────────────────────────────────────────
  { key: 'analytics:read', label: 'View analytics', group: 'analytics', description: 'Read dashboards and analytics.' },

  // ── appraisals ────────────────────────────────────────────────────────────
  { key: 'appraisals:read', label: 'View appraisals', group: 'appraisals', description: 'Read appraisal cycles and own feedback.' },
  { key: 'appraisals:review', label: 'Review feedback', group: 'appraisals', description: 'Submit and review appraisal feedback.' },
  { key: 'appraisals:manage', label: 'Administer appraisals', group: 'appraisals', description: 'Launch cycles and manage templates.' },
];

/**
 * Permissions a TENANT-scoped role may never hold — platform levers only.
 * `users:*` is included because /api/users is gated to platform admins
 * (user.routes.js) and tenant staff are managed through /api/employees instead.
 */
const PLATFORM_ONLY_PERMISSIONS = [
  'tenant:manage',
  'billing:read',
  'billing:write',
  'users:read',
  'users:write',
  'users:delete',
];

const CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));
const PLATFORM_ONLY = new Set(PLATFORM_ONLY_PERMISSIONS);

/**
 * Validate a permission selection against the catalog and the caller's scope.
 *
 * @param {string[]} keys          proposed permission keys
 * @param {'platform'|'tenant'} scope
 * @returns {{ ok: true } | { ok: false, unknown: string[], platformOnly: string[] }}
 */
function validatePermissions(keys, scope) {
  const list = Array.isArray(keys) ? keys : [];
  const unknown = list.filter((k) => !CATALOG_KEYS.has(k));
  const platformOnly =
    scope === 'tenant' ? list.filter((k) => PLATFORM_ONLY.has(k)) : [];

  if (unknown.length || platformOnly.length) {
    return { ok: false, unknown, platformOnly };
  }
  return { ok: true };
}

/** Grouped shape the create/edit modal renders directly. */
function groupedCatalog() {
  return PERMISSION_GROUPS.map((group) => ({
    group,
    permissions: PERMISSION_CATALOG.filter((p) => p.group === group),
  }));
}

module.exports = {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PLATFORM_ONLY_PERMISSIONS,
  validatePermissions,
  groupedCatalog,
};
