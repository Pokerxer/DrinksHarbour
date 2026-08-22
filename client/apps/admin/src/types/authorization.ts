export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'tenant_admin'
  | 'tenant_owner'
  | 'tenant_staff'
  | 'customer';

export type Permission =
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'subproducts:read'
  | 'subproducts:write'
  | 'subproducts:delete'
  | 'orders:read'
  | 'orders:write'
  | 'orders:delete'
  | 'customers:read'
  | 'customers:write'
  | 'categories:read'
  | 'categories:write'
  | 'categories:delete'
  | 'brands:read'
  | 'brands:write'
  | 'brands:delete'
  | 'inventory:read'
  | 'inventory:write'
  | 'inventory:adjust'
  | 'reports:read'
  | 'reports:export'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'settings:read'
  | 'settings:write'
  | 'tenant:manage'
  | 'billing:read'
  | 'billing:write'
  | 'analytics:read'
  | 'appraisals:read'
  | 'appraisals:review'
  | 'appraisals:manage';

/**
 * What each role may do, as the server actually enforces it.
 *
 * Nothing consumes this map today — the utils/hooks/hoc chain built on it has
 * zero call sites, and so do lib/server-auth.ts's requirePermission and
 * requireAnyPermission. It is kept anyway, and kept true, so that a future
 * server-side permission system has an honest starting point and so that a
 * reader cannot mistake a stale entry for a live authorization hole.
 *
 * server/__tests__/rolePermissionMap.test.js fails if this drifts from the
 * route guards. Entries here mirror ROUTE-LEVEL role gates only; finer inline
 * rules (super_admin alone may permanently delete a user or delete a tenant)
 * live in the controllers.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'products:read',
    'products:write',
    'products:delete',
    'subproducts:read',
    'subproducts:write',
    'subproducts:delete',
    'orders:read',
    'orders:write',
    'orders:delete',
    'customers:read',
    'customers:write',
    'categories:read',
    'categories:write',
    'categories:delete',
    'brands:read',
    'brands:write',
    'brands:delete',
    'inventory:read',
    'inventory:write',
    'inventory:adjust',
    'reports:read',
    'reports:export',
    'users:read',
    'users:write',
    'users:delete',
    'settings:read',
    'settings:write',
    'tenant:manage',
    'billing:read',
    'billing:write',
    'analytics:read',
    'appraisals:read',
    'appraisals:review',
    'appraisals:manage',
  ],
  admin: [
    'products:read',
    'products:write',
    'products:delete',
    'subproducts:read',
    'subproducts:write',
    'subproducts:delete',
    'orders:read',
    'orders:write',
    'orders:delete',
    'customers:read',
    'customers:write',
    'categories:read',
    'categories:write',
    'categories:delete',
    'brands:read',
    'brands:write',
    'brands:delete',
    'inventory:read',
    'inventory:write',
    'inventory:adjust',
    'reports:read',
    'reports:export',
    'users:read',
    'users:write',
    'users:delete',
    'settings:read',
    'settings:write',
    'billing:read',
    'tenant:manage',
    'analytics:read',
    'appraisals:read',
    'appraisals:review',
    'appraisals:manage',
  ],
  tenant_admin: [
    'products:read',
    'subproducts:read',
    'subproducts:write',
    'subproducts:delete',
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
    'categories:read',
    'brands:read',
    'inventory:read',
    'inventory:write',
    'inventory:adjust',
    'reports:read',
    'reports:export',
    'settings:read',
    'analytics:read',
    'appraisals:read',
    'appraisals:review',
    'appraisals:manage',
  ],
  tenant_owner: [
    'products:read',
    'subproducts:read',
    'subproducts:write',
    'subproducts:delete',
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
    'categories:read',
    'brands:read',
    'inventory:read',
    'inventory:write',
    'inventory:adjust',
    'reports:read',
    'reports:export',
    'settings:read',
    'analytics:read',
    'appraisals:read',
    'appraisals:review',
    'appraisals:manage',
  ],
  tenant_staff: [
    'products:read',
    // No 'subproducts:write': every endpoint in subproduct.routes.js is guarded
    // by tenantAdminOrSuperAdmin, which excludes tenant_staff. (The duplicate
    // POST / that once sat further down the file with a different guard was
    // unreachable, and was deleted on 2026-08-07.)
    //
    // 'subproducts:read' is aspirational for the same reason — no sub-product
    // read endpoint admits tenant_staff either. It is left in place because the
    // map binds only write/delete permissions to routes; see the header comment.
    'subproducts:read',
    'orders:read',
    'orders:write',
    'customers:read',
    'inventory:read',
    'analytics:read',
    'appraisals:read',
    'appraisals:review',
  ],
  customer: [
    'products:read',
    'subproducts:read',
    'orders:read',
    'orders:write',
  ],
};

export type RoleScope = 'platform' | 'tenant';

export interface RoleConfig {
  role: UserRole;
  scope: RoleScope;
  allowedTenants?: string[];
}

export const PLATFORM_ROLES: UserRole[] = ['super_admin', 'admin'];
export const TENANT_ROLES: UserRole[] = [
  'tenant_admin',
  'tenant_owner',
  'tenant_staff',
];
export const CUSTOMER_ROLES: UserRole[] = ['customer'];

/**
 * Roles permitted to hold an admin-dashboard session at all.
 *
 * `customer` is deliberately absent: /api/users/login is shared with the
 * storefront, so authenticating a customer is a normal response here — it just
 * isn't grounds for an admin session.
 */
