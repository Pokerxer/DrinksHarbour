"use strict";
const { ValidationError } = require("./errors");
const { commissionSellingPrice } = require("./commissionPricing");
const MODEL = "selling_price_markup";
function markupRate(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 500
  )
    throw new ValidationError(
      "Selling-price markup percentage must be between 0 and 500",
    );
  return value;
}
function retailBasis(value) {
  return Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
}
function sellingMarkupPrice(retail, rate, discount) {
  markupRate(rate);
  const basis = retailBasis(retail);
  if (!basis) return 0;
  return commissionSellingPrice(basis * (1 + rate / 100), discount);
}
function sellingMarkupResult({ retail, cost, override }, product, tenant) {
  const inherited = markupRate(tenant?.sellingPriceMarkupPercentage ?? 0);
  const rate = override == null ? inherited : markupRate(override);
  const payout = retailBasis(retail);
  const discount = product?.platformDiscount;
  const now = new Date();
  const discountActive =
    discount?.value > 0 &&
    (!discount.start || now >= new Date(discount.start)) &&
    (!discount.end || now <= new Date(discount.end));
  const price = sellingMarkupPrice(retail, rate, discount);
  return {
    revenueModel: MODEL,
    costPrice: cost,
    tenantSellingPrice: retail,
    markupPct: rate,
    commissionPct: 0,
    platformMarkupPct: rate,
    sellingPriceMarkupPct: rate,
    inheritedSellingPriceMarkupPct: inherited,
    isSellingPriceMarkupOverridden: override != null,
    isPlatformMarkupOverridden: override != null,
    inheritedMarketplacePrice: sellingMarkupPrice(
      retail,
      inherited,
      product?.platformDiscount,
    ),
    platformCostPrice: payout,
    tenantReceives: payout,
    platformSellingPrice: price,
    finalPrice: price,
    platformMargin: Math.round((price - payout) * 100) / 100,
    productDiscount: discountActive ? { ...discount, active: true } : null,
    packUnitPrice: null,
    packThreshold: null,
    packSavingsPct: null,
    packPlatformCostPrice: null,
    isPlatformCostFromWholesale: false,
    revenuePolicyVersion: "merchandise-v2",
  };
}
module.exports = {
  MODEL,
  markupRate,
  retailBasis,
  sellingMarkupPrice,
  sellingMarkupResult,
};
