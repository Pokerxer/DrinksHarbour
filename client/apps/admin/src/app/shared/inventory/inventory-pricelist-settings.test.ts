import { expect, it } from 'vitest';
import {
  restorePricelistSettings,
  togglePriceColumn,
  movePriceColumn,
} from './inventory-pricelist-settings';
import {
  loadPricelistDetails,
  resolveExportRows,
} from './inventory-pricelist-data';

it('restores only valid unique column selections and bounded numeric settings', () => {
  const settings = restorePricelistSettings({
    discountPercent: 200,
    columns: [
      { plId: 'a', label: 'A', mode: 'bundle' },
      { plId: 'a', label: 'duplicate', mode: 'unit' },
      { plId: 'b', label: 'B', mode: 'bogus' },
    ],
  });
  expect(settings.discountPercent).toBe(0);
  expect(settings.columns).toEqual([
    { plId: 'a', label: 'A', mode: 'bundle' },
    { plId: 'b', label: 'B', mode: 'auto' },
  ]);
});
it('retains column order on toggle and can reorder the first column', () => {
  const a = { plId: 'a', label: 'A', mode: 'auto' as const };
  const b = { plId: 'b', label: 'B', mode: 'unit' as const };
  expect(togglePriceColumn([a], b)).toEqual([a, b]);
  expect(togglePriceColumn([a, b], a)).toEqual([b]);
  expect(movePriceColumn([a, b], 1, -1)).toEqual([b, a]);
});
it('migrates old primary and additional selections to independent columns', () => {
  const settings = restorePricelistSettings({
    plId: 'a',
    additionalColumns: [{ plId: 'b', label: '' }],
  });
  expect(settings.columns.map((c) => c.plId)).toEqual(['a', 'b']);
});
it('loads all selected full rules and exposes a failed request', async () => {
  const result = await loadPricelistDetails(['a', 'b'], async (id) => {
    if (id === 'b') throw new Error('Unavailable');
    return { data: { _id: id, name: 'A', rules: [] } };
  });
  expect(result.a.status).toBe('ready');
  expect(result.b.status).toBe('error');
  expect(result.b.error).toContain('Unavailable');
});
it('rejects a mismatched or lean detail response', async () => {
  const result = await loadPricelistDetails(['a'], async () => ({
    data: { _id: 'b', name: 'B', rules: [] },
  }));
  expect(result.a.status).toBe('error');
  const lean = await loadPricelistDetails(['a'], async () => ({
    data: { _id: 'a', name: 'A' },
  }));
  expect(lean.a.status).toBe('error');
});
it('empty explicit product selection never falls back to current stock', () => {
  const stock = [
    {
      productName: 'Wine',
      subProductId: 'a',
      sizeId: 's',
      sizeName: '75cl',
      categoryName: 'Wine',
      sku: 'A',
      sellingPrice: 100,
      costPrice: 10,
      currentQuantity: 4,
    },
  ];
  expect(
    resolveExportRows(
      'select',
      { categories: [], subCategories: [], brands: [], productIds: [] },
      [],
      stock as never
    )
  ).toEqual([]);
  expect(
    resolveExportRows(
      'current',
      { categories: [], subCategories: [], brands: [], productIds: [] },
      [],
      stock as never
    )
  ).toEqual(stock);
});
