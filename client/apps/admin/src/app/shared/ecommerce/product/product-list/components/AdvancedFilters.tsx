// @ts-nocheck
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Badge, Button, Flex, Input } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiFunnelBold,
  PiXBold,
  PiCaretDownBold,
  PiPackageBold,
  PiTagBold,
  PiCalendarBold,
  PiArrowCounterClockwiseBold,
  PiCheckBold,
  PiSlidersHorizontalBold,
  PiWineBold,
  PiBeerBottleBold,
  PiThermometerBold,
  PiDropBold,
  PiGlobeBold,
  PiEyeBold,
} from 'react-icons/pi';

// FilterConfig trimmed to fields the central product catalog actually has.
export interface FilterConfig {
  // Status
  status: string[];
  stockStatus: string[];
  isPublished: boolean | null;

  // Inventory
  stockRange: [number, number];
  variantsRange: [number, number];
  hasVariants: boolean | null;

  // Beverage Specific
  beverageTypes: string[];
  isAlcoholic: boolean | null;
  abvRange: [number, number];
  volumeRange: [number, number];
  originCountries: string[];

  // Date filters
  dateRange: { from: string; to: string };
}

interface AdvancedFiltersProps {
  filters: FilterConfig;
  onFilterChange: (filters: FilterConfig) => void;
  onReset: () => void;
  activeFilterCount: number;
}

// ═══════════════════════════════════════════════════════════════
// FILTER OPTIONS
// ═══════════════════════════════════════════════════════════════

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Approved', color: 'success', icon: '✓' },
  { value: 'draft', label: 'Draft', color: 'neutral', icon: '📝' },
  { value: 'pending', label: 'Pending', color: 'warning', icon: '⏳' },
  {
    value: 'discontinued',
    label: 'Discontinued',
    color: 'secondary',
    icon: '🚫',
  },
  { value: 'archived', label: 'Archived', color: 'neutral', icon: '📦' },
  { value: 'rejected', label: 'Rejected', color: 'danger', icon: '✕' },
];

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock', color: 'success', icon: '✓' },
  { value: 'low_stock', label: 'Low Stock', color: 'warning', icon: '⚠️' },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'danger', icon: '✕' },
];

const BEVERAGE_TYPES = [
  { value: 'wine', label: 'Wine', icon: '🍷' },
  { value: 'red_wine', label: 'Red Wine', icon: '🍷' },
  { value: 'white_wine', label: 'White Wine', icon: '🥂' },
  { value: 'sparkling_wine', label: 'Sparkling', icon: '🍾' },
  { value: 'rose_wine', label: 'Rosé', icon: '🌸' },
  { value: 'champagne', label: 'Champagne', icon: '🥂' },
  { value: 'beer', label: 'Beer', icon: '🍺' },
  { value: 'craft_beer', label: 'Craft Beer', icon: '🍻' },
  { value: 'lager', label: 'Lager', icon: '🍺' },
  { value: 'ale', label: 'Ale', icon: '🍺' },
  { value: 'stout', label: 'Stout', icon: '🍺' },
  { value: 'whiskey', label: 'Whiskey', icon: '🥃' },
  { value: 'vodka', label: 'Vodka', icon: '🍸' },
  { value: 'gin', label: 'Gin', icon: '🍸' },
  { value: 'rum', label: 'Rum', icon: '🍹' },
  { value: 'tequila', label: 'Tequila', icon: '🌵' },
  { value: 'brandy', label: 'Brandy', icon: '🥃' },
  { value: 'cognac', label: 'Cognac', icon: '🥃' },
  { value: 'liqueur', label: 'Liqueur', icon: '🍸' },
  { value: 'cocktail', label: 'Cocktail', icon: '🍹' },
  { value: 'soft_drink', label: 'Soft Drink', icon: '🥤' },
  { value: 'juice', label: 'Juice', icon: '🧃' },
  { value: 'water', label: 'Water', icon: '💧' },
  { value: 'energy_drink', label: 'Energy Drink', icon: '⚡' },
  { value: 'mixer', label: 'Mixer', icon: '🍋' },
];

