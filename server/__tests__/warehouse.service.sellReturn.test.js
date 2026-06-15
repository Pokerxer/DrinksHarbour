// server/__tests__/warehouse.service.sellReturn.test.js
const test = require('node:test');
const assert = require('node:assert');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const SubProduct = require('../models/SubProduct');
const { sellStock, returnStock } = require('../services/warehouse.service');

const TENANT_ID     = 'tenant1';
const USER_ID       = 'user1';
const WAREHOUSE_ID  = 'wh1';
const SUBPRODUCT_ID = 'sp1';
const SIZE_ID       = 'size1';

// recalcSubProductStock(subProduct) calls WarehouseStock.find(...).select(...).lean()
// and SubProduct.updateOne(...) — stub both so it no-ops during these tests.
function mockRecalc(t) {
  t.mock.method(WarehouseStock, 'find', () => ({
    select: () => ({ lean: async () => [] }),
  }));
  t.mock.method(SubProduct, 'updateOne', () => Promise.resolve({}));
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

  assert.deepStrictEqual(result, { before: 20, after: 15 });
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

  assert.deepStrictEqual(result, { before: 3, after: -2 });
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
