const test = require('node:test');
const assert = require('node:assert/strict');
const VendorReturn = require('../models/VendorReturn');
const PurchaseOrder = require('../models/PurchaseOrder');
const { getPurchaseOrders } = require('../controllers/purchaseOrder.controller');
test('analytics list scopes applied returns to tenant and annotates each product size', async (t) => {
  const doc = {
    _id: 'po',
    warehouse: 'w',
    items: [
      {
        subProductId: 'a',
        sizeId: 'small',
        quantity: 10,
        receivedQty: 8,
        returnedQty: 2,
        totalCost: 900,
        taxRate: 10,
      },
      { subProductId: 'b', quantity: 3, receivedQty: 3, unitCost: 1000 },
    ],
  };
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    populate: () => chain,
    then: (resolve) => resolve([doc]),
  };
  t.mock.method(PurchaseOrder, 'find', (query) => {
    assert.deepEqual(query, { tenant: 'tenant' });
    return chain;
  });
  t.mock.method(PurchaseOrder, 'countDocuments', async () => 1);
  t.mock.method(VendorReturn, 'find', (query) => {
    assert.equal(query.tenant, 'tenant');
    assert.deepEqual(query.purchaseOrder, { $in: ['po'] });
    return {
      lean: async () => [
        {
          purchaseOrder: 'po',
          warehouse: 'w',
          stockAdjusted: true,
          status: 'confirmed',
          items: [{ subProductId: 'a', sizeId: 'small', quantity: 2, amount: 150 }],
        },
      ],
    };
  });
  const response = await new Promise((resolve, reject) =>
    getPurchaseOrders(
      { user: { tenant: 'tenant' }, query: { analytics: 'true' } },
      {
        status() {
          return this;
        },
        json: resolve,
      },
      reject,
    ),
  );
  assert.deepEqual(response.data[0].items[0].receiptMetrics, {
    receivedQuantity: 10,
    returnedQuantity: 2,
    netReceivedQuantity: 8,
    receivedValue: 990,
    returnedValue: 150,
    netReceivedValue: 840,
  });
  assert.equal(response.data[0].items[1].receiptMetrics.returnedQuantity, 0);
  assert.equal(response.data[0].items[1].receiptMetrics.receivedValue, 3000);
});
test('repeated product-size lines do not multiply receipt or return totals', async (t) => {
  const { withPurchaseReceiptMetrics } = require('../services/purchaseAnalyticsLedger');
  t.mock.method(VendorReturn, 'find', () => ({ lean: async () => [] }));
  const line = { subProductId: 'a', quantity: 5, receivedQty: 5, totalCost: 500 };
  const [order] = await withPurchaseReceiptMetrics([{ _id: 'po', items: [line, line] }], 'tenant');
  assert.equal(
    order.items.reduce((sum, item) => sum + item.receiptMetrics.receivedQuantity, 0),
    10,
  );
  assert.equal(
    order.items.reduce((sum, item) => sum + item.receiptMetrics.receivedValue, 0),
    1000,
  );
});
