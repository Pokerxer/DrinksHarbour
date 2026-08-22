// app/shared/purchases/purchases-scan-selection.ts
//
// The one place where the shared Scan & Match payload is adapted to purchasing.
//
// The scan API (`server/services/scanMatch.service.js`) is domain-neutral: it
// extracts items from a photo / document / pasted list and matches them to the
// catalogue, returning BOTH the selling price and the cost price for every
// size. Sales reads `sellingPrice`; a purchase order is what we PAY, so this
// module reads `costPrice` and maps `unitsPerPack` onto the PO line's
// `packSize`. Keeping that inversion here — pure, no React, no I/O — is what
// makes it testable and keeps it from being re-derived in each drawer.

import type { ScanResultItem } from '@/services/scan.service';

/** A manual pick from the catalogue search, when the AI got it wrong. */
export interface PurchaseLineOverride {
  subProductId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  packSize: number;
  sizeId?: string;
  sizeName?: string;
  taxRate?: number;
}

/** The subset of a purchases `LineItem` a scanned row can populate. The create
 *  and edit forms spread this over their own blank line. */
export interface PurchaseLineDraft {
  subProductId: string;
  productName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  packSize: number;
  unitPrice: number;
  taxRate: number;
}

export interface ScanRowReview {
  /** The size the operator has selected in the review list, if any. */
  sizeId: string | null;
  /** The quantity the operator has settled on — not the extracted one. */
  qty: number;
  /** Set when the operator overrode the AI match by hand. */
  override?: PurchaseLineOverride;
}

/**
 * Turn one reviewed scan row into a purchase-order line.
 *
 * Returns `null` when the row has nothing to add — no manual override and no
 * usable match. `scanMatch` can attach near-miss candidates to a `confidence:
 * 'none'` verdict, so a sub-product being present is not on its own consent to
 * put it on the PO; the confidence check has to come first.
 */
export function scanRowToPurchaseLine(
  item: ScanResultItem,
  review: ScanRowReview
): PurchaseLineDraft | null {
  const quantity = Math.max(1, review.qty);

  if (review.override) {
    const o = review.override;
    return {
      subProductId: o.subProductId,
      productName: o.productName,
      sku: o.sku,
      sizeId: o.sizeId,
      sizeName: o.sizeName,
      quantity,
      packSize: o.packSize > 0 ? o.packSize : 1,
      unitPrice: o.unitPrice,
      taxRate: o.taxRate ?? 0,
    };
  }

  const sp = item.matchedSubProducts[0];
  if (!sp || item.confidence === 'none') return null;

  const baseName = item.matchedProductName ?? item.extractedName;
  const size = sp.sizes.find((s) => s.size === review.sizeId);

  if (!size) {
    return {
      subProductId: sp._id,
      productName: baseName,
      sku: sp.sku,
      quantity,
      packSize: 1,
      unitPrice: sp.costPrice,
      taxRate: sp.taxRate,
    };
  }

  const sizeName = size.displayName ?? size.size;
  return {
    subProductId: sp._id,
    productName: `${baseName} – ${sizeName}`,
    sku: size.sku ?? sp.sku,
    sizeId: size.size,
    sizeName,
    quantity,
    // A size row that predates `unitsPerPack` arrives undefined, and a 0 would
    // divide-by-zero the PO form's pack totals.
    packSize:
      size.unitsPerPack && size.unitsPerPack > 0 ? size.unitsPerPack : 1,
    // Mirrors the sub-product fallback the sales drawer uses for selling price:
    // a Size row whose cost was never filled in falls back to the parent's.
    unitPrice: size.costPrice || sp.costPrice,
    taxRate: sp.taxRate,
  };
}

/**
 * Merge scanned lines into a PO's existing line list.
 *
 * Both the create and edit forms seed themselves with one empty line, so a
 * straight append would leave a phantom row behind — and an unlinked row trips
 * the "isn't linked to a catalog product" guard on save. Trailing blanks are
 * therefore dropped; a blank sitting *between* two filled lines is the buyer's
 * deliberate spacer and is left alone.
 *
 * `packPrice`/`packQty` are derived here exactly as the forms' own `updateItem`
 * derives them, so a scanned line and a typed line are indistinguishable.
 */
export function appendScannedLines<
  T extends {
    productName: string;
    packSize: number;
    packQty: number;
    quantity: number;
    unitPrice: number;
    packPrice: number;
  },
>(items: T[], drafts: PurchaseLineDraft[], blank: () => T): T[] {
  if (drafts.length === 0) return items;

  const kept = [...items];
  while (kept.length > 0 && !kept[kept.length - 1].productName.trim()) {
    kept.pop();
  }

  const added = drafts.map((d) => {
    const line = { ...blank(), ...d } as T;
    line.packPrice = line.unitPrice * line.packSize;
    line.packQty = Math.ceil(line.quantity / Math.max(1, line.packSize));
    return line;
  });

  return [...kept, ...added];
}

/** Cost price to show against a row in the review list, before it is added. */
export function scanRowCostPrice(
  item: ScanResultItem,
  sizeId: string | null,
  override?: PurchaseLineOverride
): number {
  if (override) return override.unitPrice;
  const sp = item.matchedSubProducts[0];
  if (!sp) return 0;
  const size = sp.sizes.find((s) => s.size === sizeId);
  return size ? size.costPrice || sp.costPrice : sp.costPrice;
}
