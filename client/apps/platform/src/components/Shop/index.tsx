'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FilterState, FilterOptions, SortOption } from '@/types/filter.types';
import FilterSidebar from './FilterSidebar';
import FilterHeader from './FilterHeader';
import ProductGrid from './ProductGrid';
import PaginationSection from './PaginationSection';
import OnSaleHighlight from './OnSaleHighlight';
import RecentlyViewed from './RecentlyViewed';

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

function isDiscountActive(discount: any): boolean {
  if (!discount || !discount.value) return false;
  const now = new Date();
  if (discount.startDate && now < new Date(discount.startDate)) return false;
  if (discount.endDate && now > new Date(discount.endDate)) return false;
  return true;
}

function createDefaultFilters(priceRange: FilterOptions['priceRange']): FilterState {
  return {
    size: null,
    color: null,
    brand: null,
    priceRange,
    showOnlySale: false,
    sortOption: '',
    originCountry: null,
    categoryType: null,
    subCategoryType: null,
    flavorCategory: null,
    minRating: null,
    abvRange: null,
    volumeRange: null,
  };
}

function validateFilters(filters: FilterState): FilterState {
  const validated = { ...filters };

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

  if (validated.minRating && (typeof validated.minRating !== 'number' || validated.minRating < 1 || validated.minRating > 5)) {
    validated.minRating = null;
  }

  if (validated.priceRange) {
    if (typeof validated.priceRange.min !== 'number' || validated.priceRange.min < 0) {
      validated.priceRange.min = 0;
    }
    if (typeof validated.priceRange.max !== 'number' || validated.priceRange.max < validated.priceRange.min) {
      validated.priceRange.max = 100000;
    }
  }

  if (validated.abvRange) {
    if (typeof validated.abvRange.min !== 'number' || validated.abvRange.min < 0) {
      validated.abvRange.min = 0;
    }
    if (typeof validated.abvRange.max !== 'number' || validated.abvRange.max < validated.abvRange.min) {
      validated.abvRange.max = 100;
    }
  }

  return validated;
}

function buildFilterUrlParams(filters: FilterState, filterOptions: FilterOptions): string {
  const params = new URLSearchParams();

  const addArrayParam = (paramName: string, value: string | string[] | null) => {
    if (value) {
      if (Array.isArray(value) && value.length > 0) {
        params.set(paramName, value.join(','));
      } else if (!Array.isArray(value) && value) {
        params.set(paramName, value as string);
      }
    }
  };

  addArrayParam('category', filters.categoryType);
  addArrayParam('subcategory', filters.subCategoryType);
  addArrayParam('brand', filters.brand);
  addArrayParam('origin', filters.originCountry);
  addArrayParam('flavor', filters.flavorCategory);

  if (filters.sortOption) {
    params.set('sort', filters.sortOption);
  }

  if (filters.showOnlySale) {
    params.set('sale', 'true');
  }

  if (filters.minRating) {
    params.set('minRating', filters.minRating.toString());
  }

  if (filters.priceRange) {
    if (filters.priceRange.min !== (filterOptions.priceRange?.min ?? 0)) {
      params.set('minPrice', filters.priceRange.min.toString());
    }
    if (filters.priceRange.max !== (filterOptions.priceRange?.max ?? 100000)) {
      params.set('maxPrice', filters.priceRange.max.toString());
    }
  }

  if (filters.abvRange) {
    if (filters.abvRange.min !== 0 || filters.abvRange.max !== 100) {
      params.set('minABV', filters.abvRange.min.toString());
      params.set('maxABV', filters.abvRange.max.toString());
    }
  }

  if (filters.volumeRange) {
    params.set('volume', filters.volumeRange);
  }

  if (filters.size) {
    params.set('size', filters.size);
  }

  return params.toString();
}

