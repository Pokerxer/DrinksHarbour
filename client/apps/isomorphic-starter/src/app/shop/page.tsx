'use client';

import React, { useEffect, useState, useCallback, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// In-memory cache: keyed by API URL, TTL 30 seconds
const _shopCache = new Map<string, { data: any[]; total: number; ts: number }>();
const SHOP_CACHE_TTL = 30_000;
import Shop from '@/components/Shop';
import LoadingSpinner from '@/components/loader/LoadingSpinner';
import * as Icon from 'react-icons/pi';
import RecommendedForYou from '@/components/Shop/RecommendedForYou';

interface PageProps {
  params?: { slug?: string };
}

interface FilterState {
  size: string | null;
  color: string | null;
  brand: string | string[] | null;
  priceRange: { min: number; max: number };
  showOnlySale: boolean;
  sortOption: string;
  originCountry: string | string[] | null;
  categoryType: string | string[] | null;
  subCategoryType: string | string[] | null;
  flavorCategory: string | string[] | null;
  minRating: number | null;
  search: string | null;
  abvRange: { min: number; max: number } | null;
  volumeRange: string | null;
}

// ─── Flash Sale Countdown ────────────────────────────────────────────────────
function FlashCountdown({ endTime }: { endTime: Date }) {
  const [left, setLeft] = useState({ h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    const tick = () => {
      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) { setLeft({ h: 0, m: 0, s: 0, expired: true }); return; }
      setLeft({
        h: Math.floor(diff / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1_000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (left.expired) return <span className="text-white/80 text-xs font-medium">Ended</span>;

  const Box = ({ v, label }: { v: number; label: string }) => (
    <span className="flex items-center gap-0.5">
      <span className="bg-white/20 rounded px-1.5 py-0.5 font-mono font-bold text-sm tabular-nums">
        {String(v).padStart(2, '0')}
      </span>
      <span className="text-white/70 text-[10px]">{label}</span>
    </span>
  );

  return (
    <span className="flex items-center gap-1">
      <Icon.PiClock size={14} className="text-white/70" />
      <Box v={left.h} label="h" />
      <span className="text-white/60 font-bold">:</span>
      <Box v={left.m} label="m" />
      <span className="text-white/60 font-bold">:</span>
      <Box v={left.s} label="s" />
    </span>
  );
}

// ─── Sale type helpers ───────────────────────────────────────────────────────
type SaleTab = 'all' | 'percentage' | 'fixed' | 'flash_sale';

function getProductSaleType(product: any): string | null {
  const entry = product.availableAt?.find(
    (at: any) => at.isOnSale && (at.saleDiscountValue > 0 || at.discount?.value > 0),
  );
  return entry?.saleType || entry?.discount?.type || null;
}

function isSaleActive(at: any): boolean {
  if (!at.isOnSale) return false;
  if (at.discount?.value > 0 && !at.saleDiscountValue) {
    // Check discount object for active discount
    const now = Date.now();
    const start = at.discount?.startDate ? new Date(at.discount.startDate).getTime() : null;
    const end = at.discount?.endDate ? new Date(at.discount.endDate).getTime() : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  }
  if (!at.saleDiscountValue) return false;
  const now = Date.now();
  const start = at.saleStartDate ? new Date(at.saleStartDate).getTime() : null;
  const end   = at.saleEndDate   ? new Date(at.saleEndDate).getTime()   : null;
  if (start && now < start) return false;
  if (end   && now > end)   return false;
  return true;
}

function hasRealPriceDrop(product: any): boolean {
  return product.availableAt?.some((at: any) => {
    if (!isSaleActive(at)) return false;
    // Accept a discount value OR a real price drop in sizes pricing
    if ((at.saleDiscountValue ?? 0) > 0) return true;
    if ((at.discount?.value ?? 0) > 0) return true;
    return at.sizes?.some((s: any) => {
      const original = s.pricing?.originalWebsitePrice ?? 0;
      const current  = s.pricing?.websitePrice ?? 0;
      return original > current;
    });
  }) ?? false;
}

// ─── Page ────────────────────────────────────────────────────────────────────
function ShopPageContent({ params }: PageProps) {
  const searchParams = useSearchParams();
  const router  = useRouter();
  const pathname = usePathname();

  // URL params
  const categoryParam    = searchParams.get('category');
  const subcategoryParam = searchParams.get('subcategory');
  const brandParam       = searchParams.get('brand');
  const originParam      = searchParams.get('origin');
  const flavorParam      = searchParams.get('flavor');
  const volumeParam      = searchParams.get('volume');
  const sizeParam        = searchParams.get('size');
  const sort             = searchParams.get('sort');
  const sale             = searchParams.get('sale');
  const saleTypeParam    = (searchParams.get('saleType') || 'all') as SaleTab;
  const searchQuery      = searchParams.get('search');
  const minPriceParam    = searchParams.get('minPrice');
  const maxPriceParam    = searchParams.get('maxPrice');
  const minABVParam      = searchParams.get('minABV');
  const maxABVParam      = searchParams.get('maxABV');
  const minRatingParam   = searchParams.get('minRating');

  const category   = categoryParam?.includes(',')    ? categoryParam.split(',')    : categoryParam;
  const subcategory = subcategoryParam?.includes(',') ? subcategoryParam.split(',') : subcategoryParam;
  const brand      = brandParam?.includes(',')        ? brandParam.split(',')        : brandParam;
  const origin     = originParam?.includes(',')       ? originParam.split(',')       : originParam;
  const flavor     = flavorParam?.includes(',')       ? flavorParam.split(',')       : flavorParam;

  const buildInitialFilters = useCallback((): Partial<FilterState> => {
    const initial: Partial<FilterState> = {
      categoryType:    category    || null,
      subCategoryType: subcategory || null,
      brand:           brand       || null,
      originCountry:   origin      || null,
      flavorCategory:  flavor      || null,
      sortOption:      sort        || '',
      showOnlySale:    sale === 'true',
      size:            sizeParam   || null,
      volumeRange:     volumeParam || null,
    };
    if (minPriceParam || maxPriceParam) {
      initial.priceRange = {
        min: minPriceParam ? parseInt(minPriceParam, 10) : 0,
        max: maxPriceParam ? parseInt(maxPriceParam, 10) : 100000,
      };
    }
    if (minABVParam || maxABVParam) {
      initial.abvRange = {
        min: minABVParam ? parseFloat(minABVParam) : 0,
        max: maxABVParam ? parseFloat(maxABVParam) : 100,
      };
    }
    if (minRatingParam) {
      const rating = parseInt(minRatingParam, 10);
      if (rating >= 1 && rating <= 5) initial.minRating = rating;
    }
    return initial;
  }, [category, subcategory, brand, origin, flavor, sort, sale, sizeParam, volumeParam,
      minPriceParam, maxPriceParam, minABVParam, maxABVParam, minRatingParam]);

  const [initialFilters] = useState<Partial<FilterState>>(buildInitialFilters);
  const [products,       setProducts]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [totalProducts,  setTotalProducts]  = useState(0);
  const [layoutCol,      setLayoutCol]      = useState(4);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── API URL ──────────────────────────────────────────────────────────────
  const buildApiUrl = useCallback(() => {
    const base = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/products/search`;
    const p = new URLSearchParams();
    if (searchQuery?.trim())                p.set('q',           searchQuery.trim());
    if (searchParams.get('category'))       p.set('category',    searchParams.get('category')!);
    if (searchParams.get('subcategory'))    p.set('subCategory', searchParams.get('subcategory')!);
    if (searchParams.get('brand'))          p.set('brand',       searchParams.get('brand')!);
    if (searchParams.get('origin'))         p.set('origin',      searchParams.get('origin')!);
    if (searchParams.get('flavor'))         p.set('flavor',      searchParams.get('flavor')!);
    if (searchParams.get('volume'))         p.set('volume',      searchParams.get('volume')!);
    if (searchParams.get('size'))           p.set('size',        searchParams.get('size')!);
    if (searchParams.get('sort'))           p.set('sort',        searchParams.get('sort')!);
    if (sale === 'true') {
      p.set('onSale', 'true');
      // Pass saleType so backend can pre-filter by discount type
      if (saleTypeParam && saleTypeParam !== 'all') p.set('saleType', saleTypeParam);
    }
    if (searchParams.get('minPrice'))       p.set('minPrice',    searchParams.get('minPrice')!);
    if (searchParams.get('maxPrice'))       p.set('maxPrice',    searchParams.get('maxPrice')!);
    if (searchParams.get('minABV'))         p.set('minABV',      searchParams.get('minABV')!);
    if (searchParams.get('maxABV'))         p.set('maxABV',      searchParams.get('maxABV')!);
    if (searchParams.get('minRating'))      p.set('minRating',   searchParams.get('minRating')!);
    // Fetch more products on the sale page so we don't miss deals past position 50
    p.set('limit', sale === 'true' ? '200' : '50');
    return `${base}?${p.toString()}`;
  }, [searchParams, searchQuery, sale]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    const url = buildApiUrl();

    // Serve from cache if fresh
    const cached = _shopCache.get(url);
    if (cached && Date.now() - cached.ts < SHOP_CACHE_TTL) {
      setProducts(cached.data);
      setTotalProducts(cached.total);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let prods: any[] = [];
      let total = 0;
      if (data.success && data.data?.products) {
        prods = data.data.products;
        total = data.data.pagination?.total ?? prods.length;
      } else if (data.success && data.data?.data) {
        prods = data.data.data;
        total = data.data.pagination?.total ?? prods.length;
      } else if (Array.isArray(data.products)) {
        prods = data.products;
        total = prods.length;
      } else if (Array.isArray(data)) {
        prods = data;
        total = prods.length;
      }
      _shopCache.set(url, { data: prods, total, ts: Date.now() });
      setProducts(prods);
      setTotalProducts(total);
    } catch {
      setError('Failed to load products. Please try again later.');
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl]);

  // Debounce rapid URL-param changes (e.g. slider dragging) by 200ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchProducts(); }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchProducts]);

  // ── Sale-type filtering (client-side) ────────────────────────────────────
  // Split products into buckets: only products with a real price drop
  const saleProducts = useMemo(
    () => products.filter(hasRealPriceDrop),
    [products],
  );

  const byType = useMemo(() => ({
    percentage: saleProducts.filter(p => getProductSaleType(p) === 'percentage'),
    fixed:      saleProducts.filter(p => getProductSaleType(p) === 'fixed'),
    flash_sale: saleProducts.filter(p => getProductSaleType(p) === 'flash_sale'),
  }), [saleProducts]);

  // Products shown to the Shop grid — all when no sale, filtered subset when sale active
  const visibleProducts = useMemo(() => {
    if (sale !== 'true') return products;
    if (saleTypeParam === 'all') return saleProducts;
    return byType[saleTypeParam] ?? saleProducts;
  }, [sale, saleTypeParam, products, saleProducts, byType]);

  // Flash sale end time — earliest saleEndDate across active flash_sale products
  const flashEndTime = useMemo(() => {
    const times = byType.flash_sale
      .flatMap(p => p.availableAt ?? [])
      .filter((at: any) => at.saleType === 'flash_sale' && at.saleEndDate)
      .map((at: any) => new Date(at.saleEndDate).getTime())
      .filter(t => t > Date.now())
      .sort((a: number, b: number) => a - b);
    return times.length ? new Date(times[0]) : null;
  }, [byType.flash_sale]);

  // Best discount % across all sale products
  const bestDiscountPct = useMemo(() => {
    if (!saleProducts.length) return 0;
    return Math.max(0, ...saleProducts.map(p => {
      const vendor = p.availableAt?.find((at: any) => isSaleActive(at));
      if (!vendor) return 0;
      if (vendor.saleDiscountValue > 0 && vendor.saleType === 'percentage') return vendor.saleDiscountValue;
      const size = vendor.sizes?.[0];
      const orig = size?.pricing?.originalWebsitePrice ?? 0;
      const curr = size?.pricing?.websitePrice ?? 0;
      if (orig > curr && orig > 0) return Math.round((1 - curr / orig) * 100);
      return 0;
    }));
  }, [saleProducts]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const setSaleType = (type: SaleTab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('sale', 'true');
    if (type === 'all') p.delete('saleType');
    else p.set('saleType', type);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const clearSale = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('sale');
    p.delete('saleType');
    p.delete('search');
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  // ── TABS must be defined before any early returns (Rules of Hooks) ─────────
  const isSalePage = sale === 'true';

  const TABS = useMemo(() => [
    {
      key: 'all' as SaleTab,
      label: 'All Deals',
      icon: <Icon.PiTagFill size={14} />,
      color: 'from-red-700 to-red-900',
    },
    {
      key: 'percentage' as SaleTab,
      label: `% Off${byType.percentage.length ? ` (${byType.percentage.length})` : ''}`,
      icon: <Icon.PiPercent size={14} />,
      color: 'from-red-600 to-red-800',
    },
    {
      key: 'fixed' as SaleTab,
      label: `₦ Fixed Off${byType.fixed.length ? ` (${byType.fixed.length})` : ''}`,
      icon: <Icon.PiCurrencyNgn size={14} />,
      color: 'from-red-500 to-red-700',
    },
    {
      key: 'flash_sale' as SaleTab,
      label: `⚡ Flash Sale${byType.flash_sale.length ? ` (${byType.flash_sale.length})` : ''}`,
      icon: <Icon.PiLightningFill size={14} />,
      color: 'from-red-800 to-red-950',
    },
  ], [byType.percentage.length, byType.fixed.length, byType.flash_sale.length]);

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        {isSalePage && (
          <div className="h-40 bg-gradient-to-br from-red-950 via-red-800 to-rose-700 animate-pulse" />
        )}
        <div className="min-h-[50vh] flex items-center justify-center">
          <LoadingSpinner variant="bounce" color="rose" size="lg" text={isSalePage ? 'Loading deals…' : 'Finding the best drinks…'} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-red-50 to-white">
        <div className="text-red-700 text-lg font-medium">{error}</div>
        <button
          onClick={() => router.refresh()}
          className="px-5 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-xl font-semibold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">

      {/* ── Sale hero banner ─────────────────────────────────────────────── */}
      {isSalePage && !searchQuery && (
        <div className="relative overflow-hidden bg-gradient-to-br from-red-950 via-red-800 to-rose-700">
          {/* Decorative rings */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-52 h-52 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-red-600/20 blur-3xl rounded-full" />

          <div className="relative container mx-auto px-4 pt-6 pb-4">
            {/* Top: headline + close */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                {/* Animated badge */}
                <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-lg ring-2 ring-white/30">
                  {saleTypeParam === 'flash_sale'
                    ? <Icon.PiLightningFill size={24} className="text-yellow-300" />
                    : saleTypeParam === 'percentage'
                    ? <Icon.PiPercent size={24} className="text-white" />
                    : saleTypeParam === 'fixed'
                    ? <Icon.PiCurrencyNgn size={24} className="text-white" />
                    : <Icon.PiTagFill size={24} className="text-white" />
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      LIVE DEALS
                    </span>
                    {bestDiscountPct > 0 && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Up to {bestDiscountPct}% off
                      </span>
                    )}
                  </div>
                  <h1 className="text-white font-black text-xl sm:text-2xl leading-tight">
                    {saleTypeParam === 'flash_sale' ? '⚡ Flash Sale'
                     : saleTypeParam === 'percentage' ? 'Percentage Discounts'
                     : saleTypeParam === 'fixed'      ? 'Fixed Price Cuts'
                     :                                  'All Deals & Discounts'}
                  </h1>
                  <p className="text-white/70 text-xs mt-0.5">
                    {visibleProducts.length > 0
                      ? `${visibleProducts.length} deal${visibleProducts.length !== 1 ? 's' : ''} available`
                      : 'Loading deals…'}
                    {saleProducts.length > 0 && saleTypeParam !== 'all' &&
                      ` · ${saleProducts.length} total across all types`}
                  </p>
                </div>
              </div>

              <button
                onClick={clearSale}
                className="flex-shrink-0 flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium transition-colors mt-1"
              >
                <Icon.PiX size={15} />
                <span className="hidden sm:inline">Exit sale</span>
              </button>
            </div>

            {/* Stats strip */}
            {saleProducts.length > 0 && (
              <div className="flex items-center gap-3 mb-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5 flex-shrink-0">
                  <Icon.PiTagFill size={13} className="text-white/80" />
                  <span className="text-white text-xs font-semibold">{saleProducts.length} deals</span>
                </div>
                {bestDiscountPct > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5 flex-shrink-0">
                    <Icon.PiTrendDown size={13} className="text-green-300" />
                    <span className="text-white text-xs font-semibold">Up to {bestDiscountPct}% off</span>
                  </div>
                )}
                {byType.flash_sale.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/30 rounded-xl px-3 py-1.5 flex-shrink-0">
                    <Icon.PiLightningFill size={13} className="text-yellow-300" />
                    <span className="text-yellow-200 text-xs font-semibold">{byType.flash_sale.length} flash</span>
                  </div>
                )}
                {flashEndTime && saleTypeParam === 'flash_sale' && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 flex-shrink-0">
                    <Icon.PiClock size={13} className="text-white/80" />
                    <span className="text-white/80 text-xs">Ends in</span>
                    <FlashCountdown endTime={flashEndTime} />
                  </div>
                )}
              </div>
            )}

            {/* Discount-type tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {TABS.map(tab => {
                const count = tab.key === 'all' ? saleProducts.length : byType[tab.key as keyof typeof byType]?.length ?? 0;
                if (tab.key !== 'all' && count === 0) return null;
                const active = saleTypeParam === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSaleType(tab.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                      active
                        ? 'bg-white text-red-800 shadow-md scale-105'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {tab.icon}
                    {tab.key === 'all' ? 'All Deals' : tab.label.split('(')[0].trim()}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      active ? 'bg-red-100 text-red-700' : 'bg-white/20 text-white'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Flash sale mobile countdown */}
            {saleTypeParam === 'flash_sale' && flashEndTime && (
              <div className="flex sm:hidden items-center gap-2 mt-3">
                <span className="text-white/70 text-xs">Sale ends in</span>
                <FlashCountdown endTime={flashEndTime} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Search results header ────────────────────────────────────────── */}
      {searchQuery && (
        <div className="bg-white border-b border-gray-200 py-3 sm:py-4">
          <div className="container mx-auto px-3 sm:px-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                "{searchQuery}"
              </h1>
              <p className="text-gray-500 text-sm">
                {totalProducts} product{totalProducts !== 1 ? 's' : ''} found
              </p>
            </div>
            <button
              onClick={clearSale}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Icon.PiX size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* ── No sale results ──────────────────────────────────────────────── */}
      {isSalePage && !loading && visibleProducts.length === 0 && (
        <div className="container mx-auto px-4 py-20 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-50 border-2 border-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon.PiTagFill size={36} className="text-red-300" />
          </div>
          <h3 className="text-2xl font-black text-gray-800 mb-2">
            {saleTypeParam !== 'all' ? 'No deals of this type' : 'No active deals right now'}
          </h3>
          <p className="text-gray-500 mb-8 text-sm max-w-xs">
            {saleTypeParam !== 'all'
              ? `There are no ${saleTypeParam.replace('_', ' ')} discounts running right now. Try another type.`
              : 'Check back soon — we add new deals regularly.'}
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            {saleTypeParam !== 'all' && saleProducts.length > 0 && (
              <button
                onClick={() => setSaleType('all')}
                className="px-5 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-xl text-sm font-semibold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
              >
                View all {saleProducts.length} deals
              </button>
            )}
            <button
              onClick={clearSale}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all"
            >
              Browse all products
            </button>
          </div>
        </div>
      )}

      {/* ── Product grid ─────────────────────────────────────────────────── */}
      {(!isSalePage || visibleProducts.length > 0) && (
        <Shop
          productPerPage={12}
          data={visibleProducts}
          productStyle="style-1"
          searchQuery={searchQuery}
          layoutCol={layoutCol}
          onLayoutChange={setLayoutCol}
          initialFilters={initialFilters}
        />
      )}

      {/* ── Recommended For You ──────────────────────────────────────────── */}
      {!isSalePage && (
        <div className="mt-8">
          <RecommendedForYou maxItems={12} layoutCol={layoutCol} />
        </div>
      )}
    </div>
  );
}

export default function ShopPage(props: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-red-50 to-white">
        <div className="animate-spin w-12 h-12 border-4 border-red-100 border-t-red-700 rounded-full" />
      </div>
    }>
      <ShopPageContent {...props} />
    </Suspense>
  );
}
