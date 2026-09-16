'use client';

import { PiClock, PiX } from 'react-icons/pi';

export function DateTimeRange({
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
  onDateFrom,
  onDateTo,
  onTimeFrom,
  onTimeTo,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onTimeFrom: (v: string) => void;
  onTimeTo: (v: string) => void;
  onClear: () => void;
}) {
  const hasRange = dateFrom || dateTo;
  return (
    <div className="flex items-center gap-2">
      {(['from', 'to'] as const).map((side) => {
        const dateVal = side === 'from' ? dateFrom : dateTo;
        const timeVal = side === 'from' ? timeFrom : timeTo;
        const setDate = side === 'from' ? onDateFrom : onDateTo;
        const setTime = side === 'from' ? onTimeFrom : onTimeTo;
        return (
          <div key={side} className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-medium capitalize text-gray-400">
              {side}
            </span>
            <div className="flex items-center overflow-hidden rounded-md border border-gray-200 bg-white transition-shadow focus-within:border-[#b20202] focus-within:ring-1 focus-within:ring-[#b20202]/20">
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDate(e.target.value)}
                className="w-[128px] border-0 bg-transparent px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none"
              />
              <div className="w-px self-stretch bg-gray-100" />
              <div className="flex items-center gap-1 px-2">
                <PiClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  type="time"
                  value={timeVal}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-[68px] border-0 bg-transparent py-1.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>
            </div>
            {side === 'from' && (
              <span className="text-xs text-gray-300">→</span>
            )}
          </div>
        );
      })}
      {hasRange && (
        <button
          type="button"
          onClick={onClear}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Clear date range"
        >
          <PiX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}