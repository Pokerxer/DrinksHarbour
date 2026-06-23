'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { FilterState } from '@/types/filter.types';

interface ActiveFiltersProps {
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  onClearAll: () => void;
  totalProducts: number;
  isLoading?: boolean;
  searchQuery?: string | null;
  onClearSearch?: () => void;
}

interface FilterChip {
  id: string;
  key: keyof FilterState | 'searchQuery' | 'sortOption';
  value: string;
  displayLabel: string;
  valueLabel: string;
  icon: React.ReactNode;
  color: 'default' | 'sale' | 'rating' | 'price' | 'alcohol' | 'sort' | 'search';
}

// Converts "single-malt", "single_malt", "single malt" → "Single Malt"
function titleCase(s: string) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const CONFIGS: Partial<Record<keyof FilterState, {
  label: string;
  icon: React.ReactNode;
  color?: FilterChip['color'];
  formatValue?: (v: any) => string;
}>> = {
  size:            { label: 'Size',       icon: <Icon.PiRuler size={12} /> },
  color:           { label: 'Color',      icon: <Icon.PiPalette size={12} /> },
  brand:           { label: 'Brand',      icon: <Icon.PiBuildingApartment size={12} /> },
  originCountry:   { label: 'Origin',     icon: <Icon.PiGlobe size={12} /> },
  categoryType:    { label: 'Category',   icon: <Icon.PiGridFour size={12} />,     formatValue: titleCase },
  subCategoryType: { label: 'Type',       icon: <Icon.PiFolders size={12} />,      formatValue: titleCase },
  flavorCategory:  { label: 'Flavour',    icon: <Icon.PiAirplaneTilt size={12} />, formatValue: titleCase },
  minRating:       { label: 'Rating',     icon: <Icon.PiStarFill size={12} />,     color: 'rating',  formatValue: (v: number) => `${v}+ Stars` },
  priceRange:      { label: 'Price',      icon: <Icon.PiCurrencyNgn size={12} />,  color: 'price' },
  abvRange:        { label: 'ABV',        icon: <Icon.PiWine size={12} />,         color: 'alcohol' },
  volumeRange:     { label: 'Volume',     icon: <Icon.PiDrop size={12} /> },
  showOnlySale:    { label: 'On Sale',    icon: <Icon.PiTagSimple size={12} />,    color: 'sale' },
  sortOption:      { label: 'Sort',       icon: <Icon.PiArrowsDownUp size={12} />, color: 'sort' },
};

const DEFAULT_PRICE = { min: 0, max: 100000 };

const SORT_LABELS: Record<string, string> = {
  newest:            'Newest Arrivals',
  priceLowToHigh:    'Price: Low → High',
  priceHighToLow:    'Price: High → Low',
  discountHighToLow: 'Biggest Discount',
  bestselling:       'Best Selling',
  popularity:        'Most Popular',
  rating:            'Highest Rated',
  alphabetical:      'A → Z',
  alphabeticalDesc:  'Z → A',
};

const CHIP_STYLES: Record<FilterChip['color'], {
  base: string; icon: string; x: string; ring: string;
}> = {
  default: {
    base: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:shadow-sm',
    icon: 'text-gray-400',
    x:    'text-gray-300 group-hover:text-gray-600',
    ring: 'focus-visible:ring-gray-400',
  },
  sale: {
    base: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-400 hover:shadow-sm',
    icon: 'text-red-400',
    x:    'text-red-200 group-hover:text-red-600',
    ring: 'focus-visible:ring-red-400',
  },
  rating: {
    base: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-400 hover:shadow-sm',
    icon: 'text-amber-400',
    x:    'text-amber-200 group-hover:text-amber-600',
    ring: 'focus-visible:ring-amber-400',
  },
  price: {
    base: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-sm',
    icon: 'text-emerald-400',
    x:    'text-emerald-200 group-hover:text-emerald-600',
    ring: 'focus-visible:ring-emerald-400',
  },
  alcohol: {
    base: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-400 hover:shadow-sm',
    icon: 'text-purple-400',
    x:    'text-purple-200 group-hover:text-purple-600',
    ring: 'focus-visible:ring-purple-400',
  },
  sort: {
    base: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-400 hover:shadow-sm',
    icon: 'text-blue-400',
    x:    'text-blue-200 group-hover:text-blue-600',
    ring: 'focus-visible:ring-blue-400',
  },
  search: {
    base: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 hover:shadow-sm',
    icon: 'text-indigo-400',
    x:    'text-indigo-200 group-hover:text-indigo-600',
    ring: 'focus-visible:ring-indigo-400',
  },
};

