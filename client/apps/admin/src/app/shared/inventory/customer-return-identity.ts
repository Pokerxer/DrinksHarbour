// Variant-identity labels for the customer returns surfaces (DRI-34).
//
// The backend browse/evidence pipeline emits the stored `size` string and —
// only when the lookup Size itself carries colour/option identity — the
// additive fields `colorName/colorHexCode/optionName` (emit-only-with-identity,
// DRI-16/DRI-29 precedent). Compose the shared full label when the identity is
// present; legacy/identity-less rows resolve to the exact stored `row.size`
// bytes. The PRINT document keeps stored snapshot bytes (recorded decision 2,
// pricelist/so-print/bill-print precedent) and must never see these helpers.

import type { CustomerReturn } from '@/services/customerReturns.service';
import { flatRowSizeLabel } from '@/utils/size-variant-label';

export function customerReturnSizeLabel(row: CustomerReturn): string {
  return flatRowSizeLabel({
    sizeName: row.size,
    colorName: row.colorName ?? null,
    optionName: row.optionName ?? null,
  });
}

/**
 * Restock-target display. Surfaced ONLY when the row exposes the exact Size
 * target. Today's backend payload carries no restock-target field (the
 * restock lever is the POS returns flow) — this stays a documented contract
 * gap with no invented placeholder: the function resolves to null until the
 * backend slice starts emitting `restockSizeName`/`restockSizeId`.
 */
export function restockTargetLabel(row: CustomerReturn): string | null {
  return row.restockSizeName || null;
}
