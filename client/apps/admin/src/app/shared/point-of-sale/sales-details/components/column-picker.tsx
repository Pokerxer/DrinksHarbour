'use client';

import { useState, useEffect, useRef } from 'react';
import { TOGGLEABLE_COLS } from '../constants';
import type { ToggleableCol } from '../types';

export function ColumnPicker({
  hiddenCols,
  toggleCol,
  vis,
  setAllHiddenCols,
}: {
  hiddenCols: Set<ToggleableCol>;
  toggleCol: (k: ToggleableCol) => void;
  vis: (k: ToggleableCol) => boolean;
  setAllHiddenCols: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-xs font-medium transition-colors ${
          open || hiddenCols.size > 0
            ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        Columns
        {hiddenCols.size > 0 && (
          <span className="rounded-full bg-[#b20202] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {TOGGLEABLE_COLS.length - hiddenCols.size}/{TOGGLEABLE_COLS.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="border-b border-gray-100 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Show / Hide columns
            </p>
          </div>
          <div className="space-y-0.5 p-1.5">
            {TOGGLEABLE_COLS.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleCol(col.key)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all ${
                    vis(col.key)
                      ? 'border-[#b20202] bg-[#b20202] text-white'
                      : 'border-gray-300'
                  }`}
                >
                  {vis(col.key) ? '✓' : ''}
                </span>
                <span
                  className={`text-xs ${
                    vis(col.key) ? 'font-medium text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {col.label}
                </span>
              </button>
            ))}
          </div>
          {hiddenCols.size > 0 && (
            <div className="border-t border-gray-100 p-1.5">
              <button
                type="button"
                onClick={() => { setAllHiddenCols(); setOpen(false); }}
                className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-50"
              >
                Show all columns
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}