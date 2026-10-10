const test = require('node:test');
const assert = require('node:assert/strict');
const { applyStockAdjustment } = require('../services/stockAdjustment');
const ids = {
  tenant: '699165839f3308b1baeca8fc',
  warehouse: '699165839f3308b1baeca801',
  product: '699165839f3308b1baeca802',
  size: '699165839f3308b1baeca803',
};
const input = {
  warehouseId: ids.warehouse,
  subProductId: ids.product,
  sizeId: ids.size,
  targetQuantity: 4,
  expectedQuantity: 10,
  reason: 'Stock count',
  notes: 'Full audit notes',
  reference: 'COUNT-1',
  requestId: 'adjustment-test-1',
};
function setup() {
  const state = { count: 10, reserved: 2, movements: [], size: null, calls: 0 };
  const session = {
    withTransaction: async (work) => {
      const before = structuredClone(state);
      try {
        await work();
      } catch (e) {
        Object.assign(state, before);
        throw e;
      }
    },
    endSession: async () => {},
  };
  const query = (result) => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    session(s) {
      assert.equal(s, session);
      return this;
    },
    lean: async () => (typeof result === 'function' ? result() : result),
  });
  const scoped = (q) => {
    assert.equal(String(q.tenant), ids.tenant);
  };
  const d = {
    startSession: async () => session,
    Warehouse: {
      findOne: (q) => {
        scoped(q);
        return query({ _id: ids.warehouse, isActive: true });
      },
    },
    SubProduct: {
      findOne: (q) => {
        scoped(q);
        return query({
          _id: ids.product,
          sizes: [ids.size],
          product: { _id: ids.product, tracksBatch: false },
          costPrice: 10,
        });
      },
      updateOne: (q, update) => {
        scoped(q);
        return {
          session: async () => {
            state.product = update.$set;
          },
        };
      },
    },
    Size: {
      findOne: (q) => {
        scoped(q);
        assert.equal(q.subProduct, ids.product);
        return query({ _id: ids.size, costPrice: 12 });
      },
      updateOne: (q, update) => {
        scoped(q);
        state.size = update.$set;
        return {
          session: async (s) => {
            assert.equal(s, session);
          },
        };
      },
    },
    Tenant: { findOne: () => query({ warehouseSettings: {} }) },
    WarehouseStock: {
      findOne: (q) => {
        scoped(q);
        return query(() => ({ currentQuantity: state.count, reservedQuantity: state.reserved }));
      },
      find: (q) => {
        scoped(q);
        return query(() => [
          { currentQuantity: state.count, reservedQuantity: 2 },
          { currentQuantity: 30, reservedQuantity: 4 },
        ]);
      },
    },
    InventoryMovement: {
      findOne: (q) => {
        scoped(q);
        return query(() =>
          state.movements.find((m) => m.adjustmentRequestId === q.adjustmentRequestId),
        );
      },
      create: async (rows, options) => {
        assert.equal(options.session, session);
        assert.equal(options.ordered, true);
        state.movements.push(...rows);
        return rows;
      },
    },
    adjustStock: async (args) => {
      assert.equal(args.warehouseId, ids.warehouse);
      assert.equal(args.subProduct, ids.product);
      assert.equal(args.size, ids.size);
      assert.equal(args.session, session);
      assert.equal(args.type, 'adjusted');
      assert.equal(args.recordHistory, false);
      state.count = args.quantity;
      state.calls++;
      return {};
    },
  };
  return { d, state };
}
test('changes only the warehouse count and rolls up size stock with reservations and complete audit', async () => {
  const { d, state } = setup();
  const move = await applyStockAdjustment(d, input, 'user', ids.tenant);
  assert.equal(state.count, 4);
  assert.equal(state.size.stock, 34);
  assert.equal(state.size.availableStock, 28);
  assert.equal(state.size.reservedStock, 6);
  assert.equal(move.quantityBefore, 10);
  assert.equal(move.quantityAfter, 4);
  assert.equal(move.quantity, 6);
  assert.equal(move.type, 'adjustment_out');
  assert.equal(move.notes, 'Full audit notes');
  assert.equal(move.reference, 'COUNT-1');
  assert.equal(move.totalCost, 72);
  await applyStockAdjustment(d, input, 'user', ids.tenant);
  assert.equal(state.calls, 1);
  await assert.rejects(
    applyStockAdjustment(d, { ...input, targetQuantity: 5 }, 'user', ids.tenant),
    /request/i,
  );
});
test('zero recount is valid without reservations; stale, unchanged and reserved counts are rejected', async () => {
  const { d, state } = setup();
  await assert.rejects(
    applyStockAdjustment(d, { ...input, expectedQuantity: 9 }, 'user', ids.tenant),
    /changed/i,
  );
  await assert.rejects(
    applyStockAdjustment(d, { ...input, targetQuantity: 1 }, 'user', ids.tenant),
    /reserved/i,
  );
  await assert.rejects(
    applyStockAdjustment(d, { ...input, targetQuantity: 10 }, 'user', ids.tenant),
    /already|unchanged/i,
  );
  state.reserved = 0;
  await applyStockAdjustment(d, { ...input, targetQuantity: 0 }, 'user', ids.tenant);
  assert.equal(state.count, 0);
});
test('rejects malformed counts/foreign sizes and rolls back when history fails', async () => {
  const { d, state } = setup();
  for (const value of [NaN, Infinity, -1, 1.5, '4', null])
    await assert.rejects(
      applyStockAdjustment(d, { ...input, targetQuantity: value }, 'user', ids.tenant),
    );
  d.Size.findOne = () => ({
    select() {
      return this;
    },
    session() {
      return this;
    },
    lean: async () => null,
  });
  await assert.rejects(applyStockAdjustment(d, input, 'user', ids.tenant), /size/i);
  const other = setup();
  other.d.InventoryMovement.create = async () => {
    throw new Error('History failure');
  };
  await assert.rejects(applyStockAdjustment(other.d, input, 'user', ids.tenant), /History failure/);
  assert.equal(other.state.count, 10);
  assert.equal(other.state.calls, 0);
});
test('rejects foreign warehouses/products before stock writes and protects quarantined stock', async () => {
  const query = (data) => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    session() {
      return this;
    },
    lean: async () => data,
  });
  for (const model of ['Warehouse', 'SubProduct']) {
    const { d, state } = setup();
    d[model].findOne = () => query(null);
    await assert.rejects(applyStockAdjustment(d, input, 'user', ids.tenant), /not found/i);
    assert.equal(state.calls, 0);
  }
  const { d, state } = setup();
  d.SubProduct.findOne = () =>
    query({ sizes: [ids.size], product: { tracksBatch: true }, costPrice: 10 });
  d.WarehouseBatch = { find: () => query([{ quantity: 3 }]) };
  await assert.rejects(applyStockAdjustment(d, input, 'user', ids.tenant), /quarantined/i);
  assert.equal(state.calls, 0);
});
test('adjustment controller uses JWT tenant authority and the warehouse-specific service', async (t) => {
  const service = require('../services/stockAdjustment');
  const controller = require('../controllers/inventory.controller');
  let scope;
  t.mock.method(service, 'postStockAdjustment', async (body, actor, tenant) => {
    scope = tenant;
    assert.equal(body, input);
    assert.equal(actor, 'user');
    return { _id: 'move' };
  });
  const req = {
    body: input,
    user: { _id: 'user', tenant: ids.tenant },
    tenant: { _id: '699165839f3308b1baeca899' },
  };
  let status;
  const res = {
    status: (value) => {
      status = value;
      return res;
    },
    json: (body) => {
      assert.equal(body.data._id, 'move');
    },
  };
  await controller.adjustInventory(req, res, (error) => {
    throw error;
  });
  assert.equal(scope, ids.tenant);
  assert.equal(status, 201);
});

test('legacy aggregate and generic adjustment entry points fail closed without warehouse/count details', async () => {
  const inventory = require('../services/inventory.service');
  await assert.rejects(inventory.adjustInventory(ids.product, ids.tenant, 'user'), /details/i);
  await assert.rejects(
    inventory.createMovement(
      { subProductId: ids.product, type: 'adjustment_in', category: 'in', quantity: 4 },
      'user',
      ids.tenant,
    ),
    /warehouse/i,
  );
});
