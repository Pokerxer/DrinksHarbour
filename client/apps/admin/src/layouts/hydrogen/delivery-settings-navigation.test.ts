import { expect, test } from 'vitest';
import { menuItems } from './menu-items';
import { buildTenantGroups } from './app-launcher-utils';

test('platform settings discovers delivery review without adding tenant authority', () => {
  const settings = menuItems.find((item) => item.name === 'Settings');
  expect(settings?.dropdownItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'Delivery settings', href: '/delivery-settings' }),
  ]));
  for (const role of ['tenant_owner', 'tenant_admin', 'tenant_staff']) {
    const links = buildTenantGroups('pro', role).flatMap((group) => group.tiles)
      .flatMap((tile) => [tile.href, ...(tile.children ?? []).map((child) => child.href)]);
    expect(links).not.toContain('/delivery-settings');
  }
});
