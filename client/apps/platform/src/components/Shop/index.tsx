'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterState, FilterOptions, SortOption } from '@/types/filter.types';
import BreadcrumbSection from './BreadcrumbSection';
import FilterSidebar from './FilterSidebar';
import FilterHeader from './FilterHeader';
import ProductGrid from './ProductGrid';
import PaginationSection from './PaginationSection';
import OnSaleHighlight from './OnSaleHighlight';
import RecentlyViewed from './RecentlyViewed';
import * as Icon from 'react-icons/pi';

const SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Sort by', disabled: true },
  { value: 'newest', label: 'Newest Arrivals' },
  { value: 'priceLowToHigh', label: 'Price: Low to High' },
  { value: 'priceHighToLow', label: 'Price: High to Low' },
  { value: 'discountHighToLow', label: 'Biggest Discount' },
  { value: 'popularity', label: 'Most Popular' },
  { value: 'bestselling', label: 'Best Selling' },
  { value: 'rating', label: 'Highest Rated' },
];

// Helper to check if discount is active based on dates
function isDiscountActive(discount: any): boolean {
  if (!discount || !discount.value) return false;
  const now = new Date();
  if (discount.startDate && now < new Date(discount.startDate)) return false;
  if (discount.endDate && now > new Date(discount.endDate)) return false;
  return true;
}

interface Props {
  productPerPage: number;
  slug?: string;
  productStyle: string;
  data?: any[];
  initialFilters?: Partial<FilterState>;
  onFilterChange?: (key: keyof FilterState, value: any) => void;
  isLoading?: boolean;
  searchQuery?: string | null;
  layoutCol: number;
  onLayoutChange: (col: number) => void;
}

