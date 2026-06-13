'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiPlus,
  PiTrash,
  PiMagnifyingGlass,
  PiFloppyDisk,
  PiCheck,
  PiArrowLeft,
  PiX,
  PiCaretDown,
  PiWarning,
  PiCaretRight,
  PiStorefront,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { vendorService } from '@/services/vendor.service';
import { posApi } from '@/app/shared/point-of-sale/api';
import { subproductService } from '@/services/subproduct.service';
import { CURRENCIES } from './types';
import type { Vendor } from './types';
import BaseCurrencyEquivalent from './base-currency-equivalent';
import PackSizeInput from './pack-size-input';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SizeOption {
  size: string;
  displayName?: string;
  sku?: string;
  costPrice?: number | null;
  unitsPerPack?: number;
  availableStock?: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  platformCostPrice?: number;
  sellWithoutSizeVariants?: boolean;
  sizes: SizeOption[];
}

interface LineItem {
  subProductId: string;
  productName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  packPrice: number;
  type: string;
  uom: string;
  taxRate: number;
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
  onSelect,
}: {
  value: string;
  token: string;
  onSelect: (
    name: string,
    sku: string,
    unitPrice: number,
    packSize: number,
    subProductId: string,
    sizeId?: string,
    sizeName?: string
  ) => void;
}) {
  const [query, setQuery] = useState(value);
  const [initial, setInitial] = useState<ProductOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedData, setExpandedData] = useState<Record<string, any>>({});
  const ref = useRef<HTMLDivElement>(null);

  async function fetchFullSubproduct(id: string) {
    if (expandedData[id]) return;
    try {
      const res = await subproductService.getSubProduct(id, token);
      const sp = res?.data ?? res;
      setExpandedData((prev) => ({ ...prev, [id]: sp }));
    } catch {
      // leave unitsPerPack as 1 if fetch fails
    }
  }

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapProducts(raw: any[]): ProductOption[] {
    return raw.map((sp: any) => ({
      _id: sp._id,
      name: sp.product?.name ?? sp.name ?? sp.productName ?? '',
      sku: sp.sku ?? '',
      platformCostPrice: sp.costPrice ?? sp.platformCostPrice ?? 0,
      sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
      sizes: (sp.sizes ?? []).map((s: any) => ({
        size: String(s._id ?? s.size ?? ''),
        displayName: s.displayName ?? s.size ?? '',
        sku: s.sku ?? sp.sku ?? '',
        costPrice: s.costPrice ?? sp.costPrice ?? 0,
        unitsPerPack: s.unitsPerPack ?? 1,
        availableStock: s.availableStock ?? s.stock ?? 0,
      })),
    }));
  }

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const res = await posApi.getProducts(token, { limit: 8 });
      const list = mapProducts(res?.products ?? []);
      setInitial(list);
      setProducts(list);
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
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await posApi.getProducts(token, {
          search: query.trim(),
          limit: 8,
        });
        const list = mapProducts(res?.products ?? []);
        setProducts(list);
        setExpandedId(null);
      } catch {
        setProducts([]);
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
    onSelect(
      label,
      s.sku ?? p.sku,
      s.costPrice ?? 0,
      s.unitsPerPack ?? 1,
      p._id,
      s.size, // sizeId (the MongoDB _id of the Size doc)
      displaySize // sizeName for backend enrichment
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
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-pulse text-[10px] text-gray-400">
            …
          </span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {products.length === 0 && !loading ? (
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
                            {(p.platformCostPrice ?? 0).toFixed(2)}
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
                              match?.unitsPerPack ?? s.unitsPerPack ?? 1,
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
                                  {(s.costPrice ?? 0).toFixed(2)}
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

  const addItem = useCallback(() => setItems((p) => [...p, blankItem()]), []);
  const removeItem = useCallback(
    (i: number) => setItems((p) => p.filter((_, idx) => idx !== i)),
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

  const handleProductSelect = useCallback(
    (
      index: number,
      name: string,
      sku: string,
      unitPrice: number,
      packSize: number,
      subProductId: string,
      sizeId?: string,
      sizeName?: string
    ) => {
      updateItem(index, {
        subProductId,
        productName: name,
        sku,
        unitPrice,
        packSize,
        sizeId,
        sizeName,
      });
    },
    [updateItem]
  );

  const subtotal = items.reduce((s, it) => s + lineSubtotal(it), 0);
  const taxTotal = items.reduce((s, it) => s + lineTax(it), 0);
  const grandTotal = subtotal + taxTotal;
  const hasItems = items.some((it) => it.productName.trim());

  async function handleSave(confirm = false) {
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
      const payload = {
        vendor: vendor?._id,
        vendorName: vendor?.name,
        vendorReference: vendorReference || undefined,
        currency,
        expectedArrival: expectedArrival || undefined,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        termsConditions: termsConditions || undefined,
        items: filled.map((it) => ({
          ...it,
          subProductName: it.productName,
          unitCost: it.unitPrice,
          packagingQty: it.packSize,
          receivedQty: 0,
          totalCost: lineSubtotal(it),
        })),
        status: confirm ? 'confirmed' : 'draft',
      };
      const res = await purchaseOrderService.createPurchaseOrder(
        payload,
        token
      );
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
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Order Lines
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                <PiPlus className="h-3.5 w-3.5" /> Add Line
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((item, i) => {
                const sub = lineSubtotal(item);
                const tax = lineTax(item);
                const total = lineTotal(item);
                return (
                  <div key={i} className="px-5 py-4">
                    {/* Product search row */}
                    <div className="mb-3 flex items-start gap-3">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <ProductSearch
                          value={item.productName}
                          token={token}
                          onSelect={(
                            name,
                            sku,
                            unitPrice,
                            packSize,
                            subProductId,
                            sizeId,
                            sizeName
                          ) =>
                            handleProductSelect(
                              i,
                              name,
                              sku,
                              unitPrice,
                              packSize,
                              subProductId,
                              sizeId,
                              sizeName
                            )
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        className="mt-0.5 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                      >
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Line fields */}
                    <div className="ml-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(i, { quantity: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </div>
                      <PackSizeInput
                        value={item.packSize}
                        onApply={(patch) => updateItem(i, patch)}
                      />
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-gray-500">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(i, { unitPrice: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-gray-500">
                          Tax %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.taxRate}
                          onChange={(e) =>
                            updateItem(i, { taxRate: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-gray-500">
                          Line Total
                        </label>
                        <div className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                          <span className="text-xs font-semibold text-gray-800">
                            {currency} {total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {item.taxRate > 0 && (
                      <p className="ml-8 mt-1.5 text-[10px] text-gray-400">
                        Subtotal {currency} {sub.toFixed(2)} + Tax {currency}{' '}
                        {tax.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-medium text-[#b20202] hover:underline"
              >
                <PiPlus className="h-3.5 w-3.5" /> Add another line
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
                  {currency} {subtotal.toFixed(2)}
                </span>
              </div>
              {taxTotal > 0 && (
                <div className="flex items-center justify-between text-gray-600">
                  <span>Tax</span>
                  <span className="font-medium text-gray-900">
                    {currency} {taxTotal.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">
                    {currency} {grandTotal.toFixed(2)}
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
    </div>
  );
}
