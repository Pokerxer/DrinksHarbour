'use client';

import { PiCaretDown, PiDownloadSimple } from 'react-icons/pi';

export function ExportDropdown({
  showExport,
  setShowExport,
  exportRef,
  onExport,
  hasData,
}: {
  showExport: boolean;
  setShowExport: (v: boolean | ((prev: boolean) => boolean)) => void;
  exportRef: React.RefObject<HTMLDivElement | null>;
  onExport: (fmt: 'csv' | 'excel' | 'pdf') => void;
  hasData: boolean;
}) {
  return (
    <div className="relative" ref={exportRef}>
      <button
        type="button"
        onClick={() => setShowExport((v) => !v)}
        disabled={!hasData}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 ${
          showExport
            ? 'bg-[#9a0101] text-white'
            : 'bg-[#b20202] text-white hover:bg-[#9a0101]'
        }`}
      >
        <PiDownloadSimple className="h-3.5 w-3.5" />
        Export
        <PiCaretDown
          className={`h-3 w-3 opacity-70 transition-transform duration-150 ${
            showExport ? 'rotate-180' : ''
          }`}
        />
      </button>
      {showExport && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Export as
            </p>
          </div>
          <div className="space-y-0.5 p-1.5">
            {(
              [
                { fmt: 'csv' as const, label: 'CSV', sub: '.csv' },
                { fmt: 'excel' as const, label: 'Excel', sub: '.xlsx' },
                { fmt: 'pdf' as const, label: 'PDF', sub: '.pdf' },
              ] as const
            ).map(({ fmt, label, sub }) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onExport(fmt)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 transition-colors hover:bg-red-50 hover:text-[#b20202]"
              >
                <span className="flex-1 font-medium">{label}</span>
                <span className="text-[10px] text-gray-400">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}