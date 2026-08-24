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
  PiDotsSixVertical,
  PiArrowLeft,
  PiCaretDown,
  PiWarning,
  PiX,
  PiWarehouse,
  PiArrowElbowRightDown,
  PiSpinner,
  PiPaperPlaneTilt,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { stockTransferService } from '@/services/stockTransfer.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { CURRENCIES, CURRENCY_SYMBOLS, packsLabel } from './types';
import { fmtCur } from './purchases-analytics-helpers';
import { computeTransferTotals } from './transfer-money';
import TransferTotalsCard from './transfer-totals-card';
import PackSizeInput from './pack-size-input';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** Where a line's default unit price came from — shown under the price input. */
type PriceSource = 'wholesale' | 'cost' | null;

interface LineItem {
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  sourceStock?: number;
  costPrice?: number;
  /** Destination purchase terms — what the destination pays the source. */
  discountRate: number;
  taxRate: number;
  /** Units per pack snapshot (Size.unitsPerPack) for the packs breakdown. */
  packSize: number;
  priceSource?: PriceSource;
}

interface LineError {
  duplicate?: string;
  exceedsStock?: string;
}

function blankItem(): LineItem {
  return {
    subProductId: '',
    subProductName: '',
    sku: '',
    quantity: 1,
    sourceStock: 0,
    costPrice: 0,
    discountRate: 0,
    taxRate: 0,
    packSize: 1,
    priceSource: null,
  };
}

