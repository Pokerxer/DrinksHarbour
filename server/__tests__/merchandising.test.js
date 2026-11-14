// server/__tests__/merchandising.test.js
// Tiered-hybrid recommendation engine. Tier ORDER and source tags are the
// contract: the client and GA4 events both key off `source`, so a tier that
// unexpectedly wins is a bug even when it returns plausible products.

const test = require('node:test');
const assert = require('node:assert/strict');

const productService = require('../services/product.service');
const merchandising = require('../services/merchandising.service');

const VIEWED = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Viewed Bottle',
  type: 'whiskey',
  status: 'approved',
  isPublished: true,
};

const card = (id, extra = {}) => ({
  _id: id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  type: 'tonic_water',
  status: 'approved',
  isPublished: true,
  ...extra,
});

test('getBoughtTogether: co-purchase tier wins and tags source', async (t) => {
  const coPurchases = [{ _id: 'a', frequency: 3, totalQuantity: 5 }];
  t.mock.method(merchandising, 'coPurchaseAggregates', async () => coPurchases);
  t.mock.method(merchandising, 'hydrateCards', async (ids) => ids.map((id) => card(id)));

  const items = await merchandising.getBoughtTogether(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items.length, 1);
  assert.equal(items[0]._id, 'a');
  assert.equal(items[0].source, 'co_purchase');
  assert.equal(items[0].frequency, 3);
});

test('getBoughtTogether: falls back to pairing rules when no co-purchase data', async (t) => {
  t.mock.method(merchandising, 'coPurchaseAggregates', async () => []);
  t.mock.method(merchandising, 'pairingCandidates', async () =>
    [card('b'), card('c')]);

  const items = await merchandising.getBoughtTogether(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items.length, 2);
  assert.ok(items.every((p) => p.source === 'pairing_rules'));
});

test('getBoughtTogether: falls back to related products when pairing is empty too', async (t) => {
  t.mock.method(merchandising, 'coPurchaseAggregates', async () => []);
  t.mock.method(merchandising, 'pairingCandidates', async () => []);
  t.mock.method(productService, 'getRelatedProducts', async () => ({
    products: [card('d')],
  }));

  const items = await merchandising.getBoughtTogether(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'related_fallback');
});
