'use strict';
const { commissionRate, splitMerchandise } = require('./revenueAgreement');
function commissionSellingPrice(retail, discount, override = null) {
  let price = override ?? retail;
  if (!Number.isFinite(price) || price <= 0) return 0;
  const now = new Date();
  const active =
    discount?.value > 0 &&
    (!discount.start || now >= new Date(discount.start)) &&
    (!discount.end || now <= new Date(discount.end));
  if (active) {
    if (discount.type === 'percentage') price *= 1 - discount.value / 100;
    if (discount.type === 'fixed') price -= discount.value;
  }
  return price > 0 ? Math.ceil((price - 1e-9) / 100) * 100 : 0;
}
function commissionResult(
  { retail, cost, override, packOverride, units = 1, maxQuantity },
  product,
  tenant
) {
  const rate = commissionRate(tenant?.commissionPercentage);
  const discount = product?.platformDiscount;
  const finalPrice = commissionSellingPrice(retail, discount, override);
  const split = splitMerchandise({ amount: finalPrice, model: 'commission', rate });
  const now = new Date();
  const active =
    discount?.value > 0 &&
    (!discount.start || now >= new Date(discount.start)) &&
    (!discount.end || now <= new Date(discount.end));
  const eligible =
    units >= (tenant?.packRateMinUnits ?? 2) &&
    units > 1 &&
    (!maxQuantity || maxQuantity >= units);
  const packRate = eligible
    ? commissionRate(tenant?.packCommissionPercentage ?? rate)
    : null;
  const packPrice =
    eligible && !active && packOverride != null
      ? commissionSellingPrice(packOverride, null)
      : null;
  const offer = packPrice > 0 && packPrice < finalPrice ? packPrice : null;
  return {
    revenueModel: 'commission',
    costPrice: cost,
    tenantSellingPrice: retail,
    commissionPct: rate,
    markupPct: tenant?.markupPercentage ?? 25,
    platformMarkupPct: 0,
    isPlatformMarkupOverridden: false,
    platformCostPrice: split.tenantRevenueShare,
    tenantReceives: split.tenantRevenueShare,
    platformSellingPrice: finalPrice,
    finalPrice,
    platformMargin: split.platformCommission,
    productDiscount: active ? { active: true, ...discount } : null,
    packUnitPrice: offer,
    packThreshold: offer ? units : null,
    packSavingsPct: offer
      ? Math.round(((finalPrice - offer) / finalPrice) * 100)
      : null,
    // Expose an eligible pack basis for review even before an offer exists.
    packPlatformCostPrice: eligible
      ? splitMerchandise({
          amount: offer ?? finalPrice,
          model: 'commission',
          rate: packRate,
        }).tenantRevenueShare
      : null,
    packCommissionPct: packRate,
    packMarkupPct: null,
    isPackPlatformMarkupOverridden: false,
    revenuePolicyVersion: 'merchandise-v2',
  };
}
module.exports = { commissionSellingPrice, commissionResult };
