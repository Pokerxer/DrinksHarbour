'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Shop from '@/components/Shop';
import LoadingSpinner from '@/components/loader/LoadingSpinner';
import CategoryBanner from '@/components/Banner/CategoryBanner';
import * as Icon from 'react-icons/pi';

interface PageProps {
  params?: { slug?: string };
}

interface FilterState {
  type: string | null;
  size: string | null;
  color: string | null;
  brand: string | null;
  priceRange: { min: number; max: number };
  showOnlySale: boolean;
  sortOption: string;
  originCountry: string | null;
  categoryType: string | null;
  subCategoryType: string | null;
  flavorCategory: string | null;
  minRating: number | null;
  search: string | null;
}

export default function ShopPage({ params }: PageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get('type');
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const brand = searchParams.get('brand');
  const sort = searchParams.get('sort');
  const sale = searchParams.get('sale');
  const searchQuery = searchParams.get('search');

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [filterState, setFilterState] = useState<FilterState>({
    type: type,
    size: null,
    color: null,
    brand: brand,
    priceRange: { min: 0, max: 100000 },
    showOnlySale: sale === 'true',
    sortOption: sort || '',
    originCountry: null,
    categoryType: category,
    subCategoryType: subcategory,
    flavorCategory: null,
    minRating: null,
    search: searchQuery,
  });

  const updateUrlFilters = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams();

    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.categoryType) params.set('category', newFilters.categoryType);
    if (newFilters.subCategoryType) params.set('subcategory', newFilters.subCategoryType);
    if (newFilters.brand) params.set('brand', newFilters.brand);
    if (newFilters.sortOption) params.set('sort', newFilters.sortOption);
    if (newFilters.showOnlySale) params.set('sale', 'true');

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    router.replace(newUrl, { scroll: false });
  }, [pathname, router]);

  const buildApiUrl = useCallback(() => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/products/search`;

    const paramsObj = new URLSearchParams();

    // Search query is the most important parameter
    if (searchQuery && searchQuery.trim()) {
      paramsObj.set('q', searchQuery.trim());
    }
    
    // Add other filters
    if (type) paramsObj.set('type', type);
    if (category) paramsObj.set('category', category);
    if (subcategory) paramsObj.set('subCategory', subcategory);
    if (brand) paramsObj.set('brand', brand);
    if (sort) paramsObj.set('sort', sort);
    if (sale === 'true') paramsObj.set('onSale', 'true');
    paramsObj.set('limit', '50');

    const queryString = paramsObj.toString();
    return `${baseUrl}?${queryString}`;
  }, [type, category, subcategory, brand, sort, sale, searchQuery]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const url = buildApiUrl();
      console.log('Fetching products from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Products API response:', data);

      if (data.success && data.data?.products) {
        setProducts(data.data.products);
        setTotalProducts(data.data.pagination?.total || data.data.products.length);
      } else if (data.success && data.data?.data) {
        setProducts(data.data.data);
        setTotalProducts(data.data.pagination?.total || data.data.data.length);
      } else if (Array.isArray(data.products)) {
        setProducts(data.products);
        setTotalProducts(data.products.length);
      } else if (Array.isArray(data)) {
        setProducts(data);
        setTotalProducts(data.length);
      } else {
        console.warn('Unexpected API response structure:', data);
        setProducts([]);
        setTotalProducts(0);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products. Please try again later.');
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setFilterState(prev => ({
      ...prev,
      type: type,
      categoryType: category,
      subCategoryType: subcategory,
      brand: brand,
      sortOption: sort || '',
      showOnlySale: sale === 'true',
      search: searchQuery,
    }));
  }, [type, category, subcategory, brand, sort, sale, searchQuery]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filterState, [key]: value };
    setFilterState(newFilters);
    updateUrlFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilterState({
      type: null,
      size: null,
      color: null,
      brand: null,
      priceRange: { min: 0, max: 100000 },
      showOnlySale: false,
      sortOption: '',
      originCountry: null,
      categoryType: null,
      subCategoryType: null,
      flavorCategory: null,
      minRating: null,
      search: null,
    });
    router.replace(pathname, { scroll: false });
  };

  const handleClearSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  };

  const hasActiveFilters = filterState.type || filterState.brand || filterState.categoryType ||
    filterState.subCategoryType || filterState.showOnlySale || filterState.originCountry ||
    filterState.flavorCategory || filterState.minRating || filterState.search;

  if (loading) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="text-red-500 text-lg mb-4">{error}</div>
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 bg-black-900 text-gray-50 rounded"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="bg-gray-50 min-h-screen">
        {/* Search Results Header */}
        {searchQuery && (
          <div className="bg-white border-b border-gray-200 py-4">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Search Results for "{searchQuery}"
                  </h1>
                  <p className="text-gray-500 mt-1">
                    {totalProducts} product{totalProducts !== 1 ? 's' : ''} found
                  </p>
                </div>
                <button
                  onClick={handleClearSearch}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon.PiX size={20} />
                  Clear Search
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Grid */}
        <Shop
          productPerPage={12}
          dataType={type}
          data={products}
          productStyle="style-1"
          initialFilters={filterState}
          onFilterChange={handleFilterChange}
          searchQuery={searchQuery}
        />
      </div>
    </>
  );
}
