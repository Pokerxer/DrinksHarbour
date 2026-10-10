const test = require('node:test');
const assert = require('node:assert/strict');
const { applyWarehouseImportStock } = require('../services/warehouseImportStock');
function setup() {
  const rows = [
    { warehouse: 'a', currentQuantity: 10, reservedQuantity: 2 },
    { warehouse: 'b', currentQuantity: 30, reservedQuantity: 4 },
  ];
  const sizes = [];
  const d = {
    startSession: async () => ({
      withTransaction: async (work) => work(),
      endSession: async () => {},
    }),
    adjustStock: async (args, user, tenant) => {
      assert.equal(tenant, 't');
      assert.equal(args.warehouseId, 'a');
      rows[0].currentQuantity =
        args.type === 'adjusted' ? args.quantity : rows[0].currentQuantity + args.quantity;
    },
    WarehouseStock: {
      find: (query) => {
        assert.deepEqual(query, { tenant: 't', subProduct: 'sub', size: 'size' });
        return { select: () => ({ session: () => ({ lean: async () => rows }) }) };
      },
    },
    Size: {
      updateOne: (query, update) => {
        assert.deepEqual(query, { _id: 'size', tenant: 't' });
        sizes.push(update.$set);
        return { session: async () => ({}) };
      },
    },
  };
  return { rows, sizes, d };
}
const args = {
  warehouseId: 'a',
  subProductId: 'sub',
  sizeId: 'size',
  qty: 5,
  tenantId: 't',
  user: { _id: 'u' },
  mode: 'update',
};
test('absolute imports change only selected warehouse and preserve aggregate/reservations', async () => {
  const { d, rows, sizes } = setup();
  await applyWarehouseImportStock(d, args);
  assert.equal(rows[0].currentQuantity, 5);
  assert.equal(rows[1].currentQuantity, 30);
  assert.equal(sizes[0].stock, 35);
  assert.equal(sizes[0].availableStock, 29);
  await applyWarehouseImportStock(d, args);
  assert.equal(sizes[1].stock, 35);
  await applyWarehouseImportStock(d, { ...args, qty: 0 });
  assert.equal(rows[1].currentQuantity, 30);
  assert.equal(sizes[2].stock, 30);
});
test('warehouse failures are surfaced and never overwrite aggregate size stock', async () => {
  const { d, sizes } = setup();
  d.adjustStock = async () => {
    throw new Error('warehouse update failed');
  };
  await assert.rejects(applyWarehouseImportStock(d, args), /warehouse update failed/);
  assert.equal(sizes.length, 0);
});
test('supplied quantity needs a warehouse, including zero', async () => {
  await assert.rejects(
    applyWarehouseImportStock(setup().d, { ...args, warehouseId: null, qty: 0 }),
    /warehouse/i,
  );
});
test('import owns one transaction for stock, audit and aggregate with cleanup on failure', async () => {
  const { d } = setup();
  let active = false,
    ended = false;
  const session = {
    withTransaction: async (work) => {
      active = true;
      try {
        return await work();
      } finally {
        active = false;
      }
    },
    endSession: async () => {
      ended = true;
    },
  };
  d.startSession = async () => session;
  d.adjustStock = async (data) => {
    assert.equal(active, true);
    assert.equal(data.session, session);
    assert.equal(data.auditContext.product, 'product');
    throw new Error('audit unavailable');
  };
  await assert.rejects(
    applyWarehouseImportStock(d, { ...args, productId: 'product' }),
    /audit unavailable/,
  );
  assert.equal(ended, true);
});
