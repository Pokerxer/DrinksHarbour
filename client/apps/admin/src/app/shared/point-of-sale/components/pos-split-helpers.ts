import type { POSCartItem } from '../types';
import { posItemKey } from './pos-table-helpers';

// ─── Split-bill allocation engine ─────────────────────────────────────────────
// Pure module — no React, no store imports. Pricing never lives here: the
// caller injects a unit-price accessor (e.g. getEffectiveBundlePriceForItem)
// wherever value ordering matters.

/**
 * One payer's share of the bill. `itemRefs` holds posItemKey values (byte-
 * compatible with the server's buildPosItemKey).
 *
 * Equal-split deals WHOLE UNITS round-robin, so one cart line can land on
 * several payers (5×Heineken → 2/2/1). `qtys` records the exact units each
 * payer receives; it is absent for by-item mode, where assignment is whole-
 * line and payload quantities come straight off the cart line.
 */
export interface PayerGroup {
  id: string;
  label: string;
  itemRefs: string[];
  /** ref → units allocated to THIS payer. Omitted ⇒ whole-line semantics. */
  qtys?: Record<string, number>;
}

/** A payer's chargeable subset, ready for buildOrderPayload/createOrderOffline. */
export interface SplitOrderPayload {
  group: PayerGroup;
  items: POSCartItem[];
}

/**
 * Deal whole units round-robin across payers from the highest unit price down,
 * so each payer's goods total approximates total ÷ N without ever dividing
 * money. Every unit is allocated exactly once (Σ group quantities === original);
 * ties break by original line order so output is deterministic. Trailing payers
 * stay empty when there are fewer units than payers — callers clamp the count.
 */
export function splitEqually<
  T extends { quantity: number; price?: number },
>(
  items: T[],
  itemKeyOf: (i: T) => string,
  payerCount: number,
  unitPriceOf: (i: T) => number = (i) => i.price ?? 0
): PayerGroup[] {
  const n = Math.max(1, Math.floor(payerCount));
  const groups: PayerGroup[] = Array.from({ length: n }, (_, i) => ({
    id: `payer-${i + 1}`,
    label: `Payer ${i + 1}`,
    itemRefs: [],
  }));
  const acc: Map<string, number>[] = groups.map(() => new Map());

  const sorted = (Array.isArray(items) ? items : [])
    .map((item, idx) => ({ item, idx }))
    .sort(
      (a, b) => unitPriceOf(b.item) - unitPriceOf(a.item) || a.idx - b.idx
    );

  let dealt = 0;
  for (const { item } of sorted) {
    const ref = itemKeyOf(item);
    const units = Math.max(0, Math.floor(item.quantity) || 0);
    for (let u = 0; u < units; u++) {
      const g = dealt % n;
      acc[g].set(ref, (acc[g].get(ref) ?? 0) + 1);
      dealt++;
    }
  }

  groups.forEach((g, i) => {
    g.itemRefs = Array.from(acc[i].keys());
    if (g.itemRefs.length) g.qtys = Object.fromEntries(acc[i]);
  });
  return groups;
}

/**
 * Guard for by-item/manual allocations before settlement: nothing assigned →
 * fail; a ref over-allocated (two whole-line owners, or equal-style quantities
 * beyond the line's own quantity) → fail; with `requireFullCoverage` (settle
 * all) every cart unit must be claimed. Partial coverage is allowed when the
 * cashier opts to settle selected lines only.
 */
export function validateGroups(
  groups: PayerGroup[],
  itemKeyOf: (i: POSCartItem) => string,
  items: POSCartItem[],
  opts: { requireFullCoverage?: boolean } = {}
): { ok: boolean; error?: string } {
  const { requireFullCoverage = true } = opts;
  const safeGroups = Array.isArray(groups) ? groups : [];
  const lineByRef = new Map(
    (Array.isArray(items) ? items : []).map((i) => [itemKeyOf(i), i] as const)
  );

  const alloc = new Map<string, { qty: number; groups: number }>();
  for (const g of safeGroups) {
    for (const ref of g.itemRefs ?? []) {
      const rec = alloc.get(ref) ?? { qty: 0, groups: 0 };
      rec.groups += 1;
      rec.qty += g.qtys ? g.qtys[ref] ?? 0 : lineByRef.get(ref)?.quantity ?? 0;
      alloc.set(ref, rec);
    }
  }

  if (!Array.from(alloc.values()).some((r) => r.qty > 0))
    return { ok: false, error: 'Assign at least one item to a payer.' };

  const usesQtys = safeGroups.some((g) => g.qtys != null);
  for (const [ref, rec] of Array.from(alloc.entries())) {
    const line = lineByRef.get(ref);
    if (!line) continue; // unknown refs are dropped downstream
    if (rec.qty > line.quantity) {
      return {
        ok: false,
        error: usesQtys
          ? `Allocation for ${ref} exceeds the line quantity (${rec.qty} of ${line.quantity} units).`
          : `${ref} is assigned more than once.`,
      };
    }
  }

  if (requireFullCoverage) {
    for (const [ref, line] of Array.from(lineByRef.entries())) {
      if ((alloc.get(ref)?.qty ?? 0) < line.quantity)
        return { ok: false, error: `${ref} is not fully assigned to a payer.` };
    }
  }

  return { ok: true };
}

/**
 * Map each group's refs back onto the live cart lines: whole-line quantities
 * in by-item mode, the group's allocated units in equal mode. Refs matching no
 * current line (cart changed mid-edit) are skipped rather than guessed.
 */
export function groupsToOrderPayloads(
  groups: PayerGroup[],
  items: POSCartItem[]
): SplitOrderPayload[] {
  const byKey = new Map(
    (Array.isArray(items) ? items : []).map((i) => [posItemKey(i), i] as const)
  );
  return (Array.isArray(groups) ? groups : []).map((group) => {
    const out: POSCartItem[] = [];
    for (const ref of group.itemRefs ?? []) {
      const line = byKey.get(ref);
      if (!line) continue;
      out.push({ ...line, quantity: group.qtys?.[ref] ?? line.quantity });
    }
    return { group, items: out };
  });
}
