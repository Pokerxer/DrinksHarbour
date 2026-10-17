'use client';

import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import { shoppingHeaders } from '@/lib/shoppingRequest';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb/Breadcrumb';
import ProductCard from '@/components/Product/Card';
import NearbyResultsStatus from '@/components/ShoppingLocation/NearbyResultsStatus';
import * as Icon from 'react-icons/pi';
import { ProductType } from '@/types/product.types';

function SearchResultContent() {
  const { location, revision } = useShoppingLocation();
  const [totalResults, setTotalResults] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<string>('');
  const productsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const fetchSearchResults = useCallback(async (searchQuery: string, signal?: AbortSignal) => {
    if (!searchQuery.trim()) {
      setProducts([]); setTotalResults(0); setError(null);
      setLoading(false);
      return;
    }

    setLoading(true); setError(null);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/products/search?q=${encodeURIComponent(searchQuery)}&inStock=false&limit=8&page=${currentPage + 1}`,
        {
          method: 'GET',
          headers: shoppingHeaders(location),
          signal,
          cache: 'no-store',
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (signal?.aborted) return;
        if (data.success === false) throw new Error('Search is unavailable');
        setTotalResults(data.data?.pagination?.totalResults ?? data.data?.products?.length ?? 0);
        if (data.success && data.data?.products) {
          setProducts(data.data.products);

        } else if (Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setProducts([]);
        }
      } else {
        throw new Error('Search is unavailable');
      }
    } catch (error) {
      if (signal?.aborted) return;
      setError('Drinks could not be loaded. Please try again.');
      setProducts([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [revision, currentPage]);

  useEffect(() => {
    const controller = new AbortController();
    const searchQuery = searchParams.get('query');
    setQuery(searchQuery || '');
    setSearchKeyword(searchQuery || '');
    fetchSearchResults(searchQuery || '', controller.signal);
    return () => controller.abort();
  }, [searchParams, fetchSearchResults, retry]);

  useEffect(() => { setCurrentPage(0); }, [searchParams.get('query'), revision]);

  const handleSearch = (value: string) => {
    if (value.trim()) {
      router.push(`/search-result?query=${encodeURIComponent(value.trim())}`);
      setSearchKeyword('');
    }
  };

  const offset = currentPage * productsPerPage;
  const currentProducts = products;
  const pageCount = Math.ceil(totalResults / productsPerPage);

  const handlePageChange = (selected: number) => {
    setCurrentPage(selected);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="relative w-full">
        <Breadcrumb heading="Search Result" subHeading="Search Result" />
      </div>
      <div className="shop-product breadcrumb1 lg:py-20 md:py-14 py-10">
        <div className="container">
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold text-gray-900 text-center">
              {loading ? 'Searching drinks…' : error ? 'Search drinks' : query ? `${totalResults} drinks found for “${query}”` : 'Find your next drink'}
            </h1>
            <div className="lg:w-1/2 sm:w-3/5 w-full md:h-[52px] h-[44px] sm:mt-8 mt-5">
              <div className="w-full h-full relative">
                <input
                  type="text"
                  placeholder="Search drinks, brands or tasting notes"
                  aria-label="Search drinks"
                  className="caption1 w-full h-full pl-4 md:pr-[150px] pr-32 rounded-xl border border-line"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchKeyword)}
                />
                <button
                  className="button-main absolute top-1 bottom-1 right-1 flex items-center justify-center"
                  onClick={() => handleSearch(searchKeyword)}
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          <NearbyResultsStatus location={location} loading={loading} />
          <div className="list-product-block relative md:pt-10 pt-6">
            {loading ? (
              <div role="status" aria-label="Searching drinks" className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
                <p className="text-sm text-zinc-700">{error}</p>
                <button onClick={() => setRetry(value => value + 1)} className="mt-4 rounded-xl bg-[#b20202] px-5 py-3 text-sm font-semibold text-white">Try again</button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <Icon.PiMagnifyingGlass size={64} className="mx-auto text-gray-300 mb-4" />
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                  {query ? 'No drinks found' : 'What are you looking for?'}
                </h1>
                <p className="text-gray-500">
                  {query ? `Try a brand, drink type or a shorter search for “${query}”.` : 'Enter a drink name, brand or tasting note to start searching.'}
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-500 mb-4">
                  Showing {offset + 1}–{Math.min(offset + currentProducts.length, totalResults)} of {totalResults} drinks
                </div>
                <div className="grid lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-[30px] gap-[20px]">
                  {currentProducts.map((item) => (
                    <ProductCard key={item.id || item._id} data={item} type="grid" showOutOfStock />
                  ))}
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center justify-center md:mt-10 mt-7">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      aria-label="Previous results page"
                      disabled={currentPage === 0}
                      className="px-4 py-2 border border-line rounded-l-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Icon.PiCaretLeft size={16} />
                    </button>
                    <span className="px-4 py-2 border-t border-b border-line">
                      Page {currentPage + 1} of {pageCount}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      aria-label="Next results page"
                      disabled={currentPage === pageCount - 1}
                      className="px-4 py-2 border border-line rounded-r-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Icon.PiCaretRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SearchResult() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    }>
      <SearchResultContent />
    </Suspense>
  );
}
