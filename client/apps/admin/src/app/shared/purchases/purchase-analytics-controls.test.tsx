// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import { PurchaseAnalyticsFilters } from './purchase-analytics-filters';
import { PurchaseAnalyticsBars } from './purchase-analytics-bars';
import { applyFilters } from './purchases-analytics-helpers';
afterEach(cleanup);
const order = {
  _id: 'po',
  status: 'purchase',
  createdAt: '2026-10-04T12:00:00Z',
  items: [
    { subProductId: 'a', productName: 'Wine', sku: 'W1' },
    { subProductId: 'b', productName: 'Beer', sku: 'B2' },
    { subProductId: 'c', productName: 'Juice', sku: 'J3' },
  ],
} as unknown as PurchaseOrder;
function Filters() {
  const [filters, setFilters] = useState(['not_cancelled']);
  const result = applyFilters([order], filters, {});
  return (
    <>
      <PurchaseAnalyticsFilters orders={[order]} filters={filters} change={setFilters} />
      <output data-testid="lines">
        {result
          .flatMap((o) => o.items)
          .map((i) => i.sku)
          .join(',')}
      </output>
    </>
  );
}
it('multi-product picking filters contributing lines, dates intersect, and clear restores all products', () => {
  render(<Filters />);
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'W1, B2' } });
  fireEvent.click(screen.getByText('Select matches'));
  expect(screen.getByTestId('lines').textContent).toBe('W1,B2');
  fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-10-03' } });
  expect(screen.getByTestId('lines').textContent).toBe('');
  fireEvent.click(screen.getByText('Clear filters'));
  expect(screen.getByTestId('lines').textContent).toBe('W1,B2,J3');
});
it('every bar drills into its orders and invalid values never reach width styles', () => {
  const click = vi.fn();
  const data = [0, -10, NaN, Infinity, 20].map((value, index) => ({
    isoKey: String(index),
    label: `Product ${index}`,
    value,
    orders: 1,
    orderList: [order],
  }));
  const { container } = render(
    <PurchaseAnalyticsBars data={data} measure="net_received_value" onBarClick={click} />,
  );
  fireEvent.click(screen.getByText('Product 4'));
  expect(click).toHaveBeenCalledWith('Product 4', [order]);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  for (const bar of Array.from(container.querySelectorAll('[style]'))) {
    const width = parseFloat((bar as HTMLElement).style.width);
    expect(width).toBeGreaterThanOrEqual(0);
    expect(width).toBeLessThanOrEqual(100);
  }
});
