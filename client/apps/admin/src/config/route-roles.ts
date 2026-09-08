import { ADMIN_ACCESS_ROLES, PLATFORM_ROLES, canAdministerAppraisals, type UserRole } from '@/types/authorization';
import { isUnder } from './plan-capabilities';

/** Mirror the existing API audiences; this does not grant new permissions. */
const MANAGER_PATHS = [
  '/employees', '/roles-permissions', '/users', '/accounting', '/purchases',
  '/inventory', '/warehouses', '/contacts', '/pos/pricelists',
  '/point-of-sale/pricelists', '/point-of-sale/cashiers', '/point-of-sale/settings',
];
export function roleCanAccessRoute(path: string, role?: string | null, customPermissions: string[] = []): boolean {
  if (!ADMIN_ACCESS_ROLES.includes(role as UserRole)) return false;
  if (PLATFORM_ROLES.includes(role as UserRole)) return true;
  if (['/executive', '/financial', '/tenants', '/products'].some(p => isUnder(path, p))) return false;
  if (isUnder(path, '/inventory') && customPermissions.includes('inventory:read')) return true;
  if (isUnder(path, '/settings/api-keys')) return role === 'tenant_owner' || role === 'tenant_admin' || customPermissions.includes('settings:read');
  if (isUnder(path, '/bookings')) return role === 'tenant_owner' || role === 'tenant_admin';
  if (['/appraisals/cycles', '/appraisals/templates'].some(p => isUnder(path, p))) {
    return canAdministerAppraisals(role);
  }
  if (MANAGER_PATHS.some(p => isUnder(path, p))) return role === 'tenant_owner' || role === 'tenant_admin';
  return true;
}
