'use client';
import React from 'react';
import { ORDER_STATUSES } from '../_constants';

interface StatusFilterProps {
  active: string;
  counts: Record<string, number>;
  onChange: (status: string) => void;
}

export default function StatusFilter({ active, counts, onChange }: StatusFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ORDER_STATUSES.map((status) => {
        const count = counts[status] ?? 0;
        if (status !== 'all' && count === 0) return null;

        const isActive = active === status;

        return (
          <button
            key={status}
            onClick={() => onChange(status)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isActive
                ? 'bg-red-700 border-red-700 text-white'
                : 'bg-white border-stone-200 text-stone-600 hover:border-red-200 hover:text-red-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-400'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
