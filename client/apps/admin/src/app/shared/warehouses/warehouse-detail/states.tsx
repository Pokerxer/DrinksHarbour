'use client';

// app/shared/warehouses/warehouse-detail/states.tsx
// Terminal states: no stock at all, no matches for the current filters, a load
// failure, or an unknown warehouse id. Each renders distinct guidance instead
// of the old behaviour where every one of them looked like "No stock".

import Link from 'next/link';
import {
  PiPackageBold,
  PiArrowsClockwise,
  PiMagnifyingGlass,
  PiWarningCircleBold,
  PiArrowLeft,
} from 'react-icons/pi';
import { routes } from '@/config/routes';

function Shell({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-gray-700">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-gray-400">{body}</p>
        {children}
      </div>
    </div>
  );
}

const PRIMARY_BTN =
  'mt-4 inline-flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]';

export function EmptyState() {
  return (
    <Shell
      icon={<PiPackageBold className="h-8 w-8 text-gray-400" />}
      title="No stock in this warehouse yet"
      body="Receive a purchase order or transfer stock in to populate this location."
    />
  );
}

export function FilteredEmptyState({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  return (
    <Shell
      icon={<PiMagnifyingGlass className="h-8 w-8 text-gray-400" />}
      title="No lines match your filter"
      body="Try clearing the search or status filter."
    >
      <button type="button" onClick={onClearFilters} className={PRIMARY_BTN}>
        <PiArrowsClockwise className="h-4 w-4" /> Clear filters
      </button>
    </Shell>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Shell
      icon={<PiWarningCircleBold className="h-8 w-8 text-red-400" />}
      title="Couldn't load this warehouse"
      body={
        message ||
        'Something went wrong while fetching stock. Check your connection and try again.'
      }
    >
      <button type="button" onClick={onRetry} className={PRIMARY_BTN}>
        <PiArrowsClockwise className="h-4 w-4" /> Retry
      </button>
    </Shell>
  );
}

export function NotFoundState() {
  return (
    <Shell
      icon={<PiWarningCircleBold className="h-8 w-8 text-gray-400" />}
      title="Warehouse not found"
      body="This location may have been deleted, or the link is out of date."
    >
      <Link href={routes.warehouses.list} className={PRIMARY_BTN}>
        <PiArrowLeft className="h-4 w-4" /> Back to warehouses
      </Link>
    </Shell>
  );
}
