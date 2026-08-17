// server/__tests__/salesOrderDetailPopulate.test.js
//
// getSalesOrder populated nothing, so warehouseId and fulfillments[].by reached
// the client as raw ObjectIds — unrenderable. The detail page showed neither.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const SalesOrder = require('../models/SalesOrder');
const ctrl = require('../controllers/salesOrder.controller');

const oid = () => new mongoose.Types.ObjectId();

test('getSalesOrder populates the warehouse and the person on every fulfilment', async (t) => {
  const tenantId = oid();
  const soId = oid();
  const doc = { _id: soId, tenant: tenantId, soNumber: 'SO00002' };

  const populated = [];
  t.mock.method(SalesOrder, 'findOne', () => {
    const chain = {
      populate(path, select) { populated.push(`${path}:${select}`); return chain; },
      then(resolve) { return Promise.resolve(doc).then(resolve); },
    };
    return chain;
  });

  let payload;
  const req = { params: { id: String(soId) }, tenant: { _id: tenantId } };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await ctrl.getSalesOrder(req, res, (err) => { throw err; });

  assert.strictEqual(payload.data, doc);
  assert.ok(populated.includes('warehouseId:name'));
  assert.ok(populated.includes('fulfillments.warehouseId:name'));
  assert.ok(populated.includes('fulfillments.by:firstName lastName'));
});
