import React, { useMemo, useCallback } from 'react';
import * as Icon from "react-icons/pi";
import { FilterState } from '@/types/filter.types';

interface ActiveFiltersProps {
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  onClearAll: () => void;
  totalProducts: number;
}

interface FilterItem {
  key: keyof FilterState;
  value: string;
  label: string;
  displayLabel: string;
  icon?: React.ReactNode;
  isSpecial?: boolean;
}

interface FilterConfig {
  key: keyof FilterState;
  arrayKey?: keyof FilterState;
  displayLabel: string;
  icon: React.ReactNode;
  formatValue?: (val: any) => string;
  formatLabel?: (val: any) => string;
  isSpecial?: boolean;
  defaultValue?: any;
}

const FILTER_CONFIGS: Record<string, Omit<FilterConfig, 'key'>> = {
  size: { displayLabel: 'Size', icon: <Icon.PiRuler size={12} /> },
  color: { displayLabel: 'Color', icon: <Icon.PiPalette size={12} /> },
  brand: { displayLabel: 'Brand', icon: <Icon.PiBuildingApartment size={12} /> },
  originCountry: { displayLabel: 'Origin', icon: <Icon.PiGlobe size={12} /> },
  categoryType: { 
    displayLabel: 'Category', 
    icon: <Icon.PiGridFour size={12} />,
    formatValue: (val: string) => val.replace(/-/g, ' ')
  },
  subCategoryType: { 
    displayLabel: 'Subcategory', 
    icon: <Icon.PiFolders size={12} />,
    formatValue: (val: string) => val.replace(/-/g, ' ')
  },
  flavorCategory: { 
    displayLabel: 'Flavor', 
    icon: <Icon.PiAirplaneTilt size={12} />,
    formatValue: (val: string) => val.replace(/-/g, ' ')
  },
  minRating: { 
    displayLabel: 'Rating', 
    icon: <Icon.PiStar size={12} />,
    formatLabel: (val: number) => `${val}+ Stars`
  },
  priceRange: { 
    displayLabel: 'Price Range', 
    icon: <Icon.PiCurrencyDollar size={12} />,
    isSpecial: true,
    defaultValue: { min: 0, max: 100000 }
  },
  abvRange: { 
    displayLabel: 'Alcohol', 
    icon: <Icon.PiWine size={12} />,
    isSpecial: true
  },
  volumeRange: { 
    displayLabel: 'Volume', 
    icon: <Icon.PiDrop size={12} />
  },
  showOnlySale: { 
    displayLabel: 'Sale', 
    icon: <Icon.PiTagSimple size={12} />,
    isSpecial: true
  }
};

const SPECIAL_FILTERS = ['priceRange', 'abvRange', 'volumeRange', 'showOnlySale', 'minRating'];

