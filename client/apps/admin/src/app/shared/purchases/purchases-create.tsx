'use client';

import { sizeVariantLabel } from '@/utils/size-variant-label';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiPlus,
  PiTrash,
  PiMagnifyingGlass,
  PiFloppyDisk,
  PiCheck,
  PiSpinner,
  PiArrowLeft,
  PiX,
  PiCaretDown,
  PiWarning,
  PiCaretRight,
  PiStorefront,
  PiCamera,
  PiBookmarkSimple,
  PiTextT,
  PiSquaresFour,
  PiDotsSixVertical,
} from 'react-icons/pi';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { useRestockPrefill, forgetRestockDraft } from './use-restock-prefill';
import { preparedPurchaseReference } from './restock-preparation';
import type { RestockDraft } from '../notifications/vendor-orders/order-draft';
import { vendorService } from '@/services/vendor.service';
import { subproductService } from '@/services/subproduct.service';
import {
  CURRENCIES,
  defaultPackagingForLine,
  fmtAmount,
  packsLabel,
} from './types';
import type { Vendor } from './types';
import BaseCurrencyEquivalent from './base-currency-equivalent';
import PackSizeInput from './pack-size-input';
import NumberInput from '@/components/ui/number-input';
import { moveItem } from './line-dnd';
import WarehouseSelect, {
  useActiveWarehouses,
  useSeededWarehouse,
} from './warehouse-select';
import PurchasesScanDrawer from './purchases-scan-drawer';
import {
  appendScannedLines,
  type PurchaseLineDraft,
} from './purchases-scan-selection';
import {
  appendPresentationLine,
  catalogQtyMap,
  catalogDraftFromSelection,
  computeSectionSubtotals,
  derivePurchasePack,
  lineTypeOf,
  purchasePayloadLines,
  type PurchaseLine,
  type PurchaseLineType,
} from './purchases-create-lines';
import ProductSearchSkeleton from './product-search-skeleton';
import type { ProductLineSelection } from '../sales/product-line-search';

const PurchasesCatalogModal = dynamic(
  () => import('./purchases-catalog-modal'),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
      >
        <span className="rounded-xl bg-white p-5 text-sm text-gray-700">
          Opening product catalogue…
        </span>
      </div>
    ),
  }
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface SizeOption {
  size: string;
  displayName?: string;
  sku?: string;
  costPrice?: number | null;
  unitsPerPack?: number;
  availableStock?: number;
  // Retail variant identity — present only on non-beverage Size rows. Buying
  // rows carry it through so the line gets its packaging default at entry.
  colorName?: string | null;
  optionName?: string | null;
  unitType?: string | null;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  platformCostPrice?: number;
  sellWithoutSizeVariants?: boolean;
  sizes: SizeOption[];
}

