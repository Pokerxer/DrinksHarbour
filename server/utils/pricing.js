/**
 * Pricing calculation utilities for DrinksHarbour platform
 * 
 * Pricing Pipeline:
 * Step 1: costPrice (supplier cost - floor)
 * Step 2: Apply tenant revenue model → platformCostPrice
 *         - Markup: costPrice × (1 + tenantMarkup%)
 *         - Commission: tenantSellingPrice × (1 − tenantCommission%)
 * Step 3: Apply platformMarkup from Product → platformSellingPrice
 *         - platformSellingPrice = platformCostPrice × (1 + platformMarkup%)
 * Step 4: Apply product-level discount (optional)
 *         - finalPlatformPrice = platformSellingPrice - discount
 */

const DEFAULT_PLATFORM_MARKUP = 15;
const DEFAULT_PACK_RATE_MIN_UNITS = 2;

/**
 * Resolve the tenant revenue rates for a given size, using the tenant's
 * reduced pack rates when the size is a multi-pack (unitsPerPack >= the
 * tenant's packRateMinUnits threshold). Pack rates are optional — when a
 * tenant hasn't configured them, the normal rates apply to packs too.
 *
 * @param {object} tenant - Tenant document (or lean object)
 * @param {number} unitsPerPack - Size.unitsPerPack (defaults to 1)
 * @returns {{ markupPct: number, commissionPct: number, isPackRate: boolean }}
 */
const resolveRevenueRates = (tenant, unitsPerPack = 1) => {
  const minUnits = tenant?.packRateMinUnits ?? DEFAULT_PACK_RATE_MIN_UNITS;
  const isPackRate = (unitsPerPack ?? 1) >= minUnits;
  const markupPct = tenant?.markupPercentage ?? 25;
  const commissionPct = tenant?.commissionPercentage ?? 12;
  if (!isPackRate) {
    return { markupPct, commissionPct, isPackRate: false };
  }
  return {
    markupPct: tenant?.packMarkupPercentage ?? markupPct,
    commissionPct: tenant?.packCommissionPercentage ?? commissionPct,
    isPackRate: true,
  };
};

/**
 * Quantity-triggered rate resolution for a transaction line (cart/checkout).
 * Pack rates apply only when the size is pack-eligible
 * (unitsPerPack >= tenant.packRateMinUnits) AND the line quantity has reached
 * the pack size (quantity >= unitsPerPack). The whole line then gets pack rates.
 *
 * @param {object} tenant
 * @param {object} size - needs unitsPerPack
 * @param {number} quantity - line quantity
 * @returns {{ markupPct: number, commissionPct: number, isPackRate: boolean }}
 */
const resolveLineRates = (tenant, size, quantity = 1) => {
  const unitsPerPack = size?.unitsPerPack ?? 1;
  const minUnits = tenant?.packRateMinUnits ?? DEFAULT_PACK_RATE_MIN_UNITS;
  if (unitsPerPack < minUnits || (quantity ?? 1) < unitsPerPack) {
    return resolveRevenueRates(tenant, 1);
  }
  // isPackRate reports whether a REDUCED pack rate was actually applied —
  // a tenant with no pack rates configured falls back to normal rates.
  const rates = resolveRevenueRates(tenant, unitsPerPack);
  const hasPackRates = tenant?.packMarkupPercentage != null || tenant?.packCommissionPercentage != null;
  return { ...rates, isPackRate: rates.isPackRate && hasPackRates };
};

/**
 * Pick the per-unit price a line actually pays given its quantity.
 * @param {object} pricing - output of calculateSizePricing
 * @param {number} quantity
 */
const resolveEffectiveUnitPrice = (pricing, quantity = 1) =>
  pricing?.packUnitPrice != null && pricing?.packThreshold != null &&
  (quantity ?? 1) >= pricing.packThreshold
    ? pricing.packUnitPrice
    : (pricing?.finalPrice ?? 0);

/**
 * Check if a discount is currently active
 */
const isDiscountActive = (discount) => {
  if (!discount || !discount.value || !discount.type) return false;
  const now = new Date();
  if (discount.start && now < new Date(discount.start)) return false;
  if (discount.end && now > new Date(discount.end)) return false;
  return true;
};

/**
 * Apply discount to a price
 */
const applyDiscount = (price, discount) => {
  if (discount.type === 'percentage') {
    return Math.max(0, price * (1 - discount.value / 100));
  }
  if (discount.type === 'fixed') {
    return Math.max(0, price - discount.value);
  }
  return price;
};

/**
 * Calculate platform cost price based on tenant revenue model
 * 
 * @param {number} costPrice - Supplier cost
 * @param {number} tenantSellingPrice - Tenant's retail price
 * @param {string} revenueModel - 'markup' or 'commission'
 * @param {number} markupPct - Tenant markup percentage
 * @param {number} commissionPct - Tenant commission percentage
 * @returns {number} platformCostPrice
 */