const ORIGIN_COUNTRIES = [
  { value: 'NG', label: 'Nigeria', flag: '🇳🇬' },
  { value: 'FR', label: 'France', flag: '🇫🇷' },
  { value: 'IT', label: 'Italy', flag: '🇮🇹' },
  { value: 'ES', label: 'Spain', flag: '🇪🇸' },
  { value: 'US', label: 'USA', flag: '🇺🇸' },
  { value: 'GB', label: 'UK', flag: '🇬🇧' },
  { value: 'DE', label: 'Germany', flag: '🇩🇪' },
  { value: 'ZA', label: 'South Africa', flag: '🇿🇦' },
  { value: 'AU', label: 'Australia', flag: '🇦🇺' },
  { value: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { value: 'CL', label: 'Chile', flag: '🇨🇱' },
  { value: 'PT', label: 'Portugal', flag: '🇵🇹' },
  { value: 'MX', label: 'Mexico', flag: '🇲🇽' },
  { value: 'JP', label: 'Japan', flag: '🇯🇵' },
  { value: 'IE', label: 'Ireland', flag: '🇮🇪' },
  { value: 'SC', label: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
];

const ABV_PRESETS = [
  { label: 'Non-Alcoholic', range: [0, 0.5] },
  { label: 'Low (0.5-5%)', range: [0.5, 5] },
  { label: 'Medium (5-15%)', range: [5, 15] },
  { label: 'Strong (15-40%)', range: [15, 40] },
  { label: 'Very Strong (40%+)', range: [40, 100] },
];

const VOLUME_PRESETS = [
  { label: 'Mini (<250ml)', range: [0, 250] },
  { label: 'Small (250-500ml)', range: [250, 500] },
  { label: 'Standard (500-750ml)', range: [500, 750] },
  { label: 'Large (750ml-1L)', range: [750, 1000] },
  { label: 'Magnum (1L+)', range: [1000, 10000] },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Filter Section Component
function FilterSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <Flex align="center" gap="2">
          <Icon className="h-4 w-4 text-gray-500" />
          <Text className="text-sm font-semibold text-gray-700">{title}</Text>
          {badge !== undefined && badge > 0 && (
            <Badge size="sm" color="primary" className="text-[10px]">
              {badge}
            </Badge>
          )}
        </Flex>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <PiCaretDownBold className="h-4 w-4 text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Pill Select Component for multi-select
function PillSelect({
  options,
  selected,
  onChange,
  columns = 3,
}: {
  options: {
    value: string;
    label: string;
    color?: string;
    icon?: string;
    flag?: string;
  }[];
  selected: string[];
  onChange: (values: string[]) => void;
  columns?: number;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className={cn('grid gap-2', `grid-cols-${columns}`)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <motion.button
            key={option.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => toggle(option.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
              isSelected
                ? 'border-[#b20202] bg-[#b20202] text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40 hover:bg-red-50'
            )}
          >
            {(option.icon || option.flag) && (
              <span>{option.flag || option.icon}</span>
            )}
            <span className="truncate">{option.label}</span>
            {isSelected && <PiCheckBold className="h-3 w-3 flex-shrink-0" />}
          </motion.button>
        );
      })}
    </div>
  );
}

// Range Preset Buttons
function RangePresets({
  presets,
  currentRange,
  onSelect,
}: {
  presets: { label: string; range: number[]; color?: string }[];
  currentRange: [number, number];
  onSelect: (range: [number, number]) => void;
}) {
  return (
    <Flex gap="2" wrap="wrap">
      {presets.map((preset) => {
        const isSelected =
          currentRange[0] === preset.range[0] &&
          currentRange[1] === preset.range[1];
        return (
          <motion.button
            key={preset.label}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(preset.range as [number, number])}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
              isSelected
                ? 'border-[#b20202]/40 bg-red-100 text-[#b20202]'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#b20202]/30'
            )}
          >
            {preset.label}
          </motion.button>
        );
      })}
    </Flex>
  );
}

// Toggle Switch Row
function ToggleRow({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  icon?: React.ElementType;
  checked: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <Flex align="center" justify="between" className="py-2">
      <Flex align="center" gap="2">
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
        <div>
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          {description && (
            <Text className="text-xs text-gray-400">{description}</Text>
          )}
        </div>
      </Flex>
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(checked === true ? null : true)}
          className={cn(
            'rounded-l-lg border px-2 py-1 text-xs font-medium transition-all',
            checked === true
              ? 'border-green-500 bg-green-500 text-white'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          )}
        >
          Yes
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(checked === false ? null : false)}
          className={cn(
            'rounded-r-lg border-b border-r border-t px-2 py-1 text-xs font-medium transition-all',
            checked === false
              ? 'border-red-500 bg-red-500 text-white'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          )}
        >
          No
        </motion.button>
      </div>
    </Flex>
  );
}

