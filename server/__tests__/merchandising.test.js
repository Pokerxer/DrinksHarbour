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

test('getCrossSells: pairing tier wins for a spirit (mixers/soft-drinks complements)', async (t) => {
  t.mock.method(merchandising, 'pairingCandidates', async () => [card('b'), card('c')]);
  t.mock.method(merchandising, 'semanticFallback', async () => {
    throw new Error('semantic tier must not run when pairings exist');
  });

  const items = await merchandising.getCrossSells(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items.length, 2);
  assert.ok(items.every((p) => p.source === 'pairing_rules'));
});

test('getCrossSells: falls back to semantic when pairing is empty', async (t) => {
  t.mock.method(merchandising, 'pairingCandidates', async () => []);
  t.mock.method(merchandising, 'semanticFallback', async () => [card('e')]);

  const items = await merchandising.getCrossSells(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'semantic');
});

test('getCrossSells: OTHER-family type never queries pairings, goes straight to semantic', async (t) => {
  const fashion = { ...VIEWED, type: 'electronics_phone' };
  t.mock.method(merchandising, 'pairingCandidates', async () => {
    throw new Error('pairing tier must not run for OTHER');
  });
  t.mock.method(merchandising, 'semanticFallback', async () => [card('e')]);

  const items = await merchandising.getCrossSells(fashion._id, fashion, { limit: 4 });

  assert.equal(items[0].source, 'semantic');
});

test('getUpSells: price band 1.2x–3x wins and tags source', async (t) => {
  t.mock.method(merchandising, 'upSellPriceBand', async () => [card('f')]);
  t.mock.method(merchandising, 'upSellBrandPremium', async () => {
    throw new Error('brand tier must not run when price band exists');
  });

  const priced = { ...VIEWED, averageSellingPrice: 10000 };
  const items = await merchandising.getUpSells(priced._id, priced, { limit: 4 });

  assert.equal(items[0].source, 'price_band');
});

test('getUpSells: zero-price product skips price band, uses brand premium', async (t) => {
  t.mock.method(merchandising, 'upSellPriceBand', async () => {
    throw new Error('price band must not run without a current price');
  });
  t.mock.method(merchandising, 'upSellBrandPremium', async () => [card('g')]);

  const items = await merchandising.getUpSells(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items[0].source, 'brand_premium');
});

test('getUpSells: falls back to semantic-above when both tiers empty', async (t) => {
  t.mock.method(merchandising, 'upSellPriceBand', async () => []);
  t.mock.method(merchandising, 'upSellBrandPremium', async () => []);
  t.mock.method(merchandising, 'semanticFallback', async () => [card('e')]);

  const items = await merchandising.getUpSells(VIEWED._id, VIEWED, { limit: 4 });

  assert.equal(items[0].source, 'semantic');
});
