'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandLogo {
  url: string;
  publicId?: string;
  alt?: string;
  width?: number;
  height?: number;
  format?: string;
}

interface BrandLogoVariants {
  primary?: string;
  secondary?: string;
  white?: string;
  black?: string;
  icon?: string;
}

interface Brand {
  _id: string;
  name: string;
  slug: string;
  logo?: BrandLogo;
  logoVariants?: BrandLogoVariants;
  featuredImage?: BrandLogo;
  bannerImage?: BrandLogo;
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  description?: string;
  shortDescription?: string;
  productCount?: number;
  countryOfOrigin?: string;
  primaryCategory?: string;
  brandType?: string;
  founded?: number;
  isFeatured?: boolean;
  isPremium?: boolean;
  verified?: boolean;
  popularityScore?: number;
  createdAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

type SortKey = 'name_asc' | 'name_desc' | 'products' | 'newest';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COUNTRY_EMOJI: Record<string, string> = {
  France: '\u{1F1EB}\u{1F1F7}',
  Italy: '\u{1F1EE}\u{1F1F9}',
  'United States': '\u{1F1FA}\u{1F1F8}',
  USA: '\u{1F1FA}\u{1F1F8}',
  'United Kingdom': '\u{1F1EC}\u{1F1E7}',
  UK: '\u{1F1EC}\u{1F1E7}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  Spain: '\u{1F1EA}\u{1F1F8}',
  Mexico: '\u{1F1F2}\u{1F1FD}',
  Japan: '\u{1F1EF}\u{1F1F5}',
  Scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  Ireland: '\u{1F1EE}\u{1F1EA}',
  Australia: '\u{1F1E6}\u{1F1FA}',
  Canada: '\u{1F1E8}\u{1F1E6}',
  Nigeria: '\u{1F1F3}\u{1F1EC}',
  'South Africa': '\u{1F1FF}\u{1F1E6}',
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name_asc', label: 'Name A \u2192 Z' },
  { value: 'name_desc', label: 'Name Z \u2192 A' },
  { value: 'products', label: 'Most Products' },
  { value: 'newest', label: 'Newest First' },
];

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function getCountryEmoji(country?: string): string {
  if (!country) return '\u{1F30D}';
  const trimmed = country.split(',')[0].trim();
  return COUNTRY_EMOJI[trimmed] || COUNTRY_EMOJI[country] || '\u{1F30D}';
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

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
    'from-orange-600 to-orange-900',
    'from-cyan-600 to-cyan-900',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function getBrandColor(brand: Brand): string {
  return brand.brandColors?.primary || brand.brandColors?.accent || '#6366F1';
}

function getBrandImage(brand: Brand): string | null {
  return brand.logo?.url ||
    brand.logoVariants?.primary ||
    brand.logoVariants?.white ||
    brand.featuredImage?.url ||
    null;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ total, totalProducts }: { total?: number; totalProducts?: number }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white py-14 px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-700 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="container mx-auto max-w-4xl text-center relative">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
          <Icon.PiStar size={14} />
          Premium Partners
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
          Our Brands
        </h1>
        <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
          Discover the world&apos;s finest beverage brands available on DrinksHarbour.
          From heritage distilleries to craft producers — every bottle tells a story.
        </p>

        <div className="flex items-center justify-center gap-8 sm:gap-12 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiStorefront size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">
              {total != null ? total.toLocaleString() : '\u2014'}
            </p>
            <span className="text-xs text-gray-400">Brands</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiWine size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">
              {totalProducts != null ? totalProducts.toLocaleString() : '\u2014'}
            </p>
            <span className="text-xs text-gray-400">Products</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiShieldCheck size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">100%</p>
            <span className="text-xs text-gray-400">Authentic</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon.PiGlobe size={20} className="text-red-300" />
            </div>
            <p className="text-lg font-black text-white">Global</p>
            <span className="text-xs text-gray-400">Selection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-28 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mx-auto" />
        <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto" />
      </div>
    </div>
  );
}

// ─── Brand Card ───────────────────────────────────────────────────────────────

