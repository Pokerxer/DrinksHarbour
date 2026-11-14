'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import {
  PiArrowClockwise,
  PiCaretLeft,
  PiCaretRight,
  PiFunnel,
  PiPackage,
  PiX,
} from 'react-icons/pi';
import BuilderCatalogCard, {
  rowStock,
  type BuilderCatalogRow,
} from './builder-catalog-card';
import BuilderTenantPicker from './builder-tenant-picker';
import type { BuilderLine } from '@/services/whatsapp-order.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const PAGE_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 250;

type SortKey = 'name' | 'priceAsc' | 'priceDesc' | 'stock';
interface CatalogFilters {
  categories: string[];
  brands: string[];
  inStock: boolean;
  sort: SortKey;
}
const emptyFilters: CatalogFilters = {
  categories: [],
  brands: [],
  inStock: false,
  sort: 'name',
};

interface CatalogData {
  rows: BuilderCatalogRow[];
  pagination: {
    page: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const rowPrice = (row: BuilderCatalogRow) =>
  (row.sizes || []).reduce(
    (min, s) => {
      const p = s.sellingPrice ?? 0;
      return p > 0 && p < min ? p : min;
    },
    Infinity,
  );

export interface BuilderCatalogModalProps {
  open: boolean;
  token: string;
  /** Current builder lines — drives the footer's "N lines · N units". */
  lines: BuilderLine[];
  onClose: () => void;
  onAdd: (lines: Array<Omit<BuilderLine, 'key'>>) => void;
}

export default function BuilderCatalogModal({
  open,
  token,
  lines,
  onClose,
  onAdd,
}: BuilderCatalogModalProps) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ productId: string; productName: string } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const seqRef = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);

  // Debounced search (220–300ms band) — resets to the first page.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(draft.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  // Cross-tenant catalogue fetch — no server filter params exist on this
  // path, so categories/brands/inStock/sort are applied client-side below.
  useEffect(() => {
    if (!open || !token) return;
    const seq = ++seqRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      status: 'active',
      limit: String(PAGE_SIZE),
      page: String(page),
      search: query,
    });
    fetch(`${API_URL}/api/subproducts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          data?: { subProducts?: BuilderCatalogRow[]; pagination?: Partial<CatalogData['pagination']> };
        };
        if (!res.ok || !body.success || !Array.isArray(body.data?.subProducts))
          throw new Error(body.message || 'Unable to load the catalogue. Please retry.');
        if (seq !== seqRef.current) return;
        setData({
          rows: body.data.subProducts,
          pagination: {
            page: body.data.pagination?.page ?? page,
            total: body.data.pagination?.total ?? body.data.subProducts.length,
            pages: body.data.pagination?.pages ?? 1,
            hasNext: body.data.pagination?.hasNext ?? false,
            hasPrev: body.data.pagination?.hasPrev ?? false,
          },
        });
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted || seq !== seqRef.current) return;
        setError(e instanceof Error ? e.message : 'Unable to load the catalogue');
        setLoading(false);
      });
    return () => controller.abort();
  }, [open, token, query, page]);

  useEffect(() => {
    scroll.current?.scrollTo?.({ top: 0 });
  }, [page, query]);

  // Client-side facets from the loaded rows (categories/brands only — types
  // live on the product as `type`, not surfaced per-row here).
  const facets = useMemo(() => {
    const rows = data?.rows ?? [];
    const collect = (get: (r: BuilderCatalogRow) => string | undefined) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const name = get(r);
        if (name) m.set(name, (m.get(name) ?? 0) + 1);
      }
      return [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, n]) => ({ id, name: id, n }));
    };
    return {
      categories: collect((r) => r.product?.category?.name),
      brands: collect((r) => r.product?.brand?.name),
    };
  }, [data]);

  const visible = useMemo(() => {
    let rows = data?.rows ?? [];
    if (filters.categories.length)
      rows = rows.filter((r) =>
        filters.categories.includes(r.product?.category?.name ?? ''),
      );
    if (filters.brands.length)
      rows = rows.filter((r) => filters.brands.includes(r.product?.brand?.name ?? ''));
    if (filters.inStock) rows = rows.filter((r) => rowStock(r) > 0);
    const sorted = [...rows];
    if (filters.sort === 'name') sorted.sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? ''));
    if (filters.sort === 'priceAsc') sorted.sort((a, b) => rowPrice(a) - rowPrice(b));
    if (filters.sort === 'priceDesc') sorted.sort((a, b) => rowPrice(b) - rowPrice(a));
    if (filters.sort === 'stock') sorted.sort((a, b) => rowStock(b) - rowStock(a));
    return sorted;
  }, [data, filters]);

  const summary = useMemo(() => {
    const productLines = lines.filter((l) => l.lineType === 'product');
    return {
      lines: productLines.length,
      units: productLines.reduce((s, l) => s + l.quantity, 0),
    };
  }, [lines]);

  const filtered =
    Boolean(query) || filters.inStock || filters.categories.length > 0 || filters.brands.length > 0;
  const activeFilterCount =
    filters.categories.length + filters.brands.length + Number(filters.inStock);
  const pagination = data?.pagination;

  return (
    <>
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
                    Add products for this WhatsApp order · NGN
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
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 focus-within:border-brand focus-within:bg-white focus-within:ring-1 focus-within:ring-brand">
                <input
                  data-autofocus
                  aria-label="Search catalogue"
                  maxLength={120}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Search products, SKU or barcode…"
                  className="min-h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0"
                />
                {draft && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setDraft('')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
                  >
                    <PiX />
                  </button>
                )}
              </div>
            </header>
            <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-50/60">
              {/* Client-side filter row (facets come from the loaded rows). */}
              <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-expanded={filtersExpanded}
                    aria-controls="builder-catalogue-filters"
                    onClick={() => setFiltersExpanded((v) => !v)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                      activeFilterCount || filtersExpanded
                        ? 'border-brand/30 bg-red-50 text-brand'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <PiFunnel /> Filters
                    {activeFilterCount > 0 && (
                      <span className="rounded bg-brand px-1.5 text-xs text-white">{activeFilterCount}</span>
                    )}
                  </button>
                  <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={filters.inStock}
                      onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />{' '}
                    In stock only
                  </label>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}
                      className="inline-flex min-h-10 items-center gap-1 text-xs text-gray-500 hover:text-brand"
                    >
                      <PiX /> Clear filters
                    </button>
                  )}
                  <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                    Sort
                    <select
                      aria-label="Sort catalogue"
                      value={filters.sort}
                      onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })}
                      className="min-h-10 rounded-lg border-gray-200 bg-gray-50 py-2 text-xs text-gray-700 focus:border-brand focus:ring-brand"
                    >
                      <option value="name">Name A–Z</option>
                      <option value="priceAsc">Selling price: low to high</option>
                      <option value="priceDesc">Selling price: high to low</option>
                      <option value="stock">Availability: high to low</option>
                    </select>
                  </label>
                </div>
                {filtersExpanded && (
                  <div id="builder-catalogue-filters" className="mt-3 grid gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-2">
                    {(
                      [
                        ['Categories', facets.categories, filters.categories],
                        ['Brands', facets.brands, filters.brands],
                      ] as const
                    ).map(([title, options, selected]) => (
                      <fieldset key={title} className="min-w-0">
                        <legend className="mb-2 text-xs font-semibold text-gray-700">
                          {title}
                          {selected.length > 0 ? ` (${selected.length})` : ''}
                        </legend>
                        <div className="max-h-36 space-y-1 overflow-y-auto overscroll-contain pr-1">
                          {options.length ? (
                            options.map((option) => (
                              <label
                                key={option.id}
                                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-gray-700 hover:bg-white"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.includes(option.id)}
                                  onChange={() =>
                                    setFilters({
                                      ...filters,
                                      [title === 'Categories' ? 'categories' : 'brands']: selected.includes(option.id)
                                        ? selected.filter((id) => id !== option.id)
                                        : [...selected, option.id],
                                    })
                                  }
                                  className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                                />
                                <span className="truncate">
                                  {option.name.replace(/[_-]/g, ' ')}{' '}
                                  <span className="text-gray-400">({option.n})</span>
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="p-2 text-xs text-gray-500">No matching options</p>
                          )}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <p role="status" aria-live="polite" className="text-xs text-gray-500">
                  {error
                    ? 'Catalogue unavailable'
                    : loading
                      ? 'Updating catalogue…'
                      : `${pagination?.total ?? 0} matching products`}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPage((p) => p)}
                  className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand disabled:opacity-40"
                  aria-label="Refresh catalogue"
                >
                  <PiArrowClockwise className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              <section aria-label="Catalogue results" aria-busy={loading} className="px-4 pb-5 sm:px-6">
                {error ? (
                  <div role="alert" className="rounded-xl border border-red-100 bg-white p-8 text-center">
                    <p className="text-sm text-gray-700">{error}</p>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p)}
                      className="mt-4 min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white"
                    >
                      Retry catalogue
                    </button>
                  </div>
                ) : loading && !(data?.rows ?? []).length ? (
                  <div aria-label="Loading products" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,266px),266px))] gap-3">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className="h-96 animate-pulse rounded-xl border border-gray-100 bg-gray-200/50 motion-reduce:animate-none"
                      />
                    ))}
                  </div>
                ) : !visible.length ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
                    <PiPackage className="h-9 w-9 text-gray-300" />
                    <h3 className="text-sm font-semibold text-gray-800">
                      {filtered ? 'No matching products' : 'No active tenant listings yet'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {filtered
                        ? 'Try another search or clear the filters.'
                        : 'Tenant listings appear here once they are active.'}
                    </p>
                    {filtered && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft('');
                          setFilters(emptyFilters);
                        }}
                        className="min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-gray-700"
                      >
                        Reset search and filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,266px),266px))] gap-3">
                    {visible.map((row) => (
                      <BuilderCatalogCard
                        key={row._id}
                        row={row}
                        onAdd={(r) =>
                          setPicker({
                            productId: r.product!._id,
                            productName: r.product!.name || 'Product',
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
            <footer className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <p className="text-xs text-gray-500">
                  {pagination?.total
                    ? `${(pagination.page - 1) * PAGE_SIZE + 1}–${Math.min(pagination.page * PAGE_SIZE, pagination.total)} of ${pagination.total}`
                    : '0 products'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous catalogue page"
                    disabled={loading || !pagination?.hasPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"
                  >
                    <PiCaretLeft />
                  </button>
                  <span className="text-xs text-gray-600">
                    Page {pagination?.page || 1} of {pagination?.pages || 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Next catalogue page"
                    disabled={loading || !pagination?.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"
                  >
                    <PiCaretRight />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  {summary.lines} line{summary.lines !== 1 ? 's' : ''} in order{' '}
                  <span className="text-xs font-normal text-gray-500">· {summary.units} units</span>
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Done
                </button>
              </div>
            </footer>
          </DialogPanel>
        </div>
      </Dialog>
      <BuilderTenantPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        token={token}
        productId={picker?.productId ?? null}
        productName={picker?.productName ?? ''}
        onAdd={onAdd}
      />
    </>
  );
}
