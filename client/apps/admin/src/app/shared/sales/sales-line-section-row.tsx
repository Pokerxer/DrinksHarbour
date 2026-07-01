// client/apps/admin/src/app/shared/sales/sales-line-section-row.tsx
'use client';

import type { ReactNode } from 'react';
import { PiTrash } from 'react-icons/pi';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import type { PricedLine } from './sales-line-table';

const TITLE_CLS =
  'w-full border-0 border-b border-transparent bg-transparent px-1 py-1 text-sm font-bold text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-0';

export interface SalesLineSectionRowProps {
  line: PricedLine;
  /** Sum of lineTotal for product lines between this section and the next. */
  subtotal: number;
  currency?: string;
  onUpdate: (key: string, patch: Partial<PricedLine>) => void;
  onRemove: (key: string) => void;
  /** Drag handle element rendered in the leading cell (dnd-kit listeners). */
  dragHandle?: ReactNode;
}

/**
 * Section-header row cells (no <tr> — the sortable parent supplies it): an
 * editable bold title on the left and the section's running subtotal on the
 * right. No qty/price/tax cells. Excluded from order totals; its subtotal is
 * derived from the product lines beneath it (computed by the parent table).
 */
export default function SalesLineSectionRow({
  line,
  subtotal,
  currency = 'NGN',
  onUpdate,
  onRemove,
  dragHandle,
}: SalesLineSectionRowProps) {
  return (
    <>
      <td className="w-6 bg-gray-50/70 px-1 py-2 align-middle">{dragHandle}</td>
      <td colSpan={6} className="bg-gray-50/70 px-2 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={line.name}
            onChange={(e) => onUpdate(line.key, { name: e.target.value })}
            placeholder="Section title"
            className={TITLE_CLS}
          />
        </div>
      </td>
      <td className="bg-gray-50/70 px-2 py-2 text-right align-top">
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs font-medium text-gray-500">
            Subtotal {fmtCur(subtotal, currency)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(line.key)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <PiTrash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </>
  );
}