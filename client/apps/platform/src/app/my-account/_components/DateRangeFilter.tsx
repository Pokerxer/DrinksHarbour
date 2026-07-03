'use client';
import React from 'react';
import * as Icon from 'react-icons/pi';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

const inputCls =
  'w-full px-3 py-2 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all';

export default function DateRangeFilter({ dateFrom, dateTo, onChange }: DateRangeFilterProps) {
  const hasValue = dateFrom || dateTo;

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="text-xs font-semibold text-stone-600 mb-1.5 block">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
          className={inputCls}
        />
      </div>
      <div className="flex-1">
        <label className="text-xs font-semibold text-stone-600 mb-1.5 block">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onChange(dateFrom, e.target.value)}
          className={inputCls}
        />
      </div>
      {hasValue && (
        <button
          onClick={() => onChange('', '')}
          className="p-2 rounded-xl border border-stone-200 text-stone-400 hover:border-red-200 hover:text-red-700 transition-all flex-shrink-0"
          aria-label="Clear date filter"
        >
          <Icon.PiXBold size={14} />
        </button>
      )}
    </div>
  );
}
