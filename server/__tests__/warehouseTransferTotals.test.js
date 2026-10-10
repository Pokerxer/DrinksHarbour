const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarizeTransfers,
  summarizeTransferMovements,
} = require('../services/warehouseTransferTotals');
const warehouse = 'one';
const docs = [
  {
    sourceWarehouse: { _id: warehouse },
    destinationWarehouse: { _id: 'two', name: 'Other depot' },
    currency: 'NGN',
    total: 700,
    items: [
      {
        subProductId: 'a',
        quantity: 10,
        transferredQty: 10,
        receivedQty: 10,
        returnedQty: 3,
        costPrice: 100,
      },
    ],
    returns: [{ refundedValue: 300 }],
  },
];
test('sums transfer and refund values once with net value and counterpart direction', () => {
  const summary = summarizeTransfers(docs, warehouse);
  assert.equal(summary.currencies[0].outgoingValue, 1000);
  assert.equal(summary.currencies[0].returnedInValue, 300);
  assert.equal(summary.currencies[0].netOutgoingValue, 700);
  assert.equal(summary.currencies[0].outgoingQuantity, 10);
  assert.equal(summary.currencies[0].returnedInQuantity, 3);
  assert.equal(summary.pairs[0].warehouseName, 'Other depot');
  assert.equal(summarizeTransfers(docs, 'two').currencies[0].returnedOutValue, 300);
});
test('keeps currencies separate and excludes drafts with no shipment', () => {
  const result = summarizeTransfers(
    [
      ...docs,
      { ...docs[0], currency: 'USD' },
      { ...docs[0], items: [{ quantity: 10, transferredQty: 0, receivedQty: 0 }], total: 9999 },
    ],
    warehouse,
  );
  assert.equal(result.currencies.length, 2);
  assert.equal(result.currencies[0].outgoingValue, 1000);
});
test('selected products use their line values and exclude other product quantities', () => {
  const doc = {
    ...docs[0],
    total: 2700,
    items: [
      ...docs[0].items,
      { subProductId: 'b', quantity: 10, transferredQty: 10, receivedQty: 10, costPrice: 200 },
    ],
  };
  const result = summarizeTransfers([doc], warehouse, 'a');
  assert.equal(result.currencies[0].outgoingValue, 1000);
  assert.equal(result.currencies[0].returnedInValue, 300);
  assert.equal(result.currencies[0].outgoingQuantity, 10);
});
test('movement totals distinguish reverse transfer-out returns without inventing money', () => {
  const result = summarizeTransferMovements([
    { type: 'transfer_out', quantity: 10 },
    { type: 'transfer_out', quantity: 3, parentMovement: 'p' },
    { type: 'returned', quantity: 2, parentMovement: 'p' },
  ]);
  assert.equal(result.outgoingQuantity, 10);
  assert.equal(result.returnedOutQuantity, 3);
  assert.equal(result.returnedInQuantity, 2);
  assert.equal(result.moneyAvailable, false);
});
test('allocates a saved refund to its selected product, including tax and delivery', () => {
  const doc = {
    sourceWarehouse: { _id: 'one' },
    destinationWarehouse: { _id: 'two' },
    currency: 'NGN',
    total: 1892,
    deliveryCharge: 100,
    items: [
      {
        subProductId: 'a',
        quantity: 10,
        transferredQty: 10,
        receivedQty: 10,
        returnedQty: 2,
        costPrice: 100,
        discountRate: 10,
        taxRate: 10,
      },
      { subProductId: 'b', quantity: 10, transferredQty: 10, receivedQty: 10, costPrice: 100 },
    ],
    returns: [{ refundedValue: 198, lines: [{ itemIndex: 0, quantity: 2 }] }],
  };
  const summary = summarizeTransfers([doc], 'one', 'a');
  assert.equal(summary.currencies[0].returnedInValue, 198);
  assert.equal(summary.currencies[0].outgoingValue, 1037.37);
});
test('net quantities subtract returns in the correct direction for each warehouse', () => {
  const outgoing = summarizeTransfers(docs, 'one');
  assert.equal(outgoing.currencies[0].netOutgoingQuantity, 7);
  assert.equal(outgoing.pairs[0].netOutgoingQuantity, 7);
  assert.equal(outgoing.currencies[0].netIncomingQuantity, 0);
  const incoming = summarizeTransfers(docs, 'two');
  assert.equal(incoming.currencies[0].netIncomingQuantity, 7);
  assert.equal(incoming.currencies[0].netOutgoingQuantity, 0);
});
test('a fully returned transfer nets to zero and partial receipts use actual received units', () => {
  const full = {
    ...docs[0],
    total: 0,
    items: [{ ...docs[0].items[0], returnedQty: 10 }],
    returns: [{ refundedValue: 1000 }],
  };
  assert.equal(summarizeTransfers([full], 'one').pairs[0].netOutgoingQuantity, 0);
  assert.equal(summarizeTransfers([full], 'two').pairs[0].netIncomingValue, 0);
  const partial = { ...docs[0], items: [{ ...docs[0].items[0], receivedQty: 6, returnedQty: 2 }] };
  assert.equal(summarizeTransfers([partial], 'two').pairs[0].netIncomingQuantity, 4);
});
test('movement returns reduce their original flow rather than becoming new transfers', () => {
  const result = summarizeTransferMovements([
    { type: 'transfer_in', quantity: 10 },
    { type: 'transfer_out', quantity: 4, parentMovement: 'p' },
    { type: 'transfer_out', quantity: 8 },
    { type: 'returned', quantity: 3, parentMovement: 'p' },
  ]);
  assert.equal(result.netIncomingQuantity, 6);
  assert.equal(result.netOutgoingQuantity, 5);
  assert.equal(
    summarizeTransferMovements([{ type: 'returned', quantity: 3, parentMovement: 'p' }])
      .netOutgoingQuantity,
    -3,
  );
});
test('movement row columns cancel the original transfer direction when stock is returned', () => {
  const { movementNetQuantities } = require('../services/warehouseTransferTotals');
  assert.deepEqual(movementNetQuantities({ type: 'transfer_in', quantity: 6 }), {
    transferInQuantity: 6,
    transferOutQuantity: 0,
  });
  assert.deepEqual(
    movementNetQuantities({ type: 'transfer_out', quantity: 2, parentMovement: 'p' }),
    { transferInQuantity: -2, transferOutQuantity: 0 },
  );
  assert.deepEqual(movementNetQuantities({ type: 'returned', quantity: 3, parentMovement: 'p' }), {
    transferInQuantity: 0,
    transferOutQuantity: -3,
  });
});

test('sums every transfer across counterpart warehouses and deducts each return once', () => {
  const outbound = docs[0];
  const inbound = {
    ...outbound,
    sourceWarehouse: { _id: 'three', name: 'Third depot' },
    destinationWarehouse: { _id: 'one' },
    total: 800,
    items: [
      { ...outbound.items[0], quantity: 10, receivedQty: 10, transferredQty: 10, returnedQty: 2 },
    ],
    returns: [{ refundedValue: 200 }],
  };
  const summary = summarizeTransfers([outbound, { ...outbound }, inbound, { ...inbound }], 'one');
  assert.equal(summary.currencies[0].netIncomingQuantity, 16);
  assert.equal(summary.currencies[0].netOutgoingQuantity, 14);
  assert.equal(summary.currencies[0].netIncomingValue, 1600);
  assert.equal(summary.currencies[0].netOutgoingValue, 1400);
  assert.equal(
    summary.pairs.reduce((n, pair) => n + pair.netIncomingQuantity, 0),
    16,
  );
  assert.equal(
    summary.pairs.reduce((n, pair) => n + pair.netOutgoingQuantity, 0),
    14,
  );
});