const EMPTY_CATEGORY_SVG = (
  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const CLEAR_ALL_SVG = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const EMPTY_PRODUCTS_SVG = (
  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

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

  // Initialize filters - use initialFilters from URL if available
  const [filters, setFilters] = useState<FilterState>(() => {
    if (initialFilters) {
      const merged = { ...createDefaultFilters(filterOptions.priceRange), ...initialFilters };
      if (!merged.priceRange || typeof merged.priceRange.min !== 'number') {
        merged.priceRange = filterOptions.priceRange;
      }
      return merged;
    }
    return createDefaultFilters(filterOptions.priceRange);
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
      if (!catChanged && !subChanged) return prev;
      return { ...prev, categoryType: newCat, subCategoryType: newSub };
    });
  }, [searchParams]);

  const offset = currentPage * productPerPage;

  const filterOptionsInitialized = useRef(false);

  const [allProducts, setAllProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!data || data.length === 0 || filterOptionsInitialized.current) return;
    setAllProducts(data);
  }, [data]);

  useEffect(() => {
    if ((!data && !allProducts) || (data && data.length === 0 && allProducts.length === 0) || filterOptionsInitialized.current) return;

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

    filterOptionsInitialized.current = true;
  }, [data, allProducts]);

  // Catalog-wide facets — the page-derived options above only see the loaded
  // (already filtered, first-page) products, so brands/origins/categories not
  // on that page would be invisible. Fetch the full catalog facets once and
  // override those option lists.
  useEffect(() => {
    let alive = true;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    fetch(`${base}/api/products/filter-options`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive || !json?.success) return;
        const d = json.data || {};
        setFilterOptions((prev: any) => ({
          ...prev,
          ...(d.brands?.length ? { brand: d.brands.map((b: any) => b.name) } : {}),
          ...(d.origins?.length ? { originCountry: d.origins } : {}),
          ...(d.categories?.length ? { categoryType: d.categories.map((c: any) => c.slug) } : {}),
          ...(d.subCategories?.length ? { subCategoryType: d.subCategories.map((s: any) => s.slug) } : {}),
          ...(d.priceRange?.max > 0 ? { priceRange: d.priceRange } : {}),
        }));
        // Widen the active price filter to the catalog bounds so client-side
        // filtering never hides products the server returned. Skip when the
        // URL already pins an explicit price range.
        const hasUrlPrice = searchParams.get('minPrice') || searchParams.get('maxPrice');
        if (d.priceRange?.max > 0 && !hasUrlPrice) {
          setFilters((prev: any) => ({
            ...prev,
            priceRange: {
              min: Math.min(prev.priceRange?.min ?? d.priceRange.min, d.priceRange.min),
              max: Math.max(prev.priceRange?.max ?? d.priceRange.max, d.priceRange.max),
            },
          }));
        }
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const productMaxPrice = product.priceRange?.max || productMinPrice;
      const filterMinPrice = filters.priceRange?.min ?? 0;
      const filterMaxPrice = filters.priceRange?.max ?? Infinity;
      if (productMaxPrice < filterMinPrice || productMinPrice > filterMaxPrice) return false;

      if (filters.minRating && (product.averageRating || 0) < filters.minRating) return false;

      if (filters.showOnlySale) {
        const hasActiveSale = product.availableAt?.some((sp: any) => {
          if (!sp.isOnSale) return false;
          const hasDiscountValue = sp.saleDiscountValue > 0;
          const hasActiveDiscount = sp.discount?.value > 0 && isDiscountActive(sp.discount);

          if (!hasDiscountValue && !hasActiveDiscount) return false;

          const now = new Date();
          if (hasDiscountValue) {
            const start = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
            const end = sp.saleEndDate ? new Date(sp.saleEndDate) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
          }
          return sp.sizes?.some((s: any) => {
            const original = s.pricing?.originalWebsitePrice ?? 0;
            const current = s.pricing?.websitePrice ?? 0;
            return original > current;
          });
        });
        if (!hasActiveSale) return false;
      }

      if (filters.abvRange) {
        const productAbv = product.abv || 0;
        if (filters.abvRange.max === 0) {
          if (productAbv > 0) return false;
        } else {
          if (productAbv < filters.abvRange.min || productAbv > filters.abvRange.max) return false;
        }
      }

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

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Precompute filter counts in a single pass (O(n) instead of O(n·m))
  const filterCounts = useMemo(() => {
    const brands = new Map<string, number>();
    const origins = new Map<string, number>();
    const categories = new Map<string, number>();
    const subcategories = new Map<string, number>();
    const flavors = new Map<string, number>();

    if (data) {
      for (const item of data) {
        const brandName = item.brand?.name;
        if (brandName) brands.set(brandName, (brands.get(brandName) || 0) + 1);

        const origin = item.originCountry;
        if (origin) origins.set(origin, (origins.get(origin) || 0) + 1);

        const catSlug = item.category?.slug;
        if (catSlug) categories.set(catSlug, (categories.get(catSlug) || 0) + 1);

        const subSlug = item.subCategory?.slug;
        if (subSlug) subcategories.set(subSlug, (subcategories.get(subSlug) || 0) + 1);

        const productFlavors = item.flavors || [];
        for (const f of productFlavors) {
          const fc = f.category;
          if (fc) flavors.set(fc, (flavors.get(fc) || 0) + 1);
        }
      }
    }

    return { brands, origins, categories, subcategories, flavors };
  }, [data]);

  const getCountByBrand = useCallback(
    (brand: string) => filterCounts.brands.get(brand) || 0,
    [filterCounts]
  );
  const getCountByOriginCountry = useCallback(
    (country: string) => filterCounts.origins.get(country) || 0,
    [filterCounts]
  );
  const getCountByCategoryType = useCallback(
    (cat: string) => filterCounts.categories.get(cat) || 0,
    [filterCounts]
  );
  const getCountBySubCategoryType = useCallback(
    (sub: string) => filterCounts.subcategories.get(sub) || 0,
    [filterCounts]
  );
  const getCountByFlavorCategory = useCallback(
    (flavor: string) => filterCounts.flavors.get(flavor) || 0,
    [filterCounts]
  );

  const hasProducts = data && data.length > 0;
  const hasFilteredResults = sortedProducts.length > 0;

  // ref that tracks filter state for the URL-building closure so updateFilter
  // doesn't need [filters] as a dependency (stabilizes the callback ref)
  const urlStateRef = useRef(filters);

  // filter-state key → URL param name for everything the server understands
  const FILTER_URL_KEYS: Partial<Record<keyof FilterState, string>> = {
    categoryType: 'category',
    subCategoryType: 'subcategory',
    brand: 'brand',
    originCountry: 'origin',
    flavorCategory: 'flavor',
    sortOption: 'sort',
    minRating: 'minRating',
  };

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    urlStateRef.current = { ...urlStateRef.current, [key]: value };

    setFilters(prev => ({ ...prev, [key]: value }));

    // Start from the current URL so unrelated params (search, minPrice,
    // origin, ABV, …) survive a single-filter change — rebuilding from
    // scratch silently dropped every param this function didn't know about.
    const params = new URLSearchParams(searchParams.toString());

    const urlKey = FILTER_URL_KEYS[key];
    if (urlKey) {
      const joined = Array.isArray(value)
        ? (value as string[]).filter(Boolean).join(',')
        : value
          ? String(value)
          : '';
      if (joined) params.set(urlKey, joined);
      else params.delete(urlKey);
    } else if (key === 'showOnlySale') {
      if (value) params.set('sale', 'true');
      else {
        params.delete('sale');
        params.delete('saleType');
      }
    } else if (key === 'priceRange') {
      // Chip removal resets the range to the defaults — clear any URL pin.
      params.delete('minPrice');
      params.delete('maxPrice');
    }
    // Other keys (size, abvRange, volumeRange, color) are client-side only.

    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleClearAll = useCallback(() => {
    setFilters(createDefaultFilters(filterOptions.priceRange));
    router.replace(pathname, { scroll: false });
  }, [filterOptions.priceRange, pathname, router]);

  // Remove only the search param — used by the "Search" chip in ActiveFilters.
  const handleClearSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handlePageChange = useCallback((selected: number) => {
    setCurrentPage(selected);
  }, []);

  const handleApplyFilters = useCallback((pendingFilters: FilterState) => {
    const validatedFilters = validateFilters(pendingFilters);

    setFilters(validatedFilters);

    const urlParams = buildFilterUrlParams(validatedFilters, filterOptions);
    const newUrl = `${pathname}${urlParams ? `?${urlParams}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [filterOptions, pathname, router]);

  return (
    <>
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
        onApplyFilters={handleApplyFilters}
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
                defaultPriceRange={filterOptions.priceRange}
                searchQuery={searchQuery}
                onClearSearch={handleClearSearch}
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
                defaultPriceRange={filterOptions.priceRange}
                searchQuery={searchQuery}
                onClearSearch={handleClearSearch}
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
                    {EMPTY_CATEGORY_SVG}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">No products match your filters</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">Try adjusting or clearing some filters to see more results.</p>
                  <button
                    onClick={handleClearAll}
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
                  >
                    {CLEAR_ALL_SVG}
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                {EMPTY_PRODUCTS_SVG}
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">No products available</h3>
              <p className="text-gray-600">Check back later for new arrivals.</p>
            </div>
          )}
        </div>

        {!filters.brand && !filters.categoryType && (
          <RecentlyViewed layoutCol={layoutCol} />
        )}
      </div>
    </>
  );
};

export default Shop;
