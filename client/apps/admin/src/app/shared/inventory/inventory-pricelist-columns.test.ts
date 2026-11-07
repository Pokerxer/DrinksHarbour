import { describe, expect, it } from 'vitest';
import { buildPriceColumnGrid } from './inventory-pricelist-columns';
import type { PricableStockLine } from './inventory-pricelist-print';

const line = (over: Partial<PricableStockLine> = {}): PricableStockLine => ({
  productName: 'Linen Shirt',
  sku: 'LS-01',
  sizeName: 'M',
  categoryName: 'Apparel',
  sellingPrice: 10000,
  costPrice: 7000,
  subProductId: 'sp1',
  sizeId: 'sz1',
  currentQuantity: 4,
  ...over,
});

const column = { label: 'Price List', pricelist: null, mode: 'unit' as const };

// Retail variant identity (DRI-30): the column grid is the CSV/preview
// presentation path — same-size colour siblings stay distinct, deterministically
// ordered rows; the no-variant legacy beverage row keeps its byte shape.
describe('buildPriceColumnGrid', () => {
  it('keeps same-size colour siblings distinct and ordered by the composed label', () => {
    const grid = buildPriceColumnGrid(
      [
        line({ sizeId: 'sz-iv', colorName: 'Ivory' }),
        line({ sizeId: 'sz-em', colorName: 'Emerald' }),
        line({ sizeId: 'sz-70', sizeName: '70cl', productName: 'Hennessy VS' }),
      ],
      [column],
      0
    );
    expect(grid.rows).toHaveLength(3);
    const identity = grid.rows.map(({ line }) =>
      line.colorName ? `${line.sizeName} · ${line.colorName}` : line.sizeName
    );
    // '70cl' sorts before 'M'; Emerald precedes Ivory deterministically.
    expect(identity).toEqual(['70cl', 'M · Emerald', 'M · Ivory']);
  });

  it('keeps the legacy no-variant row byte-identical', () => {
    const grid = buildPriceColumnGrid([line({ sizeId: 'sz-70', sizeName: '70cl' })], [column], 0);
    const [first] = grid.rows;
    expect(first.line.sizeName).toBe('70cl');
    expect(first.line.colorName ?? null).toBeNull();
  });
});
