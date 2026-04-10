import React, { useMemo, useCallback } from 'react';
import * as Icon from 'react-icons/pi';
import { FilterState } from '@/types/filter.types';

interface ActiveFiltersProps {
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  onClearAll: () => void;
  totalProducts: number;
  isLoading?: boolean;
}

interface FilterChip {
  key: keyof FilterState;
  value: string;
  label: string;
  displayLabel: string;
  icon: React.ReactNode;
  color: 'default' | 'sale' | 'rating' | 'price' | 'alcohol';
}

const CONFIGS: Partial<Record<keyof FilterState, {
  label: string;
  icon: React.ReactNode;
  color?: FilterChip['color'];
  formatValue?: (v: any) => string;
}>> = {
  size:            { label: 'Size',        icon: <Icon.PiRuler size={11} /> },
  color:           { label: 'Color',       icon: <Icon.PiPalette size={11} /> },
  brand:           { label: 'Brand',       icon: <Icon.PiBuildingApartment size={11} /> },
  originCountry:    { label: 'Origin',      icon: <Icon.PiGlobe size={11} /> },
  categoryType:    { label: 'Category',    icon: <Icon.PiGridFour size={11} />,    formatValue: (v: string) => v.replace(/-/g, ' ') },
  subCategoryType: { label: 'Subcategory', icon: <Icon.PiFolders size={11} />,     formatValue: (v: string) => v.replace(/-/g, ' ') },
  flavorCategory:  { label: 'Flavor',      icon: <Icon.PiAirplaneTilt size={11} />, formatValue: (v: string) => v.replace(/-/g, ' ') },
  minRating:       { label: 'Rating',      icon: <Icon.PiStar size={11} />,        color: 'rating', formatValue: (v: number) => `${v}+ Stars` },
  priceRange:      { label: 'Price',       icon: <Icon.PiCurrencyNgn size={11} />, color: 'price' },
  abvRange:        { label: 'Alcohol',     icon: <Icon.PiWine size={11} />,        color: 'alcohol' },
  volumeRange:     { label: 'Volume',      icon: <Icon.PiDrop size={11} /> },
  showOnlySale:    { label: 'On Sale',   icon: <Icon.PiTagSimple size={11} />,   color: 'sale' },
};

const DEFAULT_PRICE = { min: 0, max: 100000 };

const CHIP_STYLES: Record<FilterChip['color'], string> = {
  default: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 hover:border-gray-300',
  sale:    'bg-red-50  hover:bg-red-100  text-red-700  border-red-200  hover:border-red-300',
  rating:  'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-300',
  price:   'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300',
  alcohol: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 hover:border-purple-300',
};

