// @ts-nocheck
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Badge, Button, Flex, Input, Select, Switch, RangeSlider } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiFunnelBold,
  PiXBold,
  PiCaretDownBold,
  PiPackageBold,
  PiCurrencyDollarBold,
  PiChartLineUpBold,
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
  PiStarBold,
  PiTrendUpBold,
  PiPercentBold,
  PiShoppingCartBold,
  PiEyeBold,
  PiFireBold,
  PiSnowflakeBold,
  PiSunBold,
  PiLeafBold,
  PiCloudBold,
  PiGiftBold,
  PiHeartBold,
  PiStorefrontBold,
  PiDevicesBold,
  PiChartBarBold,
  PiWarningBold,
} from 'react-icons/pi';

export interface FilterConfig {
  // Status & Visibility
  status: string[];
  stockStatus: string[];
  visibility: string[];
  
  // Pricing
  priceRange: [number, number];
  marginRange: [number, number];
  onSale: boolean | null;
  hasDiscount: boolean | null;
  
  // Inventory
  stockRange: [number, number];
  hasVariants: boolean | null;
  needsReorder: boolean | null;
  
  // Beverage Specific
  beverageTypes: string[];
  isAlcoholic: boolean | null;
  abvRange: [number, number];
  volumeRange: [number, number];
  originCountries: string[];
  
  // Product Flags
  isFeatured: boolean | null;
  isBestSeller: boolean | null;
  isNewArrival: boolean | null;
  
  // Sales Channels
  visibleInPOS: boolean | null;
  visibleInOnlineStore: boolean | null;
  
  // Performance
  salesRange: [number, number];
  viewsRange: [number, number];
  conversionRange: [number, number];
  
  // Seasonality
  seasons: string[];
  occasions: string[];
  
  // Date filters
  dateRange: { from: string; to: string };
  lastSoldRange: { from: string; to: string };
  lastRestockRange: { from: string; to: string };
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
  { value: 'active', label: 'Active', color: 'success', icon: '✓' },
  { value: 'draft', label: 'Draft', color: 'neutral', icon: '📝' },
  { value: 'pending', label: 'Pending', color: 'warning', icon: '⏳' },
  { value: 'discontinued', label: 'Discontinued', color: 'secondary', icon: '🚫' },
  { value: 'archived', label: 'Archived', color: 'neutral', icon: '📦' },
  { value: 'hidden', label: 'Hidden', color: 'danger', icon: '👁' },
];

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock', color: 'success', icon: '✓' },
  { value: 'low_stock', label: 'Low Stock', color: 'warning', icon: '⚠️' },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'danger', icon: '✕' },
  { value: 'pre_order', label: 'Pre-Order', color: 'info', icon: '📅' },
];

