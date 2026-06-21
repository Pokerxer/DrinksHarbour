// server/__tests__/poReceive.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  resolveTargetWarehouse,
  postReceivedStock,
  applyReceipt,
  poReceiptStatus,
  outstanding,
} = require('../services/poReceive.helpers');
const { ValidationError } = require('../utils/errors');

const silentLogger = { log() {}, error() {} };

test('resolveTargetWarehouse prefers the explicit warehouseId', () => {
  assert.strictEqual(resolveTargetWarehouse('wh-explicit', 'wh-default'), 'wh-explicit');
});

test('resolveTargetWarehouse falls back to the default when none given', () => {
  assert.strictEqual(resolveTargetWarehouse(undefined, 'wh-default'), 'wh-default');
  assert.strictEqual(resolveTargetWarehouse('', 'wh-default'), 'wh-default');
});

test('resolveTargetWarehouse throws ValidationError when neither resolves', () => {
  assert.throws(
    () => resolveTargetWarehouse(undefined, null),
    (err) => err instanceof ValidationError && /destination warehouse/i.test(err.message)
  );
});

test('postReceivedStock posts each qualifying line to the chosen warehouse', async () => {
  const calls = [];
  const adjustStock = async (payload, userId, tenantId) => {
    calls.push({ payload, userId, tenantId });
  };
  const purchaseOrder = {
    poNumber: 'PO-1001',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', quantity: 10, receivedQty: 6, subProductName: 'A' },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 4, receivedQty: 0, subProductName: 'B' },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 2);
  assert.strictEqual(result.failCount, 0);
  assert.deepStrictEqual(result.failures, []);
  assert.strictEqual(calls.length, 2);
  // Line 1 uses receivedQty (6); line 2 falls back to quantity (4).
  assert.deepStrictEqual(calls[0].payload, {
    warehouseId: 'wh-A',
    subProduct: 'sp1',
    size: 'sz1',
    quantity: 6,
    type: 'received',
    notes: 'PO Receipt: PO-1001',
  });
  assert.strictEqual(calls[1].payload.quantity, 4);
  assert.strictEqual(calls[0].userId, 'u1');
  assert.strictEqual(calls[0].tenantId, 't1');
});

test('postReceivedStock surfaces (does not silently drop) a line missing sizeId but posts the others', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1002',
    items: [
      { subProductId: 'sp1', sizeId: null, quantity: 5, receivedQty: 5, subProductName: 'NoSize' },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 3, receivedQty: 3, subProductName: 'Ok' },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 1);
  assert.strictEqual(result.failCount, 1);
  assert.strictEqual(result.failures.length, 1);
  assert.strictEqual(result.failures[0].name, 'NoSize');
  assert.match(result.failures[0].reason, /size/i);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].subProduct, 'sp2');
});

test('postReceivedStock surfaces a line missing subProductId', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1003',
    items: [{ subProductId: null, sizeId: 'sz1', quantity: 5, receivedQty: 5, subProductName: 'NoSub' }],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 0);
  assert.strictEqual(result.failCount, 1);
  assert.strictEqual(result.failures.length, 1);
  assert.strictEqual(calls.length, 0);
});

test('postReceivedStock writes sub-product history for each posted line with size + warehouse balance', async () => {
  const movements = [];
  const adjustStock = async () => ({ currentQuantity: 16 }); // balance after a +6 receipt
  const recordMovement = async (m) => { movements.push(m); };
  const purchaseOrder = {
    _id: 'po-id',
    poNumber: 'PO-1006',
    vendorName: 'Acme Drinks',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', productId: 'p1', quantity: 10, receivedQty: 6,
        unitCost: 120, subProductName: 'A' },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    recordMovement,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 1);
  assert.strictEqual(movements.length, 1);
  const m = movements[0];
  assert.strictEqual(m.subProduct, 'sp1');
  assert.strictEqual(m.size, 'sz1');
  assert.strictEqual(m.warehouse, 'wh-A');
  assert.strictEqual(m.quantity, 6);
  assert.strictEqual(m.balanceAfter, 16);
  assert.strictEqual(m.balanceBefore, 10);
  assert.strictEqual(m.relatedPurchaseOrder, 'po-id');
  assert.strictEqual(m.reference, 'PO-1006');
  assert.strictEqual(m.supplierName, 'Acme Drinks');
  assert.strictEqual(m.unitCost, 120);
});

test('postReceivedStock keeps a line successful even if the history write throws', async () => {
  const adjustStock = async () => ({ currentQuantity: 5 });
  const recordMovement = async () => { throw new Error('history db down'); };
  const purchaseOrder = {
    poNumber: 'PO-1007',
    items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity: 5, receivedQty: 5, subProductName: 'A' }],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    recordMovement,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 1);
  assert.strictEqual(result.failCount, 0);
});

