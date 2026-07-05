'use client';

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalSearchContext, useModalSearchUIContext } from '@/context/ModalSearchContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { ProductType } from '@/types/product.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = ProductType & { vendorName?: string };

// ─── Brand palette ────────────────────────────────────────────────────────────
// DrinksHarbour: deep red #b20202, bright red #ff3232, black

const BRAND = {
  ring:       'focus:border-[#b20202]',
  spinner:    'border-t-[#b20202]',
  text:       'text-[#b20202]',
  textHover:  'hover:text-[#b20202]',
  bg:         'bg-[#b20202]',
  bgHover:    'hover:bg-[#b20202]',
  bgLight:    'bg-[#b20202]/8',
  bgLighter:  'bg-[#b20202]/5',
  border:     'border-[#b20202]',
  selected:   'bg-[#b20202]/8 border-[#b20202]',
  badge:      'bg-[#b20202]/10 text-[#b20202]',
};

// ─── Static data ──────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'On Sale',
    icon: Icon.PiTag,
    href: '/shop?sale=true',
    gradient: 'from-red-500 to-red-700',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-100',
    iconColor: 'text-red-600',
  },
  {
    label: 'New Arrivals',
    icon: Icon.PiSparkle,
    href: '/shop?sort=newest',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    label: 'Bestsellers',
    icon: Icon.PiTrendUp,
    href: '/shop?sort=popular',
    gradient: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    label: 'Top Rated',
    icon: Icon.PiStarFill,
    href: '/shop?minRating=4',
    gradient: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-100',
    iconColor: 'text-yellow-600',
  },
];

