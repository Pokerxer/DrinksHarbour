// Umbrella/marketing category slugs → Category.type family patterns.
//
// The storefront links to umbrella slugs the Category collection doesn't have
// (footer: ?category=wine / spirits / beers / non-alcoholic). The backend
// resolves these against the database by the `type` field every Category
// document carries (server/helpers/searchFilter.helper.js). This is its client
// mirror, used by the Shop grid's client-side re-filter: products arrive from
// the search API with `category.{slug,type}` populated, so matching stays
// driven by DB data — this file only encodes the family patterns, never any
// catalog slugs, and DB categories added later (japanese-whisky, port-wine, …)
// join their family automatically. Keep in sync with the server helper.

const WHISKY_PATTERN = 'whisk|scotch|bourbon';
const WINE_PATTERN = 'wine|champagne';
const SPIRIT_PATTERN = `${WHISKY_PATTERN}|vodka|gin|rum|tequila|brandy|cognac|soju|baijiu|shochu|mezcal|liqueur|aperitif|digestif|cocktail`;
const BEER_PATTERN = 'beer|cider';
const NON_ALCO_PATTERN = 'coffee|tea|juice|soda|water|milk|yogurt|soft_drink|dairy|functional|syrup';

export const CATEGORY_TYPE_GROUPS: Record<string, string> = {
  wine: WINE_PATTERN,
  wines: WINE_PATTERN,
  whisky: WHISKY_PATTERN,
  whiskies: WHISKY_PATTERN,
  whiskeys: WHISKY_PATTERN,
  'scotch-whisky': 'scotch',
  spirit: SPIRIT_PATTERN,
  spirits: SPIRIT_PATTERN,
  beers: BEER_PATTERN,
  'beers-ciders': BEER_PATTERN,
  ciders: 'cider',
  'non-alcoholic': NON_ALCO_PATTERN,
  nonalcoholic: NON_ALCO_PATTERN,
};

/**
 * True when a product's populated category matches the requested URL slug(s).
 * Umbrella slugs match category.type by family pattern; anything else compares
 * against category.slug (with a de-pluralized fallback, "vodkas" → "vodka").
 * Mirrors resolveCategoryToObjectIds in server/helpers/searchFilter.helper.js.
 */
/**
 * True when a product's populated subcategory matches the requested slug(s).
 * Mirrors resolveSubCategoryToObjectIds in server/helpers/searchFilter.helper.js:
 * exact match, suffix match ("aged-25-year-scotch" request → "scotch" doc), and
 * DB-driven prefix family ("single-malt" request → "single-malt-scotch" doc).
 */
export function productMatchesSubCategory(
  subCategory: { slug?: string } | null | undefined,
  requested: string[] | string | null | undefined,
): boolean {
  const list = requested == null ? [] : Array.isArray(requested) ? requested : [requested];
  const wanted = list
    .map((s) => String(s).toLowerCase().trim().replace(/\s+/g, '-'))
    .filter(Boolean);
  if (wanted.length === 0) return true;
  const slug = subCategory?.slug?.toLowerCase();
  if (!slug) return false;
  return wanted.some(
    (n) => slug === n || n.endsWith(`-${slug}`) || slug.startsWith(`${n}-`),
  );
}

export function productMatchesCategory(
  category: { slug?: string; type?: string } | null | undefined,
  requested: string[] | string | null | undefined,
): boolean {
  const list = requested == null ? [] : Array.isArray(requested) ? requested : [requested];
  const wanted = list.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  if (wanted.length === 0) return true;
  if (!category) return false;

  const slug = category.slug?.toLowerCase() ?? '';
  const type = category.type?.toLowerCase() ?? '';

  return wanted.some((n) => {
    const pattern = CATEGORY_TYPE_GROUPS[n];
    if (pattern) return type !== '' && new RegExp(pattern, 'i').test(type);
    if (slug === n) return true;
    return n.length > 3 && n.endsWith('s') && slug === n.slice(0, -1);
  });
}
