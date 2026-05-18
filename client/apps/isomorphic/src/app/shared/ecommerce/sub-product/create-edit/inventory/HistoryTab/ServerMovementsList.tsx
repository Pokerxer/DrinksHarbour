// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  PiPlus, PiMinus, PiArrowsLeftRight, PiSliders, PiTrash,
  PiArrowClockwise, PiPackage, PiSpinner, PiStorefront,
  PiShoppingCart, PiWrench, PiReceipt, PiArrowCounterClockwise,
  PiX, PiMagnifyingGlass,
} from 'react-icons/pi';
import type { InventoryMovement } from '@/services/inventory.service';

interface ServerMovementsListProps {
  movements: InventoryMovement[];
  isLoading: boolean;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}

const ITEMS_PER_PAGE = 15;

type CategoryFilter = 'all' | 'in' | 'out' | 'transfer' | 'adjustment' | 'sale' | 'return';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(m: InventoryMovement): CategoryFilter {
  if (m.type === 'sold' || m.type === 'shipped') return 'sale';
  if (m.type === 'return' || m.type === 'return_in') return 'return';
  if (m.type === 'adjustment_in' || m.type === 'adjustment_out') return 'adjustment';
  if (m.category === 'in') return 'in';
  if (m.category === 'out') return 'out';
  if (m.category === 'transfer') return 'transfer';
  return 'in';
}

function getCatStyle(cat: CategoryFilter) {
  switch (cat) {
    case 'in':         return { bg: 'bg-green-100',  text: 'text-green-700',  icon: <PiPlus className="h-3.5 w-3.5" /> };
    case 'out':        return { bg: 'bg-red-100',    text: 'text-red-700',    icon: <PiMinus className="h-3.5 w-3.5" /> };
    case 'sale':       return { bg: 'bg-red-100',    text: 'text-red-700',    icon: <PiShoppingCart className="h-3.5 w-3.5" /> };
    case 'return':     return { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: <PiArrowCounterClockwise className="h-3.5 w-3.5" /> };
    case 'transfer':   return { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <PiArrowsLeftRight className="h-3.5 w-3.5" /> };
    case 'adjustment': return { bg: 'bg-purple-100', text: 'text-purple-700', icon: <PiSliders className="h-3.5 w-3.5" /> };
    default:           return { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <PiPlus className="h-3.5 w-3.5" /> };
  }
}

function getQtySign(cat: CategoryFilter) {
  if (cat === 'in' || cat === 'return') return '+';
  if (cat === 'out' || cat === 'sale') return '−';
  return '~';
}

function getQtyColor(cat: CategoryFilter) {
  if (cat === 'in' || cat === 'return') return 'text-green-600';
  if (cat === 'out' || cat === 'sale') return 'text-red-600';
  return 'text-blue-600';
}

function getSourceBadge(m: InventoryMovement) {
  // POS sale: source='order', notes contains 'POS sale'
  if (m.source === 'order' || (m.notes && m.notes.toLowerCase().includes('pos'))) {
    return { label: 'POS', cls: 'bg-[#b20202]/10 text-[#b20202]', icon: <PiStorefront className="h-2.5 w-2.5" /> };
  }
  // Ecommerce: source='system' or relatedOrder set without POS notes
  if (m.relatedOrder && typeof m.relatedOrder === 'object') {
    return { label: 'Online', cls: 'bg-blue-50 text-blue-700', icon: <PiShoppingCart className="h-2.5 w-2.5" /> };
  }
  if (m.source === 'api') {
    return { label: 'API', cls: 'bg-gray-100 text-gray-600', icon: <PiWrench className="h-2.5 w-2.5" /> };
  }
  return { label: 'Manual', cls: 'bg-gray-100 text-gray-500', icon: <PiWrench className="h-2.5 w-2.5" /> };
}

function getOrderRef(m: InventoryMovement): string | null {
  if (m.relatedOrder && typeof m.relatedOrder === 'object') {
    return m.relatedOrder.receiptNumber || m.relatedOrder.orderNumber || null;
  }
  return m.reference || null;
}

function formatDate(d: string) {
  try {
    const dt = new Date(d);
    const day = dt.getDate().toString().padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[dt.getMonth()]} ${dt.getFullYear()} · ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
  } catch { return d; }
}

function formatType(type: string) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'confirmed' ? 'bg-green-100 text-green-700'
            : status === 'pending'   ? 'bg-amber-100 text-amber-700'
            : status === 'cancelled' ? 'bg-gray-100 text-gray-500 line-through'
            : 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

