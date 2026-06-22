// server/__tests__/salesReturn.test.js
const test = require('node:test');
const assert = require('node:assert');
const { returnOrder } = require('../services/salesFulfill.service');

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
