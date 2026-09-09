// Sales Orders retain their existing website pricing base. POS uses tenant retail prices.
const { calcPlatformCostPrice, calcPlatformSellingPrice, resolveRevenueRates, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');

function computeSalesBasePricing(sp, sizeDoc, tenant) {
  const revenueModel      = tenant?.revenueModel        ?? 'markup';
  // POS quantity/bulk pricing comes from tenant pricelists (minQuantity rules),
  // not the platform pack trigger — always the normal rates here.
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, 1);
  const platformMarkupPct = sp.product?.platformMarkup  ?? DEFAULT_PLATFORM_MARKUP;

  const productDiscount = sp.product?.platformDiscount?.value > 0 && sp.product?.platformDiscount?.type
    ? { value: sp.product.platformDiscount.value, type: sp.product.platformDiscount.type,
        start: sp.product.platformDiscount.start,  end: sp.product.platformDiscount.end }
    : null;

  // Size values fall back to subproduct when 0 (0 means "not set")
  const rawCost    = (sizeDoc?.costPrice    > 0 ? sizeDoc.costPrice    : null) ?? sp.costPrice        ?? 0;
  const rawSelling = (sizeDoc?.sellingPrice > 0 ? sizeDoc.sellingPrice : null) ?? sp.basePriceBeforePricelist ?? sp.baseSellingPrice ?? 0;

  if (rawCost <= 0 && rawSelling <= 0) {
    return { sellingPrice: 0, costPrice: 0, revenueModel, markupPct, commissionPct };
  }

  const platformCostPrice    = calcPlatformCostPrice(rawCost, rawSelling, revenueModel, markupPct, commissionPct);
  let   platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);
  const priceBeforeSale      = platformSellingPrice;

  const now = new Date();

  // ── Flash sale (checked first — takes priority over regular sale) ────────────
  const fs         = sp.flashSale;
  const flashStart = fs?.startDate ? new Date(fs.startDate) : null;
  const flashEnd   = fs?.endDate   ? new Date(fs.endDate)   : null;
  const flashActive =
    fs?.isActive === true &&
    (fs?.discountPercentage ?? 0) > 0 &&
    (!flashStart || now >= flashStart) &&
    (!flashEnd   || now <= flashEnd)   &&
    (fs?.remainingQuantity == null || fs.remainingQuantity > 0);

  if (flashActive) {
    platformSellingPrice = parseFloat((platformSellingPrice * (1 - fs.discountPercentage / 100)).toFixed(2));
  } else {
    // ── Regular sale discount ────────────────────────────────────────────────
    const saleStart  = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
    const saleEnd    = sp.saleEndDate   ? new Date(sp.saleEndDate)   : null;
    const saleActive = sp.isOnSale &&
      (sp.saleDiscountValue ?? 0) > 0 &&
      (!saleStart || now >= saleStart) &&
      (!saleEnd   || now <= saleEnd);

    if (saleActive) {
      const dtype = sp.saleType || 'percentage';
      if (dtype === 'percentage' || dtype === 'flash_sale') {
        platformSellingPrice = parseFloat((platformSellingPrice * (1 - sp.saleDiscountValue / 100)).toFixed(2));
      } else if (dtype === 'fixed') {
        platformSellingPrice = Math.max(0, parseFloat((platformSellingPrice - sp.saleDiscountValue).toFixed(2)));
      }
    }
  }

  return {
    sellingPrice:       platformSellingPrice,
    originalPrice:      priceBeforeSale,
    isOnSale:           platformSellingPrice < priceBeforeSale,
    isFlashSale:        flashActive,
    costPrice:          platformCostPrice,
    revenueModel,
    markupPct,
    commissionPct,
  };
}

module.exports = { computeSalesBasePricing };
