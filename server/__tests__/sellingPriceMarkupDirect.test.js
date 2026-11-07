const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSalesRow } = require('../services/salesFulfill.helpers');
test('tenant direct Sales rows retain their own merchandise and preserve the new model snapshot', () => {
  const row = buildSalesRow({ tenantId: 't', item: { product: 'p', subproduct: 'sp', unitPrice: 100000, quantity: 1 }, qty: 1, unitCost: 90000, revenue: { revenueModel: 'selling_price_markup', markupPct: 40, commissionPct: 12 } });
  assert.equal(row.revenueModelUsed, 'selling_price_markup');
  assert.equal(row.tenantAmount, 100000);
  assert.equal(row.platformAmount, 0);
});
test('physical POS allocation excludes marketplace surcharge, preserving legacy model allocations', () => {
  const { splitPOSRevenue } = require('../services/posRevenue');
  assert.deepEqual(splitPOSRevenue({ revenueModel: 'selling_price_markup', costPrice: 90000, markupPct: 40, commissionPct: 12 }, 190000, 2), { tenantRevenueShare: 190000, platformCommission: 0, revenueRateAtPurchase: 0 });
  assert.deepEqual(splitPOSRevenue({ revenueModel: 'markup', costPrice: 90000, markupPct: 40 }, 200000, 2), { tenantRevenueShare: 180000, platformCommission: 20000, revenueRateAtPurchase: 40 });
  assert.deepEqual(splitPOSRevenue({ revenueModel: 'commission', costPrice: 90000, commissionPct: 12 }, 200000, 2), { tenantRevenueShare: 176000, platformCommission: 24000, revenueRateAtPurchase: 12 });
});
