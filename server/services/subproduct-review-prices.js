const { commissionOverride } = require('./subproduct-review-commission');
const Size = require('../models/Size');
const { ValidationError } = require('../utils/errors');
const {
  calculateSubProductPricing,
  calculateSizePricing,
  calcPlatformSellingPrice,
  isDiscountActive,
  applySubProductSale,
} = require('../utils/pricing');
const id = (v) => String(v?._id || v || '');
const amount = (v, label) => {
  if (
    typeof v !== 'number' ||
    !Number.isFinite(v) ||
    v <= 0 ||
    v > 1e12 ||
    v % 100 !== 0
  )
    throw new ValidationError(
      `${label} must be a positive price rounded to 100, within the supported range`
    );
  return v;
};
// Floor the stored percentage so rounding cannot push a clean requested price up one step.
function effectivePct(price, cost, discount) {
  if (!(cost > 0) || !Number.isFinite(cost))
    throw new ValidationError(
      'A valid tenant payout is required to override a price'
    );
  let before = price;
  if (isDiscountActive(discount)) {
    if (discount.type === 'percentage') {
      if (discount.value >= 100)
        throw new ValidationError(
          'A 100% product discount cannot support a price override'
        );
      before /= 1 - discount.value / 100;
    } else if (discount.type === 'fixed') before += discount.value;
  }
  return Math.floor(((before / cost - 1) * 100 + 1e-10) * 10000) / 10000;
}
function normalDraft(price, current, sp, discount) {
  amount(price, 'Website price');
  if (current.revenueModel === 'commission') {
    if (!(applySubProductSale({ finalPrice: price }, sp).finalPrice > 0))
      throw new ValidationError(
        'A positive final merchandise price is required for commission listings'
      );
    return commissionOverride(price, current.platformSellingPrice, discount);
  }
  const final = applySubProductSale({ finalPrice: price }, sp).finalPrice;
  if (!(current.platformCostPrice > 0) || final < current.platformCostPrice)
    throw new ValidationError(
      'Website price after sales must cover the tenant payout'
    );
  if (Math.abs(price - (current.platformSellingPrice || 0)) < 1) return null;
  const pct = effectivePct(price, current.platformCostPrice, discount);
  const forward = calcPlatformSellingPrice(current.platformCostPrice, 0, discount, {
    platformMarkupOverridePct: pct,
  });
  if (Math.abs(forward - price) > 0.01)
    throw new ValidationError(
      'The requested website price cannot be represented by the current pricing settings'
    );
  return pct;
}
async function prepareReviewPrices(sp, overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))
    throw new ValidationError('Invalid price overrides');
  const tenant = sp.tenant,
    product = sp.product;
  const discount = product?.platformDiscount;
  const result = { base: null, sizes: [] };
  if (overrides.baseWebsitePrice !== undefined && (sp.currency || 'NGN') !== 'NGN')
    throw new ValidationError('Review price overrides currently support NGN only');
  const requested = overrides.sizes ?? [];
  if (!Array.isArray(requested) || requested.length > 500)
    throw new ValidationError('Invalid size overrides');
  const requestedIds = requested.map((row) => {
    if (!row || typeof row.id !== 'string' || !row.id)
      throw new ValidationError('Each size override needs an ID');
    return row.id;
  });
  if (new Set(requestedIds).size !== requestedIds.length)
    throw new ValidationError('Duplicate size overrides');
  const linkedIds = (sp.sizes || []).map(id);
  if (!linkedIds.length) {
    const currentBase = calculateSubProductPricing(sp, product, tenant);
    const baseKey =
      tenant?.revenueModel === 'commission' ? 'baseCommissionPrice' : 'base';
    result[baseKey] = normalDraft(
      overrides.baseWebsitePrice ?? currentBase.platformSellingPrice,
      currentBase,
      sp,
      discount
    );
  } else if (overrides.baseWebsitePrice !== undefined) {
    throw new ValidationError('Use size prices for a listing with size variants');
  }
  const ids = [...new Set([...requestedIds, ...linkedIds])];
  if (!ids.length) return result;
  const sizes = await Size.find({
    _id: { $in: ids },
    subproduct: sp._id,
    tenant: tenant?._id || tenant,
  });
  const owned = new Map(
    sizes
      .filter((s) => id(s.subproduct) === id(sp) && id(s.tenant) === id(tenant))
      .map((s) => [id(s), s])
  );
  for (const sizeId of ids) {
    const row = requested.find((r) => r.id === sizeId) || { id: sizeId };
    const size = owned.get(row.id);
    if (!size)
      throw new ValidationError('Size does not belong to this listing and tenant');
    if (
      (row.websitePrice !== undefined || row.packUnitPrice !== undefined) &&
      (size.currency || sp.currency || 'NGN') !== 'NGN'
    )
      throw new ValidationError('Review price overrides currently support NGN only');
    const current = calculateSizePricing(
      size,
      product,
      tenant,
      sp.costPrice,
      sp.baseSellingPrice
    );
    const values = {};
    const pct = normalDraft(
      row.websitePrice ?? current.platformSellingPrice,
      current,
      sp,
      discount
    );
    if (pct !== null)
      values[
        tenant?.revenueModel === 'commission'
          ? 'commissionPriceOverride'
          : 'platformMarkupOverridePct'
      ] = pct;
    if (row.packUnitPrice !== undefined) {
      const pack = amount(row.packUnitPrice, 'Pack price');
      if (applySubProductSale(current, sp).saleActive || isDiscountActive(discount))
        throw new ValidationError('Pack pricing cannot stack with an active sale');
      if (!(current.packPlatformCostPrice > 0))
        throw new ValidationError('This size is not eligible for pack pricing');
      const normal = row.websitePrice ?? current.platformSellingPrice;
      if (pack >= normal)
        throw new ValidationError(
          'Pack unit price must be lower than the normal website price'
        );
      if (
        tenant?.revenueModel !== 'commission' &&
        pack < current.packPlatformCostPrice
      )
        throw new ValidationError('Pack price must cover the tenant payout');
      if (Math.abs(pack - (current.packUnitPrice || 0)) >= 1) {
        if (tenant?.revenueModel === 'commission') {
          values.packCommissionPriceOverride = pack;
        } else {
          const pct = effectivePct(pack, current.packPlatformCostPrice, null);
          const forward = calcPlatformSellingPrice(
            current.packPlatformCostPrice,
            0,
            null,
            { platformMarkupOverridePct: pct }
          );
          if (Math.abs(forward - pack) > 0.01)
            throw new ValidationError(
              'The requested pack price cannot be represented by the current pricing settings'
            );
          values.packPlatformMarkupOverridePct = pct;
        }
      }
    }
    if (Object.keys(values).length) result.sizes.push({ doc: size, values });
  }
  return result;
}
module.exports = { prepareReviewPrices };
