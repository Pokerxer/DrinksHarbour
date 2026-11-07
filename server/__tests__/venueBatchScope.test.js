'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
test('batch_depletion_scopes_and_guards_each_quantity_update', async t => {
  const Batch = require('../models/WarehouseBatch'); let filter;
  t.mock.method(Batch, 'find', () => ({ lean: async () => [{ _id: 'batch', quantity: 3, receivedDate: new Date() }] }));
  t.mock.method(Batch, 'updateOne', (query) => { filter = query; return Promise.resolve({ modifiedCount: 1 }); });
  await require('../services/batch.service').depleteBatchesFefo({ tenantId: 'tenant', warehouseId: 'location', subProduct: 'sub', size: 'size', quantity: 2 });
  assert.deepEqual(filter, { _id: 'batch', tenant: 'tenant', warehouse: 'location', subProduct: 'sub', size: 'size', quantity: { $gte: 2 }, quarantined: { $ne: true } });
});
