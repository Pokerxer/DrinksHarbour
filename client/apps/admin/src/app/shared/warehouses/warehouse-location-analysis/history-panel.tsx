'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getWarehouseHistory,
  getWarehouseHistoryProducts,
  type HistoryFilters,
  type WarehouseHistory,
} from '@/services/warehouseHistory.service';
import TransferSummary from './transfer-summary';
import PurchaseSummary from './purchase-summary';
import MovementSummary from './movement-summary';
import HistoryTable from './history-table';
import HistoryFiltersBar from './history-filters';
import { downloadHistory } from './history-tools';
import { PiClockCounterClockwiseBold, PiWarningCircleBold } from 'react-icons/pi';
export default function HistoryPanel({
  warehouseId,
  token,
  tab,
}: {
  warehouseId: string;
  token: string;
  tab: 'purchases' | 'transfers' | 'movements';
}) {
  const initial: HistoryFilters = {
    kind: tab === 'transfers' ? 'transfers' : tab,
    product: '',
    start: '',
    end: '',
    page: 1,
  };
  const [filters, setFilters] = useState(initial);
  const [resetKey, setResetKey] = useState(0);
  const clearFilters = () => {
    setFilters({ ...initial, kind: filters.kind });
    setResetKey((value) => value + 1);
  };
  const [data, setData] = useState<WarehouseHistory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [products, setProducts] = useState<{ id: string; label: string }[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState('');
  useEffect(() => {
    let active = true;
    setProductError('');
    setProductLoading(true);
    getWarehouseHistoryProducts(warehouseId, token)
      .then((result) => {
        if (active) setProducts(result);
      })
      .catch((reason) => {
        if (active)
          setProductError(
            reason instanceof Error
              ? reason.message
              : 'Product filters are unavailable. Retry to load products.',
          );
      })
      .finally(() => {
        if (active) setProductLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, warehouseId, reload]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    if (filters.start && filters.end && filters.start > filters.end) {
      setError('Choose an end date on or after the start date.');
      setLoading(false);
      return;
    }
    getWarehouseHistory(warehouseId, token, filters)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load history');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [warehouseId, token, filters, reload]);
  const change = useCallback(
    (patch: Partial<HistoryFilters>) => setFilters((value) => ({ ...value, ...patch, page: 1 })),
    [],
  );
  const title =
    tab === 'purchases'
      ? 'Purchase history'
      : tab === 'transfers'
        ? 'Transfer history'
        : 'Stock movement history';
  const hasFilters = !!(
    filters.product ||
    filters.start ||
    filters.end ||
    filters.status ||
    filters.search?.trim()
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#2a2420]">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {tab === 'purchases'
              ? 'Orders and receipts linked to this warehouse.'
              : tab === 'transfers'
                ? 'Track incoming, outgoing and returned stock.'
                : 'A chronological record of changes to your stock.'}
          </p>
        </div>
        {!loading && data && (
          <span className="rounded-full bg-[#f6f3ed] px-3 py-1.5 text-xs font-semibold text-[#75695d]">
            {data.pagination.total.toLocaleString()} {hasFilters ? 'matching' : 'total'} records
          </span>
        )}
      </div>
      <HistoryFiltersBar
        filters={filters}
        resetKey={resetKey}
        products={products}
        productLoading={productLoading}
        productError={productError}
        retryProducts={() => setReload((value) => value + 1)}
        transfer={tab === 'transfers'}
        loading={loading}
        canExport={!!data?.rows.length}
        change={change}
        clear={clearFilters}
        refresh={() => setReload((value) => value + 1)}
        download={() => {
          if (data) downloadHistory(data.rows, filters.kind, warehouseId, filters.page);
        }}
      />
      {productError && (
        <p role="status" className="text-sm text-amber-700">
          {productError}
        </p>
      )}
      {filters.kind === 'purchases' && (
        <p className="text-sm text-gray-500">
          Received here shows historical receipts before returns. Purchased after returns deducts
          applied returns at this warehouse. Open a purchase for receipts and refund details.
        </p>
      )}
      {filters.kind === 'transfers' && (
        <p className="text-sm text-gray-500">
          Quantities show recorded shipments or receipts at this warehouse. Document values cover
          the whole transfer; open a transfer for return details.
        </p>
      )}
      {loading ? (
        <div role="status" className="rounded-xl border border-[#ece4d6] bg-white p-6">
          <p className="mb-4 text-sm text-gray-500">Loading history…</p>
          <div aria-hidden="true" className="space-y-3 animate-pulse">
            {[1, 2, 3].map((id) => (
              <div key={id} className="h-10 rounded-lg bg-[#f6f3ed]" />
            ))}
          </div>
        </div>
      ) : error ? (
        <p
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"
        >
          <PiWarningCircleBold className="h-5 w-5 shrink-0" aria-hidden="true" />
          {error}{' '}
          <button className="underline" onClick={() => setReload((value) => value + 1)}>
            Retry
          </button>
        </p>
      ) : (
        data && (
          <>
            {data.transferTotals && <TransferSummary summary={data.transferTotals} />}
            {data.purchaseTotals && <PurchaseSummary summary={data.purchaseTotals} />}
            {data.movementTotals && <MovementSummary summary={data.movementTotals} />}
            {data.rows.length ? (
              <HistoryTable rows={data.rows} kind={filters.kind} />
            ) : (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-[#ded4c6] bg-white px-6 py-12 text-center">
                <PiClockCounterClockwiseBold
                  className="mb-3 h-9 w-9 text-[#b5a797]"
                  aria-hidden="true"
                />
                <p className="font-semibold text-[#65594e]">No records match these filters.</p>
                <p className="mt-2 text-sm text-gray-500">
                  {hasFilters
                    ? 'Try another product or widen the date range.'
                    : 'Activity will appear here when it is recorded at this warehouse.'}
                </p>
                {hasFilters && (
                  <button
                    className="mt-4 text-sm font-semibold text-[#b20202]"
                    onClick={clearFilters}
                  >
                    Reset filters
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                {data.rows.length
                  ? `${((data.pagination.page - 1) * data.pagination.limit + 1).toLocaleString()}–${((data.pagination.page - 1) * data.pagination.limit + data.rows.length).toLocaleString()} of ${data.pagination.total.toLocaleString()} records`
                  : '0 records'}{' '}
                · Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Rows per page
                  <select
                    aria-label="Rows per page"
                    value={filters.limit || 20}
                    onChange={(event) => change({ limit: Number(event.target.value) })}
                    className="rounded-lg border bg-white px-2 py-2"
                  >
                    {[20, 50, 100].map((limit) => (
                      <option key={limit} value={limit}>
                        {limit}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="rounded-lg border px-3 py-2 disabled:opacity-40"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((value) => ({ ...value, page: value.page - 1 }))}
                >
                  Previous
                </button>
                <button
                  className="rounded-lg border px-3 py-2 disabled:opacity-40"
                  disabled={filters.page >= data.pagination.totalPages}
                  onClick={() => setFilters((value) => ({ ...value, page: value.page + 1 }))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