const VISIBILITY_OPTIONS = [
  { value: 'published', label: 'Published', color: 'success', icon: '🌐' },
  { value: 'draft', label: 'Draft', color: 'neutral', icon: '📝' },
  { value: 'hidden', label: 'Hidden', color: 'secondary', icon: '🔒' },
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

const SEASONS = [
  { value: 'spring', label: 'Spring', icon: '🌸', color: 'success' },
  { value: 'summer', label: 'Summer', icon: '☀️', color: 'warning' },
  { value: 'fall', label: 'Fall', icon: '🍂', color: 'secondary' },
  { value: 'winter', label: 'Winter', icon: '❄️', color: 'info' },
];

const OCCASIONS = [
  { value: 'christmas', label: 'Christmas', icon: '🎄' },
  { value: 'new_year', label: 'New Year', icon: '🎉' },
  { value: 'valentines', label: 'Valentine\'s', icon: '❤️' },
  { value: 'easter', label: 'Easter', icon: '🐰' },
  { value: 'wedding', label: 'Wedding', icon: '💒' },
  { value: 'birthday', label: 'Birthday', icon: '🎂' },
  { value: 'anniversary', label: 'Anniversary', icon: '💑' },
  { value: 'black_friday', label: 'Black Friday', icon: '🏷️' },
  { value: 'mothers_day', label: 'Mother\'s Day', icon: '👩' },
  { value: 'fathers_day', label: 'Father\'s Day', icon: '👨' },
];

const PRICE_PRESETS = [
  { label: 'Under ₦5k', range: [0, 5000] },
  { label: '₦5k - ₦10k', range: [5000, 10000] },
  { label: '₦10k - ₦25k', range: [10000, 25000] },
  { label: '₦25k - ₦50k', range: [25000, 50000] },
  { label: '₦50k - ₦100k', range: [50000, 100000] },
  { label: 'Over ₦100k', range: [100000, 10000000] },
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

const MARGIN_PRESETS = [
  { label: 'Low (<15%)', range: [0, 15], color: 'danger' },
  { label: 'Medium (15-30%)', range: [15, 30], color: 'warning' },
  { label: 'Good (30-50%)', range: [30, 50], color: 'success' },
  { label: 'High (50%+)', range: [50, 100], color: 'primary' },
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
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors"
      >
        <Flex align="center" gap="2">
          <Icon className="w-4 h-4 text-gray-500" />
          <Text className="font-semibold text-sm text-gray-700">{title}</Text>
          {badge !== undefined && badge > 0 && (
            <Badge size="sm" color="primary" className="text-[10px]">{badge}</Badge>
          )}
        </Flex>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <PiCaretDownBold className="w-4 h-4 text-gray-400" />
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
  options: { value: string; label: string; color?: string; icon?: string; flag?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  columns?: number;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
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
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
              isSelected
                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            )}
          >
            {(option.icon || option.flag) && <span>{option.flag || option.icon}</span>}
            <span className="truncate">{option.label}</span>
            {isSelected && <PiCheckBold className="w-3 h-3 flex-shrink-0" />}
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
        const isSelected = currentRange[0] === preset.range[0] && currentRange[1] === preset.range[1];
        return (
          <motion.button
            key={preset.label}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(preset.range as [number, number])}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
              isSelected
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-200'
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
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <div>
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          {description && <Text className="text-xs text-gray-400">{description}</Text>}
        </div>
      </Flex>
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(checked === true ? null : true)}
          className={cn(
            'px-2 py-1 rounded-l-lg text-xs font-medium border transition-all',
            checked === true
              ? 'bg-green-500 text-white border-green-500'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          )}
        >
          Yes
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(checked === false ? null : false)}
          className={cn(
            'px-2 py-1 rounded-r-lg text-xs font-medium border-t border-b border-r transition-all',
            checked === false
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
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
      {presets && <RangePresets presets={presets} currentRange={[minValue, maxValue]} onSelect={onChange} />}
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
  const [activeTab, setActiveTab] = useState<'basic' | 'beverage' | 'performance' | 'dates'>('basic');
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const updateFilter = useCallback(<K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
    onFilterChange({ ...filters, [key]: value });
  }, [filters, onFilterChange]);
  
  // Tab navigation
  const tabs = [
    { id: 'basic', label: 'Basic', icon: PiTagBold },
    { id: 'beverage', label: 'Beverage', icon: PiWineBold },
    { id: 'performance', label: 'Performance', icon: PiChartBarBold },
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
          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border-2',
          isOpen || activeFilterCount > 0
            ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/25'
            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
        )}
      >
        <PiSlidersHorizontalBold className="w-5 h-5" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center justify-center w-5 h-5 bg-white text-blue-600 rounded-full text-xs font-bold"
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
            className="absolute top-full right-0 mt-2 w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
              <Flex align="center" gap="2">
                <PiFunnelBold className="w-5 h-5 text-blue-500" />
                <Text className="font-bold text-gray-800">Advanced Filters</Text>
                {activeFilterCount > 0 && (
                  <Badge color="primary" size="sm">{activeFilterCount} active</Badge>
                )}
              </Flex>
              <Flex align="center" gap="2">
                {activeFilterCount > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onReset}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <PiArrowCounterClockwiseBold className="w-3.5 h-3.5" />
                    Reset All
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <PiXBold className="w-4 h-4 text-gray-500" />
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
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all relative',
                    activeTab === tab.id
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
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
                  <FilterSection title="Product Status" icon={PiTagBold} defaultOpen badge={filters.status.length}>
                    <PillSelect
                      options={STATUS_OPTIONS}
                      selected={filters.status}
                      onChange={(values) => updateFilter('status', values)}
                      columns={3}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Stock Status" icon={PiPackageBold} defaultOpen badge={filters.stockStatus.length}>
                    <PillSelect
                      options={STOCK_STATUS_OPTIONS}
                      selected={filters.stockStatus}
                      onChange={(values) => updateFilter('stockStatus', values)}
                      columns={2}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Visibility" icon={PiEyeBold} badge={filters.visibility.length}>
                    <PillSelect
                      options={VISIBILITY_OPTIONS}
                      selected={filters.visibility}
                      onChange={(values) => updateFilter('visibility', values)}
                      columns={3}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Price Range" icon={PiCurrencyDollarBold}>
                    <RangeInputs
                      minValue={filters.priceRange[0]}
                      maxValue={filters.priceRange[1]}
                      onChange={(range) => updateFilter('priceRange', range)}
                      prefix="₦"
                      presets={PRICE_PRESETS}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Profit Margin" icon={PiPercentBold}>
                    <RangeInputs
                      minValue={filters.marginRange[0]}
                      maxValue={filters.marginRange[1]}
                      onChange={(range) => updateFilter('marginRange', range)}
                      suffix="%"
                      presets={MARGIN_PRESETS}
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
                  
                  <FilterSection title="Product Flags" icon={PiStarBold}>
                    <div className="space-y-1">
                      <ToggleRow
                        label="Featured"
                        description="Highlighted products"
                        icon={PiStarBold}
                        checked={filters.isFeatured}
                        onChange={(value) => updateFilter('isFeatured', value)}
                      />
                      <ToggleRow
                        label="Best Seller"
                        description="Top performing"
                        icon={PiTrendUpBold}
                        checked={filters.isBestSeller}
                        onChange={(value) => updateFilter('isBestSeller', value)}
                      />
                      <ToggleRow
                        label="New Arrival"
                        description="Recently added"
                        icon={PiGiftBold}
                        checked={filters.isNewArrival}
                        onChange={(value) => updateFilter('isNewArrival', value)}
                      />
                      <ToggleRow
                        label="Has Variants"
                        description="Multiple sizes"
                        icon={PiPackageBold}
                        checked={filters.hasVariants}
                        onChange={(value) => updateFilter('hasVariants', value)}
                      />
                      <ToggleRow
                        label="On Sale"
                        description="Has active discount"
                        icon={PiPercentBold}
                        checked={filters.onSale}
                        onChange={(value) => updateFilter('onSale', value)}
                      />
                      <ToggleRow
                        label="Needs Reorder"
                        description="Below reorder point"
                        icon={PiWarningBold}
                        checked={filters.needsReorder}
                        onChange={(value) => updateFilter('needsReorder', value)}
                      />
                    </div>
                  </FilterSection>
                  
                  <FilterSection title="Sales Channels" icon={PiStorefrontBold}>
                    <div className="space-y-1">
                      <ToggleRow
                        label="Visible in POS"
                        description="Point of sale"
                        icon={PiDevicesBold}
                        checked={filters.visibleInPOS}
                        onChange={(value) => updateFilter('visibleInPOS', value)}
                      />
                      <ToggleRow
                        label="Visible in Store"
                        description="Online store"
                        icon={PiStorefrontBold}
                        checked={filters.visibleInOnlineStore}
                        onChange={(value) => updateFilter('visibleInOnlineStore', value)}
                      />
                    </div>
                  </FilterSection>
                </>
              )}
              
              {/* BEVERAGE TAB */}
              {activeTab === 'beverage' && (
                <>
                  <FilterSection title="Beverage Type" icon={PiWineBold} defaultOpen badge={filters.beverageTypes.length}>
                    <PillSelect
                      options={BEVERAGE_TYPES}
                      selected={filters.beverageTypes}
                      onChange={(values) => updateFilter('beverageTypes', values)}
                      columns={3}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Alcohol Content" icon={PiThermometerBold}>
                    <div className="space-y-3">
                      <ToggleRow
                        label="Alcoholic"
                        description="Contains alcohol"
                        icon={PiBeerBottleBold}
                        checked={filters.isAlcoholic}
                        onChange={(value) => updateFilter('isAlcoholic', value)}
                      />
                      <Text className="text-xs font-medium text-gray-500 mt-2">ABV Range</Text>
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
                  
                  <FilterSection title="Origin Country" icon={PiGlobeBold} badge={filters.originCountries.length}>
                    <PillSelect
                      options={ORIGIN_COUNTRIES}
                      selected={filters.originCountries}
                      onChange={(values) => updateFilter('originCountries', values)}
                      columns={4}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Seasonality" icon={PiSunBold} badge={filters.seasons.length}>
                    <PillSelect
                      options={SEASONS}
                      selected={filters.seasons}
                      onChange={(values) => updateFilter('seasons', values)}
                      columns={4}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Special Occasions" icon={PiGiftBold} badge={filters.occasions.length}>
                    <PillSelect
                      options={OCCASIONS}
                      selected={filters.occasions}
                      onChange={(values) => updateFilter('occasions', values)}
                      columns={2}
                    />
                  </FilterSection>
                </>
              )}
              
              {/* PERFORMANCE TAB */}
              {activeTab === 'performance' && (
                <>
                  <FilterSection title="Total Sales" icon={PiShoppingCartBold} defaultOpen>
                    <RangeInputs
                      minValue={filters.salesRange[0]}
                      maxValue={filters.salesRange[1]}
                      onChange={(range) => updateFilter('salesRange', range)}
                      presets={[
                        { label: 'No sales', range: [0, 0] },
                        { label: '1-10', range: [1, 10] },
                        { label: '11-50', range: [11, 50] },
                        { label: '51-100', range: [51, 100] },
                        { label: '100+', range: [100, 1000000] },
                      ]}
                    />
                  </FilterSection>
                  
                  <FilterSection title="View Count" icon={PiEyeBold}>
                    <RangeInputs
                      minValue={filters.viewsRange[0]}
                      maxValue={filters.viewsRange[1]}
                      onChange={(range) => updateFilter('viewsRange', range)}
                      presets={[
                        { label: 'No views', range: [0, 0] },
                        { label: '1-100', range: [1, 100] },
                        { label: '101-500', range: [101, 500] },
                        { label: '501-1000', range: [501, 1000] },
                        { label: '1000+', range: [1000, 10000000] },
                      ]}
                    />
                  </FilterSection>
                  
                  <FilterSection title="Conversion Rate" icon={PiChartLineUpBold}>
                    <RangeInputs
                      minValue={filters.conversionRange[0]}
                      maxValue={filters.conversionRange[1]}
                      onChange={(range) => updateFilter('conversionRange', range)}
                      suffix="%"
                      presets={[
                        { label: '0%', range: [0, 0] },
                        { label: '0-5%', range: [0, 5] },
                        { label: '5-10%', range: [5, 10] },
                        { label: '10-20%', range: [10, 20] },
                        { label: '20%+', range: [20, 100] },
                      ]}
                    />
                  </FilterSection>
                </>
              )}
              
              {/* DATES TAB */}
              {activeTab === 'dates' && (
                <>
                  <FilterSection title="Date Added" icon={PiCalendarBold} defaultOpen>
                    <Flex gap="3">
                      <div className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">From</Text>
                        <Input
                          type="date"
                          value={filters.dateRange.from}
                          onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, from: e.target.value })}
                          inputClassName="h-9 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">To</Text>
                        <Input
                          type="date"
                          value={filters.dateRange.to}
                          onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, to: e.target.value })}
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
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:border-blue-200 transition-all"
                        >
                          {preset.label}
                        </motion.button>
                      ))}
                    </Flex>
                  </FilterSection>
                  
                  <FilterSection title="Last Sold" icon={PiShoppingCartBold}>
                    <Flex gap="3">
                      <div className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">From</Text>
                        <Input
                          type="date"
                          value={filters.lastSoldRange.from}
                          onChange={(e) => updateFilter('lastSoldRange', { ...filters.lastSoldRange, from: e.target.value })}
                          inputClassName="h-9 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">To</Text>
                        <Input
                          type="date"
                          value={filters.lastSoldRange.to}
                          onChange={(e) => updateFilter('lastSoldRange', { ...filters.lastSoldRange, to: e.target.value })}
                          inputClassName="h-9 text-sm"
                        />
                      </div>
                    </Flex>
                  </FilterSection>
                  
                  <FilterSection title="Last Restocked" icon={PiPackageBold}>
                    <Flex gap="3">
                      <div className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">From</Text>
                        <Input
                          type="date"
                          value={filters.lastRestockRange.from}
                          onChange={(e) => updateFilter('lastRestockRange', { ...filters.lastRestockRange, from: e.target.value })}
                          inputClassName="h-9 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">To</Text>
                        <Input
                          type="date"
                          value={filters.lastRestockRange.to}
                          onChange={(e) => updateFilter('lastRestockRange', { ...filters.lastRestockRange, to: e.target.value })}
                          inputClassName="h-9 text-sm"
                        />
                      </div>
                    </Flex>
                  </FilterSection>
                </>
              )}
            </div>
            
            {/* Footer Actions */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <Flex gap="2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onReset}>
                  Clear All
                </Button>
                <Button color="primary" size="sm" className="flex-1" onClick={() => setIsOpen(false)}>
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
