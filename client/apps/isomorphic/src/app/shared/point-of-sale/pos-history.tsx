'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth, usePOSCart } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSOrderDetail from '@/app/shared/point-of-sale/components/pos-order-detail';
import { routes } from '@/config/routes';
// Local cn to avoid any workspace-package resolution issues at runtime
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
import {
  PiArrowLeft,
  PiMagnifyingGlass,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiTrash,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiX,
  PiArrowCounterClockwise,
  PiPrinter,
  PiReceipt,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface HistoryItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
}

interface HistoryRefundLine {
  orderItemIndex?: number;
  quantity: number;
  unitPrice?: number;
  discPct?: number;
  amount?: number;
  restock?: boolean;
  reason?: string;
}

interface HistoryRefund {
  receiptNumber?: string;
  items: HistoryRefundLine[];
  totalRefunded: number;
  reason?: string;
  paymentMethod?: string;
  refundedBy?: { firstName: string; lastName: string; posName?: string };
  refundedAt: string;
}

interface HistoryOrder {
  _id: string;
  receiptNumber?: string;
  orderNumber?: string;
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  placedAt: string;
  createdAt: string;
  posStaff?: { _id: string; firstName: string; lastName: string; posName?: string };
  isVoided?: boolean;
  refunds?: HistoryRefund[];
  items?: HistoryItem[];
  status?: string;
}

type Filter = 'all' | 'paid' | 'voided';
type SortCol = 'date' | 'receipt' | 'customer' | 'cashier' | 'total' | 'method';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 15;

const FILTER_LABELS: Record<Filter, string> = {
  all:    'All Orders',
  paid:   'Paid',
  voided: 'Voided',
};

