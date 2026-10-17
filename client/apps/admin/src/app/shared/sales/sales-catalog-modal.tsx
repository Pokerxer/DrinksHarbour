'use client';
import { useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { PiX, PiArrowClockwise, PiPackage } from 'react-icons/pi';
import CatalogueSearch from './sales-catalog-search';
import CatalogueFooter from './sales-catalog-footer';
import SalesCatalogCard from './sales-catalog-card';
import SalesCatalogueFilters from './sales-catalog-filters';
import { useSalesCatalogue } from './use-sales-catalogue';
import type { ProductLineSelection } from './product-line-search';
export type CatalogQtyMap = Record<string, number>;
export interface SalesCatalogModalProps {
  open: boolean;
  token: string;
  warehouseId?: string;
  warehouseName?: string;
  currency?: string;
  pricelist?: unknown;
  pricelistId?: string;
  qtyMap: CatalogQtyMap;
  onClose: () => void;
  onAdd: (selection: ProductLineSelection) => void;
  onSetQty: (selection: ProductLineSelection, quantity: number) => void;
  onRemove: (selection: ProductLineSelection) => void;
}

export default function SalesCatalogModal({
  open,
  token,
  warehouseId,
  warehouseName,
  currency = 'NGN',
  pricelist,
  pricelistId,
  qtyMap,
  onClose,
  onAdd,
  onSetQty,
  onRemove,
}: SalesCatalogModalProps) {
  const catalogue = useSalesCatalogue(
    open,
    token,
    warehouseId,
    pricelistId ?? (pricelist as { _id?: string } | undefined)?._id,
    qtyMap,
  );
  const {
    data,
    query,
    setQuery,
    filters,
    setFilters,
    facets,
    error,
    loading,
    busy,
    pricesUpdating,
    retry,
    setPage,
  } = catalogue;
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroll.current?.scrollTo?.({ top: 0 });
  }, [catalogue.page, filters, warehouseId]);
  const summary = useMemo(
    () =>
      Object.values(qtyMap).reduce(
        (result, qty) =>
          qty > 0
            ? { lines: result.lines + 1, units: result.units + qty }
            : result,
        { lines: 0, units: 0 },
      ),
    [qtyMap],
  );
  const pagination = data?.pagination;
  const products = data?.products || [];
  const filtered =
    !!query.trim() ||
    filters.inStock ||
    filters.categories.length > 0 ||
    filters.brands.length > 0 ||
    filters.types.length > 0;
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[90]">
      <DialogBackdrop className="fixed inset-0 bg-gray-950/50 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-0">
        <DialogPanel className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl">
          <header className="shrink-0 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-gray-900">
                  Product catalogue
                </DialogTitle>
                <Description className="mt-1 text-xs text-gray-500">
                  Add products and sizes to this order ·{' '}
                  {warehouseId
                    ? warehouseName || 'Selected warehouse'
                    : 'All locations'}{' '}
                  · {currency}
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
            <CatalogueSearch value={query} onChange={setQuery} />
          </header>
          <div
            ref={scroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-50/60"
          >
            <SalesCatalogueFilters
              filters={filters}
              facets={facets}
              onChange={setFilters}
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <p
                role="status"
                aria-live="polite"
                className="text-xs text-gray-500"
              >
                {error
                  ? 'Catalogue unavailable'
                  : pricesUpdating
                    ? 'Updating prices…'
                    : loading
                      ? 'Updating catalogue…'
                      : `${pagination?.total ?? 0} matching products`}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={retry}
                className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand disabled:opacity-40"
                aria-label="Refresh catalogue"
              >
                <PiArrowClockwise className={loading ? 'animate-spin' : ''} />{' '}
                Refresh
              </button>
            </div>
            <section
              aria-label="Catalogue results"
              aria-busy={loading}
              className="px-4 pb-5 sm:px-6"
            >
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-white p-8 text-center"
                >
                  <p className="text-sm text-gray-700">{error}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-4 min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white"
                  >
                    Retry catalogue
                  </button>
                </div>
              ) : loading && !products.length ? (
                <div
                  aria-label="Loading products"
                  className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,266px),266px))] gap-3"
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <div
                      key={i}
                      className="h-96 animate-pulse rounded-xl border border-gray-100 bg-gray-200/50 motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : !products.length ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
                  <PiPackage className="h-9 w-9 text-gray-300" />
                  <h3 className="text-sm font-semibold text-gray-800">
                    {filtered
                      ? 'No matching products'
                      : warehouseId
                        ? 'No products in this warehouse'
                        : 'Your catalogue is empty'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {filtered
                      ? 'Try another search or clear the filters.'
                      : warehouseId
                        ? 'Assign products to the selected warehouse to see them here.'
                        : 'Create a product to start building this order.'}
                  </p>
                  {filtered && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setFilters({
                          categories: [],
                          brands: [],
                          types: [],
                          inStock: false,
                          sort: 'name',
                        });
                      }}
                      className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-gray-700"
                    >
                      Reset search and filters
                    </button>
                  )}
                </div>
              ) : (
                <fieldset
                  disabled={busy}
                  className={`grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,266px),266px))] gap-3 ${busy ? 'opacity-60' : ''}`}
                >
                  {products.map((product) => (
                    <SalesCatalogCard
                      key={product._id}
                      product={product}
                      pricelist={pricelist}
                      currency={currency}
                      quantity={qtyMap[`${product._id}|`] || 0}
                      sizeQuantities={Object.fromEntries(
                        product.sizes.map((size) => [
                          size.size,
                          qtyMap[`${product._id}|${size.size}`] || 0,
                        ]),
                      )}
                      onAdd={onAdd}
                      onSetQty={onSetQty}
                      onRemove={onRemove}
                    />
                  ))}
                </fieldset>
              )}
            </section>
          </div>
          <CatalogueFooter
            pagination={pagination}
            busy={busy}
            summary={summary}
            onPage={(delta) => setPage((page) => page + delta)}
            onClose={onClose}
          />
        </DialogPanel>
      </div>
    </Dialog>
  );
}
