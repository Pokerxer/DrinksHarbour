// @ts-nocheck
'use client';

import ToggleColumns from '@core/components/table-utils/toggle-columns';
import { type Table as ReactTableType } from '@tanstack/react-table';
import { PiMagnifyingGlassBold, PiFunnelBold } from 'react-icons/pi';
import { Flex, Input, Select } from 'rizzui';

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Archived', value: 'archived' },
];

const planOptions = [
  { label: 'All Plans', value: '' },
  { label: 'Free Trial', value: 'free_trial' },
  { label: 'Starter', value: 'starter' },
  { label: 'Pro', value: 'pro' },
  { label: 'Enterprise', value: 'enterprise' },
  { label: 'Custom', value: 'custom' },
];

const subscriptionStatusOptions = [
  { label: 'All Sub. Statuses', value: '' },
  { label: 'Trialing', value: 'trialing' },
  { label: 'Active', value: 'active' },
  { label: 'Past Due', value: 'past_due' },
  { label: 'Canceled', value: 'canceled' },
  { label: 'Incomplete', value: 'incomplete' },
  { label: 'Incomplete Expired', value: 'incomplete_expired' },
];

interface FiltersProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
  statusFilter: string;
  planFilter: string;
  subscriptionStatusFilter: string;
  onStatusChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onSubscriptionStatusChange: (value: string) => void;
}

export default function TenantFilters<TData extends Record<string, any>>({
  table,
  statusFilter,
  planFilter,
  subscriptionStatusFilter,
  onStatusChange,
  onPlanChange,
  onSubscriptionStatusChange,
}: FiltersProps<TData>) {
  return (
    <Flex align="center" justify="between" wrap="wrap" className="mb-4 gap-3">
      <Flex align="center" gap="3" wrap="wrap" className="flex-1">
        <Input
          type="search"
          placeholder="Search tenants..."
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
          options={planOptions}
          value={planOptions.find((o) => o.value === planFilter) ?? planOptions[0]}
          onChange={(opt) => onPlanChange((opt as any)?.value ?? '')}
          selectClassName="h-9 text-sm"
          className="w-40"
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Plan'}
        />
        <Select
          options={subscriptionStatusOptions}
          value={subscriptionStatusOptions.find((o) => o.value === subscriptionStatusFilter) ?? subscriptionStatusOptions[0]}
          onChange={(opt) => onSubscriptionStatusChange((opt as any)?.value ?? '')}
          selectClassName="h-9 text-sm"
          className="w-48"
          getOptionValue={(o) => o.value}
          displayValue={(o) => o?.label ?? 'Sub. Status'}
        />
      </Flex>
      <ToggleColumns table={table} />
    </Flex>
  );
}
