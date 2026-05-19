// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PiMagnifyingGlass, PiX, PiSpinner, PiPlus,
  PiPhone, PiEnvelope, PiBuildings, PiMapPin,
  PiClockCounterClockwise, PiArrowRight,
} from 'react-icons/pi';
import { vendorService, type Vendor } from '@/services/vendor.service';

// ── constants ─────────────────────────────────────────────────────────────────

const RECENT_KEY  = 'dh-vendor-recent';
const MAX_RECENT  = 5;
const DEBOUNCE_MS = 260;

const PT_LABELS: Record<string, string> = {
  prepaid: 'Prepaid', net_7: 'Net 7',
  net_14: 'Net 14', net_30: 'Net 30', net_60: 'Net 60',
};

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function saveRecent(id: string) {
  try {
    const prev = loadRecent().filter((x) => x !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

// ── Highlight matched text ────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        re.test(part)
          ? <mark key={i} className="bg-amber-100 text-amber-900 rounded-sm not-italic font-semibold px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

// ── Vendor row ────────────────────────────────────────────────────────────────

function VendorRow({
  vendor, query, isSelected, isFocused, onClick,
}: {
  vendor: Vendor; query: string;
  isSelected: boolean; isFocused: boolean;
  onClick: () => void;
}) {
  const initials = vendor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const city = vendor.address?.city || vendor.address?.state;
  const contact = vendor.contactPerson?.name;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors rounded-xl',
        isFocused ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-gray-50',
        isSelected ? 'opacity-60' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Avatar */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
        isFocused ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
      }`}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
          <Highlight text={vendor.name} query={query} />
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 mt-0.5">
          {vendor.email && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 truncate max-w-[160px]">
              <PiEnvelope className="h-2.5 w-2.5 shrink-0" />
              <Highlight text={vendor.email} query={query} />
            </span>
          )}
          {vendor.phone && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <PiPhone className="h-2.5 w-2.5 shrink-0" />
              <Highlight text={vendor.phone} query={query} />
            </span>
          )}
          {contact && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <PiBuildings className="h-2.5 w-2.5 shrink-0" />
              {contact}
            </span>
          )}
          {city && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <PiMapPin className="h-2.5 w-2.5 shrink-0" />
              {city}
            </span>
          )}
        </div>
      </div>

      {/* Right badges */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {vendor.paymentTerms && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase text-gray-500">
            {PT_LABELS[vendor.paymentTerms] ?? vendor.paymentTerms}
          </span>
        )}
        {isFocused && (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">↵ Select</span>
        )}
      </div>
    </button>
  );
}

// ── Payment terms filter ──────────────────────────────────────────────────────

const PT_FILTERS = [
  { value: '',        label: 'All' },
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'net_7',   label: 'Net 7' },
  { value: 'net_14',  label: 'Net 14' },
  { value: 'net_30',  label: 'Net 30' },
  { value: 'net_60',  label: 'Net 60' },
];

// ── Main component ────────────────────────────────────────────────────────────

export interface VendorSearchProps {
  token: string;
  selectedId?: string;
  onSelect: (vendor: Vendor) => void;
  onCreateNew: (query: string) => void;
  onCancel: () => void;
}

export default function VendorSearch({
  token, selectedId, onSelect, onCreateNew, onCancel,
}: VendorSearchProps) {
  const [query,       setQuery]       = useState('');
  const [allVendors,  setAllVendors]  = useState<Vendor[]>([]);
  const [results,     setResults]     = useState<Vendor[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [ptFilter,    setPtFilter]    = useState('');
  const [focusIdx,    setFocusIdx]    = useState(-1);
  const [recentIds,   setRecentIds]   = useState<string[]>([]);
  const [mode,        setMode]        = useState<'all' | 'search'>('all');

  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLDivElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout>>();

  // ── Load all vendors on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    vendorService.getAll(token)
      .then((list) => {
        setAllVendors(list);
        setResults(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    setRecentIds(loadRecent());
    inputRef.current?.focus();
  }, [token]);

  // ── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) {
      setMode('all');
      setResults(applyPtFilter(allVendors, ptFilter));
      setFocusIdx(-1);
      return;
    }
    setMode('search');
    if (query.trim().length < 2) {
      setResults([]);
      setFocusIdx(-1);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await vendorService.search(query, token);
        setResults(applyPtFilter(hits, ptFilter));
        setFocusIdx(hits.length > 0 ? 0 : -1);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Payment terms filter ────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'all') setResults(applyPtFilter(allVendors, ptFilter));
  }, [ptFilter, allVendors, mode]);

  function applyPtFilter(list: Vendor[], pt: string) {
    if (!pt) return list;
    return list.filter((v) => v.paymentTerms === pt);
  }

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIdx >= 0 && focusIdx < results.length) {
        handleSelect(results[focusIdx]);
      } else if (query.trim()) {
        onCreateNew(query.trim());
      }
    }
  }, [results, focusIdx, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll focused row into view
  useEffect(() => {
    if (focusIdx < 0 || !listRef.current) return;
    const row = listRef.current.querySelectorAll('[data-row]')[focusIdx] as HTMLElement;
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx]);

  function handleSelect(vendor: Vendor) {
    saveRecent(vendor._id);
    onSelect(vendor);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const recentVendors = allVendors.filter((v) => recentIds.includes(v._id));

  const showRecent    = mode === 'all' && !ptFilter && recentVendors.length > 0;
  const filteredAll   = mode === 'all' ? results : [];
  const otherVendors  = showRecent
    ? filteredAll.filter((v) => !recentIds.includes(v._id))
    : filteredAll;

  const hasResults    = mode === 'search' ? results.length > 0 : filteredAll.length > 0;

  // Map displayed rows to global result index for keyboard focus
  const displayRows: Vendor[] = mode === 'search'
    ? results
    : [...(showRecent ? recentVendors : []), ...otherVendors];

  const totalCount = allVendors.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">

      {/* ── Search input ─────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
        {loading
          ? <PiSpinner className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
          : <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search vendors by name, email or phone…"
          className="flex-1 text-sm outline-none placeholder-gray-400 min-w-0"
          autoComplete="off"
        />
        {query ? (
          <button type="button" onClick={() => setQuery('')}
            className="shrink-0 text-gray-400 hover:text-gray-600">
            <PiX className="h-4 w-4" />
          </button>
        ) : (
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-mono text-gray-400">
            ESC
          </span>
        )}
      </div>

      {/* ── Payment terms filter bar ──────────────────────── */}
      {mode === 'all' && totalCount > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-gray-50 px-4 py-2 scrollbar-none">
          {PT_FILTERS.map((f) => {
            const count = f.value
              ? allVendors.filter((v) => v.paymentTerms === f.value).length
              : allVendors.length;
            if (f.value && count === 0) return null;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => { setPtFilter(f.value); setFocusIdx(-1); }}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  ptFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
                <span className={`ml-1 ${ptFilter === f.value ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Results list ────────────────────────────────────── */}
      <div ref={listRef} className="max-h-72 overflow-y-auto p-2">

        {/* Recently used */}
        {showRecent && recentVendors.length > 0 && (
          <div className="mb-1">
            <p className="flex items-center gap-1.5 px-3 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
              <PiClockCounterClockwise className="h-3 w-3" /> Recently used
            </p>
            {recentVendors.map((v, i) => (
              <div key={v._id} data-row>
                <VendorRow
                  vendor={v}
                  query={query}
                  isSelected={v._id === selectedId}
                  isFocused={displayRows.indexOf(v) === focusIdx}
                  onClick={() => handleSelect(v)}
                />
              </div>
            ))}
            {otherVendors.length > 0 && (
              <div className="my-1 border-t border-gray-100" />
            )}
          </div>
        )}

        {/* All / search results */}
        {mode === 'all' && otherVendors.length > 0 && (
          <>
            {showRecent && (
              <p className="px-3 pb-1.5 pt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                All vendors
              </p>
            )}
            {otherVendors.map((v) => (
              <div key={v._id} data-row>
                <VendorRow
                  vendor={v}
                  query={query}
                  isSelected={v._id === selectedId}
                  isFocused={displayRows.indexOf(v) === focusIdx}
                  onClick={() => handleSelect(v)}
                />
              </div>
            ))}
          </>
        )}

        {mode === 'search' && results.length > 0 && (
          <>
            <p className="px-3 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </p>
            {results.map((v) => (
              <div key={v._id} data-row>
                <VendorRow
                  vendor={v}
                  query={query}
                  isSelected={v._id === selectedId}
                  isFocused={displayRows.indexOf(v) === focusIdx}
                  onClick={() => handleSelect(v)}
                />
              </div>
            ))}
          </>
        )}

        {/* Empty states */}
        {mode === 'search' && !loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-gray-600">No vendors match "{query}"</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {totalCount > 0 ? `${totalCount} vendor${totalCount !== 1 ? 's' : ''} in your directory` : 'No vendors yet'}
            </p>
          </div>
        )}

        {mode === 'search' && !loading && query.trim().length > 0 && query.trim().length < 2 && (
          <p className="py-4 text-center text-xs text-gray-400">Type one more character…</p>
        )}

        {mode === 'all' && !loading && filteredAll.length === 0 && !showRecent && (
          <div className="py-6 text-center">
            {ptFilter ? (
              <>
                <p className="text-sm text-gray-500">No vendors with {PT_LABELS[ptFilter]} terms</p>
                <button type="button" onClick={() => setPtFilter('')}
                  className="mt-1.5 text-xs text-indigo-600 hover:underline">
                  Show all vendors
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">No vendors in your directory yet</p>
            )}
          </div>
        )}

        {loading && allVendors.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <PiSpinner className="h-4 w-4 animate-spin" /> Loading vendors…
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onCreateNew(query.trim())}
          className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-indigo-400 hover:bg-white hover:text-indigo-600 transition-colors"
        >
          <PiPlus className="h-4 w-4" />
          Create{query.trim() ? ` "${query.trim()}"` : ' new vendor'}
          <PiArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>

      {/* Keyboard hint strip */}
      <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-1.5 text-[9px] text-gray-400">
        <span><kbd className="rounded bg-gray-100 px-1 font-mono">↑↓</kbd> navigate</span>
        <span><kbd className="rounded bg-gray-100 px-1 font-mono">↵</kbd> select</span>
        <span><kbd className="rounded bg-gray-100 px-1 font-mono">Esc</kbd> cancel</span>
        {totalCount > 0 && (
          <span className="ml-auto">{totalCount} vendor{totalCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}
