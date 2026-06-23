// @ts-nocheck
'use client';

import ToggleColumns from '@core/components/table-utils/toggle-columns';
import { type Table as ReactTableType } from '@tanstack/react-table';
import { PiMagnifyingGlassBold, PiFunnelBold } from 'react-icons/pi';
import { Flex, Input, Select } from 'rizzui';

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
];

const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Beer', value: 'beer' },
  { label: 'Wine', value: 'wine' },
  { label: 'Red Wine', value: 'red_wine' },
  { label: 'White Wine', value: 'white_wine' },
  { label: 'Sparkling Wine', value: 'sparkling_wine' },
  { label: 'Champagne', value: 'champagne' },
  { label: 'Whiskey', value: 'whiskey' },
  { label: 'Scotch', value: 'scotch' },
  { label: 'Bourbon', value: 'bourbon' },
  { label: 'Vodka', value: 'vodka' },
  { label: 'Gin', value: 'gin' },
  { label: 'Rum', value: 'rum' },
  { label: 'Tequila', value: 'tequila' },
  { label: 'Brandy', value: 'brandy' },
  { label: 'Cognac', value: 'cognac' },
  { label: 'Liqueur', value: 'liqueur' },
  { label: 'Cider', value: 'cider' },
  { label: 'Soft Drink', value: 'soft_drink' },
  { label: 'Juice', value: 'juice' },
  { label: 'Water', value: 'water' },
  { label: 'Coffee', value: 'coffee' },
  { label: 'Tea', value: 'tea' },
  { label: 'Other', value: 'other' },
];

interface TableToolbarProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
  statusFilter: string;
  typeFilter: string;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export default function Filters<TData extends Record<string, any>>({
  table,
  statusFilter,
  typeFilter,
  onStatusChange,
  onTypeChange,
}: TableToolbarProps<TData>) {
  return (
    <Flex align="center" justify="between" wrap="wrap" className="mb-4 gap-3">
      <Flex align="center" gap="3" wrap="wrap" className="flex-1">
        <Input
          type="search"
          placeholder="Search categories..."
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
          value={statusFilter}
          onChange={(opt) => onStatusChange((opt as any)?.value ?? '')}
          placeholder="Status"
          selectClassName="h-9 text-sm"
          className="w-40"
          prefix={<PiFunnelBold className="size-4 text-gray-400" />}
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Status'}
        />
        <Select
          options={typeOptions}
          value={typeFilter}
          onChange={(opt) => onTypeChange((opt as any)?.value ?? '')}
          placeholder="Type"
          selectClassName="h-9 text-sm"
          className="w-44"
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Type'}
        />
      </Flex>
      <ToggleColumns table={table} />
    </Flex>
  );
}
