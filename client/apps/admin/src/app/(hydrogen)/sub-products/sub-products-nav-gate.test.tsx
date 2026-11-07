// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import SubProductsNavGate from './sub-products-nav-gate';

vi.mock('@/layouts/hydrogen/app-launcher', () => ({
  LauncherButton: () => <button aria-label="Open apps" />,
}));

const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
  usePathname: () => '/sub-products',
}));

afterEach(cleanup);

it('renders ModuleNavHeader chrome on the normal (non-POS) sub-products view', () => {
  mockSearchParams.mockReturnValue(new URLSearchParams());
  render(<SubProductsNavGate />);

  expect(screen.getByRole('img', { name: 'DrinksHarbour' })).toBeTruthy();
  // The mobile Menu control's accessible label shows the active destination.
  const menuButton = screen.getByRole('button', { name: 'My Sub-Products' });
  expect(menuButton.getAttribute('aria-controls')).toBe('module-mobile-menu');
  expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  expect(
    screen.getByRole('link', { name: 'My Sub-Products' }).getAttribute('href')
  ).toBe('/sub-products');
  expect(
    screen.getByRole('link', { name: 'Add Sub-Product' }).getAttribute('href')
  ).toBe('/sub-products/create');
});

it('renders no module chrome when ?from=pos (the page owns POSNavHeader)', () => {
  mockSearchParams.mockReturnValue(new URLSearchParams({ from: 'pos' }));
  const { container } = render(<SubProductsNavGate />);

  expect(screen.queryByText('Sub-Products', { selector: 'span' })).toBeNull();
  expect(container.textContent).toBe('');
});
