// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import ProductsLayout from './layout';

vi.mock('@/layouts/hydrogen/app-launcher', () => ({
  LauncherButton: () => <button aria-label="Open apps" />,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/products',
}));

const mockRole = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: mockRole() } } }),
}));

afterEach(cleanup);

it('renders POS-style module chrome with the super-admin queue tab', () => {
  mockRole.mockReturnValue('super_admin');
  const { container } = render(
    <ProductsLayout>
      <div>products page</div>
    </ProductsLayout>
  );

  // Module header chrome: launcher, brand logo, mobile menu control.
  expect(screen.getByRole('button', { name: 'Open apps' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'DrinksHarbour' })).toBeTruthy();
  const menuButton = screen.getByRole('button', { name: 'All Products' });
  expect(menuButton.getAttribute('aria-controls')).toBe('module-mobile-menu');
  expect(menuButton.getAttribute('aria-expanded')).toBe('false');

  // Tabs point at the product routes; the queue is super-admin-only.
  expect(
    screen.getByRole('link', { name: 'All Products' }).getAttribute('href')
  ).toBe('/products');
  expect(
    screen.getByRole('link', { name: 'Pending Approvals' }).getAttribute('href')
  ).toBe('/products/pending');
  expect(
    screen.getByRole('link', { name: 'Add Product' }).getAttribute('href')
  ).toBe('/products/create');

  // Children stay rendered inside the content canvas.
  expect(screen.getByText('products page')).toBeTruthy();
  // Nav header and content share the full-bleed wrapper.
  expect(container.querySelector('nav')).toBeTruthy();
});

it('keeps every product tab except the approval queue for non-super-admin staff', () => {
  mockRole.mockReturnValue('admin');
  render(
    <ProductsLayout>
      <div>products page</div>
    </ProductsLayout>
  );
  expect(screen.getByRole('link', { name: 'All Products' })).toBeTruthy();
  expect(
    screen.queryByRole('link', { name: 'Pending Approvals' })
  ).toBeNull();
  expect(screen.getByRole('link', { name: 'Add Product' })).toBeTruthy();
});
