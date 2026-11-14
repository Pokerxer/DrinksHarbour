// CPC tariff for sponsored placements — NGN charged per deduplicated click.
//
// This number is a DELIBERATE PLATFORM PRICING DECISION, not a researched
// market rate: no bid/market data exists (see
// docs/memory/ads-promo-break-even-2026-11-10.md — MISSING data, do not
// estimate). Do not present it as a "market rate" anywhere in UI copy.
// Override per environment with ADS_CPC_TARIFF_NGN.
const CPC_TARIFF_NGN = parseInt(process.env.ADS_CPC_TARIFF_NGN, 10) || 50;

module.exports = { CPC_TARIFF_NGN };
