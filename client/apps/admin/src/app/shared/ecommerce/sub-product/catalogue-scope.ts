// Catalogue-scope helpers for the tenant Sub-Product surfaces.
//
// A central Product can carry `publicationScope: 'tenant_private'`: it sells
// in the owner tenant's store immediately while DrinksHarbour still reviews
// its marketplace publication (mirrors server/constants/catalogScope.js).
// Legacy rows have NO publicationScope field and read as canonical, so every
// helper here stays silent for them — flag off (or a server payload that does
// not include the field yet) must produce ZERO visual change on tenant pages.
//
// This module stays UI-free and server-free: pure predicates and copy, unit
// tested in ./catalogue-scope.test.ts. It never reads or surfaces owningTenant.

export type CentralPublicationScope = 'tenant_private' | 'canonical';

/**
 * Only an EXPLICIT `tenant_private` field counts as private. Missing, null or
 * unknown values mean legacy-canon → render nothing / keep existing copy.
 */
export function isTenantPrivateProduct(
  centralProduct: { publicationScope?: string } | null | undefined
): boolean {
  return centralProduct?.publicationScope === 'tenant_private';
}

/** List/detail chip: short label with the fuller note shown as its title. */
export const TENANT_PRIVATE_IDENTITY_LABEL = 'Private identity';
export const TENANT_PRIVATE_IDENTITY_NOTE =
  'Sellable in your store now; marketplace publication pending review';

/** Picker row badge when a matched central identity is the tenant's own. */
export const TENANT_PRIVATE_MATCH_NOTE =
  'Sellable now · marketplace review pending';
