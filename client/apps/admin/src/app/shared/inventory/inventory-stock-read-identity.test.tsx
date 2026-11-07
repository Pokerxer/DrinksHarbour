// @vitest-environment jsdom
// DRI-36 — read surface (11) Stock, browser-view evidence (board scope
// extension #10). No UI change is expected in this slice: the surface is
// already exact-Size-ID with the shared `flatRowSizeLabel` util (DRI-30).
// Synthetic rows span the DRI-34 flavour matrix: beverage colourless 750ml
// volume + Case of 6 pack, food-service portion siblings distinguished by
// optionName only, Fashion M/Emerald vs M/Ivory, option-only electronics/home
// rows and an identity-less legacy control. Legacy/sizeless rows must stay
// byte-identical; the filter panel must have no size-string collapse path.

import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { inventoryService } from '@/services/inventory.service';
import InventoryStockBrowser from './inventory-stock-browser';
import { groupStockRows } from './inventory-stock-search';
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
    ...extra,
  }) as StockRow;

// The DRI-34 flavour matrix, one StockRow per industry flavour.
const matrix: StockRow[] = [
  // Fashion: same size, colour identity keeps the siblings apart.
  row('e', 'Silk Tee', 'SKU-EM', {
    sizeId: 'sz-em',
    sizeName: 'M',
    colorName: 'Emerald',
    colorHexCode: '#0f5132',
    currentQuantity: 3,
    costPrice: 500,
  }),
  row('i', 'Silk Tee', 'SKU-IV', {
    sizeId: 'sz-iv',
    sizeName: 'M',
    colorName: 'Ivory',
    colorHexCode: '#f2f2ea',
    currentQuantity: 2,
    costPrice: 800,
  }),
  // Food service: same size, option-only identity.
  row('j1', 'Jollof plate', 'SKU-J1', {
    sizeId: 'sz-j1',
    sizeName: 'Regular plate',
    optionName: 'Jollof portion',
    currentQuantity: 6,
    costPrice: 900,
  }),
  row('j2', 'Jollof plate', 'SKU-J2', {
    sizeId: 'sz-j2',
    sizeName: 'Regular plate',
    optionName: 'Goat portion',
    currentQuantity: 2,
    costPrice: 1200,
  }),
  // Electronics: option only.
  row('e1', 'Cabinet Speaker', 'SKU-SPK', {
    sizeId: 'sz-wifi',
    sizeName: 'Standard',
    optionName: 'With Wi-Fi',
    currentQuantity: 4,
    costPrice: 2000,
  }),
  // Home & living: option only.
  row('h1', 'Oak Shelf', 'SKU-SHF', {
    sizeId: 'sz-draw',
    sizeName: 'Wall unit',
    optionName: 'With drawers',
    currentQuantity: 1,
    costPrice: 5000,
  }),
  // Beverage: colourless volume and pack variants of the same drink.
  row('v', 'Chianti', 'SKU-VOL', {
    sizeId: 'sz-750',
    sizeName: '750ml',
    currentQuantity: 10,
    costPrice: 80,
  }),
  row('p', 'Chianti', 'SKU-CASE', {
    sizeId: 'sz-case',
    sizeName: 'Case of 6 (4500)',
    currentQuantity: 3,
    costPrice: 480,
  }),
  // Identity-less legacy control: beverage size with no colour/option at all.
  row('l', 'Sancerre', 'SKU-SAN', {
    currentQuantity: 9,
    costPrice: 80,
  }),
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders the full composed identity on every flavour row; Emerald/Ivory are separate lines', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: matrix,
  });
  render(<InventoryStockBrowser mode="stock" />);
  await waitFor(() => expect(screen.getByText('Units On Hand').parentElement?.textContent).toContain('40'));

  // Every flavour row carries the full shared composed label.
  const identityOf = (label: string): string | null | undefined =>
    screen
      .getByRole('button', { name: `Select stock line ${label}` })
      ?.closest('td')
      ?.nextElementSibling?.nextElementSibling?.textContent;
  expect(identityOf('Silk Tee Wyn City M · Emerald')).toBe('M · Emerald');
  expect(identityOf('Silk Tee Wyn City M · Ivory')).toBe('M · Ivory');
  expect(identityOf('Jollof plate Wyn City Regular plate · Jollof portion')).toBe(
    'Regular plate · Jollof portion',
  );
  expect(identityOf('Jollof plate Wyn City Regular plate · Goat portion')).toBe(
    'Regular plate · Goat portion',
  );
  expect(identityOf('Cabinet Speaker Wyn City Standard · With Wi-Fi')).toBe('Standard · With Wi-Fi');
  expect(identityOf('Oak Shelf Wyn City Wall unit · With drawers')).toBe('Wall unit · With drawers');
  expect(identityOf('Chianti Wyn City 750ml')).toBe('750ml');
  expect(identityOf('Chianti Wyn City Case of 6 (4500)')).toBe('Case of 6 (4500)');

  // Emerald/Ivory of the same size are two distinct selectable lines, not one.
  expect(
    screen.getByLabelText('Select stock line Silk Tee Wyn City M · Emerald').getAttribute('aria-pressed'),
  ).toBe('false');
  expect(
    screen.getByLabelText('Select stock line Silk Tee Wyn City M · Ivory').getAttribute('aria-pressed'),
  ).toBe('false');
});

