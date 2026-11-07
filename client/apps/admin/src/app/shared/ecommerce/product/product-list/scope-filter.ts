// Visibility (publication-scope) facet — pure filter helper for the admin
// product list. The facet is single-select: 'all' (default), 'marketplace',
// 'private'. It is applied CLIENT-SIDE, over the already-loaded
// GET /api/products/admin/list page payload — the list service
// (server getAdminProductList) does not support a scope param. Legacy rows
// predate `publicationScope` (field absent); they are bucketed as
// 'marketplace' ONLY when that scope is explicitly selected, so the default
// 'all' state leaves every existing view unchanged.

export type PublicationScopeFilterValue = 'all' | 'marketplace' | 'private';

/**
 * Does a row belong to the selected visibility (scope) facet bucket?
 *
 * - 'all'        → always true (facet inactive).
 * - 'private'    → only rows explicitly marked `tenant_private`.
 * - 'marketplace'→ canonical rows PLUS legacy rows missing the field
 *                  (absent = canonical bucket, per the facet contract).
 */
export function matchesPublicationScope(
  publicationScope: string | null | undefined,
  facet: PublicationScopeFilterValue
): boolean {
  if (facet === 'all') return true;
  if (facet === 'private') return publicationScope === 'tenant_private';
  // 'marketplace': canonical + legacy (absent field). Anything the server may
  // add later that is neither canonical nor tenant_private degrades to this
  // bucket, matching the tag's "render nothing → marketplace surfaces" rule.
  return publicationScope !== 'tenant_private';
}