const calcPlatformCostPrice = (costPrice, tenantSellingPrice, revenueModel, markupPct = 25, commissionPct = 12) => {
  // Normalize revenueModel - 'platform_markup' is treated as 'markup'
  const normalizedRevenueModel = revenueModel === 'platform_markup' ? 'markup' : revenueModel;
  
  if (normalizedRevenueModel === 'markup') {
    if (!costPrice || costPrice <= 0) return 0;
    return parseFloat((costPrice * (1 + markupPct / 100)).toFixed(2));
  } else {
    // commission
    if (!tenantSellingPrice || tenantSellingPrice <= 0) return 0;
    return parseFloat((tenantSellingPrice * (1 - commissionPct / 100)).toFixed(2));
  }
};

/**
 * Round a price UP to the nearest ₦100 (platform prices are always clean 100s)
 */
const roundUpTo100 = (price) => {
  if (!price || price <= 0) return 0;
  return Math.ceil(price / 100) * 100;
};

/**
 * Calculate platform selling price (includes platform markup and product discount)
 *
 * Rules applied after markup + discount:
 *  - ALWAYS round up to the nearest ₦100.
 *  - Undercut: when the tenant's own store price is known and the computed
 *    platform price would match or exceed it, drop to the nearest ₦100 BELOW
 *    the tenant price (a small, never-large gap) so customers prefer the
 *    platform. Skipped when an admin override percentage is in effect.
 *
 * @param {number} platformCostPrice - The platform cost price
 * @param {number} platformMarkupPct - Platform markup percentage from Product
 * @param {object} productDiscount - Product-level discount { value, type, start, end }
 * @param {object} options - { tenantStorePrice, platformMarkupOverridePct }
 * @returns {number} platformSellingPrice
 */
const calcPlatformSellingPrice = (platformCostPrice, platformMarkupPct = DEFAULT_PLATFORM_MARKUP, productDiscount = null, options = {}) => {
  if (!platformCostPrice || platformCostPrice <= 0) return 0;
  const { tenantStorePrice = 0, platformMarkupOverridePct = null } = options;
  const isOverride = platformMarkupOverridePct != null;
  const pct = isOverride ? platformMarkupOverridePct : platformMarkupPct;

  let sellingPrice = parseFloat((platformCostPrice * (1 + pct / 100)).toFixed(2));
  if (isDiscountActive(productDiscount)) {
    sellingPrice = applyDiscount(sellingPrice, productDiscount);
  }
  if (sellingPrice <= 0) return 0;

  sellingPrice = roundUpTo100(sellingPrice);

  if (!isOverride && tenantStorePrice > 100 && sellingPrice >= tenantStorePrice) {
    sellingPrice = Math.max(100, Math.floor((tenantStorePrice - 1) / 100) * 100);
  }
  return sellingPrice;
};

/**
 * Calculate platform margin
 * 
 * @param {number} platformCostPrice 
 * @param {number} platformSellingPrice 
 * @returns {number} margin
 */
const calcPlatformMargin = (platformCostPrice, platformSellingPrice) => {
  if (!platformCostPrice || platformCostPrice <= 0) return null;
  if (!platformSellingPrice || platformSellingPrice <= 0) return null;
  return parseFloat((platformSellingPrice - platformCostPrice).toFixed(2));
};

/**
 * Calculate pricing for a SubProduct (no sizes - sellWithoutSizeVariants path)
 * 
 * @param {object} subProduct - SubProduct document
 * @param {object} product - Populated Product document
 * @param {object} tenant - Populated Tenant document
 * @returns {object} pricing object
 */
