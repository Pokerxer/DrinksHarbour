// server/__tests__/merchandising.test.js
// Tiered-hybrid recommendation engine. Tier ORDER and source tags are the
// contract: the client and GA4 events both key off `source`, so a tier that
// unexpectedly wins is a bug even when it returns plausible products.

const test = require('node:test');
const assert = require('node:assert/strict');

const Product = require('../models/Product');
const AdCampaign = require('../models/AdCampaign');
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

// ─── Sponsored tier (Task 10) ────────────────────────────────────────────────
// The paid tier obeys the same sweep as the CPC click pipeline (expiry →
// status → rollover → daily cap) plus the prepaid-wallet gate, is capped at
// ONE card per response, merges AFTER manual pairings but BEFORE automatic
// tiers (first on the marketplace), and counts an impression exactly once per
// serve. Disclosure is mandatory: every sponsored card carries
// source:'sponsored' + adCampaignId.

const sponsoredCard = (productId, campaignId) =>
  card(productId, { source: 'sponsored', adCampaignId: campaignId });

const campaignRow = (over = {}) => ({
  _id: 'camp_ok',
  product: '507f1f77bcf86cd799439021',
  tenant: '64b0000000000000000000aa',
  status: 'active',
  surfaces: ['pdp'],
  dailyBudget: 1000,
  spentToday: 0,
  spentDay: new Date().toISOString().slice(0, 10),
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

test('sponsoredForSurface sweeps expired/paused/capped campaigns and rolls over stale counters', async (t) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    campaignRow({ _id: 'camp_expired', endsAt: '2000-01-01T00:00:00Z' }),
    campaignRow({ _id: 'camp_paused', status: 'paused' }),
    // spentToday exhausted today: 50 - 50 = 0 < the 50 NGN tariff.
    campaignRow({ _id: 'camp_capped', dailyBudget: 50, spentToday: 50 }),
    // stale spentDay: yesterday's counter rolls over to zero → still eligible.
    campaignRow({
      _id: 'camp_stale', dailyBudget: 5000, spentToday: 999, spentDay: '2000-01-01',
      product: '507f1f77bcf86cd799439022',
    }),
  ];
  let findQuery = null;
  t.mock.method(AdCampaign, 'find', (q) => {
    findQuery = q;
    return { lean: async () => rows };
  });
  t.mock.method(merchandising, 'sponsoredWalletOkSafe', async () => ({ balance: 500 }));
  const hydrate = t.mock.method(merchandising, 'hydrateCards', async (ids) =>
    ids.map((id) => card(id)));

  const items = await merchandising.sponsoredForSurface(
    VIEWED._id, 'pdp', { tenantId: '64b0000000000000000000aa' }
  );

  // The query itself encodes the eligibility floor: active, on this surface,
  // never the source product.
  assert.equal(findQuery.status, 'active');
  assert.equal(findQuery.surfaces, 'pdp');
  assert.deepEqual(findQuery.product, { $ne: VIEWED._id });
  // Only the swept-eligible campaign survives, tagged for disclosure.
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'sponsored');
  assert.equal(items[0].adCampaignId, 'camp_stale');
  assert.equal(items[0]._id, '507f1f77bcf86cd799439022');
  assert.deepEqual(hydrate.mock.calls[0].arguments, [
    ['507f1f77bcf86cd799439022'], { tenantId: '64b0000000000000000000aa' },
  ]);
});

test('sponsoredForSurface refuses an empty wallet and an unknown surface', async (t) => {
  t.mock.method(AdCampaign, 'find', () => ({ lean: async () => [campaignRow()] }));
  t.mock.method(merchandising, 'sponsoredWalletOkSafe', async () => ({ balance: 10 }));
  t.mock.method(merchandising, 'hydrateCards', async (ids) => ids.map((id) => card(id)));

  // Prepaid-only agreement: no impressions for a wallet that cannot cover
  // one more click, and only pdp/cart are bookable surfaces.
  assert.deepEqual(
    await merchandising.sponsoredForSurface(VIEWED._id, 'pdp', {}),
    []
  );
  assert.deepEqual(
    await merchandising.sponsoredForSurface(VIEWED._id, 'checkout', {}),
    []
  );
});

test('marketplace: sponsored merges FIRST with attribution, impression on serve', async (t) => {
  merchandising.clearRecommendationsCache();
  t.mock.method(merchandising, 'getBoughtTogether', async () => [card('x')]);
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b'), card('c')]);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(merchandising, 'sponsoredForSurface', async () =>
    [sponsoredCard('adp', 'camp1')]);
  const impressions = t.mock.method(merchandising, 'recordImpressionSafe', () => {});
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, {});

  // pdp context: the paid placement lives in upSells (the PDP's disclosed
  // list above the step-up rail), not in crossSells which the PDP doesn't render.
  assert.equal(data.upSells[0].source, 'sponsored');               // home array
  assert.equal(data.upSells[0].adCampaignId, 'camp1');             // attribution
  assert.equal(data.upSells.length, 1);
  assert.equal(data.crossSells.length, 2);
  assert.equal(data.boughtTogether.length, 1);                     // organic stays
  assert.deepEqual(impressions.mock.calls[0].arguments, ['camp1']); // once per serve

  // Cached serves within the TTL do not re-count the impression.
  await merchandising.getRecommendations(VIEWED._id, {});
  assert.equal(impressions.mock.callCount(), 1);
});

