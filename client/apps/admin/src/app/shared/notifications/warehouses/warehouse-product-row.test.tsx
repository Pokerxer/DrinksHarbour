// @vitest-environment jsdom
import React from 'react';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react';
import { it, expect, afterEach, vi } from 'vitest';
import WarehouseProductRow from './warehouse-product-grid';
import WarehouseProductMetrics from './warehouse-product-metrics';
import type { InsightLine } from '@/services/notificationInsights.service';
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(cleanup);
const line: InsightLine = {
  key: 'p:s:w',
  subProductId: 'p',
  sizeId: 's',
  warehouseId: 'w',
  productName: 'Caymus Honor Flight',
  productImage: 'https://example.com/wine.jpg',
  warehouseName: 'Cloud Bay',
  sku: 'WYN48B',
  sizeName: '75cl',
  available: 0,
  threshold: 10,
  units30: 0,
  dailySales: 0,
  salesDataStatus: 'none',
  forecast: {
    method: 'insufficient_history',
    model: null,
    daily: [],
    historyDays: 0,
    startDate: '2026-10-09',
    demand7: null,
    demand14: null,
    demand30: null,
    errors: null,
    limitations: [],
  },
  incoming: [],
};
it('depleted stock with no recorded sales has clear facts and history guidance', () => {
  render(<WarehouseProductRow lines={[line]} demand purchase />);
  expect(screen.queryByText('Depleted')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: /View Caymus Honor Flight/ })
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText('Depleted')).toBeTruthy();
  expect(
    screen.getByText('No sales recorded in the last 30 days')
  ).toBeTruthy();
  expect(screen.queryByText(/Unknown units/)).toBeNull();
  expect(
    screen.getByRole('link', { name: /Review sales history/ })
  ).toBeTruthy();
});
it('ambiguous records are explained without a fabricated zero total or cover', () => {
  render(
    <WarehouseProductRow
      lines={[
        {
          ...line,
          available: 20,
          units30: null,
          dailySales: null,
          recordedUnits30: 4,
          salesDataStatus: 'incomplete_location',
        },
      ]}
      demand
      purchase
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: /View Caymus Honor Flight/ })
  );
  expect(screen.getByText('Needs location data')).toBeTruthy();
  expect(screen.getByText(/4 units assigned here/)).toBeTruthy();
  expect(screen.getByText('Not enough history')).toBeTruthy();
});

it('summary cards show imagery and few stock facts; close and Escape return focus', async () => {
  render(<WarehouseProductRow lines={[line]} demand purchase />);
  const card = screen.getByRole('button', { name: /View Caymus Honor Flight/ });
  expect(
    within(card)
      .getByRole('img', { name: 'Caymus Honor Flight' })
      .getAttribute('src')
  ).toContain('wine.jpg');
  expect(screen.queryByRole('link', { name: /Review restock/ })).toBeNull();
  expect(screen.queryByText('Forecast not ready.')).toBeNull();
  card.focus();
  fireEvent.click(card);
  const dialog = screen.getByRole('dialog');
  expect(
    within(dialog)
      .getByRole('link', { name: /Review restock/ })
      .getAttribute('href')
  ).toContain('warehouseId=w');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Close product details' })
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(card));
  fireEvent.click(card);
  fireEvent.keyDown(document.activeElement || document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('dialog follows refreshed data and still hides unauthorized actions and sales details', () => {
  const { rerender } = render(
    <WarehouseProductRow lines={[line]} demand={false} purchase={false} />
  );
  fireEvent.click(
    screen.getByRole('button', { name: /View Caymus Honor Flight/ })
  );
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByRole('link')).toBeNull();
  expect(within(dialog).queryByText(/Sold here/)).toBeNull();
  rerender(
    <WarehouseProductRow
      lines={[{ ...line, available: 15 }]}
      demand={false}
      purchase={false}
    />
  );
  expect(
    within(screen.getByRole('dialog')).getByText(
      /Stock is above its current minimum/
    )
  ).toBeTruthy();
  rerender(<WarehouseProductRow lines={[]} demand={false} purchase={false} />);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('broken or missing images use a fallback and refreshed images recover', () => {
  const { rerender } = render(
    <WarehouseProductRow lines={[line]} demand purchase />
  );
  fireEvent.error(screen.getByRole('img', { name: line.productName }));
  expect(screen.queryByRole('img')).toBeNull();
  rerender(
    <WarehouseProductRow
      lines={[{ ...line, productImage: 'https://example.com/new.jpg' }]}
      demand
      purchase
    />
  );
  expect(
    screen.getByRole('img', { name: line.productName }).getAttribute('src')
  ).toContain('new.jpg');
  rerender(
    <WarehouseProductRow
      lines={[{ ...line, productImage: null }]}
      demand
      purchase
    />
  );
  expect(screen.queryByRole('img')).toBeNull();
  expect(
    screen.getByRole('button', { name: /View Caymus Honor Flight/ })
  ).toBeTruthy();
});

it('opens combined transfer demand in details and hides it when report access changes', () => {
  const transferred: InsightLine = {
    ...line,
    demandBasis: 'sales_and_transfers',
    units30: 4,
    transferUnits30: 10,
    demandUnits30: 14,
    transferDataStatus: 'complete',
  };
  const { rerender } = render(
    <WarehouseProductRow lines={[transferred]} demand purchase />
  );
  expect(screen.queryByText('Sales + transfers out · 30 days')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: /View Caymus Honor Flight/ })
  );
  expect(screen.getByText('Sales + transfers out · 30 days')).toBeTruthy();
  expect(screen.getByText('Net transfers out').textContent).toContain('10');
  expect(screen.getByText('Total demand').textContent).toContain('14');
  rerender(
    <WarehouseProductRow
      lines={[transferred]}
      demand={false}
      purchase={false}
    />
  );
  expect(screen.queryByText('Sales + transfers out · 30 days')).toBeNull();
});

it.each([
  { units30: 0, transferUnits30: 30, demandBasis: 'transfers' as const },
  {
    units30: 6,
    transferUnits30: 24,
    demandBasis: 'sales_and_transfers' as const,
  },
])('shows combined warehouse movement speed for $demandBasis', (movement) => {
  render(
    <WarehouseProductMetrics
      line={{
        ...line,
        ...movement,
        demandUnits30: 30,
        transferDataStatus: 'complete',
      }}
    />
  );
  expect(
    screen.getByText('Stock movement · 30 days').nextElementSibling?.textContent
  ).toContain('30');
  expect(
    screen.getByText('1 units/day · customer sales + net transfers out')
  ).toBeTruthy();
  expect(
    screen.queryByText('No sales recorded in the last 30 days')
  ).toBeNull();
});

it('explains incomplete transfer history without presenting customer sales as total demand', () => {
  render(
    <WarehouseProductMetrics
      line={{
        ...line,
        units30: 6,
        demandUnits30: null,
        transferDataStatus: 'incomplete',
      }}
    />
  );
  expect(screen.getByText('Demand data incomplete')).toBeTruthy();
  expect(
    screen.getByText(
      'Some posted transfers are missing reliable dates or quantities'
    )
  ).toBeTruthy();
  expect(screen.queryByText(/units\/day/)).toBeNull();
});
