// __tests__/tax.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  EXTRACTORS,
  DIRECTION,
  NUMBER_FIELD,
  TAX_TYPE_FOR_SOURCE,
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
});
