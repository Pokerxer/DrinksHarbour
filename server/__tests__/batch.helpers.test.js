// server/__tests__/batch.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  defaultTracksBatch,
  orderBatchesFefo,
  allocateFefo,
  formatBatchDate,
  nextBatchSeq,
  buildBatchNumber,
  daysUntil,
  isWithinExpiryWindow,
  expiryAlertPriority,
} = require('../services/batch.helpers');

test('defaultTracksBatch defaults to true for non-alcoholic when unset', () => {
  assert.strictEqual(defaultTracksBatch(false, undefined), true);
});

test('defaultTracksBatch defaults to true for alcoholic when unset', () => {
  assert.strictEqual(defaultTracksBatch(true, undefined), true);
});

test('defaultTracksBatch respects an explicit override either way', () => {
  assert.strictEqual(defaultTracksBatch(true, true), true);
  assert.strictEqual(defaultTracksBatch(false, false), false);
});

test('orderBatchesFefo sorts by expiry ascending, no-expiry last, then receivedDate', () => {
  const batches = [
    { batchNumber: 'C', expiryDate: null, receivedDate: new Date('2026-01-01') },
    { batchNumber: 'A', expiryDate: new Date('2026-03-01'), receivedDate: new Date('2026-02-01') },
    { batchNumber: 'B', expiryDate: new Date('2026-02-01'), receivedDate: new Date('2026-02-01') },
    { batchNumber: 'D', expiryDate: null, receivedDate: new Date('2026-01-15') },
  ];
  const ordered = orderBatchesFefo(batches).map((b) => b.batchNumber);
  assert.deepStrictEqual(ordered, ['B', 'A', 'C', 'D']);
});

test('allocateFefo draws from earliest-expiry batches and reports the slack remainder', () => {
  const batches = [
    { _id: 'b1', batchNumber: 'B', expiryDate: new Date('2026-02-01'), quantity: 30 },
    { _id: 'b2', batchNumber: 'A', expiryDate: new Date('2026-03-01'), quantity: 50 },
  ];
  const { allocations, remainder } = allocateFefo(batches, 40);
  assert.deepStrictEqual(allocations, [
    { batch: 'b1', batchNumber: 'B', quantity: 30, expiryDate: batches[0].expiryDate },
    { batch: 'b2', batchNumber: 'A', quantity: 10, expiryDate: batches[1].expiryDate },
  ]);
  assert.strictEqual(remainder, 0);
});

test('allocateFefo returns positive remainder when batches cannot cover the quantity', () => {
  const batches = [{ _id: 'b1', batchNumber: 'B', expiryDate: null, quantity: 5 }];
  const { allocations, remainder } = allocateFefo(batches, 12);
  assert.deepStrictEqual(allocations, [
    { batch: 'b1', batchNumber: 'B', quantity: 5, expiryDate: null },
  ]);
  assert.strictEqual(remainder, 7);
});

test('formatBatchDate renders YYYYMMDD in UTC', () => {
  assert.strictEqual(formatBatchDate(new Date('2026-06-16T23:30:00Z')), '20260616');
});

test('nextBatchSeq returns 1 when no batches share the prefix', () => {
  assert.strictEqual(nextBatchSeq([], 'JUICE500-20260616'), 1);
  assert.strictEqual(nextBatchSeq(['OTHER-20260616-001'], 'JUICE500-20260616'), 1);
});

test('nextBatchSeq returns one past the max existing sequence for the prefix', () => {
  const existing = ['JUICE500-20260616-001', 'JUICE500-20260616-003', 'JUICE500-20260615-009'];
  assert.strictEqual(nextBatchSeq(existing, 'JUICE500-20260616'), 4);
});

test('buildBatchNumber composes SKU-YYYYMMDD-seq zero padded', () => {
  assert.strictEqual(
    buildBatchNumber('JUICE500', new Date('2026-06-16T00:00:00Z'), 4),
    'JUICE500-20260616-004'
  );
});

test('daysUntil counts whole days from now to expiry (floored)', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  assert.strictEqual(daysUntil(new Date('2026-06-26T00:00:00Z'), now), 10);
  assert.strictEqual(daysUntil(new Date('2026-06-15T00:00:00Z'), now), -1);
});

test('isWithinExpiryWindow is true at/under the window, false beyond, false for null', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  assert.strictEqual(isWithinExpiryWindow(new Date('2026-09-01T00:00:00Z'), now, 90), true);
  assert.strictEqual(isWithinExpiryWindow(new Date('2026-12-01T00:00:00Z'), now, 90), false);
  assert.strictEqual(isWithinExpiryWindow(null, now, 90), false);
});

test('expiryAlertPriority escalates as expiry approaches', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  assert.strictEqual(expiryAlertPriority(new Date('2026-06-10T00:00:00Z'), now), 'urgent'); // past
  assert.strictEqual(expiryAlertPriority(new Date('2026-07-01T00:00:00Z'), now), 'urgent'); // <30
  assert.strictEqual(expiryAlertPriority(new Date('2026-08-01T00:00:00Z'), now), 'high');   // <60
  assert.strictEqual(expiryAlertPriority(new Date('2026-09-10T00:00:00Z'), now), 'normal'); // >=60
});
