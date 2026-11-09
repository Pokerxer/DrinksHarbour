// app/shared/purchases/stock-transfer-lines.ts
//
// Pure line-list behaviour behind the stock-transfer create/edit form — no
// React, no I/O — so the transfers action bar ("Add a product / section /
// note / Catalogue / Scan & Match") keeps the same guarantees as the
// purchase-order forms:
//   - section/note lines are presentation lines: no product, no quantity, no
//     money; excluded from totals, dispatch, receiving, shortfalls, returns,
//   - the save payload never sends an empty presentation line or an unsaved
//     empty product row.
// Transfers differ from POs enough to warrant their own mappers (the wire
// field names differ — subProductName/costPrice/packSize — and a transfer
// line carries no packQty/packPrice), but they share the presentation-line
// helpers with the PO forms.

import { lineTypeOf, type PurchaseLineType } from './purchases-create-lines';

export type TransferLineType = PurchaseLineType;

/** Structural shape of a transfer line (LineItem in stock-transfer-create). */
export interface TransferLine {
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  costPrice: number;
  discountRate: number;
  taxRate: number;
  packSize: number;
  costSourcePrice: number;
  wholesalePrice: number;
  lineType?: TransferLineType;
  /** Section heading text (lineType 'section'). */
  name?: string;
  /** Note body (lineType 'note'). */
  description?: string;
}

const PRESENTATION_FIELD: Record<'section' | 'note', 'name' | 'description'> =
  { section: 'name', note: 'description' };

function zeroedPresentation(line: TransferLine): Record<string, unknown> {
  const type = lineTypeOf(line);
  return {
    lineType: type,
    name: type === 'section' ? line.name : undefined,
    description: type === 'note' ? line.description : undefined,
    sku: '',
    quantity: 0,
    costPrice: 0,
    discountRate: 0,
    taxRate: 0,
    packSize: 1,
  };
}

/**
 * Build the stock-transfer `items` payload from the editable line list. Same
 * rules as the PO forms' payload builder: unsaved empty product rows and
 * empty presentation rows are dropped; product lines keep the legacy wire
 * shape; presentation lines ride along zeroed. Order is preserved.
 */
export function transferPayloadLines(
  lines: TransferLine[],
): Record<string, unknown>[] {
  return lines.flatMap((line) => {
    const type = lineTypeOf(line);
    if (type !== 'product') {
      const field = PRESENTATION_FIELD[type];
      if (!String((line[field] as string) || '').trim()) return [];
      return [zeroedPresentation(line)];
    }
    if (!line.subProductId.trim()) return [];
    const { lineType: _lt, name: _n, description: _d, ...wire } = line;
    return [
      {
        ...wire,
        lineType: 'product' as const,
      },
    ];
  });
}

/**
 * Merge accepted Scan & Match rows into the transfer's line list. Transfers
 * seed themselves with one blank line — trailing untouched blanks are
 * dropped, but a blank sitting *between* filled lines (the buyer's spacer)
 * and any presentation line survive. No pack re-derivation needed: a
 * transfer's payload passes quantities straight through.
 */
export function appendTransferScannedLines<
  T extends TransferLine,
>(
  items: T[],
  /**
   * Accepted scan rows — the scan wire shape (`PurchaseLineDraft`) is a
   * subset of the pick-side catalogue (`costPrice`/`sizeId` carry), but
   * prices arrive on `unitPrice`. The merge seeds the transfer line's
   * cost from whichever the draft carries.
   */
  drafts: Array<Partial<T> & { unitPrice?: number }>,
  blank: (type?: TransferLineType) => T
): T[] {
  if (drafts.length === 0) return items;

  const kept = [...items];
  while (kept.length > 0) {
    const last = kept[kept.length - 1];
    if (lineTypeOf(last) !== 'product') break;
    if (last.subProductName.trim() || last.subProductId.trim()) break;
    kept.pop();
  }

  const added = drafts.map((d) => {
    const line = { ...blank(), ...d } as T;
    // Scan drafts are priced in the scan wire's `unitPrice` — for a transfer
    // that lands on costPrice (the Cost toggle re-seeds from the snapshot).
    const merged = line as unknown as Record<string, unknown>;
    if (
      merged.costPrice === undefined ||
      (Number(merged.costPrice) === 0 && 'unitPrice' in d && d.unitPrice != null)
    ) {
      line.costPrice = Number(d.unitPrice) || line.costPrice;
    }
    // A scanned row's price IS its cost price: the Cost toggle re-seeds from
    // costSourcePrice, so the pick's snapshot must be set too.
    if (!(Number(line.costSourcePrice) > 0)) line.costSourcePrice = line.costPrice;
    return line;
  });

  return [...kept, ...added];
}
