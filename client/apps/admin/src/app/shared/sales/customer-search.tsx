// client/apps/isomorphic/src/app/shared/sales/customer-search.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { PiMagnifyingGlass, PiX, PiUser, PiPlus } from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import { routes } from '@/config/routes';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

function customerName(c: POSCustomer) {
  return `${c.firstName} ${c.lastName}`.trim();
}

function initials(c: POSCustomer) {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
}

export default function CustomerSearch({
  token,
  selected,
  onSelect,
  onClear,
}: {
  token: string;
  selected: POSCustomer | null;
  onSelect: (c: POSCustomer) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [initial, setInitial] = useState<POSCustomer[]>([]);
  const [results, setResults] = useState<POSCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const res = await posApi.searchCustomers(token, '', 8);
      setInitial(res.customers ?? []);
      setResults(res.customers ?? []);
      setInitialLoaded(true);
    } catch {
      setInitial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (query.trim().length < 2) {
      setResults(initial);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await posApi.searchCustomers(token, query.trim(), 8);
        setResults(res.customers ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token, initial]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-sm font-bold text-[#b20202]">
          {initials(selected)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {customerName(selected)}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {selected.email && (
              <span className="text-xs text-gray-500">{selected.email}</span>
            )}
            {selected.phone && (
              <span className="text-xs text-gray-500">{selected.phone}</span>
            )}
            {selected.pricelistName && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {selected.pricelistName}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Change customer"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onFocus={() => {
            ensureInitial();
            setOpen(true);
          }}
          placeholder="Search customers… (optional)"
          className={`pl-9 pr-9 ${INPUT_CLS}`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            …
          </span>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.length === 0 && !loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <PiUser className="h-4 w-4" />
              {query.trim().length >= 2
                ? `No customers match "${query}"`
                : 'No customers yet'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onMouseDown={() => {
                    onSelect(c);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-xs font-bold text-[#b20202]">
                    {initials(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {customerName(c)}
                    </p>
                    <div className="flex items-center gap-2">
                      {c.email && (
                        <span className="truncate text-xs text-gray-400">
                          {c.email}
                        </span>
                      )}
                      {c.pricelistName && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                          {c.pricelistName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-gray-100">
            <a
              href={routes.contacts.list}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#b20202] hover:bg-gray-50"
            >
              <PiPlus className="h-4 w-4" />
              Add new customer
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
