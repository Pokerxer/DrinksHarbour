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
    // No 'subproducts:write': the reachable POST /api/subproducts is guarded by
    // tenantAdminOrSuperAdmin, which excludes tenant_staff. (subproduct.routes.js
    // declares POST / a second time with a wider guard, but Express matches the
    // first declaration, so that block is unreachable.)
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
