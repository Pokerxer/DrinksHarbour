'use client';

import { useEffect, useState, useRef } from 'react';
import { PiCaretDown, PiX } from 'react-icons/pi';
import type { SelectOption } from '../types';

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  minWidth = 130,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  minWidth?: number;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;
  const isActive = !required && value !== '';

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
          isActive
            ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
            : open
              ? 'border-gray-300 bg-white text-gray-700 shadow-sm'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        {selected?.dot && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        )}
        <span className="flex-1 truncate text-left font-medium">
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {isActive && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded-full p-0.5 transition-colors hover:bg-[#b20202]/10"
            >
              <PiX className="h-2.5 w-2.5" />
            </span>
          )}
          <PiCaretDown
            className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="max-h-56 overflow-y-auto py-1">
            {!required && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    !isActive
                      ? 'bg-gray-50 font-semibold text-gray-800'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span>{placeholder}</span>
                  {!isActive && (
                    <span className="text-[10px] font-bold text-[#b20202]">✓</span>
                  )}
                </button>
                <div className="mx-3 my-1 border-t border-gray-100" />
              </>
            )}
            {options.map((opt) => {
              const isSel = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    isSel
                      ? 'bg-red-50 font-semibold text-[#b20202]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.dot && (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`} />
                  )}
                  <span className="flex-1">{opt.label}</span>
                  {isSel && (
                    <span className="text-[10px] font-bold text-[#b20202]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}