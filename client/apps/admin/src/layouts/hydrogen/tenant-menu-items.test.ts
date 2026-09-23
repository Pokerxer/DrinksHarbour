import { expect, test, vi } from 'vitest';
// The platform menu is unrelated to tenant access and contains template icons.
vi.mock('./menu-items', () => ({ menuItems: [] }));
import { roleAllows } from './tenant-menu-items';
import { buildTenantGroups } from './app-launcher-utils';
test('owner can reach every administrator menu entry', () => {
  expect(roleAllows('tenant_owner', 'tenant_admin')).toBe(true);
  expect(roleAllows('tenant_admin', 'tenant_admin')).toBe(true);
  expect(roleAllows('tenant_staff', 'tenant_admin')).toBe(false);
});
test('staff do not receive manager-only module links', () => {
  const tiles = buildTenantGroups('pro', 'tenant_staff').flatMap(group => group.tiles);
  const links = tiles.flatMap(tile => [tile.href, ...(tile.children ?? []).map(child => child.href)]);
  expect(links.some(href => href.startsWith('/warehouses') || href.startsWith('/purchases') || href.startsWith('/contacts'))).toBe(false);
});
test('tenant owner can find document templates in the launcher', () => {
  const tiles = buildTenantGroups('pro', 'tenant_owner').flatMap(group => group.tiles);
  const links = tiles.flatMap(tile => [tile.href, ...(tile.children ?? []).map(child => child.href)]);
  expect(links).toContain('/settings/document-templates');
});

test('quotations and orders launcher card opens the sales overview', () => {
  const tiles = buildTenantGroups('pro', 'tenant_owner').flatMap(group => group.tiles);
  const salesTile = tiles.find(tile => tile.name === 'Quotations & Orders');

  expect(salesTile?.href).toBe('/sales');
});
