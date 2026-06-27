// client/apps/admin/src/app/shared/sales/sales-line-read-rows.tsx
'use client';

import { fmtCur } from '../purchases/purchases-analytics-helpers';
import type { SalesLineItem } from '@/services/salesOrder.service';

/** True for section or note lines (everything that isn't a priced product line). */
export function isNonProductLine(item: SalesLineItem): boolean {
  return item.lineType === 'section' || item.lineType === 'note';
}

/**
 * Compute per-section subtotals from an ordered items array: a map of line `_id`
 * → sum of lineTotal for product lines beneath that section until the next
 * section (or end). Used by read-side views to show section subtotals.
 */
export function sectionSubtotals(items: SalesLineItem[]): Map<string, number> {
  const out = new Map<string, number>();
  let cur: string | null = null;
  for (const it of items) {
    if (it.lineType === 'section') {
      cur = it._id;
      out.set(cur, 0);
      continue;
    }
    if (it.lineType !== 'product') continue;
    if (cur) out.set(cur, (out.get(cur) ?? 0) + (it.lineTotal || 0));
  }
  return out;
}

/**
 * Render a section or note line as a full-width table row (colSpan = cols).
 * Section rows show the title + a right-aligned subtotal; note rows show the
 * note text in muted styling. Returns null for product lines (caller renders
 * those itself). `cols` must match the table's column count.
 */
export function NonProductLineRow({
  item,
  cols,
  subtotal,
  currency = 'NGN',
}: {
  item: SalesLineItem;
  cols: number;
  subtotal?: number;
  currency?: string;
}) {
  if (item.lineType === 'section') {
    return (
      <tr className="bg-gray-50/70">
        <td colSpan={cols - 1} className="px-4 py-2.5 text-sm font-bold text-gray-900">
          {item.name || 'Section'}
        </td>
        <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
          {typeof subtotal === 'number' ? `Subtotal ${fmtCur(subtotal, currency)}` : ''}
        </td>
      </tr>
    );
  }
  if (item.lineType === 'note') {
    return (
      <tr>
        <td colSpan={cols} className="bg-amber-50/40 px-4 py-2 text-xs text-gray-600">
          {item.description || ''}
        </td>
      </tr>
    );
  }
  return null;
}