function WarehouseSelector({
  label,
  selected,
  options,
  loading,
  onSelect,
  onClear,
}: {
  label: string;
  selected: Warehouse | null;
  options: Warehouse[];
  loading: boolean;
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
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
          <PiWarehouse className="h-4 w-4 text-emerald-600" />
        </div>
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
          className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-200/60 hover:text-gray-700"
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
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 text-left text-sm hover:border-gray-400 hover:bg-gray-50"
      >
        <PiWarehouse className="h-4 w-4 text-gray-400" />
        <span className="flex-1 text-gray-400">
          {loading ? 'Loading warehouses…' : `Select ${label}…`}
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">
                {loading ? 'Loading…' : 'No warehouses available'}
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
                  <PiWarehouse className="h-4 w-4 shrink-0 text-gray-400" />
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

/** One selectable line from the source warehouse's stock. */
interface StockRowOption {
  subProductId: string;
  sizeId?: string;
  sizeName?: string;
  name: string;
  sku: string;
  quantity: number;
  unitsPerPack: number;
  costPrice: number;
}

/**
 * Product picker fed by the SOURCE WAREHOUSE's stock — only items the source
 * can actually ship are selectable. Rows come from getWarehouseStock, which
 * carries names, SKUs, pack sizes and cost prices, so no second fetch is
 * needed and the catalogue-wide search is not offered by mistake.
 */
function SourceProductSearch({
  value,
  rows,
  loading,
  onSelect,
}: {
  value: string;
  rows: StockRowOption[];
  loading: boolean;
  onSelect: (row: StockRowOption) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const q = query.trim().toLowerCase();
  const inStock = rows.filter((r) => r.quantity > 0);
  const matches = (
    q
      ? inStock.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.sku.toLowerCase().includes(q)
        )
      : inStock
  ).slice(0, 20);

  return (
    <div className="relative" ref={ref}>
      <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <input
        value={open ? query : value}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={
          loading
            ? 'Loading source stock…'
            : 'Search products in the source warehouse…'
        }
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-sm focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400">
              {loading
                ? 'Loading…'
                : 'No stocked products in the source warehouse'}
            </p>
          ) : (
            matches.map((r) => (
              <button
                key={`${r.subProductId}::${r.sizeId || ''}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(r);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-gray-900">
                    {r.name}
                    {r.sizeName ? ` – ${r.sizeName}` : ''}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-gray-400">
                    {r.sku || '—'}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-emerald-600">
                  {r.quantity} in stock
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function StockTransferCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [sourceWarehouse, setSourceWarehouse] = useState<Warehouse | null>(
    null
  );
  const [destWarehouse, setDestWarehouse] = useState<Warehouse | null>(null);
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stockRows, setStockRows] = useState<StockRowOption[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    if (!token) return;
    setWarehousesLoading(true);
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((res) => setWarehouses(res.data ?? []))
      .catch(() => toast.error('Failed to load warehouses'))
      .finally(() => setWarehousesLoading(false));
  }, [token]);

  const sourceOptions = warehouses.filter(
    (w) => !destWarehouse || w._id !== destWarehouse._id
  );
  const destOptions = warehouses.filter(
    (w) => !sourceWarehouse || w._id !== sourceWarehouse._id
  );

  const stockKey = (subProductId: string, sizeId?: string) =>
    `${subProductId}::${sizeId || ''}`;

  const fetchStock = useCallback(
    async (warehouseId: string) => {
      if (!token) return;
      setLoadingStock(true);
      try {
        const res = await fetch(
          `${API_URL}/api/warehouses/${warehouseId}/stock`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const json = await res.json();
        const list: any[] = json?.data ?? [];
        const map: Record<string, number> = {};
        // Picker rows: one per stocked (subProduct, size) in the source
        // warehouse, with the name/sku/pack/cost fields the line needs.
        const rowMap = new Map<string, StockRowOption>();
        for (const row of list) {
          const sp =
            typeof row.subProduct === 'object' && row.subProduct
              ? row.subProduct
              : null;
          const spId = sp?._id ?? (typeof row.subProduct === 'string' ? row.subProduct : undefined);
          if (!spId) continue;
          const sz =
            typeof row.size === 'object' && row.size ? row.size : null;
          const szId =
            sz?._id ?? (typeof row.size === 'string' ? row.size : undefined);
          const qty = row.currentQuantity || 0;
          const k = stockKey(String(spId), szId ? String(szId) : undefined);
          map[k] = (map[k] || 0) + qty;
          const existing = rowMap.get(k);
          if (existing) {
            existing.quantity += qty;
            continue;
          }
          rowMap.set(k, {
            subProductId: String(spId),
            sizeId: szId ? String(szId) : undefined,
            sizeName: sz?.size ?? undefined,
            name: sp?.product?.name ?? sp?.sku ?? 'Product',
            sku: sp?.sku ?? '',
            quantity: qty,
            unitsPerPack:
              Number(sz?.unitsPerPack) > 0
                ? Math.floor(Number(sz.unitsPerPack))
                : 1,
            costPrice: Number(sz?.costPrice ?? sp?.costPrice ?? 0) || 0,
          });
        }
        setStockMap(map);
        setStockRows([...rowMap.values()]);
        setItems((prev) =>
          prev.map((it) => ({
            ...it,
            sourceStock: it.subProductId
              ? (map[stockKey(it.subProductId, it.sizeId)] ?? 0)
              : 0,
          }))
        );
      } catch {
        toast.error('Failed to load source stock');
      } finally {
        setLoadingStock(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (sourceWarehouse) {
      fetchStock(sourceWarehouse._id);
    } else {
      setStockMap({});
      setStockRows([]);
    }
  }, [sourceWarehouse, fetchStock]);

  function handleSourceChange(w: Warehouse | null) {
    setSourceWarehouse(w);
    if (w?._id !== sourceWarehouse?._id) {
      setItems((prev) => prev.map((it) => ({ ...it, sourceStock: 0 })));
    }
  }

  const addItem = useCallback(() => setItems((p) => [...p, blankItem()]), []);
  const removeItem = useCallback(
    (i: number) => setItems((p) => p.filter((_, idx) => idx !== i)),
    []
  );
  const reorderLines = useCallback((from: number, to: number) => {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);
  const updateItem = useCallback((index: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }, []);

  const filledItems = items.filter((it) => it.subProductId.trim());
  // Advisory figures for the UI; the server recomputes every number on save.
  const money = computeTransferTotals(items, deliveryCharge);

  function getLineErrors(): Record<number, LineError> {
    const errors: Record<number, LineError> = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.subProductId.trim()) continue;

      const dupIndex = items.findIndex(
        (other, j) =>
          j !== i &&
          other.subProductId === item.subProductId &&
          (other.sizeId || '') === (item.sizeId || '') &&
          other.subProductId.trim()
      );
      if (dupIndex >= 0) {
        errors[i] = {
          ...errors[i],
          duplicate: `Duplicate of line #${dupIndex + 1}`,
        };
      }

      if (
        sourceWarehouse &&
        item.quantity > 0 &&
        item.sourceStock !== undefined &&
        item.quantity > item.sourceStock
      ) {
        errors[i] = {
          ...errors[i],
          exceedsStock: `Only ${item.sourceStock} available in source warehouse`,
        };
      }
    }
    return errors;
  }

  const lineErrors = getLineErrors();
  const hasErrors = Object.keys(lineErrors).length > 0;
  const totalUnits = filledItems.reduce((s, it) => s + it.quantity, 0);
  const totalSourceStock = filledItems.reduce(
    (s, it) => s + (it.sourceStock ?? 0),
    0
  );

  async function handleSave(send = false) {
    if (!sourceWarehouse) return toast.error('Select a source warehouse');
    if (!destWarehouse) return toast.error('Select a destination warehouse');
    if (sourceWarehouse._id === destWarehouse._id)
      return toast.error('Source and destination must be different');
    if (filledItems.length === 0)
      return toast.error('Add at least one product line');
    const badQty = filledItems.find((it) => !(it.quantity > 0));
    if (badQty)
      return toast.error(
        `Quantity for "${badQty.subProductName}" must be at least 1`
      );
    if (hasErrors) {
      const dups = Object.values(lineErrors).filter((e) => e.duplicate).length;
      if (dups > 0)
        return toast.error('Fix duplicate product lines before saving');
    }

    setSaving(true);
    try {
      const res = await stockTransferService.create(
        {
          sourceWarehouse: sourceWarehouse._id,
          destinationWarehouse: destWarehouse._id,
          items: filledItems.map((it) => ({
            subProductId: it.subProductId,
            subProductName: it.subProductName,
            sku: it.sku,
            sizeId: it.sizeId,
            sizeName: it.sizeName,
            quantity: it.quantity,
            costPrice: it.costPrice ?? 0,
            discountRate: it.discountRate,
            taxRate: it.taxRate,
            packSize: it.packSize,
          })),
          notes: notes || undefined,
          scheduledDate: scheduledDate || undefined,
          deliveryCharge: deliveryCharge || undefined,
          status: send ? 'confirmed' : 'draft',
          currency,
        },
        token
      );

      // Send = create-as-confirmed, then dispatch. An approval-gated transfer
      // lands in pending_approval instead — nothing to dispatch yet.
      if (send && res.data.status === 'confirmed') {
        await stockTransferService.send(res.data._id, token);
        toast.success(`Dispatched to ${destWarehouse.name}`);
      } else if (send) {
        toast.success('Submitted for approval');
      } else {
        toast.success('Saved as draft');
      }
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
      <div className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.stockTransfers}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <PiArrowLeft className="h-3.5 w-3.5" /> Stock Transfers
        </Link>
        <span className="text-gray-300">›</span>
        <span className="font-medium text-gray-900">New Transfer</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New Stock Transfer
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Choose warehouses, add product lines, then save or confirm.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.eCommerce.stockTransfers}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || filledItems.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? (
              <PiSpinner className="h-4 w-4 animate-spin" />
            ) : (
              <PiFloppyDisk className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Save as</span> Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || filledItems.length === 0 || hasErrors}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            {saving ? (
              <PiSpinner className="h-4 w-4 animate-spin" />
            ) : (
              <PiPaperPlaneTilt className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Transfer Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">
            Transfer Details
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Source Warehouse
              </label>
              <WarehouseSelector
                label="source warehouse"
                selected={sourceWarehouse}
                options={sourceOptions}
                loading={warehousesLoading}
                onSelect={handleSourceChange}
                onClear={() => handleSourceChange(null)}
              />
            </div>
            <div className="relative">
              <div className="-left-3 top-1/2 z-10 hidden -translate-y-1/2 md:absolute">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                  <PiArrowElbowRightDown className="h-3 w-3 text-gray-400" />
                </div>
              </div>
              <div className="mb-1.5 flex items-center gap-2 md:hidden">
                <PiArrowElbowRightDown className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">to</span>
              </div>
              <label className="mb-1.5 hidden text-xs font-medium text-gray-600 md:block">
                Destination Warehouse
              </label>
              <WarehouseSelector
                label="destination warehouse"
                selected={destWarehouse}
                options={destOptions}
                loading={warehousesLoading}
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
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
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
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>
          {sourceWarehouse && destWarehouse && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <PiArrowElbowRightDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
              <span>
                <span className="font-medium text-gray-700">
                  {destWarehouse.name}
                </span>{' '}
                buys these goods from{' '}
                <span className="font-medium text-gray-700">
                  {sourceWarehouse.name}
                </span>
                . The unit cost is what the destination&rsquo;s stock will be
                valued at when it is received.
              </span>
            </p>
          )}
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Notes{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason for transfer, reference number, or any other details…"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
            />
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
             {items.map((item, i) => {
               const errors = lineErrors[i];
               const line = money.lines[i];
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
                    if (dragIndex !== null && dragIndex !== i) setOverIndex(i);
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
                  className={`px-5 py-4 ${dragIndex === i ? 'opacity-40' : ''} ${overIndex === i && dragIndex !== null && dragIndex !== i ? 'ring-2 ring-[#b20202]/40 rounded-lg' : ''}`}
                >
                  {/* Product search row */}
                  <div className="mb-3 flex items-start gap-3">
                    <span
                      title="Drag to reorder"
                      className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                    >
                      <PiDotsSixVertical className="h-5 w-5" />
                    </span>
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <SourceProductSearch
                        value={item.subProductName}
                        rows={stockRows}
                        loading={loadingStock}
                        onSelect={(row) =>
                          updateItem(i, {
                            subProductId: row.subProductId,
                            subProductName: row.sizeName
                              ? `${row.name} – ${row.sizeName}`
                              : row.name,
                            sku: row.sku,
                            sizeId: row.sizeId,
                            sizeName: row.sizeName,
                            costPrice: row.costPrice,
                            priceSource: row.costPrice > 0 ? 'cost' : null,
                            packSize: row.unitsPerPack,
                            discountRate: 0,
                            taxRate: 0,
                            sourceStock: row.quantity,
                          })
                        }
                      />
                      {item.subProductId && (
                        <div className="ml-1 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {item.sku && (
                            <span className="font-mono text-[11px] text-gray-400">
                              {item.sku}
                            </span>
                          )}
                          {sourceWarehouse && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <PiWarehouse className="h-3 w-3" />
                              Stock:{' '}
                              {loadingStock ? (
                                <PiSpinner className="h-3 w-3 animate-spin" />
                              ) : (
                                <span
                                  className={
                                    item.sourceStock &&
                                    item.sourceStock >= item.quantity
                                      ? 'font-semibold text-emerald-600'
                                      : 'font-semibold text-amber-600'
                                  }
                                >
                                  {item.sourceStock ?? '?'}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
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
                  <div className="ml-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-gray-500">
                        SKU
                      </label>
                      <div className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                        <span className="truncate font-mono text-xs text-gray-600">
                          {item.sku || '—'}
                        </span>
                      </div>
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
                          updateItem(i, {
                            quantity: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${
                          errors?.exceedsStock
                            ? 'border-red-300 bg-red-50 focus:border-red-500'
                            : 'border-gray-200 focus:border-[#b20202]'
                        }`}
                      />
                      {errors?.exceedsStock && (
                        <p className="mt-0.5 text-[10px] text-red-500">
                          {errors.exceedsStock}
                        </p>
                      )}
                    </div>
                    <PackSizeInput
                      value={item.packSize}
                      onApply={(patch) => updateItem(i, patch)}
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
                        Unit Cost
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costPrice ?? 0}
                        onChange={(e) =>
                          updateItem(i, {
                            costPrice: Math.max(0, Number(e.target.value)),
                            // Typed over — it is no longer the catalogue default.
                            priceSource: null,
                          })
                        }
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                      />
                      {item.priceSource && (
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          {item.priceSource === 'wholesale'
                            ? 'Wholesale'
                            : 'Cost'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-gray-500">
                        Discount %
                      </label>
                      <input
                        type="number"
                        aria-label="Discount %"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.discountRate || ''}
                        onChange={(e) =>
                          updateItem(i, {
                            discountRate: Math.min(
                              100,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          })
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
                        aria-label="Tax %"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.taxRate || ''}
                        onChange={(e) =>
                          updateItem(i, {
                            taxRate: Math.min(
                              100,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          })
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
                          {fmtCur(line?.lineTotal ?? 0, currency)}
                        </span>
                      </div>
                      {(item.discountRate > 0 || item.taxRate > 0) && (
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          eff. {fmtCur(line?.effectiveUnitCost ?? 0, currency)}
                          /unit
                        </p>
                      )}
                    </div>
                  </div>

                  {errors?.duplicate && (
                    <div className="ml-8 mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                      <PiWarning className="h-3.5 w-3.5 shrink-0" />
                      {errors.duplicate}
                    </div>
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

        {/* Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Summary</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">Lines</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                {filledItems.length}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">Total Units</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                {totalUnits}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">
                Source Stock Available
              </p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                {sourceWarehouse ? totalSourceStock : '—'}
              </p>
            </div>
          </div>
          {sourceWarehouse && destWarehouse && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>
                <span className="font-medium text-gray-700">From:</span>{' '}
                {sourceWarehouse.name} ({sourceWarehouse.code})
              </span>
              <PiArrowElbowRightDown className="h-3.5 w-3.5 text-gray-300" />
              <span>
                <span className="font-medium text-gray-700">To:</span>{' '}
                {destWarehouse.name} ({destWarehouse.code})
              </span>
              <span>
                <span className="font-medium text-gray-700">Currency:</span>{' '}
                {currency} ({CURRENCY_SYMBOLS[currency] ?? currency})
              </span>
            </div>
          )}
          {filledItems.length > 0 && (
            <div className="mt-4 max-w-sm">
              <TransferTotalsCard
                currency={currency}
                subtotal={money.subtotal}
                discountAmount={money.discountAmount}
                taxAmount={money.taxAmount}
                total={money.total}
                deliveryCharge={deliveryCharge}
                onDeliveryChargeChange={setDeliveryCharge}
              />
            </div>
          )}

          {!sourceWarehouse || !destWarehouse ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Select source and destination warehouses before saving.
              </span>
            </div>
          ) : hasErrors ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {Object.values(lineErrors).filter((e) => e.duplicate).length > 0
                  ? 'Remove duplicate product lines before confirming.'
                  : 'Some quantities exceed available stock.'}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
