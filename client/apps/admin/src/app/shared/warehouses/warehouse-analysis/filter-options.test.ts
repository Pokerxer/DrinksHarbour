import { expect, it } from 'vitest';
import { analysisFilterLabel, analysisFilterOptions } from './filter-options';
import type { StockRow } from '@/services/warehouseStock.service';
it('keeps product IDs distinct, merges sizes and locations, and excludes metadata without stock', () => {
  const options = analysisFilterOptions(
    [
      {
        subProductId: 'a',
        productName: 'Wine',
        sku: 'A',
        warehouseId: 'w1',
        warehouseName: 'Main',
      },
      {
        subProductId: 'a',
        productName: 'Wine',
        sku: 'A',
        warehouseId: 'w2',
        warehouseName: 'Store',
      },
      {
        subProductId: 'b',
        productName: 'Wine',
        sku: 'B',
        warehouseId: 'w1',
        warehouseName: 'Main',
      },
    ] as StockRow[],
    {
      a: { catId: 'c', catName: 'Wine', brandId: 'brand', brandName: 'Brand' },
      absent: { catId: 'absent', catName: 'Absent', brandId: 'absent', brandName: 'Absent' },
    },
  );
  expect(options.products).toHaveLength(2);
  expect(options.warehouses).toHaveLength(2);
  expect(options.categories.map((choice) => choice._id)).toEqual(['c']);
  expect(options.brands).toHaveLength(1);
  expect(analysisFilterLabel('product_a', options)).toBe('Product: Wine · A');
  expect(analysisFilterLabel('low_stock', options)).toBe('Low Stock');
});
