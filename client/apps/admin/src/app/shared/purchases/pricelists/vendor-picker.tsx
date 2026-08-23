'use client';

import { useEffect, useRef, useState } from 'react';
import { PiMagnifyingGlass, PiX } from 'react-icons/pi';
import { vendorService, type Vendor } from '@/services/vendor.service';

export default function VendorPicker({
  token,
  value,
  onChange,
}: {
  token: string;
  value: { _id: string; name: string } | null;
  onChange: (v: { _id: string; name: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await vendorService.search(q, token));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, token]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[#b20202]/30 bg-[#b20202]/5 px-3 py-2">
        <span className="truncate text-sm font-medium text-[#b20202]">
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Clear vendor"
          aria-label="Clear vendor"
          className="shrink-0 rounded p-0.5 text-[#b20202]/60 hover:bg-[#b20202]/10 hover:text-[#b20202]"
        >
          <PiX className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-[#ece4d6] bg-white px-3 py-2 focus-within:border-[#b20202]">
        <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search vendors…"
          aria-label="Search vendors"
          className="w-full text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      {open && (query.trim().length >= 2 || loading) && (
        <div className="absolute inset-x-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#ece4d6] bg-white shadow-xl">
          {loading ? (
            <p className="px-3 py-3 text-center text-xs text-gray-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-gray-400">
              No vendors match “{query.trim()}”
            </p>
          ) : (
            results.map((v) => (
              <button
                key={v._id}
                type="button"
                onClick={() => {
                  onChange({ _id: v._id, name: v.name });
                  setOpen(false);
                  setQuery('');
                }}
                className="block w-full px-3 py-2 text-left hover:bg-[#FAF8F3]"
              >
                <span className="block truncate text-sm text-[#2a2420]">{v.name}</span>
                {(v.email || v.phone) && (
                  <span className="block truncate text-[11px] text-gray-400">
                    {[v.email, v.phone].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
