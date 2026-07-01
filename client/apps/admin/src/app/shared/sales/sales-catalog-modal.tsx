// client/apps/admin/src/app/shared/sales/sales-catalog-modal.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PiMagnifyingGlass, PiX, PiPlus, PiSpinner, PiCheck } from 'react-icons/pi';
import { subproductService } from '@/services/subproduct.service';
import { routes } from '@/config/routes';
import SalesCatalogCard, {
  type CatalogProduct,
  type CatalogSize,
} from './sales-catalog-card';
import {
  SalesCatalogFilters,
  SalesCatalogFiltersCompact,
  type FilterOption,
  type SortKey,
} from './sales-catalog-filters';
import type { ProductLineSelection } from './product-line-search';

/** Pick the best image URL and (for Cloudinary) request a small, optimized
 *  derivative instead of the full-resolution original. */
function pickImage(sp: any): string | undefined {
  const override = (sp.imagesOverride || []).find((i: any) => i.url);
  const productImages = sp.product?.images || [];
  const primary =
    override ||
    productImages.find((i: any) => i.isPrimary && i.url) ||
    productImages[0];
  const url: string | undefined = primary?.url;
  if (!url) return undefined;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/c_fill,w_400,h_400,q_auto,f_auto,g_auto/');
  }
  return url;
}

