// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Browser from './inventory-movements-browser';
import { inventoryService } from '@/services/inventory.service';
import { warehouseStockService } from '@/services/warehouseStock.service';
import { warehouseService } from '@/services/warehouse.service';
import { inventoryAdjustmentService } from '@/services/inventoryAdjustment.service';
import AdjustmentModal from './inventory-adjustment-modal';
const auth = vi.hoisted(() => ({ role: 'tenant_admin' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 't', role: auth.role } },
    status: 'authenticated',
  }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  auth.role = 'tenant_admin';
});
it('retains the request ID after an uncertain failure and blocks duplicate submissions', async () => {
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    data: [{ _id: 'city', name: 'City', isActive: true }],
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [
      {
        _id: 'line',
        warehouseId: 'city',
        warehouseName: 'City',
        subProductId: 'wine',
        productName: 'Wine',
        sku: 'WINE',
        sizeId: 'size',
        sizeName: '75cl',
        currentQuantity: 10,
        reservedQuantity: 0,
        costPrice: 10,
        minStockLevel: 0,
        earliestExpiry: null,
      },
    ],
  });
  const save = vi
    .spyOn(inventoryAdjustmentService, 'create')
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockResolvedValue({ success: true });
  const done = vi.fn();
  render(<AdjustmentModal token="t" close={vi.fn()} done={done} />);
  await waitFor(() => expect(screen.getByRole('option', { name: 'Wine · WINE' })).toBeTruthy());
  fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), {
    target: { value: 'wine' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Counted quantity' }), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), { target: { value: 'Count' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Network unavailable'),
  );
  const form = screen.getByRole('dialog').querySelector('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0][1].requestId).toBe(save.mock.calls[1][1].requestId);
});
it('does not offer adjustment entry without adjustment permission', async () => {
  auth.role = 'customer';
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
  render(<Browser preset="adjustments" />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Adjustments' })).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'New adjustment' })).toBeNull();
});
it('opens an adjustment independent of history, posts a local zero recount with reason and refreshes history', async () => {
  const history = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({ movements: [], total: 0, truncated: false });
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    data: [
      { _id: 'city', name: 'Wyn City', isActive: true, isDefault: true },
      { _id: 'other', name: 'Other', isActive: true },
    ],
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [
      {
        _id: 'line',
        warehouseId: 'city',
        warehouseName: 'Wyn City',
        subProductId: 'wine',
        productName: 'Château Wine',
        sku: 'WINE',
        sizeId: 'size',
        sizeName: '75cl',
        currentQuantity: 10,
        reservedQuantity: 0,
        costPrice: 10,
        minStockLevel: 0,
        earliestExpiry: null,
      },
      {
        _id: 'other-line',
        warehouseId: 'other',
        warehouseName: 'Other',
        subProductId: 'wine',
        productName: 'Château Wine',
        sku: 'WINE',
        sizeId: 'size',
        sizeName: '75cl',
        currentQuantity: 30,
        reservedQuantity: 0,
        costPrice: 10,
        minStockLevel: 0,
        earliestExpiry: null,
      },
    ],
  });
  const save = vi.spyOn(inventoryAdjustmentService, 'create').mockResolvedValue({ success: true });
  render(<Browser preset="adjustments" />);
  fireEvent.click(screen.getByRole('button', { name: 'New adjustment' }));
  await waitFor(() =>
    expect(screen.getByRole('option', { name: 'Château Wine · WINE' })).toBeTruthy(),
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), {
    target: { value: 'wine' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Counted quantity' }), {
    target: { value: '0' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Physical count' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]).toMatchObject([
    't',
    {
      warehouseId: 'city',
      subProductId: 'wine',
      sizeId: 'size',
      expectedQuantity: 10,
      targetQuantity: 0,
      reason: 'Physical count',
      requestId: expect.any(String),
    },
  ]);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(history.mock.calls.length).toBeGreaterThan(1);
});
