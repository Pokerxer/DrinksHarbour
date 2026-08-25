// server/__tests__/batch.transferRevalue.test.js
// Transfer-as-purchase destination revaluation: the mergedUnitCost weighted
// average, and transferBatchesFefo's destUnitCost option that prices NEW
// destination lots at the effective landed cost and re-weights existing ones.
const test = require('node:test');
const assert = require('node:assert');
const { mergedUnitCost } = require('../services/batch.service');
const WarehouseBatch = require('../models/WarehouseBatch');
const batchService = require('../services/batch.service');

test('mergedUnitCost weights by quantity and rounds to kobo', () => {
  assert.equal(mergedUnitCost(10, 1000, 10, 1200), 1100);
  assert.equal(mergedUnitCost(1, 999.99, 2, 1000.25), 1000.16);
});

test('mergedUnitCost degenerate sides fall back to the other cost', () => {
  assert.equal(mergedUnitCost(0, 100, 5, 200), 200);
  assert.equal(mergedUnitCost(4, 300, 0, 999), 300);
});

test('transferBatchesFefo prices new lots at destUnitCost and reweights existing twins', async (t) => {
  const src = [
    { _id: 's1', batchNumber: 'A', expiryDate: new Date('2026-02-01'), quantity: 4, product: 'p1', unitCost: 500 },
    { _id: 's2', batchNumber: 'B', expiryDate: new Date('2026-03-01'), quantity: 10, product: 'p1', unitCost: 500 },
  ];
  t.mock.method(WarehouseBatch, 'find', () => ({ lean: async () => src }));
  t.mock.method(WarehouseBatch, 'updateOne', async () => ({}));
  // Destination twin exists for batch A only; batch B arrives as a fresh lot.
  t.mock.method(WarehouseBatch, 'findOne', async (filter) =>
    filter.batchNumber === 'A' ? { _id: 'd1', quantity: 6, unitCost: 900 } : null
  );
  const upserts = [];
  t.mock.method(WarehouseBatch, 'findOneAndUpdate', async (filter, update) => {
    upserts.push({ filter, update });
    return {};
  });

  await batchService.transferBatchesFefo({
    tenantId: 't1', subProduct: 'sp1', size: 'sz1',
    fromWarehouse: 'w1', toWarehouse: 'w2', quantity: 10,
    destUnitCost: 1200,
  });

  // FEFO: 4 from A then 6 from B.
  // A merges into its twin: (6×900 + 4×1200) / 10 = 1020 via $set.
  assert.equal(upserts[0].update.$set.unitCost, 1020);
  // Regression: unitCost must NOT also appear under $setOnInsert for the merge
  // case — two operators on one path make MongoDB throw
  // "Updating the path 'unitCost' would create a conflict at 'unitCost'".
  assert.ok(!('unitCost' in upserts[0].update.$setOnInsert), 'merged twin must carry unitCost only via $set');
  // B is new at the destination: created at exactly destUnitCost.
  assert.equal(upserts[1].update.$setOnInsert.unitCost, 1200);
  assert.ok(!upserts[1].update.$set, 'fresh lot carries no $set revaluation');
});
