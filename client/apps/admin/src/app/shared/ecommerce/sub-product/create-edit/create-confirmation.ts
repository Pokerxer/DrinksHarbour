// Post-create confirmation copy for the Sub-Product create flow.
//
// POST /api/subproducts returns a populated central `product` that now carries
// `publicationScope` (see server/services/subproduct.service.js create path).
// With GENERAL_CATALOG_SCOPE_ENABLED an Owner/Admin-created identity is
// `tenant_private` + status 'pending': sellable in the tenant's store right
// away while DrinksHarbour still reviews its marketplace publication. Legacy
// rows (flag off) have NO publicationScope field and must keep the historic
// wording byte-for-byte; approved canonical identities keep it too.
//
// The private predicate reuses ../catalogue-scope (single source of truth);
// this module only holds the create-confirmation copy and stays UI-free so it
// can be unit-tested without mounting the form.

import { isTenantPrivateProduct } from '../catalogue-scope';

export interface CreatedCentralProductSummary {
  name?: string;
  status?: string;
  publicationScope?: string;
}

/**
 * Historic message for every non-private outcome (missing scope = legacy
 * pending, `canonical` = approved). Pinned byte-for-byte by
 * ./create-confirmation.test.ts — do not reword casually.
 */
export const CREATE_CONFIRMATION_LEGACY = 'Sub Product created successfully!';

/**
 * The one-line confirmation used ONLY when the populated central product is
 * explicitly `tenant_private`.
 */
export const TENANT_PRIVATE_CREATE_CONFIRMATION =
  'created and sellable in your store right away — DrinksHarbour reviews marketplace publication';

/** Fallback identity label when the parent product name is not populated. */
export const TENANT_PRIVATE_CREATE_CONFIRMATION_FALLBACK_NAME =
  'New product';

/**
 * Pick the post-create confirmation from the server's populated product.
 * Only an EXPLICIT `tenant_private` scope diverts from the historic copy —
 * missing/null/unknown scope (and an unpopulated product id string) read as
 * legacy-canon and keep {@link CREATE_CONFIRMATION_LEGACY} unchanged.
 */
export function getCreateConfirmationMessage(
  product: string | CreatedCentralProductSummary | null | undefined
): string {
  if (
    typeof product === 'object' &&
    product !== null &&
    isTenantPrivateProduct(product)
  ) {
    const name = product.name?.trim();
    if (name) return `"${name}" ${TENANT_PRIVATE_CREATE_CONFIRMATION}`;
    return `${TENANT_PRIVATE_CREATE_CONFIRMATION_FALLBACK_NAME} ${TENANT_PRIVATE_CREATE_CONFIRMATION}`;
  }
  return CREATE_CONFIRMATION_LEGACY;
}
