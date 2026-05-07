'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/loader/Skeleton';
import * as Icon from 'react-icons/pi';
import { getProductGridLayoutClasses } from './ProductGrid';
import { motion, AnimatePresence } from 'framer-motion';

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

// Module-level cache: 60 seconds TTL per section
const _recCache = new Map<string, { data: any[]; ts: number }>();
const REC_CACHE_TTL = 60_000;

const RecommendedForYou: React.FC<RecommendedForYouProps> = ({ maxItems = 12, layoutCol = 4 }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSection, setCurrentSection] = useState<SectionKey>('recommended');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initDoneRef = useRef(false);

  const sectionConfig = SECTION_MAP[currentSection];

  // Unwrap the response envelope into a flat array
  const normalizeProducts = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data?.products && Array.isArray(data.products)) return data.products;
    if (data?.data?.products && Array.isArray(data.data.products)) return data.data.products;
    if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  // Normalize individual product shape to what ProductCard needs.
  const normalizeProduct = (p: any): any => {
    const id = p._id ?? p.id;

    const primaryImage =
      p.primaryImage ??
      p.images?.find((i: any) => i.isPrimary) ??
      p.images?.[0] ??
      null;

    // Get lowest website price from availableAt structure
    const allPrices = (p.availableAt || []).flatMap((store: any) =>
      (store.sizes || []).map((size: any) => size.pricing?.websitePrice).filter(Boolean)
    );
    const minPrice = allPrices.length > 0
      ? Math.min(...allPrices)
      : (p.priceRange?.min ?? 0);
    const maxPrice = allPrices.length > 0
      ? Math.max(...allPrices)
      : (p.priceRange?.max ?? minPrice);
    const currency = p.priceRange?.currency ?? 'NGN';

    // discount field from the server — only populated when saleActive=true (date-validated)
    const disc = p.discount;
    const hasRealDiscount = disc?.savings > 0;
    const originPrice = hasRealDiscount ? (disc.originalPrice ?? minPrice) : minPrice;
    const discountPct = hasRealDiscount
      ? (disc.type === 'percentage' ? disc.value : (disc.originalPrice > 0 ? Math.round((disc.savings / disc.originalPrice) * 100) : 0))
      : undefined;

    // isOnSale reads server's date-validated saleActive flag — expired sales are false
    const vendorOnSale = (p.availableAt || []).some((v: any) => v.isOnSale === true);
    const isOnSale = vendorOnSale || hasRealDiscount;

    const isProductNew = (createdAt: string): boolean => {
      try {
        const createdDate = new Date(createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdDate > weekAgo;
      } catch {
        return false;
      }
    };
    const isNew = p.badge?.type === 'new-arrival' || isProductNew(p.createdAt);

    const rating = p.averageRating ?? p.rating ?? p.stats?.averageRating ?? 0;
    const reviewCount = p.reviewCount ?? p.stats?.reviewCount ?? 0;
    const totalSold = p.totalSold ?? p.stats?.totalSold ?? p.trending?.quantitySold ?? 0;

    const totalStock =
      p.totalStock ??
      p.availability?.totalStock ??
      p.stockInfo?.totalStock ??
      p.stats?.totalStock ??
      0;

    const tenantCount =
      p.availability?.tenantCount ??
      p.tenantCount ??
      p.tenants?.length ??
      0;

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
      new: isNew,
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
          p.availability?.stockLevel ??
          p.stockLevel ??
          (totalStock > 0 ? 'medium' : 'out'),
        availableFrom: tenantCount,
        message:
          p.availability?.message ??
          p.availability?.availabilitySummary ??
          '',
      },
    };
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 6000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Fetch a section and return the products (does NOT call setProducts itself)
  const loadSection = useCallback(async (section: SectionKey, auth: boolean): Promise<any[]> => {
    const cacheKey = `${section}:${auth ? 'auth' : 'anon'}:${maxItems}`;
    const cached = _recCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < REC_CACHE_TTL) return cached.data;

    let endpoints: string[];
    if (section === 'recommended') {
      endpoints = auth
        ? [API_ENDPOINTS.recommended, API_ENDPOINTS.trending]
        : [API_ENDPOINTS.trending];
    } else {
      endpoints = [API_ENDPOINTS[section]];
    }

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
  }, [maxItems]);

  const fetchSection = useCallback(async (section: SectionKey, auth: boolean) => {
    setHasError(false);
    const prods = await loadSection(section, auth);
    if (prods.length > 0) {
      setProducts(prods);
    } else {
      setHasError(true);
    }
  }, [loadSection]);

  const handleSectionChange = useCallback((section: SectionKey) => {
    setCurrentSection(section);
    setLoading(true);
    fetchSection(section, isAuthenticated).finally(() => setLoading(false));
  }, [fetchSection, isAuthenticated]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSection(currentSection, isAuthenticated).finally(() => setIsRefreshing(false));
  }, [fetchSection, currentSection, isAuthenticated]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const init = async () => {
      // Fire trending fetch immediately — no auth required, fastest path to showing content
      const trendingPromise = loadSection('recommended', false);

      // Check auth in parallel (shorter timeout — auth shouldn't block the UI)
      const authPromise = fetchWithTimeout('/api/auth/me', {}, 3000)
        .then(r => r.ok ? r.json() : null)
        .then(data => !!data?.user)
        .catch(() => false);

      // Show trending as soon as it arrives
      const [trendingProducts, isAuth] = await Promise.all([trendingPromise, authPromise]);

      setIsAuthenticated(isAuth);

      if (trendingProducts.length > 0) {
        // Show trending immediately, unblock the UI
        setProducts(trendingProducts);
        setLoading(false);

        // If authenticated, silently swap in personalized recommendations
        if (isAuth) {
          const personalizedProducts = await loadSection('recommended', true);
          if (personalizedProducts.length > 0) {
            setProducts(personalizedProducts);
          }
        }
      } else {
        setHasError(true);
        setLoading(false);
      }
    };

    init();
  }, [loadSection]);

  if (loading) {
    return (
      <div className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 ${sectionConfig.iconBgColor} ${sectionConfig.iconColor} rounded-xl`}>
                {sectionConfig.icon}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">{sectionConfig.title}</h2>
                <p className="text-sm text-gray-500">{sectionConfig.subtitle}</p>
              </div>
            </div>
          </div>
          <div className={getProductGridLayoutClasses(layoutCol)}>
            <ProductCardSkeleton count={layoutCol * 2} layout="grid" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError || !products.length) {
    return (
      <div className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 ${sectionConfig.iconBgColor} ${sectionConfig.iconColor} rounded-xl`}>
                {sectionConfig.icon}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">{sectionConfig.title}</h2>
                <p className="text-sm text-gray-500">{sectionConfig.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {SECTION_KEYS.map((section) => (
              <button
                key={section}
                onClick={() => handleSectionChange(section)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  currentSection === section
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {SECTION_MAP[section].title}
              </button>
            ))}
          </div>

          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiPackage size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products available</h3>
            <p className="text-gray-500 mb-4">We're having trouble loading recommendations. Please try again later.</p>
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

  return (
    <div className="py-8 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <motion.div
                  className={`p-2.5 ${sectionConfig.iconBgColor} ${sectionConfig.iconColor} rounded-xl`}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {sectionConfig.icon}
                </motion.div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">{sectionConfig.title}</h2>
                  <p className="text-sm text-gray-500">{sectionConfig.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <Icon.PiArrowClockwise size={20} className={isRefreshing ? 'animate-spin' : ''} />
                </button>

                <button
                  onClick={() => {
                    document.getElementById('recommended-scroll')?.scrollBy({ left: -300, behavior: 'smooth' });
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block"
                  title="Scroll left"
                >
                  <Icon.PiCaretLeft size={20} />
                </button>

                <button
                  onClick={() => {
                    document.getElementById('recommended-scroll')?.scrollBy({ left: 300, behavior: 'smooth' });
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block"
                  title="Scroll right"
                >
                  <Icon.PiCaretRight size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {SECTION_KEYS.map((section) => (
                <button
                  key={section}
                  onClick={() => handleSectionChange(section)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    currentSection === section
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {SECTION_MAP[section].title}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <motion.div
          id="recommended-scroll"
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
          style={{ scrollbarWidth: 'thin' }}
        >
          <AnimatePresence mode="popLayout">
            {products.slice(0, maxItems).map((product, index) => (
              <motion.div
                key={product._id || product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                className="flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)]"
              >
                <ProductCard data={product} type="grid" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

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
