import type { PromotionSuggestion } from '@/services/promotionSuggestions.service';
export function selectPromotions(
  rows: PromotionSuggestion[],
  query: string,
  type: string,
  confidence: string,
  sort: string
) {
  const terms = query.toLowerCase().trim().split(/\s+/);
  return rows
    .filter(
      (s) =>
        (type === 'all' ||
          (type === 'offers' ? s.type !== 'combo' : s.type === type)) &&
        (confidence === 'all' || s.confidence === confidence) &&
        terms.every((t) =>
          `${s.title} ${s.warehouseName} ${s.products.map((p) => `${p.productName} ${p.sizeName} ${p.sku}`).join(' ')}`
            .toLowerCase()
            .includes(t)
        )
    )
    .sort((a, b) => {
      const difference =
        sort === 'evidence'
          ? (b.evidence?.jointBaskets || 0) - (a.evidence?.jointBaskets || 0)
          : sort === 'movement'
            ? b.products.reduce((n, p) => n + p.units, 0) -
              a.products.reduce((n, p) => n + p.units, 0)
            : sort === 'occasion'
              ? (a.occasion?.daysAway ?? Infinity) -
                (b.occasion?.daysAway ?? Infinity)
              : b.score - a.score;
      return difference || a.key.localeCompare(b.key);
    });
}
export function previewPrice(s: PromotionSuggestion, discount: number) {
  if (
    !s.pricing.regularPrice ||
    s.pricing.discountPercent === null ||
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > s.pricing.discountPercent
  )
    return null;
  return (
    Math.ceil(s.pricing.regularPrice * (1 - discount / 100) * 100 - 1e-8) / 100
  );
}
