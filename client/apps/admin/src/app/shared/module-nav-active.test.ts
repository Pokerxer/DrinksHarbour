import { expect, test } from 'vitest';
import { activeModuleHref } from './module-nav-active';
test('selects only the most specific settings tab', () => {
  const links = ['/settings', '/settings/document-templates', '/settings/billing'];
  expect(activeModuleHref('/settings/document-templates', links)).toBe('/settings/document-templates');
  expect(activeModuleHref('/settings/billing/history', links)).toBe('/settings/billing');
  expect(activeModuleHref('/settings-other', links)).toBeUndefined();
});