const CATEGORIES = [
  { name: 'Whiskey',    emoji: '🥃', slug: 'whiskey',   color: 'bg-amber-50   border-amber-200',  text: 'text-amber-800'  },
  { name: 'Wine',       emoji: '🍷', slug: 'wine',      color: 'bg-rose-50    border-rose-200',   text: 'text-rose-800'   },
  { name: 'Beer',       emoji: '🍺', slug: 'beer',      color: 'bg-yellow-50  border-yellow-200', text: 'text-yellow-800' },
  { name: 'Champagne',  emoji: '🍾', slug: 'champagne', color: 'bg-amber-50   border-amber-200',  text: 'text-amber-800'  },
  { name: 'Vodka',      emoji: '🫗', slug: 'vodka',     color: 'bg-sky-50     border-sky-200',    text: 'text-sky-800'    },
  { name: 'Gin',        emoji: '🍸', slug: 'gin',       color: 'bg-teal-50    border-teal-200',   text: 'text-teal-800'   },
  { name: 'Rum',        emoji: '🌴', slug: 'rum',       color: 'bg-orange-50  border-orange-200', text: 'text-orange-800' },
  { name: 'Spirits',    emoji: '✨', slug: 'spirit',    color: 'bg-purple-50  border-purple-200', text: 'text-purple-800' },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function getProductImage(product: Product): string {
  if (product.primaryImage?.url) return product.primaryImage.url;
  const imgs = product.thumbImage ?? product.images ?? [];
  const first = imgs[0];
  if (!first) return '/images/product/1000x1000.png';
  return typeof first === 'string' ? first : (first as any).url ?? '/images/product/1000x1000.png';
}

function formatNGN(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function getPrice(product: Product) {
  const pr = product.priceRange;
  if (pr) return { price: pr.min ?? 0, original: pr.max !== pr.min ? pr.max : undefined };
  return { price: 0, original: undefined };
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRe(query)})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-[#b20202]/15 text-[#b20202] rounded-sm not-italic font-semibold">{p}</mark>
          : p,
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ModalSearch: React.FC = () => {
  const router    = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  const [selectedIdx,   setSelectedIdx]   = useState(-1);
  const [isListening,   setIsListening]   = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  const { openQuickview } = useModalQuickviewContext() || {};

  const { isModalOpen, closeModalSearch } = useModalSearchUIContext();
  const {
    searchQuery, setSearchQuery,
    searchResults, isSearching, searchError,
    recentSearches, removeRecentSearch, clearRecentSearches,
    popularSearches, performSearch,
  } = useModalSearchContext();

  // ── Derived ────────────────────────────────────────────────────────────────
  const products  = useMemo(() => searchResults?.products ?? [], [searchResults]);
  const hasResults = products.length > 0;
  const showDefault = !searchQuery.trim() && !isSearching;
  const showNoResults = !hasResults && !isSearching && !searchError && searchQuery.trim().length > 0;

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const t = setTimeout(() => performSearch(q), 80);
    return () => clearTimeout(t);
  }, [searchQuery, performSearch]);

  // ── Focus on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setSelectedIdx(-1);
      setExpandedId(null);
    }
  }, [isModalOpen]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      const len = products.length;
      if (e.key === 'Escape')     { closeModalSearch(); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setSelectedIdx(p => (p + 1) % len); scrollSel(); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setSelectedIdx(p => (p - 1 + len) % len); scrollSel(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIdx >= 0 && products[selectedIdx]) goProduct(products[selectedIdx]);
        else if (searchQuery.trim()) performSearch();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isModalOpen, products, selectedIdx, searchQuery]);

  function scrollSel() {
    setTimeout(() => {
      listRef.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 40);
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const goProduct = useCallback((p: Product) => {
    const slug = p.slug || p._id || (p as any).id;
    if (slug) { router.push(`/product/${slug}`); closeModalSearch(); }
  }, [router, closeModalSearch]);

  const handleQuickAdd = useCallback((p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    closeModalSearch();
    openQuickview?.(p);
  }, [openQuickview, closeModalSearch]);

  const startVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.onstart = () => setIsListening(true);
    rec.onend   = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (ev: any) => {
      const t = ev.results[0][0].transcript;
      setSearchQuery(t);
      performSearch(t);
    };
    rec.start();
  }, [setSearchQuery, performSearch]);

  const goAndClose = (href: string) => { router.push(href); closeModalSearch(); };

  if (!isModalOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-10 md:pt-16 px-3 md:px-4"
        onClick={(e) => { if (e.target === e.currentTarget) closeModalSearch(); }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />

        {/* Panel */}
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col ring-1 ring-black/5"
        >
          {/* ── Top bar with brand stripe / loading progress ── */}
          <div className="relative h-[3px] overflow-hidden">
            {/* Static brand stripe — always visible */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#b20202] via-[#ff3232] to-[#b20202] opacity-40" />
            {/* Animated sweep when searching */}
            <AnimatePresence>
              {isSearching && (
                <motion.div
                  key="search-bar"
                  className="absolute inset-y-0 left-0"
                  style={{ width: '35%', background: 'linear-gradient(to right, #b20202, #ff3232)' }}
                  animate={{ x: ['-35%', '320%'] }}
                  transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ── Search input ── */}
          <div className="px-4 md:px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">

              {/* Mic button — left side */}
              {typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
                <button
                  onClick={startVoice}
                  title={isListening ? 'Listening…' : 'Voice search'}
                  className={`flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-100 text-[#b20202] ring-2 ring-[#b20202]/30 animate-pulse'
                      : 'bg-gray-100 text-gray-400 hover:bg-[#b20202]/8 hover:text-[#b20202]'
                  }`}
                >
                  {isListening ? <Icon.PiMicrophoneFill size={20} /> : <Icon.PiMicrophone size={20} />}
                </button>
              )}

              {/* Input wrapper */}
              <div className="relative flex-1">
                <Icon.PiMagnifyingGlass
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  size={18}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, brands, categories…"
                  aria-label="Search products"
                  className={`w-full h-11 md:h-12 pl-10 pr-10 bg-gray-50 border-2 border-gray-200 ${BRAND.ring} rounded-xl text-sm md:text-base outline-none transition-all placeholder:text-gray-400 focus:bg-white`}
                />
                {/* Spinner / Clear — inside input right */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {isSearching ? (
                    <div className="w-5 h-5 rounded-full border-[2.5px] border-gray-200 border-t-[#b20202] animate-spin" />
                  ) : searchQuery ? (
                    <button
                      onClick={() => { setSearchQuery(''); setExpandedId(null); setSelectedIdx(-1); }}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 transition-colors"
                      aria-label="Clear search"
                    >
                      <Icon.PiX size={10} className="text-gray-700" />
                    </button>
                  ) : null}
                </div>
              </div>

            </div>

            {/* Result count strip */}
            {(hasResults || (isSearching && searchResults)) && (
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  {isSearching ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 border-t-[#b20202] animate-spin inline-block" />
                      <span className="text-gray-400">Searching…</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-gray-800">{searchResults!.total}</span>
                      {' '}product{searchResults!.total !== 1 ? 's' : ''} found
                      {searchResults!.totalPages > 1 && (
                        <span className="text-gray-400 ml-1">· page {searchResults!.page}/{searchResults!.totalPages}</span>
                      )}
                    </>
                  )}
                </span>
                {!isSearching && (
                  <button
                    onClick={() => goAndClose(`/shop?search=${encodeURIComponent(searchQuery)}`)}
                    className={`flex items-center gap-1 text-xs font-semibold ${BRAND.text} ${BRAND.textHover} transition-colors`}
                  >
                    View all <Icon.PiArrowRight size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain" id="search-results">
            <AnimatePresence mode="wait">

              {/* ─ Results ─ */}
              {hasResults && !isSearching && (
                <motion.div
                  key="results"
                  {...fade}
                  className="p-4 md:p-5 space-y-2 relative"
                >
                  {products.map((product, idx) => {
                    const { price, original } = getPrice(product);
                    const id        = (product as any).id ?? product._id ?? '';
                    const inStock   = product.availability?.status !== 'out_of_stock';
                    const stock     = product.availability?.totalStock ?? 0;
                    const isSel     = idx === selectedIdx;
                    const isExpanded= expandedId === id;
                    const rating    = product.stats?.averageRating ?? (product as any).rate ?? 0;

                    return (
                      <motion.div
                        key={id}
                        data-sel={isSel}
                        layout
                        whileHover={{ scale: 1.005 }}
                        onClick={() => isExpanded ? goProduct(product) : setExpandedId(id)}
                        className={`flex gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${isSel ? BRAND.selected : 'border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
                        role="option"
                        aria-selected={isSel}
                      >
                        {/* Image */}
                        <div className="relative w-16 h-16 md:w-[72px] md:h-[72px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <Image src={getProductImage(product)} alt={product.name} fill sizes="72px" className="object-cover" />
                          {original && (
                            <span className="absolute top-0.5 left-0.5 px-1 py-[1px] bg-[#b20202] text-white text-[9px] font-bold rounded leading-tight">
                              SALE
                            </span>
                          )}
                          {!inStock && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-white text-[9px] font-bold text-center px-1 leading-tight">Out of Stock</span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            <Highlight text={product.name} query={searchQuery} />
                          </p>
                          {product.category && (
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                              {product.category.name}{product.brand ? ` · ${product.brand.name}` : ''}
                            </p>
                          )}
                          {rating > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Icon.PiStarFill size={10} className="text-amber-400" />
                              <span className="text-[11px] text-gray-500">{rating.toFixed(1)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`font-bold text-sm ${BRAND.text}`}>{formatNGN(price)}</span>
                            {original && (
                              <span className="text-xs text-gray-400 line-through">{formatNGN(original)}</span>
                            )}
                            {inStock && stock > 0 && stock <= 10 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                                {stock} left
                              </span>
                            )}
                          </div>

                          {/* Expanded quick-add */}
                          {isExpanded && inStock && (
                            <motion.button
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              onClick={(e) => handleQuickAdd(product, e)}
                              className={`mt-2 w-full py-1.5 ${BRAND.bg} text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity`}
                            >
                              <Icon.PiShoppingCart size={14} />
                              Quick View
                            </motion.button>
                          )}
                        </div>

                        {isSel && <Icon.PiArrowRight size={16} className={`shrink-0 self-center ${BRAND.text}`} />}
                      </motion.div>
                    );
                  })}

                  <p className="pt-1 text-center text-[11px] text-gray-300">
                    <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">↑↓</kbd> navigate &nbsp;
                    <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">↵</kbd> open
                  </p>
                </motion.div>
              )}

              {/* ─ Loading skeletons ─ */}
              {isSearching && (
                <motion.div key="loading" {...fade} className="p-4 md:p-5 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3.5 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                        <div className="h-2.5 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                        <div className="h-3 bg-gray-100 rounded-full w-1/4 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ─ Error ─ */}
              {searchError && (
                <motion.div key="error" {...fade} className="py-12 px-6 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                    <Icon.PiWarning size={28} className="text-red-400" />
                  </div>
                  <p className="text-sm text-gray-600 font-medium mb-4">{searchError}</p>
                  <button onClick={() => performSearch()} className={`px-5 py-2 ${BRAND.bg} text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity`}>
                    Try Again
                  </button>
                </motion.div>
              )}

              {/* ─ No results ─ */}
              {showNoResults && !searchError && (
                <motion.div key="no-results" {...fade} className="py-10 px-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icon.PiMagnifyingGlass size={30} className="text-gray-300" />
                  </div>
                  <p className="font-semibold text-gray-700 mb-1">No results for &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-xs text-gray-400 mb-5">Try a different spelling or browse a category below</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Whiskey', 'Red Wine', 'Beer', 'Gin', 'Vodka'].map((t) => (
                      <button key={t} onClick={() => { setSearchQuery(t); performSearch(t); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:${BRAND.bg} hover:text-white transition-all`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─ Default (empty query) ─ */}
              {showDefault && (
                <motion.div key="default" {...fade} className="p-4 md:p-5 space-y-5">

                  {/* Quick Actions */}
                  <section>
                    <SectionTitle>Quick Actions</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {QUICK_ACTIONS.map((a) => (
                        <button
                          key={a.label}
                          onClick={() => goAndClose(a.href)}
                          className={`group flex flex-col items-center gap-1.5 p-3 md:p-3.5 rounded-xl border ${a.border} ${a.bg} hover:shadow-sm transition-all hover:-translate-y-0.5`}
                        >
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                            <a.icon size={18} className="text-white" />
                          </div>
                          <span className={`text-xs font-semibold ${a.text}`}>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-2.5">
                        <SectionTitle inline>Recent</SectionTitle>
                        <button onClick={clearRecentSearches} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.slice(0, 6).map((s) => (
                          <button
                            key={s.query}
                            onClick={() => { setSearchQuery(s.query); performSearch(s.query); }}
                            className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 bg-gray-100 hover:bg-[#b20202]/8 rounded-full text-xs text-gray-700 hover:text-[#b20202] transition-all"
                          >
                            <Icon.PiClock size={11} className="text-gray-400 group-hover:text-[#b20202]/60 shrink-0" />
                            <span className="max-w-[90px] truncate">{s.query}</span>
                            <span className="text-[10px] text-gray-400 hidden md:inline shrink-0">{timeAgo(s.timestamp)}</span>
                            <span
                              onClick={(e) => { e.stopPropagation(); removeRecentSearch(s.query); }}
                              className="w-4 h-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-300 transition-all ml-0.5"
                            >
                              <Icon.PiX size={9} className="text-gray-500" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Categories */}
                  <section>
                    <SectionTitle>Browse Categories</SectionTitle>
                    <div className="grid grid-cols-4 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.slug}
                          onClick={() => goAndClose(`/shop?category=${cat.slug}`)}
                          className={`flex flex-col items-center gap-1.5 p-2.5 md:p-3 rounded-xl border ${cat.color} hover:shadow-md hover:-translate-y-0.5 transition-all group`}
                        >
                          <span className="text-2xl md:text-3xl leading-none group-hover:scale-110 transition-transform">
                            {cat.emoji}
                          </span>
                          <span className={`text-[10px] md:text-xs font-semibold ${cat.text} text-center leading-tight`}>
                            {cat.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Popular Searches */}
                  <section>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <SectionTitle inline>Trending Searches</SectionTitle>
                      <Icon.PiFire size={14} className="text-[#b20202] mb-[1px]" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {popularSearches.map((term, i) => (
                        <button
                          key={term}
                          onClick={() => { setSearchQuery(term); performSearch(term); }}
                          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-[#b20202] hover:bg-[#b20202]/5 transition-all text-xs font-medium text-gray-600 hover:text-[#b20202]"
                        >
                          <span className="w-4 h-4 rounded-full bg-gray-100 group-hover:bg-[#b20202]/10 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:text-[#b20202] transition-colors shrink-0">
                            {i + 1}
                          </span>
                          {term}
                        </button>
                      ))}
                    </div>
                  </section>

                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-4 md:px-5 py-3 bg-gray-50/80 border-t border-gray-100">
            <button onClick={closeModalSearch} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <Icon.PiXBold size={13} />
              <span className="hidden md:inline">Close</span>
              <kbd className="hidden md:inline px-1 py-0.5 bg-gray-200 rounded text-[10px] ml-1">ESC</kbd>
            </button>
            <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-400">
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">↵</kbd> open</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <span className="hidden md:inline">Powered by</span>
              <span className="font-bold text-[#b20202]">DrinksHarbour</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Micro components ─────────────────────────────────────────────────────────

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
  transition: { duration: 0.15 },
};

function SectionTitle({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <h3 className={`text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-gray-400 ${inline ? '' : 'mb-2.5'}`}>
      {children}
    </h3>
  );
}

export default ModalSearch;
