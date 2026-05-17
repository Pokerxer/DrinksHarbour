'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Empty, SearchNotFoundIcon, Button } from 'rizzui';
import { PiMagnifyingGlassBold, PiX, PiArrowsClockwise } from 'react-icons/pi';
import POSProductCard from '@/app/shared/point-of-sale/components/pos-product-card';
import { POSProduct } from '@/app/shared/point-of-sale/types';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth, usePOSUI } from '@/app/shared/point-of-sale/store';

type ProductGridProps = {
  onAddToCart: (product: POSProduct, sizeId?: string) => void;
};

function formatCategoryLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="aspect-square w-full animate-pulse bg-gray-100" />
      <div className="space-y-2 px-3 pb-3 pt-2.5">
        <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="mt-1 h-5 w-20 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function POSProductGrid({ onAddToCart }: ProductGridProps) {
  // All products from the server (fetched once, refreshed on demand)
  const [allProducts, setAllProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const { token } = usePOSAuth();
  const { searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } = usePOSUI();

  // Fetch the full product catalog — no search/category params, filter client-side
  const fetchProducts = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const data = await posApi.getProducts(token, { limit: 200 });
      setAllProducts(data.products || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Unique categories from the FULL catalog (not the filtered view)
  const categories = useMemo(() =>
    Array.from(
      new Set(allProducts.map((p) => p.product?.type).filter(Boolean) as string[])
    ).sort(),
    [allProducts]
  );

  // Client-side filtering — instant, no extra API calls
  const products = useMemo(() => {
    let list = allProducts;

    if (selectedCategory) {
      list = list.filter((p) => p.product?.type === selectedCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.product?.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.product?.brand?.name?.toLowerCase().includes(q) ||
        p.sizes?.some((s) => s.displayName?.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allProducts, selectedCategory, searchQuery]);

  const isFiltered = !!selectedCategory || !!searchQuery.trim();

  return (
    <div className="flex h-full flex-col">

      {/* ── Sticky search + category bar ── */}
      <div className="sticky top-0 z-10 bg-gray-50 pb-3 pt-1">

        {/* Search */}
        <div className="relative mb-3">
          <PiMagnifyingGlassBold className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands, sizes…"
            className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-10 text-sm shadow-sm outline-none transition-all focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category pills + count + refresh */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !selectedCategory
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
              {!loading && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  !selectedCategory ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {allProducts.length}
                </span>
              )}
            </button>

            {categories.map((cat) => {
              const count = allProducts.filter((p) => p.product?.type === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#b20202] text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {formatCategoryLabel(cat)}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    selectedCategory === cat ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Count + refresh */}
          <div className="flex shrink-0 items-center gap-2">
            {!loading && (
              <span className="text-[11px] font-medium text-gray-400">
                {isFiltered ? `${products.length} / ${allProducts.length}` : `${allProducts.length} items`}
              </span>
            )}
            <button
              type="button"
              onClick={fetchProducts}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
              title="Refresh"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Product grid ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProducts}>Retry</Button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <Empty
              image={<SearchNotFoundIcon />}
              text={
                searchQuery
                  ? `No results for "${searchQuery}"${selectedCategory ? ` in ${formatCategoryLabel(selectedCategory)}` : ''}`
                  : selectedCategory
                  ? `No products in ${formatCategoryLabel(selectedCategory)}`
                  : 'No products available'
              }
              className="justify-center"
            />
            {isFiltered && (
              <div className="flex gap-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Clear search
                  </button>
                )}
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Show all categories
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => (
              <POSProductCard
                key={product._id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
