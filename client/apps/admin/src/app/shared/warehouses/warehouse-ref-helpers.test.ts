import { describe, expect, it } from 'vitest';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import {
  isPopulated,
  refIdOf,
  skuOf,
  productNameOf,
  imageOf,
  subProductIdOf,
  sizeLabelOf,
  sizeIdOf,
  warehouseNameOf,
  warehouseCodeOf,
} from './warehouse-ref-helpers';

// A stock line whose subProduct/size/warehouse refs are all dangling: the
// referenced docs were deleted, so populate resolved each to null. This is the
// exact shape of the 11 rows in "Main Shop" that blanked the whole page.
const orphanRow = {
  _id: 'ws1',
  warehouse: null,
  subProduct: null,
  size: null,
  currentQuantity: 42,
  reservedQuantity: 3,
} as unknown as WarehouseStockRow;

const populatedRow = {
  _id: 'ws2',
  warehouse: { _id: 'w1', name: 'Main Shop', code: 'MS' },
  subProduct: {
    _id: 'sp1',
    sku: 'SKU-1',
    imagesOverride: [{ url: 'override.jpg' }],
    product: { _id: 'p1', name: 'Jack Daniels', images: [{ url: 'p.jpg' }] },
  },
  size: { _id: 'sz1', size: '75cl' },
  currentQuantity: 10,
  reservedQuantity: 0,
} as unknown as WarehouseStockRow;

const unpopulatedRow = {
  _id: 'ws3',
  warehouse: 'w1',
  subProduct: 'sp1',
  size: 'sz1',
  currentQuantity: 5,
  reservedQuantity: 0,
} as unknown as WarehouseStockRow;

describe('isPopulated', () => {
  it('rejects null — typeof null === "object" is the whole bug', () => {
    expect(isPopulated(null)).toBe(false);
    expect(typeof null === 'object').toBe(true); // documents why the guard exists
  });

  it('rejects undefined and id strings, accepts documents', () => {
    expect(isPopulated(undefined)).toBe(false);
    expect(isPopulated('64f0a1')).toBe(false);
    expect(isPopulated({ _id: 'x' })).toBe(true);
  });
});

describe('accessors on an orphaned row (dangling refs → null)', () => {
  it('never throws — the render-time crash regression', () => {
    // Before the fix each of these threw
    // "Cannot read properties of null (reading '_id')".
    expect(() => {
      skuOf(orphanRow);
      productNameOf(orphanRow);
      imageOf(orphanRow);
      subProductIdOf(orphanRow);
      sizeLabelOf(orphanRow);
      sizeIdOf(orphanRow);
      warehouseNameOf(orphanRow);
      warehouseCodeOf(orphanRow);
      refIdOf(orphanRow.warehouse);
      refIdOf(orphanRow.size);
    }).not.toThrow();
  });

  it('degrades to blank labels rather than dropping the row', () => {
    expect(skuOf(orphanRow)).toBe('');
    expect(productNameOf(orphanRow)).toBe('');
    expect(sizeLabelOf(orphanRow)).toBe('');
    expect(warehouseNameOf(orphanRow)).toBe('');
    expect(warehouseCodeOf(orphanRow)).toBe('');
    expect(refIdOf(orphanRow.warehouse)).toBe('');
  });

  it('returns null ids so callers suppress links instead of building bad hrefs', () => {
    expect(imageOf(orphanRow)).toBeNull();
    expect(subProductIdOf(orphanRow)).toBeNull();
    expect(sizeIdOf(orphanRow)).toBeNull();
  });

  it('keeps the quantity intact — orphans are real stock', () => {
    // Filtering these rows out would understate on-hand quantities.
    expect(orphanRow.currentQuantity).toBe(42);
  });
});

describe('accessors on a populated row', () => {
  it('reads through the populated documents', () => {
    expect(skuOf(populatedRow)).toBe('SKU-1');
    expect(productNameOf(populatedRow)).toBe('Jack Daniels');
    expect(subProductIdOf(populatedRow)).toBe('sp1');
    expect(sizeLabelOf(populatedRow)).toBe('75cl');
    expect(sizeIdOf(populatedRow)).toBe('sz1');
    expect(warehouseNameOf(populatedRow)).toBe('Main Shop');
    expect(warehouseCodeOf(populatedRow)).toBe('MS');
    expect(refIdOf(populatedRow.warehouse)).toBe('w1');
  });

  it('prefers the subproduct image override over the product image', () => {
    expect(imageOf(populatedRow)).toBe('override.jpg');
  });

  it('falls back to _id when the display field is missing', () => {
    const noNames = {
      warehouse: { _id: 'w9' },
      subProduct: { _id: 'sp9' },
      size: { _id: 'sz9' },
    } as unknown as WarehouseStockRow;
    expect(warehouseNameOf(noNames)).toBe('w9');
    expect(skuOf(noNames)).toBe('sp9');
    expect(sizeLabelOf(noNames)).toBe('sz9');
  });
});

describe('accessors on an unpopulated row (bare id strings)', () => {
  it('passes the id through instead of treating it as a document', () => {
    expect(skuOf(unpopulatedRow)).toBe('sp1');
    expect(subProductIdOf(unpopulatedRow)).toBe('sp1');
    expect(sizeLabelOf(unpopulatedRow)).toBe('sz1');
    expect(sizeIdOf(unpopulatedRow)).toBe('sz1');
    expect(warehouseNameOf(unpopulatedRow)).toBe('w1');
    expect(refIdOf(unpopulatedRow.size)).toBe('sz1');
    expect(productNameOf(unpopulatedRow)).toBe('');
    expect(imageOf(unpopulatedRow)).toBeNull();
  });
});
