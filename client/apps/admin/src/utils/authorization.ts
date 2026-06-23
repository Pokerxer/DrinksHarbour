import { type UserRole, ROLE_PERMISSIONS, type Permission } from '@/types/authorization';

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
};

export const hasAnyPermission = (
  role: UserRole,
  permissions: Permission[]
): boolean => {
  return permissions.some((permission) => hasPermission(role, permission));
};

export const hasAllPermissions = (
  role: UserRole,
  permissions: Permission[]
): boolean => {
  return permissions.every((permission) => hasPermission(role, permission));
};

export const getPermissions = (role: UserRole): Permission[] => {
  return ROLE_PERMISSIONS[role] ?? [];
};

export const canAccessTenant = (
  userRole: UserRole,
  userTenantId: string | null | undefined,
  targetTenantId: string
): boolean => {
  if (!userTenantId) return false;
  
  if (userRole === 'super_admin') return true;
  
  return userTenantId === targetTenantId;
};

export const isPlatformAdmin = (role: UserRole): boolean => {
  return role === 'super_admin' || role === 'admin';
};

export const isTenantAdmin = (role: UserRole): boolean => {
  return role === 'tenant_admin' || role === 'tenant_owner';
};

export const canManageTenant = (role: UserRole): boolean => {
  return hasPermission(role, 'tenant:manage');
};

export const canManageUsers = (role: UserRole): boolean => {
  return hasPermission(role, 'users:write');
};

export const canDeleteProducts = (role: UserRole): boolean => {
  return hasPermission(role, 'products:delete');
};

export const canAdjustInventory = (role: UserRole): boolean => {
  return hasPermission(role, 'inventory:adjust');
};

export const canExportReports = (role: UserRole): boolean => {
  return hasPermission(role, 'reports:export');
};
