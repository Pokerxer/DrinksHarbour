'use client';

import React, { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
  return product.availableAt?.some((at: any) =>
    isSaleActive(at) &&
    at.sizes?.some((s: any) => {
      const original = s.pricing?.originalWebsitePrice ?? 0;
      const current = s.pricing?.websitePrice ?? 0;
      return original > current;
    }),
  );
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
    if (sale === 'true')                    p.set('onSale',      'true');
    if (searchParams.get('minPrice'))       p.set('minPrice',    searchParams.get('minPrice')!);
    if (searchParams.get('maxPrice'))       p.set('maxPrice',    searchParams.get('maxPrice')!);
    if (searchParams.get('minABV'))         p.set('minABV',      searchParams.get('minABV')!);
    if (searchParams.get('maxABV'))         p.set('maxABV',      searchParams.get('maxABV')!);
    if (searchParams.get('minRating'))      p.set('minRating',   searchParams.get('minRating')!);
    p.set('limit', '50');
    return `${base}?${p.toString()}`;
  }, [searchParams, searchQuery, sale]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res  = await fetch(buildApiUrl(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.data?.products) {
        setProducts(data.data.products);
        setTotalProducts(data.data.pagination?.total ?? data.data.products.length);
      } else if (data.success && data.data?.data) {
        setProducts(data.data.data);
        setTotalProducts(data.data.pagination?.total ?? data.data.data.length);
      } else if (Array.isArray(data.products)) {
        setProducts(data.products);
        setTotalProducts(data.products.length);
      } else if (Array.isArray(data)) {
        setProducts(data);
        setTotalProducts(data.length);
      } else {
        setProducts([]);
        setTotalProducts(0);
      }
    } catch (err) {
      setError('Failed to load products. Please try again later.');
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

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

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner variant="bounce" color="emerald" size="lg" text="Finding the best drinks..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 text-lg">{error}</div>
        <button onClick={() => router.refresh()} className="px-4 py-2 bg-gray-900 text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const isSalePage = sale === 'true';

  const TABS: { key: SaleTab; label: string; icon: React.ReactNode; color: string }[] = [
    {
      key: 'all',
      label: `All Deals`,
      icon: <Icon.PiTagFill size={14} />,
      color: 'from-red-500 to-orange-500',
    },
    {
      key: 'percentage',
      label: `% Off${byType.percentage.length ? ` (${byType.percentage.length})` : ''}`,
      icon: <Icon.PiPercent size={14} />,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      key: 'fixed',
      label: `₦ Fixed Off${byType.fixed.length ? ` (${byType.fixed.length})` : ''}`,
      icon: <Icon.PiCurrencyNgn size={14} />,
      color: 'from-green-500 to-emerald-500',
    },
    {
      key: 'flash_sale',
      label: `⚡ Flash Sale${byType.flash_sale.length ? ` (${byType.flash_sale.length})` : ''}`,
      icon: <Icon.PiLightningFill size={14} />,
      color: 'from-yellow-400 to-orange-500',
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">

      {/* ── Sale banner ─────────────────────────────────────────────────── */}
      {isSalePage && !searchQuery && (
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-red-600 shadow-lg">
          {/* Top row */}
          <div className="container mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow">
                <Icon.PiTagFill size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">
                  {saleTypeParam === 'flash_sale' ? '⚡ Flash Sale' :
                   saleTypeParam === 'percentage'  ? '% Off Deals' :
                   saleTypeParam === 'fixed'        ? '₦ Fixed Discounts' :
                                                     'All Deals'}
                </p>
                <p className="text-white/70 text-xs">
                  {visibleProducts.length} deal{visibleProducts.length !== 1 ? 's' : ''} available
                  {saleProducts.length !== visibleProducts.length &&
                    ` · ${saleProducts.length} total`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Flash sale countdown */}
              {saleTypeParam === 'flash_sale' && flashEndTime && (
                <div className="hidden sm:flex items-center gap-2 bg-white/20 rounded-xl px-3 py-1.5">
                  <Icon.PiClock size={14} className="text-white" />
                  <span className="text-white/80 text-xs font-medium">Ends in</span>
                  <FlashCountdown endTime={flashEndTime} />
                </div>
              )}
              <button
                onClick={clearSale}
                className="flex items-center gap-1 text-white/80 hover:text-white text-xs font-medium transition-colors"
              >
                <Icon.PiX size={14} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Sale-type tab bar */}
          <div className="container mx-auto px-4 pb-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {TABS.map(tab => {
                const active = saleTypeParam === tab.key;
                // hide tabs that have 0 products (except "all")
                if (tab.key !== 'all' && byType[tab.key as keyof typeof byType]?.length === 0) return null;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSaleType(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                      active
                        ? 'bg-white text-gray-900 shadow-md'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Flash sale mobile countdown */}
            {saleTypeParam === 'flash_sale' && flashEndTime && (
              <div className="flex sm:hidden items-center gap-2 mt-2">
                <span className="text-white/70 text-xs">Ends in</span>
                <FlashCountdown endTime={flashEndTime} />
              </div>
            )}

            {/* Per-type summary strip */}
            {saleTypeParam === 'flash_sale' && byType.flash_sale.length > 0 && (
              <p className="text-white/70 text-[11px] mt-1.5">
                Limited-time — prices reset after countdown
              </p>
            )}
            {saleTypeParam === 'fixed' && byType.fixed.length > 0 && (
              <p className="text-white/70 text-[11px] mt-1.5">
                Fixed amount deducted from the platform price
              </p>
            )}
            {saleTypeParam === 'percentage' && byType.percentage.length > 0 && (
              <p className="text-white/70 text-[11px] mt-1.5">
                Percentage discount off the selling price
              </p>
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
        <div className="container mx-auto px-4 py-16 text-center">
          <Icon.PiTagFill size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">No sale products found</h3>
          <p className="text-gray-500 mb-6 text-sm">
            {saleTypeParam !== 'all'
              ? 'No products match this discount type right now.'
              : 'There are no active sales at the moment.'}
          </p>
          {saleTypeParam !== 'all' ? (
            <button
              onClick={() => setSaleType('all')}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              View all deals
            </button>
          ) : (
            <button
              onClick={clearSale}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Browse all products
            </button>
          )}
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full" />
      </div>
    }>
      <ShopPageContent {...props} />
    </Suspense>
  );
}
