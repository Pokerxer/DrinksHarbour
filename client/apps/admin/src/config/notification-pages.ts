import { ROLE_PERMISSIONS, type UserRole } from '@/types/authorization';
export const notificationPages = [
  { href: '/notifications', label: 'Inbox', permission: '' },
  {
    href: '/notifications/stock',
    label: 'Low stock',
    permission: 'inventory:read',
  },
  {
    href: '/notifications/warehouses',
    label: 'Warehouses',
    permission: 'inventory:read',
  },
  {
    href: '/notifications/performance',
    label: 'Sales performance',
    permission: 'reports:read',
  },
  {
    href: '/notifications/forecasts',
    label: 'Forecasts',
    permission: 'reports:read',
  },
  { href: '/notifications/restock', label: 'Restock', permission: 'purchase' },
  {
    href: '/notifications/vendor-orders',
    label: 'Vendor orders',
    permission: 'purchase',
  },
  {
    href: '/notifications/products',
    label: 'Product updates',
    permission: 'subproducts:read',
  },
  {
    href: '/notifications/promotions',
    label: 'Promotion suggestions',
    permission: 'reports:read',
  },
  {
    href: '/notifications/expiry',
    label: 'Expiry',
    permission: 'inventory:read',
  },
] as const;
export function canOpenNotificationPage(
  path: string,
  role?: string | null,
  customPermissions: string[] = []
) {
  const page = notificationPages.find((p) => p.href === path);
  if (!page || !page.permission) return true;
  if (!['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(role || ''))
    return false;
  if (page.permission === 'purchase')
    return role === 'tenant_owner' || role === 'tenant_admin';
  const grants = new Set([
    ...(ROLE_PERMISSIONS[role as UserRole] || []),
    ...customPermissions,
  ]);
  if (path === '/notifications/promotions')
    return ['reports:read', 'inventory:read', 'subproducts:read'].every((p) =>
      grants.has(p)
    );
  return grants.has(page.permission);
}