function BrandCard({ brand }: { brand: Brand }) {
  const brandImage = getBrandImage(brand);
  const gradient = nameToGradient(brand.name);
  const color = getBrandColor(brand);

  return (
    <Link href={`/shop?brand=${encodeURIComponent(brand.name)}`} className="block h-full">
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ duration: 0.3 }}
        className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-red-100 transition-all duration-200 overflow-hidden h-full flex flex-col"
      >
        {/* Banner */}
        <div className={`relative h-28 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
          <motion.div
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -top-8 -left-8 w-40 h-40 rounded-full"
            style={{ backgroundColor: color, filter: 'blur(25px)' }}
          />
          <motion.div
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full"
            style={{ backgroundColor: color, filter: 'blur(20px)' }}
          />

          {/* Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5 z-10">
            {brand.isPremium && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full text-[9px] font-bold text-white shadow">
                <Icon.PiCrownFill size={9} /> Premium
              </span>
            )}
            {brand.verified && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full text-[9px] font-bold text-white shadow">
                <Icon.PiSealCheckFill size={9} /> Verified
              </span>
            )}
          </div>

          {/* Logo */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-white shadow-xl border-2 border-white flex items-center justify-center overflow-hidden z-20"
          >
            {brandImage ? (
              <Image
                src={brandImage}
                alt={brand.name}
                width={56}
                height={56}
                className="object-contain p-1.5"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-black text-white"
                style={{ backgroundColor: color }}
              >
                {initials(brand.name)}
              </div>
            )}
          </motion.div>

          {/* Product count chip */}
          {(brand.productCount ?? 0) > 0 && (
            <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
              <Icon.PiPackage size={10} />
              {brand.productCount}
            </div>
          )}

          {/* Hover arrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: color }}
          >
            <Icon.PiArrowRight size={14} className="text-white" />
          </motion.div>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col items-center text-center flex-1">
          <h3 className="font-bold text-gray-900 group-hover:text-red-700 transition-colors text-sm mb-1">
            {brand.name}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <span>{getCountryEmoji(brand.countryOfOrigin)}</span>
            <span>{brand.countryOfOrigin || 'Worldwide'}</span>
            {brand.founded && (
              <>
                <span className="text-gray-300">&bull;</span>
                <span>Est. {brand.founded}</span>
              </>
            )}
          </div>

          {brand.shortDescription && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
              {brand.shortDescription}
            </p>
          )}

          <div className="mt-auto flex items-center justify-center gap-2 pt-2 border-t border-gray-50 w-full">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Icon.PiWine size={11} />
              {brand.productCount
                ? `${brand.productCount} product${brand.productCount !== 1 ? 's' : ''}`
                : 'Coming soon'}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState('');
  const [debouncedCountry, setDebouncedCountry] = useState('');
  const sortRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setActiveLetter(null);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Debounce country filter
  useEffect(() => {
    if (countryDebounceRef.current) clearTimeout(countryDebounceRef.current);
    countryDebounceRef.current = setTimeout(() => {
      setDebouncedCountry(countryFilter);
    }, 400);
    return () => { if (countryDebounceRef.current) clearTimeout(countryDebounceRef.current); };
  }, [countryFilter]);

  // Close sort on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setIsSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100', status: 'active' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (debouncedCountry) params.set('country', debouncedCountry);

      const res = await fetch(`${API_URL}/api/brands?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load brands');

      let list: Brand[] = data.data?.brands ?? data.data ?? [];
      if (!Array.isArray(list)) list = [];
      list = list.filter(b => (b.productCount ?? 0) > 0);

      // Client-side sort
      if (sortKey === 'name_asc') list.sort((a, b) => a.name.localeCompare(b.name));
      else if (sortKey === 'name_desc') list.sort((a, b) => b.name.localeCompare(a.name));
      else if (sortKey === 'products') list.sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0));
      else if (sortKey === 'newest') list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

      // Letter filter
      if (activeLetter) {
        if (activeLetter === '#') {
          list = list.filter(b => /^[^a-zA-Z]/.test(b.name));
        } else {
          list = list.filter(b => b.name.toUpperCase().startsWith(activeLetter));
        }
      }

      setBrands(list);
      setPagination(data.data?.pagination ?? null);
    } catch (err: any) {
      setError(err.message || 'Could not load brands.');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, debouncedCountry, sortKey, activeLetter]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleLetterClick = (letter: string) => {
    setActiveLetter(prev => prev === letter ? null : letter);
    setSearch('');
    setDebouncedSearch('');
  };

  // Country list extracted from brands
  const countries = useMemo(() => {
    const set = new Set<string>();
    brands.forEach(b => { if (b.countryOfOrigin) set.add(b.countryOfOrigin); });
    return Array.from(set).sort();
  }, [brands]);

  const sortLabel = SORT_OPTIONS.find(o => o.value === sortKey)?.label ?? 'Sort';
  const activeFilters = [debouncedSearch, debouncedCountry, activeLetter].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Hero total={pagination?.total ?? brands.length} totalProducts={brands.reduce((sum, b) => sum + (b.productCount ?? 0), 0)} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* ── Controls Bar ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Icon.PiMagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search brands by name\u2026"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-50 outline-none transition-colors"
              />
              {search && (
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Icon.PiX size={14} />
                </button>
              )}
            </div>

            {/* Country filter */}
            <div className="relative sm:w-44">
              <Icon.PiGlobe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                placeholder="Country\u2026"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-50 outline-none transition-colors"
              />
              {countryFilter && (
                <button onClick={() => { setCountryFilter(''); setDebouncedCountry(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
          {activeFilters > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Filtering by:</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  Name: &ldquo;{debouncedSearch}&rdquo;
                  <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="ml-0.5 hover:text-red-900"><Icon.PiX size={11} /></button>
                </span>
              )}
              {debouncedCountry && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  Country: &ldquo;{debouncedCountry}&rdquo;
                  <button onClick={() => { setCountryFilter(''); setDebouncedCountry(''); }} className="ml-0.5 hover:text-blue-900"><Icon.PiX size={11} /></button>
                </span>
              )}
              {activeLetter && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  Letter: {activeLetter}
                  <button onClick={() => setActiveLetter(null)} className="ml-0.5 hover:text-purple-900"><Icon.PiX size={11} /></button>
                </span>
              )}
              {activeFilters > 1 && (
                <button
                  onClick={() => { setSearch(''); setDebouncedSearch(''); setCountryFilter(''); setDebouncedCountry(''); setActiveLetter(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear all
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {brands.length} brand{brands.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* ── Alphabet Filter ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {ALPHABET.map(letter => {
              const isActive = activeLetter === letter;
              const hasBrands = letter === '#'
                ? brands.some(b => /^[^a-zA-Z]/.test(b.name))
                : brands.some(b => b.name.toUpperCase().startsWith(letter));
              return (
                <button
                  key={letter}
                  onClick={() => handleLetterClick(letter)}
                  disabled={!hasBrands && !isActive}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-red-600 text-white shadow-sm'
                      : hasBrands
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
            <Icon.PiWarningCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchBrands} className="ml-auto text-xs text-red-700 underline">Retry</button>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────────────── */}
        {!loading && brands.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiTag size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No brands found</h3>
            {activeFilters > 0 ? (
              <>
                <p className="text-gray-400 text-sm mb-4">No results for your current filters</p>
                <button
                  onClick={() => { setSearch(''); setDebouncedSearch(''); setCountryFilter(''); setDebouncedCountry(''); setActiveLetter(null); }}
                  className="text-sm text-red-700 underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Check back soon — we&apos;re adding new brands.</p>
            )}
          </div>
        )}

        {/* ── Brands Grid ──────────────────────────────────────────────── */}
        {!loading && brands.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {brands.map((brand, i) => (
                <motion.div
                  key={brand._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <BrandCard brand={brand} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        {!loading && brands.length > 0 && (
          <div className="text-center mt-12">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
            >
              <Icon.PiShoppingCart size={17} /> Browse All Products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
