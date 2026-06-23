// @ts-nocheck
'use client';

import ToggleColumns from '@core/components/table-utils/toggle-columns';
import { type Table as ReactTableType } from '@tanstack/react-table';
import { PiMagnifyingGlassBold, PiFunnelBold } from 'react-icons/pi';
import { Flex, Input, Select } from 'rizzui';

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Archived', value: 'archived' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' },
];

const brandTypeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Brewery', value: 'brewery' },
  { label: 'Microbrewery', value: 'microbrewery' },
  { label: 'Craft Brewery', value: 'craft_brewery' },
  { label: 'Brewpub', value: 'brewpub' },
  { label: 'Winery', value: 'winery' },
  { label: 'Vineyard', value: 'vineyard' },
  { label: 'Wine Estate', value: 'wine_estate' },
  { label: 'Distillery', value: 'distillery' },
  { label: 'Craft Distillery', value: 'craft_distillery' },
  { label: 'Spirits Producer', value: 'spirits_producer' },
  { label: 'Beverage Company', value: 'beverage_company' },
  { label: 'Drinks Manufacturer', value: 'drinks_manufacturer' },
  { label: 'Coffee Roaster', value: 'coffee_roaster' },
  { label: 'Tea Company', value: 'tea_company' },
  { label: 'Soft Drink Manufacturer', value: 'soft_drink_manufacturer' },
  { label: 'Water Brand', value: 'water_brand' },
  { label: 'Importer', value: 'importer' },
  { label: 'Distributor', value: 'distributor' },
  { label: 'Private Label', value: 'private_label' },
  { label: 'House Brand', value: 'house_brand' },
  { label: 'Luxury', value: 'luxury' },
  { label: 'Premium', value: 'premium' },
  { label: 'Mass Market', value: 'mass_market' },
  { label: 'Champagne House', value: 'champagne_house' },
  { label: 'Coffee Company', value: 'coffee_company' },
  { label: 'Juice Company', value: 'juice_company' },
  { label: 'Other', value: 'other' },
];

const primaryCategoryOptions = [
  { label: 'All Categories', value: '' },
  { label: 'Beer', value: 'beer' },
  { label: 'Wine', value: 'wine' },
  { label: 'Spirits', value: 'spirits' },
  { label: 'Liqueurs', value: 'liqueurs' },
  { label: 'Cocktails', value: 'cocktails' },
  { label: 'Champagne', value: 'champagne' },
  { label: 'Coffee', value: 'coffee' },
  { label: 'Tea', value: 'tea' },
  { label: 'Soft Drinks', value: 'soft_drinks' },
  { label: 'Water', value: 'water' },
  { label: 'Juice', value: 'juice' },
  { label: 'Energy Drinks', value: 'energy_drinks' },
  { label: 'Sports Drinks', value: 'sports_drinks' },
  { label: 'Mixers', value: 'mixers' },
  { label: 'Accessories', value: 'accessories' },
  { label: 'Multi-Category', value: 'multi_category' },
  { label: 'Other', value: 'other' },
];

interface FiltersProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
  statusFilter: string;
  brandTypeFilter: string;
  primaryCategoryFilter: string;
  onStatusChange: (value: string) => void;
  onBrandTypeChange: (value: string) => void;
  onPrimaryCategoryChange: (value: string) => void;
}

export default function BrandFilters<TData extends Record<string, any>>({
  table,
  statusFilter,
  brandTypeFilter,
  primaryCategoryFilter,
  onStatusChange,
  onBrandTypeChange,
  onPrimaryCategoryChange,
}: FiltersProps<TData>) {
  return (
    <Flex align="center" justify="between" wrap="wrap" className="mb-4 gap-3">
      <Flex align="center" gap="3" wrap="wrap" className="flex-1">
        <Input
          type="search"
          placeholder="Search brands..."
          value={table.getState().globalFilter ?? ''}
          onClear={() => table.setGlobalFilter('')}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          inputClassName="h-9"
          clearable
          prefix={<PiMagnifyingGlassBold className="size-4" />}
          className="w-64"
        />
        <Select
          options={statusOptions}
          value={statusOptions.find((o) => o.value === statusFilter) ?? statusOptions[0]}
          onChange={(opt) => onStatusChange((opt as any)?.value ?? '')}
          selectClassName="h-9 text-sm"
          className="w-40"
          prefix={<PiFunnelBold className="size-4 text-gray-400" />}
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Status'}
        />
        <Select
          options={brandTypeOptions}
          value={brandTypeOptions.find((o) => o.value === brandTypeFilter) ?? brandTypeOptions[0]}
          onChange={(opt) => onBrandTypeChange((opt as any)?.value ?? '')}
          selectClassName="h-9 text-sm"
          className="w-44"
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Brand Type'}
        />
        <Select
          options={primaryCategoryOptions}
          value={primaryCategoryOptions.find((o) => o.value === primaryCategoryFilter) ?? primaryCategoryOptions[0]}
          onChange={(opt) => onPrimaryCategoryChange((opt as any)?.value ?? '')}
          selectClassName="h-9 text-sm"
          className="w-44"
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Category'}
        />
      </Flex>
      <ToggleColumns table={table} />
    </Flex>
  );
}
