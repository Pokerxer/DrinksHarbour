// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import InventoryStockBrowser from './inventory-stock-browser';
import { inventoryService } from '@/services/inventory.service';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } }, status: 'authenticated' }),
}));
vi.mock('./inventory-stock-import', () => ({ default: () => null }));
vi.mock('./inventory-stock-filter-panel', () => ({ default: () => null }));
vi.mock('./inventory-pricelist-print-modal', () => ({ default: () => null }));
const row = (id: string, name: string, warehouse: string, quantity: number) =>
  ({
    _id: id,
    subProductId: name,
    productName: name,
    sku: id,
    warehouseId: warehouse,
    warehouseName: warehouse,
    sizeId: 'size',
    sizeName: '75cl',
    currentQuantity: quantity,
    reservedQuantity: 0,
    costPrice: 2,
    sellingPrice: 1,
  }) as StockRow;
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({ movements: [], total: 0, truncated: false });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [row('a', 'Wine', 'w1', 10), row('b', 'Beer', 'w1', -2), row('c', 'Gin', 'w2', 0)],
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const units = () => screen.getByText('Units On Hand').parentElement?.textContent;
it('combines selected products and warehouse while all products includes zero and negative balances', async () => {
  render(<InventoryStockBrowser mode="stock" />);
  await waitFor(() => expect(units()).toContain('8'));
  expect(screen.getByText('Gin')).toBeTruthy();
  fireEvent.focus(screen.getByLabelText('Search products'));
  fireEvent.click(screen.getByLabelText('Wine · a'));
  expect(units()).toContain('10');
  fireEvent.click(screen.getByLabelText('Beer · b'));
  expect(units()).toContain('8');
  fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: 'w2' } });
  expect(units()).toContain('0');
  expect(screen.queryByText('Gin')).toBeNull();
});
it('failed refresh removes stale totals and offers retry', async () => {
  render(<InventoryStockBrowser mode="stock" />);
  await waitFor(() => expect(units()).toContain('8'));
  vi.mocked(warehouseStockService.getAllStock).mockRejectedValueOnce(new Error('Feed failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh stock' }));
  await waitFor(() => expect(units()).toContain('Unavailable'));
  expect(screen.getByRole('alert').textContent).toContain('Feed failed');
  fireEvent.click(screen.getByText('Retry'));
  await waitFor(() => expect(units()).toContain('8'));
});
it('retains selections across pages and prunes only stock hidden by product filters', async () => {
  const data = Array.from({ length: 51 }, (_, index) =>
    row(`id${index}`, `Product${String(index).padStart(3, '0')}`, 'w1', 1),
  );
  vi.mocked(warehouseStockService.getAllStock).mockResolvedValueOnce({ success: true, data });
  render(<InventoryStockBrowser mode="stock" />);
  await waitFor(() => expect(units()).toContain('51'));
  fireEvent.click(screen.getByLabelText('Select current page'));
  expect(screen.getByText('50', { selector: 'span.font-bold' })).toBeTruthy();
  fireEvent.click(screen.getAllByLabelText('Next page')[0]);
  fireEvent.click(screen.getByLabelText('Select current page'));
  expect(
    screen
      .getAllByText('51', { selector: 'span.font-bold' })
      .some((element) => element.className.includes('text-[#b20202]')),
  ).toBe(true);
  fireEvent.focus(screen.getByLabelText('Search products'));
  fireEvent.click(screen.getByLabelText('Product050 · id50'));
  await waitFor(() =>
    expect(
      screen
        .getAllByText('1', { selector: 'span.font-bold' })
        .some((element) => element.className.includes('text-[#b20202]')),
    ).toBe(true),
  );
  expect(screen.getByRole('link', { name: 'Product050' })).toBeTruthy();
  expect(screen.queryByLabelText('Next page')).toBeNull();
});
it('finds unassigned warehouse lines without including the assigned lines of the same product', async () => {
  vi.mocked(warehouseStockService.getAllStock).mockResolvedValueOnce({
    success: true,
    data: [
      row('assigned', 'Wine', 'w1', 12),
      { ...row('unassigned', 'Wine', '', 0), warehouseName: 'Unassigned' },
      row('named', 'Beer', 'Unassigned', 3),
    ],
  });
  render(<InventoryStockBrowser mode="stock" />);
  await waitFor(() => expect(units()).toContain('15'));
  const option = screen.getByRole('option', { name: 'Unassigned warehouse' }) as HTMLOptionElement;
  fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: option.value } });
  expect(units()).toContain('0');
  expect(screen.getByLabelText('Select stock line Wine Unassigned 75cl')).toBeTruthy();
  expect(screen.queryByLabelText('Select stock line Wine w1 75cl')).toBeNull();
  expect(screen.queryByLabelText('Select stock line Beer Unassigned 75cl')).toBeNull();
});
it('product names link to SubProduct details without opening the stock detail panel', async () => {
  render(<InventoryStockBrowser mode="stock" />);
  const link = await screen.findByRole('link', { name: 'Wine' });
  expect(link.getAttribute('href')).toBe('/sub-products/Wine');
  link.addEventListener('click', (event) => event.preventDefault());
  fireEvent.click(link, { ctrlKey: true });
  expect(screen.getByText('Select a stock line')).toBeTruthy();
  fireEvent.click(link.closest('td')!);
  expect(screen.getAllByRole('link', { name: 'Wine' })).toHaveLength(2);
});
it('valuation shows carrying cost, method and available stock, includes zero lines and prints the same total', async () => {
  vi.mocked(warehouseStockService.getAllStock).mockResolvedValue({ success: true, data: [
    { ...row('a', 'Wine', 'w1', 20), reservedQuantity: 5, costPrice: 100, valuationUnitCost: 175, stockValue: 3500, valuationMethod: 'fifo', valuationSource: 'batches' },
    { ...row('b', 'Beer', 'w1', -2), costPrice: 80, stockValue: -160, estimatedQuantity: 2, valuationSource: 'standard' },
    row('c', 'Gin', 'w2', 0),
  ] });
  render(<InventoryStockBrowser mode="valuation" />);
  await waitFor(() => expect(units()).toContain('18'));
  expect(warehouseStockService.getAllStock).toHaveBeenCalledWith('token', { includeUnstocked: true });
  expect(screen.getByRole('columnheader', { name: /Avg. carrying cost/ })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: /Method/ })).toBeTruthy();
  expect(screen.getByText('Wine').closest('tr')?.textContent).toContain('175');
  expect(screen.getByText('Gin')).toBeTruthy();
  expect(screen.getByText(/1 line includes estimates/)).toBeTruthy();
  const events: Event[] = [];
  const listener = (event: Event) => events.push(event);
  window.addEventListener('drinksharbour:document-export', listener);
  fireEvent.click(screen.getByRole('button', { name: 'Print inventory valuation report' }));
  const model = (events[0] as CustomEvent<{ models: import('@/utils/print/doc-model').DocumentModel[] }>).detail.models[0];
  expect(model.table.rows).toHaveLength(3);
  expect(model.totals.find(t => t.label === 'Stock value')?.value).toContain('3,340');
  window.removeEventListener('drinksharbour:document-export', listener);
});
