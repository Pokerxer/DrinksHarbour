'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PiMagnifyingGlass, PiX } from 'react-icons/pi';
import { refName, type SubProductLite } from './types';
import { fmt } from './rule-format';

interface Props {
  products: SubProductLite[];
  value: string;
  /** Prefill shown when nothing is selected yet (edit mode). */
  displayValue?: string;
  placeholder?: string;
  /** Show the "All products" row. */
  allowAll?: boolean;
  onChange(p: SubProductLite | null): void;
}

export default function ProductPicker({
  products,
  value,
  displayValue = '',
  placeholder = 'Search or leave blank…',
  allowAll = true,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const out = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  const sel = products.find((p) => p._id === value);
  const shown = open
    ? search
    : sel
      ? refName(sel.product) || sel.sku || ''
      : displayValue;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter((p) =>
        `${refName(p.product) || ''} ${p.sku || ''}`.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [products, search]);

  const rows: Array<{ key: string; p: SubProductLite | null }> = allowAll
    ? [{ key: '__all__', p: null }, ...filtered.map((p) => ({ key: p._id, p }))]
    : filtered.map((p) => ({ key: p._id, p }));

  function choose(p: SubProductLite | null) {
    onChange(p);
    setOpen(false);
    setSearch('');
    setHi(-1);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={`flex h-9 items-center overflow-hidden rounded-lg border transition-colors ${
          open
            ? 'border-[#b20202] ring-1 ring-[#b20202]/10'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <PiMagnifyingGlass className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="product-picker-listbox"
          aria-label="Search products"
          value={shown}
          onFocus={() => {
            setSearch(shown);
            setOpen(true);
          }}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            setHi(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, rows.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, -1));
            } else if (e.key === 'Enter') {
              if (open && hi >= 0 && rows[hi]) {
                e.preventDefault();
                choose(rows[hi].p);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
              setHi(-1);
            }
          }}
          placeholder={placeholder}
          className="h-full flex-1 border-0 bg-transparent px-2 text-sm text-gray-800 outline-none placeholder:text-gray-400"
        />
        {(!!value || (!allowAll && !!displayValue)) && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => choose(null)}
            className="mr-2 shrink-0 text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="product-picker-listbox"
          role="listbox"
          aria-label="Products"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {allowAll && (
            <button
              type="button"
              onMouseEnter={() => setHi(0)}
              onClick={() => choose(null)}
              className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-sm italic hover:bg-gray-50 ${
                hi <= 0 ? 'bg-gray-50' : 'text-gray-400'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
                ★
              </span>
              All products
            </button>
          )}
          {filtered.map((p, i) => {
            const idx = allowAll ? i + 1 : i;
            const name = refName(p.product) || p.sku || p._id;
            const isSel = value === p._id;
            return (
              <button
                key={p._id}
                type="button"
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setHi(idx)}
                onClick={() => choose(p)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${
                  isSel ? 'bg-[#b20202]/5 font-semibold' : 'text-gray-700'
                } ${hi === idx ? 'bg-gray-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${isSel ? 'text-[#b20202]' : ''}`}>
                    {name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {p.sku && (
                      <span className="font-mono text-[10px] text-gray-400">
                        {p.sku}
                      </span>
                    )}
                    {!!p.costPrice && p.costPrice > 0 && (
                      <span className="text-[10px] text-gray-400">
                        cost {fmt(p.costPrice)}
                      </span>
                    )}
                    {p.isOnSale && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-bold text-emerald-700">
                        On Sale
                      </span>
                    )}
                    {p.flashSale?.isActive && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-700">
                        ⚡ Flash
                      </span>
                    )}
                    {!!p.bundleDeals?.length && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-px text-[9px] font-bold text-purple-700">
                        📦 Bundle
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-600">
                  {fmt(p.baseSellingPrice || 0)}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-gray-400">
              No products found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
