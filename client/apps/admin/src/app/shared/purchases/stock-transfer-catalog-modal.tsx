'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { PiArrowClockwise, PiPackage, PiX } from 'react-icons/pi';
import CatalogueSearch from '../sales/sales-catalog-search';
import CatalogueFooter from '../sales/sales-catalog-footer';
import { CatalogueSort, type SortKey } from '../sales/sales-catalog-filters';
import type { ProductLineSelection } from '../sales/product-line-search';
import PurchasesCatalogCard from './purchases-catalog-card';
import {
  buildTransferCatalogue,
  paginateTransferCatalogue,
  transferStockKey,
  type TransferCatalogRow,
} from './stock-transfer-catalog-data';

interface StockTransferCatalogModalProps {
  open: boolean;
  sourceName: string;
  currency: string;
  priceMode: 'cost' | 'wholesale';
  rows: TransferCatalogRow[];
  loading: boolean;
  error: boolean;
  qtyMap: Record<string, number>;
  onClose: () => void;
  onRefresh: () => void;
  onAdd: (row: TransferCatalogRow) => void;
  onSetQty: (row: TransferCatalogRow, quantity: number) => void;
  onRemove: (row: TransferCatalogRow) => void;
}

export default function TransferCatalogModal({
  open,
  sourceName,
  currency,
  priceMode,
  rows,
  loading,
  error,
  qtyMap,
  onClose,
  onRefresh,
  onAdd,
  onSetQty,
  onRemove,
}: StockTransferCatalogModalProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [page, setPage] = useState(1);
  const scroll = useRef<HTMLDivElement>(null);
  const catalogue = useMemo(
    () => buildTransferCatalogue(rows, priceMode),
    [rows, priceMode]
  );
  const { products, pagination } = useMemo(
    () => paginateTransferCatalogue(catalogue.products, query, sort, page),
    [catalogue.products, query, sort, page]
  );
  useEffect(() => {
    scroll.current?.scrollTo?.({ top: 0 });
  }, [pagination.page, sort]);

  const summary = Object.values(qtyMap).reduce(
    (result, qty) =>
      qty > 0 ? { lines: result.lines + 1, units: result.units + qty } : result,
    { lines: 0, units: 0 }
  );
  const pickRow = (selection: ProductLineSelection) =>
    catalogue.rowsByKey.get(
      transferStockKey(selection.subProductId, selection.sizeId)
    );
  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const gridClass =
    'grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,266px),266px))] gap-3';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[90]">
      <DialogBackdrop className="fixed inset-0 bg-gray-950/50 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center">
        <DialogPanel className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl">
          <header className="shrink-0 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-gray-900">
                  Source stock catalogue
                </DialogTitle>
                <Description className="mt-1 text-xs text-gray-500">
                  {sourceName} ·{' '}
                  {priceMode === 'wholesale' ? 'Wholesale' : 'Cost'} prices ·{' '}
                  {currency}
                </Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close catalogue"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <PiX className="h-5 w-5" />
              </button>
            </div>
            <CatalogueSearch
              value={query}
              onChange={updateQuery}
              placeholder="Search products, sizes or SKU…"
            />
          </header>
          <div
            ref={scroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-50/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
              <p role="status" className="text-xs text-gray-500">
                {error
                  ? 'Source stock unavailable'
                  : loading
                    ? 'Updating source stock…'
                    : `${pagination.total} matching products`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand disabled:opacity-40"
                >
                  <PiArrowClockwise className={loading ? 'animate-spin' : ''} />{' '}
                  Refresh
                </button>
                <CatalogueSort
                  value={sort}
                  onChange={(value) => {
                    setSort(value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <section
              aria-label="Catalogue results"
              aria-busy={loading}
              className="px-4 py-4 sm:px-6"
            >
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-white p-8 text-center"
                >
                  <p className="text-sm text-gray-700">
                    Couldn’t load stock for {sourceName}.
                  </p>
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-4 min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white"
                  >
                    Retry catalogue
                  </button>
                </div>
              ) : loading && !products.length ? (
                <div className={gridClass} aria-label="Loading products">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div
                      key={index}
                      className="h-96 animate-pulse rounded-xl border border-gray-100 bg-gray-200/50 motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : !products.length ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
                  <PiPackage className="h-9 w-9 text-gray-300" />
                  <h3 className="text-sm font-semibold text-gray-800">
                    {query
                      ? 'No matching stocked products'
                      : 'The source warehouse has no stock'}
                  </h3>
                  {query && (
                    <button
                      type="button"
                      onClick={() => updateQuery('')}
                      className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-gray-700"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <fieldset disabled={loading} className={gridClass}>
                  {products.map((product) => (
                    <PurchasesCatalogCard
                      key={transferStockKey(
                        product._id,
                        product.sellWithoutSizeVariants ? undefined : 'sized'
                      )}
                      product={product}
                      currency={currency}
                      priceLabel={
                        priceMode === 'wholesale' ? 'Wholesale' : 'Cost'
                      }
                      documentLabel="transfer"
                      quantity={qtyMap[transferStockKey(product._id)] ?? 0}
                      sizeQuantities={Object.fromEntries(
                        product.sizes.map((size) => [
                          size.size,
                          qtyMap[transferStockKey(product._id, size.size)] ?? 0,
                        ])
                      )}
                      onAdd={(selection) => {
                        const row = pickRow(selection);
                        if (row) onAdd(row);
                      }}
                      onSetQty={(selection, quantity) => {
                        const row = pickRow(selection);
                        if (row) onSetQty(row, quantity);
                      }}
                      onRemove={(selection) => {
                        const row = pickRow(selection);
                        if (row) onRemove(row);
                      }}
                    />
                  ))}
                </fieldset>
              )}
            </section>
          </div>
          <CatalogueFooter
            pagination={error ? undefined : pagination}
            busy={loading || error}
            summary={summary}
            documentLabel="transfer"
            onPage={(delta) => setPage(pagination.page + delta)}
            onClose={onClose}
          />
        </DialogPanel>
      </div>
    </Dialog>
  );
}