const Shop: React.FC<Props> = ({
  data,
  productPerPage,
  productStyle,
  initialFilters,
  onFilterChange,
  isLoading = false,
  searchQuery = null,
  layoutCol: externalLayoutCol,
  onLayoutChange: externalOnLayoutChange
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [internalLayoutCol, setInternalLayoutCol] = useState<number>(4);
  const [openSidebar, setOpenSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Use external layoutCol if provided, otherwise use internal state
  const layoutCol = externalLayoutCol ?? internalLayoutCol;
  const handleLayoutChange = (col: number) => {
    if (externalOnLayoutChange) {
      externalOnLayoutChange(col);
    } else {
      setInternalLayoutCol(col);
    }
  };
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    size: [],
    color: [],
    brand: [],
    originCountry: [],
    categoryType: [],
    subCategoryType: [],
    flavorCategory: [],
    priceRange: { min: 0, max: 100000 },
    abvRanges: [
      { min: 0, max: 5, label: 'Low (0-5%)' },
      { min: 5, max: 10, label: 'Light (5-10%)' },
      { min: 10, max: 20, label: 'Medium (10-20%)' },
      { min: 20, max: 40, label: 'Strong (20-40%)' },
      { min: 40, max: 100, label: 'Very Strong (40%+)' },
    ],
    volumes: [],
  });

  // Build default filter state
  const buildDefaultFilters = useCallback((): FilterState => ({
    size: null,
    color: null,
    brand: null,
    priceRange: filterOptions.priceRange,
    showOnlySale: false,
    sortOption: '',
    originCountry: null,
    categoryType: null,
    subCategoryType: null,
    flavorCategory: null,
    minRating: null,
    abvRange: null,
    volumeRange: null,
  }), [filterOptions.priceRange]);

  // Initialize filters - use initialFilters from URL if available
  const [filters, setFilters] = useState<FilterState>(() => {
    if (initialFilters) {
      const merged = { ...buildDefaultFilters(), ...initialFilters };
      // Ensure priceRange is properly set from initialFilters or defaults
      if (!merged.priceRange || typeof merged.priceRange.min !== 'number') {
        merged.priceRange = filterOptions.priceRange;
      }
      return merged;
    }
    return buildDefaultFilters();
  });
  
  // Reset to page 0 when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  // Sync filters with initialFilters when URL params change (e.g., from direct links)
  const initialFiltersRef = useRef(initialFilters);
  useEffect(() => {
    if (initialFilters && initialFilters !== initialFiltersRef.current) {
      initialFiltersRef.current = initialFilters;
      setFilters(prev => {
        const merged = { ...prev, ...initialFilters };
        if (!merged.priceRange || typeof merged.priceRange.min !== 'number') {
          merged.priceRange = filterOptions.priceRange;
        }
        return merged;
      });
    }
  }, [initialFilters, filterOptions.priceRange]);

  // Sync category + subcategory filter state from URL when navigation happens
  // (e.g., clicking a subcategory link in the sidebar). The initialFilters prop
  // is frozen after mount, so we read searchParams directly.
  useEffect(() => {
    const catParam = searchParams.get('category');
    const subParam = searchParams.get('subcategory');

    const newCat = catParam
      ? (catParam.includes(',') ? catParam.split(',') : catParam)
      : null;
    const newSub = subParam
      ? (subParam.includes(',') ? subParam.split(',') : subParam)
      : null;

    setFilters(prev => {
      const catChanged = JSON.stringify(prev.categoryType) !== JSON.stringify(newCat);
      const subChanged = JSON.stringify(prev.subCategoryType) !== JSON.stringify(newSub);
      if (!catChanged && !subChanged) return prev; // nothing to do
      return { ...prev, categoryType: newCat, subCategoryType: newSub };
    });
  }, [searchParams]);

  const offset = currentPage * productPerPage;
  
  // Track if filter options have been initialized
  const filterOptionsInitialized = useRef(false);
  
  // Store all products for consistent filter options
  const [allProducts, setAllProducts] = useState<any[]>([]);
  
  // Update all products when data changes (but only once)
  useEffect(() => {
    if (!data || data.length === 0 || filterOptionsInitialized.current) return;
    setAllProducts(data);
  }, [data]);
  
  // Extract filter options from data - only on initial load
  useEffect(() => {
    if ((!data && !allProducts) || (data && data.length === 0 && allProducts.length === 0) || filterOptionsInitialized.current) return;
    
    // Use all products for filter options to prevent disappearing options
    const productsToUse = allProducts.length > 0 ? allProducts : (data || []);
    
    const brands = Array.from(new Set(productsToUse.map(p => p.brand?.name).filter(Boolean))) as string[];
    const origins = Array.from(new Set(productsToUse.map(p => p.originCountry).filter(Boolean))) as string[];
    const categoryTypes = Array.from(new Set(productsToUse.map(p => p.category?.slug).filter(Boolean))) as string[];
    const subCategoryTypes = Array.from(new Set(productsToUse.map(p => p.subCategory?.slug).filter(Boolean))) as string[];
    const flavorCategories = Array.from(
      new Set(productsToUse.flatMap(p => p.flavors?.map((f: any) => f.category) || []).filter(Boolean))
    ) as string[];
    const sizes = Array.from(new Set(
      productsToUse.flatMap(p => p.sizes?.map((s: any) => s.displayName || s.size).filter(Boolean) || [])
    )) as string[];
    
    const allPrices = productsToUse.flatMap(p => [
      p.priceRange?.min || 0,
      p.priceRange?.max || 0,
      ...(p.sizes?.map((s: any) => s.priceRange?.min || 0) || [])
    ]).filter(price => price > 0);
    
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100000;
    
    setFilterOptions({
      size: sizes,
      color: [] as string[],
      brand: brands,
      originCountry: origins,
      categoryType: categoryTypes,
      subCategoryType: subCategoryTypes,
      flavorCategory: flavorCategories,
      priceRange: { min: minPrice, max: maxPrice },
      abvRanges: filterOptions.abvRanges,
      volumes: filterOptions.volumes,
    });
    
    setFilters(prev => ({
      ...prev,
      priceRange: { min: minPrice, max: maxPrice }
    }));
    
    // Mark as initialized so we don't overwrite on subsequent filter changes
    filterOptionsInitialized.current = true;
  }, [data, allProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const isArrayFilter = (value: any): value is string[] => Array.isArray(value);
    
    return data.filter(product => {
      if (filters.size) {
        const hasSize = product.sizes?.some((s: any) => 
          (s.displayName === filters.size) || (s.size === filters.size)
        );
        if (!hasSize) return false;
      }
      
      if (filters.brand) {
        if (isArrayFilter(filters.brand)) {
          if (!filters.brand.includes(product.brand?.name)) return false;
        } else if (product.brand?.name !== filters.brand) return false;
      }
      
      if (filters.originCountry) {
        if (isArrayFilter(filters.originCountry)) {
          if (!filters.originCountry.includes(product.originCountry)) return false;
        } else if (product.originCountry !== filters.originCountry) return false;
      }
      
      if (filters.categoryType) {
        if (isArrayFilter(filters.categoryType)) {
          if (product.category?.slug === undefined || !filters.categoryType.includes(product.category?.slug)) return false;
        } else if (product.category?.slug !== undefined && product.category?.slug !== filters.categoryType) return false;
      }
      
      if (filters.subCategoryType) {
        if (isArrayFilter(filters.subCategoryType)) {
          if (product.subCategory?.slug === undefined || !filters.subCategoryType.includes(product.subCategory?.slug)) return false;
        } else if (product.subCategory?.slug !== undefined && product.subCategory?.slug !== filters.subCategoryType) return false;
      }
      
      if (filters.flavorCategory) {
        const productFlavors = product.flavors?.map((f: any) => f.category) || [];
        if (isArrayFilter(filters.flavorCategory)) {
          if (!filters.flavorCategory.some((fc: string) => productFlavors.includes(fc))) return false;
        } else if (!productFlavors.includes(filters.flavorCategory)) return false;
      }
      
      const productMinPrice = product.priceRange?.min || 0;
      const filterMinPrice = filters.priceRange?.min ?? 0;
      const filterMaxPrice = filters.priceRange?.max ?? Infinity;
      if (productMinPrice < filterMinPrice || productMinPrice > filterMaxPrice) return false;
      
      if (filters.minRating && (product.averageRating || 0) < filters.minRating) return false;
      
      // Show only sale products — check that a real price reduction exists
      if (filters.showOnlySale) {
        const hasActiveSale = product.availableAt?.some((sp: any) => {
          // Must be flagged on-sale with a non-zero discount
          if (!sp.isOnSale) return false;
          // Check if there's a sale discount value or an active discount
          const hasDiscountValue = sp.saleDiscountValue > 0;
          const hasActiveDiscount = sp.discount?.value > 0 && isDiscountActive(sp.discount);
          
          if (!hasDiscountValue && !hasActiveDiscount) return false;
          
          // Verify sale dates are valid right now
          const now = new Date();
          if (hasDiscountValue) {
            const start = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
            const end = sp.saleEndDate ? new Date(sp.saleEndDate) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
          }
          // Confirm a real price difference exists in the computed pricing
          return sp.sizes?.some((s: any) => {
            const original = s.pricing?.originalWebsitePrice ?? 0;
            const current = s.pricing?.websitePrice ?? 0;
            return original > current;
          });
        });
        if (!hasActiveSale) return false;
      }
      
      // ABV Filter
      if (filters.abvRange) {
        const productAbv = product.abv || 0;
        if (filters.abvRange.max === 0) {
          // Non-alcoholic filter
          if (productAbv > 0) return false;
        } else {
          if (productAbv < filters.abvRange.min || productAbv > filters.abvRange.max) return false;
        }
      }
      
      // Volume Filter
      if (filters.volumeRange) {
        const hasVolume = product.sizes?.some((s: any) => {
          const sizeStr = String(s.size || s.displayName || '').toLowerCase();
          const volumeStr = filters.volumeRange!.toLowerCase();
          return sizeStr.includes(volumeStr) || volumeStr.includes(sizeStr);
        });
        if (!hasVolume) return false;
      }
      
      return true;
    });
  }, [data, filters]);

  // Sort products
  const sortedProducts = useMemo(() => {
    if (filteredProducts.length === 0) return [];
    
    const sorted = [...filteredProducts];
    
    switch (filters.sortOption) {
      case 'priceLowToHigh':
        return sorted.sort((a, b) => (a.priceRange?.min || 0) - (b.priceRange?.min || 0));
      case 'priceHighToLow':
        return sorted.sort((a, b) => (b.priceRange?.min || 0) - (a.priceRange?.min || 0));
      case 'discountHighToLow':
        return sorted.sort((a, b) => {
          // Use actual savings (₦) from server-computed pricing — works for both % and fixed discounts
          const getSavings = (product: any) => {
            const savings = (product.availableAt || []).flatMap((sp: any) =>
              (sp.sizes || []).map((s: any) => {
                const orig = s.pricing?.originalWebsitePrice || 0;
                const current = s.pricing?.websitePrice || orig;
                return orig > current ? orig - current : 0;
              })
            );
            return savings.length > 0 ? Math.max(...savings) : 0;
          };
          return getSavings(b) - getSavings(a);
        });
      case 'popularity':
      case 'bestselling':
        return sorted.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
      case 'rating':
        return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      case 'newest':
        return sorted.sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      default:
        return sorted;
    }
  }, [filteredProducts, filters.sortOption]);

  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / productPerPage));
  const currentProducts = sortedProducts.slice(offset, offset + productPerPage);

  // Reset to page 0 when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Update filter and sync with URL
  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Build URL params based on the NEW filter value, not searchParams
    const params = new URLSearchParams();
    const newFilters = { ...filters, [key]: value };
    const isArrayValue = Array.isArray(value);
    
    if (key === 'categoryType') {
      if (isArrayValue && (value as string[]).length > 0) {
        params.set('category', (value as string[]).join(','));
      } else if (!isArrayValue && value) {
        params.set('category', value as string);
      }
    } else if (newFilters.categoryType) {
      // Keep existing category if set
      if (Array.isArray(newFilters.categoryType)) {
        params.set('category', newFilters.categoryType.join(','));
      } else {
        params.set('category', newFilters.categoryType);
      }
    }
    
    if (key === 'subCategoryType') {
      if (isArrayValue && (value as string[]).length > 0) {
        params.set('subcategory', (value as string[]).join(','));
      } else if (!isArrayValue && value) {
        params.set('subcategory', value as string);
      }
    } else if (newFilters.subCategoryType) {
      if (Array.isArray(newFilters.subCategoryType)) {
        params.set('subcategory', newFilters.subCategoryType.join(','));
      } else {
        params.set('subcategory', newFilters.subCategoryType);
      }
    }
    
    if (key === 'brand') {
      if (isArrayValue && (value as string[]).length > 0) {
        params.set('brand', (value as string[]).join(','));
      } else if (!isArrayValue && value) {
        params.set('brand', value as string);
      }
    } else if (newFilters.brand) {
      if (Array.isArray(newFilters.brand)) {
        params.set('brand', newFilters.brand.join(','));
      } else {
        params.set('brand', newFilters.brand);
      }
    }
    
    if (newFilters.sortOption) {
      params.set('sort', newFilters.sortOption);
    }
    
    if (newFilters.showOnlySale) {
      params.set('sale', 'true');
    }
    
    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [filters, pathname, router]);

  const handleClearAll = useCallback(() => {
    setFilters({
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
      abvRange: null,
      volumeRange: null,
    });
    // Clear URL params via router so searchParams hook updates correctly
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const handlePageChange = useCallback((selected: number) => {
    setCurrentPage(selected);
  }, []);

  // Validate filters to ensure they're properly formed
  const validateFilters = useCallback((filters: FilterState): FilterState => {
    // Create a copy to avoid mutating the original
    const validated = { ...filters };
    
    // Validate array filters - ensure they're arrays or null
    if (validated.categoryType !== null && validated.categoryType !== undefined && !Array.isArray(validated.categoryType)) {
      validated.categoryType = [validated.categoryType];
    }
    
    if (validated.subCategoryType !== null && validated.subCategoryType !== undefined && !Array.isArray(validated.subCategoryType)) {
      validated.subCategoryType = [validated.subCategoryType];
    }
    
    if (validated.brand !== null && validated.brand !== undefined && !Array.isArray(validated.brand)) {
      validated.brand = [validated.brand];
    }
    
    if (validated.originCountry !== null && validated.originCountry !== undefined && !Array.isArray(validated.originCountry)) {
      validated.originCountry = [validated.originCountry];
    }
    
    if (validated.flavorCategory !== null && validated.flavorCategory !== undefined && !Array.isArray(validated.flavorCategory)) {
      validated.flavorCategory = [validated.flavorCategory];
    }
    
    // Validate numeric values
    if (validated.minRating && (typeof validated.minRating !== 'number' || validated.minRating < 1 || validated.minRating > 5)) {
      validated.minRating = null;
    }
    
    // Validate price range
    if (validated.priceRange) {
      if (typeof validated.priceRange.min !== 'number' || validated.priceRange.min < 0) {
        validated.priceRange.min = 0;
      }
      if (typeof validated.priceRange.max !== 'number' || validated.priceRange.max < validated.priceRange.min) {
        validated.priceRange.max = 100000;
      }
    }
    
    // Validate ABV range
    if (validated.abvRange) {
      if (typeof validated.abvRange.min !== 'number' || validated.abvRange.min < 0) {
        validated.abvRange.min = 0;
      }
      if (typeof validated.abvRange.max !== 'number' || validated.abvRange.max < validated.abvRange.min) {
        validated.abvRange.max = 100;
      }
    }
    
    return validated;
  }, []);

  // Build URL parameters from filter state
  const buildFilterUrlParams = useCallback((filters: FilterState, filterOptions: FilterOptions): string => {
    const params = new URLSearchParams();
    
    // Helper function to add array parameters
    const addArrayParam = (paramName: string, value: string | string[] | null) => {
      if (value) {
        if (Array.isArray(value) && value.length > 0) {
          params.set(paramName, value.join(','));
        } else if (!Array.isArray(value) && value) {
          params.set(paramName, value as string);
        }
      }
    };
    
    // Add category parameters
    addArrayParam('category', filters.categoryType);
    addArrayParam('subcategory', filters.subCategoryType);
    addArrayParam('brand', filters.brand);
    addArrayParam('origin', filters.originCountry);
    addArrayParam('flavor', filters.flavorCategory);
    
    // Add simple parameters
    if (filters.sortOption) {
      params.set('sort', filters.sortOption);
    }
    
    if (filters.showOnlySale) {
      params.set('sale', 'true');
    }
    
    if (filters.minRating) {
      params.set('minRating', filters.minRating.toString());
    }
    
    // Add price range parameters
    if (filters.priceRange) {
      if (filters.priceRange.min !== (filterOptions.priceRange?.min ?? 0)) {
        params.set('minPrice', filters.priceRange.min.toString());
      }
      if (filters.priceRange.max !== (filterOptions.priceRange?.max ?? 100000)) {
        params.set('maxPrice', filters.priceRange.max.toString());
      }
    }
    
    // Add ABV range parameters (only if not full range 0-100)
    if (filters.abvRange) {
      if (filters.abvRange.min !== 0 || filters.abvRange.max !== 100) {
        params.set('minABV', filters.abvRange.min.toString());
        params.set('maxABV', filters.abvRange.max.toString());
      }
    }
    
    // Add size/volume parameters
    if (filters.volumeRange) {
      params.set('volume', filters.volumeRange);
    }
    
    if (filters.size) {
      params.set('size', filters.size);
    }
    
    return params.toString();
  }, []);
  const getCountByBrand = useCallback((brand: string) => {
    return data?.filter(item => item.brand?.name === brand).length || 0;
  }, [data]);

  const getCountByOriginCountry = useCallback((country: string) => {
    return data?.filter(item => item.originCountry === country).length || 0;
  }, [data]);

  const getCountByCategoryType = useCallback((categoryType: string) => {
    return data?.filter(item => item.category?.slug === categoryType).length || 0;
  }, [data]);

  const getCountBySubCategoryType = useCallback((subCategoryType: string) => {
    return data?.filter(item => item.subCategory?.slug === subCategoryType).length || 0;
  }, [data]);

  const getCountByFlavorCategory = useCallback((flavorCategory: string) => {
    return data?.filter(item => 
      item.flavors?.some((f: any) => f.category === flavorCategory)
    ).length || 0;
  }, [data]);

  const hasProducts = data && data.length > 0;
  const hasFilteredResults = sortedProducts.length > 0;

  return (
    <>
      <BreadcrumbSection 
        filters={filters} 
        updateFilter={updateFilter} 
        categoryTypes={filterOptions.categoryType}
        totalProducts={sortedProducts.length}
      />
      
      {/* On Sale Highlight Section */}
      {!filters.showOnlySale && (
        <OnSaleHighlight products={data || []} />
      )}

      <FilterSidebar 
        open={openSidebar} 
        onClose={() => setOpenSidebar(false)} 
        filters={filters} 
        updateFilter={updateFilter} 
        data={data || []} 
        filterOptions={filterOptions} 
        getCountByBrand={getCountByBrand}
        getCountByOriginCountry={getCountByOriginCountry}
        getCountByCategoryType={getCountByCategoryType}
        getCountBySubCategoryType={getCountBySubCategoryType}
        getCountByFlavorCategory={getCountByFlavorCategory}
        onApplyFilters={(pendingFilters) => {
          // Validate filters before applying
          const validatedFilters = validateFilters(pendingFilters);
          
          // Apply all filters by setting the complete state at once
          setFilters(validatedFilters);
          
          // Build URL params using helper function
          const urlParams = buildFilterUrlParams(validatedFilters, filterOptions);
          
          // Navigate to the updated URL
          const newUrl = `${pathname}${urlParams ? `?${urlParams}` : ''}`;
          router.replace(newUrl, { scroll: false });
        }}
      />
      <div className="shop-product breadcrumb1 lg:py-20 md:py-14 py-10">
        <div className="container">
          {isLoading ? (
            <div className="list-product-block relative animate-fade-in">
              <FilterHeader
                onOpenSidebar={() => setOpenSidebar(true)}
                layoutCol={layoutCol}
                onLayoutChange={handleLayoutChange}
                filters={filters}
                updateFilter={updateFilter}
                sortOptions={SORT_OPTIONS}
                totalProducts={0}
                onClearAllFilters={handleClearAll}
              />
              <ProductGrid
                products={[]}
                layoutCol={layoutCol}
                productStyle={productStyle}
                isLoading={true}
              />
            </div>
          ) : hasProducts ? (
            <div className="list-product-block relative">
              <FilterHeader
                onOpenSidebar={() => setOpenSidebar(true)}
                layoutCol={layoutCol}
                onLayoutChange={handleLayoutChange}
                filters={filters}
                updateFilter={updateFilter}
                sortOptions={SORT_OPTIONS}
                totalProducts={sortedProducts.length}
                onClearAllFilters={handleClearAll}
              />
              {hasFilteredResults ? (
                <>
                  <ProductGrid 
                    products={currentProducts} 
                    layoutCol={layoutCol} 
                    productStyle={productStyle}
                    isLoading={false}
                  />
                  {pageCount > 1 && (
                    <PaginationSection 
                      pageCount={pageCount} 
                      currentPage={currentPage} 
                      onPageChange={handlePageChange} 
                    />
                  )}
                </>
              ) : (
                <div className="text-center py-20 animate-fade-in">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">No products match your filters</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">Try adjusting or clearing some filters to see more results.</p>
                  <button 
                    onClick={handleClearAll}
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">No products available</h3>
              <p className="text-gray-600">Check back later for new arrivals.</p>
            </div>
          )}
        </div>

        {/* Recently Viewed - only show when not filtering */}
        {!filters.brand && !filters.categoryType && (
          <RecentlyViewed layoutCol={layoutCol} />
        )}
      </div>
    </>
  );
};

export default Shop;
