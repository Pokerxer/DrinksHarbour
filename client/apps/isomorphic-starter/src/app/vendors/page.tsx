'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_BADGES: Record<string, { label: string; cls: string }> = {
  enterprise: { label: 'Enterprise', cls: 'bg-purple-100 text-purple-700' },
  pro:        { label: 'Pro',        cls: 'bg-blue-100 text-blue-700' },
  starter:    { label: 'Starter',    cls: 'bg-green-100 text-green-700' },
  free_trial: { label: 'Trial',      cls: 'bg-gray-100 text-gray-500' },
  custom:     { label: 'Custom',     cls: 'bg-amber-100 text-amber-700' },
};

/** Generate a deterministic gradient from the store name for stores without a logo */
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

function StoreCard({ store }: { store: Store }) {
  const badge = PLAN_BADGES[store.plan ?? ''];
  const gradient = nameToGradient(store.name);
  const location = [store.city, store.state].filter(Boolean).join(', ');

  return (
    <Link
      href={`/vendors/${store.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Banner / avatar area */}
      <div className={`relative h-28 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        {store.logo?.url ? (
          <Image
            src={store.logo.url}
            alt={store.logo.alt ?? store.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        ) : (
          <span className="text-3xl font-black text-white/90 select-none">
            {initials(store.name)}
          </span>
        )}
        {badge && (
          <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 text-sm group-hover:text-red-700 transition-colors leading-snug mb-1">
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

        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {store.productCount
              ? `${store.productCount} product${store.productCount !== 1 ? 's' : ''}`
              : 'New store'}
          </span>
          <span className="flex items-center gap-1 text-xs text-red-700 font-semibold group-hover:gap-2 transition-all">
            Shop now <Icon.PiArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchStores = useCallback(async (p: number, s: string, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '12' });
      if (s) params.set('search', s);
      const res = await fetch(`${API_URL}/api/stores?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load stores');
      setStores(prev => append ? [...prev, ...data.data.stores] : data.data.stores);
      setPagination(data.data.pagination);
    } catch (err: any) {
      setError(err.message || 'Could not load vendors.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial + search-change load
  useEffect(() => {
    fetchStores(1, debouncedSearch, false);
    setPage(1);
  }, [debouncedSearch, fetchStores]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchStores(next, debouncedSearch, true);
  };

  const hasMore = pagination ? page < pagination.pages : false;

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Hero />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
                <div className="h-28 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Hero />

      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Search + count */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:max-w-xs">
            <Icon.PiMagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:border-red-300 focus:ring-2 focus:ring-red-50 outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <Icon.PiX size={14} />
              </button>
            )}
          </div>

          {pagination && (
            <p className="text-sm text-gray-500 flex-shrink-0">
              {pagination.total} vendor{pagination.total !== 1 ? 's' : ''}
              {debouncedSearch && ` matching "${debouncedSearch}"`}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
            <Icon.PiWarningCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => fetchStores(1, debouncedSearch)} className="ml-auto text-xs text-red-700 underline">Retry</button>
          </div>
        )}

        {/* Empty */}
        {!loading && stores.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiStorefront size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No vendors found</h3>
            {debouncedSearch && (
              <p className="text-gray-400 text-sm mb-4">No results for "{debouncedSearch}"</p>
            )}
            {debouncedSearch && (
              <button onClick={() => setSearch('')} className="text-sm text-red-700 underline">Clear search</button>
            )}
          </div>
        )}

        {/* Grid */}
        {stores.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stores.map(store => (
              <StoreCard key={store._id} store={store} />
            ))}
          </div>
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

function Hero() {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white py-14 px-4">
      <div className="container mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
          <Icon.PiStorefront size={14} />
          Verified Merchants
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
          Our Vendors
        </h1>
        <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Browse our curated network of verified beverage merchants across Nigeria.
          From premium spirits to craft beers — shop direct from the source.
        </p>

        <div className="flex items-center justify-center gap-6 mt-8 text-center">
          {[
            { icon: Icon.PiShieldCheck, label: 'Verified stores' },
            { icon: Icon.PiTruck, label: 'Fast delivery' },
            { icon: Icon.PiStar, label: 'Curated selection' },
          ].map(({ icon: Ic, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Ic size={20} className="text-red-300" />
              </div>
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
