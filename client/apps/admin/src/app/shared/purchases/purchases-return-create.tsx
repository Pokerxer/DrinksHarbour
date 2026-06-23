'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  PiArrowLeft, PiCheck, PiMagnifyingGlass, PiCaretDown, PiArrowCounterClockwise,
  PiSquare, PiCheckSquare, PiSelectionInverse,
} from 'react-icons/pi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { POItem } from '@/services/purchaseOrder.service';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from '@/services/vendorReturn.service';
import { fmtCur } from './purchases-analytics-helpers';

const REASONS = [
  { value: 'defective', label: 'Defective / Faulty' },
  { value: 'wrong_item', label: 'Wrong Item Delivered' },
  { value: 'overdelivery', label: 'Overdelivery' },
  { value: 'damaged', label: 'Damaged in Transit' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'defective', label: 'Defective' },
  { value: 'expired', label: 'Expired' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'over_supplied', label: 'Over Supplied' },
  { value: 'other', label: 'Other' },
];

interface RowState {
  returnQty: number;
  reason: string;
  condition: string;
}

/** Aggregated returned qty per subProduct from existing returns for this PO */
interface ReturnedQtyMap {
  [subProductId: string]: number;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-6 w-48 rounded bg-gray-100" />
      <div className="mb-4 h-24 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex gap-6">
          <div className="h-10 w-40"><div className="h-4 w-24 rounded bg-gray-100" /><div className="mt-1 h-5 w-32 rounded bg-gray-100" /></div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="h-10 w-36"><div className="h-4 w-16 rounded bg-gray-100" /><div className="mt-1 h-4 w-28 rounded bg-gray-100" /></div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="h-10 w-40"><div className="h-4 w-20 rounded bg-gray-100" /><div className="mt-1 h-4 w-32 rounded bg-gray-100" /></div>
        </div>
      </div>
      <div className="mb-4 h-4 w-full rounded bg-gray-100" />
      <div className="mb-4 h-80 rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

function POSelector({ token, onSelect }: { token: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function doSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrders(token, {
        search: q,
        limit: 10,
        status: 'received',
      });
      setResults(res.data ?? []);
      setShow(true);
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-600">Search Purchase Order</label>
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShow(true)}
          placeholder="Search by PO number or vendor name…"
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none"
        />
        {searching && (
          <PiArrowCounterClockwise className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>
      {show && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((po: any) => (
            <button
              key={po._id}
              type="button"
              onClick={() => { onSelect(po._id); setShow(false); setQuery(''); }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
            >
              <div>
                <span className="font-medium text-gray-900">{po.poNumber}</span>
                <span className="ml-2 text-gray-500">{po.vendorName}</span>
              </div>
              <span className="text-xs text-gray-400">{po.currency} {po.totalAmount?.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
      {show && query.length >= 2 && results.length === 0 && !searching && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-lg">
          No received POs found
        </div>
      )}
    </div>
  );
}

export default function PurchasesReturnCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const poId = searchParams.get('po') ?? '';
  const [compact, setCompact] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkCondition, setBulkCondition] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showPrefill, setShowPrefill] = useState(true);

  const [po, setPo] = useState<
    | Awaited<ReturnType<typeof purchaseOrderService.getPurchaseOrder>>['data']
    | null
  >(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [notes, setNotes] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(!!poId);
  const [saving, setSaving] = useState(false);
  const [existingReturns, setExistingReturns] = useState<VendorReturn[]>([]);

  /* ---------- load PO ---------- */
  const loadPO = useCallback(async (id: string) => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrder(id, token);
      setPo(res.data);
      setRows(
        (res.data.items ?? []).map(() => ({
          returnQty: 0,
          reason: 'defective',
          condition: 'other',
        }))
      );
      // Fetch existing returns for this PO to compute already-returned qty
      try {
        const returnsRes = await vendorReturnService.getVendorReturns(token, { purchaseOrder: id, limit: 100 });
        setExistingReturns(returnsRes.data ?? []);
      } catch {
        // non-critical
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load PO');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (poId) loadPO(poId);
  }, [poId, loadPO]);

  /* ---------- dirty form warning ---------- */
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  /* ---------- already-returned qty map ---------- */
  const returnedQtyMap: ReturnedQtyMap = useMemo(() => {
    const map: ReturnedQtyMap = {};
    for (const ret of existingReturns) {
      if (ret.status === 'cancelled' || ret.status === 'rejected') continue;
      for (const item of ret.items) {
        const key = item.subProductId ?? '';
        map[key] = (map[key] ?? 0) + item.quantity;
      }
    }
    return map;
  }, [existingReturns]);

  /* ---------- helpers ---------- */
  function updateRow(i: number, patch: Partial<RowState>) {
    setDirty(true);
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    );
  }

  function toggleRow(i: number) {
    if (!po) return;
    setDirty(true);
    setRows((prev) => {
      const row = prev[i];
      if (!row) return prev;
      const item = po.items[i];
      const max = maxAvail(item);
      return prev.map((r, idx) =>
        idx === i ? { ...r, returnQty: r.returnQty > 0 ? 0 : max } : r
      );
    });
  }

  function maxAvail(item: POItem): number {
    const received = item.receivedQty > 0 ? item.receivedQty : item.quantity;
    const alreadyReturned = item.returnedQty ?? returnedQtyMap[item.subProductId] ?? 0;
    return Math.max(0, received - alreadyReturned);
  }

  /** Unit price for return credit — prefers unitCost, then derives from packPrice. */
  function getUnitPrice(item: POItem): number {
    if (item.unitCost) return item.unitCost;
    const packSize = item.packagingQty || item.packSize || 1;
    return item.packPrice ? item.packPrice / packSize : 0;
  }

  const allSelected = useMemo(
    () => po && rows.length > 0 && rows.every((r, i) => {
      if (!po.items[i]) return true;
      return r.returnQty === maxAvail(po.items[i]);
    }),
    [po, rows]
  );

  function toggleSelectAll() {
    if (!po) return;
    setDirty(true);
    if (allSelected) {
      setRows((prev) => prev.map((r) => ({ ...r, returnQty: 0 })));
    } else {
      setRows((prev) =>
        prev.map((r, i) => {
          const item = po.items[i];
          return { ...r, returnQty: item ? maxAvail(item) : 0 };
        })
      );
    }
  }

  function prefillReceived() {
    if (!po) return;
    setDirty(true);
    setRows((prev) =>
      prev.map((r, i) => {
        const item = po.items[i];
        const avail = item ? maxAvail(item) : 0;
        return { ...r, returnQty: avail > 0 ? avail : 0 };
      })
    );
    setShowPrefill(false);
    toast.success('Pre-filled with received quantities');
  }

  function applyBulk() {
    setRows((prev) =>
      prev.map((r) => {
        if (r.returnQty === 0) return r;
        return {
          ...r,
          reason: bulkReason || r.reason,
          condition: bulkCondition || r.condition,
        };
      })
    );
    if (bulkReason) setBulkReason('');
    if (bulkCondition) setBulkCondition('');
  }

  /* ---------- filtered + sorted items ---------- */
  const itemsToDisplay = useMemo(() => {
    if (!po) return [];
    let list = po.items.map((item: POItem, i: number) => ({ item, i }));
    if (itemFilter) {
      const q = itemFilter.toLowerCase();
      list = list.filter(
        ({ item }) =>
          (item.subProductName ?? item.productName)?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.sizeName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [po, itemFilter]);

  const summary = useMemo(() => {
    if (!po) return { totalQty: 0, totalAmount: 0, selectedCount: 0, totalItems: 0, totalReturnable: 0 };
    let totalQty = 0;
    let totalAmount = 0;
    let selectedCount = 0;
    let totalReturnable = 0;
    (po.items ?? []).forEach((item: POItem, i: number) => {
      const avail = maxAvail(item);
      totalReturnable += avail;
      const row = rows[i];
      if (row && row.returnQty > 0) {
        totalQty += row.returnQty;
        totalAmount += row.returnQty * getUnitPrice(item);
        selectedCount++;
      }
    });
    return { totalQty, totalAmount, selectedCount, totalItems: po.items.length, totalReturnable };
  }, [po, rows]);

  /* ---------- create ---------- */
  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!po) return;
    const items = (po.items ?? [])
      .map((item: POItem, i: number) => ({ item, row: rows[i] }))
      .filter(({ row }) => row.returnQty > 0)
      .map(({ item, row }) => ({
        subProductId: item.subProductId,
        subProductName: item.subProductName ?? item.productName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: row.returnQty,
        unitPrice: getUnitPrice(item),
        amount: row.returnQty * getUnitPrice(item),
        reason: row.reason,
        condition: row.condition,
      }));

    if (items.length === 0) {
      toast.error('Set a return quantity > 0 for at least one item');
      return;
    }

    setSaving(true);
    try {
      const res = await vendorReturnService.createVendorReturn(
        {
          vendor: po.vendor,
          vendorName: po.vendorName,
          purchaseOrder: po._id,
          poNumber: po.poNumber,
          currency: po.currency ?? 'NGN',
          items,
          reason: items[0].reason,
          notes,
          returnDate: new Date(returnDate).toISOString(),
        },
        token
      );
      setDirty(false);
      toast.success('Return created');
      router.push(routes.eCommerce.vendorReturnDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create return');
    } finally {
      setSaving(false);
    }
  }

  /* ---------- render ---------- */
  if (loading) return <LoadingSkeleton />;

  /* Standalone mode: no PO loaded and no poId in URL */
  if (!po && !poId) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href={routes.eCommerce.vendorReturns} className="flex items-center gap-1 hover:text-gray-700">
            <PiArrowLeft className="h-4 w-4" /> Vendor Returns
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900">New Return</span>
        </div>
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Create Vendor Return</h1>
          <p className="mt-1 text-sm text-gray-500">Start by selecting a received Purchase Order</p>
        </div>
        <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-6">
          <POSelector token={token} onSelect={(id) => {
            window.history.replaceState(null, '', `?po=${id}`);
            loadPO(id);
          }} />
          <p className="mt-4 text-xs text-gray-400">Only received purchase orders with received stock are shown.</p>
        </div>
      </div>
    );
  }

  /* PO not found */
  if (!po) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        Purchase order not found.{' '}
        <Link href={routes.eCommerce.vendorReturns} className="text-[#b20202] hover:underline">Back to returns</Link>
      </div>
    );
  }

  const cur = po.currency ?? 'NGN';
  const hasItems = (po.items ?? []).length > 0;
  const progressPct = summary.totalItems > 0
    ? Math.round((summary.selectedCount / summary.totalItems) * 100)
    : 0;
  const hasReturned = Object.keys(returnedQtyMap).length > 0;
  const poDetailRoute = poId ? routes.eCommerce.purchaseDetails(poId) : routes.eCommerce.vendorReturns;

  return (
    <form onSubmit={handleCreate} className="pb-28">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={poDetailRoute} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" />
          {poId ? 'Purchase Order' : 'Vendor Returns'}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Return</span>
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Create Vendor Return</h1>
          <p className="text-sm text-gray-500">{po.poNumber} &middot; {po.vendorName}</p>
        </div>
        <div className="flex items-center gap-3">
          {existingReturns.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
              {existingReturns.filter(r => r.status !== 'cancelled').length} previous return{existingReturns.length > 1 ? 's' : ''}
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)}
              className="rounded border-gray-300 text-[#b20202] focus:ring-[#b20202]/20" />
            Compact
          </label>
        </div>
      </div>

      {/* PO info card */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-gray-500">Purchase Order</p>
              <p className="font-mono font-semibold text-gray-900">{po.poNumber}</p>
            </div>
            <div className="hidden h-8 w-px bg-gray-200 sm:block" />
            <div>
              <p className="text-xs text-gray-500">Vendor</p>
              <p className="text-sm text-gray-700">{po.vendorName ?? '—'}</p>
            </div>
            <div className="hidden h-8 w-px bg-gray-200 sm:block" />
            <div>
              <p className="text-xs text-gray-500">Total Ordered</p>
              <p className="text-sm font-medium text-gray-700">{fmtCur(po.items?.reduce((s: number, i: POItem) => s + (getUnitPrice(i) * i.quantity), 0) ?? 0, cur)}</p>
            </div>
            {hasReturned && (
              <>
                <div className="hidden h-8 w-px bg-gray-200 sm:block" />
                <div>
                  <p className="text-xs text-amber-600">Previously Returned</p>
                  <p className="text-sm font-medium text-amber-700">{fmtCur(
                    existingReturns.filter(r => r.status !== 'cancelled').reduce((s, r) => s + (r.totalAmount ?? 0), 0),
                    cur
                  )}</p>
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <label className="text-xs text-gray-500">Return Date</label>
            <input
              type="date" value={returnDate}
              onChange={(e) => { setDirty(true); setReturnDate(e.target.value); }}
              max={new Date().toISOString().split('T')[0]}
              className="ml-2 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-[#b20202] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Pre-fill prompt */}
      {showPrefill && summary.totalReturnable > 0 && summary.selectedCount === 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#b20202]/20 bg-[#b20202]/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <PiSelectionInverse className="h-4 w-4 text-[#b20202]" />
            <span className="text-gray-700">
              <strong>{summary.totalReturnable}</strong> item{summary.totalReturnable > 1 ? 's' : ''} available for return.
              {hasReturned && <span className="ml-1 text-amber-600">({Object.values(returnedQtyMap).reduce((s, v) => s + v, 0)} already returned)</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={prefillReceived} className="rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9a0101]">
              Pre-fill All
            </button>
            <button type="button" onClick={() => setShowPrefill(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {hasItems && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{summary.selectedCount} of {summary.totalItems} items selected</span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[#b20202] transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Bulk apply bar */}
      {summary.selectedCount > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5">
          <span className="text-xs font-medium text-blue-700">Bulk apply to selected:</span>
          <div className="relative">
            <select value={bulkReason} onChange={(e) => setBulkReason(e.target.value)}
              className="appearance-none rounded-lg border border-blue-200 bg-white px-2 py-1 pr-6 text-xs focus:border-blue-500 focus:outline-none">
              <option value="">Reason…</option>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <PiCaretDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-blue-400" />
          </div>
          <div className="relative">
            <select value={bulkCondition} onChange={(e) => setBulkCondition(e.target.value)}
              className="appearance-none rounded-lg border border-blue-200 bg-white px-2 py-1 pr-6 text-xs focus:border-blue-500 focus:outline-none">
              <option value="">Condition…</option>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <PiCaretDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-blue-400" />
          </div>
          <button type="button" onClick={applyBulk} disabled={!bulkReason && !bulkCondition}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            Apply
          </button>
        </div>
      )}

      {/* Item filter */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            placeholder="Filter items by name or SKU…"
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-[#b20202] focus:outline-none"
          />
        </div>
        {itemFilter && (
          <button type="button" onClick={() => setItemFilter('')} className="text-xs text-gray-400 hover:text-gray-600">
            Clear filter
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {summary.selectedCount > 0 && (
            <span className="text-xs text-gray-400">
              {itemFilter ? `${itemsToDisplay.filter(({ i }) => rows[i]?.returnQty > 0).length} shown` : ''}
            </span>
          )}
          <button type="button" onClick={toggleSelectAll} className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-10 px-2 py-3 text-center" />
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500">Product</th>
              {!compact && <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Size</th>}
              <th className="px-2 py-3 text-right text-xs font-medium text-gray-500">Ordered</th>
              <th className="px-2 py-3 text-right text-xs font-medium text-gray-500">Received</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Return Qty</th>
              {!compact && <th className="px-2 py-3 text-right text-xs font-medium text-gray-500">Price</th>}
              {!compact && <th className="px-2 py-3 text-right text-xs font-medium text-gray-500">Amount</th>}
              {!compact && <th className="px-2 py-3 text-left text-xs font-medium text-gray-500">Reason</th>}
              {!compact && <th className="px-2 py-3 text-left text-xs font-medium text-gray-500">Condition</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {itemsToDisplay.length === 0 ? (
              <tr>
                <td colSpan={compact ? 7 : 11} className="py-12 text-center text-sm text-gray-400">
                  {itemFilter ? 'No items match your filter' : 'No items in this purchase order'}
                </td>
              </tr>
            ) : (
              itemsToDisplay.map(({ item, i }) => {
                const avail = maxAvail(item);
                const row = rows[i] ?? { returnQty: 0, reason: 'defective', condition: 'other' };
                const selected = row.returnQty > 0;
                const prevReturned = returnedQtyMap[item.subProductId] ?? 0;
                return (
                  <tr
                    key={i}
                    onClick={() => toggleRow(i)}
                    className={`cursor-pointer transition-colors ${
                      selected
                        ? 'bg-red-50/60 shadow-[inset_3px_0_0_0_#b20202]'
                        : 'hover:bg-gray-50/60'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleRow(i)}
                        className={`rounded ${selected ? 'text-[#b20202]' : 'text-gray-300 hover:text-gray-500'}`}>
                        {selected ? <PiCheckSquare className="h-4 w-4" /> : <PiSquare className="h-4 w-4" />}
                      </button>
                    </td>

                    {/* Product */}
                    <td className="px-2 py-3">
                      <p className={`font-medium leading-tight ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {item.subProductName ?? item.productName ?? '—'}
                        {item.sizeName && compact && <span className="text-gray-400"> · {item.sizeName}</span>}
                      </p>
                      {item.sku && <p className="text-[11px] text-gray-400">{item.sku}</p>}
                      {prevReturned > 0 && (
                        <p className="mt-0.5 text-[10px] text-amber-500">{prevReturned} previously returned</p>
                      )}
                    </td>

                    {/* Size */}
                    {!compact && <td className="px-2 py-3 text-center text-xs text-gray-500">{item.sizeName ?? '—'}</td>}

                    {/* Ordered */}
                    <td className="px-2 py-3 text-right tabular-nums text-gray-400">{item.quantity}</td>

                    {/* Received */}
                    <td className="px-2 py-3 text-right tabular-nums text-gray-600">{item.receivedQty ?? item.quantity}</td>

                    {/* Return Qty */}
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number" min={0} max={avail}
                          value={row.returnQty}
                          onChange={(e) =>
                            updateRow(i, { returnQty: Math.min(avail, Math.max(0, parseInt(e.target.value) || 0)) })
                          }
                          className="w-14 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                        />
                        <button
                          type="button"
                          onClick={() => updateRow(i, { returnQty: row.returnQty === avail ? 0 : avail })}
                          className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
                            row.returnQty === avail
                              ? 'bg-gray-200 text-gray-500'
                              : 'text-[#b20202] hover:bg-red-50'
                          }`}
                          title="Toggle max"
                        >
                          MAX
                        </button>
                      </div>
                    </td>

                    {/* Unit Price */}
                    {!compact && (
                      <td className="px-2 py-3 text-right tabular-nums text-gray-700">{fmtCur(getUnitPrice(item), cur)}</td>
                    )}

                    {/* Amount */}
                    {!compact && (
                      <td className="px-2 py-3 text-right font-medium tabular-nums text-gray-900">
                        {selected ? fmtCur(row.returnQty * getUnitPrice(item), cur) : '—'}
                      </td>
                    )}

                    {/* Reason */}
                    {!compact && (
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative min-w-[130px]">
                          <select
                            value={row.reason}
                            onChange={(e) => updateRow(i, { reason: e.target.value })}
                            disabled={!selected}
                            className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 pr-7 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <PiCaretDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        </div>
                      </td>
                    )}

                    {/* Condition */}
                    {!compact && (
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative min-w-[120px]">
                          <select
                            value={row.condition}
                            onChange={(e) => updateRow(i, { condition: e.target.value })}
                            disabled={!selected}
                            className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 pr-7 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <PiCaretDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => { setDirty(true); setNotes(e.target.value); }}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
          placeholder="Reason for return, additional instructions…"
        />
      </div>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            {summary.selectedCount > 0 ? (
              <>
                <span className="text-gray-500">
                  <strong className="text-gray-900">{summary.selectedCount}</strong>/{summary.totalItems}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  Qty: <strong className="text-gray-900">{summary.totalQty}</strong>
                </span>
                <span className="hidden text-gray-400 sm:inline">|</span>
                <span className="hidden text-gray-500 sm:inline">
                  Value: <strong className="text-gray-900">{fmtCur(summary.totalAmount, cur)}</strong>
                </span>
              </>
            ) : (
              <span className="text-gray-400">No items selected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href={poDetailRoute} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || summary.selectedCount === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {saving ? 'Creating…' : `Create (${summary.selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
