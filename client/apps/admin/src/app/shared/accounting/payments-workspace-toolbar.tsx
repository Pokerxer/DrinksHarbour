'use client';
import { PiArrowClockwise, PiPlus } from 'react-icons/pi';
import type { PaymentSide, PaymentSummary } from '@/services/arAp.service';
import PaymentSummaryStrip from './payment-summary-strip';
import PaymentFilterPanel, {
  type PaymentFilters,
} from './payment-filter-panel';
export type { PaymentFilters } from './payment-filter-panel';
export default function PaymentsWorkspaceToolbar({
  side,
  filters,
  filter,
  summary,
  loading,
  unavailable,
  refresh,
  create,
  token = '',
}: {
  side: PaymentSide;
  filters: PaymentFilters;
  filter: (value: Partial<PaymentFilters>) => void;
  summary: PaymentSummary;
  loading: boolean;
  unavailable?: boolean;
  refresh: () => void;
  create: () => void;
  token?: string;
}) {
  const ar = side === 'customer';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-500">
          {ar
            ? 'Track customer receipts, invoice allocations and verified refunds.'
            : 'Track vendor payments and the bills they settle.'}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            aria-label="Refresh payments"
            disabled={loading}
            onClick={refresh}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50"
          >
            <PiArrowClockwise
              aria-hidden="true"
              className={
                loading ? 'animate-spin motion-reduce:animate-none' : ''
              }
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={create}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-gray-400 sm:flex-none"
          >
            <PiPlus aria-hidden="true" />
            {ar ? 'Record receipt' : 'Record payment'}
          </button>
        </div>
      </div>
      <PaymentSummaryStrip
        side={side}
        summary={summary}
        unavailable={loading || !!unavailable}
      />
      <PaymentFilterPanel
        filters={filters}
        filter={filter}
        side={side}
        token={token}
      />
    </div>
  );
}
