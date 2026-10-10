const test = require('node:test');
const assert = require('node:assert/strict');
const { purchaseMetrics, summarizePurchases } = require('../services/warehousePurchaseTotals');
const warehouse = '111111111111111111111111';
const product = '222222222222222222222222';
const otherProduct = '333333333333333333333333';
const po = {
  _id: 'po',
  warehouse,
  currency: 'NGN',
  items: [
    {
      subProductId: product,
      quantity: 20,
      receivedQty: 12,
      returnedQty: 3,
      totalCost: 2000,
      taxRate: 10,
    },
  ],
  partialReceipts: [
    { warehouseId: warehouse, items: [{ subProductId: product, quantityReceived: 10 }] },
    { warehouseId: 'other', items: [{ subProductId: product, quantityReceived: 5 }] },
    {
      warehouseId: warehouse,
      status: 'cancelled',
      items: [{ subProductId: product, quantityReceived: 8 }],
    },
  ],
};
const returns = [
  {
    purchaseOrder: 'po',
    warehouse,
    stockAdjusted: true,
    status: 'confirmed',
    items: [{ subProductId: product, quantity: 2, amount: 220 }],
  },
  {
    purchaseOrder: 'po',
    warehouse: 'other',
    stockAdjusted: true,
    status: 'confirmed',
    items: [{ subProductId: product, quantity: 1, amount: 110 }],
  },
  {
    purchaseOrder: 'po',
    warehouse,
    stockAdjusted: false,
    status: 'cancelled',
    items: [{ subProductId: product, quantity: 4, amount: 440 }],
  },
];
test('purchase totals attribute receipts and applied returns only to this warehouse', () => {
  const result = purchaseMetrics(po, warehouse, '', returns);
  assert.equal(result.receivedQuantity, 10);
  assert.equal(result.returnedQuantity, 2);
  assert.equal(result.netReceivedQuantity, 8);
  assert.equal(result.receivedValue, 1100);
  assert.equal(result.returnedValue, 220);
  assert.equal(result.netReceivedValue, 880);
});
test('sums every purchase, keeps currencies separate and supports product subsets', () => {
  const second = {
    ...po,
    _id: 'second',
    items: [
      { ...po.items[0], returnedQty: 0 },
      { subProductId: otherProduct, quantity: 2, totalCost: 100 },
    ],
    partialReceipts: [
      {
        warehouseId: warehouse,
        items: [
          { subProductId: product, quantityReceived: 4 },
          { subProductId: otherProduct, quantityReceived: 2 },
        ],
      },
    ],
  };
  const result = summarizePurchases(
    [po, second, { ...second, _id: 'usd', currency: 'USD' }],
    warehouse,
    product,
    returns,
  );
  assert.equal(result[0].receivedQuantity, 14);
  assert.equal(result[0].netReceivedQuantity, 12);
  assert.equal(result[0].netReceivedValue, 1320);
  assert.equal(result.length, 2);
});
test('full returns reach zero and cancelled returns do not reduce purchases', () => {
  const full = [{ ...returns[0], items: [{ subProductId: product, quantity: 10, amount: 1100 }] }];
  assert.equal(purchaseMetrics(po, warehouse, product, full).netReceivedQuantity, 0);
  assert.equal(purchaseMetrics(po, warehouse, product, full).netReceivedValue, 0);
});
test('single-warehouse legacy counters reconstruct gross receipt without double subtraction', () => {
  const legacy = {
    ...po,
    partialReceipts: [],
    items: [{ ...po.items[0], receivedQty: 8, returnedQty: 2 }],
  };
  const result = purchaseMetrics(legacy, warehouse, product, []);
  assert.equal(result.receivedQuantity, 10);
  assert.equal(result.returnedQuantity, 2);
  assert.equal(result.netReceivedQuantity, 8);
});
test('returns from another warehouse never become a fallback return at this warehouse', () => {
  const single = {
    ...po,
    partialReceipts: [
      { warehouseId: warehouse, items: [{ subProductId: product, quantityReceived: 15 }] },
    ],
    items: [{ ...po.items[0], returnedQty: 1 }],
  };
  const metrics = purchaseMetrics(single, warehouse, product, [returns[1]]);
  assert.equal(metrics.returnedQuantity, 0);
  assert.equal(metrics.netReceivedQuantity, 15);
});
test('single-warehouse legacy return remainder is counted alongside modern return documents', () => {
  const single = {
    ...po,
    partialReceipts: [
      { warehouseId: warehouse, items: [{ subProductId: product, quantityReceived: 15 }] },
    ],
    items: [{ ...po.items[0], returnedQty: 3 }],
  };
  const metrics = purchaseMetrics(single, warehouse, product, [returns[0]]);
  assert.equal(metrics.returnedQuantity, 3);
  assert.equal(metrics.netReceivedQuantity, 12);
});
test('global purchase metrics sum split receipts and applied returns without double counting counters', () => {
  const metrics = purchaseMetrics(po, null, '', returns);
  assert.deepEqual(metrics, {
    receivedQuantity: 15, returnedQuantity: 3, netReceivedQuantity: 12,
    receivedValue: 1650, returnedValue: 330, netReceivedValue: 1320,
  });
});
test('analytics can restrict receipt and return metrics to one product size', () => {
  const doc = { ...po, items: [po.items[0], { ...po.items[0], sizeId: 'large', totalCost: 4000 }],
    partialReceipts: [{ warehouseId: warehouse, items: [
      { subProductId: product, quantityReceived: 10 },
      { subProductId: product, sizeId: 'large', quantityReceived: 6 },
    ] }] };
  const metrics = purchaseMetrics(doc, null, '', returns, new Set([`${product}:`]));
  assert.equal(metrics.receivedQuantity, 10);
  assert.equal(metrics.returnedQuantity, 3);
  assert.equal(metrics.netReceivedValue, 770);
});
test('repeated product-size lines use their weighted saved cost rather than the last line cost', () => {
  const doc = { _id: 'po', items: [
    { subProductId: product, quantity: 5, receivedQty: 5, totalCost: 500 },
    { subProductId: product, quantity: 5, receivedQty: 5, totalCost: 1000 },
  ] };
  assert.equal(purchaseMetrics(doc, null).receivedValue, 1500);
});