const ActiveFilters: React.FC<ActiveFiltersProps> = ({
  filters,
  updateFilter,
  onClearAll,
  totalProducts,
  isLoading = false,
}) => {
  const chips = useMemo(() => {
    const result: FilterChip[] = [];

    const addChip = (key: keyof FilterState, value: any, label: string) => {
      const cfg = CONFIGS[key];
      if (!cfg) return;
      result.push({
        key,
        value: String(value),
        label,
        displayLabel: cfg.label,
        icon: cfg.icon,
        color: cfg.color ?? 'default',
      });
    };

    // Scalar filters
    if (filters.size) {
      addChip('size', filters.size, filters.size);
    }
    if (filters.color) {
      addChip('color', filters.color, filters.color);
    }
    if (filters.minRating) {
      addChip('minRating', String(filters.minRating), `${filters.minRating}+ Stars`);
    }

    // Boolean filter
    if (filters.showOnlySale) {
      addChip('showOnlySale', 'true', 'On Sale');
    }

    // Array filters
    const arrayFilters: (keyof FilterState)[] = ['brand', 'originCountry', 'categoryType', 'subCategoryType', 'flavorCategory'];
    arrayFilters.forEach(key => {
      const value = filters[key];
      if (!value) return;
      const values = Array.isArray(value) ? value : [value];
      values.forEach(v => {
        if (!v) return;
        const cfg = CONFIGS[key];
        const strVal = String(v);
        const label = cfg?.formatValue ? cfg.formatValue(strVal) : strVal;
        addChip(key, strVal, label);
      });
    });

    // Price range
    if (filters.priceRange && filters.priceRange.min != null && filters.priceRange.max != null) {
      if (filters.priceRange.min !== DEFAULT_PRICE.min || filters.priceRange.max !== DEFAULT_PRICE.max) {
        addChip('priceRange', `${filters.priceRange.min}-${filters.priceRange.max}`, 
          `₦${filters.priceRange.min.toLocaleString()} – ₦${filters.priceRange.max.toLocaleString()}`);
      }
    }

    // ABV range
    if (filters.abvRange) {
      const { min, max } = filters.abvRange;
      const label = max === 0 ? 'Non-Alcoholic' : `${min}% – ${max}% ABV`;
      addChip('abvRange', `${min}-${max}`, label);
    }

    // Volume range
    if (filters.volumeRange) {
      addChip('volumeRange', filters.volumeRange, filters.volumeRange);
    }

    return result;
  }, [filters]);

  const hasFilters = chips.length > 0;
  const productWord = totalProducts === 1 ? 'Product' : 'Products';

  const removeChip = useCallback((chip: FilterChip) => {
    switch (chip.key) {
      case 'priceRange':
        updateFilter('priceRange', DEFAULT_PRICE);
        break;
      case 'abvRange':
      case 'volumeRange':
        updateFilter(chip.key, null);
        break;
      case 'showOnlySale':
        updateFilter('showOnlySale', false);
        break;
      case 'minRating':
        updateFilter('minRating', null);
        break;
      default: {
        const current = filters[chip.key];
        if (Array.isArray(current)) {
          const next = current.filter(v => String(v) !== chip.value);
          updateFilter(chip.key, next.length ? next : null);
        } else {
          updateFilter(chip.key, null);
        }
      }
    }
  }, [filters, updateFilter]);

  const resultBar = (
    <div className="flex items-center gap-2 shrink-0">
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Filtering...</span>
        </div>
      ) : totalProducts === 0 ? (
        <span className="text-sm font-medium text-gray-400">No results</span>
      ) : (
        <>
          <span className="text-base font-bold text-gray-900">{totalProducts.toLocaleString()}</span>
          <span className="text-sm text-gray-500">{productWord}</span>
        </>
      )}
    </div>
  );

  if (!hasFilters) {
    return (
      <div className="flex items-center justify-between gap-3 mt-4 min-h-[2.25rem]">
        {resultBar}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        {resultBar}
        
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          aria-label="Clear all filters"
        >
          <Icon.PiTrash size={13} />
          <span className="hidden sm:inline">Clear all</span>
          <span className="sm:hidden">Clear</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {chips.map(chip => (
          <button
            key={`${chip.key}-${chip.value}`}
            onClick={() => removeChip(chip)}
            className={`
              group inline-flex items-center gap-1.5 px-2.5 py-1.5 shrink-0
              rounded-full border text-xs font-medium cursor-pointer select-none
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400
              active:scale-95
              ${CHIP_STYLES[chip.color]}
              hover:shadow-sm
            `}
            aria-label={`Remove ${chip.displayLabel}: ${chip.label} filter`}
          >
            <span className="opacity-60 shrink-0 group-hover:opacity-80 transition-opacity">
              {chip.icon}
            </span>
            <span className="opacity-70 shrink-0 hidden xs:inline">{chip.displayLabel}:</span>
            <span className="truncate max-w-[120px] sm:max-w-[150px] capitalize">
              {chip.label}
            </span>
            <Icon.PiXBold 
              size={10} 
              className="ml-0.5 shrink-0 opacity-50 group-hover:opacity-80 transition-opacity" 
            />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{chips.length} filter{chips.length !== 1 ? 's' : ''} active</span>
      </div>
    </div>
  );
};

export default ActiveFilters;
