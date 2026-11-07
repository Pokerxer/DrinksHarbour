// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, afterEach } from 'vitest';
import BestSellers from './best-sellers';
import DashboardProvider from './dashboard-provider';
import { routes } from '@/config/routes';
import type { DashboardData, TopProduct } from '@/services/dashboard.service';

afterEach(cleanup);

const product = (overrides: Partial<TopProduct>): TopProduct =>
  ({
    id: 'p-1',
    name: 'Bottle',
    image: null,
    sku: 'BOT-01',
    sold: 12,
    revenue: 4500,
    stock: 8,
    stockStatus: 'in_stock',
    margin: 40,
    vendor: null,
    ...overrides,
  }) as TopProduct;

const productWith = (products: TopProduct[]): DashboardData =>
  ({ topProducts: products }) as unknown as DashboardData;

// The client widget reads the context payload, so old-server rows (no slug)
// and new-server rows (slug present) can flow through the same component.

const bare = product({});
const withSlug: TopProduct & { productSlug?: string } = {
  ...product({ id: 'p-2' }),
  productSlug: 'castle-lager',
};

it('shows the pinned visible name and units/revenue format for a legacy row', () => {
  render(
    <DashboardProvider data={productWith([bare])}>
      <BestSellers />
    </DashboardProvider>
  );

  expect(screen.getByText('Bottle')).toBeTruthy();
  expect(screen.getByText(/12 sold · ₦4\.5K/)).toBeTruthy();
  // No identifiable product → no product deep link anywhere on the row.
  expect(
    screen
      .getAllByRole('link')
      .every((l) => l.getAttribute('href') !== `/products/${''}`)
  ).toBe(true);
});

it('deep-links a row that carries a productSlug (real `/products/[slug]` route)', () => {
  render(
    <DashboardProvider data={productWith([withSlug])}>
      <BestSellers />
    </DashboardProvider>
  );

  const row = screen.getByRole('link', { name: /Bottle|Castle/i });
  // The product name is the row body; the link target is the real route.
  expect(row.getAttribute('href')).toBe('/products/castle-lager');
});

it("never renders a link for an empty-string slug (serialiser's legacy default)", () => {
  const empty: TopProduct & { productSlug?: string } = {
    ...product({ id: 'p-3' }),
    productSlug: '',
  };
  render(
    <DashboardProvider data={productWith([empty])}>
      <BestSellers />
    </DashboardProvider>
  );

  expect(screen.getByText('Bottle')).toBeTruthy();
  expect(
    screen.queryByRole('link', { name: /Bottle/ })
  ).toBeNull();
});
