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
  if (revenueModel === 'markup') {
    if (!costPrice || costPrice <= 0) return 0;
    return parseFloat((costPrice * (1 + markupPct / 100)).toFixed(2));
  } else {
    // commission
    if (!tenantSellingPrice || tenantSellingPrice <= 0) return 0;
    return parseFloat((tenantSellingPrice * (1 - commissionPct / 100)).toFixed(2));
  }
};

/**
 * Calculate platform selling price (includes platform markup and product discount)
 * 
 * @param {number} platformCostPrice - The platform cost price
 * @param {number} platformMarkupPct - Platform markup percentage from Product
 * @param {object} productDiscount - Product-level discount { value, type, start, end }
 * @returns {number} platformSellingPrice
 */
const calcPlatformSellingPrice = (platformCostPrice, platformMarkupPct = DEFAULT_PLATFORM_MARKUP, productDiscount = null) => {
  if (!platformCostPrice || platformCostPrice <= 0) return 0;
  let sellingPrice = parseFloat((platformCostPrice * (1 + platformMarkupPct / 100)).toFixed(2));
  if (isDiscountActive(productDiscount)) {
    sellingPrice = applyDiscount(sellingPrice, productDiscount);
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

  // Step 2: Platform selling price (includes markup + product discount)
  const platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);

  // Step 3: Platform margin
  const platformMargin = calcPlatformMargin(platformCostPrice, platformSellingPrice);

  // Calculate tenant receives (for commission model)
  const tenantReceives = revenueModel === 'commission' && platformSellingPrice != null && platformMargin != null
    ? parseFloat((platformSellingPrice - platformMargin).toFixed(2))
    : costPrice;

  return {
    // Inputs
    costPrice,
    tenantSellingPrice,
    revenueModel,
    markupPct,
    commissionPct,
    platformMarkupPct,
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
  const markupPct = tenant?.markupPercentage ?? 25;
  const commissionPct = tenant?.commissionPercentage ?? 12;
  const platformMarkupPct = product?.platformMarkup ?? DEFAULT_PLATFORM_MARKUP;

  // Get product-level discount
  const productDiscount = product?.platformDiscount?.value > 0 && product?.platformDiscount?.type
    ? { value: product.platformDiscount.value, type: product.platformDiscount.type, start: product.platformDiscount.start, end: product.platformDiscount.end }
    : null;

  // Size-level values (fallback to subproduct if not set)
  const costPrice = size?.costPrice ?? fallbackCostPrice;
  const tenantSellingPrice = size?.sellingPrice ?? fallbackSellingPrice;

  // Tenant discount (for tenant store display only)
  const tenantDiscount = size?.discountValue > 0 && size?.discountType
    ? { value: size.discountValue, type: size.discountType, start: size.discountStart, end: size.discountEnd }
    : null;
  const tenantStorePrice = isDiscountActive(tenantDiscount)
    ? applyDiscount(tenantSellingPrice, tenantDiscount)
    : null;

  // Step 1: Platform cost price
  const platformCostPrice = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, markupPct, commissionPct);

  // Step 2: Platform selling price (includes markup + product discount)
  const platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);

  // Step 3: Platform margin
  const platformMargin = calcPlatformMargin(platformCostPrice, platformSellingPrice);

  return {
    // Inputs
    sizeId: size?._id,
    sizeName: size?.size ?? size?.displayName,
    costPrice,
    tenantSellingPrice,
    revenueModel,
    platformMarkupPct,
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
    finalPrice: platformSellingPrice
  };
};

module.exports = {
  DEFAULT_PLATFORM_MARKUP,
  isDiscountActive,
  applyDiscount,
  calcPlatformCostPrice,
  calcPlatformSellingPrice,
  calcPlatformMargin,
  calculateSubProductPricing,
  calculateSizePricing
};