export const ADMIN_ACCESS_ROLES: UserRole[] = [
  ...PLATFORM_ROLES,
  ...TENANT_ROLES,
];

export const isPlatformRole = (role: UserRole): boolean => {
  return PLATFORM_ROLES.includes(role);
};

export const isTenantRole = (role: UserRole): boolean => {
  return TENANT_ROLES.includes(role);
};

/**
 * May this role administer appraisal cycles and templates?
 *
 * The single source of truth for the `/appraisals/cycles` and
 * `/appraisals/templates` gate. `src/middleware.ts` enforces it, and the
 * appraisals nav header hides the tabs with it, so the chrome cannot offer a
 * link the middleware then bounces to /access-denied. Takes a bare `string`
 * because the caller's role comes off a session token, where it is untyped.
 *
 * Bare `/appraisals` is deliberately NOT covered: every tenant role reaches
 * their own appraisal and their assigned feedback forms.
 */
export const canAdministerAppraisals = (
  role: string | null | undefined
): boolean =>
  Boolean(role) &&
  (PLATFORM_ROLES.includes(role as UserRole) ||
    role === 'tenant_admin' ||
    role === 'tenant_owner');

/**
 * May this role read employee-authored STANDING feedback (Phase 5 §9.5)?
 *
 * A strictly narrower gate than `canAdministerAppraisals`, and deliberately
 * not derived from it: standing feedback is one employee writing about another
 * by name, and the promise made on the form is that the business owner is the
 * only reader. `tenant_admin` administers appraisals and is still excluded.
 *
 * This is chrome only. The server gates the endpoint at the route AND re-checks
 * inside the controller — "HR-only by mount point" is the pattern that leaked
 * in this module before, so nothing here is load-bearing.
 */
export const canReadStandingFeedback = (
  role: string | null | undefined
): boolean =>
  Boolean(role) &&
  (PLATFORM_ROLES.includes(role as UserRole) || role === 'tenant_owner');

/**
 * A custom access-control role (server/models/Role.js). REFINES the fixed
 * User.role enum additively — it never replaces it and never weakens JWT
 * tenant scoping. Permissions are declarative/UI-gating today; no server
 * middleware consults them yet.
 */
export interface CustomRole {
  _id: string;
  name: string;
  scope: RoleScope;
  /** Tenant id for tenant-scoped roles; null on the platform shelf. */
  tenant: string | null;
  description?: string;
  color?: string;
  isActive?: boolean;
  permissions: Permission[];
  assignedCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** One entry of the canonical catalog served by GET /api/roles/permissions/catalog. */
export interface PermissionCatalogEntry {
  key: Permission;
  label: string;
  group: string;
  description: string;
}

/**
 * The fixed enum roles, with their presentation metadata. System capabilities
 * come from ROLE_PERMISSIONS above and are NOT editable here — that is policy,
 * pinned by server/__tests__/rolePermissionMap.test.js against the live route
 * guards. Only CUSTOM roles carry an editable permission set.
 */
export const SYSTEM_ROLE_META: Record<
  UserRole,
  { label: string; description: string; color: string; scope: RoleScope }
> = {
  super_admin: {
    label: 'Super Admin',
    description:
      'Platform-wide control, including the five super-admin-only powers (review moderation, permanent deletes, tenant delete, product approval, cross-tenant visibility).',
    color: '#7c3aed',
    scope: 'platform',
  },
  admin: {
    label: 'Admin',
    description:
      'Platform admin minus the five super-admin-only powers. The natural tier for a platform hire.',
    color: '#2563eb',
    scope: 'platform',
  },
  tenant_owner: {
    label: 'Tenant Owner',
    description:
      "Full control of one business — billing included. Fixed by policy: cannot be assigned a custom role.",
    color: '#04873c',
    scope: 'tenant',
  },
  tenant_admin: {
    label: 'Tenant Admin',
    description:
      'Runs one business day-to-day: products, listings, orders, stock, staff.',
    color: '#79b829',
    scope: 'tenant',
  },
  tenant_staff: {
    label: 'Staff',
    description: 'POS and order fulfilment on the shop floor.',
    color: '#eeaa44',
    scope: 'tenant',
  },
  customer: {
    label: 'Customer',
    description: 'End buyer on the marketplace or a tenant store.',
    color: '#a6a6a6',
    scope: 'platform',
  },
};

/** Base roles that MAY hold a customRole refinement (owner/super_admin excluded by policy). */
export const CUSTOMIZABLE_SYSTEM_ROLES: UserRole[] = [
  'admin',
  'tenant_admin',
  'tenant_staff',
];

/**
 * Union of a system role's declared permissions with a custom role's extras.
 * Additive only: a customRole can grant more, never less. Read-only helper —
 * hasPermission keeps its existing signature and behaviour.
 */
export function effectivePermissions(
  role: UserRole,
  customPerms?: Permission[] | null
): Permission[] {
  const base = ROLE_PERMISSIONS[role] ?? [];
  if (!customPerms?.length) return base;
  // De-duplicate without spreading a Set (downlevelIteration is off here).
  const merged = [...base, ...customPerms];
  return merged.filter((perm, i) => merged.indexOf(perm) === i);
}
