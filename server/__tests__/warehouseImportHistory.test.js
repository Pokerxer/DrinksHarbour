const test = require('node:test');
const assert = require('node:assert/strict');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const InventoryMovement = require('../models/InventoryMovement');
const SubProduct = require('../models/SubProduct');
const { adjustStock } = require('../services/warehouse.service');
const batchService = require('../services/batch.service');
function fixture(t, before, failMirror = false) {
  const session = { transaction: 'import' };
  const audits = [],
    mirrors = [],
    writes = [];
  const row = {
    currentQuantity: before,
    save: async (options) => {
      writes.push(options);
    },
  };
  t.mock.method(WarehouseStock, 'findOne', () => ({
    session: (value) => {
      assert.equal(value, session);
      return Promise.resolve(row);
    },
    then: (resolve) => resolve(row),
  }));
  const cursor = {
    session: (value) => {
      assert.equal(value, session);
      return cursor;
    },
    select: () => cursor,
    lean: async () => [{ currentQuantity: row.currentQuantity }],
  };
  t.mock.method(WarehouseStock, 'find', () => cursor);
  const update = {
    session: (value) => {
      assert.equal(value, session);
      return update;
    },
    then: (resolve) => resolve({}),
  };
  t.mock.method(SubProduct, 'updateOne', () => update);
  t.mock.method(WarehouseMovement, 'create', async (docs, options) => {
    audits.push(...(Array.isArray(docs) ? docs : [docs]));
    writes.push(options);
  });
  t.mock.method(InventoryMovement, 'create', async (docs, options) => {
    if (failMirror) throw new Error('history unavailable');
    mirrors.push(...docs);
    writes.push(options);
  });
  return { session, audits, mirrors, writes };
}
test('warehouse corrections keep batch depletion in the same transaction without a duplicate ledger mirror', async (t) => {
  const { session, audits, mirrors } = fixture(t, 10);
  let depletion;
  t.mock.method(batchService, 'depleteBatchesFefo', async (args, activeSession) => {
    depletion = args;
    assert.equal(activeSession, session);
  });
  await adjustStock(
    {
      warehouseId: 'A',
      subProduct: 'sub',
      size: 'size',
      type: 'adjusted',
      quantity: 4,
      tracksBatch: true,
      recordHistory: false,
      session,
    },
    'operator',
    'tenant',
  );
  assert.equal(depletion.quantity, 6);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].stockChange, -6);
  assert.equal(mirrors.length, 0);
});
for (const [name, type, before, quantity, after, delta] of [
  ['receipt', 'received', 0, 5, 5, 5],
  ['increase', 'adjusted', 10, 15, 15, 5],
  ['decrease', 'adjusted', 10, 5, 5, -5],
  ['clear', 'adjusted', 10, 0, 0, -10],
  ['unchanged recount', 'adjusted', 5, 5, 5, 0],
]) {
  test(`import ${name} records local balances and one linked audit in each ledger`, async (t) => {
    const { session, audits, mirrors, writes } = fixture(t, before);
    await adjustStock(
      {
        warehouseId: 'A',
        subProduct: 'sub',
        size: 'size',
        type,
        quantity,
        notes: 'Bulk import stock update',
        session,
        auditContext: { product: 'product', referenceType: 'adjustment', source: 'sync' },
      },
      'operator',
      'tenant',
    );
    assert.equal(audits.length, 1);
    assert.equal(mirrors.length, 1);
    assert.equal(audits[0].balanceBefore, before);
    assert.equal(audits[0].balanceAfter, after);
    assert.equal(audits[0].stockChange, delta);
    const mirror = mirrors[0];
    assert.equal(mirror.quantityBefore, before);
    assert.equal(mirror.quantityAfter, after);
    assert.equal(mirror.quantity, Math.abs(delta));
    assert.equal(mirror.product, 'product');
    assert.equal(mirror.warehouse, 'A');
    assert.equal(mirror.size, 'size');
    assert.equal(mirror.tenant, 'tenant');
    assert.equal(mirror.performedBy, 'operator');
    assert.equal(mirror.source, 'sync');
    assert.equal(mirror.reference, 'Bulk import stock update');
    for (const options of writes) assert.equal(options.session, session);
    assert.equal(writes[1].ordered, true);
    assert.equal(writes[2].ordered, true);
  });
}
test('transactional import history failure reaches transaction owner for rollback', async (t) => {
  const { session } = fixture(t, 10, true);
  await assert.rejects(
    adjustStock(
      { warehouseId: 'A', subProduct: 'sub', size: 'size', type: 'adjusted', quantity: 5, session },
      'operator',
      'tenant',
    ),
    /history unavailable/,
  );
});
