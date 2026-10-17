// server/__tests__/salesReturn.test.js
const test = require('node:test');
const assert = require('node:assert');
const { returnOrder } = require('../services/salesFulfill.service');

test('Sales return restores stock once and leaves exactly one dedicated inventory return', async (t) => {
  const WarehouseStock = require('../models/WarehouseStock');
  const WarehouseMovement = require('../models/WarehouseMovement');
  const InventoryMovement = require('../models/InventoryMovement');
  const SubProduct = require('../models/SubProduct');
  const { adjustStock } = require('../services/warehouse.service');
  const row = { currentQuantity: 20, save: async () => {} };
  const history = [];
  t.mock.method(WarehouseStock, 'findOne', async () => row);
  t.mock.method(WarehouseStock, 'find', () => ({ select: () => ({ lean: async () => [row] }) }));
  t.mock.method(SubProduct, 'updateOne', async () => ({}));
  t.mock.method(WarehouseMovement, 'create', async () => ({}));
  t.mock.method(InventoryMovement, 'create', async (docs) => {
    history.push(...(Array.isArray(docs) ? docs : [docs]));
  });
  const so = { _id: 'so', soNumber: 'SO-1', items: [
    { _id: 'line', subproduct: 'sp', size: 'sz', fulfilledQty: 10, returnedQty: 0 },
  ], save: async () => {} };
  const args = { salesOrder: so, tenantId: 't', warehouseId: 'wh', userId: 'u',
    returnLines: [{ lineId: 'line', qty: 4 }], deps: { adjustStock,
      recordMovement: async (movement) => InventoryMovement.create({ ...movement, type: 'return' }) } };
  await returnOrder(args);
  assert.equal(row.currentQuantity, 24);
  assert.equal(history.length, 1, 'one stock event must have one unified inventory entry');
  assert.equal(history[0].type, 'return');
  assert.equal(String(history[0].relatedSalesOrder), 'so');
  await returnOrder({ ...args, returnLines: [{ lineId: 'line', qty: 999 }] });
  await returnOrder(args);
  assert.equal(row.currentQuantity, 30);
  assert.equal(history.length, 2, 'a repeat after full return posts no stock or history');
});

test('returnOrder restocks via adjustStock(received) and advances returnedQty', async () => {
  const restocked = [];
  const so = {
    soNumber: 'SO-9', _id: 'so9', tenant: 't1', orderStatus: 'fulfilled',
    items: [{ _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, fulfilledQty: 100, postedQty: 100, returnedQty: 0 }],
    save: async function () { return this; },
  };
  const deps = {
    adjustStock: async (a) => { restocked.push(a); return { currentQuantity: 30 }; },
    recordMovement: async () => {},
  };
  await returnOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', returnLines: [{ lineId: 'L1', qty: 30 }], userId: 'u1', deps });

  assert.strictEqual(so.items[0].returnedQty, 30);
  assert.strictEqual(restocked[0].type, 'received');
  assert.strictEqual(restocked[0].quantity, 30);
});

test('returnOrder clamps a return to the fulfilled quantity', async () => {
  const so = {
    soNumber: 'SO-10', _id: 'so10', tenant: 't1', orderStatus: 'fulfilled',
    items: [{ _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, fulfilledQty: 40, postedQty: 40, returnedQty: 0 }],
    save: async function () { return this; },
  };
  const deps = { adjustStock: async () => ({ currentQuantity: 0 }), recordMovement: async () => {} };
  await returnOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', returnLines: [{ lineId: 'L1', qty: 999 }], userId: 'u1', deps });
  assert.strictEqual(so.items[0].returnedQty, 40);
});

test('Sales does not restock units already returned through POS', async () => {
  const restocked=[];
  const so={_id:'so',soNumber:'SO00008',items:[{_id:'line',subproduct:'sp',size:'sz',fulfilledQty:10,returnedQty:2}],save:async()=>{}};
  await returnOrder({salesOrder:so,tenantId:'t',warehouseId:'wh',returnLines:[{lineId:'line',qty:10}],userId:'u',
    posReturnedByLine:{line:5}, deps:{adjustStock:async args=>{restocked.push(args.quantity);return {};}}});
  assert.deepStrictEqual(restocked,[3]);
  assert.strictEqual(so.items[0].returnedQty,5,'only Sales-origin quantities may be persisted on the SO');
});
