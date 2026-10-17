'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PiArrowClockwise, PiPlus } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { useSalesOperations } from './use-sales-operations';
import {
  emptyOperationsFilters,
  operationsOrders,
  operationsQuantity,
  type OperationsFilters,
  type OperationsKind,
} from './sales-operations-helpers';
import SalesOperationsToolbar from './sales-operations-toolbar';
import SalesOperationsResults from './sales-operations-results';

const buttonBase =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40';
const button = `${buttonBase} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`;
const primaryButton = `${buttonBase} border-brand bg-brand text-white hover:bg-red-800`;
const pageSize = 25;
export default function SalesOperationsWorkspace({
  kind,
}: {
  kind: OperationsKind;
}) {
  const state = useSalesOperations(kind);
  const [filters, setFilters] = useState(emptyOperationsFilters);
  const [page, setPage] = useState(1);
  const eligible = operationsOrders(state.orders, kind, emptyOperationsFilters);
  const matching = operationsOrders(eligible, kind, filters);
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pages);
  const shown = matching.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const filtered = Object.values(filters).some(Boolean);
  const update = (key: keyof OperationsFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };
  const clear = () => {
    setFilters(emptyOperationsFilters);
    setPage(1);
  };
  const quantity =
    Math.round(
      matching.reduce(
        (sum, order) => sum + operationsQuantity(order, kind),
        0
      ) * 1000
    ) / 1000;
  if (state.signedOut)
    return (
      <p
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        Sign in to view {kind === 'fulfill' ? 'deliveries' : 'returns'}.
      </p>
    );
  return (
    <div className="min-w-0 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/sales"
            className="text-xs font-medium text-gray-500 hover:text-brand"
          >
            Sales overview
          </Link>
          <h1 className="mt-1 font-lexend text-xl font-semibold text-gray-900">
            {kind === 'fulfill' ? 'Deliveries' : 'Sales returns'}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {kind === 'fulfill'
              ? 'Review outstanding delivery quantities before fulfilling an order.'
              : 'Review goods returned through Sales or POS. Order value is not a refund amount.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            onClick={() => void state.refresh()}
            disabled={state.loading}
          >
            <PiArrowClockwise aria-hidden /> Refresh
          </button>
          {kind === 'returns' && (
            <Link
              href={routes.eCommerce.createSalesReturn}
              className={primaryButton}
            >
              <PiPlus aria-hidden /> New return
            </Link>
          )}
        </div>
      </header>
      {kind === 'returns' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          <span>
            Goods returns, credit notes and payment refunds are separate
            records.
          </span>
          <Link
            href={`${routes.accounting.creditNotes}?side=customer`}
            className="font-semibold text-brand hover:underline"
          >
            Review customer credits
          </Link>
        </div>
      )}
      <section
        aria-label={
          kind === 'fulfill' ? 'Delivery workspace' : 'Returns workspace'
        }
        className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <SalesOperationsToolbar
          orders={eligible}
          kind={kind}
          filters={filters}
          update={update}
          clear={clear}
        />
        {state.loading ? (
          <p role="status" className="p-6 text-sm text-gray-500">
            Loading {kind === 'fulfill' ? 'deliveries' : 'returns'}…
          </p>
        ) : state.error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>Results are unavailable. {state.error}</p>
            <button
              type="button"
              className={button}
              onClick={() => void state.refresh()}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-between gap-2 border-b border-gray-100 px-3 py-2 text-xs text-gray-600">
              <span>
                {matching.length} {filtered ? 'matching' : ''} orders ·{' '}
                {quantity.toLocaleString('en-NG')}{' '}
                {kind === 'fulfill' ? 'to deliver' : 'returned'} (selling qty)
              </span>
              <span>Quantities follow each product's selling unit.</span>
            </div>
            <SalesOperationsResults
              orders={shown}
              kind={kind}
              filtered={filtered}
            />
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
              <span>
                Showing {shown.length ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, matching.length)} of{' '}
                {matching.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {pages}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
