// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import InsightPage from './insight-page';
let method = 'historical_baseline';
vi.mock('./use-insight-plan', () => ({
  useInsightPlan: () => ({
    data: {
      generatedAt: '2026-10-09T12:00:00Z',
      warnings: [],
      warehouses: [],
      canSeeStock: true,
      canSeeDemand: true,
      lines: [
        {
          key: 'p:s:w',
          productName: 'Fast drink',
          subProductId: 'p',
          warehouseId: 'w',
          warehouseName: 'Main warehouse',
          sizeName: 'Bottle',
          available: 10,
          threshold: 10,
          units30: 30,
          dailySales: 1,
          daysOfCover: 10,
          urgency: 'high',
          forecast: {
            method,
            model: null,
            historyDays: 40,
            demand7: 7,
            demand14: 14,
            demand30: 30,
          },
          limitations: [],
        },
      ],
    },
    loading: false,
    error: '',
    refresh: vi.fn(),
  }),
}));
vi.mock('./insight-controls', () => ({
  default: () => null,
  usePlanningFilters: () => ({ query: 'coverDays=14' }),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
  method = 'historical_baseline';
});
it('warehouse page displays local risk and sales pace', () => {
  render(<InsightPage mode="warehouses" />);
  expect(
    screen.getByRole('heading', { name: 'Warehouse alerts' })
  ).toBeTruthy();
  expect(screen.getByText('Main warehouse')).toBeTruthy();
  expect(screen.getAllByText('10 days')).toHaveLength(2);
  expect(screen.getByText('1 units/day')).toBeTruthy();
});
it('forecast page distinguishes historical baseline from trained AI', () => {
  render(<InsightPage mode="forecasts" />);
  expect(screen.getAllByText('Historical baseline')).toHaveLength(2);
  expect(screen.queryByText('AI forecast')).toBeNull();
});
it('missing history remains visible as unknown, not forecast zero', () => {
  method = 'insufficient_history';
  render(<InsightPage mode="warehouses" />);
  expect(screen.getAllByText('Insufficient history')).toHaveLength(2);
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
});
it('summary cards filter missing history and reset restores the forecast view', () => {
  render(<InsightPage mode="forecasts" />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Needs history' })
  );
  expect(screen.queryByRole('heading', { name: /Fast drink/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByRole('heading', { name: /Fast drink/ })).toBeTruthy();
});
