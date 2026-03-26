'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Shop from '@/components/Shop';
import LoadingSpinner from '@/components/loader/LoadingSpinner';
import CategoryBanner from '@/components/Banner/CategoryBanner';
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

function ShopPageContent({ params }: PageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse all URL params for full filter support
  const categoryParam = searchParams.get('category');
  const subcategoryParam = searchParams.get('subcategory');
  const brandParam = searchParams.get('brand');
  const originParam = searchParams.get('origin');
  const flavorParam = searchParams.get('flavor');
  const volumeParam = searchParams.get('volume');
  const sizeParam = searchParams.get('size');
  const sort = searchParams.get('sort');
  const sale = searchParams.get('sale');
  const searchQuery = searchParams.get('search');
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const minABVParam = searchParams.get('minABV');
  const maxABVParam = searchParams.get('maxABV');
  const minRatingParam = searchParams.get('minRating');
  
  // Handle array vs single values consistently
  const category = categoryParam?.includes(',') ? categoryParam.split(',') : categoryParam;
  const subcategory = subcategoryParam?.includes(',') ? subcategoryParam.split(',') : subcategoryParam;
  const brand = brandParam?.includes(',') ? brandParam.split(',') : brandParam;
  const origin = originParam?.includes(',') ? originParam.split(',') : originParam;
  const flavor = flavorParam?.includes(',') ? flavorParam.split(',') : flavorParam;

  // Build initial filters from URL params for bookmarking support
  const buildInitialFilters = useCallback((): Partial<FilterState> => {
    const initial: Partial<FilterState> = {
      categoryType: category || null,
      subCategoryType: subcategory || null,
      brand: brand || null,
      originCountry: origin || null,
      flavorCategory: flavor || null,
      sortOption: sort || '',
      showOnlySale: sale === 'true',
      size: sizeParam || null,
      volumeRange: volumeParam || null,
    };

    // Parse numeric filters
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
      if (rating >= 1 && rating <= 5) {
        initial.minRating = rating;
      }
    }

    return initial;
  }, [category, subcategory, brand, origin, flavor, sort, sale, sizeParam, volumeParam, minPriceParam, maxPriceParam, minABVParam, maxABVParam, minRatingParam]);

  const [initialFilters] = useState<Partial<FilterState>>(buildInitialFilters);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [layoutCol, setLayoutCol] = useState<number>(4);

  const updateUrlFilters = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams();

    if (newFilters.brand) {
      if (Array.isArray(newFilters.brand)) {
        params.set('brand', newFilters.brand.join(','));
      } else {
        params.set('brand', newFilters.brand);
      }
    }
    if (newFilters.categoryType) {
      if (Array.isArray(newFilters.categoryType)) {
        params.set('category', newFilters.categoryType.join(','));
      } else {
        params.set('category', newFilters.categoryType);
      }
    }
    if (newFilters.subCategoryType) {
      if (Array.isArray(newFilters.subCategoryType)) {
        params.set('subcategory', newFilters.subCategoryType.join(','));
      } else {
        params.set('subcategory', newFilters.subCategoryType);
      }
    }
    if (newFilters.sortOption) params.set('sort', newFilters.sortOption);
    if (newFilters.showOnlySale) params.set('sale', 'true');

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    router.replace(newUrl, { scroll: false });
  }, [pathname, router]);

  const buildApiUrl = useCallback(() => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/products/search`;

    const paramsObj = new URLSearchParams();

    // Read all filter params from searchParams
    const currentCategory = searchParams.get('category');
    const currentSubcategory = searchParams.get('subcategory');
    const currentBrand = searchParams.get('brand');
    const currentOrigin = searchParams.get('origin');
    const currentFlavor = searchParams.get('flavor');
    const currentVolume = searchParams.get('volume');
    const currentSize = searchParams.get('size');
    const currentSort = searchParams.get('sort');
    const currentSale = searchParams.get('sale');
    const currentMinPrice = searchParams.get('minPrice');
    const currentMaxPrice = searchParams.get('maxPrice');
    const currentMinABV = searchParams.get('minABV');
    const currentMaxABV = searchParams.get('maxABV');
    const currentMinRating = searchParams.get('minRating');
    
    // Search query is the most important parameter
    if (searchQuery && searchQuery.trim()) {
      paramsObj.set('q', searchQuery.trim());
    }
    
    // Add all filter parameters
    if (currentCategory) paramsObj.set('category', currentCategory);
    if (currentSubcategory) paramsObj.set('subCategory', currentSubcategory);
    if (currentBrand) paramsObj.set('brand', currentBrand);
    if (currentOrigin) paramsObj.set('origin', currentOrigin);
    if (currentFlavor) paramsObj.set('flavor', currentFlavor);
    if (currentVolume) paramsObj.set('volume', currentVolume);
    if (currentSize) paramsObj.set('size', currentSize);
    if (currentSort) paramsObj.set('sort', currentSort);
    if (currentSale === 'true') paramsObj.set('onSale', 'true');
    if (currentMinPrice) paramsObj.set('minPrice', currentMinPrice);
    if (currentMaxPrice) paramsObj.set('maxPrice', currentMaxPrice);
    if (currentMinABV) paramsObj.set('minABV', currentMinABV);
    if (currentMaxABV) paramsObj.set('maxABV', currentMaxABV);
    if (currentMinRating) paramsObj.set('minRating', currentMinRating);
    
    paramsObj.set('limit', '50');

    const queryString = paramsObj.toString();
    return `${baseUrl}?${queryString}`;
  }, [searchParams, searchQuery]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const url = buildApiUrl();
      console.log('[ShopPage] Fetching products from:', url);

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
        // If sale filter returns empty, retry without sale filter
        const hasSaleFilter = url.includes('onSale=true');
        if (data.data.products.length === 0 && hasSaleFilter) {
          const retryRes = await fetch(url.replace('onSale=true&', '').replace('onSale=true', ''));
          const retryData = await retryRes.json();
          if (retryData.success && retryData.data?.products) {
            setProducts(retryData.data.products);
            setTotalProducts(retryData.data.pagination?.total || retryData.data.products.length);
          } else {
            setProducts(data.data.products);
            setTotalProducts(data.data.pagination?.total || data.data.products.length);
          }
        } else {
          setProducts(data.data.products);
          setTotalProducts(data.data.pagination?.total || data.data.products.length);
        }
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

  const handleClearSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  };

  const hasActiveFilters = searchParams.get('category') || searchParams.get('subcategory') || 
    searchParams.get('brand') || searchParams.get('sale') || searchParams.get('search') ||
    searchParams.get('origin') || searchParams.get('flavor') || searchParams.get('volume') ||
    searchParams.get('size') || searchParams.get('minPrice') || searchParams.get('maxPrice') ||
    searchParams.get('minABV') || searchParams.get('maxABV') || searchParams.get('minRating');

  if (loading) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingSpinner variant="bounce" color="emerald" size="lg" text="Finding the best drinks..." />
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
          <div className="bg-white border-b border-gray-200 py-3 sm:py-4">
            <div className="container mx-auto px-3 sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    "{searchQuery}"
                  </h1>
                  <p className="text-gray-500 text-sm">
                    {totalProducts} product{totalProducts !== 1 ? 's' : ''} found
                  </p>
                </div>
                <button
                  onClick={handleClearSearch}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Icon.PiX size={16} />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Grid */}
        <Shop
          productPerPage={12}
          data={products}
          productStyle="style-1"
          searchQuery={searchQuery}
          layoutCol={layoutCol}
          onLayoutChange={setLayoutCol}
          initialFilters={initialFilters}
        />
        
        {/* Recommended For You Section */}
        <div className="mt-8">
          <RecommendedForYou maxItems={12} layoutCol={layoutCol} />
        </div>
      </div>
    </>
  );
}

export default function ShopPage(props: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    }>
      <ShopPageContent {...props} />
    </Suspense>
  );
}
