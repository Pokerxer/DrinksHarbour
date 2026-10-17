'use client';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { PiX, PiPackage, PiArrowsClockwise } from 'react-icons/pi';
import { useProductOnHand } from './useProductOnHand';
import { filterStockRows } from './stock-report';
import StockTable from './StockTable';
export default function ProductOnHandModal({
  productId,
  productName,
  token,
  onClose,
  onTotalChange,
}: {
  productId: string;
  productName: string;
  token?: string;
  onClose: () => void;
  onTotalChange?: (total: number) => void;
}) {
  const { report, loading, error, updatedAt, refresh } = useProductOnHand(
    productId,
    token,
    onTotalChange
  );
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () => filterStockRows(report?.rows || [], query),
    [report, query]
  );
  const button =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
  return (
    <Dialog open onClose={onClose} className="relative z-[9999]">
      <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center sm:p-4">
        <DialogPanel className="flex h-full w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-2xl">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PiPackage size={22} className="text-blue-600" aria-hidden />
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  On-hand stock
                </DialogTitle>
              </div>
              <Description className="mt-1 break-words text-sm text-gray-500">
                {productName} · Stock across tenant listings and sizes
              </Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close on-hand stock"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <PiX size={22} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 p-4 sm:p-6">
            {loading ? (
              <div
                role="status"
                className="py-20 text-center text-sm text-gray-500"
              >
                Loading stock details…
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
                  className={`${button} mt-4`}
                  aria-label="Retry stock lookup"
                >
                  Try again
                </button>
              </div>
            ) : (
              report && (
                <>
                  <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                      [
                        'Total on hand',
                        report.onHand === null
                          ? 'Unavailable'
                          : report.onHand.toLocaleString('en-NG'),
                      ],
                      [
                        'Reserved',
                        report.reserved === null
                          ? 'Unavailable'
                          : report.reserved.toLocaleString('en-NG'),
                      ],
                      [
                        'Available',
                        report.available === null
                          ? 'Unavailable'
                          : report.available.toLocaleString('en-NG'),
                      ],
                      [
                        'Tenant listings',
                        report.listings.toLocaleString('en-NG'),
                      ],
                      [
                        'Stock lines',
                        report.rows.length.toLocaleString('en-NG'),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-gray-200 bg-white p-4"
                      >
                        <dt className="text-xs text-gray-500">{label}</dt>
                        <dd
                          aria-label={label}
                          className="mt-1 text-2xl font-semibold tabular-nums text-gray-900"
                        >
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {!!report.missingReservations && (
                    <p
                      role="status"
                      className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      Reservation quantities are missing for{' '}
                      {report.missingReservations} stock lines. Missing data is
                      shown as —, not zero.
                    </p>
                  )}
                  {!!report.inconsistentBalances && (
                    <p
                      role="alert"
                      className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      {report.inconsistentBalances} stock balances need review.
                      Reserved stock exceeds on hand or the recorded available
                      quantity differs. Where both quantities are known,
                      available is calculated as on hand minus reserved, with a
                      minimum of zero.
                    </p>
                  )}
                  {!!report.missingQuantities && (
                    <p
                      role="status"
                      className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      {report.missingQuantities} stock lines have no recorded
                      quantity. They are shown as —, not zero.
                      {report.onHand === null
                        ? ` Known quantities total ${report.knownOnHand.toLocaleString('en-NG')} units.`
                        : ''}
                    </p>
                  )}
                  {!!report.mismatchedListings && (
                    <p
                      role="status"
                      className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      {report.mismatchedListings} listing totals differ from
                      their size breakdown. The total above follows the listing
                      totals.
                    </p>
                  )}
                  {report.rows.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
                      <h3 className="font-semibold text-gray-900">
                        No tenant listings
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        This product has no recorded tenant stock yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="w-full sm:max-w-md">
                          <span className="sr-only">Search stock details</span>
                          <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search tenant, SKU or size"
                            className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>
                        <p className="text-xs text-gray-500">
                          Showing {rows.length} of {report.rows.length} stock
                          lines
                        </p>
                      </div>
                      {rows.length ? (
                        <StockTable rows={rows} />
                      ) : (
                        <div
                          role="status"
                          className="rounded-xl border border-gray-200 bg-white py-12 text-center"
                        >
                          <p className="font-medium text-gray-700">
                            No matching stock lines
                          </p>
                          <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="mt-2 min-h-11 px-3 text-sm font-semibold text-blue-700"
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <p className="mt-4 text-xs leading-relaxed text-gray-500">
                    On hand includes all linked listing statuses. These are
                    catalogue quantities, not a warehouse-by-warehouse balance.
                    Reserved units are held by existing orders. Available is on
                    hand minus reserved when both are known. Refresh to check
                    current balances.
                  </p>
                </>
              )
            )}
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <p className="text-xs text-gray-500">
              {updatedAt
                ? `Checked at ${updatedAt.toLocaleTimeString()}`
                : 'Stock details are read only'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={loading || !token}
                aria-label="Refresh stock"
                className={button}
              >
                <PiArrowsClockwise aria-hidden />
                Refresh
              </button>
              <button type="button" onClick={onClose} className={button}>
                Close
              </button>
            </div>
          </footer>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
