import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Icon from 'react-icons/pi';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { FilterState, FilterOptions, ProductCountFunctions } from '@/types/filter.types';

interface FilterSidebarProps extends ProductCountFunctions {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  data: any[];
  filterOptions: FilterOptions;
  isLoading?: boolean;
  onClearAllFilters?: () => void;
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
        className="w-full flex items-center justify-between py-4 px-4 transition-colors hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
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
          className={isOpen ? 'rotate-180' : ''}
        >
          <Icon.PiCaretDown size={18} className="text-gray-400" />
        </div>
      </button>
      {isOpen && (
          <div className="overflow-hidden">
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
        )}
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
  getCountByType,
  getCountByBrand,
  getCountByOriginCountry,
  getCountByCategoryType,
  getCountByFlavorCategory,
  isLoading = false,
  onClearAllFilters,
}) => {
  const [priceRange, setPriceRange] = useState([
    filters.priceRange?.min ?? filterOptions.priceRange?.min ?? 0,
    filters.priceRange?.max ?? filterOptions.priceRange?.max ?? 100000
  ]);
  const [brandSearch, setBrandSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const debouncedBrandSearch = useDebounce(brandSearch, 300);

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

  const handleTypeClick = (type: string) => {
    updateFilter('type', filters.type === type ? null : type);
  };

  const handleSizeClick = (size: string) => {
    updateFilter('size', filters.size === size ? null : size);
  };

  const handleBrandChange = (brand: string) => {
    updateFilter('brand', filters.brand === brand ? null : brand);
  };

  const handlePriceChange = (values: number | number[]) => {
    if (Array.isArray(values)) {
      setPriceRange(values);
    }
  };

  const handlePriceAfterChange = (values: number | number[]) => {
    if (Array.isArray(values)) {
      updateFilter('priceRange', { min: values[0], max: values[1] });
    }
  };

  const handlePricePresetClick = (preset: typeof PRICE_PRESETS[0]) => {
    setPriceRange([preset.min, preset.max]);
    updateFilter('priceRange', { min: preset.min, max: preset.max });
  };

  const handleOriginCountryClick = (country: string) => {
    updateFilter('originCountry', filters.originCountry === country ? null : country);
  };

  const handleCategoryTypeClick = (categoryType: string) => {
    updateFilter('categoryType', filters.categoryType === categoryType ? null : categoryType);
  };

  const handleSubCategoryTypeClick = (subCategoryType: string) => {
    updateFilter('subCategoryType', filters.subCategoryType === subCategoryType ? null : subCategoryType);
  };

  const handleFlavorCategoryClick = (flavorCategory: string) => {
    updateFilter('flavorCategory', filters.flavorCategory === flavorCategory ? null : flavorCategory);
  };

  const handleRatingClick = (rating: number) => {
    updateFilter('minRating', filters.minRating === rating ? null : rating);
  };

  const handleClearPrice = () => {
    const defaultRange = {
      min: filterOptions.priceRange?.min ?? 0,
      max: filterOptions.priceRange?.max ?? 100000
    };
    setPriceRange([defaultRange.min, defaultRange.max]);
    updateFilter('priceRange', defaultRange);
  };

  const handleClearAll = useCallback(() => {
    if (onClearAllFilters) {
      onClearAllFilters();
    } else {
      updateFilter('type', null);
      updateFilter('size', null);
      updateFilter('brand', null);
      updateFilter('originCountry', null);
      updateFilter('categoryType', null);
      updateFilter('subCategoryType', null);
      updateFilter('flavorCategory', null);
      updateFilter('minRating', null);
      updateFilter('showOnlySale', false);
      updateFilter('priceRange', filterOptions.priceRange);
    }
    setBrandSearch('');
  }, [onClearAllFilters, updateFilter, filterOptions.priceRange]);

  const filteredBrands = useMemo(() => {
    if (!debouncedBrandSearch) return filterOptions.brand;
    return filterOptions.brand.filter(b =>
      b.toLowerCase().includes(debouncedBrandSearch.toLowerCase())
    );
  }, [filterOptions.brand, debouncedBrandSearch]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.type) count++;
    if (filters.size) count++;
    if (filters.brand) count++;
    if (filters.originCountry) count++;
    if (filters.categoryType) count++;
    if (filters.subCategoryType) count++;
    if (filters.flavorCategory) count++;
    if (filters.minRating) count++;
    if ((filters.priceRange?.min ?? 0) !== (filterOptions.priceRange?.min ?? 0) || 
        (filters.priceRange?.max ?? 100000) !== (filterOptions.priceRange?.max ?? 100000)) count++;
    if (filters.showOnlySale) count++;
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
                  <h2 className="text-xl font-bold">Filters</h2>
                  {activeFiltersCount > 0 && (
                      <span
                        className="px-2.5 py-0.5 bg-gray-900 text-white text-sm font-medium rounded-full"
                      >
                        {activeFiltersCount}
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  {activeFiltersCount > 0 && (
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
                {/* Product Type */}
                {filterOptions.type.length > 0 && (
                  <FilterSection 
                    title="Product Type" 
                    icon={<Icon.PiTag size={20} />}
                    badge={filters.type ? 1 : undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.type.map((item) => {
                        const count = getCountByType(item);
                        const isSelected = filters.type === item;
                        
                        return (
                          <button
                            key={item}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            onClick={() => handleTypeClick(item)}
                          >
                            <span className="capitalize text-sm">{item.replace(/_/g, ' ')}</span>
                            <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* Category */}
                {filterOptions.categoryType.length > 0 && (
                  <FilterSection 
                    title="Category" 
                    icon={<Icon.PiGridFour size={20} />}
                    badge={filters.categoryType ? 1 : undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.categoryType.map((item) => {
                        const count = getCountByCategoryType(item);
                        const isSelected = filters.categoryType === item;
                        
                        return (
                          <button
                            key={item}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            onClick={() => handleCategoryTypeClick(item)}
                          >
                            <span className="capitalize text-sm">{item.replace(/_/g, ' ')}</span>
                            <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
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
                    badge={filters.brand ? 1 : undefined}
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
                          const isSelected = filters.brand === item;
                          
                          return (
                            <button
                              key={item}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-gray-900 text-white shadow-md'
                                  : 'hover:bg-gray-100 text-gray-700'
                              }`}
                              onClick={() => handleBrandChange(item)}
                            >
                              <span className="capitalize text-sm">{item}</span>
                              <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
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
                    badge={filters.originCountry ? 1 : undefined}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.originCountry.map((item) => {
                        const count = getCountByOriginCountry(item);
                        const isSelected = filters.originCountry === item;
                        
                        return (
                          <button
                            key={item}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            onClick={() => handleOriginCountryClick(item)}
                          >
                            <span className="capitalize text-sm">{item}</span>
                            <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* Size */}
                {filterOptions.size.length > 0 && (
                  <FilterSection 
                    title="Size" 
                    icon={<Icon.PiRuler size={20} />}
                    badge={filters.size ? 1 : undefined}
                    isLoading={isLoading}
                  >
                    <div className="flex flex-wrap gap-2">
                      {filterOptions.size.map((item) => {
                        const isSelected = filters.size === item;
                        
                        return (
                          <button
                            key={item}

className={`w-14 h-14 flex items-center justify-center rounded-lg border-2 text-sm font-medium transition-all ${
                              isSelected
                                ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                                : 'border-gray-200 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => handleSizeClick(item)}
                            aria-label={`Size ${item}`}
                          >
                            {item}
                          </button>
                        );
                      })}
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
                              updateFilter('priceRange', { min: newRange[0], max: newRange[1] });
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
                              updateFilter('priceRange', { min: newRange[0], max: newRange[1] });
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
                    badge={filters.flavorCategory ? 1 : undefined}
                    defaultOpen={false}
                    isLoading={isLoading}
                  >
                    <div className="space-y-1">
                      {filterOptions.flavorCategory.map((item) => {
                        const count = getCountByFlavorCategory(item);
                        const isSelected = filters.flavorCategory === item;
                        
                        return (
                          <button
                            key={item}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                            onClick={() => handleFlavorCategoryClick(item)}
                          >
                            <span className="capitalize text-sm">{item.replace(/_/g, ' ')}</span>
                            <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
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
                  badge={filters.minRating ? 1 : undefined}
                  defaultOpen={false}
                  isLoading={isLoading}
                >
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const isSelected = filters.minRating === rating;
                      
                      return (
                        <button
                          key={rating}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-gray-900 text-white shadow-md'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                          onClick={() => handleRatingClick(rating)}
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
                        checked={filters.showOnlySale}
                        onChange={(e) => updateFilter('showOnlySale', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div
                        className={`w-11 h-6 rounded-full peer cursor-pointer ${filters.showOnlySale ? 'bg-red-500' : 'bg-gray-200'}`}
                      >
                        <div
                          className={`absolute top-[2px] ${filters.showOnlySale ? 'left-[22px]' : 'left-[2px]'} bg-white rounded-full h-5 w-5 shadow-md transition-transform`}
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

              {/* Footer - Clear All */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleClearAll}
                  disabled={activeFiltersCount === 0}
                  className={`w-full py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    activeFiltersCount > 0
                      ? 'bg-gray-900 hover:bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Icon.PiTrash size={18} />
                  Clear All Filters
                  {activeFiltersCount > 0 && (
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </aside>
        )}
    </>
  );
};

export default FilterSidebar;
