import { expect, test } from 'vitest';
import { canAccessTenant } from './authorization';
test('platform admins can access tenant scope without their own tenant', () => {
  expect(canAccessTenant('super_admin', null, 'shop')).toBe(true);
  expect(canAccessTenant('admin', null, 'shop')).toBe(true);
});
test('tenant access requires an actual matching tenant role and id', () => {
  expect(canAccessTenant('tenant_staff', 'shop', 'shop')).toBe(true);
  expect(canAccessTenant('tenant_owner', 'shop', 'other')).toBe(false);
  expect(canAccessTenant('tenant_admin', null, 'shop')).toBe(false);
  expect(canAccessTenant('customer', 'shop', 'shop')).toBe(false);
});