const calculateSubProductPricing = (subProduct, product, tenant) => {
  const revenueModel = tenant?.revenueModel ?? 'markup';
  const markupPct = tenant?.markupPercentage ?? 25;
  const commissionPct = tenant?.commissionPercentage ?? 12;
  const platformMarkupPct = product?.platformMarkup ?? DEFAULT_PLATFORM_MARKUP;

  // Get product-level discount
  const productDiscount = product?.platformDiscount?.value > 0 && product?.platformDiscount?.type
    ? { value: product.platformDiscount.value, type: product.platformDiscount.type, start: product.platformDiscount.start, end: product.platformDiscount.end }
    : null;

  // Base values (no size variant)
  const costPrice = subProduct?.costPrice ?? 0;
  const tenantSellingPrice = subProduct?.baseSellingPrice ?? 0;

  // Tenant discount (for tenant store display only - not part of platform pricing)
  const tenantDiscount = subProduct?.discount > 0 && subProduct?.discountType
    ? { value: subProduct.discount, type: subProduct.discountType, start: subProduct.discountStart, end: subProduct.discountEnd }
    : null;
  const tenantStorePrice = isDiscountActive(tenantDiscount)
    ? applyDiscount(tenantSellingPrice, tenantDiscount)
    : null;

  // Step 1: Platform cost price
  const platformCostPrice = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, markupPct, commissionPct);

  // Step 2: Platform selling price (markup/override + product discount +
  // round-up-to-100 + undercut vs the tenant's store price)
  const overridePct = subProduct?.platformMarkupOverridePct ?? null;
  const platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount, {
    tenantStorePrice: tenantSellingPrice,
    platformMarkupOverridePct: overridePct,
  });

  // Step 3: Platform margin
  const platformMargin = calcPlatformMargin(platformCostPrice, platformSellingPrice);

  // What the tenant is paid per unit. Commission: their retail price minus the
  // platform's cut — computed directly so it stays correct even when the
  // selling-price chain is incomplete or a product discount is active.
  const tenantReceives = revenueModel === 'commission'
    ? (tenantSellingPrice > 0
        ? parseFloat((tenantSellingPrice * (1 - commissionPct / 100)).toFixed(2))
        : null)
    : costPrice;

  return {
    // Inputs
    costPrice,
    tenantSellingPrice,
    revenueModel,
    markupPct,
    commissionPct,
    platformMarkupPct: overridePct ?? platformMarkupPct,
    isPlatformMarkupOverridden: overridePct != null,
    tenantDiscount: tenantStorePrice != null && tenantStorePrice < tenantSellingPrice ? {
      active: true,
      originalPrice: tenantSellingPrice,
      discountedPrice: tenantStorePrice
    } : null,
    productDiscount: isDiscountActive(productDiscount) ? {
      active: true,
      value: productDiscount.value,
      type: productDiscount.type
    } : null,

    // Calculated values
    platformCostPrice,
    platformSellingPrice,
    platformMargin,
    tenantReceives,

    // Final price (what customer pays)
    finalPrice: platformSellingPrice
  };
};

/**
 * Calculate pricing for a Size variant
 * 
 * @param {object} size - Size document
 * @param {object} product - Populated Product document
 * @param {object} tenant - Populated Tenant document
 * @param {number} fallbackCostPrice - Fallback cost price from SubProduct
 * @param {number} fallbackSellingPrice - Fallback selling price from SubProduct
 * @returns {object} pricing object
 */
