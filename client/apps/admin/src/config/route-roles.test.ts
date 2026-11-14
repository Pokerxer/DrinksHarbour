import { expect, test } from 'vitest';
import { roleCanAccessRoute } from './route-roles';
for (const path of ['/retail-tools/price-checker', '/accounting', '/purchases/create', '/inventory', '/warehouses/a', '/contacts', '/point-of-sale/settings', '/pos/pricelists']) {
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

test('restricts occasion request customer contacts and replies to platform staff', () => {
  for (const role of ['tenant_owner','tenant_admin','tenant_staff','customer']) {
    expect(roleCanAccessRoute('/occasion-requests',role)).toBe(false);
    expect(roleCanAccessRoute('/occasion-requests/123',role)).toBe(false);
  }
  expect(roleCanAccessRoute('/occasion-requests','admin')).toBe(true);
  expect(roleCanAccessRoute('/occasion-requests','super_admin')).toBe(true);
});

test('market configuration routes match their distinct API audiences',()=>{
 for(const role of ['tenant_owner','tenant_admin','tenant_staff','admin'])expect(roleCanAccessRoute('/settings/countries',role)).toBe(false);
 expect(roleCanAccessRoute('/settings/countries','super_admin')).toBe(true);
 for(const path of ['/settings/market-enrollment','/settings/sales-channels'])expect(roleCanAccessRoute(path,'tenant_staff')).toBe(false);
 expect(roleCanAccessRoute('/settings/market-enrollment','admin')).toBe(false);
 expect(roleCanAccessRoute('/settings/market-enrollment','tenant_owner')).toBe(true);
 expect(roleCanAccessRoute('/settings/sales-channels','tenant_owner')).toBe(true);
});
test('delivery review workspace stays platform-only including nested routes', () => {
  for (const path of ['/delivery-settings', '/delivery-settings/reviews']) {
    for (const role of ['tenant_owner', 'tenant_admin', 'tenant_staff', 'customer', 'viewer']) {
      expect(roleCanAccessRoute(path, role, ['settings:write'])).toBe(false);
    }
    expect(roleCanAccessRoute(path, 'admin')).toBe(true);
    expect(roleCanAccessRoute(path, 'super_admin')).toBe(true);
  }
});

test('central catalogue approval queue is super_admin-only', () => {
  for (const role of ['tenant_owner', 'tenant_admin', 'tenant_staff', 'customer', 'admin']) {
    expect(roleCanAccessRoute('/products/pending', role)).toBe(false);
    expect(roleCanAccessRoute('/products/pending/some-id', role)).toBe(false);
  }
  expect(roleCanAccessRoute('/products/pending', 'super_admin')).toBe(true);
  // The rest of the /products catalogue stays open to platform staff.
  expect(roleCanAccessRoute('/products', 'admin')).toBe(true);
});

test('WhatsApp intake and builder are restricted to platform staff inside Orders', () => {
  for (const path of ['/ecommerce/orders/whatsapp', '/ecommerce/orders/whatsapp/create']) {
    expect(roleCanAccessRoute(path, 'super_admin')).toBe(true);
    expect(roleCanAccessRoute(path, 'admin')).toBe(true);
    for (const role of ['tenant_owner', 'tenant_admin', 'tenant_staff', 'customer']) {
      expect(roleCanAccessRoute(path, role)).toBe(false);
    }
  }
  expect(roleCanAccessRoute('/ecommerce/orders', 'tenant_owner')).toBe(true);
});
