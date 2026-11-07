// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, afterEach } from 'vitest';
import NeedsAttention from './needs-attention';
import DashboardProvider from './dashboard-provider';
import { routes } from '@/config/routes';
import type { DashboardData } from '@/services/dashboard.service';

afterEach(cleanup);

const PENDING_ROW = {
  id: 'ord-77',
  orderNumber: 'DH-2291',
  customer: 'Hidden',
  total: 12500,
  status: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'card',
  placedAt: new Date(Date.now() - 15 * 60000).toISOString(),
  hasAccount: false,
  vendors: [],
};

const dataWith = (overrides: {
  pendingOrders?: number;
  lowStockCount?: number;
  recentOrders?: unknown[];
}): DashboardData =>
  ({
    statCards: {
      period: { orders: 2, revenue: 100 },
      previous: { orders: 1, revenue: 50 },
      today: { orders: 1, revenue: 60 },
      yesterday: { orders: 1, revenue: 60 },
      avgOrderValue: 25,
      sparkline: [],
      ...overrides,
    },
    recentOrders: overrides.recentOrders ?? [],
  }) as unknown as DashboardData;

it('links both confirmed queue metrics to their real deep-linked routes', () => {
  render(
    <DashboardProvider data={dataWith({ pendingOrders: 3, lowStockCount: 5 })}>
      <NeedsAttention />
    </DashboardProvider>
  );

  const ordersRow = screen.getByRole('link', { name: /Orders to review/ });
  expect(ordersRow.getAttribute('href')).toBe(routes.eCommerce.orders);
  const stockRow = screen.getByRole('link', { name: /Low \/ out-of-stock products/ });
  expect(stockRow.getAttribute('href')).toBe(routes.eCommerce.subProducts);
  // Count pills carry the numbers themselves, not just colour.
  expect(screen.getByText('Orders to review').textContent).toContain(
    'Orders to review'
  );
  expect(ordersRow.textContent).toContain('3');
  expect(stockRow.textContent).toContain('5');
});

it('previews up to 3 latest pending rows as real order-detail deep links', () => {
  const rows = [1, 2, 3, 4].map((i) => ({
    ...PENDING_ROW,
    id: `ord-${i}`,
    orderNumber: `DH-229${i}`,
  }));
  render(
    <DashboardProvider
      data={dataWith({ pendingOrders: 4, recentOrders: rows })}
    >
      <NeedsAttention />
    </DashboardProvider>
  );

  const links = screen.getAllByRole('link', { name: /DH-229/ });
  // Only the newest three rows are previewed; each links to its own order.
  expect(links.length).toBe(3);
  expect(
    links
      .map((l) => l.getAttribute('href') ?? '')
      .every((href) => href.startsWith(routes.eCommerce.orders + '/'))
  ).toBe(true);
  expect(screen.getByText('DH-2291')).toBeTruthy(); // newest first slice
  expect(screen.queryByText('DH-2294')).toBeNull(); // oldest extra dropped
});

it('falls back to count+CTA only when no pending rows are in the payload', () => {
  render(
    <DashboardProvider data={dataWith({ pendingOrders: 2 })}>
      <NeedsAttention />
    </DashboardProvider>
  );

  expect(
    screen.getByRole('link', { name: /Orders to review/ })
  ).toBeTruthy();
  expect(screen.queryByText(/DH-/)).toBeNull();
});

it('shows an All clear empty state when both counts are zero', () => {
  render(
    <DashboardProvider data={dataWith({ pendingOrders: 0, lowStockCount: 0 })}>
      <NeedsAttention />
    </DashboardProvider>
  );

  expect(screen.getByText('All clear — nothing waiting on you')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Review/ })).toBeNull();
});

it('placeholders while payload missing, then no crash', () => {
  render(
    <DashboardProvider data={null}>
      <NeedsAttention />
    </DashboardProvider>
  );
  expect(screen.getByText('Needs attention')).toBeTruthy();
  expect(screen.queryByText('Orders to review')).toBeNull();
});
