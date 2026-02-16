'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { FilterState, FilterOptions, SortOption } from '@/types/filter.types';
import BreadcrumbSection from './BreadcrumbSection';
import FilterSidebar from './FilterSidebar';
import FilterHeader from './FilterHeader';
import ActiveFilters from './ActiveFilters';
import ProductGrid from './ProductGrid';
import PaginationSection from './PaginationSection';
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

interface Props {
  data: any[];
  productPerPage: number;
  dataType: string | null;
  slug?: string;
  productStyle: string;
  initialFilters?: FilterState;
  onFilterChange?: (key: keyof FilterState, value: any) => void;
  isLoading?: boolean;
}

const Shop: React.FC<Props> = ({ 
  data, 
  productPerPage, 
  dataType: initialDataType, 
  productStyle,
  initialFilters,
  onFilterChange,
  isLoading = false
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Get current filters from URL or use initialFilters
  const categoryType = searchParams.get('category') || initialFilters?.categoryType || null;
  const subCategoryType = searchParams.get('subcategory') || initialFilters?.subCategoryType || null;
  const brand = searchParams.get('brand') || initialFilters?.brand || null;
  const sortOption = searchParams.get('sort') || initialFilters?.sortOption || '';
  
  // State
  const [layoutCol, setLayoutCol] = useState<number>(4);
  const [openSidebar, setOpenSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    type: [],
    size: [],
    color: [],
    brand: [],
    originCountry: [],
    categoryType: [],
    subCategoryType: [],
    flavorCategory: [],
    priceRange: { min: 0, max: 100000 }
  });

  const [filters, setFilters] = useState<FilterState>({
    type: initialDataType || categoryType,
    size: null,
    color: null,
    brand: brand,
    priceRange: { min: 0, max: 100000 },
    showOnlySale: searchParams.get('sale') === 'true' || initialFilters?.showOnlySale || false,
    sortOption: sortOption,
    originCountry: null,
    categoryType: categoryType,
    subCategoryType: subCategoryType,
    flavorCategory: null,
    minRating: null,
  });

  const offset = currentPage * productPerPage;

  // Extract filter options from data
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const types = Array.from(new Set(data.map(p => p.type).filter(Boolean))) as string[];
    const brands = Array.from(new Set(data.map(p => p.brand?.name).filter(Boolean))) as string[];
    const origins = Array.from(new Set(data.map(p => p.originCountry).filter(Boolean))) as string[];
    const categoryTypes = Array.from(new Set(data.map(p => p.category?.type).filter(Boolean))) as string[];
    const flavorCategories = Array.from(
      new Set(data.flatMap(p => p.flavors?.map((f: any) => f.category) || []).filter(Boolean))
    ) as string[];
    const sizes = Array.from(new Set(
      data.flatMap(p => p.sizes?.map((s: any) => s.displayName || s.size).filter(Boolean) || [])
    )) as string[];
    
    const allPrices = data.flatMap(p => [
      p.priceRange?.min || 0,
      p.priceRange?.max || 0,
      ...(p.sizes?.map((s: any) => s.priceRange?.min || 0) || [])
    ]).filter(price => price > 0);
    
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100000;
    
    setFilterOptions({
      type: types,
      size: sizes,
      color: [],
      brand: brands,
      originCountry: origins,
      categoryType: categoryTypes,
      subCategoryType: [],
      flavorCategory: flavorCategories,
      priceRange: { min: minPrice, max: maxPrice }
    });
    
    setFilters(prev => ({
      ...prev,
      priceRange: { min: minPrice, max: maxPrice }
    }));
  }, [data]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.filter(product => {
      if (filters.type && product.type !== filters.type) return false;
      
      if (filters.size) {
        const hasSize = product.sizes?.some((s: any) => 
          (s.displayName === filters.size) || (s.size === filters.size)
        );
        if (!hasSize) return false;
      }
      
      if (filters.brand && product.brand?.name !== filters.brand) return false;
      if (filters.originCountry && product.originCountry !== filters.originCountry) return false;
      if (filters.categoryType && product.category?.type !== filters.categoryType) return false;
      
      if (filters.flavorCategory) {
        const hasFlavor = product.flavors?.some((f: any) => f.category === filters.flavorCategory);
        if (!hasFlavor) return false;
      }
      
      const productMinPrice = product.priceRange?.min || 0;
      const filterMinPrice = filters.priceRange?.min ?? 0;
      const filterMaxPrice = filters.priceRange?.max ?? Infinity;
      if (productMinPrice < filterMinPrice || productMinPrice > filterMaxPrice) return false;
      
      if (filters.minRating && (product.averageRating || 0) < filters.minRating) return false;
      
      // Show only sale products - check both discount field AND availableAt.isOnSale
      if (filters.showOnlySale) {
        const hasDiscount = product.discount?.value > 0 || 
          product.availableAt?.some((sp: any) => sp.isOnSale === true);
        if (!hasDiscount) return false;
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
          const discountA = a.discount?.value || 0;
          const discountB = b.discount?.value || 0;
          return discountB - discountA;
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
    
    // Sync with URL params
    const params = new URLSearchParams(searchParams.toString());
    
    if (key === 'categoryType' && value) {
      params.set('category', value as string);
    } else if (key === 'categoryType') {
      params.delete('category');
    }
    
    if (key === 'subCategoryType' && value) {
      params.set('subcategory', value as string);
    } else if (key === 'subCategoryType') {
      params.delete('subcategory');
    }
    
    if (key === 'brand' && value) {
      params.set('brand', value as string);
    } else if (key === 'brand') {
      params.delete('brand');
    }
    
    if (key === 'sortOption' && value) {
      params.set('sort', value as string);
    } else if (key === 'sortOption') {
      params.delete('sort');
    }
    
    if (key === 'showOnlySale' && value) {
      params.set('sale', 'true');
    } else if (key === 'showOnlySale') {
      params.delete('sale');
    }
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    
    // Also call the callback if provided
    if (onFilterChange) {
      onFilterChange(key, value);
    }
  }, [searchParams, pathname, router, onFilterChange]);

  const handleClearAll = useCallback(() => {
    setFilters({
      type: initialDataType,
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
    });
    
    // Clear URL params
    router.replace(pathname, { scroll: false });
  }, [initialDataType, filterOptions.priceRange, pathname, router]);

  const handlePageChange = useCallback((selected: number) => {
    setCurrentPage(selected);
  }, []);

  // Count functions
  const getCountByType = useCallback((type: string) => {
    return data?.filter(item => item.type === type).length || 0;
  }, [data]);

  const getCountByBrand = useCallback((brand: string) => {
    return data?.filter(item => item.brand?.name === brand).length || 0;
  }, [data]);

  const getCountByOriginCountry = useCallback((country: string) => {
    return data?.filter(item => item.originCountry === country).length || 0;
  }, [data]);

  const getCountByCategoryType = useCallback((categoryType: string) => {
    return data?.filter(item => item.category?.type === categoryType).length || 0;
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
        dataType={initialDataType} 
        filters={filters} 
        updateFilter={updateFilter} 
        categoryTypes={filterOptions.type} 
      />
      <FilterSidebar 
        open={openSidebar} 
        onClose={() => setOpenSidebar(false)} 
        filters={filters} 
        updateFilter={updateFilter} 
        data={data} 
        filterOptions={filterOptions} 
        getCountByType={getCountByType}
        getCountByBrand={getCountByBrand}
        getCountByOriginCountry={getCountByOriginCountry}
        getCountByCategoryType={getCountByCategoryType}
        getCountByFlavorCategory={getCountByFlavorCategory}
      />
      <div className="shop-product breadcrumb1 lg:py-20 md:py-14 py-10">
        <div className="container">
          {isLoading ? (
            <div className="list-product-block relative animate-fade-in">
              <FilterHeader 
                onOpenSidebar={() => setOpenSidebar(true)} 
                layoutCol={layoutCol} 
                onLayoutChange={setLayoutCol} 
                filters={filters} 
                updateFilter={updateFilter} 
                sortOptions={SORT_OPTIONS} 
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
                onLayoutChange={setLayoutCol} 
                filters={filters} 
                updateFilter={updateFilter} 
                sortOptions={SORT_OPTIONS} 
              />
              <ActiveFilters 
                filters={filters} 
                updateFilter={updateFilter} 
                onClearAll={handleClearAll} 
                totalProducts={sortedProducts.length} 
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
      </div>
    </>
  );
};

export default Shop;
