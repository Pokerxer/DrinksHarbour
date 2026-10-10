// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { inventoryService } from '@/services/inventory.service';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import InventoryDashboard from './inventory-dashboard';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } }, status: 'authenticated' }),
}));
vi.mock('./inventory-dashboard-chart-section', () => ({ default: () => null }));
const row = (warehouse: string, quantity: number) =>
  ({
    _id: warehouse,
    warehouseId: warehouse,
    warehouseName: warehouse,
    subProductId: 'p',
    productName: 'Wine',
    sku: 'W1',
    sizeId: 's',
    sizeName: '75cl',
    currentQuantity: quantity,
    costPrice: 2,
    sellingPrice: 5,
    minStockLevel: 1,
  }) as StockRow;
beforeEach(() => {
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [row('w1', 10), row('w2', 100)],
  });
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const units = () => screen.getByText('Units on hand').closest('a')?.textContent;
it('warehouse selection updates stock totals and history dates never change current balances', async () => {
  render(<InventoryDashboard />);
  await waitFor(() => expect(units()).toContain('110'));
  fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: 'w1' } });
  expect(units()).toContain('10');
  expect(units()).not.toContain('110');
  fireEvent.change(screen.getByLabelText('History recorded from'), {
    target: { value: '2099-01-01' },
  });
  expect(units()).toContain('10');
  fireEvent.click(screen.getByText('Clear filters'));
  expect(units()).toContain('110');
  expect(warehouseStockService.getAllStock).toHaveBeenCalledWith('token', {
    includeUnstocked: true,
  });
});
it('a failed stock refresh clears stale quantities and displays unavailable rather than zero', async () => {
  render(<InventoryDashboard />);
  await waitFor(() => expect(units()).toContain('110'));
  vi.mocked(warehouseStockService.getAllStock).mockRejectedValueOnce(
    new Error('Stock feed failed'),
  );
  fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
  await waitFor(() => expect(units()).toContain('Unavailable'));
  expect(screen.getByText(/Stock unavailable: Stock feed failed/)).toBeTruthy();
});
it('shows a persistent warning for incomplete history', async () => {
  vi.mocked(inventoryService.getAllMovements).mockResolvedValueOnce({
    movements: [],
    total: 10001,
    truncated: true,
  });
  render(<InventoryDashboard />);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('History totals are incomplete'),
  );
});
