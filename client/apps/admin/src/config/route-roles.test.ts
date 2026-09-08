import { expect, test } from 'vitest';
import { roleCanAccessRoute } from './route-roles';
for (const path of ['/accounting', '/purchases/create', '/inventory', '/warehouses/a', '/contacts', '/point-of-sale/settings', '/pos/pricelists']) {
  test(`${path} follows the manager-only API audience`, () => {
    expect(roleCanAccessRoute(path, 'tenant_staff')).toBe(false);
    expect(roleCanAccessRoute(path, 'tenant_owner')).toBe(true);
    expect(roleCanAccessRoute(path, 'tenant_admin')).toBe(true);
  });
}
test('staff retain sales, POS, personal appraisals and billing status', () => {
  for (const path of ['/sales', '/pos/sell', '/appraisals', '/settings/billing']) {
    expect(roleCanAccessRoute(path, 'tenant_staff')).toBe(true);
  }
  expect(roleCanAccessRoute('/tenants', 'tenant_owner')).toBe(false);
  expect(roleCanAccessRoute('/settings', 'customer')).toBe(false);
});
test('custom grants only open the explicitly supported tenant routes', () => {
  expect(roleCanAccessRoute('/inventory', 'tenant_staff', ['inventory:read'])).toBe(true);
  expect(roleCanAccessRoute('/settings/api-keys', 'tenant_staff', ['settings:read'])).toBe(true);
  expect(roleCanAccessRoute('/settings/api-keys', 'tenant_staff')).toBe(false);
  expect(roleCanAccessRoute('/products', 'tenant_staff', ['products:write'])).toBe(false);
  expect(roleCanAccessRoute('/users', 'tenant_staff', ['users:write'])).toBe(false);
});
