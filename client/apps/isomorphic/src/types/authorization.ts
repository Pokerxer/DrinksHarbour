export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'tenant_admin'
  | 'tenant_owner'
  | 'staff'
  | 'cashier'
  | 'viewer';

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
  | 'analytics:read';

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
    'settings:read',
    'settings:write',
    'billing:read',
    'analytics:read',
  ],
  tenant_admin: [
    'products:read',
    'subproducts:read',
    'subproducts:write',
    'subproducts:delete',
    'orders:read',
    'orders:write',
    'customers:read',
    'categories:read',
    'brands:read',
    'inventory:read',
    'inventory:write',
    'inventory:adjust',
    'reports:read',
    'reports:export',
    'users:read',
    'users:write',
    'settings:read',
    'analytics:read',
  ],
  tenant_owner: [
    'products:read',
    'subproducts:read',
    'subproducts:write',
    'subproducts:delete',
    'orders:read',
    'orders:write',
    'customers:read',
    'categories:read',
    'brands:read',
    'inventory:read',
    'inventory:write',
    'inventory:adjust',
    'reports:read',
    'reports:export',
    'users:read',
    'settings:read',
    'analytics:read',
  ],
  staff: [
    'products:read',
    'subproducts:read',
    'subproducts:write',
    'orders:read',
    'orders:write',
    'customers:read',
    'inventory:read',
    'analytics:read',
  ],
  cashier: [
    'products:read',
    'subproducts:read',
    'orders:read',
    'orders:write',
    'customers:read',
    'inventory:read',
  ],
  viewer: [
    'products:read',
    'subproducts:read',
    'orders:read',
    'inventory:read',
    'reports:read',
    'analytics:read',
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
  'staff',
  'cashier',
  'viewer',
];

export const isPlatformRole = (role: UserRole): boolean => {
  return PLATFORM_ROLES.includes(role);
};

export const isTenantRole = (role: UserRole): boolean => {
  return TENANT_ROLES.includes(role);
};