it('legacy identity-less rows keep the exact stored sizeName bytes in the browser row', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [],
    total: 0,
    truncated: false,
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [matrix[8]],
  });
  render(<InventoryStockBrowser mode="stock" />);
  await waitFor(() => expect(screen.getByText('Units On Hand').parentElement?.textContent).toContain('9'));
  // Byte-identity pin: bare stored sizeName, no composition anywhere.
  expect(screen.getByLabelText('Select stock line Sancerre Wyn City 75cl')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Select stock line Sancerre Wyn City 75cl' })
      .closest('td')!
      .nextElementSibling!.nextElementSibling!.textContent,
  ).toBe('75cl');
});

it('CSV export Size column composes flatRowSizeLabel; the legacy Size cell stays byte-identical', () => {
  const lines = stockViewCSV(matrix).split('\n');
  const headerCells = lines[0].split(',');
  expect(headerCells[2]).toBe('Size');
  const cellsOf = (sku: string) =>
    lines.slice(1).find((line) => line.startsWith(`"${matrix.find((r) => r.sku === sku)!.productName}","${sku}"`))!
      .split(',');
  // Retail colour siblings carry their full identity in the export.
  expect(cellsOf('SKU-EM')[2]).toBe('"M · Emerald"');
  expect(cellsOf('SKU-IV')[2]).toBe('"M · Ivory"');
  // Option-only rows and portion siblings compose too.
  expect(cellsOf('SKU-J1')[2]).toBe('"Regular plate · Jollof portion"');
  expect(cellsOf('SKU-J2')[2]).toBe('"Regular plate · Goat portion"');
  expect(cellsOf('SKU-SPK')[2]).toBe('"Standard · With Wi-Fi"');
  expect(cellsOf('SKU-SHF')[2]).toBe('"Wall unit · With drawers"');
  // Colourless beverage volume/pack: exact stored bytes (colourless rows
  // resolve to stored sizeName byte-for-byte via sizeVariantLabel).
  expect(cellsOf('SKU-VOL')[2]).toBe('"750ml"');
  expect(cellsOf('SKU-CASE')[2]).toBe('"Case of 6 (4500)"');
  // Legacy control: the exact pre-DRI-30 bytes — bare stored sizeName.
  expect(cellsOf('SKU-SAN')[2]).toBe('"75cl"');
});

it('size grouping keys on the exact sizeId and the filter panel has no size-string collapse path', () => {
  // The Size GROUP dimension buckets by exact Size ID (sizeRowKey pattern);
  // same-sizeName colour siblings stay distinct buckets — no sizeNAME-string
  // collapse exists anywhere on this surface.
  const buckets = groupStockRows(matrix, 'size');
  expect(buckets).toHaveLength(9);
  const rowsOf = (label: string) =>
    buckets.find(([key]) => key === label)![1].map((row) => row.sizeId);
  expect(rowsOf('M · Emerald')).toEqual(['sz-em']);
  expect(rowsOf('M · Ivory')).toEqual(['sz-iv']);
  expect(rowsOf('Regular plate · Jollof portion')).toEqual(['sz-j1']);
  expect(rowsOf('Regular plate · Goat portion')).toEqual(['sz-j2']);
  expect(rowsOf('750ml')).toEqual(['sz-750']);
  expect(rowsOf('Case of 6 (4500)')).toEqual(['sz-case']);
  expect(rowsOf('75cl')).toEqual(['sz']);

  // Static pin of the recorded sweep claim: inventory-stock-filter-panel has
  // zero size references, so its filters can never merge or collapse rows by
  // size in any way.
  const source = readFileSync(
    `${process.cwd()}/src/app/shared/inventory/inventory-stock-filter-panel.tsx`,
    'utf8',
  );
  expect(source.match(/size/gi)).toBeNull();
});
