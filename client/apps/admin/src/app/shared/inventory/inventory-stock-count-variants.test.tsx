// @vitest-environment jsdom
// DRI-34 — /inventory Physical Inventory (checklist item 7): the count sheet
// (InventoryStockBrowser mode="count") lists variants SEPARATELY keyed by the
// exact Size id (Emerald vs Ivory, portions vs each other, volume vs pack) and
// applies counts per Size row via adjustStock with the exact sizeId.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { inventoryService } from '@/services/inventory.service';
import InventoryStockBrowser from './inventory-stock-browser';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));
vi.mock('./inventory-stock-import', () => ({ default: () => null }));
vi.mock('./inventory-stock-filter-panel', () => ({ default: () => null }));
vi.mock('./inventory-pricelist-print-modal', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const line = (over: Partial<StockRow>): StockRow =>
  ({
    _id: over.sizeId ?? 'line',
    subProductId: 'sp-tee',
    productName: 'Silk Tee',
    sku: 'TEE',
    warehouseId: 'city',
    warehouseName: 'City',
    sizeId: 'sz-x',
    sizeName: 'M',
    currentQuantity: 50,
    reservedQuantity: 0,
    costPrice: 500,
    sellingPrice: 1200,
    ...over,
  }) as StockRow;

const rows: StockRow[] = [
  line({ _id: 'l-em', sizeId: 'sz-em', sizeName: 'M', colorName: 'Emerald', colorHexCode: '#0f5132', currentQuantity: 10 }),
  line({ _id: 'l-iv', sizeId: 'sz-iv', sizeName: 'M', colorName: 'Ivory', currentQuantity: 20 }),
  // Food-service portions.
  line({
    _id: 'l-jol', subProductId: 'sp-plate', productName: 'Jollof plate', sku: 'PLT',
    sizeId: 'sz-reg', sizeName: 'Regular plate', optionName: 'Jollof portion', currentQuantity: 7,
  }),
  line({
    _id: 'l-got', subProductId: 'sp-plate', productName: 'Jollof plate', sku: 'PLT',
    sizeId: 'sz-reg', sizeName: 'Regular plate', optionName: 'Goat portion', currentQuantity: 9,
  }),
  // Option-only electronics/home rows.
  line({
    _id: 'l-wifi', subProductId: 'sp-spk', productName: 'Cabinet Speaker', sku: 'SPK',
    sizeId: 'sz-wifi', sizeName: 'Standard', optionName: 'With Wi-Fi', currentQuantity: 5,
  }),
  line({
    _id: 'l-draw', subProductId: 'sp-shelf', productName: 'Oak Shelf', sku: 'SHF',
    sizeId: 'sz-draw', sizeName: 'Wall unit', optionName: 'With drawers', currentQuantity: 6,
  }),
  // Beverage colourless volume/pack + legacy identity-less control.
  line({
    _id: 'l-750', subProductId: 'sp-wine', productName: 'Sancerre', sku: 'SAN',
    sizeId: 'sz-750', sizeName: '750ml', currentQuantity: 24,
  }),
  line({
    _id: 'l-case', subProductId: 'sp-wine', productName: 'Sancerre', sku: 'SAN',
    sizeId: 'sz-case', sizeName: 'Case of 6 (4500)', currentQuantity: 4,
  }),
  line({
    _id: 'l-leg', subProductId: 'sp-grim', productName: 'Grimbergen', sku: 'GRM',
    sizeId: 'sz-75', sizeName: '75cl', currentQuantity: 12,
  }),
];

const loadAll = async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: rows,
  });
};

const countInputOf = (cell: Element) =>
  cell.querySelector('input') as HTMLInputElement;

it('count sheet lists every variant separately — per-variant labels, no merge', async () => {
  await loadAll();
  render(<InventoryStockBrowser mode="count" />);
  await waitFor(() => expect(warehouseStockService.getAllStock).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByText('M · Emerald')).toBeTruthy(),
  );
  for (const label of [
    'M · Emerald',
    'M · Ivory',
    'Regular plate · Jollof portion',
    'Regular plate · Goat portion',
    'Standard · With Wi-Fi',
    'Wall unit · With drawers',
    '750ml',
    'Case of 6 (4500)',
    '75cl',
  ]) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  // Nine distinct count sheets — one per exact Size row, none merged.
  expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(
    rows.length,
  );
});

it('applied counts post per Size row with the exact sizeId', async () => {
  await loadAll();
  const adjust = vi
    .spyOn(warehouseStockService, 'adjustStock')
    .mockResolvedValue({ success: true, data: {} } as never);
  render(<InventoryStockBrowser mode="count" />);
  await waitFor(() => expect(screen.getByText('M · Emerald')).toBeTruthy());
  const emeraldCell = screen.getByText('M · Emerald').closest('tr')!;
  fireEvent.change(countInputOf(emeraldCell), { target: { value: '8' } });
  fireEvent.click(within(emeraldCell).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(adjust).toHaveBeenCalledOnce());
  expect(adjust.mock.calls[0][1]).toMatchObject({
    subProduct: 'sp-tee',
    size: 'sz-em',
    quantity: 8,
  });
  const ivoryCell = screen.getByText('M · Ivory').closest('tr')!;
  fireEvent.change(countInputOf(ivoryCell), { target: { value: '30' } });
  fireEvent.click(within(ivoryCell).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(adjust).toHaveBeenCalledTimes(2));
  expect(adjust.mock.calls[1][1]).toMatchObject({
    subProduct: 'sp-tee',
    size: 'sz-iv',
    quantity: 30,
  });
});
