// server/__tests__/warehouse.service.sellReturn.test.js
const test = require('node:test');
const assert = require('node:assert');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const { sellStock, returnStock, transferStock, resolveShopWarehouse } = require('../services/warehouse.service');
const batchService = require('../services/batch.service');

const TENANT_ID     = 'tenant1';
const USER_ID       = 'user1';
const WAREHOUSE_ID  = 'wh1';
const SUBPRODUCT_ID = 'sp1';
const SIZE_ID       = 'size1';

// recalcSubProductStock(subProduct) calls WarehouseStock.find(...).select(...).lean()
// and SubProduct.updateOne(...) — stub both so it no-ops during these tests.
function mockRecalc(t) {
  t.mock.method(WarehouseStock, 'find', () => ({
    select: () => ({ session: () => {}, lean: async () => [] }),
  }));
  t.mock.method(SubProduct, 'updateOne', () => ({ session() {}, then: (resolve) => resolve({}) }));
}

test('sellStock decrements stock and records a shipped movement', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepStrictEqual(filter, {
      tenant: TENANT_ID, warehouse: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID,
      currentQuantity: { $gte: 5 },
    });
    assert.deepStrictEqual(update, { $inc: { currentQuantity: -5 } });
    assert.strictEqual(options.new, true);
    return { currentQuantity: 15 };
  });

  const result = await sellStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5 },
    USER_ID, TENANT_ID
  );

  assert.deepStrictEqual(result, { before: 20, after: 15, batchAllocations: [] });
  assert.strictEqual(movements.length, 1);
  assert.strictEqual(movements[0].type, 'shipped');
  assert.strictEqual(movements[0].quantity, 5);
  assert.strictEqual(movements[0].balanceAfter, 15);
});

test('sellStock throws when stock is insufficient and overselling is disallowed', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async () => null);

  await assert.rejects(
    () => sellStock(
      { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5 },
      USER_ID, TENANT_ID
    ),
    /insufficient/i
  );
  assert.strictEqual(movements.length, 0);
});

test('sellStock allows negative stock when allowOverselling is true', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.strictEqual(filter.currentQuantity, undefined);
    assert.strictEqual(options.upsert, true);
    assert.strictEqual(options.setDefaultsOnInsert, true);
    return { currentQuantity: -2 };
  });

  const result = await sellStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5, allowOverselling: true },
    USER_ID, TENANT_ID
  );

  assert.deepStrictEqual(result, { before: 3, after: -2, batchAllocations: [] });
  assert.strictEqual(movements.length, 1);
});

test('returnStock upserts a missing row and records a returned movement', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepStrictEqual(filter, {
      tenant: TENANT_ID, warehouse: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID,
    });
    assert.deepStrictEqual(update, { $inc: { currentQuantity: 5 } });
    assert.strictEqual(options.upsert, true);
    assert.strictEqual(options.setDefaultsOnInsert, true);
    return { currentQuantity: 5 };
  });

  const result = await returnStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5 },
    USER_ID, TENANT_ID
  );

  assert.deepStrictEqual(result, { before: 0, after: 5 });
  assert.strictEqual(movements.length, 1);
  assert.strictEqual(movements[0].type, 'returned');
});

function fakeTenant(shopsById) {
  return { posSettings: { shops: { id: (id) => shopsById[id] || null } } };
}

test('resolveShopWarehouse returns a custom shop\'s bound warehouse', async (t) => {
  t.mock.method(Warehouse, 'findOne', () => { throw new Error('should not be called'); });
  const tenant = fakeTenant({ shop1: { warehouse: 'whA' } });

  const result = await resolveShopWarehouse(tenant, TENANT_ID, 'shop1');

  assert.strictEqual(result, 'whA');
});