const chipVariants = {
  hidden:  { opacity: 0, scale: 0.75, y: -4 },
  visible: { opacity: 1, scale: 1,    y:  0, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  exit:    { opacity: 0, scale: 0.75, y: -4, transition: { duration: 0.15 } },
};

const MAX_CHIPS_COLLAPSED = 8;

const ActiveFilters: React.FC<ActiveFiltersProps> = ({
  filters,
  updateFilter,
  onClearAll,
  totalProducts,
  isLoading = false,
  searchQuery,
  onClearSearch,
}) => {
  const [expanded, setExpanded] = useState(false);

  const chips = useMemo(() => {
    const result: FilterChip[] = [];

    const addChip = (
      key: FilterChip['key'],
      value: string,
      valueLabel: string,
      overrideColor?: FilterChip['color'],
    ) => {
      const cfg = key === 'searchQuery' || key === 'sortOption'
        ? null
        : CONFIGS[key as keyof FilterState];

      const label = key === 'searchQuery' ? 'Search'
                  : key === 'sortOption'  ? 'Sort'
                  : cfg?.label ?? String(key);
      const icon  = key === 'searchQuery' ? <Icon.PiMagnifyingGlass size={12} />
                  : key === 'sortOption'  ? <Icon.PiArrowsDownUp size={12} />
                  : cfg?.icon ?? null;
      const color = overrideColor
                  ?? (key === 'searchQuery' ? 'search'
                      : key === 'sortOption' ? 'sort'
                      : cfg?.color ?? 'default');

      result.push({ id: `${key}-${value}`, key, value, displayLabel: label, valueLabel, icon, color });
    };

    // ── Search query ───────────────────────────────────────────────────────
    if (searchQuery?.trim()) {
      addChip('searchQuery', searchQuery, `"${searchQuery}"`);
    }

    // ── Sort ───────────────────────────────────────────────────────────────
    if (filters.sortOption) {
      addChip('sortOption', filters.sortOption, SORT_LABELS[filters.sortOption] ?? titleCase(filters.sortOption));
    }

    // ── On Sale ────────────────────────────────────────────────────────────
    if (filters.showOnlySale) {
      addChip('showOnlySale', 'true', 'On Sale', 'sale');
    }

    // ── Rating ─────────────────────────────────────────────────────────────
    if (filters.minRating) {
      addChip('minRating', String(filters.minRating), `${filters.minRating}+ Stars`, 'rating');
    }

    // ── Array filters ──────────────────────────────────────────────────────
    const arrayKeys: (keyof FilterState)[] = [
      'categoryType', 'subCategoryType', 'brand', 'originCountry', 'flavorCategory',
    ];
    arrayKeys.forEach(key => {
      const raw = filters[key];
      if (!raw) return;
      const values = Array.isArray(raw) ? raw : [raw];
      values.forEach(v => {
        if (!v) return;
        const str = String(v);
        const fmt = CONFIGS[key]?.formatValue ? CONFIGS[key]!.formatValue!(str) : titleCase(str);
        addChip(key, str, fmt);
      });
    });

    // ── Scalar filters ─────────────────────────────────────────────────────
    if (filters.size)        addChip('size',        filters.size,        titleCase(filters.size));
    if (filters.color)       addChip('color',       filters.color,       titleCase(filters.color));
    if (filters.volumeRange) addChip('volumeRange', filters.volumeRange, filters.volumeRange);

    // ── Price range ────────────────────────────────────────────────────────
    const pr = filters.priceRange;
    if (pr && (pr.min !== DEFAULT_PRICE.min || pr.max !== DEFAULT_PRICE.max)) {
      addChip('priceRange', `${pr.min}-${pr.max}`, `₦${pr.min.toLocaleString()} – ₦${pr.max.toLocaleString()}`, 'price');
    }

    // ── ABV range ──────────────────────────────────────────────────────────
    if (filters.abvRange) {
      const { min, max } = filters.abvRange;
      const label = max === 0 ? 'Non-Alcoholic' : `${min}% – ${max}% ABV`;
      addChip('abvRange', `${min}-${max}`, label, 'alcohol');
    }

    return result;
  }, [filters, searchQuery]);

  const removeChip = useCallback((chip: FilterChip) => {
    switch (chip.key) {
      case 'searchQuery':
        onClearSearch?.();
        break;
      case 'sortOption':
        updateFilter('sortOption', '');
        break;
      case 'showOnlySale':
        updateFilter('showOnlySale', false);
        break;
      case 'minRating':
        updateFilter('minRating', null);
        break;
      case 'priceRange':
        updateFilter('priceRange', DEFAULT_PRICE);
        break;
      case 'abvRange':
      case 'volumeRange':
      case 'size':
      case 'color':
        updateFilter(chip.key, null);
        break;
      default: {
        const current = filters[chip.key as keyof FilterState];
        if (Array.isArray(current)) {
          const next = current.filter(v => String(v) !== chip.value);
          updateFilter(chip.key as keyof FilterState, next.length ? next : null);
        } else {
          updateFilter(chip.key as keyof FilterState, null);
        }
      }
    }
  }, [filters, updateFilter, onClearSearch]);

  if (chips.length === 0) return null;

  const overflow     = !expanded && chips.length > MAX_CHIPS_COLLAPSED;
  const visibleChips = overflow ? chips.slice(0, MAX_CHIPS_COLLAPSED) : chips;
  const hiddenCount  = chips.length - MAX_CHIPS_COLLAPSED;

  return (
    <div className="space-y-2.5 pt-3">

      {/* ── Chips row ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleChips.map(chip => {
            const styles = CHIP_STYLES[chip.color];
            return (
              <motion.button
                key={chip.id}
                variants={chipVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                onClick={() => removeChip(chip)}
                className={`
                  group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5
                  rounded-full border text-xs font-medium cursor-pointer
                  transition-colors duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${styles.ring}
                  ${styles.base}
                `}
                aria-label={`Remove ${chip.displayLabel}: ${chip.valueLabel}`}
                title={`Remove filter: ${chip.displayLabel} — ${chip.valueLabel}`}
              >
                {/* category icon */}
                <span className={`shrink-0 ${styles.icon}`}>
                  {chip.icon}
                </span>

                {/* label */}
                <span className="shrink-0 opacity-55 font-normal tracking-wide">
                  {chip.displayLabel}:
                </span>

                {/* value */}
                <span className="max-w-[150px] truncate font-semibold">
                  {chip.valueLabel}
                </span>

                {/* × button */}
                <span className={`
                  shrink-0 ml-0.5 w-4 h-4 flex items-center justify-center
                  rounded-full transition-all duration-150
                  ${styles.x}
                  group-hover:bg-black/10
                `}>
                  <Icon.PiXBold size={8} />
                </span>
              </motion.button>
            );
          })}

          {/* Overflow expand button */}
          {overflow && (
            <motion.button
              key="show-more"
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-150"
              aria-label={`Show ${hiddenCount} more filters`}
            >
              <Icon.PiPlus size={10} />
              {hiddenCount} more
            </motion.button>
          )}

          {/* Collapse button */}
          {expanded && chips.length > MAX_CHIPS_COLLAPSED && (
            <motion.button
              key="show-less"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-xs font-medium text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all duration-150"
            >
              <Icon.PiCaretUp size={10} />
              Show less
            </motion.button>
          )}
        </AnimatePresence>

        {/* Clear all — always at the end, outside AnimatePresence so it doesn't flicker */}
        {chips.length > 1 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-xs font-medium text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all duration-150 active:scale-95 ml-0.5"
            aria-label={`Clear all ${chips.length} filters`}
          >
            <Icon.PiTrash size={11} />
            <span>Clear all</span>
            <span className="font-bold opacity-70">({chips.length})</span>
          </button>
        )}
      </div>

      {/* ── Summary line ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {isLoading ? (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block" />
            Updating results…
          </span>
        ) : (
          <>
            <Icon.PiCheckCircle size={13} className="text-gray-300 shrink-0" />
            <span>
              <strong className="text-gray-600 font-semibold">{totalProducts.toLocaleString()}</strong>
              {' '}{totalProducts === 1 ? 'product' : 'products'} found with{' '}
              <strong className="text-gray-600 font-semibold">{chips.length}</strong>
              {' '}{chips.length === 1 ? 'filter' : 'filters'} active
            </span>
          </>
        )}
      </div>

    </div>
  );
};

export default ActiveFilters;
