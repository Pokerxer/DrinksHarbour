'use strict';
const { resolveRevenueRates } = require('../utils/pricing');
function computePOSPricing(sp, sizeDoc, tenant) {
  const revenueModel = tenant?.revenueModel ?? 'markup';
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, 1);
  const { costPrice, sellingPrice } = require('./retailPrice.service').retailPriceBasis(sp, sizeDoc);
  return { sellingPrice, originalPrice: sellingPrice, isOnSale: false, isFlashSale: false, costPrice, revenueModel, markupPct, commissionPct };
}
module.exports = { computePOSPricing };
