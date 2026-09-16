'use client';

import { PiX } from 'react-icons/pi';

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#b20202]/20 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[#b20202]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-red-100"
      >
        <PiX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}