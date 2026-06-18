'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiTrash,
  PiMagnifyingGlass,
  PiFloppyDisk,
  PiCheck,
  PiArrowLeft,
  PiCaretRight,
  PiWarning,
  PiX,
  PiWarehouse,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { stockTransferService } from '@/services/stockTransfer.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { posApi } from '@/app/shared/point-of-sale/api';
import { subproductService } from '@/services/subproduct.service';

// ─── types ────────────────────────────────────────────────────

interface SizeOption {
  size: string;
  displayName?: string;
  sku?: string;
  availableStock?: number;
  unitsPerPack?: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  sellWithoutSizeVariants?: boolean;
  sizes: SizeOption[];
}

interface LineItem {
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
}

// ─── constants ────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

// ─── helpers ─────────────────────────────────────────────────

function blankItem(): LineItem {
  return { subProductId: '', subProductName: '', sku: '', quantity: 1 };
}

// ─── WarehouseSelector ────────────────────────────────────────

function WarehouseSelector({
  label,
  selected,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  selected: Warehouse | null;
  options: Warehouse[];
  onSelect: (w: Warehouse) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <PiWarehouse className="h-5 w-5 shrink-0 text-[#b20202]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {selected.name}
          </p>
          <p className="text-xs text-gray-500">
            {selected.code} · {selected.type.replace('_', ' ')}
            {selected.isDefault ? ' · Default' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 text-left ${INPUT_CLS}`}
      >
        <PiWarehouse className="h-4 w-4 text-gray-400" />
        <span className="flex-1 text-gray-400">Select {label}…</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">
                No warehouses available
              </p>
            ) : (
              options.map((w) => (
                <button
                  key={w._id}
                  type="button"
                  onMouseDown={() => {
                    onSelect(w);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <PiWarehouse className="h-4 w-4 shrink-0 text-[#b20202]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {w.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {w.code} · {w.type.replace('_', ' ')}
                    </p>
                  </div>
                  {w.isDefault && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                      Default
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProductSearch ─────────────────────────────────────────────

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

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapProducts(raw: any[]): ProductOption[] {
    return raw.map((sp: any) => ({
      _id: sp._id,
      name: sp.product?.name ?? sp.name ?? sp.productName ?? '',
      sku: sp.sku ?? '',
      sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
      sizes: (sp.sizes ?? []).map((s: any) => ({
        size: String(s._id ?? s.size ?? ''),
        displayName: s.displayName ?? s.size ?? '',
        sku: s.sku ?? sp.sku ?? '',
        availableStock: s.availableStock ?? s.stock ?? 0,
        unitsPerPack: s.unitsPerPack ?? 1,
      })),
    }));
  }

  async function fetchFullSubproduct(id: string) {
    if (expandedData[id]) return;
    try {
      const res = await subproductService.getSubProduct(id, token);
      const sp = res?.data ?? res;
      setExpandedData((prev) => ({ ...prev, [id]: sp }));
    } catch {
      // ignore
    }
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
        setProducts(mapProducts(res?.products ?? []));
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
                : 'No products yet'}
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
                          onSelect(p.name, p.sku, p._id);
                          setQuery(p.name);
                          setOpen(false);
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
                      {hasSizes && (
                        <PiCaretRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      )}
                    </button>

                    {hasSizes && isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/60 pb-1 pl-4 pt-1">
                        {p.sizes.map((s) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const fullSizes: any[] =
                            expandedData[p._id]?.sizes ?? [];
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const match = fullSizes.find(
                            (fs: any) => fs._id === s.size || fs.size === s.size
                          );
                          const displaySize =
                            match?.displayName ?? s.displayName ?? s.size;
                          const stock =
                            match?.availableStock ?? s.availableStock ?? 0;
                          return (
                            <button
                              key={s.size}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const label = `${p.name} – ${displaySize}`;
                                onSelect(
                                  label,
                                  s.sku ?? p.sku,
                                  p._id,
                                  s.size,
                                  displaySize
                                );
                                setQuery(label);
                                setOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-800">
                                  {displaySize}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2">
                                  {s.sku && (
                                    <span className="font-mono text-[10px] text-gray-400">
                                      {s.sku}
                                    </span>
                                  )}
                                  {stock > 0 ? (
                                    <span className="text-[10px] text-emerald-600">
                                      {stock} in stock
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">
                                      Out of stock
                                    </span>
                                  )}
                                </div>
                              </div>
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
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────

export default function StockTransferCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceWarehouse, setSourceWarehouse] = useState<Warehouse | null>(
    null
  );
  const [destWarehouse, setDestWarehouse] = useState<Warehouse | null>(null);
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((res) => setWarehouses(res.data ?? []))
      .catch(() => toast.error('Failed to load warehouses'));
  }, [token]);

  const sourceOptions = warehouses.filter(
    (w) => !destWarehouse || w._id !== destWarehouse._id
  );
  const destOptions = warehouses.filter(
    (w) => !sourceWarehouse || w._id !== sourceWarehouse._id
  );

  const addItem = useCallback(() => setItems((p) => [...p, blankItem()]), []);
  const removeItem = useCallback(
    (i: number) => setItems((p) => p.filter((_, idx) => idx !== i)),
    []
  );
  const updateItem = useCallback((index: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }, []);

  const hasItems = items.some((it) => it.subProductId.trim());

  async function handleSave(confirm = false) {
    const filled = items.filter((it) => it.subProductId.trim());
    if (!sourceWarehouse) return toast.error('Select a source warehouse');
    if (!destWarehouse) return toast.error('Select a destination warehouse');
    if (sourceWarehouse._id === destWarehouse._id)
      return toast.error('Source and destination must be different');
    if (filled.length === 0)
      return toast.error('Add at least one product line');
    const badQty = filled.find((it) => !(it.quantity > 0));
    if (badQty)
      return toast.error(
        `Quantity for "${badQty.subProductName}" must be at least 1`
      );

    setSaving(true);
    try {
      const res = await stockTransferService.create(
        {
          sourceWarehouse: sourceWarehouse._id,
          destinationWarehouse: destWarehouse._id,
          items: filled.map((it) => ({
            subProductId: it.subProductId,
            subProductName: it.subProductName,
            sku: it.sku,
            sizeId: it.sizeId,
            sizeName: it.sizeName,
            quantity: it.quantity,
          })),
          notes: notes || undefined,
          scheduledDate: scheduledDate || undefined,
          status: confirm ? 'confirmed' : 'draft',
        },
        token
      );
      toast.success(confirm ? 'Transfer confirmed' : 'Saved as draft');
      router.push(routes.eCommerce.stockTransferDetails(res.data._id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.stockTransfers}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Stock Transfers
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Transfer</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New Stock Transfer
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Choose warehouses, add product lines, then save or confirm.
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
            {saving ? 'Saving…' : 'Confirm Transfer'}
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
            href={routes.eCommerce.stockTransfers}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        {/* Transfer Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">
            Transfer Details
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Source Warehouse
              </label>
              <WarehouseSelector
                label="source warehouse"
                selected={sourceWarehouse}
                options={sourceOptions}
                onSelect={setSourceWarehouse}
                onClear={() => setSourceWarehouse(null)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Destination Warehouse
              </label>
              <WarehouseSelector
                label="destination warehouse"
                selected={destWarehouse}
                options={destOptions}
                onSelect={setDestWarehouse}
                onClear={() => setDestWarehouse(null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Scheduled Date{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Notes{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                placeholder="Reason for transfer…"
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>

        {/* Transfer Lines */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Transfer Lines
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
            {items.map((item, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <ProductSearch
                      value={item.subProductName}
                      token={token}
                      onSelect={(name, sku, subProductId, sizeId, sizeName) =>
                        updateItem(i, {
                          subProductId,
                          subProductName: name,
                          sku,
                          sizeId,
                          sizeName,
                        })
                      }
                    />
                  </div>
                  <div className="w-28 shrink-0">
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
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="mt-5 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                  >
                    <PiTrash className="h-4 w-4" />
                  </button>
                </div>
                {item.sku && (
                  <p className="ml-8 mt-1 font-mono text-[10px] text-gray-400">
                    {item.sku}
                  </p>
                )}
              </div>
            ))}
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

        {/* Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Lines</span>
              <span className="font-medium text-gray-900">
                {items.filter((it) => it.subProductId).length}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total Units</span>
              <span className="font-medium text-gray-900">
                {items
                  .filter((it) => it.subProductId)
                  .reduce((s, it) => s + it.quantity, 0)}
              </span>
            </div>
          </div>

          {(!sourceWarehouse || !destWarehouse) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Select source and destination warehouses before saving.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
