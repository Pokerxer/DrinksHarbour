'use client';

// app/shared/warehouses/warehouse-analysis/filter-chips.tsx
// Applied-filter chips + the applied-favorite name + Clear all.

import { PiStar, PiX } from 'react-icons/pi';

export default function FilterChips({
  chips,
  appliedSearchName,
  onRemove,
  onClearAll,
}: {
  chips: { key: string; label: string }[];
  appliedSearchName: string | null;
  onRemove: (key: string) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0 && !appliedSearchName) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {appliedSearchName && (
        <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <PiStar className="h-3 w-3" />
          {appliedSearchName}
        </span>
      )}
      {chips.map(({ key, label }) => (
        <span
          key={key}
          className="bg-[#b20202]/8 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-[#b20202]"
        >
          {label}
          <button
            type="button"
            onClick={() => onRemove(key)}
            aria-label={`Remove filter ${label}`}
            className="hover:text-[#7a0101]"
          >
            <PiX className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