// ── Filter dropdown ───────────────────────────────────────────────────────────
function FilterDropdown({
  value,
  onChange,
  onClose,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [onClose]);

  const options: { value: Filter; label: string; dot: string }[] = [
    { value: 'all',    label: 'All Orders', dot: 'bg-gray-400' },
    { value: 'paid',   label: 'Paid',       dot: 'bg-emerald-500' },
    { value: 'voided', label: 'Voided',     dot: 'bg-red-400' },
  ];

  return (
    <div ref={ref} className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => { onChange(o.value); onClose(); }}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
            value === o.value
              ? 'font-semibold text-[#b20202] bg-red-50'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${o.dot}`} />
          {o.label}
          {value === o.value && <span className="ml-auto text-[#b20202]">✓</span>}
        </button>
      ))}
    </div>
  );
}

// ── Return Detail Panel ───────────────────────────────────────────────────────

function ReturnDetailPanel({
  refund,
  parentOrder,
  onClose,
}: {
  refund: HistoryRefund;
  parentOrder: HistoryOrder;
  onClose: () => void;
}) {
  const cashierName = refund.refundedBy
    ? (refund.refundedBy.posName || `${refund.refundedBy.firstName} ${refund.refundedBy.lastName}`)
    : '—';

  const refundDate = new Date(refund.refundedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  function handlePrint() {
    const win = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
    if (!win) return;
    const rows = (refund.items || []).map((line: HistoryRefundLine) => {
      const item = line.orderItemIndex != null ? parentOrder.items?.[line.orderItemIndex] : undefined;
      const name = item
        ? `${item.name}${item.variant ? ` · ${item.variant}` : ''}`
        : `Item #${(line.orderItemIndex ?? 0) + 1}`;
      return `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #eee">${name}</td>
        <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee">${line.quantity}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${formatCurrency(line.unitPrice ?? 0)}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee;color:#b20202">−${formatCurrency(line.amount ?? 0)}</td>
      </tr>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>${refund.receiptNumber}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;width:380px;margin:0 auto}</style>
    </head><body>
      <div style="text-align:center;margin-bottom:12px">
        <strong style="font-size:14px;letter-spacing:2px">DRINKS HARBOUR</strong><br>
        <span style="font-size:11px;font-weight:bold;color:#b20202">RETURN RECEIPT</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px;margin-bottom:8px">
        <tr><td style="color:#555;width:90px">Return #</td><td><strong>${refund.receiptNumber || '—'}</strong></td></tr>
        <tr><td style="color:#555">Original</td><td>${parentOrder.receiptNumber || '—'}</td></tr>
        <tr><td style="color:#555">Date</td><td>${refundDate}</td></tr>
        <tr><td style="color:#555">Cashier</td><td>${cashierName}</td></tr>
        <tr><td style="color:#555">Refund via</td><td style="text-transform:capitalize">${(refund.paymentMethod || '—').replace(/_/g, ' ')}</td></tr>
        ${refund.reason ? `<tr><td style="color:#555">Reason</td><td>${refund.reason}</td></tr>` : ''}
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px">
        <thead><tr style="color:#888"><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:2px solid #333;margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;color:#b20202">
        <span>TOTAL RETURNED</span><span>−${formatCurrency(refund.totalRefunded)}</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <div style="text-align:center;font-size:10px;color:#666">Thank you for your patience.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="flex h-full flex-col bg-white">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
            <PiArrowCounterClockwise className="h-4 w-4 text-[#b20202]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#b20202]">{refund.receiptNumber || 'Return'}</p>
            <p className="text-[10px] text-gray-400">Return Receipt</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <PiX className="h-4 w-4" />
        </button>
      </div>

      {/* Meta */}
      <div className="shrink-0 border-b border-gray-100 bg-gray-50/50 px-5 py-3 space-y-1.5">
        {[
          ['Original order',  parentOrder.receiptNumber || '—'],
          ['Return date',     refundDate],
          ['Cashier',         cashierName],
          ['Refund via',      (refund.paymentMethod || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
          ...(refund.reason ? [['Reason', refund.reason]] : []),
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-800 capitalize">{val}</span>
          </div>
        ))}
      </div>

      {/* Returned items */}
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-gray-100 bg-white px-5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Items Returned</p>
        </div>
        <div className="divide-y divide-gray-50">
          {(refund.items || []).map((line: HistoryRefundLine, i: number) => {
            const item = line.orderItemIndex != null ? parentOrder.items?.[line.orderItemIndex] : undefined;
            const name = item
              ? `${item.name}${item.variant ? ` · ${item.variant}` : ''}`
              : `Item #${(line.orderItemIndex ?? i) + 1}`;

            return (
              <div key={i} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-[#b20202]/30 bg-red-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#b20202]">
                        ×{line.quantity}
                      </span>
                      <span>×</span>
                      <span className="tabular-nums">{formatCurrency(line.unitPrice ?? (item?.priceAtPurchase ?? 0))} / Units</span>
                      {(line.discPct ?? 0) > 0 && (
                        <span className="text-amber-600">(−{line.discPct}% deduction)</span>
                      )}
                    </div>
                    {line.restock === false && (
                      <p className="mt-0.5 text-[10px] text-amber-600">⚠ Not restocked</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#b20202]">
                    −{formatCurrency(line.amount ?? 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div className="shrink-0 border-t border-gray-200 px-5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-gray-900">Total Returned</span>
          <span className="text-base font-bold text-[#b20202]">−{formatCurrency(refund.totalRefunded)}</span>
        </div>
        <p className="mt-0.5 text-xs capitalize text-gray-400">
          Refunded via {(refund.paymentMethod || 'original method').replace(/_/g, ' ')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-3">
        <button
          type="button"
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <PiPrinter className="h-4 w-4" /> Print Receipt
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <PiReceipt className="h-4 w-4" /> View Order
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function POSHistory() {
  const router = useRouter();
  const { token } = usePOSAuth();
  const { addItem } = usePOSCart();

  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<HistoryOrder | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<{ refund: HistoryRefund; order: HistoryOrder } | null>(null);
  const [voiding, setVoiding] = useState(false);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  const fetchOrders = useCallback(() => {
    if (!token) return;
    setLoading(true);
    // Get the current open session, then load its orders
    posApi.getSessionInfo(token)
      .then(async (info) => {
        const sessionId = info.currentSession?._id;
        if (!sessionId) { setOrders([]); return; }
        const data = await posApi.getSessionOrders(token, sessionId);
        setOrders((data || []) as HistoryOrder[]);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Helpers for sorting
  function getCashierName(o: HistoryOrder) {
    return o.posStaff
      ? (o.posStaff.posName || `${o.posStaff.firstName} ${o.posStaff.lastName}`).trim()
      : '';
  }
  function getCustomerName(o: HistoryOrder) {
    if (!o.customer?.firstName || o.customer.firstName === 'Walk-in') return '';
    return `${o.customer.firstName} ${o.customer.lastName || ''}`.trim();
  }

  // Client-side filter + search + sort
  const filtered = useMemo(() => {
    let list = [...orders];

    // ── Filter by status ──
    if (filter === 'paid')   list = list.filter((o) => !o.isVoided);
    if (filter === 'voided') list = list.filter((o) =>  o.isVoided);

    // ── Search across key fields ──
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        o.receiptNumber?.toLowerCase().includes(q)          ||
        o.orderNumber?.toLowerCase().includes(q)            ||
        getCustomerName(o).toLowerCase().includes(q)        ||
        getCashierName(o).toLowerCase().includes(q)         ||
        o.paymentMethod?.toLowerCase().replace(/_/g,' ').includes(q)
      );
    }

    // ── Sort ──
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'date':
          cmp = new Date(a.createdAt || a.placedAt).getTime() -
                new Date(b.createdAt || b.placedAt).getTime();
          break;
        case 'receipt':
          cmp = (a.receiptNumber || '').localeCompare(b.receiptNumber || '');
          break;
        case 'customer':
          cmp = getCustomerName(a).localeCompare(getCustomerName(b));
          break;
        case 'cashier':
          cmp = getCashierName(a).localeCompare(getCashierName(b));
          break;
        case 'total':
          cmp = (a.total ?? 0) - (b.total ?? 0);
          break;
        case 'method':
          cmp = (a.paymentMethod || '').localeCompare(b.paymentMethod || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [orders, filter, search, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function selectOrder(o: HistoryOrder) {
    setSelectedRefund(null);
    setSelectedOrder((prev) => (prev?._id === o._id ? null : o));
  }

  function selectRefund(refund: HistoryRefund, order: HistoryOrder) {
    setSelectedOrder(null);
    setSelectedRefund({ refund, order });
  }

  async function handleVoid(o: HistoryOrder) {
    if (!token) return;
    setVoiding(true);
    try {
      await posApi.voidOrder(token, o._id, 'Voided from POS history');
      toast.success('Order voided');
      fetchOrders();
      setSelectedOrder(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVoiding(false);
    }
  }

  // Called by POSOrderDetail after it successfully processes the refund internally
  // (lines is empty — it's just a signal to refresh the order list)
  function handleRefund(
    o: HistoryOrder,
    _lines: { orderItemIndex: number; quantity: number }[],
    _refundPaymentMethod?: string
  ) {
    fetchOrders();
    // Keep the order selected so the Returns tab can be seen
    // The return receipt is shown inside POSOrderDetail
  }

  function handleLoadOrder(o: HistoryOrder) {
    if (!o.items?.length) return toast.error('No items to load');
    o.items.forEach((item, i) => {
      addItem({
        subProductId: `${o._id}_${i}`,
        productId: o._id,
        name: item.name,
        variant: item.variant || '',
        sku: '',
        image: undefined,
        price: item.priceAtPurchase,
        quantity: item.quantity,
        discount: 0,
        stock: 999,
      });
    });
    toast.success('Order loaded into cart');
    router.push(routes.pos.sell);
  }

  function formatOrderDate(d: string) {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
  }

  return (
    <div className="flex h-dvh flex-col bg-[#f0f0f0]">

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.push(routes.pos.sell)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <PiArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-xl">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search receipt, order, customer, cashier, payment…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm outline-none focus:border-[#b20202] focus:bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowFilterMenu((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {FILTER_LABELS[filter]}
            <PiCaretDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          {showFilterMenu && (
            <FilterDropdown
              value={filter}
              onChange={(f) => { setFilter(f); setPage(1); setSelectedOrder(null); }}
              onClose={() => setShowFilterMenu(false)}
            />
          )}
        </div>

        {/* Pagination */}
        <div className="flex shrink-0 items-center gap-1 text-sm text-gray-600">
          <span className="px-2 text-gray-500">
            {filtered.length > 0 ? `${filtered.length} order${filtered.length !== 1 ? 's' : ''}` : '0 orders'}
            {totalPages > 1 && ` · p${page}/${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            <PiCaretLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            <PiCaretRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: order table ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {([
                      { col: 'date'     as SortCol, label: 'Date' },
                      { col: 'receipt'  as SortCol, label: 'Receipt' },
                      { col: null,                  label: 'Order #' },
                      { col: 'customer' as SortCol, label: 'Customer' },
                      { col: 'cashier'  as SortCol, label: 'Cashier' },
                      { col: 'total'    as SortCol, label: 'Total' },
                      { col: 'method'   as SortCol, label: 'Method' },
                      { col: null,                  label: 'Status' },
                    ]).map(({ col, label }) =>
                      col ? (
                        <th
                          key={label}
                          className="cursor-pointer select-none px-4 py-3 hover:text-gray-600"
                          onClick={() => handleSort(col)}
                        >
                          <span className="flex items-center gap-1">
                            {label}
                            {sortCol === col ? (
                              sortDir === 'asc'
                                ? <PiArrowUp className="h-3 w-3 text-[#b20202]" />
                                : <PiArrowDown className="h-3 w-3 text-[#b20202]" />
                            ) : (
                              <PiArrowsDownUp className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                        </th>
                      ) : (
                        <th key={label} className="px-4 py-3">{label}</th>
                      )
                    )}
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center text-sm text-gray-400">
                        {search ? `No orders match "${search}"` : 'No orders found'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((order) => { // eslint-disable-line
                      const isSelected = selectedOrder?._id === order._id;
                      const isRefundParent = selectedRefund?.order._id === order._id;
                      const isWalkin = !order.customer?.firstName || order.customer.firstName === 'Walk-in';
                      const customerName = isWalkin
                        ? ''
                        : `${order.customer!.firstName} ${order.customer!.lastName || ''}`.trim();
                      const cashierName = getCashierName(order);
                      return (
                        <React.Fragment key={order._id}>
                        <tr
                          onClick={() => selectOrder(order)}
                          className={`cursor-pointer border-b border-gray-100 transition-colors ${
                            isSelected
                              ? 'bg-[#b20202] text-white'
                              : isRefundParent
                              ? 'bg-red-50/40'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <td className={`px-4 py-3 text-xs ${isSelected ? 'text-red-100' : 'text-gray-500'}`}>
                            {formatOrderDate(order.createdAt || order.placedAt)}
                          </td>
                          <td className={`px-4 py-3 font-medium ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                            {order.receiptNumber || '—'}
                          </td>
                          <td className={`px-4 py-3 ${isSelected ? 'text-red-100' : 'text-gray-600'}`}>
                            {order.orderNumber || '—'}
                          </td>
                          <td className={`px-4 py-3 ${isSelected ? 'text-red-100' : 'text-gray-600'}`}>
                            {customerName || <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 ${isSelected ? 'text-red-100' : 'text-gray-600'}`}>
                            {cashierName || <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {formatCurrency(order.total)}
                          </td>
                          <td className={`px-4 py-3 text-xs capitalize ${isSelected ? 'text-red-100' : 'text-gray-500'}`}>
                            {order.paymentMethod?.replace(/_/g, ' ') || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {order.isVoided ? (
                              <span className={`text-xs font-medium ${isSelected ? 'text-red-200' : 'text-red-500'}`}>Voided</span>
                            ) : order.paymentStatus === 'refunded' ? (
                              <span className={`text-xs font-medium ${isSelected ? 'text-red-100' : 'text-red-500'}`}>Refunded</span>
                            ) : order.paymentStatus === 'partially_refunded' ? (
                              <span className={`text-xs font-medium ${isSelected ? 'text-amber-200' : 'text-amber-600'}`}>Part. Returned</span>
                            ) : (
                              <span className={`text-xs font-medium ${isSelected ? 'text-red-100' : 'text-emerald-600'}`}>Paid</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!order.isVoided && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleVoid(order); }}
                                className={`transition-colors ${isSelected ? 'text-red-200 hover:text-white' : 'text-gray-300 hover:text-red-500'}`}
                                disabled={voiding}
                              >
                                <PiTrash className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* ── Return sub-rows ── */}
                        {(order.refunds || []).map((refund, ri) => {
                          // Build items summary from refund lines matched to order items
                          const itemsSummary = (refund.items || [])
                            .map((line: HistoryRefundLine) => {
                              const idx  = line.orderItemIndex;
                              const item = idx != null ? order.items?.[idx] : undefined;
                              const name = item
                                ? `${item.name}${item.variant ? ` · ${item.variant}` : ''}`
                                : idx != null ? `Item #${idx + 1}` : 'Item';
                              return `${line.quantity}× ${name}`;
                            })
                            .join(', ');

                          const refundCashier = refund.refundedBy
                            ? (refund.refundedBy.posName || `${refund.refundedBy.firstName} ${refund.refundedBy.lastName}`)
                            : '';

                          const isRefundSelected = selectedRefund?.refund === refund || selectedRefund?.refund?.receiptNumber === refund.receiptNumber;

                          return (
                            <tr
                              key={`${order._id}-refund-${ri}`}
                              onClick={() => selectRefund(refund, order)}
                              className={`cursor-pointer border-b border-red-100 transition-colors ${
                                isRefundSelected
                                  ? 'bg-[#b20202]/10 ring-1 ring-inset ring-[#b20202]/20'
                                  : 'bg-red-50/60 hover:bg-red-50'
                              }`}
                            >
                              {/* Date — refund date */}
                              <td className="py-2 pl-8 pr-4 text-[11px] text-red-400">
                                {formatOrderDate(refund.refundedAt)}
                              </td>

                              {/* RTN number */}
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1.5">
                                  <PiArrowCounterClockwise className="h-3.5 w-3.5 shrink-0 text-[#b20202]" />
                                  <span className="text-xs font-semibold text-[#b20202]">
                                    {refund.receiptNumber || '—'}
                                  </span>
                                </div>
                              </td>

                              {/* Original order ref */}
                              <td className="px-4 py-2 text-[11px] text-red-400">
                                ↳ {order.receiptNumber}
                              </td>

                              {/* Items returned */}
                              <td className="px-4 py-2 text-[11px] text-gray-600" colSpan={2}>
                                <p className="truncate max-w-[260px]" title={itemsSummary}>
                                  {itemsSummary || '—'}
                                </p>
                                {refundCashier && (
                                  <p className="text-[10px] text-gray-400">by {refundCashier}</p>
                                )}
                              </td>

                              {/* Amount — negative */}
                              <td className="px-4 py-2 font-semibold text-[#b20202] tabular-nums text-xs">
                                −{formatCurrency(refund.totalRefunded)}
                              </td>

                              {/* Method */}
                              <td className="px-4 py-2 text-[11px] capitalize text-red-400">
                                {refund.paymentMethod?.replace(/_/g, ' ') || '—'}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-2">
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-[#b20202]">
                                  Return
                                </span>
                              </td>

                              <td className="px-4 py-2" />
                            </tr>
                          );
                        })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right: order detail or return detail ── */}
        <div className={`flex shrink-0 flex-col border-l border-gray-200 bg-white transition-all ${
          selectedOrder || selectedRefund ? 'w-[460px]' : 'w-[280px]'
        }`}>
          {selectedRefund ? (
            <ReturnDetailPanel
              refund={selectedRefund.refund}
              parentOrder={selectedRefund.order}
              onClose={() => {
                // "View Order" closes the refund and opens the parent order
                const o = selectedRefund.order;
                setSelectedRefund(null);
                setSelectedOrder(o);
              }}
            />
          ) : selectedOrder ? (
            <POSOrderDetail
              order={selectedOrder as any}
              onRefund={handleRefund as any}
              onLoadOrder={handleLoadOrder}
              onClose={() => setSelectedOrder(null)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-sm text-gray-400">
                Select an order or return to see details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
