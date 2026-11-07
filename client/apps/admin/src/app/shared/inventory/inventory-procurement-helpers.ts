// Procurement row helpers (DRI-34). The Raise PO hand-off forwards exactly the
// identity pair the /purchases verified pickers already expect (subProductId +
// sizeId) as query state — picker logic itself is NOT duplicated here; the
// /purchases surfaces consume it. Rows without an exact Size (legacy
// SubProduct-aggregate suggestions) render no hand-off, mirroring
// emit-only-with-identity.

import { routes } from '@/config/routes';
import type { ReorderSuggestion } from '@/services/reorder.service';

export function raisePoQuery(s: ReorderSuggestion): URLSearchParams {
  const query = new URLSearchParams({ subProduct: s.subProductId });
  if (s.sizeId) query.set('size', s.sizeId);
  return query;
}

export function raisePoHref(s: ReorderSuggestion): string {
  return `${routes.eCommerce.createPurchase}?${raisePoQuery(s).toString()}`;
}
