'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/Product/Card/Skeleton';
import {
  PiSparkle,
  PiTrendUp,
  PiFire,
  PiArrowClockwise,
  PiCaretLeft,
  PiCaretRight,
  PiArrowRight,
  PiPackage,
} from 'react-icons/pi';
import { getProductGridLayoutClasses } from './ProductGrid';
import { normalizeProducts, normalizeProduct, isPublishedProduct } from './recommendations';

interface RecommendedForYouProps {
  maxItems?: number;
  layoutCol?: number;
  // Initial (trending) products fetched on the server so the section's cards +
  // /product links are present in the raw HTML. Seeds state and skips the
  // initial client fetch; auth personalization still runs after hydration.
  initialProducts?: any[];
}

interface SectionConfig {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  // Shown when the section loaded fine but has nothing to show. Distinct from
  // the fetch-failure copy: "no best sellers yet" is a true statement about a
  // young catalogue, "we couldn't load this" is a bug worth retrying.
  emptyTitle: string;
  emptyBody: string;
}

type SectionKey = 'recommended' | 'trending' | 'bestsellers' | 'newArrivals';

const SECTION_MAP: Record<SectionKey, SectionConfig> = {
  recommended: {
    title: 'Recommended For You',
    subtitle: 'Based on your browsing history',
    icon: <PiSparkle size={20} />,
    iconBgColor: 'bg-rose-100',
    iconColor: 'text-rose-600',
    emptyTitle: 'No recommendations yet',
    emptyBody: 'Browse a few drinks and we\u2019ll start suggesting bottles you\u2019ll like.',
  },
  trending: {
    title: 'Trending Now',
    subtitle: 'Popular with other shoppers',
    icon: <PiTrendUp size={20} />,
    iconBgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    emptyTitle: 'Nothing trending right now',
    emptyBody: 'Check back soon \u2014 this updates as shoppers buy.',
  },
  bestsellers: {
    title: 'Best Sellers',
    subtitle: 'Most purchased items',
    icon: <PiFire size={20} />,
    iconBgColor: 'bg-orange-100',
    iconColor: 'text-orange-600',
    emptyTitle: 'No best sellers yet',
    emptyBody: 'Once orders start coming in, the most-purchased bottles land here.',
  },
  newArrivals: {
    title: 'New Arrivals',
    subtitle: 'Fresh additions to our catalog',
    icon: <PiSparkle size={20} />,
    iconBgColor: 'bg-violet-100',
    iconColor: 'text-violet-600',
    emptyTitle: 'No new arrivals',
    emptyBody: 'Nothing has been added to the catalog in the last few weeks.',
  },
};

const SECTION_KEYS: SectionKey[] = ['recommended', 'trending', 'bestsellers', 'newArrivals'];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const API_ENDPOINTS: Record<SectionKey, string> = {
  recommended: `${API_BASE}/api/user/recommendations`,
  trending:    `${API_BASE}/api/products/trending`,
  bestsellers: `${API_BASE}/api/products/bestsellers`,
  newArrivals: `${API_BASE}/api/products/new-arrivals`,
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

// A section that legitimately has no products is NOT a failure. Collapsing the
// two hid a hard 500 on /api/products/bestsellers behind the "nothing here yet"
// copy for as long as that endpoint was broken, so the two are reported apart.
type SectionResult = { products: any[]; failed: boolean };

async function loadSectionData(
  section: SectionKey,
  auth: boolean,
  maxItems: number
): Promise<SectionResult> {
  const cacheKey = `${section}:${auth ? 'auth' : 'anon'}:${maxItems}`;
  const cached = _recCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
    return { products: cached.data, failed: false };
  }

  const endpoints =
    section === 'recommended'
      ? auth
        ? [API_ENDPOINTS.recommended, API_ENDPOINTS.trending]
        : [API_ENDPOINTS.trending]
      : [API_ENDPOINTS[section]];

  // Only a response we actually understood counts as "reached the server".
  let reachedServer = false;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(`${endpoint}?limit=${maxItems}`);
      if (!response.ok) continue;

      const data = await response.json();
      if (data?.success === false) continue;

      reachedServer = true;
      const prods = normalizeProducts(data).map(normalizeProduct);
      if (prods.length > 0) {
        _recCache.set(cacheKey, { data: prods, ts: Date.now() });
        return { products: prods, failed: false };
      }
    } catch {
      continue;
    }
  }

  // Cache a genuine empty so an empty tab doesn't refetch on every switch.
  if (reachedServer) _recCache.set(cacheKey, { data: [], ts: Date.now() });

  return { products: [], failed: !reachedServer };
}

// ─── Component ────────────────────────────────────────────────────────────────

function getInitialCache(maxItems: number) {
  const key = `recommended:anon:${maxItems}`;
  const c = _recCache.get(key);
  return c && Date.now() - c.ts < REC_CACHE_TTL ? c.data : null;
}

