// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import ProductsNavGate from './products-nav-gate';

vi.mock('@/layouts/hydrogen/app-launcher', () => ({
  LauncherButton: () => <button aria-label="Open apps" />,
}));

const mockRole = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: mockRole() } } }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/products',
}));

afterEach(cleanup);

it('shows the approval queue tab only to the super-admin', () => {
  mockRole.mockReturnValue('super_admin');
  render(<ProductsNavGate />);
  expect(
    screen.getByRole('link', { name: 'All Products' }).getAttribute('href')
  ).toBe('/products');
  expect(
    screen.getByRole('link', { name: 'Pending Approvals' }).getAttribute('href')
  ).toBe('/products/pending');
  expect(
    screen.getByRole('link', { name: 'Add Product' }).getAttribute('href')
  ).toBe('/products/create');
});

it('hides the approval queue tab from every other platform role', () => {
  mockRole.mockReturnValue('admin');
  render(<ProductsNavGate />);
  expect(screen.getByRole('link', { name: 'All Products' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Pending Approvals' })).toBeNull();
});

it('keeps the module tab strip empty of catalog links for tenant roles', () => {
  mockRole.mockReturnValue('tenant_owner');
  const { container } = render(<ProductsNavGate />);
  expect(screen.queryByRole('link', { name: 'All Products' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Pending Approvals' })).toBeNull();
  expect(container.querySelector('nav')).toBeTruthy();
});
