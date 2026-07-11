'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { FilterState, SortOption } from '@/types/filter.types';
import ActiveFilters from './ActiveFilters';

interface FilterHeaderProps {
  onOpenSidebar: () => void;
  layoutCol: number;
  onLayoutChange: (col: number) => void;
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  sortOptions: SortOption[];
  totalProducts?: number;
  isLoading?: boolean;
  onClearAllFilters?: () => void;
  searchQuery?: string | null;
  onClearSearch?: () => void;
  /** Catalog price bounds — a priceRange equal to these is "no price filter". */
  defaultPriceRange?: { min: number; max: number };
}

const LAYOUT_OPTIONS = [
  { value: 2, label: '2 columns' },
  { value: 3, label: '3 columns' },
  { value: 4, label: '4 columns' },
  { value: 5, label: '5 columns' },
] as const;

const FilterHeader: React.FC<FilterHeaderProps> = ({
  onOpenSidebar,
  layoutCol,
  onLayoutChange,
  filters,
  updateFilter,
  sortOptions,
  totalProducts,
  isLoading = false,
  onClearAllFilters,
  searchQuery,
  onClearSearch,
  defaultPriceRange,
}) => {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterTooltipVisible, setIsFilterTooltipVisible] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchQuery?.trim()) count++;
    if (filters.sortOption) count++;
    if (filters.size) count++;
    if (filters.color) count++;
    if (filters.brand)         count += Array.isArray(filters.brand)         ? filters.brand.length         : 1;
    if (filters.originCountry) count += Array.isArray(filters.originCountry) ? filters.originCountry.length : 1;
    if (filters.categoryType)  count += Array.isArray(filters.categoryType)  ? filters.categoryType.length  : 1;
    if (filters.subCategoryType) count += Array.isArray(filters.subCategoryType) ? filters.subCategoryType.length : 1;
    if (filters.flavorCategory) count += Array.isArray(filters.flavorCategory) ? filters.flavorCategory.length : 1;
    if (filters.minRating) count++;
    if (filters.showOnlySale) count++;
    const defMin = defaultPriceRange?.min ?? 0;
    const defMax = defaultPriceRange?.max ?? 100000;
    if (filters.priceRange && (filters.priceRange.min !== defMin || filters.priceRange.max !== defMax)) count++;
    if (filters.abvRange) count++;
    if (filters.volumeRange) count++;
    return count;
  }, [filters, searchQuery, defaultPriceRange]);

  const hasActiveFilters = activeFiltersCount > 0;

  const handleClearAll = useCallback(() => {
    if (onClearAllFilters) {
      onClearAllFilters();
    } else {
      updateFilter('size', null);
      updateFilter('color', null);
      updateFilter('brand', null);
      updateFilter('originCountry', null);
      updateFilter('categoryType', null);
      updateFilter('subCategoryType', null);
      updateFilter('flavorCategory', null);
      updateFilter('minRating', null);
      updateFilter('showOnlySale', false);
      updateFilter('priceRange', defaultPriceRange ?? { min: 0, max: 100000 });
      updateFilter('abvRange', null);
      updateFilter('volumeRange', null);
    }
  }, [onClearAllFilters, updateFilter, defaultPriceRange]);

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        {/* Left Section */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Filter Button */}
          <button
            onClick={onOpenSidebar}
            onMouseEnter={() => setIsFilterTooltipVisible(true)}
            onMouseLeave={() => setIsFilterTooltipVisible(false)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#b20202] hover:bg-[#8a0101] text-white rounded-lg transition-colors group relative text-sm sm:text-base"
            aria-label="Open filters sidebar"
          >
            <Icon.PiFadersHorizontal size={16} />
            <span className="font-medium">Filters</span>
            <AnimatePresence mode="wait">
              {activeFiltersCount > 0 && (
                <motion.span
                  key={activeFiltersCount}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="px-1.5 sm:px-2 py-0.5 bg-white text-[#b20202] text-xs font-bold rounded-full"
                >
                  {activeFiltersCount}
                </motion.span>
              )}
            </AnimatePresence>
            
            {/* Tooltip */}
            {isFilterTooltipVisible && hasActiveFilters && (
              <div className="absolute left-0 -top-12 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10">
                {activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}
              </div>
            )}
          </button>

          {/* Layout Toggles */}
          <div className="hidden md:flex items-center gap-2 border-l border-gray-200 pl-4">
            {LAYOUT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onLayoutChange(value)}
                className={`p-2.5 rounded-lg border-2 transition-all ${
                  layoutCol === value
                    ? 'border-[#b20202] bg-[#fdf3f3]'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                aria-label={label}
                title={label}
              >
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: value }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 rounded-sm transition-colors ${
                        layoutCol === value ? 'bg-[#b20202]' : 'bg-gray-300'
                      }`}
                      style={{ height: '16px' }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Product Count */}
          {typeof totalProducts === 'number' && (
            <div className="hidden xs:flex sm:flex items-center gap-2 text-xs sm:text-sm text-gray-500">
              <Icon.PiPackage size={16} />
              <span>
                {isLoading ? (
                  <span className="inline-block w-10 sm:w-12 h-3 sm:h-4 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <>
                    <strong className="text-gray-900">{totalProducts.toLocaleString()}</strong>
                    <span className="hidden sm:inline">{' '}{totalProducts === 1 ? 'product' : 'products'}</span>
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors bg-white"
              aria-label="Sort options"
              aria-expanded={isSortOpen}
            >
              <Icon.PiArrowsDownUpDuotone size={18} />
              <span className="font-medium hidden sm:inline">
                {sortOptions.find((o) => o.value === filters.sortOption)?.label || 'Sort by'}
              </span>
              <div className={isSortOpen ? 'rotate-180' : ''}>
                <Icon.PiCaretDown size={16} />
              </div>
            </button>

            {isSortOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsSortOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 overflow-hidden"
                  >
                    <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Sort by
                    </div>
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          updateFilter('sortOption', option.value);
                          setIsSortOpen(false);
                        }}
                        disabled={option.disabled}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                          filters.sortOption === option.value
                            ? 'text-[#b20202] font-semibold bg-[#fdf3f3]'
                            : 'text-gray-600 hover:bg-gray-50'
                        } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span>{option.label}</span>
                        {filters.sortOption === option.value && (
                          <Icon.PiCheck size={18} className="text-[#b20202]" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

          {/* On Sale Toggle */}
          <label
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={filters.showOnlySale}
                onChange={(e) => updateFilter('showOnlySale', e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 ${filters.showOnlySale ? 'bg-[#b20202]' : 'bg-gray-200'} peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#b20202]/15 rounded-full peer cursor-pointer transition-colors`}
              >
                <div
                  className={`absolute top-[2px] ${filters.showOnlySale ? 'left-[22px]' : 'left-[2px]'} bg-white border-gray-300 border rounded-full h-5 w-5 shadow-sm transition-transform`}
                />
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors hidden sm:flex items-center gap-1.5">
              {filters.showOnlySale ? (
                <>
                  <Icon.PiTagFill className="text-[#b20202]" size={14} />
                  On Sale
                </>
              ) : (
                'On Sale'
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Active Filters Bar */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 mt-4 pt-1">
              <ActiveFilters
                filters={filters}
                updateFilter={updateFilter}
                onClearAll={handleClearAll}
                totalProducts={totalProducts ?? 0}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onClearSearch={onClearSearch}
                defaultPriceRange={defaultPriceRange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterHeader;
