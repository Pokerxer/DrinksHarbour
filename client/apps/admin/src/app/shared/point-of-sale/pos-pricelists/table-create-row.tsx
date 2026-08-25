'use client';

import React from 'react';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';

interface Props {
  newName: string;
  onNameChange(v: string): void;
  onCreate(): void;
  onCancel(): void;
}

/** Inline "new pricelist" row at the top of the table body. */
export default function TableCreateRow({
  newName,
  onNameChange,
  onCreate,
  onCancel,
}: Props) {
  return (
    <tr className="border-b border-gray-100 bg-[#b20202]/5">
      <td className="px-2 py-2.5" />
      <td className="px-1 py-2.5" />
      <td className="px-3 py-2.5" colSpan={5}>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            aria-label="New pricelist name"
            value={newName}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreate();
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="New pricelist name…"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#b20202]"
          />
          <button
            type="button"
            onClick={onCreate}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
            style={{ backgroundColor: BRAND }}
          >
            Create
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </td>
      <td className="px-2 py-2.5" />
    </tr>
  );
}