test('postReceivedStock ignores zero-quantity lines without counting them', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1004',
    items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity: 0, receivedQty: 0 }],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 0);
  assert.strictEqual(result.failCount, 0);
  assert.deepStrictEqual(result.failures, []);
  assert.strictEqual(calls.length, 0);
});

test('postReceivedStock counts an adjustStock throw as a failed line and continues', async () => {
  const calls = [];
  const adjustStock = async (payload) => {
    if (payload.subProduct === 'sp1') throw new Error('boom');
    calls.push(payload);
  };
  const purchaseOrder = {
    poNumber: 'PO-1005',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', quantity: 5, receivedQty: 5 },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 5, receivedQty: 5 },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.strictEqual(result.successCount, 1);
  assert.strictEqual(result.failCount, 1);
  assert.strictEqual(result.failures.length, 1);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].subProduct, 'sp2');
});

test('postReceivedStock creates a batch for tracked lines and always adjusts stock', async () => {
  const adjustCalls = [];
  const batchCalls = [];
  const adjustStock = async (p) => { adjustCalls.push(p); };
  const receiveBatch = async (p) => { batchCalls.push(p); return { _id: 'b1' }; };
  const generateBatchNumber = async () => 'JUICE500-20260616-001';

  const purchaseOrder = {
    poNumber: 'PO-1',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', quantity: 10, receivedQty: 10, tracksBatch: true,
        sku: 'JUICE500', productId: 'p1', receivedExpiryDate: '2026-12-01' },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 4, receivedQty: 4, tracksBatch: false },
    ],
  };
  const res = await postReceivedStock({
    purchaseOrder, targetWarehouseId: 'w1', adjustStock, receiveBatch, generateBatchNumber,
    userId: 'u1', tenantId: 't1', logger: silentLogger,
  });
  assert.strictEqual(res.successCount, 2);
  assert.strictEqual(batchCalls.length, 1);
  assert.strictEqual(batchCalls[0].batchNumber, 'JUICE500-20260616-001');
  assert.strictEqual(adjustCalls.length, 2);
});

// ── Phase 1: pure receiving math ────────────────────────────────────────────

test('outstanding = quantity - receivedQty - returnedQty', () => {
  assert.strictEqual(outstanding({ quantity: 100, receivedQty: 0, returnedQty: 0 }), 100);
  assert.strictEqual(outstanding({ quantity: 100, receivedQty: 60, returnedQty: 0 }), 40);
  assert.strictEqual(outstanding({ quantity: 100, receivedQty: 100, returnedQty: 0 }), 0);
  // A returned unit is accounted for (received then sent back) — not still outstanding.
  assert.strictEqual(outstanding({ quantity: 10, receivedQty: 7, returnedQty: 3 }), 0);
  // Missing fields default to zero.
  assert.strictEqual(outstanding({ quantity: 5 }), 5);
});

test('applyReceipt accumulates a first partial receipt and reports the delta to post', () => {
  const poItems = [{ itemId: 'l1', quantity: 100, receivedQty: 0 }];
  const result = applyReceipt(poItems, [{ itemId: 'l1', receivedQty: 60 }]);

  assert.strictEqual(result.lines.length, 1);
  const line = result.lines[0];
  assert.strictEqual(line.itemId, 'l1');
  assert.strictEqual(line.previousReceivedQty, 0);
  assert.strictEqual(line.newReceivedQty, 60);
  assert.strictEqual(line.delta, 60);
});

test('applyReceipt does not mutate the input poItems', () => {
  const poItems = [{ itemId: 'l1', quantity: 100, receivedQty: 0 }];
  applyReceipt(poItems, [{ itemId: 'l1', receivedQty: 60 }]);
  assert.strictEqual(poItems[0].receivedQty, 0);
});

test('applyReceipt accumulates a second partial that completes the line', () => {
  const poItems = [{ itemId: 'l1', quantity: 100, receivedQty: 60 }];
  const result = applyReceipt(poItems, [{ itemId: 'l1', receivedQty: 40 }]);

  assert.strictEqual(result.lines[0].newReceivedQty, 100);
  assert.strictEqual(result.lines[0].delta, 40);
});

test('applyReceipt clamps an over-receipt to the ordered quantity by default', () => {
  const poItems = [{ itemId: 'l1', quantity: 100, receivedQty: 0 }];
  const result = applyReceipt(poItems, [{ itemId: 'l1', receivedQty: 120 }]);

  assert.strictEqual(result.lines[0].newReceivedQty, 100);
  assert.strictEqual(result.lines[0].delta, 100);
});

