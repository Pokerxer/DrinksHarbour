// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../purchases/purchases-fonts', () => ({ fraunces: { className: 'font-serif' } }));
import LocationAnalysis from './index';
import { warehouseService } from '@/services/warehouse.service';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));
vi.mock('@/services/warehouse.service', () => ({
  warehouseService: { getWarehouseById: vi.fn() },
}));
vi.mock('../warehouse-analysis', () => ({
  default: ({ warehouseId }: { warehouseId: string }) => <div>Stock scope {warehouseId}</div>,
}));
vi.mock('./history-panel', () => ({
  default: ({ warehouseId, tab }: { warehouseId: string; tab: string }) => (
    <div>
      History scope {warehouseId} {tab}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('opens each history inside the verified warehouse and links back to its stock page', async () => {
  vi.mocked(warehouseService.getWarehouseById).mockResolvedValue({
    data: { name: 'Main depot', code: 'MAIN' },
  });
  render(<LocationAnalysis warehouseId="one" />);
  expect(await screen.findByText('Stock scope one')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Back to warehouse/ }).getAttribute('href')).toBe(
    '/warehouses/one',
  );
  for (const [label, kind] of [
    ['Purchases', 'purchases'],
    ['Transfers', 'transfers'],
    ['Stock history', 'movements'],
  ]) {
    fireEvent.click(screen.getByRole('tab', { name: label }));
    expect(screen.getByText(`History scope one ${kind}`)).toBeTruthy();
  }
  expect(warehouseService.getWarehouseById).toHaveBeenCalledWith('one', 't');
});
it('does not mount stock or history when the warehouse is unavailable', async () => {
  vi.mocked(warehouseService.getWarehouseById).mockRejectedValue(new Error('Warehouse not found'));
  render(<LocationAnalysis warehouseId="foreign" />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('tablist')).toBeNull();
  vi.mocked(warehouseService.getWarehouseById).mockResolvedValue({
    data: { name: 'Recovered', code: 'R' },
  });
  fireEvent.click(screen.getByText('Retry'));
  await waitFor(() => expect(screen.getByText('Stock scope foreign')).toBeTruthy());
});
it('supports keyboard tab navigation and preserves previously visited panels', async () => {
  vi.mocked(warehouseService.getWarehouseById).mockResolvedValue({
    data: { name: 'Main', code: 'M' },
  });
  render(<LocationAnalysis warehouseId="one" />);
  await screen.findByText('Stock scope one');
  const stock = screen.getByRole('tab', { name: 'Stock analysis' });
  stock.focus();
  fireEvent.keyDown(stock, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Purchases' }).getAttribute('aria-selected')).toBe('true');
  expect(
    screen.getByText('Stock scope one').closest('[role="tabpanel"]')?.hasAttribute('hidden'),
  ).toBe(true);
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Purchases' }), { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Stock history' }).getAttribute('aria-selected')).toBe(
    'true',
  );
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Stock history' }), { key: 'Home' });
  expect(stock.getAttribute('aria-selected')).toBe('true');
  expect(stock).toBe(document.activeElement);
});
