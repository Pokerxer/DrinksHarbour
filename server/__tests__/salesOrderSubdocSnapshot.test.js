// Regression tests for the Mongoose-subdocument spread pitfall in the sales
// line snapshotting path. `{ ...subdoc }` copies a subdocument's internals,
// NOT its schema fields — so any mapLine input that is a hydrated subdoc used
// to lose quantity/taxRate/promoDiscount and persist lineTotal/taxAmount as 0
// while the order-level totals (read via getters) stayed correct. Seen in the
// wild as sales/[id] rendering ₦0.00 in the per-line Amount column (SO00018).
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const { mapLine, applyEdit } = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

const LINE = {
  lineType: 'product',
  name: 'Test Bottle',
  sku: 'SKU-1',
  quantity: 6,
  unitPrice: 9000,
  discount: 0,
  discountType: 'fixed',
  taxRate: 10,
};

test('mapLine snapshots lineTotal/taxAmount from a Mongoose subdocument input', () => {
  const so = new SalesOrder({
    tenant: oid(),
    soNumber: 'SO-TEST-1',
    docType: 'quotation',
    quoteStatus: 'draft',
    items: [LINE],
  });
  const mapped = so.items.map(mapLine);
  assert.strictEqual(mapped[0].quantity, 6);
  assert.strictEqual(mapped[0].lineTotal, 54000);
  assert.strictEqual(mapped[0].taxAmount, 5400);
});

test('applyEdit same-pricelist fast path keeps per-line snapshots consistent with order totals', async () => {
  const pricelistId = String(oid());
  const so = new SalesOrder({
    tenant: oid(),
    soNumber: 'SO-TEST-2',
    docType: 'quotation',
    quoteStatus: 'draft',
    pricelist: pricelistId,
    items: [],
  });
  // Autosave-style patch: items included, pricelist unchanged → the no-DB
  // normalization branch (mapLine + computeTotals, no pricing engine).
  await applyEdit(so, { pricelist: pricelistId, items: [LINE] });
  assert.strictEqual(so.items.length, 1);
  assert.strictEqual(so.items[0].lineTotal, 54000);
  assert.strictEqual(so.items[0].taxAmount, 5400);
  assert.strictEqual(so.subtotal, 54000);
  assert.strictEqual(so.taxTotal, 5400);
  assert.strictEqual(so.total, 59400);
  // The invariant the bug violated: line snapshots must sum to what the
  // order-level totals say.
  const lineSum = so.items.reduce((s, it) => s + it.lineTotal, 0);
  assert.strictEqual(lineSum, so.subtotal - so.discountTotal);
});