const calculateSizePricing = (size, product, tenant, fallbackCostPrice = 0, fallbackSellingPrice = 0) => {
  const revenueModel = tenant?.revenueModel ?? 'markup';
  // Headline price is ALWAYS at the normal rates; the pack rate is published
  // separately as packUnitPrice and only earned by quantity (resolveLineRates).
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, 1);
  const platformMarkupPct = product?.platformMarkup ?? DEFAULT_PLATFORM_MARKUP;

  // Get product-level discount
  const productDiscount = product?.platformDiscount?.value > 0 && product?.platformDiscount?.type
    ? { value: product.platformDiscount.value, type: product.platformDiscount.type, start: product.platformDiscount.start, end: product.platformDiscount.end }
    : null;

  // Size-level values — fall back to the sub-product when the size value is
  // missing OR zero (tenants often leave size costPrice at 0)
  const costPrice = size?.costPrice > 0 ? size.costPrice : fallbackCostPrice;
  const tenantSellingPrice = size?.sellingPrice > 0 ? size.sellingPrice : fallbackSellingPrice;

  // Tenant discount (for tenant store display only)
  const tenantDiscount = size?.discountValue > 0 && size?.discountType
    ? { value: size.discountValue, type: size.discountType, start: size.discountStart, end: size.discountEnd }
    : null;
  const tenantStorePrice = isDiscountActive(tenantDiscount)
    ? applyDiscount(tenantSellingPrice, tenantDiscount)
    : null;

  // Step 1: Platform cost price
  const platformCostPrice = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, markupPct, commissionPct);

  // Step 2: Platform selling price (markup/override + product discount +
  // round-up-to-100 + undercut vs the tenant's store price)
  const overridePct = size?.platformMarkupOverridePct ?? null;
  const platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount, {
    tenantStorePrice: tenantSellingPrice,
    platformMarkupOverridePct: overridePct,
  });

  // Step 3: Platform margin
  const platformMargin = calcPlatformMargin(platformCostPrice, platformSellingPrice);

  // Quantity-triggered pack pricing: a pack-eligible size advertises a second
  // per-unit price that a line earns at quantity >= unitsPerPack.
  const unitsPerPack = size?.unitsPerPack ?? 1;
  const minUnits = tenant?.packRateMinUnits ?? DEFAULT_PACK_RATE_MIN_UNITS;
  const thresholdReachable = !size?.maxOrderQuantity || size.maxOrderQuantity >= unitsPerPack;
  const packOverridePct = size?.packPlatformMarkupOverridePct ?? null;
  // Pack cost is computed at the tenant's reduced pack rates (e.g. supplier
  // cost × (1 + packMarkup%) for markup model). Exposed even when the final
  // pack selling price doesn't beat the normal price, so the admin can see it.
  let packPlatformCostPrice = null;
  let packRatesUsed = null;
  let packUnitPrice = null;
  let packThreshold = null;
  let packSavingsPct = null;
  if (unitsPerPack >= minUnits && thresholdReachable && platformSellingPrice > 0) {
    packRatesUsed = resolveRevenueRates(tenant, unitsPerPack);
    packPlatformCostPrice = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, packRatesUsed.markupPct, packRatesUsed.commissionPct);
    const packSelling = calcPlatformSellingPrice(packPlatformCostPrice, platformMarkupPct, productDiscount, {
      tenantStorePrice: tenantSellingPrice,
      platformMarkupOverridePct: packOverridePct ?? overridePct,
    });
    if (packSelling > 0 && packSelling < platformSellingPrice) {
      packUnitPrice = packSelling;
      packThreshold = unitsPerPack;
      packSavingsPct = Math.round(((platformSellingPrice - packSelling) / platformSellingPrice) * 100);
    }
  }

  return {
    // Inputs
    sizeId: size?._id,
    sizeName: size?.size ?? size?.displayName,
    costPrice,
    tenantSellingPrice,
    revenueModel,
    markupPct,
    commissionPct,
    platformMarkupPct: overridePct ?? platformMarkupPct,
    isPlatformMarkupOverridden: overridePct != null,
    tenantDiscount: tenantStorePrice != null && tenantStorePrice < tenantSellingPrice ? {
      active: true,
      originalPrice: tenantSellingPrice,
      discountedPrice: tenantStorePrice
    } : null,
    productDiscount: isDiscountActive(productDiscount) ? {
      active: true,
      value: productDiscount.value,
      type: productDiscount.type
    } : null,

    // Calculated values
    platformCostPrice,
    platformSellingPrice,
    platformMargin,

    // Final price
    finalPrice: platformSellingPrice,

    // Quantity-triggered pack pricing (null when not eligible / no saving)
    packUnitPrice,
    packThreshold,
    packSavingsPct,
    // Pack cost price at the tenant's reduced rates (supplier cost × (1+packMarkup%))
    // and the rates used — exposed so the admin can see the pack cost breakdown.
    packPlatformCostPrice,
    packMarkupPct: packRatesUsed?.markupPct ?? null,
    packCommissionPct: packRatesUsed?.commissionPct ?? null,
    isPackPlatformMarkupOverridden: packOverridePct != null
  };
};

/**
 * Invert the full forward pricing chain: given the admin's desired FINAL
 * platform price (what the customer pays), return the value to store.
 *   markup     → supplier costPrice
 *   commission → tenant sellingPrice
 *
 * Inversion order mirrors the forward chain in reverse:
 *   1. undo the active product-level discount (percentage or fixed)
 *   2. undo the platform markup
 *   3. undo the tenant revenue model
 */
const backCalcStoredPrice = (
  adminPrice,
  {
    revenueModel = 'markup',
    markupPct = 25,
    commissionPct = 12,
    platformMarkupPct = DEFAULT_PLATFORM_MARKUP,
    productDiscount = null,
  } = {}
) => {
  let preDiscount = adminPrice;
  if (isDiscountActive(productDiscount)) {
    if (productDiscount.type === 'percentage') {
      const factor = 1 - productDiscount.value / 100;
      if (factor > 0) preDiscount = adminPrice / factor;
    } else if (productDiscount.type === 'fixed') {
      preDiscount = adminPrice + productDiscount.value;
    }
  }

  const platformCostPrice = preDiscount / (1 + platformMarkupPct / 100);

  const normalized = revenueModel === 'platform_markup' ? 'markup' : revenueModel;
  if (normalized === 'markup') {
    return parseFloat((platformCostPrice / (1 + markupPct / 100)).toFixed(2));
  }
  const divisor = 1 - commissionPct / 100;
  if (divisor <= 0) return parseFloat(adminPrice.toFixed(2));
  return parseFloat((platformCostPrice / divisor).toFixed(2));
};

module.exports = {
  DEFAULT_PLATFORM_MARKUP,
  DEFAULT_PACK_RATE_MIN_UNITS,
  resolveRevenueRates,
  resolveLineRates,
  resolveEffectiveUnitPrice,
  isDiscountActive,
  applyDiscount,
  roundUpTo100,
  calcPlatformCostPrice,
  calcPlatformSellingPrice,
  calcPlatformMargin,
  calculateSubProductPricing,
  calculateSizePricing,
  backCalcStoredPrice
};
