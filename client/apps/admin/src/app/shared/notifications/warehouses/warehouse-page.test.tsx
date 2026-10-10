// @vitest-environment jsdom
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import WarehousePage from './warehouse-page';
import type {
  InsightPlan,
  InsightLine,
} from '@/services/notificationInsights.service';
const forecast = {
  method: 'historical_baseline' as const,
  model: null,
  daily: Array(90).fill(1),
  startDate: '2026-10-09T00:00:00Z',
  historyDays: 40,
  errors: null,
  demand7: 7,
  demand14: 14,
  demand30: 30,
  limitations: [],
};
const line = (
  key: string,
  changes: Partial<InsightLine> = {}
): InsightLine => ({
  key,
  subProductId: 'b'.repeat(24),
  sizeId: 'c'.repeat(24),
  warehouseId: 'a'.repeat(24),
  productName: key,
  sku: key,
  sizeName: 'Bottle',
  warehouseName: 'Main',
  available: 10,
  threshold: 10,
  units30: 30,
  dailySales: 1,
  daysOfCover: 10,
  forecast,
  ...changes,
});
const original: InsightPlan = {
  generatedAt: '2026-10-09T12:00:00Z',
  warehouses: [
    { _id: 'a'.repeat(24), name: 'Main' },
    { _id: 'd'.repeat(24), name: 'Secondary' },
  ],
  coverDays: 14,
  warnings: [],
  canSeeStock: true,
  canSeeDemand: true,
  canPurchase: true,
  lines: [
    line('Fast'),
    line('Slow', { units30: 5, available: 5, daysOfCover: 30 }),
    line('Healthy', { available: 100 }),
    line('Other', {
      warehouseId: 'd'.repeat(24),
      warehouseName: 'Secondary',
      available: 0,
    }),
    line('Missing', { available: null }),
  ],
};
let plan = original,
  warehouse = '',
  error = '';
const set = vi.fn(),
  refresh = vi.fn(),
  read = vi.fn();
