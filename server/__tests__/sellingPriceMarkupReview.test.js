const { test } = require('node:test');
const assert = require('node:assert/strict');
const Size = require('../models/Size');
const { prepareReviewPrices } = require('../services/subproduct-review-prices');
const listing = () => ({ _id: 'sp', tenant: { _id: 't', revenueModel: 'selling_price_markup', sellingPriceMarkupPercentage: 20 }, product: {}, costPrice: 90000, baseSellingPrice: 100000 });
test('review saves a percentage on the listing and can explicitly restore inheritance', async () => {
  const p = await prepareReviewPrices(listing(), { baseWebsitePrice: 125000 });
  assert.equal(p.baseSellingMarkupPct, 25);
  assert.equal((await prepareReviewPrices(listing(), { baseWebsitePrice: 100000 })).baseSellingMarkupPct, 0);
  const reset = await prepareReviewPrices({ ...listing(), sellingPriceMarkupOverridePct: 25 }, { useTenantDefault: true });
  assert.equal(reset.baseSellingMarkupPct, null);
});
test('size override saves percentage and reset clears it without overwriting retail', async t => {
  const size = { _id: 's', subproduct: 'sp', tenant: 't', sellingPrice: 100000, costPrice: 90000, sellingPriceMarkupOverridePct: 25 };
  t.mock.method(Size, 'find', async () => [size]);
  const sp = { ...listing(), sizes: ['s'] };
  const changed = await prepareReviewPrices(sp, { sizes: [{ id: 's', websitePrice: 130000 }] });
  assert.deepEqual(changed.sizes[0].values, { sellingPriceMarkupOverridePct: 30 });
  const reset = await prepareReviewPrices(sp, { sizes: [{ id: 's', useTenantDefault: true }] });
  assert.deepEqual(reset.sizes[0].values, { sellingPriceMarkupOverridePct: null });
  assert.equal(size.sellingPrice, 100000);
});
test('review refuses zero retail, excessive percentages, conflicting reset and pack policy', async t => {
  await assert.rejects(prepareReviewPrices({ ...listing(), baseSellingPrice: 0 }, { baseWebsitePrice: 125000 }), /selling|retail|payout/i);
  await assert.rejects(prepareReviewPrices(listing(), { baseWebsitePrice: 601000 }), /percentage/i);
  await assert.rejects(prepareReviewPrices(listing(), { useTenantDefault: true, baseWebsitePrice: 125000 }), /default|conflict/i);
  t.mock.method(Size, 'find', async () => [{ _id: 's', subproduct: 'sp', tenant: 't', sellingPrice: 100000 }]);
  await assert.rejects(prepareReviewPrices({ ...listing(), sizes: ['s'] }, { sizes: [{ id: 's', packUnitPrice: 110000 }] }), /pack/i);
});
test('tenant size mutations cannot inject marketplace percentage overrides', async () => {
  const service = require('../services/subproduct.service');
  await assert.rejects(service.addSize('sp', { sellingPriceMarkupOverridePct: 99 }, 't'), /platform|review/i);
  await assert.rejects(service.updateSize('sp', 's', { sellingPriceMarkupOverridePct: null }, 't'), /platform|review/i);
});
test('default restoration reads real Mongoose document fields rather than internal document properties', async () => {
  const SubProduct = require('../models/SubProduct');
  const doc = new SubProduct({ costPrice: 90000, baseSellingPrice: 100000, sellingPriceMarkupOverridePct: 25 });
  const terms = listing();
  Object.defineProperty(doc, 'tenant', { value: terms.tenant });
  Object.defineProperty(doc, 'product', { value: terms.product });
  const reset = await prepareReviewPrices(doc, { useTenantDefault: true });
  assert.equal(reset.baseSellingMarkupPct, null);
});
test('platform review persists and clears percentage while a tenant cannot alter it', async t => {
  const SubProduct = require('../models/SubProduct');
  const service = require('../services/subproduct.service');
  const sp = { ...listing(), status: 'active', visibleInOnlineStore: false, save: async () => {} };
  const query = () => ({ populate() { return this; }, then(resolve) { return Promise.resolve(sp).then(resolve); } });
  t.mock.method(SubProduct, 'findById', query);
  t.mock.method(SubProduct, 'findOne', query);
  await assert.rejects(service.adminSetSubProductStatus('sp', 'active', { baseWebsitePrice: 125000 }, null, { role: 'tenant_admin', tenant: 't' }), /platform/i);
  await service.adminSetSubProductStatus('sp', 'active', { baseWebsitePrice: 125000 }, null, { role: 'admin' });
  assert.equal(sp.sellingPriceMarkupOverridePct, 25);
  assert.equal(sp.baseSellingPrice, 100000);
  assert.equal(sp.costPrice, 90000);
  await service.adminSetSubProductStatus('sp', 'active', { useTenantDefault: true }, null, { role: 'admin' });
  assert.equal(sp.sellingPriceMarkupOverridePct, null);
});
