import type { PriceDraft, PriceLine, ReviewListing } from './types';
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
          ...((sp.tenant?.revenueModel ?? s.pricing?.revenueModel) ===
          'selling_price_markup'
            ? {
                packUnitPrice: null,
                packPlatformCostPrice: null,
                packThreshold: null,
              }
            : {}),
          packPlatformMarkupPct:
            s.packPlatformMarkupOverridePct ?? s.pricing?.platformMarkupPct,
        },
        packThreshold:
          (sp.tenant?.revenueModel ?? s.pricing?.revenueModel) ===
          'selling_price_markup'
            ? null
            : (s.pricing?.packThreshold || s.unitsPerPack || 0) > 1
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

const positive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
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
