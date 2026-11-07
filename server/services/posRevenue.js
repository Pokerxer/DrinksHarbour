// Physical tenant sales do not collect a marketplace selling-price surcharge.
// Retain legacy POS rounding and allocation for existing agreements.
function splitPOSRevenue(pricing, subtotal, quantity) {
  const retail = pricing.revenueModel === "selling_price_markup";
  const commission = pricing.revenueModel === "commission";
  const tenantRevenueShare = retail
    ? subtotal
    : commission
      ? Number((subtotal * (1 - pricing.commissionPct / 100)).toFixed(2))
      : Number((pricing.costPrice * quantity).toFixed(2));
  return {
    tenantRevenueShare,
    platformCommission: Number((subtotal - tenantRevenueShare).toFixed(2)),
    revenueRateAtPurchase: retail
      ? 0
      : commission
        ? pricing.commissionPct
        : pricing.markupPct,
  };
}
module.exports = { splitPOSRevenue };
