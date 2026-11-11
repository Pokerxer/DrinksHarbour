// __tests__/subproductStats.test.js
//
// The rule this file exists to protect: the sub-product toolbar and expanded
// row must show Purchased/Sold numbers that AGREE with the drill-down panels.
// The panels read /api/orders?subProductId= and /api/purchase-orders?subProductId=
// — the source collections. The old counters read SubProduct document fields
// that no production path maintains (totalSold is POS-only, purchaseCount had
// no increment path at all), so both displayed 0 for products with real
// purchase and sales records (2026-11-11 Sunblessed Vinho Branco).
//
// Parity rule: a counter must equal what its panel's default "All" view shows.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  fetchSoldStats,
  fetchPurchasedUnits,
  getSubProductStats,
} = require('../services/subproductStats');

const oid = (v) => new mongoose.Types.ObjectId(v);

const idA = oid();
const idB = oid();

const soldRows = [
  { _id: idA, units: 5, revenue: 61000 },
  { _id: idB, units: 2, revenue: 24400 },
];

const purchasedRows = [
  { _id: idA, units: 1210 },
];

test('sold stats aggregate order lines by subproduct summing quantity and subtotal', async () => {
  let seen;
  const Order = {
    aggregate: async (pipeline) => {
      seen = pipeline;
      return soldRows;
    },
  };
  const map = await fetchSoldStats(Order, [idA, idB]);

  assert.equal(seen[0].$match['items.subproduct'].$in.length, 2);
  assert.ok(seen[0].$match['items.subproduct'].$in[0] instanceof mongoose.Types.ObjectId,
    'ids must be cast to ObjectId — a string $in silently matches nothing');
  assert.equal(seen[1].$unwind, '$items');
  assert.deepEqual(seen[2].$match, { 'items.subproduct': { $in: seen[0].$match['items.subproduct'].$in } },
    'post-unwind re-match: only lines for the requested subproducts count');
  assert.deepEqual(seen[3].$group.units, { $sum: '$items.quantity' });
  assert.deepEqual(seen[3].$group.revenue, { $sum: '$items.itemSubtotal' });

  assert.equal(map.get(String(idA)).units, 5);
  assert.equal(map.get(String(idA)).revenue, 61000);
  assert.equal(map.get(String(idB)).units, 2);
});

test('purchased stats aggregate PO lines by subProductId summing quantity', async () => {
  let seen;
  const PurchaseOrder = {
    aggregate: async (pipeline) => {
      seen = pipeline;
      return purchasedRows;
    },
  };
  const map = await fetchPurchasedUnits(PurchaseOrder, [idA, idB]);

  assert.equal(seen[0].$match['items.subProductId'].$in.length, 2);
  assert.ok(seen[0].$match['items.subProductId'].$in[0] instanceof mongoose.Types.ObjectId);
  assert.equal(seen[1].$unwind, '$items');
  assert.deepEqual(seen[3].$group.units, { $sum: '$items.quantity' });

  assert.equal(map.get(String(idA)).units, 1210);
  assert.equal(map.get(String(idB)).units, 0, 'no PO rows must read zero, not undefined');
});

test('combined stats default to zero and never throw when a source fails', async () => {
  const exploding = { aggregate: async () => { throw new Error('cluster down'); } };
  const stats = await getSubProductStats([idA], { Order: exploding, PurchaseOrder: exploding });
  assert.deepEqual(stats.get(String(idA)), { units: 0, revenue: 0, purchased: 0 });
});

test('combined stats merge sold and purchased rows keyed by subproduct id', async () => {
  const Order = { aggregate: async () => soldRows };
  const PurchaseOrder = { aggregate: async () => purchasedRows };
  const stats = await getSubProductStats([idA, idB], { Order, PurchaseOrder });
  assert.deepEqual(stats.get(String(idA)), { units: 5, revenue: 61000, purchased: 1210 });
  assert.deepEqual(stats.get(String(idB)), { units: 2, revenue: 24400, purchased: 0 });
});
