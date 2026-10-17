import { PiArrowsClockwise, PiMagnifyingGlass } from 'react-icons/pi';
import type { PaymentSide } from '@/services/arAp.service';
import type { DocumentFilters } from './use-accounting-documents';

const input =
  'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-red-100';
export default function AccountingDocumentFilters({
  side,
  filters,
  update,
  onClear,
  onRefresh,
  refreshing,
}: {
  side: PaymentSide;
  filters: DocumentFilters;
  update: (key: keyof DocumentFilters, value: string) => void;
  onClear: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const ar = side === 'customer';
  const statuses = ar
    ? [
        ['', 'All invoices'],
        ['open', 'Open'],
        ['paid', 'Paid'],
        ['unpaid', 'Unpaid'],
        ['partial', 'Partially paid'],
        ['draft', 'Drafts'],
        ['cancelled', 'Cancelled'],
      ]
    : [
        ['', 'All open'],
        ['confirmed', 'Unpaid'],
        ['partial', 'Partially paid'],
        ['overdue', 'Overdue'],
      ];
  return (
    <section aria-label="Document filters" className="border-b border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div
          role="group"
          aria-label="Payment status"
          className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1"
        >
          {statuses.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.status === value}
              onClick={() => update('status', value)}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${filters.status === value ? 'bg-white text-brand shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {ar && (
          <label className="grid gap-1 text-[11px] text-gray-500">
            Return status
            <select
              aria-label="Return status"
              value={filters.returnStatus || ''}
              onChange={(event) => update('returnStatus', event.target.value)}
              className={input}
            >
              <option value="">All return states</option>
              <option value="returned">Returned invoices</option>
              <option value="partial">Partially returned</option>
              <option value="full">Fully returned</option>
              <option value="none">No returns</option>
              <option value="review">Quantity review</option>
            </select>
          </label>
        )}
        <label className="relative w-full sm:w-72">
          <span className="sr-only">
            Search {ar ? 'invoices or customers' : 'bills or vendors'}
          </span>
          <PiMagnifyingGlass
            aria-hidden
            className="absolute left-3 top-3 text-gray-400"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            placeholder={
              ar ? 'Search invoices or customers' : 'Search bills or vendors'
            }
            className={`${input} w-full pl-9`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-5">
        <label className="grid min-w-0 flex-1 basis-[140px] gap-1 text-[11px] font-medium text-gray-500 sm:max-w-44">
          {ar ? 'Issued from' : 'Bill date from'}
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => update('from', event.target.value)}
            className={input}
          />
        </label>
        <label className="grid min-w-0 flex-1 basis-[140px] gap-1 text-[11px] font-medium text-gray-500 sm:max-w-44">
          {ar ? 'Issued to' : 'Bill date to'}
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => update('to', event.target.value)}
            className={input}
          />
        </label>
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-10 px-2 text-xs font-semibold text-brand hover:underline"
          >
            Clear filters
          </button>
        )}
        <button
          type="button"
          disabled={refreshing}
          onClick={onRefresh}
          className={`${input} ml-auto inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50`}
        >
          <PiArrowsClockwise
            aria-hidden
            className={
              refreshing ? 'animate-spin motion-reduce:animate-none' : ''
            }
          />
          Refresh
        </button>
      </div>
    </section>
  );
}
