// @vitest-environment jsdom
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  waitFor,
} from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import type {
  InsightPlan,
  InsightLine,
} from '@/services/notificationInsights.service';
import PerformancePage from './performance-page';
const product = (
  key: string,
  units30: number | null,
  units7: number,
  previousUnits7: number
): InsightLine => ({
  key,
  subProductId: key,
  sizeId: 's',
  warehouseId: '',
  summary: true,
  productName: key,
  productImage: 'https://example.com/bottle.jpg',
  sku: key,
  sizeName: '75cl',
  warehouseName: 'All locations · tenant total',
  units30,
  units7,
  previousUnits7,
  dailySales: units30 === null ? null : units30 / 30,
  available: 10,
  salesDataStatus: units30 === null ? 'incomplete_history' : 'recorded',
});
const rows = [
  product('Fast wine', 30, 10, 5),
  product('Slow wine', 5, 1, 2),
  product('Quiet wine', 0, 0, 0),
  product('Missing history', null, 0, 0),
];
const makePlan = (): InsightPlan => ({
  generatedAt: '2026-10-09T12:00:00Z',
  historyEnd: '2026-10-08T23:00:00Z',
  coverDays: 14,
  warehouses: [],
  warnings: [],
  canSeeDemand: true,
  canSeeStock: true,
  canPurchase: true,
  canReviewRestock: true,
  lines: [
    { ...rows[1], key: 'local', warehouseId: 'w', productName: 'Local wine' },
  ],
  summaries: rows,
});
let plan = makePlan(),
  warehouseId = '',
  scope = 'tenant-a',
  error = '';
vi.mock('../insights/use-insight-plan', () => ({
  useInsightPlan: () => ({
    data: error ? null : plan,
    loading: false,
    error,
    scope,
    refresh: vi.fn(),
  }),
}));
vi.mock('../insights/insight-controls', () => ({
  default: () => null,
  usePlanningFilters: () => ({ query: 'coverDays=14', warehouseId }),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
  plan = makePlan();
  warehouseId = '';
  scope = 'tenant-a';
  error = '';
});
it('uses tenant summaries, filters trends and opens exact variant details', () => {
  render(<PerformancePage />);
  expect(
    screen.getByRole('heading', { name: 'Sales performance' })
  ).toBeTruthy();
  expect(screen.queryByText('Local wine')).toBeNull();
  fireEvent.change(screen.getByLabelText('Performance filter'), {
    target: { value: 'falling' },
  });
  expect(screen.getByRole('button', { name: /View Slow wine/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /View Fast wine/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /View Slow wine/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(/Previous 7 days/)).toBeTruthy();
  expect(
    within(dialog)
      .getByRole('link', { name: 'Review restock' })
      .getAttribute('href')
  ).toContain('sizeId=s');
});
it('stock and purchase details follow permissions, modal follows refreshed evidence', () => {
  const { rerender } = render(<PerformancePage />);
  fireEvent.click(screen.getByRole('button', { name: /View Fast wine/ }));
  expect(
    within(screen.getByRole('dialog')).getByText(/Available stock/)
  ).toBeTruthy();
  plan = {
    ...plan,
    canSeeStock: false,
    canPurchase: false,
    canReviewRestock: false,
    summaries: rows.map((row) =>
      row.key === 'Fast wine' ? { ...row, units7: 20 } : row
    ),
  };
  rerender(<PerformancePage />);
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText(/Available stock/)).toBeNull();
  expect(
    within(dialog).queryByRole('link', { name: 'Review restock' })
  ).toBeNull();
  expect(within(dialog).getByText(/300%/)).toBeTruthy();
});
it('warehouse and tenant changes reset selections, and permissions/error never show false totals', () => {
  const { rerender } = render(<PerformancePage />);
  fireEvent.click(screen.getByRole('button', { name: /View Fast wine/ }));
  warehouseId = 'w';
  scope = 'tenant-a-w';
  rerender(<PerformancePage />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Local wine')).toBeTruthy();
  plan = { ...plan, canSeeDemand: false };
  rerender(<PerformancePage />);
  expect(screen.queryByRole('button', { name: /View Local wine/ })).toBeNull();
  expect(screen.getByText(/Report access is required/)).toBeTruthy();
  error = 'Unable to read sales';
  rerender(<PerformancePage />);
  expect(screen.getByRole('alert').textContent).toContain(
    'Unable to read sales'
  );
  expect(screen.queryByText('Recorded units · 30 days')).toBeNull();
});
it('search/filter changes close details and reveal honest no-match state', () => {
  render(<PerformancePage />);
  fireEvent.click(screen.getByRole('button', { name: /View Fast wine/ }));
  fireEvent.change(screen.getByLabelText('Search performance products'), {
    target: { value: 'not found' },
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText(/No products match/)).toBeTruthy();
});

it('removed selections stay closed if the product returns on a later refresh', async () => {
  const { rerender } = render(<PerformancePage />);
  fireEvent.click(screen.getByRole('button', { name: /View Fast wine/ }));
  plan = { ...plan, summaries: rows.filter((row) => row.key !== 'Fast wine') };
  rerender(<PerformancePage />);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  plan = makePlan();
  rerender(<PerformancePage />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('paging resets after filtering and empty plans show their own state', () => {
  plan = {
    ...plan,
    summaries: Array.from({ length: 30 }, (_, i) =>
      product(`Wine ${i}`, i, i, 1)
    ),
  };
  const { rerender } = render(<PerformancePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('2 / 2')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search performance products'), {
    target: { value: 'Wine 29' },
  });
  expect(screen.getByRole('button', { name: /View Wine 29/ })).toBeTruthy();
  expect(screen.queryByText('2 / 2')).toBeNull();
  scope = 'new';
  plan = { ...makePlan(), summaries: [] };
  rerender(<PerformancePage />);
  expect(screen.getByText('No product sales entries yet')).toBeTruthy();
});
it('hero cards filter products, clear search and reset all result controls', () => {
  render(<PerformancePage />);
  fireEvent.click(
    screen.getByRole('button', { name: /Filter performance: Slowing down/ })
  );
  expect(screen.getByRole('button', { name: /View Slow wine/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /View Fast wine/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('Search performance products'), {
    target: { value: 'slow' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Clear product search' }));
  expect(
    (screen.getByLabelText('Search performance products') as HTMLInputElement)
      .value
  ).toBe('');
  fireEvent.change(screen.getByLabelText('Performance sort'), {
    target: { value: 'slowest' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset performance filters' })
  );
  expect(
    (screen.getByLabelText('Performance sort') as HTMLSelectElement).value
  ).toBe('fastest');
  expect(screen.getByRole('button', { name: /View Fast wine/ })).toBeTruthy();
});
it('selected warehouse excludes rows returned for a different location', () => {
  warehouseId = 'w';
  plan = {
    ...plan,
    lines: [
      ...plan.lines,
      { ...rows[0], warehouseId: 'other', productName: 'Other location' },
    ],
  };
  render(<PerformancePage />);
  expect(screen.getByText('Local wine')).toBeTruthy();
  expect(screen.queryByText('Other location')).toBeNull();
});
