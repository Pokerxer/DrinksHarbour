// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import type { StockRow } from '@/services/warehouseStock.service';
import { requestDocumentExport } from '@/utils/print/document-export';
import StockDetail from './inventory-stock-detail-panel';
vi.mock('@/utils/print/document-export', () => ({ requestDocumentExport: vi.fn() }));
const row = {
  _id: 'line',
  subProductId: 'p',
  productName: 'Wine',
  sku: 'W1',
  productImage: 'https://example.com/wine.jpg',
  sizeId: 's',
  sizeName: '75cl',
  warehouseId: 'w',
  warehouseName: 'Wyn City',
  currentQuantity: 5,
  reservedQuantity: 1,
  costPrice: 2,
} as StockRow;
const moves = Array.from({ length: 25 }, (_, i) => ({
  _id: String(i),
  subProduct: 'p',
  warehouse: { _id: 'w', name: 'Wyn City' },
  size: { _id: 's', size: '75cl' },
  type: 'received',
  status: 'confirmed',
  quantity: 1,
  quantityBefore: i,
  quantityAfter: i + 1,
  createdAt: '2026-10-04T10:00:00Z',
  reference: `PO-${i}`,
  performedBy: { _id: 'u', firstName: 'Ada', lastName: 'Obi' },
})) as InventoryMovement[];
beforeEach(() => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: moves,
    total: 25,
    truncated: false,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const show = () =>
  render(
    <StockDetail row={row} token="token" mode="stock" onClose={vi.fn()} onApplied={vi.fn()} />,
  );
it('shows image, available stock and full printable movement history beyond the visible twenty', async () => {
  show();
  expect(screen.getByRole('img', { name: 'Wine' }).getAttribute('src')).toBe(row.productImage);
  expect(screen.getByText('Available').nextSibling?.textContent).toBe('4');
  await screen.findByText('PO-0');
  expect(screen.queryByText('PO-24')).toBeNull();
  fireEvent.click(screen.getByText('Print history'));
  const doc = vi.mocked(requestDocumentExport).mock.calls[0][0];
  expect(Array.isArray(doc)).toBe(false);
  if (!Array.isArray(doc)) expect(doc.table.rows).toHaveLength(25);
  fireEvent.click(screen.getByText(/Show more/));
  expect(screen.getByText('PO-24')).toBeTruthy();
});
it('missing or broken image uses the fallback and incomplete history cannot print', async () => {
  vi.mocked(inventoryService.getAllMovements).mockResolvedValueOnce({
    movements: moves,
    total: 50,
    truncated: true,
  });
  show();
  fireEvent.error(screen.getByRole('img', { name: 'Wine' }));
  expect(screen.getByLabelText('No product image')).toBeTruthy();
  await screen.findByText(/History is incomplete/);
  expect((screen.getByText('Print history') as HTMLButtonElement).disabled).toBe(true);
});
it('scope can include other warehouse entries and failed refresh clears printable history', async () => {
  const other = {
    ...moves[0],
    _id: 'other',
    reference: 'OTHER',
    warehouse: { _id: 'other', name: 'Other warehouse' },
  };
  vi.mocked(inventoryService.getAllMovements).mockResolvedValueOnce({
    movements: [...moves, other],
    total: 26,
    truncated: false,
  });
  show();
  await screen.findByText('PO-0');
  expect(screen.queryByText('OTHER')).toBeNull();
  fireEvent.change(screen.getByLabelText('History scope'), { target: { value: 'product' } });
  fireEvent.click(screen.getByText(/Show more/));
  expect(screen.getByText('OTHER')).toBeTruthy();
  vi.mocked(inventoryService.getAllMovements).mockRejectedValueOnce(
    new Error('History feed failed'),
  );
  fireEvent.click(screen.getByLabelText('Refresh product history'));
  await screen.findByText('History feed failed');
  expect(screen.queryByText('PO-0')).toBeNull();
  expect((screen.getByText('Print history') as HTMLButtonElement).disabled).toBe(true);
});
