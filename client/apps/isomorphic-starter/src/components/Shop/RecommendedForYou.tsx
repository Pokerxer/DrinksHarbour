'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/loader/Skeleton';
import * as Icon from 'react-icons/pi';
import { getProductGridLayoutClasses } from './ProductGrid';

interface RecommendedForYouProps {
  maxItems?: number;
  layoutCol?: number;
}

interface SectionConfig {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
}

type SectionKey = 'recommended' | 'trending' | 'bestsellers' | 'newArrivals';

const SECTION_MAP: Record<SectionKey, SectionConfig> = {
  recommended: {
    title: 'Recommended For You',
    subtitle: 'Based on your browsing history',
    icon: <Icon.PiSparkle size={20} />,
    iconBgColor: 'bg-rose-100',
    iconColor: 'text-rose-600',
  },
  trending: {
    title: 'Trending Now',
    subtitle: 'Popular with other shoppers',
    icon: <Icon.PiTrendUp size={20} />,
    iconBgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  bestsellers: {
    title: 'Best Sellers',
    subtitle: 'Most purchased items',
    icon: <Icon.PiFire size={20} />,
    iconBgColor: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  newArrivals: {
    title: 'New Arrivals',
    subtitle: 'Fresh additions to our catalog',
    icon: <Icon.PiSparkle size={20} />,
    iconBgColor: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
};

const SECTION_KEYS: SectionKey[] = ['recommended', 'trending', 'bestsellers', 'newArrivals'];

const API_ENDPOINTS: Record<SectionKey, string> = {
  recommended: '/api/user/recommendations',
  trending: '/api/products/trending',
  bestsellers: '/api/products/bestsellers',
  newArrivals: '/api/products/new-arrivals',
};

// ─── Module-level utilities (stable references, no per-render cost) ───────────

const _recCache = new Map<string, { data: any[]; ts: number }>();
const REC_CACHE_TTL = 60_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 6000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function normalizeProducts(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.products && Array.isArray(data.products)) return data.products;
  if (data?.data?.products && Array.isArray(data.data.products)) return data.data.products;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

function isProductNew(createdAt: string): boolean {
  try {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(createdAt).getTime() > weekAgo;
  } catch {
    return false;
  }
}

function normalizeProduct(p: any): any {
  const id = p._id ?? p.id;
  const primaryImage =
    p.primaryImage ??
    p.images?.find((i: any) => i.isPrimary) ??
    p.images?.[0] ??
    null;

  const allPrices = (p.availableAt || []).flatMap((store: any) =>
    (store.sizes || []).map((size: any) => size.pricing?.websitePrice).filter(Boolean)
  );
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : (p.priceRange?.min ?? 0);
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : (p.priceRange?.max ?? minPrice);
  const currency = p.priceRange?.currency ?? 'NGN';

  const disc = p.discount;
  const hasRealDiscount = disc?.savings > 0;
  const originPrice = hasRealDiscount ? (disc.originalPrice ?? minPrice) : minPrice;
  const discountPct = hasRealDiscount
    ? (disc.type === 'percentage'
        ? disc.value
        : disc.originalPrice > 0
          ? Math.round((disc.savings / disc.originalPrice) * 100)
          : 0)
    : undefined;

  const vendorOnSale = (p.availableAt || []).some((v: any) => v.isOnSale === true);
  const isOnSale = vendorOnSale || hasRealDiscount;

  const rating = p.averageRating ?? p.rating ?? p.stats?.averageRating ?? 0;
  const reviewCount = p.reviewCount ?? p.stats?.reviewCount ?? 0;
  const totalSold = p.totalSold ?? p.stats?.totalSold ?? p.trending?.quantitySold ?? 0;
  const totalStock =
    p.totalStock ?? p.availability?.totalStock ?? p.stockInfo?.totalStock ?? p.stats?.totalStock ?? 0;
  const tenantCount = p.availability?.tenantCount ?? p.tenantCount ?? p.tenants?.length ?? 0;

  return {
    ...p,
    _id: id,
    flavors: p.flavors ?? [],
    images: p.images ?? [],
    primaryImage,
    priceRange: {
      min: minPrice,
      max: maxPrice,
      currency,
      formatted: p.priceRange?.formatted,
      display: p.priceRange?.display ?? `₦${minPrice.toLocaleString()}`,
    },
    price: minPrice,
    originPrice,
    discount: discountPct,
    sale: isOnSale,
    new: p.badge?.type === 'new-arrival' || isProductNew(p.createdAt),
    averageRating: rating,
    reviewCount,
    totalSold,
    originCountry: p.originCountry ?? p.country ?? '',
    stockInfo: {
      totalStock,
      availableStock: totalStock,
      tenants: tenantCount,
      totalSizes: p.sizeCount ?? p.sizes?.length ?? 0,
    },
    availability: {
      status:
        p.availability?.status ??
        (p.isInStock !== false && totalStock > 0 ? 'in_stock' : 'out_of_stock'),
      stockLevel:
        p.availability?.stockLevel ?? p.stockLevel ?? (totalStock > 0 ? 'medium' : 'out'),
      availableFrom: tenantCount,
      message: p.availability?.message ?? p.availability?.availabilitySummary ?? '',
    },
  };
}

async function loadSectionData(
  section: SectionKey,
  auth: boolean,
  maxItems: number
): Promise<any[]> {
  const cacheKey = `${section}:${auth ? 'auth' : 'anon'}:${maxItems}`;
  const cached = _recCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < REC_CACHE_TTL) return cached.data;

  const endpoints =
    section === 'recommended'
      ? auth
        ? [API_ENDPOINTS.recommended, API_ENDPOINTS.trending]
        : [API_ENDPOINTS.trending]
      : [API_ENDPOINTS[section]];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(`${endpoint}?limit=${maxItems}`);
      if (response.ok) {
        const data = await response.json();
        const prods = normalizeProducts(data).map(normalizeProduct);
        if (data.success !== false && prods.length > 0) {
          _recCache.set(cacheKey, { data: prods, ts: Date.now() });
          return prods;
        }
      }
    } catch {
      continue;
    }
  }
  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

const RecommendedForYou: React.FC<RecommendedForYouProps> = ({
  maxItems = 12,
  layoutCol = 4,
}) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSection, setCurrentSection] = useState<SectionKey>('recommended');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const initDoneRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sectionConfig = SECTION_MAP[currentSection];
  const displayedProducts = useMemo(() => products.slice(0, maxItems), [products, maxItems]);

  const fetchSection = useCallback(
    async (section: SectionKey, auth: boolean) => {
      setHasError(false);
      const prods = await loadSectionData(section, auth, maxItems);
      if (prods.length > 0) {
        setProducts(prods);
        setFadeKey(k => k + 1);
      } else {
        setHasError(true);
      }
    },
    [maxItems]
  );

  const handleSectionChange = useCallback(
    (section: SectionKey) => {
      if (section === currentSection) return;
      setCurrentSection(section);
      setLoading(true);
      fetchSection(section, isAuthenticated).finally(() => setLoading(false));
    },
    [fetchSection, isAuthenticated, currentSection]
  );

  const handleRefresh = useCallback(() => {
    // Bust cache for current section then reload
    const cacheKey = `${currentSection}:${isAuthenticated ? 'auth' : 'anon'}:${maxItems}`;
    _recCache.delete(cacheKey);
    setIsRefreshing(true);
    fetchSection(currentSection, isAuthenticated).finally(() => setIsRefreshing(false));
  }, [fetchSection, currentSection, isAuthenticated, maxItems]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const init = async () => {
      // Fire trending + auth check in parallel
      const [trendingProducts, isAuth] = await Promise.all([
        loadSectionData('recommended', false, maxItems),
        fetchWithTimeout('/api/auth/me', {}, 3000)
          .then(r => (r.ok ? r.json() : null))
          .then(data => !!data?.user)
          .catch(() => false),
      ]);

      setIsAuthenticated(isAuth);

      if (trendingProducts.length > 0) {
        setProducts(trendingProducts);
        setLoading(false);

        // Silently upgrade to personalized if authenticated
        if (isAuth) {
          const personalized = await loadSectionData('recommended', true, maxItems);
          if (personalized.length > 0) {
            setProducts(personalized);
            setFadeKey(k => k + 1);
          }
        }
      } else {
        setHasError(true);
        setLoading(false);
      }
    };

    init();
  }, [maxItems]);

  // ─── Shared header ──────────────────────────────────────────────────────────
  const SectionHeader = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 ${sectionConfig.iconBgColor} ${sectionConfig.iconColor} rounded-xl`}>
          {sectionConfig.icon}
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            {sectionConfig.title}
          </h2>
          <p className="text-sm text-gray-500">{sectionConfig.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <Icon.PiArrowClockwise
            size={20}
            className={isRefreshing ? 'animate-spin' : ''}
          />
        </button>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors sm:hidden"
          title="Scroll left"
        >
          <Icon.PiCaretLeft size={20} />
        </button>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors sm:hidden"
          title="Scroll right"
        >
          <Icon.PiCaretRight size={20} />
        </button>
      </div>
    </div>
  );

  const SectionTabs = (
    <div className="flex flex-wrap gap-2 mb-5">
      {SECTION_KEYS.map(section => (
        <button
          key={section}
          onClick={() => handleSectionChange(section)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            currentSection === section
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {SECTION_MAP[section].title}
        </button>
      ))}
    </div>
  );

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          {SectionHeader}
          {SectionTabs}
          <div className={getProductGridLayoutClasses(layoutCol)}>
            <ProductCardSkeleton count={layoutCol * 2} layout="grid" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error / empty state ─────────────────────────────────────────────────────
  if (hasError || !displayedProducts.length) {
    return (
      <div className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          {SectionHeader}
          {SectionTabs}
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiPackage size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products available</h3>
            <p className="text-gray-500 mb-4">
              We're having trouble loading recommendations. Please try again.
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Icon.PiArrowClockwise size={16} />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Populated state ─────────────────────────────────────────────────────────
  return (
    <div className="py-8 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4">
        {SectionHeader}
        {SectionTabs}

        {/* Mobile: horizontal scroll. md+: responsive grid */}
        <div key={fadeKey} className="animate-fade-in">
          {/* Horizontal scroll on mobile */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-3 md:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {displayedProducts.map(product => (
              <div
                key={product._id || product.id}
                className="flex-shrink-0 w-[calc(50vw-24px)] max-w-[200px]"
              >
                <ProductCard data={product} type="grid" />
              </div>
            ))}
          </div>

          {/* Grid on md+ */}
          <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedProducts.map(product => (
              <div key={product._id || product.id}>
                <ProductCard data={product} type="grid" />
              </div>
            ))}
          </div>
        </div>

        {products.length >= maxItems && (
          <div className="text-center mt-6">
            <a
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              View All Products
              <Icon.PiArrowRight size={18} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendedForYou;