const RecommendedForYou: React.FC<RecommendedForYouProps> = ({
  maxItems = 12,
  layoutCol = 4,
  initialProducts,
}) => {
  const seeded = (initialProducts?.length ?? 0) > 0;
  const [products, setProducts] = useState<any[]>(
    () => (seeded ? initialProducts! : (getInitialCache(maxItems) ?? [])),
  );
  const [loading, setLoading] = useState(() => !seeded && !getInitialCache(maxItems));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSection, setCurrentSection] = useState<SectionKey>('recommended');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const initDoneRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sectionConfig = SECTION_MAP[currentSection];
  const displayedProducts = useMemo(
    () =>
      products
        .filter(isPublishedProduct)
        .filter(p => (p.stockInfo?.totalStock || 0) > 0)
        .slice(0, maxItems),
    [products, maxItems]
  );

  const fetchSection = useCallback(
    async (section: SectionKey, auth: boolean) => {
      setHasError(false);
      const { products: prods, failed } = await loadSectionData(section, auth, maxItems);
      // An empty section still replaces the previous tab's products — otherwise
      // switching to an empty tab leaves the old tab's cards on screen under
      // the new tab's heading.
      setProducts(prods);
      setFadeKey(k => k + 1);
      setHasError(failed);
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
    const cacheKey = `${currentSection}:${isAuthenticated ? 'auth' : 'anon'}:${maxItems}`;
    _recCache.delete(cacheKey);
    setIsRefreshing(true);
    fetchSection(currentSection, isAuthenticated).finally(() => setIsRefreshing(false));
  }, [fetchSection, currentSection, isAuthenticated, maxItems]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    if (getInitialCache(maxItems)) return;

    const init = async () => {
      // Server already seeded the initial (trending) products into the HTML —
      // don't refetch them; just resolve auth and, for logged-in users, upgrade
      // to personalized recommendations.
      if (seeded) {
        const isAuth = await fetchWithTimeout(`${API_BASE}/api/auth/me`, {}, 3000)
          .then(r => (r.ok ? r.json() : null))
          .then(data => !!data?.user)
          .catch(() => false);
        setIsAuthenticated(isAuth);
        if (isAuth) {
          const { products: personalized } = await loadSectionData('recommended', true, maxItems);
          if (personalized.length > 0) {
            setProducts(personalized);
            setFadeKey(k => k + 1);
          }
        }
        return;
      }

      const [initial, isAuth] = await Promise.all([
        loadSectionData('recommended', false, maxItems),
        fetchWithTimeout(`${API_BASE}/api/auth/me`, {}, 3000)
          .then(r => (r.ok ? r.json() : null))
          .then(data => !!data?.user)
          .catch(() => false),
      ]);

      setIsAuthenticated(isAuth);

      if (initial.products.length > 0) {
        setProducts(initial.products);
        setLoading(false);

        if (isAuth) {
          const { products: personalized } = await loadSectionData('recommended', true, maxItems);
          if (personalized.length > 0) {
            setProducts(personalized);
            setFadeKey(k => k + 1);
          }
        }
      } else {
        setHasError(initial.failed);
        setLoading(false);
      }
    };

    init();
  }, [maxItems, seeded]);

  // ─── Memoized header / tabs ─────────────────────────────────────────────────
  const sectionHeader = useMemo(() => (
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
          className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
          aria-label="Refresh recommendations"
        >
          <PiArrowClockwise
            size={20}
            className={isRefreshing ? 'animate-spin' : ''}
          />
        </button>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
          className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
          aria-label="Scroll left"
        >
          <PiCaretLeft size={20} />
        </button>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
          className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
          aria-label="Scroll right"
        >
          <PiCaretRight size={20} />
        </button>
      </div>
    </div>
  ), [sectionConfig, handleRefresh, isRefreshing, loading]);

  const sectionTabs = useMemo(() => (
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
  ), [currentSection, handleSectionChange]);

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          {sectionHeader}
          {sectionTabs}
          <div className={getProductGridLayoutClasses(layoutCol)}>
            <ProductCardSkeleton count={layoutCol * 2} layout="grid" />
          </div>
        </div>
      </section>
    );
  }

  // ─── Error / empty state ─────────────────────────────────────────────────────
  if (hasError || !displayedProducts.length) {
    return (
      <section className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4">
          {sectionHeader}
          {sectionTabs}
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <PiPackage size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {hasError ? 'Couldn\u2019t load this section' : sectionConfig.emptyTitle}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              {hasError
                ? 'Something went wrong on our end. Try again, or browse the full catalog.'
                : sectionConfig.emptyBody}
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasError && (
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
                >
                  <PiArrowClockwise size={16} />
                  Try Again
                </button>
              )}
              <a
                href="/shop"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors font-medium ${
                  hasError
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                Browse Shop
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── Populated state ─────────────────────────────────────────────────────────
  return (
    <section className="py-8 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4">
        {sectionHeader}
        {sectionTabs}

        <div key={fadeKey} className="motion-safe:animate-fade-in">
          {/* Mobile: horizontal scroll */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide md:hidden snap-x snap-mandatory"
          >
            {displayedProducts.map(product => (
              <div
                key={product._id || product.id}
                className="flex-shrink-0 w-[calc(50vw-24px)] max-w-[200px] snap-start"
              >
                <ProductCard data={product} type="grid" />
              </div>
            ))}
          </div>

          {/* Grid on md+ */}
          <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedProducts.map(product => (
              <ProductCard key={product._id || product.id} data={product} type="grid" />
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
              <PiArrowRight size={18} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecommendedForYou;