/** Turn a snake_case beverage type into a readable label. */
function prettyType(t: string): string {
  return t
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapProducts(raw: any[]): CatalogProduct[] {
  return raw.map((sp: any) => ({
    _id: sp._id,
    productId: sp.product?._id ?? sp.product,
    name: sp.product?.name ?? sp.name ?? '',
    sku: sp.sku ?? '',
    image: pickImage(sp),
    type: sp.product?.type ?? undefined,
    brand: sp.product?.brand?.name ?? undefined,
    brandId: sp.product?.brand?._id ?? undefined,
    category: sp.product?.category?.name ?? undefined,
    categoryId: sp.product?.category?._id ?? undefined,
    isAlcoholic: sp.product?.isAlcoholic ?? undefined,
    abv: sp.product?.abv ?? undefined,
    baseSellingPrice: sp.baseSellingPrice ?? 0,
    costPrice: sp.costPrice ?? 0,
    taxRate: sp.taxRate ?? 0,
    totalStock: sp.totalStock ?? undefined,
    availableStock: sp.availableStock ?? undefined,
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    bundleDeals: sp.bundleDeals ?? [],
    sizes: (sp.sizes ?? []).map((s: any): CatalogSize => ({
      size: String(s._id ?? s.size ?? ''),
      displayName: s.displayName ?? s.size ?? '',
      sku: s.sku ?? sp.sku ?? '',
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: s.costPrice ?? sp.costPrice ?? 0,
      availableStock: s.availableStock ?? s.stock ?? 0,
    })),
  }));
}

interface AddedRecord {
  subProductId: string;
  name: string;
  qty: number;
  at: number;
}

/** Per-line quantity in the order, keyed by `subProductId|sizeId` (sizeId
 *  empty for sizeless). 0 / absent means the line is not in the order. */
export type CatalogQtyMap = Record<string, number>;

export interface SalesCatalogModalProps {
  open: boolean;
  token: string;
  /** Active pricelist for effective-price display on cards (null = base). */
  pricelist?: unknown;
  /** Live line quantities from the order, so each card can show its qty stepper
   *  once added and switch the Add button into a stepper + remove control. */
  qtyMap: CatalogQtyMap;
  onClose: () => void;
  /** Add a new line (qty 1). */
  onAdd: (selection: ProductLineSelection) => void;
  /** Set the quantity of an existing line (clamped ≥1; 0 → remove). */
  onSetQty: (selection: ProductLineSelection, quantity: number) => void;
  /** Remove a line entirely. */
  onRemove: (selection: ProductLineSelection) => void;
}

/**
 * Full-catalogue picker for the Sales create page. A large modal with a search
 * header, a left filter sidebar (category / brand / beverage type as
 * multi-select checkbox lists + in-stock toggle + sort), and a responsive card
 * grid. Filters are OR within a group and AND across groups. Stale searches are
 * ignored via a request-token guard.
 */
export default function SalesCatalogModal({
  open,
  token,
  pricelist,
  qtyMap,
  onClose,
  onAdd,
  onSetQty,
  onRemove,
}: SalesCatalogModalProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, number>>({});
  const [addedLog, setAddedLog] = useState<AddedRecord[]>([]);

  // Multi-select filters (arrays of selected ids). In-stock + sort stay single.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('name');

  const bodyRef = useRef<HTMLDivElement>(null);
  // Request-token guard: only the latest fetch's response is applied.
  const reqIdRef = useRef(0);

  const load = useCallback(
    async (search: string) => {
      if (!token) return;
      const myId = ++reqIdRef.current;
      setLoading(true);
      try {
        const res = (await subproductService.getSubProducts(token, {
          search: search || undefined,
          limit: 60,
        })) as { data?: { subProducts?: any[] } };
        if (myId !== reqIdRef.current) return;
        setProducts(mapProducts(res?.data?.subProducts ?? []));
        setLoaded(true);
      } catch {
        if (myId !== reqIdRef.current) return;
        setProducts([]);
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    },
    [token]
  );

  // Load on open; reset transient state on close so reopening is clean.
  useEffect(() => {
    if (open) void load('');
    if (!open) {
      setQuery('');
      setSelectedCategories([]);
      setSelectedBrands([]);
      setSelectedTypes([]);
      setInStockOnly(false);
      setSort('name');
      setAddedIds({});
      setAddedLog([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps — only `open` should trigger; load() omitted to avoid reload on token change
  }, [open]);

  // Debounced search reload.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, open, load]);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Derived filter options from the loaded batch.
  const categories = useMemo<FilterOption[]>(() => {
    const set = new Map<string, string>();
    for (const p of products)
      if (p.category) set.set(p.categoryId ?? p.category, p.category);
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [products]);

  const brands = useMemo<FilterOption[]>(() => {
    const set = new Map<string, string>();
    for (const p of products) if (p.brand) set.set(p.brandId ?? p.brand, p.brand);
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [products]);

  const types = useMemo<FilterOption[]>(() => {
    const set = new Map<string, string>();
    for (const p of products)
      if (p.type) set.set(p.type, prettyType(p.type));
    return Array.from(set, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [products]);

  // Filtered + sorted list (OR within a group, AND across groups).
  const filtered = useMemo(() => {
    let list = products;
    if (selectedCategories.length)
      list = list.filter((p) =>
        selectedCategories.includes(p.categoryId ?? p.category ?? '')
      );
    if (selectedBrands.length)
      list = list.filter((p) =>
        selectedBrands.includes(p.brandId ?? p.brand ?? '')
      );
    if (selectedTypes.length)
      list = list.filter((p) => selectedTypes.includes(p.type ?? ''));
    if (inStockOnly)
      list = list.filter((p) => {
        const stock = p.sizes.length
          ? p.sizes.reduce((s, x) => s + (x.availableStock ?? 0), 0)
          : (p.availableStock ?? p.totalStock ?? 0);
        return stock > 0;
      });
    const sorted = [...list];
    switch (sort) {
      case 'priceAsc':
        sorted.sort((a, b) => (a.baseSellingPrice || 0) - (b.baseSellingPrice || 0));
        break;
      case 'priceDesc':
        sorted.sort((a, b) => (b.baseSellingPrice || 0) - (a.baseSellingPrice || 0));
        break;
      case 'stock':
        sorted.sort((a, b) => {
          const sa = a.sizes.length
            ? a.sizes.reduce((s, x) => s + (x.availableStock ?? 0), 0)
            : (a.availableStock ?? a.totalStock ?? 0);
          const sb = b.sizes.length
            ? b.sizes.reduce((s, x) => s + (x.availableStock ?? 0), 0)
            : (b.availableStock ?? b.totalStock ?? 0);
          return sb - sa;
        });
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [products, selectedCategories, selectedBrands, selectedTypes, inStockOnly, sort]);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function clearFilters() {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedTypes([]);
    setInStockOnly(false);
  }

  // `lineKey` matches the key used by sales-create's qtyMap: subProductId|sizeId.
  function lineKey(sel: ProductLineSelection) {
    return `${sel.subProductId}|${sel.sizeId ?? ''}`;
  }

  function handleAdd(sel: ProductLineSelection) {
    onAdd(sel);
    const id = lineKey(sel);
    setAddedIds((m) => ({ ...m, [id]: Date.now() }));
    setAddedLog((log) =>
      [
        { subProductId: id, name: sel.name, qty: 1, at: Date.now() },
        ...log.filter((x) => x.subProductId !== id),
      ].slice(0, 6)
    );
    setTimeout(() => {
      setAddedIds((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
    }, 1200);
  }

  function handleSetQty(sel: ProductLineSelection, quantity: number) {
    if (quantity <= 0) {
      onRemove(sel);
    } else {
      onSetQty(sel, quantity);
    }
  }

  function handleRemove(sel: ProductLineSelection) {
    onRemove(sel);
  }

  const addedCount = addedLog.reduce((s, x) => s + x.qty, 0);
  const showSidebar = products.length > 0 || loaded;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:p-4">
      <div className="flex w-full max-w-6xl flex-col bg-white shadow-xl sm:rounded-2xl">
        {/* Header — search only */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-gray-900">Catalogue</h2>
          <div className="relative ml-2 flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              autoFocus
            />
            {loading && (
              <PiSpinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Close"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body: sidebar + grid */}
        <div className="flex flex-1 overflow-hidden">
          {showSidebar && (
            <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50/50 p-4 sm:block">
              <SalesCatalogFilters
                categories={categories}
                brands={brands}
                types={types}
                selectedCategories={selectedCategories}
                selectedBrands={selectedBrands}
                selectedTypes={selectedTypes}
                inStockOnly={inStockOnly}
                sort={sort}
                resultCount={filtered.length}
                totalCount={products.length}
                onToggleCategory={(id) =>
                  setSelectedCategories((l) => toggle(l, id))
                }
                onToggleBrand={(id) => setSelectedBrands((l) => toggle(l, id))}
                onToggleType={(id) => setSelectedTypes((l) => toggle(l, id))}
                onInStockOnlyChange={setInStockOnly}
                onSortChange={setSort}
                onClear={clearFilters}
              />
            </aside>
          )}

          {/* Mobile filter bar */}
          {showSidebar && (
            <SalesCatalogFiltersCompact
              categories={categories}
              brands={brands}
              types={types}
              selectedCategories={selectedCategories}
              selectedBrands={selectedBrands}
              selectedTypes={selectedTypes}
              inStockOnly={inStockOnly}
              onToggleCategory={(id) =>
                setSelectedCategories((l) => toggle(l, id))
              }
              onToggleBrand={(id) => setSelectedBrands((l) => toggle(l, id))}
              onToggleType={(id) => setSelectedTypes((l) => toggle(l, id))}
              onInStockOnlyChange={setInStockOnly}
            />
          )}

          {/* Grid */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 sm:p-5">
            {!loading && filtered.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-gray-400">
                <p className="text-sm">
                  {loaded
                    ? query.trim() ||
                      selectedCategories.length ||
                      selectedBrands.length ||
                      selectedTypes.length ||
                      inStockOnly
                      ? 'No products match your filters.'
                      : 'No products in your catalogue yet.'
                    : 'Loading…'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => {
                  // Sizeless quantity + per-size quantity from the live qtyMap.
                  const sizelessQty = qtyMap[`${p._id}|`] ?? 0;
                  const sizeQuantities: Record<string, number> = {};
                  for (const s of p.sizes)
                    sizeQuantities[s.size] = qtyMap[`${p._id}|${s.size}`] ?? 0;
                  return (
                    <SalesCatalogCard
                      key={p._id}
                      product={p}
                      pricelist={pricelist}
                      justAdded={!!addedIds[`${p._id}|`]}
                      quantity={sizelessQty}
                      sizeQuantities={sizeQuantities}
                      onAdd={handleAdd}
                      onSetQty={handleSetQty}
                      onRemove={handleRemove}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: added tray + actions */}
        <div className="border-t border-gray-200 px-4 py-3 sm:px-5">
          {addedLog.length > 0 && (
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-gray-500">
                Added ({addedCount}):
              </span>
              {addedLog.map((a) => (
                <span
                  key={a.at}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                >
                  <PiCheck className="h-3 w-3" />
                  {a.name}
                  {a.qty > 1 ? ` ×${a.qty}` : ''}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <a
              href={routes.eCommerce.createSubProduct}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <PiPlus className="h-3.5 w-3.5" /> Create new product
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}