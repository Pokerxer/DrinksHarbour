import { expect, it } from 'vitest';
import { buildStockReport, filterStockRows } from './stock-report';
it('tracks reserved quantities and derives available stock without double counting', () => {
  const report = buildStockReport({
    subProducts: [
      {
        _id: 'a',
        sizes: [
          { _id: 's', stock: 10, reservedStock: 3, availableStock: 7 },
          { _id: 'z', stock: 0, reservedStock: 0, availableStock: 0 },
        ],
      },
    ],
  });
  expect(report.reserved).toBe(3);
  expect(report.available).toBe(7);
  expect(report.rows[0].reserved).toBe(3);
  expect(report.rows[0].available).toBe(7);
});
it('missing reservation data remains unknown instead of implying none are reserved', () => {
  const report = buildStockReport({
    subProducts: [{ _id: 'a', sizes: [{ _id: 's', stock: 10 }] }],
  });
  expect(report.reserved).toBeNull();
  expect(report.available).toBeNull();
  expect(report.rows[0].reserved).toBeNull();
  expect(report.rows[0].available).toBeNull();
});
it('flags oversubscribed or inconsistent reservation balances', () => {
  const report = buildStockReport({
    subProducts: [
      {
        _id: 'a',
        sizes: [{ _id: 's', stock: 4, reservedStock: 6, availableStock: 4 }],
      },
    ],
  });
  expect(report.available).toBe(0);
  expect(report.reserved).toBe(6);
  expect(report.inconsistentBalances).toBe(1);
});
it('does not offset an over-reserved size against available units of a different size', () => {
  const report = buildStockReport({
    subProducts: [
      {
        _id: 'a',
        sizes: [
          { _id: 'small', stock: 4, reservedStock: 6 },
          { _id: 'large', stock: 10, reservedStock: 0 },
        ],
      },
    ],
  });
  expect(report.available).toBe(10);
  expect(report.reserved).toBe(6);
  expect(report.inconsistentBalances).toBe(1);
});
it('uses each size once, preserves zero and separates tenant listings', () => {
  const report = buildStockReport({
    subProducts: [
      {
        _id: 'a',
        sku: 'A',
        tenant: { _id: 'ta', name: 'Harbour Shop' },
        status: 'active',
        sizes: [
          { _id: 'one', size: '70cl', stock: 4 },
          { _id: 'two', size: '1L', stock: 0 },
        ],
      },
      {
        _id: 'b',
        tenant: { _id: 'tb', name: 'Cellar' },
        status: 'draft',
        sizes: [{ _id: 'three', size: '70cl', stock: 6 }],
      },
    ],
  });
  expect(report.onHand).toBe(10);
  expect(report.rows).toHaveLength(3);
  expect(report.listings).toBe(2);
  expect(filterStockRows(report.rows, 'cellar')).toHaveLength(1);
  expect(filterStockRows(report.rows, '1l')[0].quantity).toBe(0);
});
it('unknown quantities do not masquerade as zero or complete totals', () => {
  const report = buildStockReport({
    subProducts: [
      { _id: 'a', tenant: null, sizes: [{ _id: 's', size: 'bottle' }] },
    ],
  });
  expect(report.onHand).toBeNull();
  expect(report.knownOnHand).toBe(0);
  expect(report.rows[0].quantity).toBeNull();
  expect(report.missingQuantities).toBe(1);
});
it('does not double count a listing aggregate and its sizes, and flags disagreement', () => {
  const report = buildStockReport({
    subProducts: [
      { _id: 'a', totalStock: 12, sizes: [{ _id: 's', stock: 4 }] },
    ],
  });
  expect(report.onHand).toBe(12);
  expect(report.rows[0].quantity).toBe(4);
  expect(report.mismatchedListings).toBe(1);
});
it('shows aggregate-only listings and rejects malformed data instead of showing an empty table', () => {
  const report = buildStockReport({
    subProducts: [{ _id: 'a', totalStock: 3, sizes: [] }],
  });
  expect(report.onHand).toBe(3);
  expect(report.rows[0].size).toBe('All sizes (listing total)');
  expect(buildStockReport({ subProducts: [] }).onHand).toBe(0);
  expect(() => buildStockReport({})).toThrow();
});
