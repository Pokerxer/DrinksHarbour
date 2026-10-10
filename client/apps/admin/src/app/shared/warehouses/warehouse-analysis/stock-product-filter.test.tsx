// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import StockProductFilter from './stock-product-filter';
import { applyFilters } from '../warehouse-analysis-helpers';
import type { StockRow } from '@/services/warehouseStock.service';
afterEach(cleanup);
const products = [
  { _id: 'p1', name: 'Monté Red · MR1' },
  { _id: 'p2', name: 'Lagar White · LW2' },
  { _id: 'p3', name: 'Beer · B3' },
];
function Harness() {
  const [filters, setFilters] = useState(['warehouse_w1', 'in_stock', 'product_search:old search']);
  const stock = products.map((p) => ({
    subProductId: p._id,
    warehouseId: 'w1',
    currentQuantity: 10,
    productName: p.name,
  })) as StockRow[];
  return (
    <>
      <StockProductFilter products={products} filters={filters} change={setFilters} />
      <output aria-label="Filters">{filters.join('|')}</output>
      <output aria-label="Result products">
        {applyFilters(stock, filters, {})
          .map((r) => r.subProductId)
          .join(',')}
      </output>
    </>
  );
}
it('searches multiple names/SKUs, selects matches, and updates stock results without stale product searches', () => {
  render(<Harness />);
  const search = screen.getByRole('searchbox', { name: 'Search products' });
  fireEvent.change(search, { target: { value: 'monte red, LW2' } });
  expect(screen.getByRole('checkbox', { name: 'Monté Red · MR1' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Lagar White · LW2' })).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: 'Beer · B3' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Select matches' }));
  expect(screen.getByLabelText('Filters').textContent).toBe(
    'warehouse_w1|in_stock|product_p1|product_p2',
  );
  expect(screen.getByLabelText('Result products').textContent).toBe('p1,p2');
  fireEvent.change(search, { target: { value: 'B3' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Beer · B3' }));
  expect(screen.getByLabelText('Result products').textContent).toBe('p1,p2,p3');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Monté Red · MR1' }));
  expect(screen.getByLabelText('Result products').textContent).toBe('p2,p3');
  fireEvent.click(screen.getByRole('button', { name: 'All products' }));
  expect(screen.getByLabelText('Filters').textContent).toBe('warehouse_w1|in_stock');
  expect((search as HTMLInputElement).value).toBe('');
});
it('clears a saved product text restriction even without selected IDs', () => {
  render(<Harness />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), {
    target: { value: 'B3' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Show all products' }));
  expect(
    (screen.getByRole('searchbox', { name: 'Search products' }) as HTMLInputElement).value,
  ).toBe('');
  expect(screen.getByLabelText('Result products').textContent).toBe('p1,p2,p3');
});
