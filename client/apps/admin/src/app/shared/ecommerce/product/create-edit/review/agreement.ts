import type { PriceLine, ReviewListing } from './types';
export const isCommission = (line: PriceLine, listing: ReviewListing) =>
  (listing.tenant?.revenueModel ?? line.pricing.revenueModel) === 'commission';
export function agreedCommission(
  line: PriceLine,
  listing: ReviewListing,
  pack = false
) {
  const rate = pack
    ? (line.pricing.packCommissionPct ??
      listing.tenant?.packCommissionPercentage ??
      line.pricing.commissionPct ??
      listing.tenant?.commissionPercentage)
    : (line.pricing.commissionPct ?? listing.tenant?.commissionPercentage);
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate < 100
    ? rate
    : null;
}
export function commissionPayout(customer: number, rate: number) {
  const basis = Math.round(customer * 100);
  return (basis - Math.round((basis * rate) / 100)) / 100;
}
