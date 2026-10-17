'use client';
import { useEffect, useId, useState } from 'react';
import { PiMagnifyingGlass } from 'react-icons/pi';
import { paymentMethod } from './payment-workspace-helpers';
import PaymentPartySelect from './payment-party-select';
import type { PaymentSide } from '@/services/arAp.service';
export interface PaymentFilters {
  status: string;
  method: string;
  search: string;
  from: string;
  to: string;
  vendor?: string;
}
const empty: PaymentFilters = {
  status: '',
  method: '',
  search: '',
  from: '',
  to: '',
};
const input =
  'h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200';
export default function PaymentFilterPanel({
  filters,
  filter,
  side = 'customer',
  token = '',
}: {
  filters: PaymentFilters;
  filter: (value: Partial<PaymentFilters>) => void;
  side?: PaymentSide;
  token?: string;
}) {
  const [draft, setDraft] = useState(filters);
  const errorId = useId();
  useEffect(() => {
    setDraft(filters);
  }, [filters]);
  const invalid = !!draft.from && !!draft.to && draft.from > draft.to;
  const update = (value: Partial<PaymentFilters>) =>
    setDraft((old) => ({ ...old, ...value }));
  const changed = [...Object.keys(empty), 'vendor'].some(
    (key) =>
      draft[key as keyof PaymentFilters] !==
      filters[key as keyof PaymentFilters]
  );
  return (
    <form
      aria-label="Payment filters"
      className="rounded-xl border border-gray-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) filter({ ...draft, search: draft.search.trim() });
      }}
    >
      {side === 'vendor' && (
        <div className="mb-4 max-w-md">
          <PaymentPartySelect
            token={token}
            side="vendor"
            purpose="filter"
            value={draft.vendor || ''}
            name=""
            busy={false}
            change={(vendor) => update({ vendor })}
          />
        </div>
      )}
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(120px,1fr))]">
        <label className="min-w-0 text-xs font-medium text-gray-600 sm:col-span-2 xl:col-span-1">
          Search
          <div className="relative mt-1.5">
            <PiMagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 text-base text-gray-400"
            />
            <input
              aria-label="Search payments"
              value={draft.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Number, name or reference"
              className={`${input} pl-9`}
            />
          </div>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Status
          <select
            aria-label="Payment status"
            value={draft.status}
            onChange={(e) => update({ status: e.target.value })}
            className={`${input} mt-1.5 pr-8`}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Method
          <select
            aria-label="Payment method"
            value={draft.method}
            onChange={(e) => update({ method: e.target.value })}
            className={`${input} mt-1.5 pr-8`}
          >
            <option value="">All methods</option>
            {[
              'cash',
              'bank_transfer',
              'card',
              'pos',
              'wallet',
              'cheque',
              'other',
              'split',
            ].map((method) => (
              <option key={method} value={method}>
                {paymentMethod(method)}
              </option>
            ))}
          </select>
        </label>
        {(['from', 'to'] as const).map((key) => (
          <label
            key={key}
            className="min-w-0 text-xs font-medium text-gray-600"
          >
            {key === 'from' ? 'From' : 'To'}
            <input
              type="date"
              value={draft[key]}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              onChange={(e) => update({ [key]: e.target.value })}
              className={`${input} mt-1.5`}
            />
          </label>
        ))}
      </div>
      {invalid && (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-700">
          The end date must be on or after the start date.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p role="status" className="text-xs text-gray-500">
          {changed
            ? 'Filters changed. Apply to update the records and totals.'
            : 'Search and totals use the same filters.'}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          {(Object.values(draft).some(Boolean) ||
            Object.values(filters).some(Boolean)) && (
            <button
              type="button"
              onClick={() => {
                const reset =
                  side === 'vendor' ? { ...empty, vendor: '' } : empty;
                setDraft(reset);
                filter(reset);
              }}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Clear filters
            </button>
          )}
          <button
            type="submit"
            disabled={invalid}
            className="h-10 flex-1 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-40 sm:flex-none"
          >
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}
