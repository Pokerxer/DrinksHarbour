// server/__tests__/stockTransfer.schema.test.js
// Pins the transfer-as-purchase schema surface: new statuses, money snapshot
// fields, receipts subdocuments and the per-line rate/received bookkeeping.
const test = require('node:test');
const assert = require('node:assert');

test('StockTransfer schema carries the purchase fields', () => {
  const StockTransfer = require('../models/StockTransfer');
  const path = StockTransfer.schema.path.bind(StockTransfer.schema);
  assert.ok(path('status').enumValues.includes('in_transit'));
  assert.ok(path('status').enumValues.includes('partially_received'));
  for (const p of ['deliveryCharge', 'subtotal', 'discountAmount', 'taxAmount', 'total'])
    assert.equal(path(p).options.default, 0, p);
  assert.ok(path('dispatchedBy'), 'dispatchedBy');
  assert.equal(path('closedWithShortage').options.default, false);

  const item = StockTransfer.schema.path('items').schema.path
    .bind(StockTransfer.schema.path('items').schema);
  assert.equal(item('discountRate').options.default, 0);
  assert.equal(item('taxRate').options.default, 0);
  assert.equal(item('receivedQty').options.default, 0);
  assert.ok(item('receivedQty').options.min === 0);

  const receiptsPath = StockTransfer.schema.path('receipts');
  const receipt = receiptsPath.schema.path.bind(receiptsPath.schema);
  assert.ok(receipt('lines'), 'receipt lines subdoc');
  assert.ok(receipt('receivedBy'), 'receipt receiver');
});

test('Warehouse schema carries the managers list', () => {
  const Warehouse = require('../models/Warehouse');
  const p = Warehouse.schema.path('managers');
  assert.ok(p, 'managers path exists');
  assert.equal(p.instance, 'Array');
  assert.equal(p.embeddedSchemaType.options.ref, 'User'); // mongoose ≥9: caster was renamed embeddedSchemaType
});
