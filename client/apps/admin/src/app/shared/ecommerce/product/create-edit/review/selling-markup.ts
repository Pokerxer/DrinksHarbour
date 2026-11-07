import type { PriceLine, ReviewListing } from './types';
export const isSellingMarkup = (line: PriceLine, listing: ReviewListing) =>
  (listing.tenant?.revenueModel ?? line.pricing.revenueModel) ===
  'selling_price_markup';
const validRate = (rate: unknown): rate is number =>
  typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 500;
export function tenantDefaultRate(
  line: Pick<PriceLine, 'pricing'>,
  listing: ReviewListing
) {
  const rate =
    line.pricing.inheritedSellingPriceMarkupPct ??
    listing.tenant?.sellingPriceMarkupPercentage;
  return validRate(rate) ? rate : null;
}
export function retailPayout(line: PriceLine) {
  const retail = line.pricing.tenantSellingPrice;
  if (typeof retail !== 'number' || !Number.isFinite(retail) || retail <= 0)
    return null;
  const rounded = Math.round(retail * 100) / 100;
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}
export function sellingMarkupPreview(
  line: PriceLine,
  raw: string,
  listing: ReviewListing,
  inherit = false
) {
  const retail = retailPayout(line);
  if (retail === null)
    return {
      rate: null,
      error:
        'A valid tenant selling price is required for selling-price markup.',
    };
  let price = raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(price) || price <= 0) return { rate: null, error: null };
  if (inherit) {
    const rate = tenantDefaultRate(line, listing);
    return {
      rate,
      error:
        rate === null
          ? 'Tenant default percentage is unavailable. Reload the listing.'
          : null,
    };
  }
  // An unchanged rounded quote keeps its saved percentage, not a new implied rate.
  const saved = line.pricing.sellingPriceMarkupPct;
  if (
    validRate(saved) &&
    Math.abs(price - (line.pricing.platformSellingPrice ?? 0)) < 1
  )
    return { rate: saved, error: null };
  const discount = line.pricing.productDiscount;
  if (discount?.active && discount.value && discount.value > 0) {
    if (discount.type === 'percentage') {
      if (discount.value >= 100)
        return {
          rate: null,
          error: 'A 100% catalogue discount cannot support a price override.',
        };
      price /= 1 - discount.value / 100;
    } else if (discount.type === 'fixed') price += discount.value;
  }
  // Match the server review's discount inversion and four-decimal floor.
  const rate = Math.floor(((price / retail - 1) * 100 + 1e-10) * 10000) / 10000;
  return validRate(rate)
    ? { rate, error: null }
    : {
        rate: null,
        error: 'Selling-price markup must be between 0% and 500%.',
      };
}
