import { ADMIN_ACCESS_ROLES, PLATFORM_ROLES, canAdministerAppraisals, type UserRole } from '@/types/authorization';
import { routes } from './routes';
import { isUnder } from './plan-capabilities';
import {canOpenNotificationPage} from './notification-pages';

/** Mirror the existing API audiences; this does not grant new permissions. */
const MANAGER_PATHS = [
  '/retail-tools',
  '/employees', '/roles-permissions', '/users', '/accounting', '/purchases',
  '/inventory', '/warehouses', '/contacts', '/pos/pricelists',
  '/point-of-sale/pricelists', '/point-of-sale/cashiers', '/point-of-sale/settings',
];
export function roleCanAccessRoute(path: string, role?: string | null, customPermissions: string[] = []): boolean {
  if (!ADMIN_ACCESS_ROLES.includes(role as UserRole)) return false;
  if (isUnder(path, '/delivery-settings')) return PLATFORM_ROLES.includes(role as UserRole);
  if (path.startsWith('/notifications/')) return canOpenNotificationPage(path.replace(/\/$/,''),role,customPermissions);
  if (isUnder(path, '/settings/countries')) return role === 'super_admin';
  // Central catalogue approval queue (approve/reject pending products) mirrors
  // the super_admin-only server guards on POST /api/products/:id/approve and
  // /:id/reject. Checked before the platform-roles early-return so `admin`
  // stays out even though they can browse the rest of /products.
  if (isUnder(path, '/products/pending')) return role === 'super_admin';
  if (isUnder(path, '/settings/market-enrollment')) return ['super_admin', 'tenant_owner', 'tenant_admin'].includes(role || '');
  if (isUnder(path, '/settings/sales-channels')) return ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(role || '');
  // WhatsApp order intake — platform staff only (server endpoints are
  // super_admin-only; the module itself is usable by both platform roles).
  if (isUnder(path, routes.whatsappOrders.list)) return PLATFORM_ROLES.includes(role as UserRole);
  if (PLATFORM_ROLES.includes(role as UserRole)) return true;
  if (['/executive', '/financial', '/tenants', '/products', '/occasion-requests'].some(p => isUnder(path, p))) return false;
  if (isUnder(path, '/inventory') && customPermissions.includes('inventory:read')) return true;
  if (isUnder(path, '/settings/api-keys')) return role === 'tenant_owner' || role === 'tenant_admin' || customPermissions.includes('settings:read');
  if (isUnder(path, '/banners') || isUnder(path, '/banner')) return role === 'tenant_owner' || role === 'tenant_admin';
  if (isUnder(path, '/merchandising')) return role === 'tenant_owner' || role === 'tenant_admin';
  if (isUnder(path, '/advertising')) return role === 'tenant_owner' || role === 'tenant_admin';
  if (isUnder(path, '/bookings')) return role === 'tenant_owner' || role === 'tenant_admin';
  if (['/appraisals/cycles', '/appraisals/templates'].some(p => isUnder(path, p))) {
    return canAdministerAppraisals(role);
  }
  if (MANAGER_PATHS.some(p => isUnder(path, p))) return role === 'tenant_owner' || role === 'tenant_admin';
  return true;
}