interface LineItem extends PurchaseLine {
  // Presentation identity (lineType/name/description) comes from the base
  // type: 'product' lines are catalog-linked purchases; 'section' lines
  // carry a bold title with no qty/price; 'note' lines are standalone text.
  type: string;
  uom: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function blankItem(): LineItem {
  return {
    subProductId: '',
    productName: '',
    sku: '',
    quantity: 1,
    packSize: 1,
    packQty: 1,
    unitPrice: 0,
    packPrice: 0,
    type: 'unit',
    uom: 'unit',
    taxRate: 0,
  };
}

/**
 * Presentation blank ("Add a section"/"Add a note"): no product, no qty, no
 * price — zeroed so totals, receiving and billing never see it.
 */
function blankPresentationItem(type: PurchaseLineType): LineItem {
  if (type === 'product') return blankItem();
  return {
    subProductId: '',
    productName: '',
    sku: '',
    quantity: 0,
    packSize: 1,
    packQty: 0,
    unitPrice: 0,
    packPrice: 0,
    // Nominal non-product fields kept for the LineItem shape; presentation
    // lines carry no packaging/uom semantics.
    type: 'unit',
    uom: 'unit',
    taxRate: 0,
    lineType: type,
    ...(type === 'section' ? { name: '' } : { description: '' }),
  };
}

function lineSubtotal(item: LineItem) {
  return item.unitPrice * item.quantity;
}

function lineTax(item: LineItem) {
  return lineSubtotal(item) * (item.taxRate / 100);
}

function lineTotal(item: LineItem) {
  return lineSubtotal(item) + lineTax(item);
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function paymentTermLabel(t: string) {
  return t.replace('_', ' ').replace('net', 'Net');
}

// ─── Vendor Search ────────────────────────────────────────────────────────────

function VendorSearch({
  token,
  selected,
  onSelect,
  onClear,
}: {
  token: string;
  selected: Vendor | null;
  onSelect: (v: Vendor) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [initial, setInitial] = useState<Vendor[]>([]);
  const [results, setResults] = useState<Vendor[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const list = await vendorService.getAll(token);
      const limited = list.slice(0, 8);
      setInitial(limited);
      setResults(limited);
      setInitialLoaded(true);
    } catch {
      setInitial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (query.trim().length < 2) {
      setResults(initial);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await vendorService.search(query, token);
        setResults(res.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token, initial]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-sm font-bold text-[#b20202]">
          {initials(selected.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {selected.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {selected.email && (
              <span className="text-xs text-gray-500">{selected.email}</span>
            )}
            {selected.phone && (
              <span className="text-xs text-gray-500">{selected.phone}</span>
            )}
            {selected.paymentTerms && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {paymentTermLabel(selected.paymentTerms)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Change vendor"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(false);
          }}
          onFocus={() => {
            ensureInitial();
            setOpen(true);
          }}
          placeholder="Search vendors…"
          className={`pl-9 pr-9 ${INPUT_CLS}`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            …
          </span>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.length === 0 && !loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <PiStorefront className="h-4 w-4" />
              {query.trim().length >= 2
                ? `No vendors match "${query}"`
                : 'No vendors in your account yet'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {results.map((v) => (
                <button
                  key={v._id}
                  type="button"
                  onMouseDown={() => {
                    onSelect(v);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-xs font-bold text-[#b20202]">
                    {initials(v.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {v.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {v.email && (
                        <span className="truncate text-xs text-gray-400">
                          {v.email}
                        </span>
                      )}
                      {v.paymentTerms && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                          {paymentTermLabel(v.paymentTerms)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-gray-100">
            <a
              href={routes.eCommerce.purchaseVendors}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#b20202] hover:bg-gray-50"
            >
              <PiPlus className="h-4 w-4" />
              Add new vendor
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Product + Size Search ────────────────────────────────────────────────────

function ProductSearch({
  value,
  token,
  packSizeOverrides,
  onSelect,
}: {
  value: string;
  token: string;
  /** sizeId → unitsPerPack committed as the size's new default this session
   *  (pack size edited on a line); wins over any cached fetch. */
  packSizeOverrides?: Record<string, number>;
  onSelect: (
    name: string,
    sku: string,
    unitPrice: number,
    packSize: number,
    subProductId: string,
    sizeId?: string,
    sizeName?: string,
    packaging?: string
  ) => void;
}) {
  const [query, setQuery] = useState(value);
  const [initial, setInitial] = useState<ProductOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** The query the current `products` list answers. When the typed query has
   *  drifted from this (debounce pending or fetch in flight), the dropdown
   *  shows the searching skeleton instead of a stale/empty mislabel. */
  const [resultsFor, setResultsFor] = useState('');
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, any>>({});
  // True once the operator has typed past the catalog snapshot (a fresh server
  // search is due) or a fetch is in flight.
  const searching =
    loading || (query.trim().length >= 2 && resultsFor !== query.trim());
  const ref = useRef<HTMLDivElement>(null);

  async function fetchFullSubproduct(id: string) {
    if (expandedData[id]) return;
    try {
      const res = await subproductService.getSubProduct<{data: unknown}>(id, token);
      const sp = res?.data ?? res;
      setExpandedData((prev) => ({ ...prev, [id]: sp }));
    } catch {
      // leave unitsPerPack as 1 if fetch fails
    }
  }

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function mapProducts(raw: any[]): ProductOption[] {
    return raw.map((sp: any) => ({
      _id: sp._id,
      name: sp.product?.name ?? sp.name ?? sp.productName ?? '',
      sku: sp.sku ?? '',
      platformCostPrice: sp.costPrice ?? sp.platformCostPrice ?? 0,
      sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
      sizes: (sp.sizes ?? []).map((s: any) => ({
        size: String(s._id ?? s.size ?? ''),
        displayName: sizeVariantLabel(s),
        sku: s.sku ?? sp.sku ?? '',
        costPrice: s.costPrice ?? sp.costPrice ?? 0,
        unitsPerPack: s.unitsPerPack ?? 1,
        availableStock: s.availableStock ?? s.stock ?? 0,
        colorName: s.colorName ?? undefined,
        optionName: s.optionName ?? undefined,
        unitType: s.unitType ?? undefined,
      })),
    }));
  }

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const res = await subproductService.getSubProducts<{data: {subProducts: unknown[]}}>(token, { limit: 50 });
      const list = mapProducts(res?.data?.subProducts ?? []);
      setInitial(list);
      setProducts(list);
      setResultsFor('');
      setInitialLoaded(true);
    } catch {
      setInitial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (query.trim().length < 2) {
      setProducts(initial);
      setResultsFor('');
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await subproductService.getSubProducts<{data: {subProducts: unknown[]}}>(token, {
          search: query.trim(),
          limit: 50,
        });
        const list = mapProducts(res?.data?.subProducts ?? []);
        setProducts(list);
        setResultsFor(query.trim());
        setExpandedId(null);
      } catch {
        setProducts([]);
        setResultsFor(query.trim());
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token, initial]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pickSizeless(p: ProductOption) {
    onSelect(p.name, p.sku, p.platformCostPrice ?? 0, 1, p._id);
    setQuery(p.name);
    setOpen(false);
  }

  function pickSize(p: ProductOption, s: SizeOption) {
    const displaySize = s.displayName ?? s.size;
    const label = `${p.name} – ${displaySize}`;
    const unitsPerPack =
      packSizeOverrides?.[s.size] ?? s.unitsPerPack ?? 1;
    onSelect(
      label,
      s.sku ?? p.sku,
      s.costPrice ?? 0,
      unitsPerPack,
      p._id,
      s.size, // sizeId (the MongoDB _id of the Size doc)
      displaySize, // sizeName for backend enrichment
      defaultPackagingForLine(s) // packaging default ('units'/'pieces' retail rows)
    );
    setQuery(label);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpandedId(null);
          }}
          onFocus={() => {
            ensureInitial();
            setOpen(true);
          }}
          placeholder="Search product…"
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
        />
        {loading && (
          <PiSpinner
            aria-hidden
            className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400"
          />
        )}
      </div>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {searching ? (
            <ProductSearchSkeleton rows={5} compact />
          ) : products.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400">
              {query.trim().length >= 2
                ? `No products match "${query}"`
                : 'No products in your catalogue yet'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {products.map((p) => {
                const hasSizes =
                  !p.sellWithoutSizeVariants && p.sizes.length > 0;
                const isExpanded = expandedId === p._id;

                return (
                  <div key={p._id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (hasSizes) {
                          const next = isExpanded ? null : p._id;
                          setExpandedId(next);
                          if (next) fetchFullSubproduct(next);
                        } else {
                          pickSizeless(p);
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-900">
                          {p.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {p.sku && (
                            <span className="font-mono text-[10px] text-gray-400">
                              {p.sku}
                            </span>
                          )}
                          {hasSizes && (
                            <span className="text-[10px] text-gray-400">
                              {p.sizes.length} size
                              {p.sizes.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasSizes ? (
                        <PiCaretRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      ) : (
                        (p.platformCostPrice ?? 0) > 0 && (
                          <span className="shrink-0 text-xs font-medium text-gray-600">
                            {fmtAmount(p.platformCostPrice ?? 0)}
                          </span>
                        )
                      )}
                    </button>

                    {/* Size options */}
                    {hasSizes && isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/60 pb-1 pl-4 pt-1">
                        {p.sizes.map((s) => {
                          const fullSizes: any[] =
                            expandedData[p._id]?.sizes ?? [];
                          const match = fullSizes.find(
                            (fs: any) => fs.size === s.size || fs._id === s.size
                          );
                          const enriched: SizeOption = {
                            ...s,
                            unitsPerPack:
                              packSizeOverrides?.[s.size] ??
                              match?.unitsPerPack ??
                              s.unitsPerPack ??
                              1,
                          };
                          return (
                            <button
                              key={s.size}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                pickSize(p, enriched);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-800">
                                  {s.displayName ?? s.size}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2">
                                  {s.sku && (
                                    <span className="font-mono text-[10px] text-gray-400">
                                      {s.sku}
                                    </span>
                                  )}
                                  {(s.availableStock ?? 0) > 0 && (
                                    <span className="text-[10px] text-emerald-600">
                                      {s.availableStock} in stock
                                    </span>
                                  )}
                                  {s.availableStock === 0 && (
                                    <span className="text-[10px] text-gray-400">
                                      Out of stock
                                    </span>
                                  )}
                                </div>
                              </div>
                              {(s.costPrice ?? 0) > 0 && (
                                <span className="shrink-0 text-xs font-semibold text-gray-700">
                                  {fmtAmount(s.costPrice ?? 0)}
                                </span>
                              )}
                              {enriched.unitsPerPack &&
                                enriched.unitsPerPack > 1 && (
                                  <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">
                                    ×{enriched.unitsPerPack}
                                  </span>
                                )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-gray-100">
            <a
              href={routes.eCommerce.createSubProduct}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-[#b20202] hover:bg-gray-50"
            >
              <PiPlus className="h-3.5 w-3.5" />
              Create new product
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchasesCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const tenantId = (session?.user as { tenantId?: string })?.tenantId ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [currency, setCurrency] = useState('NGN');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [vendorReference, setVendorReference] = useState('');
  const [notes, setNotes] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Destination warehouse: where this order's goods are expected to land. Seeded
  // from the tenant's default receiving warehouse, then the isDefault flag.
  const [warehouseId, setWarehouseId] = useState('');
  const loadRestock = useCallback((draft: RestockDraft) => {
    setVendor({ _id: draft.vendorId, name: draft.vendorName });
    setCurrency(draft.currency);
    setWarehouseId(draft.warehouseId);
    setExpectedArrival(draft.expectedArrival || '');
    setItems(draft.items);
    setNotes('Prepared from Notifications restock recommendations. Review quantities and receiving warehouse before saving.');
  }, []);
  const resetRestock = useCallback(() => {
    setVendor(null);
    setCurrency('NGN');
    setWarehouseId('');
    setExpectedArrival('');
    setItems([blankItem()]);
    setNotes('');
  }, []);
  const restock = useRestockPrefill(token, `${session?.user?.id || ''}:${tenantId}`, loadRestock, resetRestock);
  const [settingWarehouse, setSettingWarehouse] = useState<
    string | undefined
  >();
  const {
    warehouses,
    loading: warehousesLoading,
    loaded,
  } = useActiveWarehouses(token);
  useSeededWarehouse(
    warehouses,
    loaded,
    warehouseId,
    setWarehouseId,
    settingWarehouse
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    purchaseOrderService
      .getPurchaseSettings(token)
      .then((res) => {
        if (cancelled) return;
        setSettingWarehouse(
          res.data?.purchaseSettings?.defaultReceivingWarehouse || ''
        );
      })
      // A missing setting is not an error — seeding just falls through to isDefault.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const addItem = useCallback(() => setItems((p) => [...p, blankItem()]), []);

  /** "Add a section" / "Add a note": an unfinished trailing product row stays
   *  *beneath* the new presentation line, mirroring the sales create form. */
  const addPresentationLine = useCallback(
    (type: 'section' | 'note') =>
      setItems((p) => appendPresentationLine(p, type, blankPresentationItem)),
    []
  );

  /** One accepted row from the Scan & Match drawer. Called once per row, so the
   *  first call consumes the form's seeded blank line and the rest append. */
  const addScannedLine = useCallback((line: PurchaseLineDraft) => {
    setItems((p) => appendScannedLines(p, [line], blankItem));
  }, []);
  const removeItem = useCallback(
    (i: number) => setItems((p) => p.filter((_, idx) => idx !== i)),
    []
  );

  // ── Catalogue selection → line list ────────────────────────────────────────
  const catalogQuantities = useMemo(() => catalogQtyMap(items), [items]);

  const addProductFromCatalog = useCallback(
    (info: ProductLineSelection, qty = 1) => {
      const inc = Math.max(1, Math.round(qty));
      setItems((p) => {
        const idx = p.findIndex(
          (it) =>
            lineTypeOf(it) === 'product' &&
            it.subProductId === info.subProductId &&
            (it.sizeId ?? '') === (info.sizeId ?? '')
        );
        if (idx >= 0) {
          const next = [...p];
          next[idx] = derivePurchasePack({
            ...next[idx],
            quantity: next[idx].quantity + inc,
          });
          return next;
        }
        // appendScannedLines drops the trailing blank product row and appends
        // — a catalogue add behaves exactly like a Scan & Match accept.
        return appendScannedLines(
          p,
          [catalogDraftFromSelection(info, inc)],
          blankItem
        );
      });
    },
    []
  );

  const setCatalogLineQty = useCallback(
    (info: ProductLineSelection, quantity: number) => {
      setItems((p) =>
        p.map((it) =>
          lineTypeOf(it) === 'product' &&
          it.subProductId === info.subProductId &&
          (it.sizeId ?? '') === (info.sizeId ?? '')
            ? derivePurchasePack({
                ...it,
                quantity: Math.max(1, Math.round(quantity)),
              })
            : it
        )
      );
    },
    []
  );

  const removeCatalogLine = useCallback((info: ProductLineSelection) => {
    setItems((p) => {
      const kept = p.filter(
        (it) =>
          !(
            lineTypeOf(it) === 'product' &&
            it.subProductId === info.subProductId &&
            (it.sizeId ?? '') === (info.sizeId ?? '')
          )
      );
      return kept.length ? kept : [blankItem()];
    });
  }, []);

  // Line drag-to-reorder: HTML5 DnD, no library. dragIndex = card being
  // dragged; overIndex = card currently hovered for the drop.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const reorderLines = useCallback(
    (from: number, to: number) =>
      setItems((p) => moveItem(p, from, to)),
    []
  );

  const updateItem = useCallback((index: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        next.packPrice = next.unitPrice * next.packSize;
        next.packQty = Math.ceil(next.quantity / Math.max(1, next.packSize));
        return next;
      })
    );
  }, []);

  // ── Pack Size → size default persistence ───────────────────────────────────
  // When the operator edits a line's pack size, that value becomes the Size
  // document's new default packaging quantity (unitsPerPack) — persisted via
  // the size PATCH endpoint immediately on commit, with the pickers' pick-time
  // units-per-pack kept consistent through `packSizeOverrides` for the rest of
  // this session.
  const [packSizeOverrides, setPackSizeOverrides] = useState<
    Record<string, number>
  >({});
  const applyPackSizeDefault = useCallback(
    (index: number, value: number) => {
      const it = items[index];
      if (!it || lineTypeOf(it) !== 'product' || !it.sizeId) return;
      setPackSizeOverrides((prev) => ({ ...prev, [it.sizeId as string]: value }));
      subproductService
        .updateSize(it.subProductId, it.sizeId, { unitsPerPack: value }, token)
        .then(() =>
          toast.success(`Pack size ${value} saved as the default for this size`)
        )
        .catch((err: unknown) =>
          toast.error(
            err instanceof Error
              ? `Couldn't save the new size default: ${err.message}`
              : "Couldn't save the new size default"
          )
        );
    },
    [items, token]
  );

  const handleProductSelect = useCallback(
    (
      index: number,
      name: string,
      sku: string,
      unitPrice: number,
      packSize: number,
      subProductId: string,
      sizeId?: string,
      sizeName?: string,
      packaging?: string
    ) => {
      updateItem(index, {
        subProductId,
        productName: name,
        sku,
        unitPrice,
        packSize,
        sizeId,
        sizeName,
        packaging,
      });
    },
    [updateItem]
  );

  const subtotal = items.reduce((s, it) => s + lineSubtotal(it), 0);
  const taxTotal = items.reduce((s, it) => s + lineTax(it), 0);
  const grandTotal = subtotal + taxTotal;
  const hasItems = items.some((it) => it.productName.trim());
  // Section running subtotals: sum of the product lines beneath each section
  // until the next one (lines before the first section are ignored).
  const sectionSubtotals = useMemo(
    () => computeSectionSubtotals(items, lineSubtotal),
    [items]
  );
  // "Add a product" is gated until the buyer fills the empty row, exactly like
  // the sales form — prevents a pile of blank rows.
  const hasEmptyProductRow = items.some(
    (it) => lineTypeOf(it) === 'product' && !it.subProductId
  );

  async function handleSave(confirm = false) {
    if (restock.loading || restock.error) {
      toast.error(restock.error || 'Wait for current supplier terms to load');
      return;
    }
    const filled = items.filter((it) => it.productName.trim());
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    // The server requires vendorName and a catalog subProductId per item —
    // catch both here so the user gets a clear message instead of a 400.
    if (!vendor) {
      toast.error('Select a vendor before saving');
      return;
    }
    const unlinked = filled.find((it) => !it.subProductId);
    if (unlinked) {
      toast.error(
        `"${unlinked.productName}" isn't linked to a catalog product — pick it from the search dropdown`
      );
      return;
    }
    const badQty = filled.find((it) => !(it.quantity > 0));
    if (badQty) {
      toast.error(`Quantity for "${badQty.productName}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      const reference = restock.prepared ? preparedPurchaseReference(restock.prepared, {
        vendorId: vendor._id, currency, warehouseId, items: filled,
      }) : null;
      const payload = {
        ...(reference ? { restockPlan: reference } : {}),
        vendor: vendor?._id,
        vendorName: vendor?.name,
        vendorReference: vendorReference || undefined,
        currency,
        expectedArrival: expectedArrival || undefined,
        warehouse: warehouseId || undefined,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        termsConditions: termsConditions || undefined,
        items: purchasePayloadLines(items),
        status: confirm ? 'confirmed' : 'draft',
        // Wizard drafts are quotations: typed rfq so the detail page offers a
        // direct Confirm Order instead of the PO approval gate.
        ...(confirm ? {} : { type: 'rfq' }),
      };
      const res = await purchaseOrderService.createPurchaseOrder(
        payload,
        token
      );
      if (restock.reference) forgetRestockDraft(`${session?.user?.id || ''}:${tenantId}`);
      toast.success(
        confirm ? 'Purchase order confirmed' : 'Saved as draft RFQ'
      );
      router.push(routes.eCommerce.purchaseDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      {restock.loading && <p role="status" className="mb-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-700">Checking current supplier terms for this restock preparation…</p>}
      {restock.error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{restock.error} <Link href="/notifications/vendor-orders" className="font-bold underline">Review vendor orders</Link></p>}
      {restock.notice && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{restock.notice}</p>}
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.purchases}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Purchases
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">
          New Request for Quotation
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New Request for Quotation
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Add order lines, then save as a draft or confirm immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || !hasItems}
            className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiCheck className="h-4 w-4" />
            {saving ? 'Saving…' : 'Confirm Order'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !hasItems}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            Save as Draft
          </button>
          <Link
            href={routes.eCommerce.purchases}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        {/* ── Form cards ── */}
        <div className="space-y-5">
          {/* Order Details */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-800">
              Order Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Vendor */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Vendor
                </label>
                <VendorSearch
                  token={token}
                  selected={vendor}
                  onSelect={setVendor}
                  onClear={() => setVendor(null)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Vendor Reference
                </label>
                <input
                  value={vendorReference}
                  onChange={(e) => setVendorReference(e.target.value)}
                  placeholder="Vendor's own PO number"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Currency
                </label>
                <div className="relative">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={`appearance-none pr-8 ${INPUT_CLS}`}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Expected Arrival
                </label>
                <input
                  type="date"
                  value={expectedArrival}
                  onChange={(e) => setExpectedArrival(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="destination-warehouse"
                  className="mb-1 block text-xs font-medium text-gray-600"
                >
                  Destination Warehouse
                </label>
                <WarehouseSelect
                  warehouses={warehouses}
                  loading={warehousesLoading}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  noneLabel="Decide at receiving"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Where these goods are expected to land. The receiver can still
                  change it per delivery.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Valid Until{' '}
                  <span className="font-normal text-gray-400">
                    (quotation expiry)
                  </span>
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes…"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Terms &amp; Conditions
                </label>
                <textarea
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  rows={3}
                  placeholder="Payment and delivery terms…"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* Order Lines */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Order Lines
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((item, i) => {
                const sub = lineSubtotal(item);
                const tax = lineTax(item);
                const total = lineTotal(item);
                const type = lineTypeOf(item);
                return (
                  <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== i)
                          setOverIndex(i);
                      }}
                      onDragLeave={() => setOverIndex((v) => (v === i ? null : v))}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== i)
                          reorderLines(dragIndex, i);
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={`px-5 py-4 ${
                        type !== 'product'
                          ? type === 'section'
                            ? 'bg-gray-50/70'
                            : 'bg-amber-50/40'
                          : ''
                      } ${dragIndex === i ? 'opacity-40' : ''} ${overIndex === i && dragIndex !== null && dragIndex !== i ? 'ring-2 ring-[#b20202]/40 rounded-lg' : ''}`}
                    >
                    {/* Leading row: drag handle + badge (Number for products,
                        icon for section/note) + per-type body + remove. */}
                    <div className="ml-0 flex items-start gap-3">
                      <span
                        title="Drag to reorder"
                        className={`mt-1 shrink-0 cursor-grab active:cursor-grabbing ${
                          type === 'section'
                            ? 'text-gray-400 hover:text-gray-600'
                            : type === 'note'
                              ? 'text-amber-400 hover:text-amber-600'
                              : 'text-gray-300 hover:text-gray-500'
                        }`}
                      >
                        <PiDotsSixVertical className="h-5 w-5" />
                      </span>
                      {type !== 'product' ? (
                        <span
                          aria-hidden
                          className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-gray-500"
                        >
                          {type === 'section' ? (
                            <PiBookmarkSimple className="h-3 w-3" />
                          ) : (
                            <PiTextT className="h-3 w-3" />
                          )}
                        </span>
                      ) : (
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                          {i + 1}
                        </span>
                      )}

                      {type === 'section' ? (
                        /* Section heading row: editable bold title + the
                           running untaxed subtotal of the product lines
                           beneath it. No qty/price cells. */
                        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                          <input
                            type="text"
                            aria-label="Section title"
                            autoFocus={!item.name}
                            value={item.name ?? ''}
                            onChange={(e) =>
                              updateItem(i, { name: e.target.value })
                            }
                            placeholder="Section title"
                            className="min-w-0 flex-1 rounded-md border-0 border-b border-transparent bg-transparent px-1 py-1 text-sm font-bold text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-0"
                          />
                          <span className="text-[11px] font-medium text-gray-500">
                            Untaxed subtotal {currency}{' '}
                            {fmtAmount(sectionSubtotals.get(item) ?? 0)}
                          </span>
                        </div>
                      ) : type === 'note' ? (
                        /* Note row: standalone free text that prints on the
                           document. No product, qty or price. */
                        <div className="min-w-0 flex-1 pr-2">
                          <textarea
                            aria-label="Note text"
                            autoFocus={!item.description}
                            value={item.description ?? ''}
                            onChange={(e) =>
                              updateItem(i, { description: e.target.value })
                            }
                            placeholder="Add a note…"
                            rows={2}
                            className="w-full resize-y rounded-md border-0 bg-transparent px-1 py-1 text-xs text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-0"
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <ProductSearch
                            value={item.productName}
                            token={token}
                            packSizeOverrides={packSizeOverrides}
                            onSelect={(
                              name,
                              sku,
                              unitPrice,
                              packSize,
                              subProductId,
                              sizeId,
                              sizeName,
                              packaging
                            ) =>
                              handleProductSelect(
                                i,
                                name,
                                sku,
                                unitPrice,
                                packSize,
                                subProductId,
                                sizeId,
                                sizeName,
                                packaging
                              )
                            }
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        className="mt-0.5 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                      >
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Product line fields — presentation lines carry none. */}
                    {type === 'product' && (
                      <>
                        <div className="ml-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-gray-500">
                              SKU
                            </label>
                            <input
                              value={item.sku}
                              onChange={(e) =>
                                updateItem(i, { sku: e.target.value })
                              }
                              placeholder="—"
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-gray-500">
                              Qty
                            </label>
                            <NumberInput
                              min={1}
                              step="any"
                              value={item.quantity}
                              onCommit={(v) => updateItem(i, { quantity: v })}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                            />
                          </div>
                          <PackSizeInput
                            value={item.packSize}
                            onApply={(patch) => updateItem(i, patch)}
                            onCommitDefault={(v) => applyPackSizeDefault(i, v)}
                          />
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-gray-500">
                              Packs
                            </label>
                            <div className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                              <span className="text-xs font-semibold text-gray-800">
                                {packsLabel(item.quantity, item.packSize)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-gray-500">
                              Unit Price
                            </label>
                            <NumberInput
                              min={0}
                              step="0.01"
                              value={item.unitPrice}
                              onCommit={(v) => updateItem(i, { unitPrice: v })}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-gray-500">
                              Tax %
                            </label>
                            <NumberInput
                              min={0}
                              max={100}
                              step="any"
                              value={item.taxRate}
                              onCommit={(v) => updateItem(i, { taxRate: v })}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-gray-500">
                              Line Total
                            </label>
                            <div className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                              <span className="text-xs font-semibold text-gray-800">
                                {currency} {fmtAmount(total)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {item.taxRate > 0 && (
                          <p className="ml-8 mt-1.5 text-[10px] text-gray-400">
                            Subtotal {currency} {fmtAmount(sub)} + Tax {currency}{' '}
                            {fmtAmount(tax)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action bar — mirrors the sales create form (Add a product /
                section / note / Catalogue / Scan & Match). */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={addItem}
                disabled={hasEmptyProductRow}
                title={
                  hasEmptyProductRow
                    ? 'Select a product on the empty row first'
                    : undefined
                }
                className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PiPlus className="h-3.5 w-3.5" /> Add a product
              </button>
              <button
                type="button"
                onClick={() => addPresentationLine('section')}
                className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
              >
                <PiBookmarkSimple className="h-3.5 w-3.5" /> Add a section
              </button>
              <button
                type="button"
                onClick={() => addPresentationLine('note')}
                className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
              >
                <PiTextT className="h-3.5 w-3.5" /> Add a note
              </button>
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
              >
                <PiSquaresFour className="h-3.5 w-3.5" /> Catalogue
              </button>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                title="Photograph, upload or paste a vendor quotation"
                className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
              >
                <PiCamera className="h-3.5 w-3.5" /> Scan &amp; Match
              </button>
            </div>
          </div>
        </div>

        {/* ── Order Summary ── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-800">
              Order Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Lines</span>
                <span className="font-medium text-gray-900">
                  {items.filter((it) => it.productName.trim()).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">
                  {currency} {fmtAmount(subtotal)}
                </span>
              </div>
              {taxTotal > 0 && (
                <div className="flex items-center justify-between text-gray-600">
                  <span>Tax</span>
                  <span className="font-medium text-gray-900">
                    {currency} {fmtAmount(taxTotal)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">
                    {currency} {fmtAmount(grandTotal)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <BaseCurrencyEquivalent
                    amount={grandTotal}
                    currency={currency}
                  />
                </div>
              </div>
            </div>

            {vendor && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  Vendor
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {vendor.name}
                </p>
                {vendor.email && (
                  <p className="text-xs text-gray-500">{vendor.email}</p>
                )}
                {vendor.phone && (
                  <p className="text-xs text-gray-500">{vendor.phone}</p>
                )}
                {vendor.paymentTerms && (
                  <span className="mt-1.5 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {paymentTermLabel(vendor.paymentTerms)}
                  </span>
                )}
              </div>
            )}

            {!hasItems && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Add at least one product line before saving.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <PurchasesScanDrawer
        open={scanOpen}
        token={token}
        onClose={() => setScanOpen(false)}
        onAdd={addScannedLine}
      />

      <PurchasesCatalogModal
        open={catalogOpen}
        token={token}
        currency={currency}
        qtyMap={catalogQuantities}
        onClose={() => setCatalogOpen(false)}
        onAdd={addProductFromCatalog}
        onSetQty={setCatalogLineQty}
        onRemove={removeCatalogLine}
      />
    </div>
  );
}