test('resolveShopWarehouse returns null for an unbound custom shop (aggregate stock)', async (t) => {
  t.mock.method(Warehouse, 'findOne', () => { throw new Error('should not be called'); });
  const tenant = fakeTenant({ shop1: { warehouse: null } });

  const result = await resolveShopWarehouse(tenant, TENANT_ID, 'shop1');

  assert.strictEqual(result, null);
});

test('resolveShopWarehouse falls back to the tenant default warehouse for built-in shops', async (t) => {
  t.mock.method(Warehouse, 'findOne', (filter) => {
    assert.deepStrictEqual(filter, { tenant: TENANT_ID, isDefault: true });
    return { select: () => ({ lean: async () => ({ _id: 'whDefault' }) }) };
  });
  const tenant = fakeTenant({});

  const result = await resolveShopWarehouse(tenant, TENANT_ID, undefined);

  assert.strictEqual(result, 'whDefault');
});

test('resolveShopWarehouse falls back to the default warehouse for an unrecognized shopId', async (t) => {
  t.mock.method(Warehouse, 'findOne', () => ({ select: () => ({ lean: async () => ({ _id: 'whDefault' }) }) }));
  const tenant = fakeTenant({});

  const result = await resolveShopWarehouse(tenant, TENANT_ID, 'retail');

  assert.strictEqual(result, 'whDefault');
});

test('resolveShopWarehouse returns null when no default warehouse is configured', async (t) => {
  t.mock.method(Warehouse, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  const tenant = fakeTenant({});

  const result = await resolveShopWarehouse(tenant, TENANT_ID, undefined);

  assert.strictEqual(result, null);
});

test('sellStock returns FEFO batchAllocations when tracksBatch is true', async (t) => {
  mockRecalc(t);
  t.mock.method(WarehouseMovement, 'create', async (d) => d);
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async () => ({ currentQuantity: 8 }));
  t.mock.method(batchService, 'depleteBatchesFefo', async () => ([
    { batch: 'b1', batchNumber: 'B', quantity: 2, expiryDate: null },
  ]));

  const result = await sellStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 2, tracksBatch: true },
    USER_ID, TENANT_ID
  );
  assert.strictEqual(result.after, 8);
  assert.deepStrictEqual(result.batchAllocations, [
    { batch: 'b1', batchNumber: 'B', quantity: 2, expiryDate: null },
  ]);
});

test('returnStock restores exact batches when allocations are supplied', async (t) => {
  mockRecalc(t);
  t.mock.method(WarehouseMovement, 'create', async (d) => d);
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async () => ({ currentQuantity: 12 }));
  let restored = null;
  t.mock.method(batchService, 'restoreBatches', async (allocs) => { restored = allocs; });

  await returnStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 2,
      batchAllocations: [{ batch: 'b1', quantity: 2 }] },
    USER_ID, TENANT_ID
  );
  assert.deepStrictEqual(restored, [{ batch: 'b1', quantity: 2 }]);
});

test('transferStock moves batches with the stock when tracksBatch is true', async (t) => {
  mockRecalc(t);
  const fakeSession = { withTransaction: async (fn) => fn(), endSession() {} };
  t.mock.method(require('mongoose'), 'startSession', async () => fakeSession);
  const src = { currentQuantity: 10, save: async () => {} };
  const dest = { currentQuantity: 0, save: async () => {} };
  let call = 0;
  t.mock.method(WarehouseStock, 'findOne', () => ({ session: () => (call++ === 0 ? src : dest) }));
  t.mock.method(WarehouseMovement, 'create', async () => {});
  let transferred = null;
  t.mock.method(batchService, 'transferBatchesFefo', async (p) => { transferred = p; return []; });

  await transferStock(
    { subProduct: SUBPRODUCT_ID, size: SIZE_ID, fromWarehouse: 'w1', toWarehouse: 'w2', quantity: 6, tracksBatch: true },
    USER_ID, TENANT_ID
  );
  assert.strictEqual(transferred.quantity, 6);
  assert.strictEqual(transferred.toWarehouse, 'w2');
});
