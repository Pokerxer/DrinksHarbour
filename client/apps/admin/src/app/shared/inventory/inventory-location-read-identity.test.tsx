// @vitest-environment jsdom
// DRI-36 — read surface (12) Locations, browser-view evidence (board scope
// extension #10). No UI change is expected: `locationReports` groups the
// already exact-Size-ID StockRow lines per warehouse; per-variant rows stay
// distinct (Emerald vs Ivory never merge); warehouse/unit/value sorting is
// quantity/value arithmetic and unchanged for colourless/legacy rows.
// Rows follow the DRI-34 flavour matrix.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseService } from '@/services/warehouse.service';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { warehouseFixture } from '@/test/warehouse-fixture';
import InventoryLocations from './inventory-locations';
import {
  EMPTY_LOCATION_FILTERS,
  filterLocations,
  locationReports,
} from './inventory-location-report';
import { flatRowSizeLabel } from '@/utils/size-variant-label';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const warehouses = [
  warehouseFixture({ _id: 'w1', name: 'Wyn City', code: 'WYN', type: 'warehouse', isActive: true }),
  warehouseFixture({ _id: 's1', name: 'Abuja Shop', code: 'SHOP', type: 'store', isActive: false }),
];

const matrix: StockRow[] = [
  {
    _id: 'r1',
    warehouseId: 'w1',
    warehouseName: 'Wyn City',
    subProductId: 'sp-tee',
    productName: 'Silk Tee',
    sku: 'SKU-EM',
    sizeId: 'sz-em',
    sizeName: 'M',
    colorName: 'Emerald',
    currentQuantity: 3,
    reservedQuantity: 1,
    costPrice: 500,
    minStockLevel: 0,
    earliestExpiry: null,
  },
  {
    _id: 'r2',
    warehouseId: 'w1',
    warehouseName: 'Wyn City',
    subProductId: 'sp-tee',
    productName: 'Silk Tee',
    sku: 'SKU-IV',
    sizeId: 'sz-iv',
    sizeName: 'M',
    colorName: 'Ivory',
    currentQuantity: 2,
    reservedQuantity: 0,
    costPrice: 800,
    minStockLevel: 0,
    earliestExpiry: null,
  },
  {
    _id: 'r3',
    warehouseId: 'w1',
    warehouseName: 'Wyn City',
    subProductId: 'sp-jol',
    productName: 'Jollof plate',
    sku: 'SKU-J1',
    sizeId: 'sz-j1',
    sizeName: 'Regular plate',
    optionName: 'Jollof portion',
    currentQuantity: 6,
    reservedQuantity: 0,
    costPrice: 900,
    minStockLevel: 0,
    earliestExpiry: null,
  },
  {
    _id: 'r4',
    warehouseId: 'w1',
    warehouseName: 'Wyn City',
    subProductId: 'sp-chi',
    productName: 'Chianti',
    sku: 'SKU-VOL',
    sizeId: 'sz-750',
    sizeName: '750ml',
    currentQuantity: 10,
    reservedQuantity: 0,
    costPrice: 80,
    minStockLevel: 0,
    earliestExpiry: null,
  },
  {
    _id: 'r5',
    warehouseId: 'w1',
    warehouseName: 'Wyn City',
    subProductId: 'sp-chi',
    productName: 'Chianti',
    sku: 'SKU-CASE',
    sizeId: 'sz-case',
    sizeName: 'Case of 6 (4500)',
    currentQuantity: 3,
    reservedQuantity: 0,
    costPrice: 480,
    minStockLevel: 0,
    earliestExpiry: null,
  },
  {
    _id: 'r6',
    warehouseId: 's1',
    warehouseName: 'Abuja Shop',
    subProductId: 'sp-san',
    productName: 'Sancerre',
    sku: 'SKU-SAN',
    sizeId: 'sz-legacy',
    sizeName: '75cl',
    currentQuantity: 4,
    reservedQuantity: 0,
    costPrice: 60,
    minStockLevel: 0,
    earliestExpiry: null,
  },
] as StockRow[];

