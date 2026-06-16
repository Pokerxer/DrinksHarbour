'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  getAllOrders,
  getSessionOrders,
  getSessionInfo,
  voidOrder,
} from '@/app/shared/point-of-sale/offline/api';
import { runSyncEngine } from '@/app/shared/point-of-sale/offline/sync';
import { useOnlineStatus } from '@/app/shared/point-of-sale/offline/use-online-status';
import { usePOSAuth, usePOSCart } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSOrderDetail from '@/app/shared/point-of-sale/components/pos-order-detail';
import POSSessionBar from '@/app/shared/point-of-sale/components/pos-session-bar';
import { routes } from '@/config/routes';
import {
  PiArrowLeft,
  PiArrowCounterClockwise,
  PiMagnifyingGlass,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiX,
  PiTrash,
  PiPrinter,
  PiReceipt,
  PiShoppingCart,
  PiCurrencyNgn,
  PiWarningCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  warehouse?: { _id: string; name: string; code: string } | null;
}

function getOrderWarehouse(order: { items?: OrderItem[] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}

interface RefundLine {
  orderItemIndex?: number;
  quantity: number;
  unitPrice?: number;
  discPct?: number;
  amount?: number;
  restock?: boolean;
  reason?: string;
}

interface Refund {
  receiptNumber?: string;
  items: RefundLine[];
  totalRefunded: number;
  reason?: string;
  paymentMethod?: string;
  refundedBy?: { firstName: string; lastName: string; posName?: string };
  refundedAt: string;
}

interface SellOrder {
  _id: string;
  receiptNumber?: string;
  orderNumber?: string;
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  placedAt: string;
  createdAt: string;
  posStaff?: {
    _id: string;
    firstName: string;
    lastName: string;
    posName?: string;
  };
  isVoided?: boolean;
  refunds?: Refund[];
  items?: OrderItem[];
  status?: string;
  session?: string;
}

type Filter = 'all' | 'paid' | 'voided';
type SortCol = 'date' | 'receipt' | 'customer' | 'cashier' | 'total' | 'method';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 15;

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  paid: 'Paid',
  voided: 'Voided',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCashierName(o: SellOrder) {
  return o.posStaff
    ? (
        o.posStaff.posName || `${o.posStaff.firstName} ${o.posStaff.lastName}`
      ).trim()
    : '';
}
function getCustomerName(o: SellOrder) {
  if (!o.customer?.firstName || o.customer.firstName === 'Walk-in') return '';
  return `${o.customer.firstName} ${o.customer.lastName || ''}`.trim();
}
function formatOrderDate(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
}
function capitalize(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [onClose]);

  const options: { value: Filter; label: string; dot: string }[] = [
    { value: 'all', label: 'All', dot: 'bg-gray-400' },
    { value: 'paid', label: 'Paid', dot: 'bg-emerald-500' },
    { value: 'voided', label: 'Voided', dot: 'bg-red-400' },
  ];

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            onChange(o.value);
            onClose();
          }}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${value === o.value ? 'bg-red-50 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <span className={`h-2 w-2 rounded-full ${o.dot}`} />
          {o.label}
          {value === o.value && (
            <span className="ml-auto text-[#b20202]">✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Sort header cell ──────────────────────────────────────────────────────────
function SortTh({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className,
}: {
  col: SortCol | null;
  label: string;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  className?: string;
}) {
  if (!col)
    return (
      <th
        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 ${className ?? ''}`}
      >
        {label}
      </th>
    );
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:text-gray-700 ${active ? 'text-[#b20202]' : 'text-gray-400'} ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <PiArrowUp className="h-3 w-3" />
          ) : (
            <PiArrowDown className="h-3 w-3" />
          )
        ) : (
          <PiArrowsDownUp className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ── Return detail panel ───────────────────────────────────────────────────────
function ReturnDetailPanel({
  refund,
  parentOrder,
  onClose,
  onViewOrder,
}: {
  refund: Refund;
  parentOrder: SellOrder;
  onClose: () => void;
  onViewOrder: () => void;
}) {
  const cashierName = refund.refundedBy
    ? refund.refundedBy.posName ||
      `${refund.refundedBy.firstName} ${refund.refundedBy.lastName}`
    : '—';
  const refundDate = new Date(refund.refundedAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function handlePrint() {
    const win = window.open(
      '',
      '_blank',
      'width=400,height=700,scrollbars=yes'
    );
    if (!win) return;
    const rows = (refund.items || [])
      .map((line) => {
        const item =
          line.orderItemIndex != null
            ? parentOrder.items?.[line.orderItemIndex]
            : undefined;
        const name = item
          ? `${item.name}${item.variant ? ` · ${item.variant}` : ''}`
          : `Item #${(line.orderItemIndex ?? 0) + 1}`;
        return `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #eee">${name}</td>
        <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee">${line.quantity}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${formatCurrency(line.unitPrice ?? 0)}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee;color:#b20202">−${formatCurrency(line.amount ?? 0)}</td>
      </tr>`;
      })
      .join('');
    win.document
      .write(`<!DOCTYPE html><html><head><title>${refund.receiptNumber}</title>
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
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
            <PiArrowCounterClockwise className="h-4 w-4 text-[#b20202]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#b20202]">
              {refund.receiptNumber || 'Return'}
            </p>
            <p className="text-[10px] text-gray-400">Return Receipt</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 space-y-1.5 border-b border-gray-100 bg-gray-50/50 px-5 py-3">
        {(
          [
            ['Original order', parentOrder.receiptNumber || '—'],
            ['Return date', refundDate],
            ['Cashier', cashierName],
            [
              'Refund via',
              capitalize((refund.paymentMethod || '—').replace(/_/g, ' ')),
            ],
            ...(refund.reason ? [['Reason', refund.reason]] : []),
          ] as [string, string][]
        ).map(([label, val]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-800">{val}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-gray-100 px-5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Items Returned
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {(refund.items || []).map((line, i) => {
            const item =
              line.orderItemIndex != null
                ? parentOrder.items?.[line.orderItemIndex]
                : undefined;
            const name = item
              ? `${item.name}${item.variant ? ` · ${item.variant}` : ''}`
              : `Item #${(line.orderItemIndex ?? i) + 1}`;
            return (
              <div key={i} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-[#b20202]/30 bg-red-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#b20202]">
                        ×{line.quantity}
                      </span>
                      <span>×</span>
                      <span className="tabular-nums">
                        {formatCurrency(
                          line.unitPrice ?? item?.priceAtPurchase ?? 0
                        )}{' '}
                        / unit
                      </span>
                      {(line.discPct ?? 0) > 0 && (
                        <span className="text-amber-600">
                          (−{line.discPct}% deduction)
                        </span>
                      )}
                    </div>
                    {line.restock === false && (
                      <p className="mt-0.5 text-[10px] text-amber-600">
                        ⚠ Not restocked
                      </p>
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

      <div className="shrink-0 border-t border-gray-200 px-5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-gray-900">
            Total Returned
          </span>
          <span className="text-base font-bold text-[#b20202]">
            −{formatCurrency(refund.totalRefunded)}
          </span>
        </div>
        <p className="mt-0.5 text-xs capitalize text-gray-400">
          Refunded via{' '}
          {(refund.paymentMethod || 'original method').replace(/_/g, ' ')}
        </p>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-3">
        <button
          type="button"
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <PiPrinter className="h-4 w-4" /> Print
        </button>
        <button
          type="button"
          onClick={onViewOrder}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <PiReceipt className="h-4 w-4" /> View Order
        </button>
      </div>
    </div>
  );
}

// ── Session summary strip ─────────────────────────────────────────────────────
function SessionSummaryStrip({ orders }: { orders: SellOrder[] }) {
  const paid = orders.filter((o) => !o.isVoided);
  const voided = orders.length - paid.length;
  const revenue = paid.reduce((s, o) => s + (o.total ?? 0), 0);

  const byMethod: Record<string, number> = {};
  paid.forEach((o) => {
    const m = (o.paymentMethod || 'other').replace(/_/g, ' ');
    byMethod[m] = (byMethod[m] ?? 0) + o.total;
  });
  const methodEntries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2">
      <div className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
        <PiShoppingCart className="h-3.5 w-3.5 text-gray-400" />
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
            Orders
          </p>
          <p className="text-sm font-bold tabular-nums leading-tight text-gray-800">
            {paid.length}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#b20202]/5 px-3 py-1.5">
        <PiCurrencyNgn className="h-3.5 w-3.5 text-[#b20202]/70" />
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#b20202]/60">
            Revenue
          </p>
          <p className="text-sm font-bold tabular-nums leading-tight text-[#b20202]">
            {formatCurrency(revenue)}
          </p>
        </div>
      </div>

      {methodEntries.length > 0 && (
        <div className="h-6 w-px shrink-0 bg-gray-200" />
      )}

      {methodEntries.map(([method, total]) => (
        <div
          key={method}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5"
        >
          <div>
            <p className="text-[9px] font-semibold uppercase capitalize tracking-widest text-gray-400">
              {method}
            </p>
            <p className="text-sm font-bold tabular-nums leading-tight text-gray-700">
              {formatCurrency(total)}
            </p>
          </div>
        </div>
      ))}

      {voided > 0 && (
        <>
          <div className="h-6 w-px shrink-0 bg-gray-200" />
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5">
            <PiWarningCircle className="h-3.5 w-3.5 text-red-400" />
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-red-400">
                Voided
              </p>
              <p className="text-sm font-bold tabular-nums leading-tight text-red-600">
                {voided}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({
  order,
  selected,
}: {
  order: SellOrder;
  selected: boolean;
}) {
  if (order.isVoided)
    return (
      <span
        className={`text-xs font-medium ${selected ? 'text-red-200' : 'text-red-500'}`}
      >
        Voided
      </span>
    );
  if (order.paymentStatus === 'refunded')
    return (
      <span
        className={`text-xs font-medium ${selected ? 'text-orange-200' : 'text-orange-500'}`}
      >
        Refunded
      </span>
    );
  if (order.paymentStatus === 'partially_refunded')
    return (
      <span
        className={`text-xs font-medium ${selected ? 'text-amber-200' : 'text-amber-600'}`}
      >
        Part. Returned
      </span>
    );
  return (
    <span
      className={`text-xs font-medium ${selected ? 'text-red-100' : 'text-emerald-600'}`}
    >
      Paid
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function POSSellOrders() {
  const router = useRouter();
  const { token, terminal } = usePOSAuth();
  const { addItem } = usePOSCart();

  const isOnline = useOnlineStatus();
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scope, setScope] = useState<'session' | 'all'>('session');
  const [orders, setOrders] = useState<SellOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<SellOrder | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<{
    refund: Refund;
    order: SellOrder;
  } | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const t = terminal ?? 'retail';
      router.replace(`${routes.pos.lock}?terminal=${t}`);
    }
  }, [hydrated, token, terminal, router]);

  useEffect(() => {
    if (!token) return;
    getSessionInfo(token)
      .then((data) => {
        if (data?.sessionId) setSessionId(data.sessionId);
      })
      .catch(() => {});
  }, [token]);

  const fetchOrders = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const req =
      scope === 'session' && sessionId
        ? getSessionOrders(token, sessionId)
        : getAllOrders(token);
    req
      .then((data) => setOrders((data || []) as SellOrder[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, sessionId, scope]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // When network is restored: sync queued offline orders then refresh the list
  useEffect(() => {
    if (!isOnline || !token) return;
    runSyncEngine(token).then(() => fetchOrders());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, token]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  async function handleVoid(o: SellOrder) {
    if (!token) return;
    setVoiding(true);
    try {
      await voidOrder(token, o._id, 'Voided from POS');
      toast.success('Order voided');
      fetchOrders();
      if (selectedOrder?._id === o._id) setSelectedOrder(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to void order');
    } finally {
      setVoiding(false);
    }
  }

  function handleLoadOrder(o: SellOrder) {
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
    router.push(routes.pos.cashierSell);
  }

  function selectOrder(o: SellOrder) {
    setSelectedRefund(null);
    setSelectedOrder((prev) => (prev?._id === o._id ? null : o));
  }
  function selectRefund(refund: Refund, order: SellOrder) {
    setSelectedOrder(null);
    setSelectedRefund((prev) =>
      prev?.refund === refund ? null : { refund, order }
    );
  }

  const filtered = useMemo(() => {
    let list = [...orders];
    if (filter === 'paid') list = list.filter((o) => !o.isVoided);
    if (filter === 'voided') list = list.filter((o) => o.isVoided);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.receiptNumber?.toLowerCase().includes(q) ||
          o.orderNumber?.toLowerCase().includes(q) ||
          getCustomerName(o).toLowerCase().includes(q) ||
          getCashierName(o).toLowerCase().includes(q) ||
          o.paymentMethod?.toLowerCase().replace(/_/g, ' ').includes(q)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'date':
          cmp =
            new Date(a.createdAt || a.placedAt).getTime() -
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

  if (!hydrated || !token) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
      </div>
    );
  }

  const rightPanel = selectedRefund ? (
    <ReturnDetailPanel
      refund={selectedRefund.refund}
      parentOrder={selectedRefund.order}
      onClose={() => setSelectedRefund(null)}
      onViewOrder={() => {
        setSelectedOrder(selectedRefund.order);
        setSelectedRefund(null);
      }}
    />
  ) : selectedOrder ? (
    <POSOrderDetail
      order={selectedOrder as any}
      onRefund={() => {
        fetchOrders();
      }}
      onLoadOrder={handleLoadOrder as any}
      onClose={() => setSelectedOrder(null)}
    />
  ) : (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <p className="text-sm text-gray-400">Select an order to see details</p>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-[#f0f0f0]">
      <POSSessionBar />

      {/* ── Top bar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={() => router.push(routes.pos.cashierSell)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <PiArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex shrink-0 items-center rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => {
              setScope('session');
              setPage(1);
              setSelectedOrder(null);
              setSelectedRefund(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${scope === 'session' ? 'bg-white text-[#b20202] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            This Session
          </button>
          <button
            type="button"
            onClick={() => {
              setScope('all');
              setPage(1);
              setSelectedOrder(null);
              setSelectedRefund(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${scope === 'all' ? 'bg-white text-[#b20202] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Orders
          </button>
        </div>

        <div className="relative min-w-0 flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search receipt, customer, cashier, payment…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm outline-none focus:border-[#b20202] focus:bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>

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
              onChange={(f) => {
                setFilter(f);
                setPage(1);
                setSelectedOrder(null);
              }}
              onClose={() => setShowFilterMenu(false)}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="px-1 text-xs text-gray-500">
            {filtered.length > 0
              ? `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`
              : '0 orders'}
            {totalPages > 1 && ` · p${page}/${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <PiCaretLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <PiCaretRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Session summary strip ── */}
      {scope === 'session' && !loading && orders.length > 0 && (
        <SessionSummaryStrip orders={orders} />
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: order table ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!isOnline && (
            <div className="mx-3 mb-2 mt-2 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              Offline — showing cached orders. Unsynced orders shown as{' '}
              <strong>OFF-###</strong>.
            </div>
          )}
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200 text-left">
                    <SortTh
                      col="date"
                      label="Date"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      col="receipt"
                      label="Receipt"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      col={null}
                      label="Order #"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      col="customer"
                      label="Customer"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      col="cashier"
                      label="Cashier"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      col="total"
                      label="Total"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      col="method"
                      label="Method"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Status
                    </th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-20 text-center text-sm text-gray-400"
                      >
                        {scope === 'session' && !sessionId
                          ? 'No open session — orders are session-scoped'
                          : search
                            ? `No orders match "${search}"`
                            : 'No orders found'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((order) => {
                      const isSelected = selectedOrder?._id === order._id;
                      const isRefundParent =
                        selectedRefund?.order._id === order._id;
                      const customerName = getCustomerName(order);
                      const cashierName = getCashierName(order);

                      return (
                        <React.Fragment key={order._id}>
                          {/* ── Order row ── */}
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
                            <td
                              className={`px-4 py-3 text-xs ${isSelected ? 'text-red-100' : 'text-gray-500'}`}
                            >
                              {formatOrderDate(
                                order.createdAt || order.placedAt
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 font-medium ${isSelected ? 'text-white' : 'text-gray-800'}`}
                            >
                              {order.receiptNumber || '—'}
                              {(() => {
                                const wh = getOrderWarehouse(order);
                                return wh ? (
                                  <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                    {wh.name}
                                  </span>
                                ) : null;
                              })()}
                            </td>
                            <td
                              className={`px-4 py-3 ${isSelected ? 'text-red-100' : 'text-gray-500'}`}
                            >
                              {order.orderNumber || '—'}
                            </td>
                            <td
                              className={`px-4 py-3 ${isSelected ? 'text-red-100' : 'text-gray-600'}`}
                            >
                              {customerName || (
                                <span
                                  className={
                                    isSelected
                                      ? 'text-red-200'
                                      : 'text-gray-300'
                                  }
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 ${isSelected ? 'text-red-100' : 'text-gray-600'}`}
                            >
                              {cashierName || (
                                <span
                                  className={
                                    isSelected
                                      ? 'text-red-200'
                                      : 'text-gray-300'
                                  }
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold tabular-nums ${isSelected ? 'text-white' : 'text-gray-900'}`}
                            >
                              {formatCurrency(order.total)}
                            </td>
                            <td
                              className={`px-4 py-3 text-xs capitalize ${isSelected ? 'text-red-100' : 'text-gray-500'}`}
                            >
                              {order.paymentMethod?.replace(/_/g, ' ') || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                order={order}
                                selected={isSelected}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!order.isVoided && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVoid(order);
                                  }}
                                  disabled={voiding}
                                  className={`transition-colors ${isSelected ? 'text-red-200 hover:text-white' : 'text-gray-300 hover:text-red-500'}`}
                                >
                                  <PiTrash className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* ── Refund sub-rows ── */}
                          {(order.refunds || []).map((refund, ri) => {
                            const itemsSummary = (refund.items || [])
                              .map((line) => {
                                const item =
                                  line.orderItemIndex != null
                                    ? order.items?.[line.orderItemIndex]
                                    : undefined;
                                const name = item
                                  ? `${item.name}${item.variant ? ` · ${item.variant}` : ''}`
                                  : `Item #${(line.orderItemIndex ?? 0) + 1}`;
                                return `${line.quantity}× ${name}`;
                              })
                              .join(', ');

                            const refundCashier = refund.refundedBy
                              ? refund.refundedBy.posName ||
                                `${refund.refundedBy.firstName} ${refund.refundedBy.lastName}`
                              : '';

                            const isRefundSelected =
                              selectedRefund?.refund === refund ||
                              selectedRefund?.refund?.receiptNumber ===
                                refund.receiptNumber;

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
                                <td className="py-2 pl-8 pr-4 text-[11px] text-red-400">
                                  {formatOrderDate(refund.refundedAt)}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <PiArrowCounterClockwise className="h-3.5 w-3.5 shrink-0 text-[#b20202]" />
                                    <span className="text-xs font-semibold text-[#b20202]">
                                      {refund.receiptNumber || '—'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-[11px] text-red-400">
                                  ↳ {order.receiptNumber}
                                </td>
                                <td
                                  className="px-4 py-2 text-[11px] text-gray-600"
                                  colSpan={2}
                                >
                                  <p
                                    className="max-w-[260px] truncate"
                                    title={itemsSummary}
                                  >
                                    {itemsSummary || '—'}
                                  </p>
                                </td>
                                <td className="px-4 py-2 text-xs font-bold tabular-nums text-[#b20202]">
                                  −{formatCurrency(refund.totalRefunded)}
                                </td>
                                <td className="px-4 py-2 text-[11px] capitalize text-gray-500">
                                  {(refund.paymentMethod || '').replace(
                                    /_/g,
                                    ' '
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-[10px] font-semibold text-[#b20202]">
                                    Refund
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-[10px] text-gray-400">
                                    {refundCashier}
                                  </span>
                                </td>
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

        {/* ── Right: detail panel (xl+) ── */}
        <div className="hidden w-[420px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white xl:flex xl:w-[460px]">
          {rightPanel}
        </div>
      </div>

      {/* ── Mobile: full-screen overlay ── */}
      {(selectedOrder || selectedRefund) && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white xl:hidden">
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-2">
            <button
              type="button"
              onClick={() => {
                setSelectedOrder(null);
                setSelectedRefund(null);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <PiArrowLeft className="h-4 w-4" />
              Back to list
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            {rightPanel}
          </div>
        </div>
      )}
    </div>
  );
}