test('applyReceipt allows over-receipt when explicitly enabled', () => {
  const poItems = [{ itemId: 'l1', quantity: 100, receivedQty: 0 }];
  const result = applyReceipt(
    poItems,
    [{ itemId: 'l1', receivedQty: 120 }],
    { allowOverReceipt: true }
  );

  assert.strictEqual(result.lines[0].newReceivedQty, 120);
  assert.strictEqual(result.lines[0].delta, 120);
});

test('applyReceipt clamps a second receipt against the already-received amount', () => {
  // 90 already in; a receipt of 30 can only add 10 more before hitting 100.
  const poItems = [{ itemId: 'l1', quantity: 100, receivedQty: 90 }];
  const result = applyReceipt(poItems, [{ itemId: 'l1', receivedQty: 30 }]);

  assert.strictEqual(result.lines[0].newReceivedQty, 100);
  assert.strictEqual(result.lines[0].delta, 10);
});

test('applyReceipt only touches the lines named in the receipt; one full, one short', () => {
  const poItems = [
    { itemId: 'a', quantity: 10, receivedQty: 0 },
    { itemId: 'b', quantity: 5, receivedQty: 0 },
  ];
  const result = applyReceipt(poItems, [
    { itemId: 'a', receivedQty: 10 },
    { itemId: 'b', receivedQty: 2 },
  ]);

  const a = result.lines.find((l) => l.itemId === 'a');
  const b = result.lines.find((l) => l.itemId === 'b');
  assert.strictEqual(a.newReceivedQty, 10);
  assert.strictEqual(a.delta, 10);
  assert.strictEqual(b.newReceivedQty, 2);
  assert.strictEqual(b.delta, 2);
});

test('applyReceipt skips zero/negative receipt lines and unknown item ids', () => {
  const poItems = [{ itemId: 'a', quantity: 10, receivedQty: 3 }];
  const result = applyReceipt(poItems, [
    { itemId: 'a', receivedQty: 0 },
    { itemId: 'ghost', receivedQty: 5 },
  ]);
  assert.strictEqual(result.lines.length, 0);
});

test('applyReceipt matches Mongoose-style lines by _id when itemId is absent', () => {
  const poItems = [{ _id: { toString: () => 'oid1' }, quantity: 10, receivedQty: 0 }];
  const result = applyReceipt(poItems, [{ itemId: 'oid1', receivedQty: 4 }]);
  assert.strictEqual(result.lines[0].newReceivedQty, 4);
  assert.strictEqual(result.lines[0].delta, 4);
});

test('poReceiptStatus is "received" only when every line is fully received', () => {
  assert.strictEqual(
    poReceiptStatus([
      { quantity: 10, receivedQty: 10 },
      { quantity: 5, receivedQty: 5 },
    ]),
    'received'
  );
});

test('poReceiptStatus is "partially_received" when some but not all is received', () => {
  assert.strictEqual(
    poReceiptStatus([
      { quantity: 10, receivedQty: 10 },
      { quantity: 5, receivedQty: 2 },
    ]),
    'partially_received'
  );
  assert.strictEqual(
    poReceiptStatus([{ quantity: 10, receivedQty: 1 }]),
    'partially_received'
  );
});

test('poReceiptStatus returns null (unchanged) when nothing is received', () => {
  assert.strictEqual(
    poReceiptStatus([
      { quantity: 10, receivedQty: 0 },
      { quantity: 5, receivedQty: 0 },
    ]),
    null
  );
});

test('poReceiptStatus counts over-received lines as fully received', () => {
  assert.strictEqual(
    poReceiptStatus([{ quantity: 10, receivedQty: 12 }]),
    'received'
  );
});

test('postReceivedStock uses a manual batch number when provided', async () => {
  const batchCalls = [];
  const purchaseOrder = {
    poNumber: 'PO-2',
    items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity: 5, receivedQty: 5, tracksBatch: true,
      sku: 'JUICE500', receivedBatchNumber: 'LOT-MANUAL', receivedExpiryDate: '2026-12-01' }],
  };
  await postReceivedStock({
    purchaseOrder, targetWarehouseId: 'w1',
    adjustStock: async () => {}, receiveBatch: async (p) => { batchCalls.push(p); return {}; },
    generateBatchNumber: async () => 'SHOULD-NOT-BE-USED',
    userId: 'u1', tenantId: 't1', logger: silentLogger,
  });
  assert.strictEqual(batchCalls[0].batchNumber, 'LOT-MANUAL');
});
