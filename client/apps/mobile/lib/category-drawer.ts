import type { Category, SubCategory } from 'commerce-core';

/**
 * The Categories drawer's filtering — `apps/platform/src/components/Navigation/
 * MobileBottomNav.tsx:120-138`, lifted out of the component so it can be tested.
 *
 * `commerce-core` already supplies the fetching and the root/sub grouping
 * (`fetchAllCategories`, `getRootCategories`, `getSubcategories`), and mobile
 * already depends on that package — only the search behaviour is restated here.
 */

/** The web slices subcategory hits at 20. */
export const SUB_RESULT_LIMIT = 20;

const normalize = (value: string | undefined | null): string =>
  String(value ?? '').toLowerCase();

/** No query means "show everything" — the drawer's default browse state. */
export function filterRoots(
  roots: Category[] | null | undefined,
  query: string
): Category[] {
  if (!Array.isArray(roots)) return [];
  const q = query.trim().toLowerCase();
  if (!q) return roots;
  return roots.filter((c) => normalize(c.name).includes(q));
}

/**
 * Flat subcategory search, shown only while searching.
 *
 * Empty subcategories are dropped: the web filters on `productCount > 0` so a
 * result can never lead to an empty shop page.
 */
export function searchSubcategories(
  subs: SubCategory[] | null | undefined,
  query: string,
  limit = SUB_RESULT_LIMIT
): SubCategory[] {
  if (!Array.isArray(subs)) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return subs
    .filter((s) => (s.productCount ?? 0) > 0 && normalize(s.name).includes(q))
    .slice(0, limit);
}

/**
 * A subcategory's root, for building its shop link.
 *
 * `parent` is populated by the API sometimes and left a raw id other times, so
 * both shapes are read — and `null` is a real value, not an error.
 */
export function parentOf(
  sub: Pick<SubCategory, 'parent'> | null | undefined,
  roots: Category[] | null | undefined
): Category | null {
  if (!sub || !Array.isArray(roots)) return null;
  const parent = sub.parent;
  const parentId =
    typeof parent === 'string' ? parent : (parent as { _id?: string } | null)?._id;
  if (!parentId) return null;
  return roots.find((c) => c._id === parentId) ?? null;
}
