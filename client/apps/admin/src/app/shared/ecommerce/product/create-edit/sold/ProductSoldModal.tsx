'use client';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { PiX, PiTrendUp, PiArrowsClockwise } from 'react-icons/pi';
import { filterSalesRows } from './sales-report';
import type { useProductSales } from './useProductSales';
import SalesTable from './SalesTable';
const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
const input =
  'mt-1 min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const PAGE_SIZE = 25;
export default function ProductSoldModal({
  productName,
  sales,
  onClose,
}: {
  productName: string;
  sales: ReturnType<typeof useProductSales>;
  onClose: () => void;
}) {
  const { report, loading, error, updatedAt, refresh } = sales;
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const invalidDates = !!(from && to && from > to);
  const rows = useMemo(
    () => filterSalesRows(report?.rows || [], query, from, to),
    [report, query, from, to]
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const clear = () => {
    setQuery('');
    setFrom('');
    setTo('');
    setPage(1);
  };
  const filtered = !!(query || from || to);
  return (
    <Dialog open onClose={onClose} className="relative z-[9999]">
      <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center sm:p-4">
        <DialogPanel className="flex h-full w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-2xl">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PiTrendUp size={22} className="text-blue-600" aria-hidden />
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  Sold history
                </DialogTitle>
              </div>
              <Description className="mt-1 break-words text-sm text-gray-500">
                {productName} · Purchases, buyers and returns
              </Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sold history"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <PiX size={22} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 p-4 sm:p-6">
            {loading ? (
              <div role="status" className="py-20 text-center text-sm text-gray-500">
                Loading sales history…
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-white p-6"
              >
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  aria-label="Retry sales lookup"
                  className={`${button} mt-4`}
                >
                  Try again
                </button>
              </div>
            ) : (
              report && (
                <>
                  <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      ['Sold units', report.totals.gross],
                      ['Returned units', report.totals.returned],
                      ['Net sold', report.totals.net],
                      ['Transactions', report.totals.transactions],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className={`rounded-xl border bg-white p-4 ${label === 'Net sold' ? 'border-blue-200' : 'border-gray-200'}`}
                      >
                        <dt className="text-xs text-gray-500">
                          {label}
                          {!report.complete && label !== 'Transactions'
                            ? ' · recorded'
                            : ''}
                        </dt>
                        <dd
                          className={`mt-2 text-2xl font-semibold tabular-nums ${label === 'Net sold' ? 'text-blue-700' : 'text-gray-900'}`}
                        >
                          {typeof value === 'number'
                            ? value.toLocaleString('en-NG')
                            : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="my-4 text-xs leading-5 text-gray-500">
                    All-time totals. Paid POS purchases, delivered online orders and
                    paid sales fulfilments. Returned units reduce net sold. Linked
                    receipts count once. Dates and times use Lagos time.
                  </p>
                  {!report.complete && (
                    <p
                      role="alert"
                      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                    >
                      Some historical quantities or sale dates are unavailable. These
                      are recorded totals; the complete sold count cannot be
                      confirmed.
                    </p>
                  )}
                  <div className="mb-4 flex flex-wrap items-end gap-3">
                    <label className="min-w-48 flex-1 text-xs font-medium text-gray-600">
                      Search sales
                      <input
                        aria-label="Search sales"
                        value={query}
                        placeholder="Buyer, receipt, tenant or size"
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(1);
                        }}
                        className={input}
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      From date
                      <input
                        aria-label="From date"
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setPage(1);
                        }}
                        className={input}
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      To date
                      <input
                        aria-label="To date"
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setPage(1);
                        }}
                        className={input}
                      />
                    </label>
                    {filtered && (
                      <button type="button" onClick={clear} className={button}>
                        Clear filters
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={refresh}
                      aria-label="Refresh sales history"
                      className={button}
                    >
                      <PiArrowsClockwise aria-hidden />
                      Refresh
                    </button>
                  </div>
                  {invalidDates && (
                    <p role="alert" className="mb-3 text-sm text-red-700">
                      From date must be on or before To date.
                    </p>
                  )}
                  <p role="status" className="mb-3 text-xs text-gray-500">
                    {rows.length.toLocaleString('en-NG')} matching sale lines
                    {filtered && ' · totals above cover all dates'}
                  </p>
                  {rows.length ? (
                    <>
                      <SalesTable rows={rows.slice(start, start + PAGE_SIZE)} />
                      <nav
                        aria-label="Sales pagination"
                        className="mt-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <span className="text-xs text-gray-500">
                          {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of{' '}
                          {rows.length} sale lines
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-label="Previous sales page"
                            disabled={currentPage === 1}
                            onClick={() => setPage(currentPage - 1)}
                            className={button}
                          >
                            Previous
                          </button>
                          <span className="text-xs text-gray-600">
                            Page {currentPage} of {pageCount}
                          </span>
                          <button
                            type="button"
                            aria-label="Next sales page"
                            disabled={currentPage === pageCount}
                            onClick={() => setPage(currentPage + 1)}
                            className={button}
                          >
                            Next
                          </button>
                        </div>
                      </nav>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center text-sm text-gray-500">
                      {filtered
                        ? 'No sales match these filters.'
                        : report.complete
                          ? 'No completed sales recorded for this product.'
                          : 'No dated sale records are available for this product.'}
                    </div>
                  )}
                </>
              )
            )}
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:px-6">
            <span className="text-xs text-gray-500">
              {updatedAt
                ? `Checked ${updatedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })} · Lagos`
                : 'Sales history'}{' '}
              · Read only
            </span>
            <button type="button" onClick={onClose} className={button}>
              Done
            </button>
          </footer>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
