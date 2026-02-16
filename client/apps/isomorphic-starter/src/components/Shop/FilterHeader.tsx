'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { FilterState, SortOption } from '@/types/filter.types';

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
    if (filters.type) count++;
    if (filters.size) count++;
    if (filters.brand) count++;
    if (filters.originCountry) count++;
    if (filters.categoryType) count++;
    if (filters.flavorCategory) count++;
    if (filters.subCategoryType) count++;
    if (filters.minRating) count++;
    if (filters.showOnlySale) count++;
    if (filters.priceRange?.min !== 0 || filters.priceRange?.max !== 100000) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFiltersCount > 0;

  const getActiveFilterLabel = (key: string, value: any): string => {
    switch (key) {
      case 'type':
        return `Type: ${value}`;
      case 'categoryType':
        return `Category: ${value}`;
      case 'subCategoryType':
        return `Subcategory: ${value}`;
      case 'brand':
        return `Brand: ${value}`;
      case 'size':
        return `Size: ${value}`;
      case 'originCountry':
        return `Origin: ${value}`;
      case 'flavorCategory':
        return `Flavor: ${value}`;
      case 'minRating':
        return `${value}+ Stars`;
      case 'showOnlySale':
        return 'On Sale';
      case 'priceRange':
        if (!value || value.min == null || value.max == null) return 'Price Range';
        return `₦${value.min.toLocaleString()} - ₦${value.max.toLocaleString()}`;
      default:
        return `${key}: ${value}`;
    }
  };

  const activeFiltersList = React.useMemo(() => {
    const list: { key: keyof FilterState; value: any; label: string }[] = [];
    
    if (filters.type) list.push({ key: 'type', value: filters.type, label: getActiveFilterLabel('type', filters.type) });
    if (filters.categoryType) list.push({ key: 'categoryType', value: filters.categoryType, label: getActiveFilterLabel('categoryType', filters.categoryType) });
    if (filters.subCategoryType) list.push({ key: 'subCategoryType', value: filters.subCategoryType, label: getActiveFilterLabel('subCategoryType', filters.subCategoryType) });
    if (filters.brand) list.push({ key: 'brand', value: filters.brand, label: getActiveFilterLabel('brand', filters.brand) });
    if (filters.size) list.push({ key: 'size', value: filters.size, label: getActiveFilterLabel('size', filters.size) });
    if (filters.originCountry) list.push({ key: 'originCountry', value: filters.originCountry, label: getActiveFilterLabel('originCountry', filters.originCountry) });
    if (filters.flavorCategory) list.push({ key: 'flavorCategory', value: filters.flavorCategory, label: getActiveFilterLabel('flavorCategory', filters.flavorCategory) });
    if (filters.minRating) list.push({ key: 'minRating', value: filters.minRating, label: getActiveFilterLabel('minRating', filters.minRating) });
    if (filters.showOnlySale) list.push({ key: 'showOnlySale', value: true, label: getActiveFilterLabel('showOnlySale', true) });
    if (filters.priceRange?.min !== 0 || filters.priceRange?.max !== 100000) {
      list.push({ key: 'priceRange', value: filters.priceRange, label: getActiveFilterLabel('priceRange', filters.priceRange) });
    }
    
    return list;
  }, [filters]);

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
      updateFilter('priceRange', { min: 0, max: 100000 });
    }
  }, [onClearAllFilters, updateFilter]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenSidebar}
            onMouseEnter={() => setIsFilterTooltipVisible(true)}
            onMouseLeave={() => setIsFilterTooltipVisible(false)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors group relative"
            aria-label="Open filters sidebar"
          >
            <Icon.PiFadersHorizontal size={18} />
            <span className="font-medium">Filters</span>
            <AnimatePresence>
              {activeFiltersCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="px-2 py-0.5 bg-white text-gray-900 text-xs font-bold rounded-full"
                >
                  {activeFiltersCount}
                </motion.span>
              )}
            </AnimatePresence>
            
            {/* Tooltip */}
            <AnimatePresence>
              {isFilterTooltipVisible && hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 -top-12 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10"
                >
                  {activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Layout Toggles */}
          <div className="hidden md:flex items-center gap-2 border-l border-gray-200 pl-4">
            {LAYOUT_OPTIONS.map(({ value, label }) => (
              <motion.button
                key={value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onLayoutChange(value)}
                className={`p-2.5 rounded-lg border-2 transition-all ${
                  layoutCol === value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                aria-label={label}
                title={label}
              >
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: value }).map((_, i) => (
                    <motion.div
                      key={i}
                      layout
                      className={`w-1.5 rounded-sm transition-colors ${
                        layoutCol === value ? 'bg-gray-900' : 'bg-gray-300'
                      }`}
                      style={{ height: '16px' }}
                    />
                  ))}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Product Count */}
          {typeof totalProducts === 'number' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden sm:flex items-center gap-2 text-sm text-gray-500"
            >
              <Icon.PiPackage size={18} />
              <span>
                {isLoading ? (
                  <span className="inline-block w-12 h-4 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <>
                    <strong className="text-gray-900">{totalProducts.toLocaleString()}</strong>
                    {' '}{totalProducts === 1 ? 'product' : 'products'}
                  </>
                )}
              </span>
            </motion.div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Dropdown */}
          <div className="relative" ref={sortRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors bg-white"
              aria-label="Sort options"
              aria-expanded={isSortOpen}
            >
              <Icon.PiArrowsDownUpDuotone size={18} />
              <span className="font-medium hidden sm:inline">
                {sortOptions.find((o) => o.value === filters.sortOption)?.label || 'Sort by'}
              </span>
              <motion.div
                animate={{ rotate: isSortOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Icon.PiCaretDown size={16} />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {isSortOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-10"
                    onClick={() => setIsSortOpen(false)}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 overflow-hidden"
                  >
                    <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Sort by
                    </div>
                    {sortOptions.map((option) => (
                      <motion.button
                        key={option.value}
                        whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                        onClick={() => {
                          updateFilter('sortOption', option.value);
                          setIsSortOpen(false);
                        }}
                        disabled={option.disabled}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                          filters.sortOption === option.value
                            ? 'text-gray-900 font-medium bg-gray-50'
                            : 'text-gray-600 hover:bg-gray-50'
                        } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span>{option.label}</span>
                        {filters.sortOption === option.value && (
                          <Icon.PiCheck size={18} className="text-gray-900" />
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* On Sale Toggle */}
          <motion.label
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={filters.showOnlySale}
                onChange={(e) => updateFilter('showOnlySale', e.target.checked)}
                className="sr-only peer"
              />
              <motion.div
                className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-100 rounded-full peer cursor-pointer"
                animate={{
                  backgroundColor: filters.showOnlySale ? '#EF4444' : '#E5E7EB'
                }}
              >
                <motion.div
                  className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 shadow-sm"
                  animate={{
                    x: filters.showOnlySale ? 20 : 0
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.div>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors hidden sm:flex items-center gap-1.5">
              {filters.showOnlySale ? (
                <>
                  <Icon.PiTagFill className="text-red-500" size={14} />
                  On Sale
                </>
              ) : (
                'On Sale'
              )}
            </span>
          </motion.label>
        </div>
      </div>

      {/* Active Filters Bar */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">
                Active filters:
              </span>
              
              {activeFiltersList.map(({ key, value, label }, index) => (
                <motion.button
                  key={`${key}-${index}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateFilter(key, null)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    key === 'showOnlySale'
                      ? 'bg-red-100 hover:bg-red-200 text-red-700'
                      : key === 'minRating'
                      ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                      : key === 'priceRange'
                      ? 'bg-green-100 hover:bg-green-200 text-green-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {label}
                  <Icon.PiX size={12} />
                </motion.button>
              ))}
              
              {/* Clear All Button */}
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-xs font-medium transition-colors ml-2"
              >
                <Icon.PiTrash size={12} />
                Clear All
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterHeader;
