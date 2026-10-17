const test = require('node:test');
const assert = require('node:assert/strict');
const Size = require('../models/Size');
const { prepareReviewPrices } = require('../services/subproduct-review-prices');
const listing = () => ({
  _id: 'sp',
  tenant: { _id: 'a', revenueModel: 'markup', markupPercentage: 25 },
  product: { platformMarkup: 15 },
  costPrice: 1000,
  baseSellingPrice: 2000,
});
const size = (extra = {}) => ({
  _id: 's',
  tenant: 'a',
  subproduct: 'sp',
  costPrice: 1000,
  sellingPrice: 2000,
  unitsPerPack: 6,
  ...extra,
});
test('only owned sizes are queried; missing/foreign size fails before applying any draft', async (t) => {
  let filter;
  t.mock.method(Size, 'find', (q) => {
    filter = q;
    return Promise.resolve([]);
  });
  await assert.rejects(
    prepareReviewPrices(listing(), {
      sizes: [{ id: 'foreign', websitePrice: 2000 }],
    }),
    /belong/
  );
  assert.equal(filter.tenant, 'a');
  assert.equal(filter.subproduct, 'sp');
});
test('rejects invalid, negative, nonfinite, duplicate and below-payout prices', async (t) => {
  t.mock.method(Size, 'find', async () => [size()]);
  for (const price of [0, -1, NaN, Infinity, '2000', 1200])
    await assert.rejects(
      prepareReviewPrices(listing(), { sizes: [{ id: 's', websitePrice: price }] })
    );
  await assert.rejects(
    prepareReviewPrices(listing(), {
      sizes: [
        { id: 's', websitePrice: 2000 },
        { id: 's', websitePrice: 2100 },
      ],
    }),
    /Duplicate/
  );
});
test('does not manufacture an override for an unchanged current price', async (t) => {
  const s = size();
  t.mock.method(Size, 'find', async () => [s]);
  const result = await prepareReviewPrices(listing(), {
    sizes: [{ id: 's', websitePrice: 1500 }],
  });
  assert.equal(result.sizes.length, 0);
  assert.equal(s.platformMarkupOverridePct, undefined);
});
test('normal and pack changes are validated together; packs must beat the new normal price', async (t) => {
  const sp = listing();
  sp.tenant.packMarkupPercentage = 10;
  const s = size();
  t.mock.method(Size, 'find', async () => [s]);
  await assert.rejects(
    prepareReviewPrices(sp, {
      sizes: [{ id: 's', websitePrice: 1600, packUnitPrice: 1600 }],
    }),
    /lower/
  );
  assert.equal(s.platformMarkupOverridePct, undefined);
  const result = await prepareReviewPrices(sp, {
    sizes: [{ id: 's', websitePrice: 1600, packUnitPrice: 1400 }],
  });
  assert.equal(result.sizes.length, 1);
  assert.equal(result.sizes[0].values.platformMarkupOverridePct, 28);
});
test('listing sales are included in margin safety; pack discounts cannot stack with sales', async (t) => {
  const sp = {
    ...listing(),
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 50,
  };
  t.mock.method(Size, 'find', async () => [size()]);
  await assert.rejects(
    prepareReviewPrices(sp, { sizes: [{ id: 's', websitePrice: 1500 }] }),
    /payout/
  );
  await assert.rejects(
    prepareReviewPrices(sp, {
      sizes: [{ id: 's', websitePrice: 3000, packUnitPrice: 1400 }],
    }),
    /sale/
  );
});
test('approval without overrides still rejects a computed price below payout', async () => {
  const sp = listing();
  sp.baseSellingPrice = 1000;
  await assert.rejects(prepareReviewPrices(sp, {}), /payout/);
});
test('non-NGN overrides cannot accidentally use the clean-hundred NGN rule', async (t) => {
  const sp = { ...listing(), currency: 'USD' };
  t.mock.method(Size, 'find', async () => [size({ currency: 'USD' })]);
  await assert.rejects(prepareReviewPrices(sp, { baseWebsitePrice: 2000 }), /NGN/);
  await assert.rejects(
    prepareReviewPrices(sp, { sizes: [{ id: 's', websitePrice: 2000 }] }),
    /NGN/
  );
});
test('commission review stores an explicit price and recalculates its share after sales without changing terms', async (t) => {
  const sp = { ...listing(), tenant: { _id: 'a', revenueModel: 'commission', commissionPercentage: 13 }, sizes: ['s'] };
  t.mock.method(Size, 'find', async () => [size()]);
  const result = await prepareReviewPrices(sp, { sizes: [{ id: 's', websitePrice: 1800, packUnitPrice: 1600 }] });
  assert.equal(result.sizes[0].values.commissionPriceOverride, 1800);
  assert.equal(result.sizes[0].values.packCommissionPriceOverride, 1600);
  assert.equal(result.sizes[0].values.platformMarkupOverridePct, undefined);
  assert.equal(sp.tenant.commissionPercentage, 13);
});
test('commission review refuses a listing sale that reduces the merchandise price to zero', async () => {
  const sp = { ...listing(), tenant: { _id: 'a', revenueModel: 'commission', commissionPercentage: 13 }, isOnSale: true, saleType: 'percentage', saleDiscountValue: 100 };
  await assert.rejects(prepareReviewPrices(sp), /positive final merchandise/i);
});
