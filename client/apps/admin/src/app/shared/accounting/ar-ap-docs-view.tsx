'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiArrowsClockwise, PiMagnifyingGlass } from 'react-icons/pi';
import {
  arApService,
  type ArApSummary,
  type PaymentSide,
} from '@/services/arAp.service';
import { type AccountingDocument } from './accounting-documents';
import { fmtMoney } from './accounting-helpers';
import AccountingDocumentResults from './accounting-document-results';
import PaymentFormModal from './payment-form-modal';
const INPUT =
  'min-h-11 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-red-100';

export default function ArApDocsView({ side }: { side: PaymentSide }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const ar = side === 'customer';
  const [summary, setSummary] = useState<ArApSummary | null>(null);
  const [docs, setDocs] = useState<AccountingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [paymentDoc, setPaymentDoc] = useState<AccountingDocument | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setSummaryError('');
    (ar
      ? arApService.receivablesSummary(token)
      : arApService.payablesSummary(token)
    )
      .then((result) => {
        if (!cancelled) setSummary(result.data);
      })
      .catch((err) => {
        if (!cancelled)
          setSummaryError(
            err instanceof Error ? err.message : 'Could not load balances'
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token, ar, refresh]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = {
      page,
      limit: 25,
      status: status || undefined,
      search: query || undefined,
      from: from || undefined,
      to: to || undefined,
    };
    const load = async () => {
      try {
        const result = ar
          ? await arApService.invoices(token, params)
          : await arApService.bills(token, params);
        if (cancelled) return;
        setDocs(result.data);
        setPages(result.pagination?.pages || 1);
        setTotal(result.pagination?.total || 0);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Could not load documents'
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, ar, page, status, query, from, to, refresh]);
  return (
    <div className="min-w-0 space-y-5">
      {summary && (
        <section
          aria-label="Outstanding balances"
          className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6"
        >
          <div className="rounded-2xl bg-gray-900 p-4 text-white sm:col-span-2 xl:col-span-1">
            <p className="text-xs text-gray-300">
              {ar ? 'To collect' : 'To pay'}
            </p>
            <p className="mt-2 break-words text-2xl font-semibold tabular-nums">
              {fmtMoney(summary.totalOutstanding)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {summary.count} open documents
            </p>
          </div>
          {Object.entries(summary.buckets).map(([bucket, value]) => (
            <div
              key={bucket}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <p className="text-xs text-gray-500">
                {bucket === 'current'
                  ? 'Not due / up to 15 days'
                  : `${bucket} days overdue`}
              </p>
              <p className="mt-2 break-words text-lg font-semibold tabular-nums text-gray-900">
                {fmtMoney(value)}
              </p>
            </div>
          ))}
        </section>
      )}
      {summaryError && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Balance summary unavailable: {summaryError}
        </p>
      )}
      <section
        aria-label="Document filters"
        className="rounded-2xl border border-gray-200 bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_160px_160px_160px_auto]">
          <label className="relative flex items-center">
            <span className="sr-only">Search document or customer/vendor</span>
            <PiMagnifyingGlass className="absolute left-3 text-gray-400" />
            <input
              className={`${INPUT} w-full pl-9`}
              value={search}
              placeholder="Search documents or names"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className={INPUT}
            aria-label="Payment status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All open statuses</option>
            {(ar
              ? ['unpaid', 'partial']
              : ['confirmed', 'partial', 'overdue']
            ).map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From date"
            className={INPUT}
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            aria-label="To date"
            className={INPUT}
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
            className={`${INPUT} flex items-center justify-center gap-2 font-medium disabled:opacity-50`}
          >
            <PiArrowsClockwise className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            {total} matching documents · balances above cover all open documents
          </span>
          {(search || status || from || to) && (
            <button
              type="button"
              className="min-h-8 font-semibold text-brand"
              onClick={() => {
                setSearch('');
                setQuery('');
                setStatus('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="mt-3 min-h-10 rounded-lg border border-red-200 bg-white px-4 font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <AccountingDocumentResults
          docs={docs}
          side={side}
          loading={loading}
          onPay={setPaymentDoc}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-gray-500">
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`${INPUT} disabled:opacity-40`}
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className={`${INPUT} disabled:opacity-40`}
            disabled={loading || page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {paymentDoc && (
        <PaymentFormModal
          side={side}
          initialDocument={paymentDoc}
          onClose={() => setPaymentDoc(null)}
          onSaved={() => setRefresh((value) => value + 1)}
        />
      )}
    </div>
  );
}
