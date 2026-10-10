// __tests__/tax.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  EXTRACTORS,
  DIRECTION,
  NUMBER_FIELD,
  TAX_TYPE_FOR_SOURCE,
  FLOW_FOR_SOURCE,
  _buildRecordGroups,
} = require('../services/tax.service');

test('extractors read each document shape', () => {
  const so = { items: [
    { lineType: 'product', lineTotal: 1000, taxRate: 7.5 },
    { lineType: 'note', lineTotal: 999, taxRate: 99 },
  ] };
  assert.deepEqual(EXTRACTORS.sales_order(so), [{ taxableBase: 1000, taxRate: 7.5 }]);

  const po = { items: [{ totalCost: 500, taxRate: 0 }] };
  assert.deepEqual(EXTRACTORS.purchase_order(po)[0].taxableBase, 500);

  const bill = { subtotal: 1000, taxAmount: 75 };
  assert.equal(EXTRACTORS.vendor_bill(bill)[0].taxRate, 7.5);

  const receipt = { items: [{ itemSubtotal: 1150, taxRate: 7.5 }, { itemSubtotal: 800, taxRate: 0 }] };
  assert.deepEqual(EXTRACTORS.pos(receipt), [
    { taxableBase: 1150, taxRate: 7.5 },
    { taxableBase: 800, taxRate: 0 },
  ]);
});

test('headerRateFrom derives rate from amount/subtotal', () => {
  const st = { items: [{ quantity: 2, costPrice: 100, discountRate: 10, taxRate: 7.5 }] };
  const lines = EXTRACTORS.stock_transfer(st);
  assert.equal(lines[0].taxableBase, 180);
});

test('_buildRecordGroups produces one group per distinct rate', () => {
  const taxes = [{ _id: 't1', name: 'VAT', rate: 7.5, type: 'output', isActive: true }];
  const groups = _buildRecordGroups({
    sourceType: 'sales_order',
    doc: { orderNumber: 'SO-1', items: [
      { lineType: 'product', lineTotal: 1000, taxRate: 7.5 },
      { lineType: 'product', lineTotal: 200, taxRate: 0 },
    ] },
    taxes,
  });
  assert.equal(groups.length, 2);
  // groupLinesByRate sorts ascending: the 0% bucket is groups[0]
  assert.equal(groups[0].tax, null);             // 0% unmatched
  assert.equal(groups[1].taxName, 'VAT');        // 7.5 matched configured tax
  assert.equal(groups[1].tax._id, 't1');
  assert.equal(groups[1].taxAmount, 75);
  assert.equal(DIRECTION.sales_order, 'collected');
  assert.equal(NUMBER_FIELD.vendor_bill, 'billNumber');
  assert.equal(TAX_TYPE_FOR_SOURCE.sales_order, 'output');
  assert.equal(FLOW_FOR_SOURCE.pos, 'sale');
  assert.equal(DIRECTION.pos, 'collected');
  assert.equal(TAX_TYPE_FOR_SOURCE.pos, 'output');
  assert.equal(NUMBER_FIELD.pos, 'receiptNumber');
});

test('POS extractor feeds the record group with output direction', () => {
  const taxes = [{ _id: 't2', name: 'VAT 7.5%', rate: 7.5, type: 'output', isActive: true }];
  const groups = _buildRecordGroups({
    sourceType: 'pos',
    doc: { receiptNumber: 'R-1', items: [{ itemSubtotal: 1150, taxRate: 7.5 }] },
    taxes,
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].taxName, 'VAT 7.5%');
  assert.equal(groups[0].direction, 'collected');
  assert.equal(groups[0].taxableBase, 1150);
  assert.equal(groups[0].taxAmount, 86.25);
});

test('sales invoice VAT uses post-promotion base and the stored charged amount', () => {
  const groups = _buildRecordGroups({ sourceType: 'sales_order', taxes: [], doc: {
    items: [{ lineType: 'product', lineTotal: 1000, promoDiscount: 200, taxRate: 7.5, taxAmount: 60 }],
  } });
  assert.equal(groups[0].taxableBase, 800);
  assert.equal(groups[0].taxAmount, 60);
});

test('vendor bill VAT preserves the header amount instead of rounding the derived rate twice', () => {
  const groups = _buildRecordGroups({ sourceType: 'vendor_bill', taxes: [], doc: { subtotal: 3333, taxAmount: 250 } });
  assert.equal(groups[0].taxAmount, 250);
});

// ── Journal reversal must unwind the VAT capture it posted ───────────────────

test('taxSourceForEntry maps a journal entry back to its tax capture', () => {
  const { taxSourceForEntry } = require('../services/tax.service');
  assert.equal(taxSourceForEntry({ refDocType: 'SalesOrder', refDoc: 'so1', source: 'sales_order' }), 'sales_order');
  assert.equal(taxSourceForEntry({ refDocType: 'VendorBill', refDoc: 'vb1', source: 'vendor_bill' }), 'vendor_bill');
  assert.equal(taxSourceForEntry({ refDocType: 'StockTransfer', refDoc: 'st1', source: 'stock_transfer' }), 'stock_transfer');
  assert.equal(taxSourceForEntry({ refDocType: 'VendorReturn', refDoc: 'vr1', source: 'vendor_return' }), 'vendor_return');
  assert.equal(taxSourceForEntry({ refDocType: 'PurchaseOrder', refDoc: 'po1', source: 'purchase_order' }), 'purchase_order');
  // A POS receipt is an Order, but only the POS flow captures output VAT.
  assert.equal(taxSourceForEntry({ refDocType: 'Order', refDoc: 'o1', source: 'pos' }), 'pos');
  // Marketplace orders, manual entries and refund documents never captured tax.
  assert.equal(taxSourceForEntry({ refDocType: 'Order', refDoc: 'o1', source: 'marketplace' }), null);
  assert.equal(taxSourceForEntry({ refDocType: 'Manual', refDoc: null, source: 'manual' }), null);
  assert.equal(taxSourceForEntry({ refDocType: 'OrderRefund', refDoc: 'r1', source: 'pos' }), null);
  // No business document: nothing was ever captured.
  assert.equal(taxSourceForEntry({ refDocType: 'SalesOrder', refDoc: null, source: 'sales_order' }), null);
  // Reversing a reversal must not fabricate tax records.
  assert.equal(taxSourceForEntry({ refDocType: 'SalesOrder', refDoc: 'so1', source: 'sales_order', entryType: 'reversal' }), null);
});
