/**
 * One search result row, derived from the raw product.
 *
 * Transcribed from the row body of `ModalSearch.tsx:624-777`: its own
 * `getPrice`/`getProductImage`, the in-stock rule, the 1..10 low-stock window,
 * and — the part worth having in a test — the `explainedAbove` rule that
 * decides whether a "why did this match?" snippet is shown at all.
 *
 * Pure, so the whole rule set is exercised in vitest's `node` environment. The
 * row component only maps this onto <Text> and <RemoteImage>.
 */

import { matchesTerms } from './search-highlight.ts';
import { buildSnippet, getFacets, orderFacets, type Facet, type Snippet } from './search-facets.ts';

type SearchProduct = Record<string, any>;

export interface SearchResultView {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  inStock: boolean;
  /** Stock count, but only inside the web's "N left" window (in stock, 1..10). */
  lowStock: number | null;
  categoryName: string | null;
  brandName: string | null;
  facets: Facet[];
  matchedFacetKeys: Set<string>;
  snippet: Snippet | null;
}

/** An image field is sometimes `{ url }`, sometimes a bare string, often absent. */
function imageUrlOf(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  const url = (value as { url?: unknown } | null)?.url;
  return typeof url === 'string' && url ? url : null;
}

function nameOf(value: unknown): string | null {
  const name = (value as { name?: unknown } | null)?.name;
  return typeof name === 'string' && name ? name : null;
}

export function toSearchResultView(product: SearchProduct, terms: string[]): SearchResultView {
  const range = product.priceRange ?? null;
  const min = typeof range?.min === 'number' ? range.min : 0;
  const max = typeof range?.max === 'number' ? range.max : null;

  const inStock = product.availability?.status !== 'out_of_stock';
  const stock = typeof product.availability?.totalStock === 'number'
    ? product.availability.totalStock
    : 0;

  const { shown: facets, matchedKeys } = orderFacets(getFacets(product), terms);

  // Explain the hit once: matched facets, or the name/brand/category, or — only
  // when none of those account for it — a quoted passage. Showing both is noise.
  const explainedAbove =
    matchedKeys.size > 0 ||
    matchesTerms(product.name, terms) ||
    matchesTerms(nameOf(product.brand), terms) ||
    matchesTerms(nameOf(product.category), terms);

  return {
    id: String(product._id ?? product.id ?? ''),
    slug: typeof product.slug === 'string' ? product.slug : '',
    name: typeof product.name === 'string' ? product.name : '',
    imageUrl:
      imageUrlOf(product.primaryImage) ??
      imageUrlOf(Array.isArray(product.images) ? product.images[0] : null) ??
      imageUrlOf(Array.isArray(product.thumbImage) ? product.thumbImage[0] : null),
    price: min,
    originalPrice: max !== null && max !== min ? max : null,
    inStock,
    lowStock: inStock && stock > 0 && stock <= 10 ? stock : null,
    categoryName: nameOf(product.category),
    brandName: nameOf(product.brand),
    facets,
    matchedFacetKeys: matchedKeys,
    snippet: explainedAbove ? null : buildSnippet(product, terms),
  };
}
