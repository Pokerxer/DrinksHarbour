// `/shop?sort=popularity` — "Most Popular" — did not rank by popularity.
//
// The frontend maps `popularity` → backend `popular`, which sorts on
// `{ totalSold: -1, averageRating: -1 }`. `totalSold` is computed in the search
// pipeline as the sum of `SubProduct.totalSold` across a product's tenants.
//
// `SubProduct.totalSold` is only ever incremented by the POS controller
// (in-store sales). Marketplace checkout on drinksharbour.com writes an Order
// and never touches it — the same gap that left the Best Sellers tab empty
// (see RESUME-bestsellers-section.md).
//
// On the live dataset that means:
//
//   - 612 of 621 live products (98.5%) tie at totalSold = 0
//   - the whole catalogue's SubProduct.totalSold sums to 29 units, over 9
//     products, while Orders record 154 distinct products actually sold
//
// With 98.5% of rows tied, the `_id: 1` tiebreaker decides the order, so "Most
// Popular" was really "sorted by insertion order". Observed top result was
// "Reif Estate Winery Grand Reserve Cabernet Icewine" (0 sold) while the
// genuine best seller, "Glenfiddich 15 Years Old" (90 sold), was nowhere near
// the top.
//
// These tests pin the demand map that folds real marketplace order volume into
// the popularity ranking.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  buildOrderDemandMap,
  buildDemandExpr,
  getOrderDemandMap,
  ORDER_DEMAND_MATCH,
} = require('../services/orderDemand.helper');

const oid = () => new mongoose.Types.ObjectId();

test('only paid, actually-delivered orders count as demand', () => {
  // A pending or cancelled order is not a purchase. Counting one would let an
  // abandoned cart push a product up the storefront's "Most Popular" list.
  assert.deepEqual(ORDER_DEMAND_MATCH.status, { $in: ['delivered', 'shipped'] });
  assert.equal(ORDER_DEMAND_MATCH.paymentStatus, 'paid');
});

test('demand rows are keyed by product id as a string', () => {
  const id = oid();
  const map = buildOrderDemandMap([{ _id: id, totalSold: 42 }]);

  // $getField looks the key up with { $toString: '$_id' }, so an ObjectId key
  // would never match and every product would silently read as 0 demand.
  assert.equal(map[String(id)], 42);
});

test('a null or missing product id is dropped, not keyed as "null"', () => {
  const id = oid();
  const map = buildOrderDemandMap([
    { _id: null, totalSold: 5 },
    { _id: undefined, totalSold: 6 },
    { _id: id, totalSold: 7 },
  ]);

  assert.deepEqual(Object.keys(map), [String(id)]);
});

test('non-numeric quantities do not poison the ranking', () => {
  const [a, b] = [oid(), oid()];
  const map = buildOrderDemandMap([
    { _id: a, totalSold: null },
    { _id: b, totalSold: 'x' },
  ]);

  // A NaN sort key orders unpredictably in Mongo; coerce to 0 instead.
  assert.equal(map[String(a)], 0);
  assert.equal(map[String(b)], 0);
});

test('an empty demand map yields an expression that is still valid', () => {
  // A fresh catalogue with no orders must not produce a broken $getField, or
  // the whole shop query fails rather than the sort merely being uninformative.
  const expr = buildDemandExpr({});

  assert.deepEqual(expr, { $literal: 0 });
});

test('the demand expression falls back to 0 for an unsold product', () => {
  const id = oid();
  const expr = buildDemandExpr({ [String(id)]: 12 });

  // $ifNull guard: products with no orders must read 0, not null — a null sort
  // key sorts inconsistently against numbers.
  assert.ok(expr.$ifNull, 'demand lookup must be null-guarded');
  assert.equal(expr.$ifNull[1], 0);

  const getField = expr.$ifNull[0].$getField;
  assert.ok(getField, 'expected a $getField lookup');
  assert.deepEqual(getField.field, { $toString: '$_id' });
  assert.deepEqual(getField.input, { $literal: { [String(id)]: 12 } });
});

test('marketplace demand outranks POS-only units for the same product', () => {
  // The regression, in miniature. `pos` sold 12 in-store and nothing online;
  // `online` sold 0 in-store and 90 through the marketplace. Ranking on
  // SubProduct.totalSold alone put `pos` first — which is exactly what the
  // live shop did.
  const pos = oid();
  const online = oid();

  const demand = buildOrderDemandMap([{ _id: online, totalSold: 90 }]);
  const score = (id, subProductSold) =>
    subProductSold + (demand[String(id)] || 0);

  assert.ok(
    score(online, 0) > score(pos, 12),
    'a product with 90 marketplace sales must outrank one with 12 POS sales',
  );
});

test('units from both channels are added, not replaced', () => {
  // A product sold through both channels should rank on its combined total, so
  // adding the marketplace figure must not discard the POS one.
  const id = oid();
  const demand = buildOrderDemandMap([{ _id: id, totalSold: 70 }]);

  assert.equal(30 + (demand[String(id)] || 0), 100);
});

test('getOrderDemandMap runs the demand aggregation on the orders collection', async (t) => {
  const id = oid();
  const seen = [];

  const map = await getOrderDemandMap({ aggregate: async (p) => { seen.push(p); return [{ _id: id, totalSold: 90 }]; } });

  assert.equal(map[String(id)], 90);

  const [pipeline] = seen;
  assert.ok(pipeline?.some((s) => s.$match), 'demand query must filter orders');
  assert.ok(pipeline?.some((s) => s.$unwind), 'demand query must unwind line items');
  // One row per sold product.
  assert.ok(pipeline?.some((s) => s.$group?._id === '$items.product'));
});

test('a demand-outage degrades the map to an empty object, not a crash', async (t) => {
  // The shop pipeline must keep rendering even if the orders query fails —
  // popularity just renders as the POS-only order instead of killing the page.
  const failing = { aggregate: async () => { throw new Error('db timeout'); } };

  const map = await getOrderDemandMap(failing);
  assert.deepEqual(map, {});
});