const FILTER_TABS: { id: CategoryFilter | 'all'; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'sale',       label: 'Sales' },
  { id: 'return',     label: 'Returns' },
  { id: 'in',         label: 'Stock In' },
  { id: 'out',        label: 'Stock Out' },
  { id: 'adjustment', label: 'Adjustments' },
  { id: 'transfer',   label: 'Transfers' },
];

// ── Component ────────────────────────────────────────────────────────────────

export function ServerMovementsList({ movements, isLoading, onRefresh, onCancel }: ServerMovementsListProps) {
  const [activeFilter, setActiveFilter] = useState<CategoryFilter | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = movements.filter(m => {
    if (activeFilter !== 'all' && getCategory(m) !== activeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const ref = getOrderRef(m) || '';
      const type = formatType(m.type).toLowerCase();
      const reason = (m.reason || '').toLowerCase();
      const notes = (m.notes || '').toLowerCase();
      const performer = m.performedBy
        ? `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''} ${m.performedBy.posName || ''}`.toLowerCase()
        : '';
      if (!ref.toLowerCase().includes(q) && !type.includes(q) && !reason.includes(q) && !notes.includes(q) && !performer.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleFilter = (f: CategoryFilter | 'all') => { setActiveFilter(f); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  // Counts per tab
  const counts: Record<string, number> = { all: movements.length };
  movements.forEach(m => {
    const c = getCategory(m);
    counts[c] = (counts[c] || 0) + 1;
  });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">All Movements</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{filtered.length}</span>
        </div>
        <button type="button" onClick={onRefresh} disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">
          <PiArrowClockwise className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-gray-100 px-4 py-2.5">
        <div className="relative">
          <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by reference, reason, cashier…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-8 text-xs outline-none focus:border-gray-400 focus:bg-white"
          />
          {search && (
            <button type="button" onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <PiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-gray-100 px-3 py-2">
        {FILTER_TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => handleFilter(tab.id as CategoryFilter | 'all')}
            className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === tab.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {tab.label}
            {counts[tab.id] !== undefined && counts[tab.id] > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums ${
                activeFilter === tab.id ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
              }`}>{counts[tab.id === 'all' ? 'all' : tab.id] ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-14">
          <PiSpinner className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <PiPackage className="h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            {movements.length === 0 ? 'No movements recorded yet' : 'No movements match your filter'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {movements.length === 0
              ? 'Movements from POS sales, online orders, and manual adjustments will appear here'
              : 'Try clearing your search or selecting a different filter'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {paginated.map(m => {
            const cat = getCategory(m);
            const style = getCatStyle(cat);
            const source = getSourceBadge(m);
            const orderRef = getOrderRef(m);
            const sizeName = (typeof m.size === 'object' && m.size) ? (m.size.displayName || m.size.size) : (m.sizeName || null);
            const performer = m.performedBy
              ? (m.performedBy.posName || `${m.performedBy.firstName || ''} ${m.performedBy.lastName || ''}`.trim() || m.performedBy.email)
              : null;
            const canCancel = m.status !== 'cancelled' && cat !== 'sale';

            return (
              <div key={m._id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">

                {/* Icon */}
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}>
                  {style.icon}
                </span>

                {/* Main content */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  {/* Row 1: type + source + size */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800">{formatType(m.type)}</span>
                    {/* Source badge */}
                    <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}>
                      {source.icon}{source.label}
                    </span>
                    {/* Size badge */}
                    {sizeName && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{sizeName}</span>
                    )}
                    {/* Order reference */}
                    {orderRef && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-400">
                        <PiReceipt className="h-3 w-3" />
                        {orderRef}
                      </span>
                    )}
                  </div>

                  {/* Row 2: date + performer */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    <span>{formatDate(m.createdAt)}</span>
                    {performer && <span>· By {performer}</span>}
                  </div>

                  {/* Row 3: reason / notes */}
                  {(m.reason || m.notes) && (
                    <p className="text-[11px] text-gray-400 truncate max-w-xs">
                      {m.reason || m.notes}
                    </p>
                  )}
                </div>

                {/* Right: qty + before→after + status + cancel */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`text-sm font-bold tabular-nums ${getQtyColor(cat)}`}>
                    {getQtySign(cat)}{m.quantity}
                  </span>
                  {m.quantityBefore !== undefined && m.quantityAfter !== undefined && (
                    <span className="text-[10px] text-gray-400 tabular-nums">{m.quantityBefore}→{m.quantityAfter}</span>
                  )}
                  <StatusBadge status={m.status} />
                  {canCancel && (
                    <button type="button" onClick={() => onCancel(m._id)}
                      className="mt-0.5 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors" title="Cancel movement">
                      <PiTrash className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <span className="text-xs text-gray-400">
            {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">
              Prev
            </button>
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
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
