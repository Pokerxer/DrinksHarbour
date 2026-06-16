// server/__tests__/batch.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const WarehouseBatch = require('../models/WarehouseBatch');
const batchService = require('../services/batch.service');

test('generateBatchNumber builds SKU-YYYYMMDD-seq from existing batches', async (t) => {
  t.mock.method(WarehouseBatch, 'find', () => ({
    select: () => ({ lean: async () => [
      { batchNumber: 'JUICE500-20260616-001' },
      { batchNumber: 'JUICE500-20260616-002' },
    ] }),
  }));
  const number = await batchService.generateBatchNumber({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1',
    sku: 'JUICE500', date: new Date('2026-06-16T00:00:00Z'),
  });
  assert.strictEqual(number, 'JUICE500-20260616-003');
});

test('receiveBatch creates a new batch when the number is free', async (t) => {
  t.mock.method(WarehouseBatch, 'findOne', async () => null);
  let saved = null;
  t.mock.method(WarehouseBatch, 'create', async (doc) => { saved = doc; return { ...doc, _id: 'b-new' }; });

  const res = await batchService.receiveBatch({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1', product: 'p1',
    batchNumber: 'LOT-A', quantity: 12, expiryDate: new Date('2026-12-01'), poNumber: 'PO-1',
  });
  assert.strictEqual(saved.quantity, 12);
  assert.strictEqual(saved.initialQuantity, 12);
  assert.strictEqual(saved.batchNumber, 'LOT-A');
  assert.strictEqual(res._id, 'b-new');
});

test('receiveBatch tops up an existing batch with the same expiry', async (t) => {
  const existing = {
    _id: 'b1', batchNumber: 'LOT-A', quantity: 5, initialQuantity: 5,
    expiryDate: new Date('2026-12-01'),
    save: async function () { return this; },
  };
  t.mock.method(WarehouseBatch, 'findOne', async () => existing);

  const res = await batchService.receiveBatch({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1',
    batchNumber: 'LOT-A', quantity: 7, expiryDate: new Date('2026-12-01'),
  });
  assert.strictEqual(res.quantity, 12);
  assert.strictEqual(res.initialQuantity, 12);
});

test('receiveBatch rejects a top-up when the expiry differs', async (t) => {
  const existing = { _id: 'b1', batchNumber: 'LOT-A', quantity: 5, expiryDate: new Date('2026-12-01') };
  t.mock.method(WarehouseBatch, 'findOne', async () => existing);

  await assert.rejects(
    () => batchService.receiveBatch({
      tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1',
      batchNumber: 'LOT-A', quantity: 7, expiryDate: new Date('2027-01-01'),
    }),
    (err) => err instanceof Error && /expiry/i.test(err.message)
  );
});

test('depleteBatchesFefo decrements earliest-expiry batches and returns allocations', async (t) => {
  const b1 = { _id: 'b1', batchNumber: 'B', expiryDate: new Date('2026-02-01'), quantity: 30 };
  const b2 = { _id: 'b2', batchNumber: 'A', expiryDate: new Date('2026-03-01'), quantity: 50 };
  t.mock.method(WarehouseBatch, 'find', () => ({ lean: async () => [b1, b2] }));
  const saved = {};
  t.mock.method(WarehouseBatch, 'updateOne', async (filter, update) => { saved[filter._id] = update.$inc.quantity; return {}; });

  const allocations = await batchService.depleteBatchesFefo({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1', quantity: 40,
  });
  assert.deepStrictEqual(allocations.map(a => [a.batchNumber, a.quantity]), [['B', 30], ['A', 10]]);
  assert.strictEqual(saved['b1'], -30);
  assert.strictEqual(saved['b2'], -10);
});

test('restoreBatches increments each allocation batch', async (t) => {
  const incs = {};
  t.mock.method(WarehouseBatch, 'updateOne', async (filter, update) => { incs[filter._id] = update.$inc.quantity; return {}; });
  await batchService.restoreBatches(
    [{ batch: 'b1', quantity: 7 }, { batch: 'b2', quantity: 3 }]
  );
  assert.deepStrictEqual(incs, { b1: 7, b2: 3 });
});

test('transferBatchesFefo decrements source batches and upserts twins at destination', async (t) => {
  const src = [
    { _id: 's1', batchNumber: 'B', expiryDate: new Date('2026-02-01'), quantity: 4, product: 'p1' },
    { _id: 's2', batchNumber: 'A', expiryDate: new Date('2026-03-01'), quantity: 10, product: 'p1' },
  ];
  t.mock.method(WarehouseBatch, 'find', () => ({ lean: async () => src }));
  const decs = {};
  t.mock.method(WarehouseBatch, 'updateOne', async (filter, update) => { decs[filter._id] = update.$inc.quantity; return {}; });
  const upserts = [];
  t.mock.method(WarehouseBatch, 'findOneAndUpdate', async (filter, update, opts) => {
    upserts.push({ filter, update, opts }); return { ...filter, ...update.$setOnInsert };
  });

  await batchService.transferBatchesFefo({
    tenantId: 't1', subProduct: 'sp1', size: 'sz1',
    fromWarehouse: 'w1', toWarehouse: 'w2', quantity: 6,
  });
  // FEFO: take 4 from B then 2 from A at source
  assert.strictEqual(decs['s1'], -4);
  assert.strictEqual(decs['s2'], -2);
  // Two twins created at destination warehouse w2
  assert.strictEqual(upserts.length, 2);
  assert.strictEqual(upserts[0].filter.warehouse, 'w2');
});
