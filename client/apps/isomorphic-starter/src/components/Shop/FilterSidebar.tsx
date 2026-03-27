import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Icon from 'react-icons/pi';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { FilterState, FilterOptions, ProductCountFunctions } from '@/types/filter.types';
import { motion, AnimatePresence } from 'framer-motion';

interface FilterSidebarProps extends ProductCountFunctions {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  data: any[];
  filterOptions: FilterOptions;
  isLoading?: boolean;
  onClearAllFilters?: () => void;
  onApplyFilters?: (filters: FilterState) => void;
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
  isLoading?: boolean;
}

// Debounce hook for search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

  const FilterSection: React.FC<FilterSectionProps> = ({ 
    title, 
    icon, 
    children, 
    defaultOpen = true,
    badge,
    isLoading = false
  }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
      <div className="border-b border-gray-200 last:border-b-0">
        <button
          className="w-full flex items-center justify-between py-4 px-4 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-lg"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={`filter-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-600">{icon}</span>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {badge !== undefined && badge > 0 && (
              <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded-full">
                {badge}
              </span>
            )}
          </div>
          <div
            className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <Icon.PiCaretDown size={18} className="text-gray-400" />
          </div>
        </button>
        <div 
          id={`filter-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-screen' : 'max-h-0'}`}
          aria-hidden={!isOpen}
        >
          <div className="pb-4 px-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    );
  };

// Quick price presets
const PRICE_PRESETS = [
  { label: 'Under ₦5k', min: 0, max: 5000 },
  { label: '₦5k - ₦10k', min: 5000, max: 10000 },
  { label: '₦10k - ₦20k', min: 10000, max: 20000 },
  { label: '₦20k - ₦50k', min: 20000, max: 50000 },
  { label: '₦50k+', min: 50000, max: 100000 },
];

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  open,
  onClose,
  filters,
  updateFilter,
  filterOptions,
  getCountByBrand,
  getCountByOriginCountry,
  getCountByCategoryType,
  getCountBySubCategoryType,
  getCountByFlavorCategory,
  isLoading = false,
  onClearAllFilters,
  onApplyFilters,
}) => {
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters);
  const [priceRange, setPriceRange] = useState([
    filters.priceRange?.min ?? filterOptions.priceRange?.min ?? 0,
    filters.priceRange?.max ?? filterOptions.priceRange?.max ?? 100000
  ]);
  const [brandSearch, setBrandSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const debouncedBrandSearch = useDebounce(brandSearch, 300);

  // Sync pendingFilters with filters when sidebar opens
  useEffect(() => {
    if (open) {
      setPendingFilters(filters);
      setPriceRange([
        filters.priceRange?.min ?? filterOptions.priceRange?.min ?? 0,
        filters.priceRange?.max ?? filterOptions.priceRange?.max ?? 100000
      ]);
    }
  }, [open, filters, filterOptions.priceRange]);

  // Update price range when filters change externally
  useEffect(() => {
    setPriceRange([
      filters.priceRange?.min ?? filterOptions.priceRange?.min ?? 0,
      filters.priceRange?.max ?? filterOptions.priceRange?.max ?? 100000
    ]);
  }, [filters.priceRange?.min, filters.priceRange?.max, filterOptions.priceRange?.min, filterOptions.priceRange?.max]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && open) {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  const handleSizeClick = (size: string) => {
    setPendingFilters(prev => ({ ...prev, size: prev.size === size ? null : size }));
  };

  const handleBrandChange = (brand: string) => {
    const currentBrands = pendingFilters.brand;
    let newBrands: string[] | null;
    
    if (Array.isArray(currentBrands)) {
      if (currentBrands.includes(brand)) {
        newBrands = currentBrands.filter(b => b !== brand);
      } else {
        newBrands = [...currentBrands, brand];
      }
    } else {
      if (currentBrands === brand) {
        newBrands = null;
      } else {
        newBrands = [brand];
      }
    }
    
    setPendingFilters(prev => ({ ...prev, brand: newBrands }));
  };

  const handleOriginCountryClick = (country: string) => {
    const currentCountries = pendingFilters.originCountry;
    let newCountries: string[] | null;
    
    if (Array.isArray(currentCountries)) {
      if (currentCountries.includes(country)) {
        newCountries = currentCountries.filter(c => c !== country);
      } else {
        newCountries = [...currentCountries, country];
      }
    } else {
      if (currentCountries === country) {
        newCountries = null;
      } else {
        newCountries = [country];
      }
    }
    
    setPendingFilters(prev => ({ ...prev, originCountry: newCountries }));
  };

  const handleCategoryTypeClick = (categoryType: string) => {
    const current = pendingFilters.categoryType;
    let newValue: string[] | null;
    
    if (Array.isArray(current)) {
      if (current.includes(categoryType)) {
        newValue = current.filter(c => c !== categoryType);
      } else {
        newValue = [...current, categoryType];
      }
    } else {
      if (current === categoryType) {
        newValue = null;
      } else {
        newValue = [categoryType];
      }
    }
    
    setPendingFilters(prev => ({ ...prev, categoryType: newValue }));
  };

  const handleSubCategoryTypeClick = (subCategoryType: string) => {
    const current = pendingFilters.subCategoryType;
    let newValue: string[] | null;
    
    if (Array.isArray(current)) {
      if (current.includes(subCategoryType)) {
        newValue = current.filter(c => c !== subCategoryType);
      } else {
        newValue = [...current, subCategoryType];
      }
    } else {
      if (current === subCategoryType) {
        newValue = null;
      } else {
        newValue = [subCategoryType];
      }
    }
    
    setPendingFilters(prev => ({ ...prev, subCategoryType: newValue }));
  };

  const handleFlavorCategoryClick = (flavorCategory: string) => {
    const current = pendingFilters.flavorCategory;
    let newValue: string[] | null;
    
    if (Array.isArray(current)) {
      if (current.includes(flavorCategory)) {
        newValue = current.filter(c => c !== flavorCategory);
      } else {
        newValue = [...current, flavorCategory];
      }
    } else {
      if (current === flavorCategory) {
        newValue = null;
      } else {
        newValue = [flavorCategory];
      }
    }
    
    setPendingFilters(prev => ({ ...prev, flavorCategory: newValue }));
  };

  const handlePriceChange = (values: number | number[]) => {
    if (Array.isArray(values)) {
      setPriceRange(values);
    }
  };

  const handlePriceAfterChange = (values: number | number[]) => {
    if (Array.isArray(values)) {
      setPendingFilters(prev => ({ ...prev, priceRange: { min: values[0], max: values[1] } }));
    }
  };

  const handlePricePresetClick = (preset: typeof PRICE_PRESETS[0]) => {
    setPriceRange([preset.min, preset.max]);
    setPendingFilters(prev => ({ ...prev, priceRange: { min: preset.min, max: preset.max } }));
  };

  const handleRatingClick = (rating: number) => {
    setPendingFilters(prev => ({ ...prev, minRating: prev.minRating === rating ? null : rating }));
  };

  const handleAbvRangeClick = (range: { min: number; max: number }) => {
    const isSelected = pendingFilters.abvRange?.min === range.min && pendingFilters.abvRange?.max === range.max;
    setPendingFilters(prev => ({ ...prev, abvRange: isSelected ? null : range }));
  };

  const handleVolumeClick = (volume: string) => {
    const isSelected = pendingFilters.volumeRange === volume;
    setPendingFilters(prev => ({ ...prev, volumeRange: isSelected ? null : volume, size: isSelected ? null : prev.size }));
  };

  const handleClearPrice = () => {
    const defaultRange = {
      min: filterOptions.priceRange?.min ?? 0,
      max: filterOptions.priceRange?.max ?? 100000
    };
    setPriceRange([defaultRange.min, defaultRange.max]);
    setPendingFilters(prev => ({ ...prev, priceRange: defaultRange }));
  };

  const handleClearAll = useCallback(() => {
    const defaultFilters: FilterState = {
      size: null,
      color: null,
      brand: null,
      originCountry: null,
      categoryType: null,
      subCategoryType: null,
      flavorCategory: null,
      minRating: null,
      showOnlySale: false,
      priceRange: filterOptions.priceRange,
      abvRange: null,
      volumeRange: null,
      sortOption: '',
    };
    setPendingFilters(defaultFilters);
    setPriceRange([filterOptions.priceRange?.min ?? 0, filterOptions.priceRange?.max ?? 100000]);
    setBrandSearch('');
  }, [filterOptions.priceRange]);

  const handleApplyFilters = useCallback(() => {
    if (onApplyFilters) {
      onApplyFilters(pendingFilters);
    } else {
      // Fallback: build URL manually since updateFilter updates one at a time
      
      // First, immediately update the local state
      if (updateFilter) {
        Object.entries(pendingFilters).forEach(([key, value]) => {
          updateFilter(key as keyof FilterState, value);
        });
      }
    }
    // Delay closing to ensure navigation completes
    setTimeout(() => {
      onClose();
    }, 100);
  }, [pendingFilters, onApplyFilters, updateFilter, onClose]);

  // Check if filters have actually changed from initial state
  const hasPendingChanges = useMemo(() => {
    return JSON.stringify(pendingFilters) !== JSON.stringify(filters);
  }, [pendingFilters, filters]);

  // Helper to check if a specific filter has pending changes
  const isFilterPending = useCallback((filterKey: keyof FilterState, value: any) => {
    return JSON.stringify(pendingFilters[filterKey]) !== JSON.stringify(filters[filterKey]);
  }, [pendingFilters, filters]);

  // Helper function to format filter display names
  const formatFilterDisplayName = useCallback((filterKey: string, value: string): string => {
    switch (filterKey) {
      case 'categoryType':
        return value.replace(/-/g, ' ');
      case 'subCategoryType':
        return value.replace(/-/g, ' ');
      case 'flavorCategory':
        return value.replace(/-/g, ' ');
      case 'volumeRange':
        return value;
      case 'abvRange':
        if (value === 'non-alcoholic') return 'Non-Alcoholic';
        return value;
      default:
        return value;
    }
  }, []);
  
  // Helper function to get filter icons
  const getFilterIcon = useCallback((filterKey: string) => {
    switch (filterKey) {
      case 'categoryType': return <Icon.PiGridFour size={16} />;
      case 'subCategoryType': return <Icon.PiFolders size={16} />;
      case 'brand': return <Icon.PiBuildingApartment size={16} />;
      case 'originCountry': return <Icon.PiGlobe size={16} />;
      case 'flavorCategory': return <Icon.PiAirplaneTilt size={16} />;
      case 'minRating': return <Icon.PiStar size={16} />;
      case 'priceRange': return <Icon.PiCurrencyDollar size={16} />;
      case 'abvRange': return <Icon.PiWine size={16} />;
      case 'volumeRange': return <Icon.PiDrop size={16} />;
      case 'showOnlySale': return <Icon.PiTagSimple size={16} />;
      case 'size': return <Icon.PiRuler size={16} />;
      default: return null;
    }
  }, []);

  const filteredBrands = useMemo(() => {
    if (!debouncedBrandSearch) return filterOptions.brand;
    return filterOptions.brand.filter(b =>
      b.toLowerCase().includes(debouncedBrandSearch.toLowerCase())
    );
  }, [filterOptions.brand, debouncedBrandSearch]);

  const pendingFiltersCount = useMemo(() => {
    let count = 0;
    if (pendingFilters.size) count++;
    if (pendingFilters.brand && (Array.isArray(pendingFilters.brand) ? pendingFilters.brand.length > 0 : true)) count++;
    if (pendingFilters.originCountry && (Array.isArray(pendingFilters.originCountry) ? pendingFilters.originCountry.length > 0 : true)) count++;
    if (pendingFilters.categoryType && (Array.isArray(pendingFilters.categoryType) ? pendingFilters.categoryType.length > 0 : true)) count++;
    if (pendingFilters.subCategoryType && (Array.isArray(pendingFilters.subCategoryType) ? pendingFilters.subCategoryType.length > 0 : true)) count++;
    if (pendingFilters.flavorCategory && (Array.isArray(pendingFilters.flavorCategory) ? pendingFilters.flavorCategory.length > 0 : true)) count++;
    if (pendingFilters.minRating) count++;
    if ((pendingFilters.priceRange?.min ?? 0) !== (filterOptions.priceRange?.min ?? 0) ||
        (pendingFilters.priceRange?.max ?? 100000) !== (filterOptions.priceRange?.max ?? 100000)) count++;
    if (pendingFilters.showOnlySale) count++;
    if (pendingFilters.abvRange) count++;
    if (pendingFilters.volumeRange) count++;
    return count;
  }, [pendingFilters, filterOptions.priceRange]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.size) count++;
    if (filters.brand && (Array.isArray(filters.brand) ? filters.brand.length > 0 : true)) count++;
    if (filters.originCountry && (Array.isArray(filters.originCountry) ? filters.originCountry.length > 0 : true)) count++;
    if (filters.categoryType && (Array.isArray(filters.categoryType) ? filters.categoryType.length > 0 : true)) count++;
    if (filters.subCategoryType && (Array.isArray(filters.subCategoryType) ? filters.subCategoryType.length > 0 : true)) count++;
    if (filters.flavorCategory && (Array.isArray(filters.flavorCategory) ? filters.flavorCategory.length > 0 : true)) count++;
    if (filters.minRating) count++;
    if ((filters.priceRange?.min ?? 0) !== (filterOptions.priceRange?.min ?? 0) ||
        (filters.priceRange?.max ?? 100000) !== (filterOptions.priceRange?.max ?? 100000)) count++;
    if (filters.showOnlySale) count++;
    if (filters.abvRange) count++;
    if (filters.volumeRange) count++;
    return count;
  }, [filters, filterOptions.priceRange]);

  const isPriceFiltered = priceRange[0] !== (filterOptions.priceRange?.min ?? 0) || 
                         priceRange[1] !== (filterOptions.priceRange?.max ?? 100000);

  return (
    <>
      {/* Backdrop */}
      {open && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

      {/* Sidebar */}
      {open && (
          <aside
            ref={sidebarRef}
            className="fixed top-0 left-0 h-full w-full max-w-md bg-white shadow-2xl z-50"
            role="dialog"
            aria-label="Product filters"
            aria-modal="true"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <Icon.PiFadersHorizontal size={24} className="text-gray-900" />
                  <div>
                    <h2 className="text-xl font-bold">Filters</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activeFiltersCount} active, {pendingFiltersCount} pending
                    </p>
                  </div>
                  {pendingFiltersCount > 0 && (
                      <span
                        className="px-2.5 py-0.5 bg-gray-900 text-white text-sm font-medium rounded-full"
                      >
                        {pendingFiltersCount}
                      </span>
                    )}
                  {hasPendingChanges && (
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {pendingFiltersCount > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Close filters"
                  >
                    <Icon.PiX size={20} />
                  </button>
                </div>
              </div>

              {/* Filter Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Category */}
                {filterOptions.categoryType.length > 0 && (
                  <FilterSection 
                    title="Category" 
                    icon={<Icon.PiGridFour size={20} />}
                    badge={Array.isArray(pendingFilters.categoryType) ? pendingFilters.categoryType.length : (pendingFilters.categoryType ? 1 : 0) || undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.categoryType.map((item) => {
                         const count = getCountByCategoryType(item);
                         const isAppliedSelected = Array.isArray(filters.categoryType) 
                           ? filters.categoryType.includes(item)
                           : filters.categoryType === item;
                         const isPendingSelected = Array.isArray(pendingFilters.categoryType) 
                           ? pendingFilters.categoryType.includes(item)
                           : pendingFilters.categoryType === item;
                         const isPendingChange = isPendingSelected !== isAppliedSelected;
                         
                         return (
                           <button
                             key={item}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${
                               isPendingSelected
                                 ? 'bg-gray-900 text-white shadow-md'
                                 : 'hover:bg-gray-100 text-gray-700'
                             }`}
                             onClick={() => handleCategoryTypeClick(item)}
                           >
                             <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                               isPendingSelected 
                                 ? 'bg-white border-white' 
                                 : 'border-gray-400'
                             }`}>
                               {isPendingSelected && (
                                 <Icon.PiCheck size={14} className={isPendingSelected ? 'text-gray-900' : 'text-transparent'} />
                               )}
                             </span>
                             <span className="flex-1 text-left capitalize text-sm">{formatFilterDisplayName('categoryType', item)}</span>
                             {isPendingChange && (
                               <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                             )}
                             <span className={`text-xs ${isPendingSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                               {count}
                             </span>
                           </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* Subcategory */}
                {filterOptions.subCategoryType.length > 0 && (
                  <FilterSection 
                    title="Subcategory" 
                    icon={<Icon.PiFolders size={20} />}
                    badge={Array.isArray(pendingFilters.subCategoryType) ? pendingFilters.subCategoryType.length : (pendingFilters.subCategoryType ? 1 : 0) || undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.subCategoryType.map((item) => {
                         const count = getCountBySubCategoryType(item);
                         const isAppliedSelected = Array.isArray(filters.subCategoryType) 
                           ? filters.subCategoryType.includes(item)
                           : filters.subCategoryType === item;
                         const isPendingSelected = Array.isArray(pendingFilters.subCategoryType) 
                           ? pendingFilters.subCategoryType.includes(item)
                           : pendingFilters.subCategoryType === item;
                         const isPendingChange = isPendingSelected !== isAppliedSelected;
                         
                         return (
                           <button
                             key={item}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${
                               isPendingSelected
                                 ? 'bg-gray-900 text-white shadow-md'
                                 : 'hover:bg-gray-100 text-gray-700'
                             }`}
                             onClick={() => handleSubCategoryTypeClick(item)}
                           >
                             <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                               isPendingSelected 
                                 ? 'bg-white border-white' 
                                 : 'border-gray-400'
                             }`}>
                               {isPendingSelected && (
                                 <Icon.PiCheck size={14} className={isPendingSelected ? 'text-gray-900' : 'text-transparent'} />
                               )}
                             </span>
                             <span className="flex-1 text-left capitalize text-sm">{formatFilterDisplayName('subCategoryType', item)}</span>
                             {isPendingChange && (
                               <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                             )}
                             <span className={`text-xs ${isPendingSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                               {count}
                             </span>
                           </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* Brands with Search */}
                {filterOptions.brand.length > 0 && (
                  <FilterSection 
                    title="Brands" 
                    icon={<Icon.PiBuildingApartment size={20} />}
                    badge={Array.isArray(pendingFilters.brand) ? pendingFilters.brand.length : (pendingFilters.brand ? 1 : 0) || undefined}
                    isLoading={isLoading}
                  >
                    <div className="mb-3">
                      <div className="relative">
                        <Icon.PiMagnifyingGlass
                          size={18}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          placeholder="Search brands..."
                          value={brandSearch}
                          onChange={(e) => setBrandSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        />
                        {brandSearch && (
                          <button
                            onClick={() => setBrandSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <Icon.PiX size={16} />
                          </button>
                        )}
                      </div>
                      {debouncedBrandSearch && (
                        <p className="text-xs text-gray-500 mt-1">
                          {filteredBrands.length} result{filteredBrands.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin">
                      {filteredBrands.length > 0 ? (
                        filteredBrands.map((item) => {
                          const count = getCountByBrand(item);
                          const isAppliedSelected = Array.isArray(filters.brand) 
                            ? filters.brand.includes(item)
                            : filters.brand === item;
                          const isPendingSelected = Array.isArray(pendingFilters.brand) 
                            ? pendingFilters.brand.includes(item)
                            : pendingFilters.brand === item;
                          const isPendingChange = isPendingSelected !== isAppliedSelected;
                          
                          return (
                            <button
                              key={item}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${
                                isPendingSelected
                                  ? 'bg-gray-900 text-white shadow-md'
                                  : 'hover:bg-gray-100 text-gray-700'
                              }`}
                              onClick={() => handleBrandChange(item)}
                            >
                              <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                                isPendingSelected 
                                  ? 'bg-white border-white' 
                                  : 'border-gray-400'
                              }`}>
                                {isPendingSelected && (
                                  <Icon.PiCheck size={14} className={isPendingSelected ? 'text-gray-900' : 'text-transparent'} />
                                )}
                              </span>
                              <span className="flex-1 text-left capitalize text-sm">{item}</span>
                              {isPendingChange && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                              )}
                              <span className={`text-xs ${isPendingSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No brands found
                        </p>
                      )}
                    </div>
                  </FilterSection>
                )}

                {/* Origin Country */}
                {filterOptions.originCountry.length > 0 && (
                  <FilterSection 
                    title="Origin Country" 
                    icon={<Icon.PiGlobe size={20} />}
                    badge={Array.isArray(pendingFilters.originCountry) ? pendingFilters.originCountry.length : (pendingFilters.originCountry ? 1 : 0) || undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.originCountry.map((item) => {
                         const count = getCountByOriginCountry(item);
                         const isAppliedSelected = Array.isArray(filters.originCountry) 
                           ? filters.originCountry.includes(item)
                           : filters.originCountry === item;
                         const isPendingSelected = Array.isArray(pendingFilters.originCountry) 
                           ? pendingFilters.originCountry.includes(item)
                           : pendingFilters.originCountry === item;
                         const isPendingChange = isPendingSelected !== isAppliedSelected;
                         
                         return (
                           <button
                             key={item}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${
                               isPendingSelected
                                 ? 'bg-gray-900 text-white shadow-md'
                                 : 'hover:bg-gray-100 text-gray-700'
                             }`}
                             onClick={() => handleOriginCountryClick(item)}
                           >
                             <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                               isPendingSelected 
                                 ? 'bg-white border-white' 
                                 : 'border-gray-400'
                             }`}>
                               {isPendingSelected && (
                                 <Icon.PiCheck size={14} className={isPendingSelected ? 'text-gray-900' : 'text-transparent'} />
                               )}
                             </span>
                             <span className="flex-1 text-left capitalize text-sm">{item}</span>
                             {isPendingChange && (
                               <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                             )}
                             <span className={`text-xs ${isPendingSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                               {count}
                             </span>
                           </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* Size / Volume */}
                {(filterOptions.size.length > 0 || filterOptions.volumes.length > 0) && (
                  <FilterSection 
                    title="Volume" 
                    icon={<Icon.PiDrop size={20} />}
                    badge={pendingFilters.size || pendingFilters.volumeRange ? 1 : undefined}
                    isLoading={isLoading}
                  >
                    <div className="flex flex-wrap gap-2">
                      {filterOptions.volumes.length > 0 ? filterOptions.volumes.map((item) => {
                        const isAppliedSelected = filters.volumeRange === item;
                        const isPendingSelected = pendingFilters.volumeRange === item;
                        const isPendingChange = isPendingSelected !== isAppliedSelected;
                        
                        return (
                          <button
                            key={item}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all relative ${
                              isPendingSelected
                                ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                                : 'border-gray-200 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              setPendingFilters(prev => ({ ...prev, volumeRange: prev.volumeRange === item ? null : item, size: prev.volumeRange === item ? null : prev.size }));
                            }}
                            aria-label={`Volume ${item}`}
                          >
                            {item}
                            {isPendingChange && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                            )}
                          </button>
                        );
                      }) : filterOptions.size.map((item) => {
                        const isAppliedSelected = filters.size === item;
                        const isPendingSelected = pendingFilters.size === item;
                        const isPendingChange = isPendingSelected !== isAppliedSelected;
                        
                        return (
                          <button
                            key={item}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all relative ${
                              isPendingSelected
                                ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                                : 'border-gray-200 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              setPendingFilters(prev => ({ ...prev, size: prev.size === item ? null : item, volumeRange: prev.size === item ? null : prev.volumeRange }));
                            }}
                            aria-label={`Size ${item}`}
                          >
                            {item}
                            {isPendingChange && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* ABV Filter */}
                {filterOptions.abvRanges && filterOptions.abvRanges.length > 0 && (
                  <FilterSection 
                    title="Alcohol (ABV)" 
                    icon={<Icon.PiWine size={20} />}
                    badge={pendingFilters.abvRange ? 1 : undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-2">
                      {filterOptions.abvRanges.map((range) => {
                         const isAppliedSelected = filters.abvRange?.min === range.min && filters.abvRange?.max === range.max;
                         const isPendingSelected = pendingFilters.abvRange?.min === range.min && pendingFilters.abvRange?.max === range.max;
                         const isPendingChange = isPendingSelected !== isAppliedSelected;
                         
                         return (
                           <button
                             key={range.label}
                             onClick={() => {
                               setPendingFilters(prev => ({ 
                                 ...prev, 
                                 abvRange: isPendingSelected ? null : { min: range.min, max: range.max }
                               }));
                             }}
                             className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all relative ${
                               isPendingSelected
                                 ? 'border-amber-500 bg-amber-50 text-amber-900'
                                 : 'border-gray-200 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                             }`}
                           >
                             <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                 isPendingSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                               }`}>
                                 <Icon.PiWine size={16} />
                               </div>
                               <span className="text-sm font-medium">{range.label}</span>
                             </div>
                             {isPendingSelected && (
                               <Icon.PiCheck size={18} className="text-amber-500" />
                             )}
                             {isPendingChange && (
                               <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                             )}
                           </button>
                        );
                      })}
                      
                      <button
                        onClick={() => {
                          setPendingFilters(prev => ({ 
                            ...prev, 
                            abvRange: prev.abvRange?.max === 0 ? null : { min: 0, max: 0 }
                          }));
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all relative ${
                          pendingFilters.abvRange?.max === 0
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-gray-200 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            pendingFilters.abvRange?.max === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Icon.PiDrop size={16} />
                          </div>
                          <div>
                            <span className="text-sm font-medium block">Non-Alcoholic</span>
                            <span className="text-xs text-gray-500">0% ABV</span>
                          </div>
                        </div>
                        {pendingFilters.abvRange?.max === 0 && (
                          <Icon.PiCheck size={18} className="text-emerald-500" />
                        )}
                        {isFilterPending('abvRange', pendingFilters.abvRange?.max === 0 ? null : { min: 0, max: 0 }) && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                        )}
                      </button>
                    </div>
                  </FilterSection>
                )}

                {/* Price Range */}
                <FilterSection 
                  title="Price Range" 
                  icon={<Icon.PiCurrencyDollar size={20} />}
                  badge={isPriceFiltered ? 1 : undefined}
                  isLoading={isLoading}
                >
                  <div className="space-y-4">
                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2">
                      {PRICE_PRESETS.map((preset) => {
                        const isActive = priceRange[0] === preset.min && priceRange[1] === preset.max;
                        
                        return (
                          <button
                            key={preset.label}

onClick={() => handlePricePresetClick(preset)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                              isActive
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Slider */}
                    <div className="px-1">
                      <Slider
                        range
                        min={filterOptions.priceRange?.min ?? 0}
                        max={filterOptions.priceRange?.max ?? 100000}
                        value={priceRange}
                        onChange={handlePriceChange}
                        onChangeComplete={handlePriceAfterChange}
                        className="my-4"
                        trackStyle={[{ backgroundColor: '#111827', height: 6 }]} // gray-900
                        railStyle={{ backgroundColor: '#E5E7EB', height: 6 }} // gray-200
                        handleStyle={[
                          { 
                            backgroundColor: '#111827', 
                            borderColor: '#111827', 
                            opacity: 1,
                            width: 20,
                            height: 20,
                            marginTop: -7
                          },
                          { 
                            backgroundColor: '#111827', 
                            borderColor: '#111827', 
                            opacity: 1,
                            width: 20,
                            height: 20,
                            marginTop: -7
                          },
                        ]}
                      />
                    </div>

                    {/* Price Inputs */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Min</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                        <input
                          type="number"
                          value={priceRange[0]}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || (filterOptions.priceRange?.min ?? 0);
                            const newRange = [Math.min(val, priceRange[1] - 1), priceRange[1]];
                            setPriceRange(newRange);
                            setPendingFilters(prev => ({ ...prev, priceRange: { min: newRange[0], max: newRange[1] } }));
                          }}
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                        />
                        </div>
                      </div>
                      <span className="text-gray-400 mt-5">-</span>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Max</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                        <input
                          type="number"
                          value={priceRange[1]}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || (filterOptions.priceRange?.max ?? 100000);
                            const newRange = [priceRange[0], Math.max(val, priceRange[0] + 1)];
                            setPriceRange(newRange);
                            setPendingFilters(prev => ({ ...prev, priceRange: { min: newRange[0], max: newRange[1] } }));
                          }}
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                        />
                        </div>
                      </div>
                    </div>

                    {/* Clear Price */}
                    {isPriceFiltered && (
                      <button
                        onClick={handleClearPrice}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                      >
                        <Icon.PiArrowCounterClockwise size={16} />
                        Reset price filter
                      </button>
                    )}
                  </div>
                </FilterSection>

                {/* Flavors */}
                {filterOptions.flavorCategory.length > 0 && (
                  <FilterSection 
                    title="Flavors" 
                    icon={<Icon.PiAirplaneTilt size={20} />}
                    badge={pendingFilters.flavorCategory ? 1 : undefined}
                    defaultOpen={false}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.flavorCategory.map((item) => {
                         const count = getCountByFlavorCategory(item);
                         const isAppliedSelected = Array.isArray(filters.flavorCategory) 
                           ? filters.flavorCategory.includes(item)
                           : filters.flavorCategory === item;
                         const isPendingSelected = Array.isArray(pendingFilters.flavorCategory) 
                           ? pendingFilters.flavorCategory.includes(item)
                           : pendingFilters.flavorCategory === item;
                         const isPendingChange = isPendingSelected !== isAppliedSelected;
                         
                         return (
                           <button
                             key={item}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${
                               isPendingSelected
                                 ? 'bg-gray-900 text-white shadow-md'
                                 : 'hover:bg-gray-100 text-gray-700'
                             }`}
                             onClick={() => handleFlavorCategoryClick(item)}
                           >
                             <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                               isPendingSelected 
                                 ? 'bg-white border-white' 
                                 : 'border-gray-400'
                             }`}>
                               {isPendingSelected && (
                                 <Icon.PiCheck size={14} className={isPendingSelected ? 'text-gray-900' : 'text-transparent'} />
                               )}
                             </span>
                             <span className="flex-1 text-left capitalize text-sm">{formatFilterDisplayName('flavorCategory', item)}</span>
                             {isPendingChange && (
                               <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                             )}
                             <span className={`text-xs ${isPendingSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                               {count}
                             </span>
                           </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                  {/* Rating */}
                  <FilterSection 
                    title="Rating" 
                    icon={<Icon.PiStar size={20} />}
                    badge={pendingFilters.minRating ? 1 : undefined}
                    defaultOpen={false}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const isAppliedSelected = filters.minRating === rating;
                        const isPendingSelected = pendingFilters.minRating === rating;
                        const isPendingChange = isPendingSelected !== isAppliedSelected;
                        
                        return (
                          <button
                            key={rating}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all relative ${
                              isPendingSelected
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            onClick={() => setPendingFilters(prev => ({ ...prev, minRating: prev.minRating === rating ? null : rating }))}
                          >
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Icon.PiStarFill
                                  key={i}
                                  size={16}
                                  className={i < rating ? 'text-yellow-400' : 'text-gray-300'}
                                />
                              ))}
                              <span className="text-sm ml-1">& up</span>
                            </div>
                            {isPendingChange && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>
                            )}
                          </button>
                      );
                    })}
                  </div>
                </FilterSection>

                {/* On Sale Toggle */}
                <div className="p-4 border-b border-gray-200">
                  <label
                    className="flex items-center gap-3 cursor-pointer group p-2 -m-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={pendingFilters.showOnlySale}
                        onChange={(e) => setPendingFilters(prev => ({ ...prev, showOnlySale: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div
                        className={`w-11 h-6 rounded-full peer cursor-pointer ${pendingFilters.showOnlySale ? 'bg-red-500' : 'bg-gray-200'}`}
                      >
                        <div
                          className={`absolute top-[2px] ${pendingFilters.showOnlySale ? 'left-[22px]' : 'left-[2px]'} bg-white rounded-full h-5 w-5 shadow-md transition-transform`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon.PiTagSimple size={20} className="text-red-500" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        On Sale Only
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer - Apply / Clear */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-3">
                  <button
                    onClick={handleClearAll}
                    disabled={pendingFiltersCount === 0}
                    className={`flex-1 py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      pendingFiltersCount > 0
                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                        : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Icon.PiArrowCounterClockwise size={18} />
                    Clear
                  </button>
                  <button
                    onClick={handleApplyFilters}
                    disabled={!hasPendingChanges}
                    className={`flex-1 py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      hasPendingChanges
                        ? 'bg-gray-900 hover:bg-gray-800 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Icon.PiCheck size={18} />
                    Apply Filters
                    {pendingFiltersCount > 0 && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                        {pendingFiltersCount}
                      </span>
                    )}
                  </button>
                </div>
               </div>
             </div>
           </aside>
         )}
    </>
  );
};

export default FilterSidebar;