vi.mock('../insights/use-insight-plan', () => ({
  useInsightPlan: (endpoint: string, query: string) => {
    read(endpoint, query);
    return {
      data: error ? null : plan,
      loading: false,
      error,
      refresh,
      scope: 'u:t',
    };
  },
}));
vi.mock('../insights/insight-controls', () => ({
  usePlanningFilters: () => ({
    query: `coverDays=14${warehouse ? `&warehouseId=${warehouse}` : ''}`,
    warehouseId: warehouse,
    set,
    hasProductFilter: false,
    clearProduct: vi.fn(),
  }),
  default: () => null,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
  plan = original;
  warehouse = '';
  error = '';
  vi.clearAllMocks();
});
it('shows shortages first, ranks faster depletion, filters stock and searches products', () => {
  render(<WarehousePage />);
  const list = screen.getByRole('region', { name: 'Warehouse product alerts' });
  expect(within(list).queryByRole('heading', { name: /Healthy/ })).toBeNull();
  expect(
    within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
  ).toEqual(['Other Bottle', 'Fast Bottle', 'Slow Bottle']);
  fireEvent.change(screen.getByRole('combobox', { name: 'Show products' }), {
    target: { value: 'all' },
  });
  expect(within(list).getByRole('heading', { name: /Healthy/ })).toBeTruthy();
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search warehouse products' }),
    { target: { value: 'Healthy' } }
  );
  expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(1);
});
it('keeps warehouse summaries complete while honoring a location deep link', () => {
  warehouse = 'a'.repeat(24);
  render(<WarehousePage />);
  expect(read).toHaveBeenCalledWith('warehouse-risk', 'coverDays=14');
  expect(
    screen.getByRole('button', { name: /Secondary.*1 needs attention/ })
  ).toBeTruthy();
  const list = screen.getByRole('region', { name: 'Warehouse product alerts' });
  expect(within(list).queryByRole('heading', { name: /Other/ })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: /Secondary.*1 needs attention/ })
  );
  expect(set).toHaveBeenCalledWith('warehouseId', 'd'.repeat(24));
});
it('separates missing stock and hides demand or buying actions without their permissions', () => {
  plan = {
    ...original,
    canSeeDemand: false,
    canPurchase: false,
    lines: original.lines.map(
      ({ forecast, units30, dailySales, daysOfCover, ...line }) => line
    ),
  };
  render(<WarehousePage />);
  fireEvent.click(screen.getByRole('button', { name: /Stock unknown/ }));
  expect(screen.getByRole('heading', { name: /Missing/ })).toBeTruthy();
  expect(screen.queryByText(/units\/day/)).toBeNull();
  expect(screen.queryByRole('link', { name: /Review restock/ })).toBeNull();
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
});
it('failed reads never display healthy zero totals and offer retry', () => {
  error = 'Unable to read stock';
  render(<WarehousePage />);
  expect(screen.getByRole('alert').textContent).toContain(error);
  expect(screen.queryByText('0 needs attention')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refresh).toHaveBeenCalledOnce();
});
it('unassigned location opens missing balances directly without guessing a warehouse', () => {
  warehouse = 'unassigned';
  plan = {
    ...original,
    lines: [
      line('Unassigned', {
        warehouseId: '',
        warehouseName: 'Unassigned location',
        available: null,
      }),
    ],
  };
  render(<WarehousePage />);
  expect(
    screen.getByRole('heading', { name: 'Unassigned Bottle' })
  ).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Review restock/ })).toBeNull();
});
it('paginates the complete filtered set and resets paging after search', () => {
  plan = {
    ...original,
    lines: Array.from({ length: 30 }, (_, i) =>
      line(`Product ${String(i).padStart(2, '0')}`)
    ),
  };
  render(<WarehousePage />);
  const list = screen.getByRole('region', { name: 'Warehouse product alerts' });
  expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(25);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(5);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Product 00' },
  });
  expect(
    within(list).getByRole('heading', { name: 'Product 00 Bottle' })
  ).toBeTruthy();
});
it('warehouse action flags enable owner follow-ups without requiring supplier-data access', () => {
  plan = {
    ...original,
    canPurchase: false,
    canReviewRestock: true,
    canManageTransfers: true,
    lines: [
      line('Source', {
        available: 100,
        transferPlan: {
          basis: 'configured_minimum',
          nextStep: 'monitor',
          needUnits: 0,
          pendingUnits: 0,
          additionalUnits: 0,
          uncoveredUnits: 0,
          outboundUnits: 0,
          protectedUnits: 10,
          availableAfterCommitments: 100,
          pending: [],
          usualSources: [],
          sources: [],
          outgoing: [
            {
              transferId: 'tr',
              reference: 'TR-OWNER',
              status: 'pending_approval',
              sourceWarehouseId: 'a'.repeat(24),
              sourceWarehouseName: 'Main',
              destinationWarehouseName: 'Secondary',
              quantity: 10,
              arrival: null,
              followUpReason: 'Approval needed',
            },
          ],
        },
      }),
    ],
  };
  const { rerender } = render(<WarehousePage />);
  expect(screen.queryByRole('link', { name: /Review approval/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /View Source Bottle/ }));
  expect(
    screen.getByRole('link', { name: /Review approval/ }).getAttribute('href')
  ).toBe('/purchases/transfers/tr');
  fireEvent.click(
    screen.getByRole('button', { name: 'Close product details' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Transfer follow-ups' })
  );
  expect(screen.getByRole('heading', { name: 'Source Bottle' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /View Source Bottle/ }));
  plan = { ...plan, canManageTransfers: false, canReviewRestock: false };
  rerender(<WarehousePage />);
  expect(screen.queryByRole('link', { name: /Review approval/ })).toBeNull();
  expect(screen.queryByRole('link', { name: /Review restock/ })).toBeNull();
});
it('summary filters and reset preserve location while clearing search', () => {
  warehouse = 'a'.repeat(24);
  render(<WarehousePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter: Out of stock' }));
  expect(
    screen
      .getByRole('button', { name: 'Filter: Out of stock' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search warehouse products' }),
    { target: { value: 'missing' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(
    (
      screen.getByRole('searchbox', {
        name: 'Search warehouse products',
      }) as HTMLInputElement
    ).value
  ).toBe('');
  expect(
    (screen.getByRole('combobox', { name: 'Warehouse' }) as HTMLSelectElement)
      .value
  ).toBe(warehouse);
  expect(
    screen
      .getByRole('button', { name: 'Filter: Needs attention' })
      .getAttribute('aria-pressed')
  ).toBe('true');
});
