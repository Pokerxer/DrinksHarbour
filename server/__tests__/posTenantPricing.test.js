const test = require('node:test');
const assert = require('node:assert/strict');
const { computePOSPricing } = require('../controllers/pos.controller');

for (const revenueModel of ['markup', 'commission']) {
  test(`POS uses tenant prices despite website promotions (${revenueModel})`, () => {
    const sp = {
      baseSellingPrice: 5000, costPrice: 3000,
      product: { platformMarkup: 50, platformDiscount: { type: 'percentage', value: 40 } },
      isOnSale: true, saleType: 'percentage', saleDiscountValue: 25,
      flashSale: { isActive: true, discountPercentage: 50, remainingQuantity: 10 },
    };
    const tenant = { revenueModel, markupPercentage: 25, commissionPercentage: 12 };
    for (const [size, selling, cost] of [[null, 5000, 3000], [{ sellingPrice: 8000, costPrice: 6000 }, 8000, 6000]]) {
      const result = computePOSPricing(sp, size, tenant);
      assert.equal(result.sellingPrice, selling);
      assert.equal(result.costPrice, cost);
      assert.equal(result.originalPrice, selling);
      assert.equal(result.isOnSale, false);
      assert.equal(result.isFlashSale, false);
    }
  });
}

test('POS falls back from unset size prices to the tenant base before pricelist application', () => {
  const result = computePOSPricing(
    { baseSellingPrice: 4500, basePriceBeforePricelist: 5000, costPrice: 3000 },
    { sellingPrice: 0, costPrice: 0 }, {},
  );
  assert.equal(result.sellingPrice, 5000);
  assert.equal(result.costPrice, 3000);
});
