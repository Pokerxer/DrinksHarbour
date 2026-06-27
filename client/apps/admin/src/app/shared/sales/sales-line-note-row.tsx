// client/apps/admin/src/app/shared/sales/sales-line-note-row.tsx
'use client';

import type { ReactNode } from 'react';
import { PiTrash } from 'react-icons/pi';
import type { PricedLine } from './sales-line-table';

const NOTE_CLS =
  'w-full resize-y border-0 bg-transparent px-1 py-1 text-xs text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-0';

export interface SalesLineNoteRowProps {
  line: PricedLine;
  onUpdate: (key: string, patch: Partial<PricedLine>) => void;
  onRemove: (key: string) => void;
  /** Drag handle element rendered in the leading cell (dnd-kit listeners). */
  dragHandle?: ReactNode;
}

/**
 * Note row cells (no <tr> — the sortable parent supplies it): an editable
 * free-text note that prints on the quote/order but carries no product, qty,
 * or price. Excluded from totals.
 */
export default function SalesLineNoteRow({
  line,
  onUpdate,
  onRemove,
  dragHandle,
}: SalesLineNoteRowProps) {
  return (
    <>
      <td className="w-6 bg-amber-50/40 px-1 py-1.5 align-middle">{dragHandle}</td>
      <td colSpan={6} className="bg-amber-50/40 px-2 py-1.5">
        <textarea
          value={line.description ?? ''}
          onChange={(e) => onUpdate(line.key, { description: e.target.value })}
          placeholder="Add a note…"
          rows={1}
          className={NOTE_CLS}
        />
      </td>
      <td className="bg-amber-50/40 px-2 py-1.5 text-right align-top">
        <button
          type="button"
          onClick={() => onRemove(line.key)}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <PiTrash className="h-4 w-4" />
        </button>
      </td>
    </>
  );
}