import React from 'react';
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
}

const ActiveFilters: React.FC<ActiveFiltersProps> = ({ 
  filters, 
  updateFilter, 
  onClearAll, 
  totalProducts 
}) => {
  // Helper function to format filter labels
  const formatLabel = (key: string, value: string): string => {
    const labelMap: Record<string, string> = {
      type: 'Type',
      size: 'Size',
      color: 'Color',
      brand: 'Brand',
      originCountry: 'Origin',
      categoryType: 'Category',
      flavorCategory: 'Flavor',
      minRating: 'Rating',
    };
    
    if (key === 'minRating') {
      return `${value}+ Stars`;
    }
    return value.replace(/_/g, ' ');
  };

  const activeFilters: FilterItem[] = [
    { key: 'type', value: filters.type || '', label: filters.type || '', displayLabel: 'Type' },
    { key: 'size', value: filters.size || '', label: filters.size || '', displayLabel: 'Size' },
    { key: 'color', value: filters.color || '', label: filters.color || '', displayLabel: 'Color' },
    { key: 'brand', value: filters.brand || '', label: filters.brand || '', displayLabel: 'Brand' },
    { key: 'originCountry', value: filters.originCountry || '', label: filters.originCountry || '', displayLabel: 'Origin' },
    { key: 'categoryType', value: filters.categoryType || '', label: filters.categoryType || '', displayLabel: 'Category' },
    { key: 'flavorCategory', value: filters.flavorCategory || '', label: filters.flavorCategory || '', displayLabel: 'Flavor' },
    { key: 'minRating', value: filters.minRating?.toString() || '', label: filters.minRating ? `${filters.minRating}+ Stars` : '', displayLabel: 'Rating' },
  ].filter((item): item is FilterItem => !!item.value);

  const hasActiveFilters = activeFilters.length > 0;
  const productText = totalProducts === 1 ? 'Product' : 'Products';

  return (
    <div className="list-filtered flex items-center gap-3 mt-4 flex-wrap">
      <div className="total-product font-medium">
        <span className="text-lg">{totalProducts}</span>
        <span className="text-secondary pl-1">{productText} Found</span>
      </div>
      {hasActiveFilters && (
        <>
          <div className="w-px h-4 bg-line hidden sm:block" />
          <div className="list flex items-center gap-3 flex-wrap">
            {activeFilters.map(({ key, value, label }) => (
              <div
                key={`${key}-${value}`}
                className="item flex items-center px-3 py-1.5 gap-2 bg-linear rounded-full capitalize cursor-pointer hover:bg-opacity-80 transition-all"
                onClick={() => updateFilter(key, null)}
                role="button"
                aria-label={`Remove ${label} filter`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    updateFilter(key, null);
                  }
                }}
              >
                <Icon.PiXBold className="cursor-pointer flex-shrink-0" size={14} />
                <span className="text-sm whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
          <div
            className="clear-btn flex items-center px-3 py-1.5 gap-2 rounded-full border border-red cursor-pointer hover:bg-red-500 hover:text-gray-50 transition-all"
            onClick={onClearAll}
            role="button"
            aria-label="Clear all filters"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClearAll();
              }
            }}
          >
            <Icon.PiXBold color="currentColor" className="flex-shrink-0" size={14} />
            <span className="text-button-uppercase whitespace-nowrap">Clear All</span>
          </div>
        </>
      )}
    </div>
  );
};

export default ActiveFilters;
