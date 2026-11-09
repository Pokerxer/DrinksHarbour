// app/shared/purchases/purchases-create-lines.ts
//
// Pure line-list behaviour behind the purchases create form's (and edit
// form's) line editor — no React, no I/O — so the actions row
// ("Add a product / section / note / Catalogue / Scan & Match") can keep the
// same guarantees the sales create form has:
//   - section/note lines ("Add a section"/"Add a note") are presentation lines:
//     no product, no qty, no price, excluded from totals,
//   - a section's running subtotal is derived from the product lines beneath
//     it (until the next section),
//   - the save payload never sends an empty presentation line or an unsaved
//     empty product row.
import { linePackSize } from './types';

export type PurchaseLineType = 'product' | 'section' | 'note';

/**
 * Structural shape of a create-form purchase line. LineItem in
 * purchases-create.tsx structurally satisfies this; keeping the pure helpers
 * structural makes them reusable by purchases-edit without a coupling.
 */
export interface PurchaseLine {
  subProductId: string;
  productName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  packaging?: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  packPrice: number;
  taxRate: number;
  lineType?: PurchaseLineType;
  /** Section heading text (lineType 'section'). */
  name?: string;
  /** Note body (lineType 'note'). */
  description?: string;
}

export function lineTypeOf(
  line: { lineType?: PurchaseLineType } | undefined
): PurchaseLineType {
  const t = (line?.lineType ?? 'product') as PurchaseLineType;
  return t === 'section' || t === 'note' ? t : 'product';
}

const PRESENTATION_FIELD: Record<'section' | 'note', 'name' | 'description'> = {
  section: 'name',
  note: 'description',
};

/** The bare contract shared by any line list using presentation lines. */
export interface PresentationLineShape {
  subProductId: string;
  lineType?: PurchaseLineType;
  name?: string;
  description?: string;
}

/**
 * Append a presentation line while keeping an unfinished trailing product row
 * *after* it — the buyer's half-typed row must not get orphaned above the new
 * heading/note. Mirrors sales' appendPresentationLine semantics. Works for any
 * line list whose product lines carry a catalog reference (purchase orders and
 * stock transfers both do).
 */
export function appendPresentationLine<T extends PresentationLineShape>(
  lines: T[],
  type: 'section' | 'note',
  blankOf: (type: 'section' | 'note') => T,
): T[] {
  const last = lines[lines.length - 1];
  if (last && lineTypeOf(last) === 'product' && !last.subProductId) {
    return [...lines.slice(0, -1), blankOf(type), last];
  }
  return [...lines, blankOf(type)];
}

/**
 * Map of section-line key → sum of `subtotalOf` for the product lines beneath
 * it until the next section (or end). Lines before the first section are
 * ignored. Keyed by the line object itself so reordering stays correct
 * regardless of what the caller uses as React key.
 */
export function computeSectionSubtotals<T extends PresentationLineShape>(
  lines: T[],
  subtotalOf: (line: T) => number,
): Map<T, number> {
  const out = new Map<T, number>();
  let current: T | null = null;
  for (const line of lines) {
    const t = lineTypeOf(line);
    if (t === 'section') {
      current = line;
      out.set(current, 0);
      continue;
    }
    if (t !== 'product') continue;
    if (current) {
      out.set(current, (out.get(current) ?? 0) + subtotalOf(line));
    }
  }
  return out;
}
/** Catalogue quantity-map key: `subProductId|sizeId` (empty size = sizeless line). */
export function catalogLineKey(subProductId: string, sizeId?: string): string {
  return `${subProductId}|${sizeId ?? ''}`;
}

/** Lines already in the form keyed the way the catalogue modal reports them. */
export function catalogQtyMap(
  lines: PurchaseLine[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const line of lines) {
    if (lineTypeOf(line) !== 'product' || !line.subProductId) continue;
    map[catalogLineKey(line.subProductId, line.sizeId)] = line.quantity;
  }
  return map;
}

function zeroedPresentation(line: PurchaseLine): Record<string, unknown> {
  const type = lineTypeOf(line);
  return {
    lineType: type,
    name: type === 'section' ? line.name : undefined,
    description: type === 'note' ? line.description : undefined,
    sku: '',
    quantity: 0,
    packSize: 1,
    packQty: 0,
    unitPrice: 0,
    unitCost: 0,
    packPrice: 0,
    packagingQty: 1,
    receivedQty: 0,
    totalCost: 0,
  };
}

/**
 * Derive packPrice/packQty exactly as the create/edit forms' `updateItem`
 * does, so a catalogue line and a typed line are indistinguishable on save.
 */
export function derivePurchasePack<T extends PurchaseLine>(line: T): T {
  return {
    ...line,
    packPrice: line.unitPrice * line.packSize,
    packQty: Math.ceil(line.quantity / Math.max(1, line.packSize)),
  };
}

/**
 * A catalogue pick becomes a scanned-line-shaped purchase line: cost seeds the
 * Unit Price; the picked size's units-per-pack seeds Pack Size. The wire shape
 * is `PurchaseLineDraft` (purchases-scan-selection), so both forms can run it
 * through appendScannedLines like any accepted scan row.
 */
export function catalogDraftFromSelection(
  info: {
    name: string;
    sku: string;
    subProductId: string;
    sizeId?: string;
    sizeName?: string;
    packaging?: string;
    costPrice: number;
    taxRate?: number;
    unitsPerPack?: number;
  },
  quantity: number
): Omit<PurchaseLine, 'packPrice' | 'packQty'> {
  return {
    subProductId: info.subProductId,
    productName: info.name,
    sku: info.sku,
    sizeId: info.sizeId,
    sizeName: info.sizeName,
    packaging: info.packaging,
    quantity,
    packSize: Math.max(1, Math.floor(info.unitsPerPack ?? 1)),
    unitPrice: info.costPrice,
    taxRate: info.taxRate ?? 0,
  };
}

/**
 * Build the purchase-order `items` payload from the editable line list:
 *  - unsaved empty product rows are dropped,
 *  - empty presentation rows (never named / never written) are dropped,
 *  - product lines keep the legacy wire aliases (subProductName, unitCost,
 *    packagingQty, receivedQty, totalCost),
 *  - presentation lines are zeroed so receiving/billing never sees them.
 * Order is preserved (sections/notes interleave with products exactly as edited).
 */
export function purchasePayloadLines(
  lines: PurchaseLine[],
): Record<string, unknown>[] {
  return lines.flatMap((line) => {
    const type = lineTypeOf(line);
    if (type !== 'product') {
      const field = PRESENTATION_FIELD[type];
      if (!String((line[field] as string) || '').trim()) return [];
      return [zeroedPresentation(line)];
    }
    if (!line.productName.trim()) return [];
    const {
      // Presentation-only fields never reach product payloads.
      lineType: _lineType,
      name: _name,
      description: _description,
      ...productWire
    } = line;
    return [
      {
        ...productWire,
        lineType: 'product',
        subProductName: line.productName,
        unitCost: line.unitPrice,
        packagingQty: linePackSize({ packSize: line.packSize }),
        receivedQty: 0,
        totalCost: line.unitPrice * line.quantity,
      },
    ];
  });
}
