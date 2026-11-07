// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, afterEach } from 'vitest';
import TodayMomentum from './today-momentum';
import DashboardProvider from './dashboard-provider';
import type { DashboardData } from '@/services/dashboard.service';

afterEach(cleanup);

const dataWith = (
  today: { orders: number; revenue: number },
  yesterday: { orders: number; revenue: number }
): DashboardData =>
  ({
    statCards: {
      period: { orders: 2, revenue: 100 },
      previous: { orders: 1, revenue: 50 },
      today,
      yesterday,
      pendingOrders: 0,
      lowStockCount: 0,
      avgOrderValue: 25,
      sparkline: [],
    },
    recentOrders: [],
  }) as unknown as DashboardData;

it('renders today tiles with the against-yesterday guidance and delta badge', () => {
  render(
    <DashboardProvider data={dataWith({ orders: 3, revenue: 5000 }, { orders: 2, revenue: 3000 })}>
      <TodayMomentum />
    </DashboardProvider>
  );

  expect(screen.getByText('Orders today')).toBeTruthy();
  expect(screen.getByText('Revenue today')).toBeTruthy();
  expect(screen.getByText('Orders vs yesterday')).toBeTruthy();
  expect(screen.getByText('Revenue vs yesterday')).toBeTruthy();
  // Ordinary figures stay plain; Naira figures use the compact helper.
  expect(screen.getByText('₦5K')).toBeTruthy();
  // Delta is icon + % with an explicit aria name (never colour-only).
  expect(screen.getByRole('img', { name: 'Up 50% vs yesterday' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Up 66.7% vs yesterday' })).toBeTruthy();

});

it('shows a New day empty state when both edges are zero (midnight grace)', () => {
  render(
    <DashboardProvider data={dataWith({ orders: 0, revenue: 0 }, { orders: 0, revenue: 0 })}>
      <TodayMomentum />
    </DashboardProvider>
  );

  expect(screen.queryByText('Orders today')).toBeNull();
  expect(screen.getByText('New day — check back later')).toBeTruthy();
});

it('degrades to placeholders while the dashboard payload has not streamed in', () => {
  render(
    <DashboardProvider data={null}>
      <TodayMomentum />
    </DashboardProvider>
  );

  expect(screen.getByText('Today at a glance')).toBeTruthy();
  expect(screen.queryByText('Orders vs yesterday')).toBeNull();
});

it('still tiles a real move-down day instead of collapsing to the empty state', () => {
  render(
    <DashboardProvider data={dataWith({ orders: 0, revenue: 3000 }, { orders: 5, revenue: 9000 })}>
      <TodayMomentum />
    </DashboardProvider>
  );

  expect(screen.getByText('Orders today')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Down 100% vs yesterday' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Down 66.7% vs yesterday' })).toBeTruthy();
  expect(screen.queryByText('New day — check back later')).toBeNull();
});