const ActiveFilters: React.FC<ActiveFiltersProps> = ({ 
  filters, 
  updateFilter, 
  onClearAll, 
  totalProducts 
}) => {
  const buildFilterItems = useCallback((): FilterItem[] => {
    const items: FilterItem[] = [];
    
    // Process simple/scalar filters
    const scalarFilters: (keyof FilterState)[] = ['size', 'color', 'minRating', 'showOnlySale'];
    
    scalarFilters.forEach(key => {
      const value = filters[key];
      if (value && value !== 0) {
        const config = FILTER_CONFIGS[key];
        if (config) {
          const label = config.formatLabel ? config.formatLabel(value) : 
                       config.formatValue ? config.formatValue(value) : 
                       String(value);
          items.push({
            key,
            value: String(value),
            label,
            displayLabel: config.displayLabel,
            icon: config.icon,
            isSpecial: config.isSpecial
          });
        }
      }
    });

    // Process array filters (brand, originCountry, categoryType, subCategoryType, flavorCategory)
    const arrayFilters: (keyof FilterState)[] = ['brand', 'originCountry', 'categoryType', 'subCategoryType', 'flavorCategory'];
    
    arrayFilters.forEach(key => {
      const value = filters[key];
      if (value) {
        const config = FILTER_CONFIGS[key];
        if (!config) return;
        
        const values = Array.isArray(value) ? value : [value];
        values.forEach(val => {
          if (val) {
            const label = config.formatValue ? config.formatValue(val) : String(val);
            items.push({
              key,
              value: String(val),
              label,
              displayLabel: config.displayLabel,
              icon: config.icon
            });
          }
        });
      }
    });

    // Process special filters
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      const defaultPrice = { min: 0, max: 100000 };
      if (min !== defaultPrice.min || max !== defaultPrice.max) {
        items.push({
          key: 'priceRange',
          value: `${min}-${max}`,
          label: `₦${min.toLocaleString()} - ₦${max.toLocaleString()}`,
          displayLabel: 'Price Range',
          icon: <Icon.PiCurrencyDollar size={12} />,
          isSpecial: true
        });
      }
    }

    if (filters.abvRange) {
      const { min, max } = filters.abvRange;
      if (max === 0) {
        items.push({
          key: 'abvRange',
          value: 'non-alcoholic',
          label: 'Non-Alcoholic',
          displayLabel: 'Alcohol',
          icon: <Icon.PiWine size={12} />,
          isSpecial: true
        });
      } else if (min !== 0 || max !== 100) {
        items.push({
          key: 'abvRange',
          value: `${min}-${max}`,
          label: `${min}% - ${max}% ABV`,
          displayLabel: 'Alcohol',
          icon: <Icon.PiWine size={12} />,
          isSpecial: true
        });
      }
    }

    if (filters.volumeRange) {
      items.push({
        key: 'volumeRange',
        value: filters.volumeRange,
        label: String(filters.volumeRange),
        displayLabel: 'Volume',
        icon: <Icon.PiDrop size={12} />,
        isSpecial: true
      });
    }

    return items;
  }, [filters]);

  const handleRemoveFilter = useCallback((item: FilterItem) => {
    if (item.isSpecial) {
      // Handle special filter types
      switch (item.key) {
        case 'priceRange':
          updateFilter('priceRange', { min: 0, max: 100000 });
          break;
        case 'abvRange':
        case 'volumeRange':
          updateFilter(item.key, null);
          break;
        case 'showOnlySale':
          updateFilter('showOnlySale', false);
          break;
        case 'minRating':
          updateFilter('minRating', null);
          break;
      }
    } else {
      // Handle array and simple filters
      const currentValue = filters[item.key];
      if (Array.isArray(currentValue)) {
        updateFilter(item.key, currentValue.filter(v => String(v) !== item.value));
      } else {
        updateFilter(item.key, null);
      }
    }
  }, [filters, updateFilter]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, item: FilterItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRemoveFilter(item);
    }
  }, [handleRemoveFilter]);

  const activeFilters = useMemo(() => buildFilterItems(), [buildFilterItems]);
  const hasActiveFilters = activeFilters.length > 0;
  const productText = totalProducts === 1 ? 'Product' : 'Products';

  if (!hasActiveFilters) {
    return (
      <div className="flex items-center gap-3 mt-4">
        <div className="total-product font-medium">
          <span className="text-lg">{totalProducts}</span>
          <span className="text-secondary pl-1">{productText} Found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-4 flex-wrap">
      <div className="total-product font-medium">
        <span className="text-lg">{totalProducts}</span>
        <span className="text-secondary pl-1">{productText} Found</span>
      </div>
      
      <div className="w-px h-4 bg-line hidden sm:block" />
      
      <div className="flex items-center gap-3 flex-wrap flex-1">
        {activeFilters.map((item) => (
          <button
            key={`${item.key}-${item.value}`}
            onClick={() => handleRemoveFilter(item)}
            onKeyDown={(e) => handleKeyDown(e, item)}
            className={`
              inline-flex items-center gap-2 px-3 py-1.5 
              rounded-full capitalize cursor-pointer 
              transition-all shadow-sm text-left
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
              ${item.key === 'showOnlySale' 
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200' 
                : item.key === 'minRating'
                ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
              }
            `}
            aria-label={`Remove ${item.label} filter`}
          >
            <div className="flex items-center gap-1.5">
              <span className="opacity-70">{item.icon}</span>
              <span className="text-xs font-medium opacity-80">{item.displayLabel}:</span>
              <span className="text-sm whitespace-nowrap">{item.label}</span>
            </div>
            <Icon.PiXBold className="flex-shrink-0 ml-1" size={12} />
          </button>
        ))}
        
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-300 cursor-pointer hover:bg-red-500 hover:text-white transition-all shadow-sm text-red-600 hover:border-red-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
          aria-label="Clear all filters"
        >
          <Icon.PiTrash size={12} />
          <span className="whitespace-nowrap">Clear All</span>
        </button>
      </div>
    </div>
  );
};

export default ActiveFilters;
