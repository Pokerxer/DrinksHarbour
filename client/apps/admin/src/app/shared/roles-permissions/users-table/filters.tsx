'use client';

/**
 * Search + status controls for the People table. Purely presentational —
 * filtering happens in users-table/index.tsx. Stacks full-width on mobile;
 * the status select keeps a comfortable 44px touch target.
 */

import { Input, Select, type SelectOption } from 'rizzui';
import { PiMagnifyingGlassBold } from 'react-icons/pi';
import type { Table as ReactTable } from '@tanstack/react-table';

import type { PersonRow } from './index';

const STATUS_OPTIONS: SelectOption[] = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' },
];

interface Props {
  table: ReactTable<PersonRow>;
  search: string;
  onSearchChange: (next: string) => void;
  statusFilter: string;
  onStatusChange: (next: string) => void;
}

export default function UsersTableFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: Props) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <Input
        type="search"
        size="sm"
        clearable
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange('')}
        prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />}
        className="w-full sm:w-72"
        inputClassName="text-sm dark:bg-gray-900 dark:text-gray-100"
      />

      <Select
        size="sm"
        variant="flat"
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={(value: string) => onStatusChange(value)}
        getOptionValue={(option: SelectOption) => option.value}
        displayValue={(selected: string) =>
          STATUS_OPTIONS.find((o) => o.value === selected)?.label ??
          'All statuses'
        }
        dropdownClassName="!z-[1] h-auto"
        inPortal={false}
        selectClassName="text-sm h-[38px] dark:bg-gray-900 dark:text-gray-100"
        className="w-full sm:w-44"
      />
    </div>
  );
}
