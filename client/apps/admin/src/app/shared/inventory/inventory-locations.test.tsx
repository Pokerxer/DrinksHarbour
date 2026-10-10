// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseService } from '@/services/warehouse.service';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import InventoryLocations from './inventory-locations';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const locations = [
  { _id: 'w', name: 'Wyn City', code: 'WYN', type: 'warehouse', isActive: true },
  { _id: 's', name: 'Abuja Shop', code: 'SHOP', type: 'store', isActive: false },
];
it('searches multiple products, combines filters, clears them and links analysis for each location', async () => {
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({ success: true, data: locations });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [
      { warehouseId: 'w', subProductId: 'p', productName: 'Leon Wine', currentQuantity: 5 },
      { warehouseId: 's', subProductId: 'q', productName: 'Ceres Juice', currentQuantity: 0 },
    ] as StockRow[],
  });
  render(<InventoryLocations />);
  await screen.findByRole('link', { name: 'Wyn City' }, { timeout: 5000 });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'leon, ceres' } });
  expect(screen.getByRole('link', { name: 'Abuja Shop' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Location type'), { target: { value: 'warehouse' } });
  expect(screen.queryByRole('link', { name: 'Abuja Shop' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Stock & history' }).getAttribute('href')).toBe(
    '/warehouses/w/analysis',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole('link', { name: 'Abuja Shop' })).toBeTruthy();
});
it('shows unavailable stock rather than zero when stock fails, then refreshes successfully', async () => {
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    success: true,
    data: locations.slice(0, 1),
  });
  const stock = vi
    .spyOn(warehouseStockService, 'getAllStock')
    .mockRejectedValueOnce(new Error('Stock unavailable'));
  render(<InventoryLocations />);
  await screen.findByRole('alert', {}, { timeout: 5000 });
  expect(screen.getByRole('link', { name: 'Wyn City' })).toBeTruthy();
  expect((screen.getByLabelText('Stock filter') as HTMLSelectElement).disabled).toBe(true);
  expect(screen.getByText('Unavailable')).toBeTruthy();
  stock.mockResolvedValueOnce({ success: true, data: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect((screen.getByLabelText('Stock filter') as HTMLSelectElement).disabled).toBe(false);
});
