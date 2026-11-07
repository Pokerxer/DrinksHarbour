// @vitest-environment jsdom
// DRI-36 — read surface (13) Valuation, browser-view evidence (board scope
// extension #10). The /inventory/valuation page IS InventoryStockBrowser
// mode="valuation" — the same identity-aware browser as the stock surface.
// Each value line is one warehouseStock (SubProduct, Size, warehouse) row, so
// per-line values are keyed by the exact Size — a sizeName bucket merge is
// structurally impossible. Recorded decision: the drill-down stays this
// browser; no new print or payload surface is added. Rows follow the DRI-34
// flavour matrix; legacy/colourless rows stay byte-identical.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { inventoryService } from '@/services/inventory.service';
import InventoryStockBrowser from './inventory-stock-browser';
import { stockViewCSV } from './inventory-stock-view';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } }, status: 'authenticated' }),
}));
vi.mock('./inventory-stock-import', () => ({ default: () => null }));
vi.mock('./inventory-stock-filter-panel', () => ({ default: () => null }));
vi.mock('./inventory-pricelist-print-modal', () => ({ default: () => null }));

const row = (
  id: string,
  productName: string,
  sku: string,
  extra: Partial<StockRow>,
): StockRow =>
  ({
    _id: id,
    subProductId: 'sp-matrix',
    productName,
    sku,
    warehouseId: 'w1',
    warehouseName: 'Wyn City',
    sizeId: 'sz',
    sizeName: '75cl',
    currentQuantity: 1,
    reservedQuantity: 0,
    costPrice: 100,
    minStockLevel: 0,
    earliestExpiry: null,
    valuationMethod: 'standard',
    ...extra,
  }) as StockRow;

const matrix: StockRow[] = [
  // Fashion siblings: same sizeName 'M', distinct exact-Size value lines.
  row('e', 'Silk Tee', 'SKU-EM', {
    sizeId: 'sz-em',
    sizeName: 'M',
    colorName: 'Emerald',
    currentQuantity: 3,
    costPrice: 500, // line value 1,500
  }),
  row('i', 'Silk Tee', 'SKU-IV', {
    sizeId: 'sz-iv',
    sizeName: 'M',
    colorName: 'Ivory',
    currentQuantity: 2,
    costPrice: 800, // line value 1,600
  }),
  // Food-service portion siblings: same sizeName, option identity.
  row('j1', 'Jollof plate', 'SKU-J1', {
    sizeId: 'sz-j1',
    sizeName: 'Regular plate',
    optionName: 'Jollof portion',
    currentQuantity: 6,
    costPrice: 900, // 5,400
  }),
  row('j2', 'Jollof plate', 'SKU-J2', {
    sizeId: 'sz-j2',
    sizeName: 'Regular plate',
    optionName: 'Goat portion',
    currentQuantity: 2,
    costPrice: 1200, // 2,400
  }),
  // Option-only electronics and home lines.
  row('e1', 'Cabinet Speaker', 'SKU-SPK', {
    sizeId: 'sz-wifi',
    sizeName: 'Standard',
    optionName: 'With Wi-Fi',
    currentQuantity: 4,
    costPrice: 2000, // 8,000
  }),
  row('h1', 'Oak Shelf', 'SKU-SHF', {
    sizeId: 'sz-draw',
    sizeName: 'Wall unit',
    optionName: 'With drawers',
    currentQuantity: 1,
    costPrice: 5000, // 5,000
  }),
  // Beverage colourless volume and pack lines of the same product.
  row('v', 'Chianti', 'SKU-VOL', {
    sizeId: 'sz-750',
    sizeName: '750ml',
    currentQuantity: 10,
    costPrice: 80, // 800
  }),
  row('p', 'Chianti', 'SKU-CASE', {
    sizeId: 'sz-case',
    sizeName: 'Case of 6 (4500)',
    currentQuantity: 3,
    costPrice: 480, // 1,440
  }),
  // Identity-less legacy control.
  row('l', 'Sancerre', 'SKU-SAN', {
    currentQuantity: 9,
    costPrice: 80, // 720
  }),
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('valuation lines are keyed by the exact Size; Emerald/Ivory value rows never merge', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
  const stock = vi
    .spyOn(warehouseStockService, 'getAllStock')
    .mockResolvedValue({ success: true, data: matrix });
  render(<InventoryStockBrowser mode="valuation" />);
  await waitFor(() =>
    expect(screen.getByText('Units On Hand').parentElement?.textContent).toContain('40'),
  );
  expect(stock).toHaveBeenCalledWith('token', { includeUnstocked: true });

  // The two 'M' lines are separate table rows, each valued from its own
  // exact Size cost basis — never the sizeName bucket 3+2 × anything.
  const teeRows = screen.getAllByText('Silk Tee').map((element) => element.closest('tr')!);
  expect(teeRows).toHaveLength(2);
  expect(teeRows[0].textContent).toContain('M · Emerald');
  expect(teeRows[0].textContent).toContain('1,500');
  expect(teeRows[1].textContent).toContain('M · Ivory');
  expect(teeRows[1].textContent).toContain('1,600');

  // Portion siblings: two distinct value lines under the same sizeName.
  const plateRows = screen.getAllByText('Jollof plate').map((element) => element.closest('tr')!);
  expect(plateRows).toHaveLength(2);
  expect(plateRows[0].textContent).toContain('Regular plate · Jollof portion');
  expect(plateRows[0].textContent).toContain('5,400');
  expect(plateRows[1].textContent).toContain('Regular plate · Goat portion');
  expect(plateRows[1].textContent).toContain('2,400');
});

it('colourless volume/pack lines and the legacy control each carry exact per-line values with byte-identical labels', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: matrix,
  });
  render(<InventoryStockBrowser mode="valuation" />);
  await waitFor(() =>
    expect(screen.getByText('Units On Hand').parentElement?.textContent).toContain('40'),
  );
  // 750ml and Case of 6 are two separate value lines of one beverage.
  const wineRows = screen.getAllByText('Chianti').map((element) => element.closest('tr')!);
  expect(wineRows).toHaveLength(2);
  expect(wineRows[0].textContent).toContain('750ml');
  expect(wineRows[0].textContent).toContain('800');
  expect(wineRows[1].textContent).toContain('Case of 6 (4500)');
  expect(wineRows[1].textContent).toContain('1,440');
  // Legacy control: bare stored sizeName bytes, value at its own unit cost.
  const legacyRow = screen.getByText('Sancerre').closest('tr')!;
  expect(legacyRow.textContent).toContain('75cl');
  expect(legacyRow.textContent).toContain('720');
});

it('valuation CSV Size column composes the full identity; legacy bytes stay exact', () => {
  const lines = stockViewCSV(matrix).split('\n');
  expect(lines[0].split(',')[2]).toBe('Size');
  const sizeOf = (sku: string) =>
    lines
      .slice(1)
      .find((line) => line.includes(`"${sku}"`))!
      .split(',')[2];
  expect(sizeOf('SKU-EM')).toBe('"M · Emerald"');
  expect(sizeOf('SKU-IV')).toBe('"M · Ivory"');
  expect(sizeOf('SKU-J1')).toBe('"Regular plate · Jollof portion"');
  expect(sizeOf('SKU-J2')).toBe('"Regular plate · Goat portion"');
  expect(sizeOf('SKU-VOL')).toBe('"750ml"');
  expect(sizeOf('SKU-CASE')).toBe('"Case of 6 (4500)"');
  expect(sizeOf('SKU-SAN')).toBe('"75cl"');
});