it('groups per warehouse and keeps per-variant rows distinct — Emerald/Ivory never merge', () => {
  const reports = locationReports(warehouses, matrix);
  expect(reports).toHaveLength(2);
  const wyn = reports[0];
  expect(wyn.warehouse._id).toBe('w1');
  // One report line per exact Size row: Emerald and Ivory are two of them.
  expect(wyn.rows).toHaveLength(5);
  expect(wyn.rows.map((row) => flatRowSizeLabel(row))).toEqual([
    'M · Emerald',
    'M · Ivory',
    'Regular plate · Jollof portion',
    '750ml',
    'Case of 6 (4500)',
  ]);
  // Aggregates sum the per-variant lines — no sibling bucketing.
  expect(wyn.totals.lines).toBe(5);
  expect(wyn.totals.products).toBe(3); // Silk Tee, Jollof plate, Chianti
  expect(wyn.totals.units).toBe(24); // 3 + 2 + 6 + 10 + 3, never 7+3
  expect(wyn.totals.reserved).toBe(1);
  expect(wyn.totals.available).toBe(23);
  expect(wyn.totals.value).toBe(3 * 500 + 2 * 800 + 6 * 900 + 10 * 80 + 3 * 480);
  const shop = reports[1];
  expect(shop.rows.map((row) => flatRowSizeLabel(row))).toEqual(['75cl']);
  expect(shop.totals.units).toBe(4);
});

it('variant search resolves the full composed label and legacy bytes through the browser', async () => {
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    success: true,
    data: warehouses,
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: matrix,
  });
  render(<InventoryLocations />);
  await screen.findByRole('link', { name: 'Wyn City' }, { timeout: 5000 });

  // The variant search hits the composed identity field of the Emerald row.
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'M Emerald' } });
  expect(screen.getByRole('link', { name: 'Wyn City' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Abuja Shop' })).toBeNull();
  // Sibling rows under the matched warehouse stay intact — the group never
  // collapses to the matched row.
  expect(screen.getByText('5 lines')).toBeTruthy();

  const colourless = screen
    .getByRole('link', { name: 'Wyn City' })
    .closest('tr')!.textContent!;
  expect(colourless).toContain('Wyn City');

  // Legacy control: the bare stored sizeName resolves through the same search
  // path — the 75cl line lives only in Abuja Shop.
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '75cl' } });
  expect(screen.getByRole('link', { name: 'Abuja Shop' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Wyn City' })).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Silk Tee' } });
  expect(screen.getByRole('link', { name: 'Wyn City' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Abuja Shop' })).toBeNull();
});

it('warehouse/unit/value sorting output is unchanged for colourless and legacy rows', () => {
  // Report rows from the flavour matrix only: a colourless beverage volume
  // line and two legacy identity-less 75cl lines. Sorting operates on the
  // quantity/value totals, never on identity strings.
  const reports = locationReports(warehouses, [
    { ...matrix[3], warehouseId: 's1', warehouseName: 'Abuja Shop' }, // 750ml · 10 units · value 800
    { ...matrix[5], warehouseId: 'w1', warehouseName: 'Wyn City' }, // legacy 75cl · 4 units · value 240
  ]);
  const names = (filters: Partial<typeof EMPTY_LOCATION_FILTERS>) =>
    filterLocations(reports, { ...EMPTY_LOCATION_FILTERS, ...filters }).map(
      (report) => report.warehouse.name,
    );
  // Name sort (default) is by warehouse name.
  expect(names({})).toEqual(['Abuja Shop', 'Wyn City']);
  // Units sort: per-warehouse on-hand amounts, additives unchanged.
  expect(names({ sort: 'units' })).toEqual(['Abuja Shop', 'Wyn City']);
  // Value sort: per-warehouse value, additives unchanged.
  expect(names({ sort: 'value' })).toEqual(['Abuja Shop', 'Wyn City']);
});
