import { describe, expect, it } from 'vitest';
import {
  buildTransferCatalogue,
  paginateTransferCatalogue,
  transferStockKey,
  type TransferCatalogRow,
} from './stock-transfer-catalog-data';

function row(fields: Partial<TransferCatalogRow> = {}): TransferCatalogRow {
  return {
    subProductId: 'wine',
    name: 'Test Wine',
    sku: 'WINE',
    quantity: 4,
    unitsPerPack: 6,
    costPrice: 500,
    wholesalePrice: 600,
    ...fields,
  };
}

describe('transfer catalogue', () => {
  it('groups source-stock sizes by product and keeps distinct IDs with the same label', () => {
    const red = row({ sizeId: 'red', sizeName: '75cl', sku: 'RED' });
    const blue = row({
      sizeId: 'blue',
      sizeName: '75cl',
      sku: 'BLUE',
      wholesalePrice: 0,
    });
    const { products, rowsByKey } = buildTransferCatalogue(
      [red, blue, row({ sizeId: 'empty', quantity: 0 }), row()],
      'wholesale'
    );
    expect(products).toHaveLength(2);
    expect(
      products[0].sizes.map((size) => [size.size, size.costPrice])
    ).toEqual([
      ['red', 600],
      ['blue', 500],
    ]);
    expect(products[0].availableStock).toBe(8);
    expect(rowsByKey.get(transferStockKey('wine', 'blue'))).toBe(blue);
    expect(rowsByKey.has(transferStockKey('wine', 'empty'))).toBe(false);
  });

  it('searches source SKUs across every page and clamps the page after filtering', () => {
    const rows = Array.from({ length: 65 }, (_, index) =>
      row({
        subProductId: String(index),
        name: `Wine ${index}`,
        sizeId: 'size',
        sku: `SKU-${index}`,
      })
    );
    const catalogue = buildTransferCatalogue(rows, 'cost');
    expect(
      paginateTransferCatalogue(catalogue.products, '', 'name', 3).pagination
    ).toMatchObject({ total: 65, page: 3, pages: 3, hasNext: false });
    const result = paginateTransferCatalogue(
      catalogue.products,
      'SKU-64',
      'name',
      3
    );
    expect(result.products.map((product) => product._id)).toEqual(['64']);
    expect(result.pagination).toMatchObject({ total: 1, page: 1 });
  });
});
