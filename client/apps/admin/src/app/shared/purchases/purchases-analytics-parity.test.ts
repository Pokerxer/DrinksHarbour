import { describe, it, expect } from 'vitest';
import { applyFilters, aggregateMeasure, lineUntaxed } from './purchases-analytics-helpers';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
const po = {
  _id: 'po',
  status: 'purchase',
  createdAt: '2026-10-04T23:30:00Z',
  poNumber: 'PO-7',
  vendorReference: 'Supplier-X',
  currency: 'NGN',
  items: [
    {
      subProductId: 'a',
      productName: 'Red Wine',
      sku: 'RED-A',
      quantity: 10,
      unitCost: 100,
      totalCost: 900,
      taxRate: 10,
      receivedQty: 6,
      returnedQty: 2,
    },
    {
      subProductId: 'b',
      productName: 'White Wine',
      sku: 'WHITE-B',
      quantity: 20,
      unitCost: 200,
      receivedQty: 20,
    },
    { subProductId: 'c', productName: 'Beer', sku: 'BEER-C', quantity: 3, unitCost: 50 },
  ],
} as unknown as PurchaseOrder;
describe('warehouse parity in purchase analytics', () => {
  it('multi-product selections project only contributing invoice lines without mutating invoices', () => {
    const result = applyFilters([po], ['product_id:a', 'product_id:c'], {});
    expect(result[0].items.map((i) => i.subProductId)).toEqual(['a', 'c']);
    expect(po.items).toHaveLength(3);
  });
  it('product and category must match on the same line', () => {
    expect(
      applyFilters([po], ['product_id:a', 'category_white'], {
        b: { catId: 'white', catName: 'White', brandId: '', brandName: '' },
      }),
    ).toEqual([]);
  });
  it('searches multiple names or SKUs separated by comma', () => {
    expect(
      applyFilters([po], ['product_search:red-a, beer'], {})[0].items.map((i) => i.subProductId),
    ).toEqual(['a', 'c']);
  });
  it('intersects inclusive UTC creation dates and invoice references', () => {
    expect(
      applyFilters(
        [po],
        ['created_from:2026-10-04', 'created_to:2026-10-04', 'reference:supplier-x'],
        {},
      ),
    ).toHaveLength(1);
    expect(applyFilters([po], ['created_to:2026-10-03'], {})).toEqual([]);
    expect(applyFilters([po], ['reference:missing'], {})).toEqual([]);
  });
  it('uses saved discounted cost and keeps ordered value distinct from returned receipt value', () => {
    expect(lineUntaxed(po.items[0])).toBe(900);
    const item = {
      ...po.items[0],
      receiptMetrics: {
        receivedQuantity: 8,
        returnedQuantity: 2,
        netReceivedQuantity: 6,
        receivedValue: 792,
        returnedValue: 198,
        netReceivedValue: 594,
      },
    };
    const lines = [{ item, currency: 'NGN' }];
    expect(aggregateMeasure([po], lines, 'received_qty', (n) => n)).toBe(8);
    expect(aggregateMeasure([po], lines, 'returned_qty', (n) => n)).toBe(2);
    expect(aggregateMeasure([po], lines, 'net_received_value', (n) => n)).toBe(594);
  });
});
import { purchaseReceiptTotals } from './purchase-analytics-ledger';
it('receipt totals keep currencies separate and exclude cancelled purchases', () => {
  const cancelled = { ...po, status: 'cancelled' } as PurchaseOrder;
  const totals = purchaseReceiptTotals([po, { ...po, _id: 'usd', currency: 'USD' }, cancelled]);
  expect(
    totals.currencies.map((row) => [
      row.currency,
      row.receivedQuantity,
      row.returnedQuantity,
      row.netReceivedQuantity,
    ]),
  ).toEqual([
    ['NGN', 28, 2, 26],
    ['USD', 28, 2, 26],
  ]);
});
import { buildPurchaseSummary } from './purchase-analytics-summary';
it('vendor, product and approval widgets use the same filtered lines and discounted costs', () => {
  const selected = applyFilters(
    [{ ...po, vendorName: 'Supplier', approvalStatus: 'pending' } as PurchaseOrder],
    ['product_id:a'],
    {},
  );
  const summary = buildPurchaseSummary(selected, (amount) => amount);
  expect(summary.totalAmount).toBe(990);
  expect(summary.topVendors[0].amount).toBe(990);
  expect(summary.topProducts).toHaveLength(1);
  expect(summary.topProducts[0].totalQuantity).toBe(10);
  expect(summary.pendingApprovals).toBe(1);
});
