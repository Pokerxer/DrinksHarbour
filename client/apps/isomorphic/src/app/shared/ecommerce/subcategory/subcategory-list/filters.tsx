// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import ToggleColumns from '@core/components/table-utils/toggle-columns';
import { type Table as ReactTableType } from '@tanstack/react-table';
import { PiMagnifyingGlassBold, PiFunnelBold } from 'react-icons/pi';
import { Flex, Input, Select, type SelectOption } from 'rizzui';
import { getAdminCategories } from '@/services/category.service';

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Coming Soon', value: 'coming_soon' },
];

interface TableToolbarProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
  statusFilter: string;
  parentFilter: string;
  onStatusChange: (value: string) => void;
  onParentChange: (value: string) => void;
}

export default function Filters<TData extends Record<string, any>>({
  table,
  statusFilter,
  parentFilter,
  onStatusChange,
  onParentChange,
}: TableToolbarProps<TData>) {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;
  const [parentOptions, setParentOptions] = useState<{ label: string; value: string }[]>([
    { label: 'All Categories', value: '' },
  ]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        const opts = [{ label: 'All Categories', value: '' }];
        // Sort alphabetically
        [...categories]
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((c) => opts.push({ label: c.name, value: c._id }));
        setParentOptions(opts);
      })
      .catch(() => {});
  }, [token]);

  const selectedStatus = statusOptions.find((o) => o.value === statusFilter) ?? statusOptions[0];
  const selectedParent = parentOptions.find((o) => o.value === parentFilter) ?? parentOptions[0];

  return (
    <Flex align="center" justify="between" wrap="wrap" className="mb-4 gap-3">
      <Flex align="center" gap="3" wrap="wrap" className="flex-1">
        <Input
          type="search"
          placeholder="Search subcategories..."
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
          value={selectedStatus}
          onChange={(opt: SelectOption) => onStatusChange((opt as any).value)}
          selectClassName="h-9 text-sm"
          className="w-44"
          prefix={<PiFunnelBold className="size-4 text-gray-400" />}
        />
        <Select
          options={parentOptions}
          value={selectedParent}
          onChange={(opt: SelectOption) => onParentChange((opt as any).value)}
          selectClassName="h-9 text-sm"
          className="w-52"
        />
      </Flex>
      <ToggleColumns table={table} />
    </Flex>
  );
}
