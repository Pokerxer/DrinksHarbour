'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb/Breadcrumb';
import ProductCard from '@/components/Product/Card';
import * as Icon from 'react-icons/pi';
import { ProductType } from '@/types/product.types';

const SearchResult = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<string>('');
  const productsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(0);

  const fetchSearchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5001/api/products/search?q=${encodeURIComponent(searchQuery)}&limit=50`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.products) {
          setProducts(data.data.products);
        } else if (Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setProducts([]);
        }
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const searchQuery = searchParams.get('query');
    if (searchQuery) {
      setQuery(searchQuery);
      fetchSearchResults(searchQuery);
    }
  }, [searchParams, fetchSearchResults]);

  const handleSearch = (value: string) => {
    if (value.trim()) {
      router.push(`/search-result?query=${encodeURIComponent(value.trim())}`);
      setSearchKeyword('');
    }
  };

  const offset = currentPage * productsPerPage;
  const currentProducts = products.slice(offset, offset + productsPerPage);
  const pageCount = Math.ceil(products.length / productsPerPage);

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
            <div className="heading4 text-center">
              Found {products.length} results for "{query}"
            </div>
            <div className="lg:w-1/2 sm:w-3/5 w-full md:h-[52px] h-[44px] sm:mt-8 mt-5">
              <div className="w-full h-full relative">
                <input
                  type="text"
                  placeholder="Search..."
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

          <div className="list-product-block relative md:pt-10 pt-6">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <Icon.PiMagnifyingGlass size={64} className="mx-auto text-gray-300 mb-4" />
                <div className="text-2xl font-semibold text-gray-900 mb-2">
                  No products found
                </div>
                <p className="text-gray-500">
                  We couldn't find any products matching "{query}"
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-500 mb-4">
                  Showing {currentProducts.length} of {products.length} products
                </div>
                <div className="grid lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-[30px] gap-[20px]">
                  {currentProducts.map((item) => (
                    <ProductCard key={item.id || item._id} data={item} type="grid" />
                  ))}
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center justify-center md:mt-10 mt-7">
                    <button
                      onClick={() => handlePageChange(0)}
                      disabled={currentPage === 0}
                      className="px-4 py-2 border border-line rounded-l-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Icon.PiCaretLeft size={16} />
                    </button>
                    <span className="px-4 py-2 border-t border-b border-line">
                      Page {currentPage + 1} of {pageCount}
                    </span>
                    <button
                      onClick={() => handlePageChange(pageCount - 1)}
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
};

export default SearchResult;
