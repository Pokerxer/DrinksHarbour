'use client';

import { Badge } from 'rizzui';

/**
 * Catalogue publication scope (see server/constants/catalogScope.js).
 * `canonical` — the identity is visible on DrinksHarbour marketplace surfaces.
 * `tenant_private` — a tenant-submitted product that is sellable in their own
 * channels but invisible on marketplace surfaces until a super-admin approves
 * it (approving is one and the same as promoting it to canonical).
 *
 * Legacy products predate the field (undefined) and must render nothing, so
 * existing tenants see zero visual change.
 */
export type PublicationScope = 'canonical' | 'tenant_private';

interface PublicationScopeTagProps {
  publicationScope?: string | null;
  /** Owning tenant display name, when the endpoint populated it. */
  owningTenantName?: string | null;
}

/** Renders nothing unless the product carries an explicit publication scope. */
export default function PublicationScopeTag({
  publicationScope,
  owningTenantName,
}: PublicationScopeTagProps) {
  if (publicationScope === 'tenant_private') {
    return (
      <Badge
        color="warning"
        variant="flat"
        className="max-w-full font-semibold"
        title="Store-only: sellable in the owning business's store until a super-admin approves it for the marketplace"
      >
        Store-only{owningTenantName ? ` · ${owningTenantName}` : ''}
      </Badge>
    );
  }
  if (publicationScope === 'canonical') {
    return (
      <Badge
        color="secondary"
        variant="flat"
        className="max-w-full font-semibold"
        title="Visible to every business on the DrinksHarbour marketplace"
      >
        Marketplace
      </Badge>
    );
  }
  return null;
}

/** Approve/remove ambiguity: only tenant-private rows need the promotion wording. */
export function getApproveCopy(publicationScope?: string | null): {
  label: string;
  explanation: string | null;
} {
  if (publicationScope === 'tenant_private') {
    return {
      label: 'Approve & publish to marketplace',
      explanation:
        'Approving makes this tenant’s store-only product visible on DrinksHarbour marketplace surfaces. Payout and commission rules are unchanged.',
    };
  }
  // Legacy pending rows keep today's plain copy with no extra explanation.
  return { label: 'Approved', explanation: null };
}
