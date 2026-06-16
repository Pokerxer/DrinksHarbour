// server/__tests__/poReceive.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  resolveTargetWarehouse,
  postReceivedStock,
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

  assert.deepStrictEqual(result, { successCount: 2, failCount: 0 });
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

test('postReceivedStock skips a line missing sizeId but posts the others', async () => {
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

  assert.deepStrictEqual(result, { successCount: 1, failCount: 1 });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].subProduct, 'sp2');
});

test('postReceivedStock skips a line missing subProductId', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1003',
    items: [{ subProductId: null, sizeId: 'sz1', quantity: 5, receivedQty: 5 }],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.deepStrictEqual(result, { successCount: 0, failCount: 1 });
  assert.strictEqual(calls.length, 0);
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

  assert.deepStrictEqual(result, { successCount: 0, failCount: 0 });
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

  assert.deepStrictEqual(result, { successCount: 1, failCount: 1 });
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
