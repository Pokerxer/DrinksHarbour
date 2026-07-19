'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Store {
  _id: string;
  name: string;
  slug: string;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  city?: string;
  state?: string;
  plan?: string;
  productCount?: number;
  description?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

type SortKey = 'products' | 'name_asc' | 'name_desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_BADGES: Record<string, { label: string; cls: string }> = {
  enterprise: { label: 'Enterprise', cls: 'bg-purple-100 text-purple-700' },
  pro:        { label: 'Pro',        cls: 'bg-blue-100 text-blue-700' },
  starter:    { label: 'Starter',    cls: 'bg-green-100 text-green-700' },
  free_trial: { label: 'Trial',      cls: 'bg-gray-100 text-gray-500' },
  custom:     { label: 'Custom',     cls: 'bg-amber-100 text-amber-700' },
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'products',  label: 'Most Products' },
  { value: 'name_asc',  label: 'Name A → Z' },
  { value: 'name_desc', label: 'Name Z → A' },
];

function nameToGradient(name: string): string {
  const gradients = [
    'from-red-700 to-red-900',
    'from-purple-600 to-purple-900',
    'from-blue-600 to-blue-900',
    'from-emerald-600 to-emerald-900',
    'from-amber-600 to-amber-800',
    'from-rose-600 to-rose-900',
    'from-indigo-600 to-indigo-900',
    'from-teal-600 to-teal-900',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Store Card ───────────────────────────────────────────────────────────────

function StoreCard({ store, featured = false }: { store: Store; featured?: boolean }) {
  const badge = PLAN_BADGES[store.plan ?? ''];
  const gradient = nameToGradient(store.name);
  const location = [store.city, store.state].filter(Boolean).join(', ');

  return (
    <Link
      href={`/vendors/${store.slug}`}
      className={`group bg-white rounded-2xl border shadow-sm hover:shadow-lg hover:border-red-100 transition-all duration-200 overflow-hidden flex flex-col ${
        featured ? 'border-red-100 ring-1 ring-red-100' : 'border-gray-100'
      }`}
    >
      {/* Banner / avatar area */}
      <div className={`relative ${featured ? 'h-36' : 'h-28'} bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        {store.logo?.url ? (
          <Image
            src={store.logo.url}
            alt={store.logo.alt ?? store.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        ) : (
          <span className={`${featured ? 'text-4xl' : 'text-3xl'} font-black text-white/90 select-none`}>
            {initials(store.name)}
          </span>
        )}
        {badge && (
          <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {featured && (
          <span className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
            <Icon.PiStar size={10} weight="fill" /> Top Vendor
          </span>
        )}
        {/* Product count chip */}
        {(store.productCount ?? 0) > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Icon.PiPackage size={10} />
            {store.productCount}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className={`font-bold text-gray-900 group-hover:text-red-700 transition-colors leading-snug mb-1 ${featured ? 'text-base' : 'text-sm'}`}>
          {store.name}
        </h3>

        {location && (
          <p className="flex items-center gap-1 text-xs text-gray-400 mb-2">
            <Icon.PiMapPin size={12} />
            {location}
          </p>
        )}

        {store.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
            {store.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {store.productCount
              ? `${store.productCount.toLocaleString()} product${store.productCount !== 1 ? 's' : ''}`
              : 'New store'}
          </span>
          <span className="flex items-center gap-1 text-xs text-red-700 font-semibold group-hover:gap-2 transition-all">
            Visit <Icon.PiArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className={`${tall ? 'h-36' : 'h-28'} bg-gray-200`} />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('products');
  const [locationFilter, setLocationFilter] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Debounce location filter
  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    locationDebounceRef.current = setTimeout(() => {
      setDebouncedLocation(locationFilter);
      setPage(1);
    }, 400);
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [locationFilter]);

  // Close sort on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setIsSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchStores = useCallback(async (p: number, s: string, loc: string, sort: SortKey, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '16' });
      if (s) params.set('search', s);
      // Location filter — try state first, then city
      if (loc) {
        params.set('state', loc);
      }
      const res = await fetch(`${API_URL}/api/stores?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load stores');

      let list: Store[] = data.data.stores;

      // Client-side sort (API always returns by productCount desc)
      if (sort === 'name_asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      else if (sort === 'name_desc') list = [...list].sort((a, b) => b.name.localeCompare(a.name));

      setStores(prev => append ? [...prev, ...list] : list);
      setPagination(data.data.pagination);
    } catch (err: any) {
      setError(err.message || 'Could not load vendors.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Re-fetch when any filter/sort changes
  useEffect(() => {
    fetchStores(1, debouncedSearch, debouncedLocation, sortKey, false);
    setPage(1);
  }, [debouncedSearch, debouncedLocation, sortKey, fetchStores]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchStores(next, debouncedSearch, debouncedLocation, sortKey, true);
  };

  const hasMore = pagination ? page < pagination.pages : false;

  // Top 3 stores for featured row (only on first page, no filters active)
  const featuredStores = useMemo(() => {
    if (debouncedSearch || debouncedLocation || sortKey !== 'products') return [];
    return stores.filter(s => (s.productCount ?? 0) > 0).slice(0, 3);
  }, [stores, debouncedSearch, debouncedLocation, sortKey]);

  const regularStores = useMemo(() => {
    if (featuredStores.length === 0) return stores;
    const featuredIds = new Set(featuredStores.map(s => s._id));
    return stores.filter(s => !featuredIds.has(s._id));
  }, [stores, featuredStores]);

  const activeFilters = [debouncedSearch, debouncedLocation].filter(Boolean).length;
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortKey)?.label ?? 'Sort';

  return (
    <div className="min-h-screen bg-gray-50">
      <Hero totalVendors={pagination?.total} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* ── Controls Bar ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Icon.PiMagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search vendors by name…"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-50 outline-none transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Icon.PiX size={14} />
                </button>
              )}
            </div>

            {/* Location */}
            <div className="relative sm:w-44">
              <Icon.PiMapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                placeholder="State / city…"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-50 outline-none transition-colors"
              />
              {locationFilter && (
                <button onClick={() => setLocationFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Icon.PiX size={14} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setIsSortOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white text-sm font-medium text-gray-700 transition-colors whitespace-nowrap"
              >
                <Icon.PiArrowsDownUp size={15} />
                {sortLabel}
                <Icon.PiCaretDown size={13} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSortOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortKey(opt.value); setIsSortOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors hover:bg-gray-50 ${
                        sortKey === opt.value ? 'text-red-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {opt.label}
                      {sortKey === opt.value && <Icon.PiCheck size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active filter chips */}
          {(debouncedSearch || debouncedLocation) && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Filtering by:</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  Name: "{debouncedSearch}"
                  <button onClick={() => setSearch('')} className="ml-0.5 hover:text-red-900"><Icon.PiX size={11} /></button>
                </span>
              )}
              {debouncedLocation && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  Location: "{debouncedLocation}"
                  <button onClick={() => setLocationFilter('')} className="ml-0.5 hover:text-blue-900"><Icon.PiX size={11} /></button>
                </span>
              )}
              {activeFilters > 1 && (
                <button
                  onClick={() => { setSearch(''); setLocationFilter(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear all
                </button>
              )}
              {pagination && (
                <span className="ml-auto text-xs text-gray-400">
                  {pagination.total} result{pagination.total !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
            <Icon.PiWarningCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => fetchStores(1, debouncedSearch, debouncedLocation, sortKey)} className="ml-auto text-xs text-red-700 underline">Retry</button>
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <>
            {/* Featured row skeleton */}
            <div className="mb-8">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} tall />)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </>
        )}

        {/* Empty */}
        {!loading && stores.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiStorefront size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No vendors found</h3>
            {(debouncedSearch || debouncedLocation) ? (
              <>
                <p className="text-gray-400 text-sm mb-4">No results for your current filters</p>
                <button
                  onClick={() => { setSearch(''); setLocationFilter(''); }}
                  className="text-sm text-red-700 underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Check back soon — we're adding new vendors.</p>
            )}
          </div>
        )}

        {/* Featured Top Vendors */}
        {!loading && featuredStores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Icon.PiStar size={16} className="text-amber-500" />
              Top Vendors
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featuredStores.map(store => (
                <StoreCard key={store._id} store={store} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Vendors Grid */}
        {!loading && regularStores.length > 0 && (
          <>
            {featuredStores.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">
                  {pagination && `All Vendors (${pagination.total})`}
                </h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {regularStores.map(store => (
                <StoreCard key={store._id} store={store} />
              ))}
            </div>
          </>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:border-red-200 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <><div className="w-4 h-4 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" /> Loading…</>
              ) : (
                <><Icon.PiArrowDown size={16} /> Load more vendors</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ totalVendors }: { totalVendors?: number }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white py-14 px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-700 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="container mx-auto max-w-4xl text-center relative">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
          <Icon.PiStorefront size={14} />
          Verified Merchants
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
          Our Vendors
        </h1>
        <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
          Browse our curated network of verified beverage merchants across Nigeria.
          From premium spirits to craft beers — shop direct from the source.
        </p>

        <Link
          href="/vendors/register"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-red-900/30 transition-colors mb-10"
        >
          <Icon.PiStorefront size={16} />
          Become a Vendor
          <Icon.PiArrowRight size={15} />
        </Link>

        <div className="flex items-center justify-center gap-8 sm:gap-12 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiStorefront size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">
              {totalVendors != null ? totalVendors.toLocaleString() : '—'}
            </p>
            <span className="text-xs text-gray-400">Vendors</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiShieldCheck size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">100%</p>
            <span className="text-xs text-gray-400">Verified</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiTruck size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">Fast</p>
            <span className="text-xs text-gray-400">Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiStar size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">Curated</p>
            <span className="text-xs text-gray-400">Selection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
