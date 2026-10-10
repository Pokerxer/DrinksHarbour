// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ForecastPage from './forecast-page';
let warehouse = '',
  stock = true,
  report = true;
const refresh = vi.fn(),
  set = vi.fn();
const row = (name: string, summary = false) => ({
  key: name + (summary ? 'sum' : ''),
  productName: name,
  productImage: 'https://example.com/forecast-wine.jpg',
  sizeName: '75cl',
  subProductId: 'a'.repeat(24),
  sizeId: 'b'.repeat(24),
  warehouseId: summary ? '' : 'c'.repeat(24),
  warehouseName: summary ? 'Tenant total' : 'Main',
  summary,
  available: 10,
  units30: 30,
  committedOutboundUnits: 0,
  incoming: [],
  forecast: {
    method: 'historical_baseline',
    startDate: '2026-10-08T23:00:00Z',
    historyDays: 42,
    validation: { status: 'good', reason: 'Good validation' },
    daily: Array(90).fill(1),
    limitations: [],
  },
});
vi.mock('../insights/use-insight-plan', () => ({
  useInsightPlan: () => ({
    scope: 'tenant',
    loading: false,
    error: '',
    refresh,
    data: {
      generatedAt: '2026-10-09',
      warnings: [],
      warehouses: [{ _id: 'c'.repeat(24), name: 'Main' }],
      canSeeStock: stock,
      canSeeDemand: report,
      canReviewRestock: stock,
      lines: [
        row('Drink'),
        { ...row('Other location'), warehouseId: 'd'.repeat(24) },
      ],
      summaries: [row('Drink', true)],
    },
  }),
}));
vi.mock('../insights/insight-controls', () => ({
  default: () => null,
  usePlanningFilters: () => ({
    query: 'coverDays=14',
    warehouseId: warehouse,
    set,
    setRange: set,
    startDate: '',
    endDate: '',
  }),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
  warehouse = '';
  stock = true;
  report = true;
  vi.clearAllMocks();
});
it('tenant summaries explain allocation and do not offer a local purchase', () => {
  render(<ForecastPage />);
  expect(
    screen.getByText(/Tenant totals forecast customer sales/)
  ).toBeTruthy();
  expect(
    screen.queryByRole('link', { name: 'Review supplier plan →' })
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /View Drink/ }));
  expect(
    within(screen.getByRole('dialog')).getByText('Choose a warehouse')
  ).toBeTruthy();
  expect(
    screen.queryByRole('link', { name: /Review supplier plan/ })
  ).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Close forecast details' })
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Forecast horizon' }), {
    target: { value: '7' },
  });
  expect(screen.getAllByText('7 units').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getAllByText('30 units').length).toBeGreaterThan(0);
});
it('local forecast uses selected horizon, exposes shortages and exact warehouse actions', () => {
  warehouse = 'c'.repeat(24);
  render(<ForecastPage />);
  expect(screen.queryByRole('heading', { name: /Other location/ })).toBeNull();
  expect(screen.getByText('20 units')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /View Drink/ }));
  expect(
    screen
      .getByRole('link', { name: 'Review supplier plan →' })
      .getAttribute('href')
  ).toContain('sizeId=' + 'b'.repeat(24));
  fireEvent.click(
    screen.getByRole('button', { name: 'Close forecast details' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Forecast shortfall' })
  );
  expect(screen.getByRole('heading', { name: /Drink/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Forecast horizon' }), {
    target: { value: '7' },
  });
  expect(screen.queryByRole('heading', { name: /Drink/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByRole('heading', { name: /Drink/ })).toBeTruthy();
});
it('report-only views do not expose inventory calculations or buying actions', () => {
  stock = false;
  warehouse = 'c'.repeat(24);
  render(<ForecastPage />);
  fireEvent.click(screen.getByRole('button', { name: /View Drink/ }));
  expect(screen.queryByText('Available now')).toBeNull();
  expect(screen.queryByText(/After commitments/)).toBeNull();
  expect(
    screen.queryByRole('link', { name: 'Review supplier plan →' })
  ).toBeNull();
});
it('missing report permission does not render forecast totals', () => {
  report = false;
  render(<ForecastPage />);
  expect(
    screen.getByText('Report access is required to view forecasts.')
  ).toBeTruthy();
  expect(screen.queryByText('Expected next 30 days')).toBeNull();
});

it('keeps cards compact and opens full evidence with exact location actions', async () => {
  warehouse = 'c'.repeat(24);
  render(<ForecastPage />);
  const card = screen.getByRole('button', { name: /View Drink/ });
  expect(card.getAttribute('aria-haspopup')).toBe('dialog');
  expect(
    within(card).getByRole('img', { name: 'Drink' }).getAttribute('src')
  ).toContain('forecast-wine.jpg');
  expect(within(card).getByText('30 units')).toBeTruthy();
  expect(screen.queryByText('Completed history')).toBeNull();
  expect(
    screen.queryByRole('link', { name: /Review supplier plan/ })
  ).toBeNull();
  card.focus();
  fireEvent.click(card);
  const dialog = screen.getByRole('dialog', { name: /Drink 75cl/ });
  expect(within(dialog).getByText('Completed history')).toBeTruthy();
  expect(within(dialog).getByText('42 days')).toBeTruthy();
  expect(within(dialog).getByText(/After commitments: 10 units/)).toBeTruthy();
  expect(
    within(dialog)
      .getByRole('link', { name: /Review supplier plan/ })
      .getAttribute('href')
  ).toContain('warehouseId=' + 'c'.repeat(24));
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Close forecast details' })
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(card));
  fireEvent.click(card);
  fireEvent.keyDown(document.activeElement || document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('horizon changes close details and reopen the current projection', () => {
  warehouse = 'c'.repeat(24);
  render(<ForecastPage />);
  fireEvent.click(screen.getByRole('button', { name: /View Drink/ }));
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Forecast horizon', hidden: true }),
    {
      target: { value: '7' },
    }
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /View Drink/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Expected next 7 days')).toBeTruthy();
  expect(
    within(dialog).getByText('Expected next 7 days').nextElementSibling
      ?.textContent
  ).toBe('7 units');
  expect(within(dialog).getByText('0 units')).toBeTruthy();
});