// Range Input Component
function RangeInputs({
  label,
  minValue,
  maxValue,
  onChange,
  prefix = '',
  suffix = '',
  presets,
}: {
  label?: string;
  minValue: number;
  maxValue: number;
  onChange: (range: [number, number]) => void;
  prefix?: string;
  suffix?: string;
  presets?: { label: string; range: number[] }[];
}) {
  return (
    <div className="space-y-3">
      <Flex gap="3" align="center">
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Min"
            value={minValue || ''}
            onChange={(e) => onChange([Number(e.target.value) || 0, maxValue])}
            inputClassName="h-9 text-sm"
            prefix={prefix || undefined}
            suffix={suffix || undefined}
          />
        </div>
        <Text className="text-gray-400">—</Text>
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Max"
            value={maxValue || ''}
            onChange={(e) => onChange([minValue, Number(e.target.value) || 0])}
            inputClassName="h-9 text-sm"
            prefix={prefix || undefined}
            suffix={suffix || undefined}
          />
        </div>
      </Flex>
      {presets && (
        <RangePresets
          presets={presets}
          currentRange={[minValue, maxValue]}
          onSelect={onChange}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdvancedFilters({
  filters,
  onFilterChange,
  onReset,
  activeFilterCount,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'beverage' | 'dates'>(
    'basic'
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updateFilter = useCallback(
    <K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
      onFilterChange({ ...filters, [key]: value });
    },
    [filters, onFilterChange]
  );

  // Tab navigation
  const tabs = [
    { id: 'basic', label: 'Basic', icon: PiTagBold },
    { id: 'beverage', label: 'Beverage', icon: PiWineBold },
    { id: 'dates', label: 'Dates', icon: PiCalendarBold },
  ];

  return (
    <div className="relative" ref={panelRef}>
      {/* Filter Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 font-medium transition-all',
          isOpen || activeFilterCount > 0
            ? 'border-[#b20202] bg-[#b20202] text-white shadow-lg shadow-[#b20202]/25'
            : 'border-gray-200 bg-white text-gray-700 hover:border-[#b20202]/30 hover:bg-red-50'
        )}
      >
        <PiSlidersHorizontalBold className="h-5 w-5" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#b20202]"
          >
            {activeFilterCount}
          </motion.span>
        )}
      </motion.button>

      {/* Filter Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(480px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-red-50 to-white px-4 py-3">
              <Flex align="center" gap="2">
                <PiFunnelBold className="h-5 w-5 text-[#b20202]" />
                <Text className="font-bold text-gray-800">
                  Advanced Filters
                </Text>
                {activeFilterCount > 0 && (
                  <Badge color="primary" size="sm">
                    {activeFilterCount} active
                  </Badge>
                )}
              </Flex>
              <Flex align="center" gap="2">
                {activeFilterCount > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onReset}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
                  >
                    <PiArrowCounterClockwiseBold className="h-3.5 w-3.5" />
                    Reset All
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 transition-colors hover:bg-gray-100"
                >
                  <PiXBold className="h-4 w-4 text-gray-500" />
                </motion.button>
              </Flex>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-100 bg-gray-50 px-2">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'text-[#b20202]'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeProductFilterTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#b20202]"
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Filter Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* BASIC TAB */}
              {activeTab === 'basic' && (
                <>
                  <FilterSection
                    title="Product Status"
                    icon={PiTagBold}
                    defaultOpen
                    badge={filters.status.length}
                  >
                    <PillSelect
                      options={STATUS_OPTIONS}
                      selected={filters.status}
                      onChange={(values) => updateFilter('status', values)}
                      columns={3}
                    />
                  </FilterSection>

                  <FilterSection
                    title="Stock Status"
                    icon={PiPackageBold}
                    defaultOpen
                    badge={filters.stockStatus.length}
                  >
                    <PillSelect
                      options={STOCK_STATUS_OPTIONS}
                      selected={filters.stockStatus}
                      onChange={(values) => updateFilter('stockStatus', values)}
                      columns={3}
                    />
                  </FilterSection>

                  <FilterSection title="Stock Quantity" icon={PiPackageBold}>
                    <RangeInputs
                      minValue={filters.stockRange[0]}
                      maxValue={filters.stockRange[1]}
                      onChange={(range) => updateFilter('stockRange', range)}
                      presets={[
                        { label: '0 (Out)', range: [0, 0] },
                        { label: '1-10', range: [1, 10] },
                        { label: '11-50', range: [11, 50] },
                        { label: '51-100', range: [51, 100] },
                        { label: '100+', range: [100, 100000] },
                      ]}
                    />
                  </FilterSection>

                  <FilterSection title="Variant Count" icon={PiPackageBold}>
                    <RangeInputs
                      minValue={filters.variantsRange[0]}
                      maxValue={filters.variantsRange[1]}
                      onChange={(range) => updateFilter('variantsRange', range)}
                      presets={[
                        { label: 'None', range: [0, 0] },
                        { label: '1-3', range: [1, 3] },
                        { label: '4-10', range: [4, 10] },
                        { label: '10+', range: [10, 1000] },
                      ]}
                    />
                  </FilterSection>

                  <FilterSection title="Product Flags" icon={PiEyeBold}>
                    <div className="space-y-1">
                      <ToggleRow
                        label="Published"
                        description="Visible on the platform"
                        icon={PiEyeBold}
                        checked={filters.isPublished}
                        onChange={(value) => updateFilter('isPublished', value)}
                      />
                      <ToggleRow
                        label="Has Variants"
                        description="Tenant sub-products exist"
                        icon={PiPackageBold}
                        checked={filters.hasVariants}
                        onChange={(value) => updateFilter('hasVariants', value)}
                      />
                    </div>
                  </FilterSection>
                </>
              )}

              {/* BEVERAGE TAB */}
              {activeTab === 'beverage' && (
                <>
                  <FilterSection
                    title="Beverage Type"
                    icon={PiWineBold}
                    defaultOpen
                    badge={filters.beverageTypes.length}
                  >
                    <PillSelect
                      options={BEVERAGE_TYPES}
                      selected={filters.beverageTypes}
                      onChange={(values) =>
                        updateFilter('beverageTypes', values)
                      }
                      columns={3}
                    />
                  </FilterSection>

                  <FilterSection
                    title="Alcohol Content"
                    icon={PiThermometerBold}
                  >
                    <div className="space-y-3">
                      <ToggleRow
                        label="Alcoholic"
                        description="Contains alcohol"
                        icon={PiBeerBottleBold}
                        checked={filters.isAlcoholic}
                        onChange={(value) => updateFilter('isAlcoholic', value)}
                      />
                      <Text className="mt-2 text-xs font-medium text-gray-500">
                        ABV Range
                      </Text>
                      <RangeInputs
                        minValue={filters.abvRange[0]}
                        maxValue={filters.abvRange[1]}
                        onChange={(range) => updateFilter('abvRange', range)}
                        suffix="%"
                        presets={ABV_PRESETS}
                      />
                    </div>
                  </FilterSection>

                  <FilterSection title="Volume / Size" icon={PiDropBold}>
                    <RangeInputs
                      minValue={filters.volumeRange[0]}
                      maxValue={filters.volumeRange[1]}
                      onChange={(range) => updateFilter('volumeRange', range)}
                      suffix="ml"
                      presets={VOLUME_PRESETS}
                    />
                  </FilterSection>

                  <FilterSection
                    title="Origin Country"
                    icon={PiGlobeBold}
                    badge={filters.originCountries.length}
                  >
                    <PillSelect
                      options={ORIGIN_COUNTRIES}
                      selected={filters.originCountries}
                      onChange={(values) =>
                        updateFilter('originCountries', values)
                      }
                      columns={4}
                    />
                  </FilterSection>
                </>
              )}

              {/* DATES TAB */}
              {activeTab === 'dates' && (
                <FilterSection
                  title="Date Added"
                  icon={PiCalendarBold}
                  defaultOpen
                >
                  <Flex gap="3">
                    <div className="flex-1">
                      <Text className="mb-1 text-xs text-gray-500">From</Text>
                      <Input
                        type="date"
                        value={filters.dateRange.from}
                        onChange={(e) =>
                          updateFilter('dateRange', {
                            ...filters.dateRange,
                            from: e.target.value,
                          })
                        }
                        inputClassName="h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Text className="mb-1 text-xs text-gray-500">To</Text>
                      <Input
                        type="date"
                        value={filters.dateRange.to}
                        onChange={(e) =>
                          updateFilter('dateRange', {
                            ...filters.dateRange,
                            to: e.target.value,
                          })
                        }
                        inputClassName="h-9 text-sm"
                      />
                    </div>
                  </Flex>
                  <Flex gap="2" className="mt-3" wrap="wrap">
                    {[
                      { label: 'Today', days: 0 },
                      { label: 'Last 7 days', days: 7 },
                      { label: 'Last 30 days', days: 30 },
                      { label: 'Last 90 days', days: 90 },
                      { label: 'This year', days: 365 },
                    ].map((preset) => (
                      <motion.button
                        key={preset.label}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const to = new Date();
                          const from = new Date();
                          from.setDate(from.getDate() - preset.days);
                          updateFilter('dateRange', {
                            from: from.toISOString().split('T')[0],
                            to: to.toISOString().split('T')[0],
                          });
                        }}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-all hover:border-[#b20202]/30"
                      >
                        {preset.label}
                      </motion.button>
                    ))}
                  </Flex>
                </FilterSection>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <Flex gap="2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onReset}
                >
                  Clear All
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                >
                  Apply Filters
                </Button>
              </Flex>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
