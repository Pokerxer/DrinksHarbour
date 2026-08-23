'use client';

import { PiCaretUpBold, PiCaretDownBold, PiCaretUpDownBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

function SortHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className: cls,
}: {
  field: string;
  label: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}) {
  const active = sortField === field;
  const Icon = !active
    ? PiCaretUpDownBold
    : sortDir === 'asc'
      ? PiCaretUpBold
      : PiCaretDownBold;
  return (
    <th scope="col" className={cn('px-5 py-3.5 text-left', cls)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${label}`}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900"
      >
        {label}
        <Icon
          className={cn('h-3 w-3', active ? 'text-primary' : 'text-gray-400')}
        />
      </button>
    </th>
  );
}

/** Sortable column headers for the orders list. Kept out of the table body so
 *  the sort wiring reads in one place. */
export default function OrderTableHead({
  sortField,
  sortDir,
  onSort,
}: {
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const th = { sortField, sortDir, onSort };
  return (
    <thead>
      <tr className="border-b border-muted bg-gray-50">
        <SortHeader field="orderNumber" label="Order #" {...th} className="whitespace-nowrap" />
        <th
          scope="col"
          className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          Customer
        </th>
        <th
          scope="col"
          className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          Items
        </th>
        <SortHeader field="total" label="Total" {...th} className="whitespace-nowrap" />
        <th
          scope="col"
          className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          Platform Profit
        </th>
        <SortHeader field="status" label="Status" {...th} />
        <SortHeader field="paymentStatus" label="Payment" {...th} />
        <th
          scope="col"
          className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          Method
        </th>
        <SortHeader field="placedAt" label="Date" {...th} className="whitespace-nowrap" />
        <th scope="col" className="px-5 py-3.5">
          <span className="sr-only">View</span>
        </th>
      </tr>
    </thead>
  );
}
