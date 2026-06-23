// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiPlus, PiArrowsDownUp, PiArrowsLeftRight, PiArrowClockwise,
  PiSpinner, PiPackage, PiShoppingCart, PiStorefront, PiWrench,
  PiMagnifyingGlass, PiX, PiReceipt, PiTruck, PiArrowDown,
  PiArrowUp, PiArrowCounterClockwise, PiWarningCircle,
} from 'react-icons/pi';
import { useTenant } from '@/context/TenantContext';
import type { InventoryMovement } from '@/services/inventory.service';
import type { StockMove, SizeVariant } from '../shared/types';
import { MovementDetailPanel } from '../HistoryTab/ServerMovementsList';

interface MovesTabProps {
  stockMoves: StockMove[];
  serverMovements?: InventoryMovement[];
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  selectedSize: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onNewMove: (type?: string) => void;
}

// ── Type classification ───────────────────────────────────────────────────────

type MoveCategory = 'incoming' | 'outgoing' | 'transfer' | 'adjustment';

interface MoveMeta {
  category: MoveCategory;
  label: string;
  icon: React.ReactNode;
  cls: string;       // text + bg for badge
  sign: '+' | '−' | '~';
  signCls: string;
}

function classifyMove(m: InventoryMovement): MoveMeta {
  const type = m.type?.trim();
  const cat  = m.category;

  // ── Incoming: only actual supplier receipts ───────────────────────────────
  if (type === 'received' || type === 'purchase') {
    return {
      category: 'incoming',
      label:    type === 'purchase' ? 'Purchase' : 'Receipt',
      icon:     <PiArrowDown className="h-3 w-3" />,
      cls:      'bg-green-100 text-green-700',
      sign:     '+', signCls: 'text-green-600',
    };
  }

  // ── Customer/vendor returns ───────────────────────────────────────────────
  if (type === 'return' || type === 'return_in') {
    const isVendor = cat === 'out';
    return {
      category: isVendor ? 'outgoing' : 'incoming',
      label:    isVendor ? 'Vendor Return' : 'Cust. Return',
      icon:     <PiArrowCounterClockwise className="h-3 w-3" />,
      cls:      isVendor ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700',
      sign:     isVendor ? '−' : '+',
      signCls:  isVendor ? 'text-red-600' : 'text-green-600',
    };
  }

  // ── Outgoing: sales, deliveries, write-offs ───────────────────────────────
  if (type === 'sold' || type === 'shipped' || type === 'damaged' ||
      type === 'expired' || type === 'theft'  || type === 'written_off') {
    const label = type === 'sold'        ? 'Sale'
                : type === 'shipped'     ? 'Shipment'
                : type === 'damaged'     ? 'Damaged'
                : type === 'expired'     ? 'Expired'
                : type === 'written_off' ? 'Write-off'
                : 'Theft';
    return {
      category: 'outgoing', label,
      icon:     <PiArrowUp className="h-3 w-3" />,
      cls:      'bg-red-100 text-red-700',
      sign:     '−', signCls: 'text-red-600',
    };
  }

  // ── Transfers ─────────────────────────────────────────────────────────────
  if (type === 'transfer_in' || type === 'transfer_out') {
    return {
      category: 'transfer',
      label:    type === 'transfer_in' ? 'Transfer In' : 'Transfer Out',
      icon:     <PiArrowsLeftRight className="h-3 w-3" />,
      cls:      'bg-blue-100 text-blue-700',
      sign:     '~', signCls: 'text-blue-600',
    };
  }

  // ── Adjustments ───────────────────────────────────────────────────────────
  if (type === 'adjustment_in') {
    return {
      category: 'adjustment', label: 'Adj. In',
      icon:     <PiArrowsDownUp className="h-3 w-3" />,
      cls:      'bg-purple-100 text-purple-700',
      sign:     '+', signCls: 'text-green-600',
    };
  }
  if (type === 'adjustment_out') {
    return {
      category: 'adjustment', label: 'Adj. Out',
      icon:     <PiArrowsDownUp className="h-3 w-3" />,
      cls:      'bg-purple-100 text-purple-700',
      sign:     '−', signCls: 'text-red-600',
    };
  }
  if (type === 'reserved' || type === 'released') {
    return {
      category: 'adjustment',
      label:    type === 'reserved' ? 'Reserved' : 'Released',
      icon:     <PiPackage className="h-3 w-3" />,
      cls:      'bg-amber-100 text-amber-700',
      sign:     '~', signCls: 'text-amber-600',
    };
  }

  // ── Fallback: use the movement's own category field ───────────────────────
  const fallbackCat: MoveCategory =
    cat === 'in'       ? 'incoming'   :
    cat === 'out'      ? 'outgoing'   :
    cat === 'transfer' ? 'transfer'   : 'adjustment';
  return {
    category: fallbackCat,
    label:    (type || 'Move').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon:     <PiArrowsDownUp className="h-3 w-3" />,
    cls:      'bg-gray-100 text-gray-600',
    sign:     cat === 'in' ? '+' : cat === 'out' ? '−' : '~',
    signCls:  cat === 'in' ? 'text-green-600' : cat === 'out' ? 'text-red-600' : 'text-gray-500',
  };
}

