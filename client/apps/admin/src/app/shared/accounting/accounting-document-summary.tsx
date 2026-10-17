import type { ArApSummary, PaymentSide } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';

const buckets = [
  ['current', 'Not due / up to 15 days'],
  ['16-30', '16–30 days'],
  ['31-60', '31–60 days'],
  ['61-90', '61–90 days'],
  ['90+', 'Over 90 days'],
] as const;

export default function AccountingDocumentSummary({
  summary: cachedSummary,
  side,
  loading,
  error,
  onRetry,
  onReview,
}: {
  summary: ArApSummary | null;
  side: PaymentSide;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onReview?: () => void;
}) {
  const summary = loading || error ? null : cachedSummary;
  const ar = side === 'customer';
  const accounts = summary?.onAccount || 0;
  const needsReview = ar && (summary?.reviewCount || 0) > 0;
  const invoiceBalance = summary
    ? Math.max(
        0,
        Math.round(
          (summary.totalOutstanding -
            accounts +
            (ar ? summary.reviewOutstanding || 0 : 0)) *
            100
        ) / 100
      )
    : null;
  return (
    <section
      aria-label="Outstanding balances"
      aria-busy={loading}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div
        className={`grid grid-cols-2 divide-gray-200 sm:divide-x ${ar && summary && accounts === 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
      >
        <div className="border-l-4 border-brand px-5 py-5">
          <p className="text-xs font-medium text-gray-500">
            {ar ? 'Invoice balance' : 'Bill balance'}
          </p>
          <p className="mt-2 break-words font-lexend text-xl font-semibold tabular-nums tracking-tight text-gray-900 sm:text-2xl">
            {invoiceBalance == null ? '—' : fmtMoney(invoiceBalance)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {ar
              ? needsReview
                ? 'Includes draft balances awaiting reconciliation'
                : 'Outstanding on posted invoice records'
              : 'Outstanding on vendor bills'}
          </p>
        </div>
        <div className="border-l px-5 py-5 sm:border-l-0">
          <p className="text-xs font-medium text-gray-500">
            Open {ar ? 'invoices' : 'bills'}
          </p>
          <p className="mt-2 font-lexend text-2xl font-semibold tabular-nums text-gray-900">
            {summary
              ? summary.count + (ar ? summary.reviewBalanceCount || 0 : 0)
              : '—'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Unpaid and partially paid
            {needsReview ? ' · includes review drafts' : ''}
          </p>
        </div>
        {(!ar || !summary || accounts > 0) && (
          <div className="col-span-2 border-t px-5 py-5 sm:col-span-1 sm:border-t-0">
            <p className="text-xs font-medium text-gray-500">
              {ar ? 'Customer accounts' : 'Total to pay'}
            </p>
            <p className="mt-2 break-words font-lexend text-2xl font-semibold tabular-nums text-gray-900">
              {summary
                ? fmtMoney(ar ? accounts : summary.totalOutstanding)
                : '—'}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {ar
                ? 'POS account balances · included in the invoice list'
                : 'Across all open bills'}
            </p>
          </div>
        )}
      </div>
      {needsReview && summary && (
        <div
          role="alert"
          className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900"
        >
          <p className="font-semibold">
            {summary.reviewCount} invoices need reconciliation.
          </p>
          <p className="mt-1">
            Posted invoice balance: {fmtMoney(summary.totalOutstanding)}.
          </p>
          <p className="mt-1">
            Unverified draft balance: {fmtMoney(summary.reviewOutstanding || 0)}{' '}
            across {summary.reviewBalanceCount || 0} invoices. These amounts are
            not confirmed customer debt and are excluded from posted balances
            and aging.
          </p>
          <p className="mt-1">
            Open Drafts below and review the invoice reconciliation details.
          </p>
          {onReview && (
            <button
              type="button"
              onClick={onReview}
              className="mt-3 min-h-9 rounded-lg border border-amber-300 bg-white px-3 font-semibold"
            >
              Review draft invoices
            </button>
          )}
        </div>
      )}
      <div className="border-t border-gray-200 bg-gray-50/70">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-3 text-[11px] text-gray-500">
          <span className="font-semibold uppercase tracking-wider">
            {ar ? 'Receivables aging' : 'Payables aging'}
          </span>
          <span>
            {ar
              ? 'Posted invoice balances only · includes customer accounts'
              : 'All open bill balances'}{' '}
            · NGN
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-5">
          {buckets.map(([key, label]) => (
            <div key={key}>
              <p className="text-[11px] text-gray-500">
                {label}
                {key !== 'current' ? ' overdue' : ''}
              </p>
              <p
                className={`mt-1 break-words text-sm font-semibold tabular-nums ${key !== 'current' && (summary?.buckets[key] || 0) > 0 ? 'text-brand' : 'text-gray-800'}`}
              >
                {summary ? fmtMoney(summary.buckets[key] || 0) : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>
      {loading && (
        <p role="status" className="border-t px-5 py-2 text-xs text-gray-500">
          Updating balances…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900"
        >
          <p>
            Balances are unavailable. Retry to check the current amounts.{' '}
            {error}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={onRetry}
            className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 font-semibold disabled:opacity-50"
          >
            Retry balances
          </button>
        </div>
      )}
    </section>
  );
}
