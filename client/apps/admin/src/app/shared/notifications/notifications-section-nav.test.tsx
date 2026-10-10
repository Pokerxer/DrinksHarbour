// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import NotificationsSectionNav from './notifications-section-nav';
vi.mock('next/navigation', () => ({
  usePathname: () => '/notifications/performance',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { role: 'tenant_staff', token: 'token' } },
  }),
}));
vi.mock('@/hooks/use-effective-permissions', () => ({
  useEffectivePermissions: () => ({ customPermissions: ['reports:read'] }),
}));
vi.mock('@/layouts/hydrogen/app-launcher', () => ({
  LauncherButton: () => <button aria-label="Open apps" />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(cleanup);
it('uses POS-style app launcher and branding while preserving permitted active navigation', () => {
  render(<NotificationsSectionNav />);
  expect(screen.getByRole('button', { name: 'Open apps' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'DrinksHarbour' })).toBeTruthy();
  expect(
    screen
      .getByRole('link', { name: 'Sales performance' })
      .getAttribute('aria-current')
  ).toBe('page');
  expect(screen.queryByRole('link', { name: 'Vendor orders' })).toBeNull();
});