function getSourceBadge(m: InventoryMovement) {
  const isPOS = m.source === 'order' || (m.notes || '').toLowerCase().includes('pos');
  const isOnline = !isPOS && m.relatedOrder && typeof m.relatedOrder === 'object';
  if (isPOS)    return { label: 'POS',    cls: 'bg-[#b20202]/10 text-[#b20202]', icon: <PiStorefront className="h-2.5 w-2.5" /> };
  if (isOnline) return { label: 'Online', cls: 'bg-blue-50 text-blue-700',       icon: <PiShoppingCart className="h-2.5 w-2.5" /> };
  if (m.source === 'api') return { label: 'API', cls: 'bg-gray-100 text-gray-500', icon: <PiWrench className="h-2.5 w-2.5" /> };
  return { label: 'Manual', cls: 'bg-gray-100 text-gray-500', icon: <PiWrench className="h-2.5 w-2.5" /> };
}

function getRef(m: InventoryMovement): string {
  if (m.relatedOrder && typeof m.relatedOrder === 'object')
    return m.relatedOrder.receiptNumber || m.relatedOrder.orderNumber || m._id.slice(-8);
  if (m.relatedPurchaseOrder && typeof m.relatedPurchaseOrder === 'object')
    return m.relatedPurchaseOrder.poNumber || m._id.slice(-8);
  return m.reference || m._id.slice(-8);
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return {
    date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

function fmtMoney(n: number) {
  return `₦${(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_CLS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const FILTER_TABS = [
  { id: 'all',        label: 'All' },
  { id: 'incoming',   label: 'Incoming' },
  { id: 'outgoing',   label: 'Outgoing' },
  { id: 'transfer',   label: 'Transfers' },
  { id: 'adjustment', label: 'Adjustments' },
] as const;
type FilterId = typeof FILTER_TABS[number]['id'];

const ITEMS_PER_PAGE = 20;

// ── Component ─────────────────────────────────────────────────────────────────

export function MovesTab({
  stockMoves,
  serverMovements = [],
  hasSizeVariants,
  sizes,
  selectedSize,
  isLoading,
  onRefresh,
  onNewMove,
}: MovesTabProps) {
  const [filter,   setFilter]   = useState<FilterId>('all');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<InventoryMovement | null>(null);

  const { data: session } = useSession();
  const { tenant }        = useTenant();
  const token             = session?.user?.token as string | undefined;

  const movements = serverMovements.length > 0 ? serverMovements : [];

  // Counts per category
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: movements.length };
    movements.forEach(m => {
      const cat = classifyMove(m).category;
      c[cat] = (c[cat] || 0) + 1;
    });
    return c;
  }, [movements]);

  // Summary totals — driven by classifyMove so it stays in sync with the table badges
  const totals = useMemo(() => {
    const t = { received: 0, outgoing: 0, returned: 0, adjusted: 0 };
    movements.forEach(m => {
      const { category } = classifyMove(m);
      const type = m.type?.trim();
      // "received" bucket = only supplier receipts
      if (type === 'received' || type === 'purchase') {
        t.received += m.quantity;
      // customer returns are shown separately
      } else if (type === 'return' || type === 'return_in') {
        if (m.category !== 'out') t.returned += m.quantity; // customer return (+stock)
        else t.outgoing += m.quantity;                       // vendor return (−stock)
      // outgoing = sales, shipments, write-offs
      } else if (category === 'outgoing') {
        t.outgoing += m.quantity;
      // adjustments = net (in − out)
      } else if (type === 'adjustment_in') {
        t.adjusted += m.quantity;
      } else if (type === 'adjustment_out') {
        t.adjusted -= m.quantity;
      }
      // transfers & reserved/released: not counted in the 4 buckets
    });
    return t;
  }, [movements]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = movements;
    if (filter !== 'all') list = list.filter(m => classifyMove(m).category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => {
        const ref    = getRef(m).toLowerCase();
        const type   = (m.type || '').toLowerCase();
        const reason = (m.reason || m.notes || '').toLowerCase();
        const by     = m.performedBy ? `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''} ${m.performedBy.posName || ''}`.toLowerCase() : '';
        return ref.includes(q) || type.includes(q) || reason.includes(q) || by.includes(q);
      });
    }
    return list;
  }, [movements, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleFilter = (f: FilterId) => { setFilter(f); setPage(1); };
  const handleSearch = (v: string)   => { setSearch(v); setPage(1); };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-bold text-gray-900">Stock Moves</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <PiArrowClockwise className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button type="button" onClick={() => onNewMove()}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
            <PiPlus className="h-3.5 w-3.5" /> New Move
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {movements.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Received',    value: totals.received,
              sub: 'Supplier receipts',
              icon: <PiArrowDown className="h-4 w-4" />,
              bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700',
              filterFn: (m: InventoryMovement) => m.type === 'received' || m.type === 'purchase',
            },
            {
              label: 'Outgoing',    value: totals.outgoing,
              sub: 'Sales & write-offs',
              icon: <PiArrowUp className="h-4 w-4" />,
              bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700',
              filterFn: (m: InventoryMovement) => classifyMove(m).category === 'outgoing',
            },
            {
              label: 'Returns',     value: totals.returned,
              sub: 'Customer returns',
              icon: <PiArrowCounterClockwise className="h-4 w-4" />,
              bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700',
              filterFn: (m: InventoryMovement) => (m.type === 'return' || m.type === 'return_in') && m.category !== 'out',
            },
            {
              label: 'Adjustments', value: totals.adjusted,
              sub: 'Net manual corrections',
              icon: <PiArrowsDownUp className="h-4 w-4" />,
              bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700',
              filterFn: (m: InventoryMovement) => m.type === 'adjustment_in' || m.type === 'adjustment_out',
            },
          ].map(({ label, value, sub, icon, bg, border, text, filterFn }) => {
            const moveCount = movements.filter(filterFn).length;
            const isNeg = value < 0;
            return (
              <div key={label} className={`rounded-xl border ${border} ${bg} px-4 py-3`}>
                <div className={`flex items-center gap-2 mb-1 ${text}`}>
                  {icon}
                  <p className="text-xs font-semibold">{label}</p>
                </div>
                <p className={`text-2xl font-black tabular-nums leading-none ${isNeg ? 'text-red-600' : text}`}>
                  {isNeg ? '−' : ''}{Math.abs(value)}
                </p>
                <p className={`text-[10px] mt-0.5 ${text} opacity-70`}>{sub} · {moveCount} move{moveCount !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quick-action buttons ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Receive Stock',  type: 'received',     cls: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100', icon: <PiArrowDown className="h-4 w-4" /> },
          { label: 'Deliver Stock',  type: 'shipped',      cls: 'border-red-200   bg-red-50   text-red-700   hover:bg-red-100',   icon: <PiTruck    className="h-4 w-4" /> },
          { label: 'Transfer',       type: 'transfer_in',  cls: 'border-blue-200  bg-blue-50  text-blue-700  hover:bg-blue-100',  icon: <PiArrowsLeftRight className="h-4 w-4" /> },
          { label: 'Adjust Count',   type: 'adjustment_in',cls: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100', icon: <PiArrowsDownUp className="h-4 w-4" /> },
        ].map(({ label, type, cls, icon }) => (
          <button key={type} type="button" onClick={() => onNewMove(type)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${cls}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Search + filter ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by reference, type, cashier…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-8 text-xs focus:border-gray-400 focus:bg-white focus:outline-none" />
          {search && (
            <button type="button" onClick={() => handleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <PiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 overflow-x-auto">
          {FILTER_TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => handleFilter(tab.id)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {tab.label}
              {(counts[tab.id === 'all' ? 'all' : tab.id] || 0) > 0 && (
                <span className={`rounded-full px-1 text-[9px] font-bold tabular-nums ${
                  filter === tab.id ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                }`}>{counts[tab.id === 'all' ? 'all' : tab.id] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <PiSpinner className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <PiArrowsDownUp className="h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            {movements.length === 0 ? 'No stock moves recorded yet' : 'No moves match your filter'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {movements.length === 0
              ? 'Moves from POS sales, orders, manual adjustments and transfers appear here'
              : 'Try clearing your search or choosing a different filter'}
          </p>
          {movements.length === 0 && (
            <button type="button" onClick={() => onNewMove()}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
              <PiPlus className="h-4 w-4" /> Record First Move
            </button>
          )}
        </div>
      )}

      {/* ── Moves table ── */}
      {!isLoading && paginated.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Reference</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Source</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Qty</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap hidden md:table-cell">Before → After</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Unit Cost</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Reason</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((m, i) => {
                  const meta   = classifyMove(m);
                  const src    = getSourceBadge(m);
                  const ref    = getRef(m);
                  const { date, time } = fmtDate(m.createdAt);
                  const sizeName = typeof m.size === 'object' && m.size
                    ? (m.size.displayName || m.size.size)
                    : m.sizeName || null;
                  const performer = m.performedBy
                    ? (m.performedBy.posName || `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''}`.trim() || m.performedBy.email)
                    : null;
                  const statusCls = STATUS_CLS[m.status] || 'bg-gray-100 text-gray-500';

                  const isSelected = selected?._id === m._id;
                  return (
                    <tr
                      key={m._id}
                      onClick={() => setSelected(isSelected ? null : m)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-gray-100 ring-1 ring-inset ring-gray-300'
                          : i % 2 === 1
                          ? 'bg-gray-50/20 hover:bg-gray-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-800">{date}</p>
                        <p className="text-[10px] text-gray-400">{time}</p>
                      </td>

                      {/* Reference */}
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-gray-800 leading-none">{ref}</p>
                        {sizeName && (
                          <span className="mt-0.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">{sizeName}</span>
                        )}
                        {performer && (
                          <p className="mt-0.5 text-[10px] text-gray-400">{performer}</p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                          {meta.icon}{meta.label}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${src.cls}`}>
                          {src.icon}{src.label}
                        </span>
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-black tabular-nums ${meta.signCls}`}>
                          {meta.sign}{m.quantity}
                        </span>
                      </td>

                      {/* Before → After */}
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {m.quantityBefore !== undefined && m.quantityAfter !== undefined ? (
                          <span className="tabular-nums text-gray-500">
                            {m.quantityBefore}
                            <span className="mx-1 text-gray-300">→</span>
                            <span className="font-semibold text-gray-700">{m.quantityAfter}</span>
                          </span>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 hidden lg:table-cell">
                        {m.unitCost ? fmtMoney(m.unitCost) : <span className="text-gray-200">—</span>}
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="max-w-[140px] truncate text-gray-400">{m.reason || m.notes || <span className="text-gray-200">—</span>}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusCls}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <span className="text-[10px] text-gray-400">
                {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pn = totalPages <= 5 ? i + 1 : i === 0 ? 1 : i === 4 ? totalPages : page - 1 + i;
                  return (
                    <button key={pn} type="button" onClick={() => setPage(pn)}
                      className={`rounded px-2 py-1 text-xs font-medium ${page === pn ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                      {pn}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Movement detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-[70vw] h-[70vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <MovementDetailPanel
              movement={selected}
              token={token}
              tenant={tenant}
              onClose={() => setSelected(null)}
              onRefresh={onRefresh}
            />
          </div>
        </div>
      )}
    </div>
  );
}
