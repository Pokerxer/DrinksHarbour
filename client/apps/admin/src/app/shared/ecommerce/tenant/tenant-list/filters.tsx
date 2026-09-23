'use client';

import ToggleColumns from '@core/components/table-utils/toggle-columns';
import type { Table } from '@tanstack/react-table';
import { PiMagnifyingGlassBold } from 'react-icons/pi';
import { Input } from 'rizzui';
import type { AdminTenant } from '@/services/tenant.service';
import { PLAN_OPTIONS, STATUS_OPTIONS, SUBSCRIPTION_STATUS_OPTIONS } from '../form-options';

type FiltersProps = {
  table: Table<AdminTenant>;
  statusFilter: string;
  planFilter: string;
  subscriptionStatusFilter: string;
  onStatusChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onSubscriptionStatusChange: (value: string) => void;
};

export default function TenantFilters(props: FiltersProps) {
  const { table } = props;
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-end gap-3">
      <Input
        aria-label="Search tenants"
        type="search"
        placeholder="Search tenants..."
        value={table.getState().globalFilter ?? ''}
        onClear={() => table.setGlobalFilter('')}
        onChange={(event) => { table.setGlobalFilter(event.target.value); table.resetPageIndex(); }}
        clearable
        prefix={<PiMagnifyingGlassBold className="size-4" />}
        className="w-full sm:min-w-48 sm:flex-1"
      />
      {[
        { label: 'Status', all: 'All statuses', value: props.statusFilter, options: STATUS_OPTIONS, onChange: props.onStatusChange },
        { label: 'Plan', all: 'All plans', value: props.planFilter, options: PLAN_OPTIONS, onChange: props.onPlanChange },
        { label: 'Subscription', all: 'All subscriptions', value: props.subscriptionStatusFilter, options: SUBSCRIPTION_STATUS_OPTIONS, onChange: props.onSubscriptionStatusChange },
      ].map((filter) => (
        <label key={filter.label} className="min-w-0 flex-1 basis-36 text-xs font-medium text-gray-600 sm:flex-none">
          {filter.label}
          <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <option value="">{filter.all}</option>
            {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      <ToggleColumns table={table} />
    </div>
  );
}
