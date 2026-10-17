import { isCommission, agreedCommission, commissionPayout } from './agreement';
import type {
  ReviewListing,
  PriceLine,
  PriceDraft,
  PriceTargets,
  ReviewOverrides,
} from './types';
const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;
const round = (v: number) => Math.ceil((v - 1e-9) / 100) * 100;
export const money = (v: number | null | undefined, currency = 'NGN') =>
  v != null && Number.isFinite(v)
    ? new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(v)
    : 'Unknown';
export function reviewLines(sp: ReviewListing): PriceLine[] {
  const sizes = sp.sizes || [];
  return sizes.length
    ? sizes.map((s) => ({
        id: s._id,
        label: s.displayName || s.size || 'Unnamed size',
        sku: s.sku,
        currency: s.currency || sp.currency || 'NGN',
        pricing: {
          ...s.pricing,
          packPlatformMarkupPct:
            s.packPlatformMarkupOverridePct ?? s.pricing?.platformMarkupPct,
        },
        packThreshold:
          (s.pricing?.packThreshold || s.unitsPerPack || 0) > 1
            ? s.pricing?.packThreshold || s.unitsPerPack || null
            : null,
      }))
    : [
        {
          id: 'base',
          label: 'Base listing',
          sku: sp.sku,
          currency: sp.currency || 'NGN',
          pricing: sp.pricing || {},
          packThreshold: null,
        },
      ];
}
export function saleActive(sp: ReviewListing, now = Date.now()) {
  return (
    !!sp.isOnSale &&
    positive(sp.saleDiscountValue) &&
    (!sp.saleStartDate || now >= Date.parse(sp.saleStartDate)) &&
    (!sp.saleEndDate || now <= Date.parse(sp.saleEndDate))
  );
}
export function listingSalePrice(price: number, sp: ReviewListing): number {
  if (!saleActive(sp)) return price;
  const value = sp.saleDiscountValue || 0;
  const type = sp.saleType || 'percentage';
  if (['percentage', 'flash_sale'].includes(type))
    return Math.max(0, round(price * (1 - value / 100)));
  if (type === 'fixed') return Math.max(0, round(price - value));
  return price;
}
const target = (raw: string, fallback: number | null): number | null => {
  if (!raw.trim()) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value < 100 ? value : null;
};
export function targetRates(
  line: PriceLine,
  sp: ReviewListing,
  targets: PriceTargets,
  pack = false
) {
  const pct =
    (pack ? line.pricing.packPlatformMarkupPct : line.pricing.platformMarkupPct) ??
    line.pricing.platformMarkupPct ??
    sp.product?.platformMarkup;
  const commission = isCommission(line, sp);
  const rate = agreedCommission(line, sp, pack);
  const configured =
    typeof pct === 'number' && Number.isFinite(pct) && pct >= 0
      ? (pct / (100 + pct)) * 100
      : null;
  const savedCustomer = pack
    ? line.pricing.packUnitPrice
    : listingSalePrice(line.pricing.platformSellingPrice || 0, sp);
  const payout =
    commission && rate !== null && positive(savedCustomer)
      ? commissionPayout(savedCustomer, rate)
      : pack
        ? line.pricing.packPlatformCostPrice
        : line.pricing.platformCostPrice;
  const supplier = line.pricing.costPrice;
  const currentTenant =
    positive(payout) && positive(supplier)
      ? Math.max(0, ((payout - supplier) / payout) * 100)
      : null;
  return {
    platform: commission ? rate : target(targets.platform, configured),
    tenant: target(targets.tenant, currentTenant),
  };
}
export function evaluatePrice(
  line: PriceLine,
  raw: string,
  sp: ReviewListing,
  targets: PriceTargets,
  pack = false,
  normal?: number
) {
  const entered = raw.trim() ? Number(raw) : NaN;
  const valid = Number.isFinite(entered) && entered > 0 && entered <= 1e12;
  const customer = valid ? (pack ? entered : listingSalePrice(entered, sp)) : null;
  const payoutRaw = pack
    ? line.pricing.packPlatformCostPrice
    : line.pricing.platformCostPrice;
  const commission = isCommission(line, sp);
  const rate = agreedCommission(line, sp, pack);
  const payout = commission
    ? customer !== null && rate !== null
      ? commissionPayout(customer, rate)
      : null
    : positive(payoutRaw)
      ? payoutRaw
      : null;
  const supplier = positive(line.pricing.costPrice) ? line.pricing.costPrice : null;
  const tenantProfit =
    payout !== null && supplier !== null ? payout - supplier : null;
  const tenantMargin =
    tenantProfit !== null && payout !== null ? (tenantProfit / payout) * 100 : null;
  const platformProfit =
    customer !== null && payout !== null ? customer - payout : null;
  const platformMargin =
    platformProfit !== null && customer !== null && customer > 0
      ? (platformProfit / customer) * 100
      : null;
  const rates = targetRates(line, sp, targets, pack);
  let error: string | null = null;
  if (!valid) error = 'Enter a valid positive price.';
  else if (line.currency !== 'NGN')
    error = 'This review supports NGN price overrides only.';
  else if (entered % 100 !== 0)
    error = 'Round the website price to the nearest 100.';
  else if (customer === null || customer <= 0)
    error = 'Final merchandise price must be positive.';
  else if (payout === null)
    error =
      'Tenant payout is unavailable; resolve the pricing data before approval.';
  else if (customer === null || customer < payout)
    error = 'The customer price after sales must cover the tenant payout.';
  else if (pack && (saleActive(sp) || line.pricing.productDiscount?.active))
    error = 'Pack pricing is unavailable during a sale.';
  else if (pack && (!line.packThreshold || !normal || entered >= normal))
    error = 'Pack price must be lower than the normal website price.';
  return {
    customer,
    commission,
    payout,
    supplier,
    tenantProfit,
    tenantMargin,
    platformProfit,
    platformMargin,
    error,
    rates,
    tenantTargetMet:
      tenantMargin !== null && rates.tenant !== null
        ? tenantMargin + 1e-7 >= rates.tenant
        : null,
    platformTargetMet:
      platformMargin !== null && rates.platform !== null
        ? platformMargin + 1e-7 >= rates.platform
        : null,
    requiredPayout:
      supplier !== null && rates.tenant !== null
        ? supplier / (1 - rates.tenant / 100)
        : null,
  };
}
export function suggestPrice(
  line: PriceLine,
  sp: ReviewListing,
  targets: PriceTargets,
  pack = false,
  normal?: number
): number | null {
  const payout = pack
    ? line.pricing.packPlatformCostPrice
    : line.pricing.platformCostPrice;
  const rates = targetRates(line, sp, targets, pack);
  const commission = isCommission(line, sp);
  if (
    !positive(line.pricing.costPrice) ||
    (!commission && !positive(payout)) ||
    rates.platform === null ||
    line.currency !== 'NGN' ||
    (pack &&
      (!line.packThreshold ||
        saleActive(sp) ||
        line.pricing.productDiscount?.active))
  )
    return null;
  if (commission && rates.tenant === null) return null;
  let wanted = commission
    ? line.pricing.costPrice! /
      ((1 - rates.tenant! / 100) * (1 - rates.platform / 100))
    : payout! / (1 - rates.platform / 100);
  if (!pack && saleActive(sp)) {
    const value = sp.saleDiscountValue || 0;
    const type = sp.saleType || 'percentage';
    if (['percentage', 'flash_sale'].includes(type)) {
      if (value >= 100) return null;
      wanted /= 1 - value / 100;
    } else if (type === 'fixed') wanted += value;
  }
  const result = round(wanted);
  if (
    !Number.isFinite(result) ||
    result > 1e12 ||
    (pack && (!normal || result >= normal))
  )
    return null;
  return result;
}
export function initialDrafts(lines: PriceLine[]): Record<string, PriceDraft> {
  return Object.fromEntries(
    lines.map((line) => [
      line.id,
      {
        normal: positive(line.pricing.platformSellingPrice)
          ? String(line.pricing.platformSellingPrice)
          : '',
        pack: positive(line.pricing.packUnitPrice)
          ? String(line.pricing.packUnitPrice)
          : '',
      },
    ])
  );
}
export function buildOverrides(
  lines: PriceLine[],
  drafts: Record<string, PriceDraft>,
  sp: ReviewListing
): ReviewOverrides {
  const overrides: ReviewOverrides = {};
  for (const line of lines) {
    const draft = drafts[line.id] || { normal: '', pack: '' };
    const normal = evaluatePrice(line, draft.normal, sp, {
      platform: '',
      tenant: '',
    });
    if (normal.error) throw new Error(`${line.label}: ${normal.error}`);
    const value = Number(draft.normal);
    const websiteChanged =
      Math.abs(value - (line.pricing.platformSellingPrice || 0)) >= 1;
    if (line.id === 'base') {
      if (websiteChanged) overrides.baseWebsitePrice = value;
      continue;
    }
    const row: NonNullable<ReviewOverrides['sizes']>[number] = { id: line.id };
    if (websiteChanged) row.websitePrice = value;
    const enteredPack = Number(draft.pack);
    const packChanged =
      !Number.isFinite(enteredPack) ||
      Math.abs(enteredPack - (line.pricing.packUnitPrice || 0)) >= 1;
    if (draft.pack.trim() && packChanged) {
      const pack = evaluatePrice(
        line,
        draft.pack,
        sp,
        { platform: '', tenant: '' },
        true,
        value
      );
      if (pack.error) throw new Error(`${line.label}: ${pack.error}`);
      if (Math.abs(Number(draft.pack) - (line.pricing.packUnitPrice || 0)) >= 1)
        row.packUnitPrice = Number(draft.pack);
    }
    if (row.websitePrice !== undefined || row.packUnitPrice !== undefined)
      (overrides.sizes ||= []).push(row);
  }
  return overrides;
}