test('cart context: sponsored merges into crossSells first (the rendered strip)', async (t) => {
  merchandising.clearRecommendationsCache();
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b'), card('c')]);
  t.mock.method(merchandising, 'getUpSells', async () => [card('f')]);
  t.mock.method(merchandising, 'sponsoredForSurface', async () =>
    [sponsoredCard('adp', 'camp1b')]);
  const impressions = t.mock.method(merchandising, 'recordImpressionSafe', () => {});
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, { context: 'cart' });

  assert.equal(data.crossSells[0].source, 'sponsored');
  assert.equal(data.crossSells[0].adCampaignId, 'camp1b');
  assert.equal(data.crossSells.length, 3);
  assert.equal(data.upSells.length, 1); // organic premium item stays
  assert.ok(data.upSells.every((p) => p.source !== 'sponsored'));
  assert.deepEqual(impressions.mock.calls[0].arguments, ['camp1b']);
});

test('storefront: sponsored sits behind manual pairings, ahead of automatic tiers', async (t) => {
  merchandising.clearRecommendationsCache();
  const TENANT = '64b0000000000000000000aa';
  t.mock.method(pairingService, 'getActivePairing', async () => ({
    _id: 'row1', tenant: TENANT, sourceProduct: VIEWED._id,
    suggestedProducts: ['507f1f77bcf86cd799439015'], active: true,
  }));
  t.mock.method(merchandising, 'hydrateCards', async (ids) =>
    ids.map((id) => card(id)));
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b')]);
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(merchandising, 'sponsoredForSurface', async () =>
    [sponsoredCard('ads', 'camp2')]);
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, { tenantId: TENANT, context: 'cart' });

  assert.equal(data.crossSells[0].source, 'manual');      // manual outranks paid
  assert.equal(data.crossSells[1].source, 'sponsored');   // paid outranks automatic
  assert.equal(data.crossSells[2].source, undefined);     // automatic fills last
  assert.equal(data.crossSells.length, 3);
});

test('storefront pdp: sponsored surfaces in upSells behind nothing, manual stays in crossSells', async (t) => {
  merchandising.clearRecommendationsCache();
  const TENANT = '64b0000000000000000000aa';
  t.mock.method(pairingService, 'getActivePairing', async () => ({
    _id: 'row1', tenant: TENANT, sourceProduct: VIEWED._id,
    suggestedProducts: ['507f1f77bcf86cd799439015'], active: true,
  }));
  t.mock.method(merchandising, 'hydrateCards', async (ids) =>
    ids.map((id) => card(id)));
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b')]);
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(merchandising, 'sponsoredForSurface', async () =>
    [sponsoredCard('ads', 'camp2b')]);
  const impressions = t.mock.method(merchandising, 'recordImpressionSafe', () => {});
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, { tenantId: TENANT });

  assert.equal(data.crossSells[0].source, 'manual');   // pairing tier untouched
  assert.equal(data.crossSells[1].source, undefined);  // automatic fills
  assert.equal(data.upSells[0].source, 'sponsored');   // paid slot is the pdp home
  assert.equal(data.upSells[0].adCampaignId, 'camp2b');
  assert.deepEqual(impressions.mock.calls[0].arguments, ['camp2b']);
});

test('sponsored slot is dropped without an impression when the product already surfaced organically', async (t) => {
  merchandising.clearRecommendationsCache();
  t.mock.method(merchandising, 'getBoughtTogether', async () => []);
  t.mock.method(merchandising, 'getCrossSells', async () => [card('b')]);
  t.mock.method(merchandising, 'getUpSells', async () => []);
  t.mock.method(merchandising, 'sponsoredForSurface', async () =>
    [sponsoredCard('b', 'camp3')]);
  const impressions = t.mock.method(merchandising, 'recordImpressionSafe', () => {});
  t.mock.method(Product, 'findById', () => ({ lean: async () => ({ ...VIEWED }) }));

  const data = await merchandising.getRecommendations(VIEWED._id, {});

  assert.ok(data.crossSells.every((p) => p.source !== 'sponsored'));
  assert.ok(data.boughtTogether.every((p) => p.source !== 'sponsored'));
  assert.ok(data.upSells.every((p) => p.source !== 'sponsored'));
  assert.equal(impressions.mock.callCount(), 0); // organic placement, no billing
});
