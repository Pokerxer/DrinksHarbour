// server/__tests__/merchandising.test.js
// Tiered-hybrid recommendation engine. Tier ORDER and source tags are the
// contract: the client and GA4 events both key off `source`, so a tier that
// unexpectedly wins is a bug even when it returns plausible products.

const test = require('node:test');
const assert = require('node:assert/strict');

const Product = require('../models/Product');
const productService = require('../services/product.service');
const merchandising = require('../services/merchandising.service');
const productController = require('../controllers/product.controller');
const pairingService = require('../services/merchandisingPairing.service');

const res = () => {
  const r = { status: () => r, json: () => r };
  return r;
};

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

test('getRecommendations assembles all three kinds and tags context', async (t) => {
  merchandising.clearRecommendationsCache();
  t.mock.method(merchandising, 'getBoughtTogether', async () => [card('a')]);
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b')]);
  t.mock.method(merchandising, 'getUpSells', async () => [card('f')]);
  t.mock.method(Product, 'findById', () => ({
    lean: async () => ({ ...VIEWED, embedding: [0.1] }),
  }));

  const data = await merchandising.getRecommendations(VIEWED._id, { context: 'cart' });

  assert.deepEqual(
    Object.keys(data).sort(),
    ['boughtTogether', 'context', 'crossSells', 'productId', 'upSells']
  );
  assert.equal(data.context, 'cart');
  assert.equal(data.boughtTogether.length, 1);
});

test('getRecommendations serves a second identical call from cache without refetching', async (t) => {
  merchandising.clearRecommendationsCache();
  const spy = t.mock.method(merchandising, 'getCrossSells', async () => [card('b')]);
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(Product, 'findById', () => ({
    lean: async () => ({ ...VIEWED }),
  }));

  await merchandising.getRecommendations(VIEWED._id, {});
  await merchandising.getRecommendations(VIEWED._id, {});

  assert.equal(spy.mock.callCount(), 1);
});

test('getRecommendations rejects invalid product IDs', async (t) => {
  merchandising.clearRecommendationsCache();
  await assert.rejects(
    () => merchandising.getRecommendations('not-an-id', {}),
    /Invalid product ID/
  );
});

test('getRecommendations rejects unknown products', async (t) => {
  merchandising.clearRecommendationsCache();
  t.mock.method(Product, 'findById', () => ({ lean: async () => null }));
  await assert.rejects(
    () => merchandising.getRecommendations('507f1f77bcf86cd799439011', {}),
    /Product not found/
  );
});

test('controller: getMerchandising delegates with sanitized context/limit and tenant id', async (t) => {
  const spy = t.mock.method(merchandising, 'getRecommendations', async () => ({
    productId: 'x', context: 'pdp', boughtTogether: [], crossSells: [], upSells: [],
  }));

  const r = res();
  await productController.getMerchandising(
    {
      params: { id: '507f1f77bcf86cd799439011' },
      query: { context: 'Bogus', limit: '999' },
      tenant: { _id: '64b0000000000000000000aa' },
    },
    r,
    (err) => { if (err) throw err; }
  );

  assert.equal(spy.mock.calls[0].arguments[1].context, 'pdp'); // bogus → default
  assert.equal(spy.mock.calls[0].arguments[1].limit, 8);       // clamped to max
  assert.equal(spy.mock.calls[0].arguments[1].tenantId, '64b0000000000000000000aa');
});

test('controller: getMerchandising passes no tenantId on the marketplace', async (t) => {
  const spy = t.mock.method(merchandising, 'getRecommendations', async () => ({
    productId: 'x', context: 'pdp', boughtTogether: [], crossSells: [], upSells: [],
  }));

  const r = res();
  await productController.getMerchandising(
    { params: { id: '507f1f77bcf86cd799439011' }, query: {} },
    r,
    (err) => { if (err) throw err; }
  );

  assert.equal(spy.mock.calls[0].arguments[1].tenantId, undefined);
});

test('storefront surface: manual pairing outranks automatic cross-sells', async (t) => {
  merchandising.clearRecommendationsCache();
  const TENANT = '64b0000000000000000000aa';
  t.mock.method(pairingService, 'getActivePairing', async () => ({
    _id: 'row1', tenant: TENANT, sourceProduct: VIEWED._id,
    suggestedProducts: ['507f1f77bcf86cd799439015'], active: true,
  }));
  t.mock.method(merchandising, 'hydrateCards', async (ids) =>
    ids.map((id) => card(id)).filter(Boolean));
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b')]);
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, { tenantId: TENANT });

  assert.equal(data.crossSells[0].source, 'manual');
  assert.equal(data.crossSells.length, 2); // manual first, automatic fills
});

test('marketplace surface never consults tenant pairings', async (t) => {
  merchandising.clearRecommendationsCache();
  const spy = t.mock.method(pairingService, 'getActivePairing', async () => null);

  t.mock.method(merchandising, 'getCrossSells', async () => []);
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  await merchandising.getRecommendations(VIEWED._id, {});
  assert.equal(spy.mock.callCount(), 0);
});

test('no pairing on the storefront falls through to automatic tiers unchanged', async (t) => {
  merchandising.clearRecommendationsCache();
  t.mock.method(pairingService, 'getActivePairing', async () => null);
  // Real getCrossSells tier-1 tags every item `source: 'pairing_rules'` — the
  // mock bypasses the internals, so it must return the tagged shape itself.
  t.mock.method(merchandising, 'getCrossSells', async () =>
    [card('b', { source: 'pairing_rules' })]);
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, { tenantId: '64b0000000000000000000aa' });
  assert.equal(data.crossSells[0].source, 'pairing_rules');
});
