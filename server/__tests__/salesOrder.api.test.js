// server/__tests__/salesOrder.api.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');

const oid = () => new mongoose.Types.ObjectId();

// NOTE on test strategy: this repo's test suite (see batch.service.test.js,
// poReceive.helpers.test.js, salesFulfill.helpers.test.js) mocks Mongoose
// model methods with node:test's t.mock rather than booting a real DB via
// mongodb-memory-server (that package is not a dependency anywhere in this
// repo). We follow the same convention here.

test('generateSalesOrderNumber produces an SO-prefixed daily-sequenced string, and advances after a doc is created', async (t) => {
  const { generateSalesOrderNumber } = require('../utils/orderUtils');

  t.mock.method(SalesOrder, 'countDocuments', async () => 0);
  const a = await generateSalesOrderNumber();
  assert.match(a, /^SO\d{6}\d{4}$/);
  assert.strictEqual(a, `SO${a.slice(2, 8)}0001`);

  // Simulate a doc having been created today: count advances to 1.
  SalesOrder.countDocuments.mock.restore();
  t.mock.method(SalesOrder, 'countDocuments', async () => 1);
  const b = await generateSalesOrderNumber();
  assert.match(b, /^SO\d{6}\d{4}$/);
  assert.notStrictEqual(a, b);
  assert.strictEqual(b, `SO${b.slice(2, 8)}0002`);
});

test('createSalesOrderDoc persists a tenant-scoped order with snapshot totals', async (t) => {
  const svc = require('../services/salesOrder.service');
  const tenantId = oid();

  t.mock.method(SalesOrder, 'countDocuments', async () => 0);
  t.mock.method(SalesOrder, 'create', async (doc) => doc);

  const so = await svc.createSalesOrderDoc({
    tenantId,
    body: {
      docType: 'order',
      items: [{ product: oid(), subproduct: oid(), size: oid(), quantity: 4, unitPrice: 2500, discount: 0 }],
    },
  });

  assert.strictEqual(String(so.tenant), String(tenantId));
  assert.strictEqual(so.items[0].lineTotal, 10000);
  assert.strictEqual(so.total, 10000);
  assert.strictEqual(so.orderStatus, 'draft');
  assert.match(so.soNumber, /^SO\d{6}\d{4}$/);
});
