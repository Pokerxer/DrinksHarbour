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

test('generateSalesOrderNumber produces an SO-prefixed per-tenant sequence', async (t) => {
  const { generateSalesOrderNumber } = require('../utils/orderUtils');
  const tenantId = oid();

  t.mock.method(SalesOrder, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => null }) }),
  }));
  const a = await generateSalesOrderNumber(tenantId);
  assert.match(a, /^SO\d{5}$/);
  assert.strictEqual(a, 'SO00001');

  // Simulate that document now existing: the highest is SO00001.
  SalesOrder.findOne.mock.restore();
  t.mock.method(SalesOrder, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => ({ soNumber: 'SO00001' }) }) }),
  }));
  const b = await generateSalesOrderNumber(tenantId);
  assert.match(b, /^SO\d{5}$/);
  assert.notStrictEqual(a, b);
  assert.strictEqual(b, 'SO00002');
});

test('createSalesOrderDoc persists a tenant-scoped order with snapshot totals', async (t) => {
  const svc = require('../services/salesOrder.service');
  const tenantId = oid();

  t.mock.method(SalesOrder, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => null }) }),
  }));
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
  assert.match(so.soNumber, /^SO\d{5}$/);
});
