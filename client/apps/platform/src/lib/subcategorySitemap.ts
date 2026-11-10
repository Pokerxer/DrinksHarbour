/**
 * Sitemap subcategory entry shape (matches what sitemap.ts fetches — fields it
 * actually uses only, so the helper is trivially testable without the API).
 */
export interface SubcatEntry {
  slug: string;
  parentSlug: string;
  productCount: number;
}

/**
 * Collapse singular/plural slug variants within one parent category to the
 * highest-count entry, in place (same array, deduplicated).
 *
 * The catalog contains near-duplicate SubCategory documents from successive
 * taxonomy imports — exactly two known pairs today, both under `liqueurs`
 * (`fruit-liqueur` vs `fruit-liqueurs`, `cream-liqueur` vs `cream-liqueurs`).
 * Both URLs render the same grid, so advertising both in /sitemap.xml splits
 * crawl budget across near-duplicates — the same failure the /categories/[slug]
 * and /shop?brand= dedupes (see sitemap.ts notes) fixed elsewhere. Data-level
 * consolidation is the real fix (tracked in docs/memory/seo-ai-files-2026-11-10.md);
 * this guardrail keeps the sitemap clean until the records are merged.
 *
 * Variants compare by stripping a single trailing 's' (the catalog's only
 * recurring noise pattern: `fruit-liqueurs/fruit-liqueur`, not knife-cases
 * like `address/addressee`). Ties (two zero-count variants, or equal counts)
 * keep the longer slug — the plural form of a discovered pair has been the
 * established one (`fruit-liqueurs` predates `fruit-liqueur`).
 */
export function dedupeVariantSubcategoryId<E extends SubcatEntry>(
  entries: E[],
): E[] {
  const keep = new Map<string, E>();
  for (const entry of entries) {
    const variant = `${entry.parentSlug}/${entry.slug.replace(/s$/, '')}`;
    if (!keep.has(variant)) {
      keep.set(variant, entry);
      continue;
    }
    const kept = keep.get(variant)!;
    const wins =
      entry.productCount > kept.productCount ||
      (entry.productCount === kept.productCount && entry.slug.length > kept.slug.length);
    if (wins) keep.set(variant, entry);
  }
  return [...keep.values()];
}
