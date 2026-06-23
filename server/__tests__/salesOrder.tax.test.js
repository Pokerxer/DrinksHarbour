// server/__tests__/salesOrder.tax.test.js
// Tax-exclusive, per-line tax math for the Sales module (Odoo-style
// Untaxed Amount + Tax + Total). Mirrors the repo convention: pure-helper
// assertions, no DB (see salesOrder.api.test.js).
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');

const oid = () => new mongoose.Types.ObjectId();

test('lineTaxOf applies the per-line rate to the post-discount line total', () => {
  const { lineTaxOf } = require('../services/salesOrder.service');
  // (1000 - 0) * 10 = 10000 untaxed; 7.5% => 750
  assert.strictEqual(lineTaxOf({ unitPrice: 1000, discount: 0, quantity: 10, taxRate: 7.5 }), 750);
  // discount is per-unit and applied before tax: (1000-200)*5 = 4000; 10% => 400
  assert.strictEqual(lineTaxOf({ unitPrice: 1000, discount: 200, quantity: 5, taxRate: 10 }), 400);
  // no rate => no tax
  assert.strictEqual(lineTaxOf({ unitPrice: 1000, discount: 0, quantity: 3, taxRate: 0 }), 0);
  assert.strictEqual(lineTaxOf({ unitPrice: 1000, discount: 0, quantity: 3 }), 0);
});

test('computeTotals returns Odoo-style untaxed/tax/total with mixed per-line rates', () => {
  const { computeTotals } = require('../services/salesOrder.service');
  const items = [
    { unitPrice: 1000, discount: 0, quantity: 10, taxRate: 7.5 }, // untaxed 10000, tax 750
    { unitPrice: 500, discount: 100, quantity: 4, taxRate: 0 },   // untaxed 1600, tax 0
  ];
  const t = computeTotals(items);
  assert.strictEqual(t.subtotal, 12000);       // gross: 1000*10 + 500*4
  assert.strictEqual(t.discountTotal, 400);    // 0*10 + 100*4
  assert.strictEqual(t.taxTotal, 750);         // 750 + 0
  // untaxed amount = subtotal - discountTotal = 11600; total = 11600 + 750
  assert.strictEqual(t.total, 12350);
});

test('computeTotals on an all-zero-rate basket leaves total == untaxed (back-compat)', () => {
  const { computeTotals } = require('../services/salesOrder.service');
  const items = [{ unitPrice: 9300, discount: 0, quantity: 10, taxRate: 0 }];
  const t = computeTotals(items);
  assert.strictEqual(t.subtotal, 93000);
  assert.strictEqual(t.discountTotal, 0);
  assert.strictEqual(t.taxTotal, 0);
  assert.strictEqual(t.total, 93000);
});

test('createSalesOrderDoc snapshots per-line taxRate/lineTax and order taxTotal', async (t) => {
  const svc = require('../services/salesOrder.service');
  const tenantId = oid();
  t.mock.method(SalesOrder, 'countDocuments', async () => 0);
  t.mock.method(SalesOrder, 'create', async (doc) => doc);

  const so = await svc.createSalesOrderDoc({
    tenantId,
    body: {
      docType: 'order',
      items: [
        { product: oid(), subproduct: oid(), size: oid(), quantity: 10, unitPrice: 1000, discount: 0, taxRate: 7.5 },
      ],
    },
  });

  assert.strictEqual(so.items[0].taxRate, 7.5);
  assert.strictEqual(so.items[0].lineTotal, 10000);  // untaxed line total unchanged
  assert.strictEqual(so.items[0].taxAmount, 750);
  assert.strictEqual(so.taxTotal, 750);
  assert.strictEqual(so.total, 10750);
});

test('convertQuotationToOrder carries the tax snapshot across verbatim', async (t) => {
  const svc = require('../services/salesOrder.service');
  t.mock.method(SalesOrder, 'countDocuments', async () => 0);
  t.mock.method(SalesOrder, 'create', async (doc) => ({ ...doc, _id: oid() }));

  const quotation = {
    _id: oid(), tenant: oid(), currency: 'NGN',
    items: [{ product: oid(), subproduct: oid(), size: oid(), sku: 'X', name: 'X',
      quantity: 2, unitPrice: 1000, discount: 0, taxRate: 7.5, lineTotal: 2000, taxAmount: 150 }],
    subtotal: 2000, discountTotal: 0, taxTotal: 150, total: 2150,
    save: async () => {},
  };
  const order = await svc.convertQuotationToOrder(quotation);
  assert.strictEqual(order.items[0].taxRate, 7.5);
  assert.strictEqual(order.items[0].taxAmount, 150);
  assert.strictEqual(order.taxTotal, 150);
  assert.strictEqual(order.total, 2150);
});
