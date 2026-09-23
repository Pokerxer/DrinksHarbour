import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ path: '/kiosk/price-checker/counter' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('react-hot-toast', () => ({ Toaster: () => 'toast-overlay' }));
vi.mock('@/app/api/auth/[...nextauth]/auth-provider', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/context/TenantContext', () => ({
  TenantProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/shared/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  JotaiProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/shared/drawer-views/container', () => ({ default: () => 'drawer-overlay' }));
vi.mock('@/app/shared/modal-views/container', () => ({ default: () => 'modal-overlay' }));
vi.mock('@/app/shared/document-templates/document-export-host', () => ({
  default: () => 'document-overlay',
}));
vi.mock('@/components/extension-error-filter', () => ({ default: () => null }));
vi.mock('@/components/entitlement-error-toast', () => ({ default: () => 'billing-overlay' }));
import AdminShell from '../../../components/admin-shell';
const render = () =>
  renderToStaticMarkup(
    React.createElement(AdminShell, {
      session: null,
      initialTenant: null,
      children: React.createElement('main', null, 'customer-screen'),
    })
  );
test('customer kiosk mounts only its screen without admin overlays', () => {
  state.path = '/kiosk/price-checker/counter';
  expect(render()).toBe('<main>customer-screen</main>');
});
test('management and attendance retain the existing admin providers and overlays', () => {
  for (const path of ['/retail-tools/price-checker', '/kiosk/attendance-token']) {
    state.path = path;
    expect(render()).toContain('drawer-overlay');
    expect(render()).toContain('billing-overlay');
  }
});
