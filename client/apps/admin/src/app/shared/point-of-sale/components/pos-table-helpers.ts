import type { POSTableSummary, TableStatus } from '../types';

/** Tailwind classes per table status for strip chips and map tiles. */
export function tableStatusClasses(status: TableStatus): string {
  switch (status) {
    case 'occupied':
      return 'border-red-300 bg-red-50 text-red-700';
    case 'reserved':
      return 'border-amber-300 bg-amber-50 text-amber-700';
    case 'inactive':
      return 'border-gray-200 bg-gray-100 text-gray-400 opacity-60';
    default:
      return 'border-gray-200 bg-white text-gray-700 hover:border-[#b20202] hover:text-[#b20202]';
  }
}

/** Group tables by section preserving sortOrder then name within each group. */
export function groupTablesBySection(
  tables: POSTableSummary[]
): Array<{ section: string; tables: POSTableSummary[] }> {
  const bySection = new Map<string, POSTableSummary[]>();
  for (const t of [...tables].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  )) {
    const key = t.section || 'Main';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(t);
  }
  return Array.from(bySection.entries()).map(([section, ts]) => ({
    section,
    tables: ts,
  }));
}

/** "12m" / "1h 05m" elapsed label for an occupied tab's openedAt. */
export function tabElapsedLabel(openedAt?: string, now = new Date()): string {
  if (!openedAt) return '';
  const mins = Math.max(
    0,
    Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000)
  );
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

// ─── Kitchen fire flow (client side) ─────────────────────────────────────────

/** One line of the cart's local mirror of a tab's fired kitchen rounds. */
export interface FiredEntry {
  key: string;
  qty: number;
  roundNo: number;
}

/** Structural minimum a cart line needs for its server-compatible key. */
export interface KeyedLine {
  subProductId: string;
  sizeId?: string;
  comboRef?: { instanceId: string };
  bxgyRef?: { rewardId: string; role: string };
}

/**
 * Identity of one cart line — byte-compatible with the server's
 * buildPosItemKey (pos.controller.js). Single source for React keys, the
 * dialpad selection and the send-to-kitchen payload.
 */
export function posItemKey(i: KeyedLine): string {
  const base = i.sizeId ? `${i.subProductId}_${i.sizeId}` : i.subProductId;
  if (i.comboRef?.instanceId) return `${base}__ci_${i.comboRef.instanceId}`;
  if (i.bxgyRef?.rewardId)
    return `${base}__bxgy_${i.bxgyRef.rewardId}_${i.bxgyRef.role}`;
  return base;
}

/**
 * What of the cart has not gone to the kitchen yet, mirroring the server's
 * computeUnfiredLines: per line key, quantity remaining after netting every
 * fired round; fully-consumed lines drop out. `firedLog` is the local mirror
 * kept on the table binding — absent (legacy carts) means nothing fired.
 */
export function computeUnfiredLocal<T extends KeyedLine & { quantity: number }>(
  items: T[],
  itemKeyOf: (i: T) => string,
  firedLog: FiredEntry[] | undefined
): Array<{ item: T; key: string; remaining: number }> {
  const rounds = Array.isArray(firedLog) ? firedLog : [];
  const firedByKey = new Map<string, number>();
  for (const e of rounds) {
    firedByKey.set(e.key, (firedByKey.get(e.key) ?? 0) + (Number(e.qty) || 0));
  }
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const key = itemKeyOf(item);
      const remaining = Math.max(
        0,
        (Number(item.quantity) || 0) - (firedByKey.get(key) ?? 0)
      );
      return { item, key, remaining };
    })
    .filter((l) => l.remaining > 0);
}
