'use client';

import {
  cashRefunded,
  netSales,
  returnDeduction,
  roundingAmount,
  tipAmount,
  type NetSalesOrder,
} from './report-totals';
import { orderStatus, summariseOrders, type OrderStatus } from './orders-summary';
import { paymentAttribution } from './analysis/measures';
import { posStore } from '@/utils/print/pos-documents';

import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { PageMeta } from '@/app/shared/point-of-sale/api';
import { usePOSAuth, usePOSShopScope } from '@/app/shared/point-of-sale/store';
import { historyAccess } from './shop-entry';
import { ShopHistorySelector } from './components/shop-history-selector';
import { useSession } from 'next-auth/react';
import { POSTenant } from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import {
  PiMagnifyingGlass, PiX, PiArrowsClockwise,
  PiCaretLeft, PiCaretRight, PiCaretDown, PiCaretUp,
  PiShoppingCart, PiCurrencyNgn, PiReceipt, PiTrendUp,
  PiArrowUp, PiArrowDown, PiArrowsDownUp,
  PiPrinter, PiArrowCounterClockwise, PiWarningCircle,
  PiCheckSquare, PiSquare, PiInfo, PiFunnel, PiStack,
  PiStar, PiFloppyDisk, PiTrash, PiCalendar, PiDownloadSimple,
  PiHandHeart,
} from 'react-icons/pi';
import { printInvoices } from '@/utils/invoice';
import InvoicePreview from '@/components/InvoicePreview';
import DateTimeRange from './components/orders-date-range';
import { GroupItem, SortIcon } from '@/components/list-controls';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number; discountAmount?: number;
  warehouse?: { _id: string; name: string; code: string } | null;
}
interface OrderRefund {
  source?: 'sales' | 'pos';
  reason?: string;
  receiptNumber?: string; totalRefunded: number; paymentMethod?: string;
  refundedAt?: string;
  items?: { orderItemIndex: number; quantity: number; amount: number; unitPrice?: number }[];
}
interface PosOrder {
  // Authoritative net figures, computed server-side (services/posReportOrder).
  // `netSales` excludes gratuities and cash rounding; `total` includes both.
  netSales?: number;
  returnDeduction?: number;
  /** Value of goods restocked through Sales — a return that moved no cash. */
  salesReturnValue?: number;
  /** The subset of returns actually paid back in cash. */
  totalRefunds?: number;
  tipAmount?: number;
  totalTips?: number;
  roundingAmount?: number;
  totalRounding?: number;
  lineDiscountTotal?: number;
  returnStatus?: string;
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number; totalAmount?: number; subtotal?: number; taxAmount?: number; discountTotal?: number;
  paymentMethod: string; paymentStatus?: string; status?: string; isVoided?: boolean;
  placedAt: string; createdAt: string;
  posStaff?: { _id: string; firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  session?: { _id: string; terminalType?: string; openedAt?: string } | null;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[]; change?: number; amount?: number };
  items?: OrderItem[];
  refunds?: OrderRefund[];
}

function getOrderWarehouse(order: { items?: OrderItem[] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}

type SortCol = 'date' | 'receipt' | 'customer' | 'cashier' | 'session' | 'method' | 'total' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'paid' | 'refunded' | 'voided';
type GroupKey = 'session' | 'cashier' | 'terminal' | 'customer' | 'status' | 'order_day' | 'order_week' | 'order_month' | 'order_quarter' | 'order_year';
interface SavedSearch { id: string; name: string; query: string; groupBy: GroupKey | null; }

const PAGE_SIZE = 50;
const SAVED_KEY = 'dh-pos-order-searches';

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card/POS', bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money', split: 'Split', other: 'Other',
};
const METHOD_COLOR: Record<string, string> = {
  cash:          'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  card:          'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  bank_transfer: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  mobile_money:  'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  split:         'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  other:         'bg-gray-100  text-gray-600',
};

const GROUP_LABELS: Record<GroupKey, string> = {
  session:'Session', cashier:'Cashier', terminal:'Point of Sale', customer:'Customer', status:'Status',
  order_day:'Day', order_week:'Week', order_month:'Month', order_quarter:'Quarter', order_year:'Year',
};

// ── Quick date presets ────────────────────────────────────────────────────────

function todayStr()     { return new Date().toISOString().slice(0, 10); }
function offsetDay(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function weekStart()    { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }
function monthStart()   { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function lastMonthStart() { const d = new Date(new Date().getFullYear(), new Date().getMonth()-1, 1); return d.toISOString().slice(0, 10); }
function lastMonthEnd()   { const d = new Date(new Date().getFullYear(), new Date().getMonth(), 0);   return d.toISOString().slice(0, 10); }

const DATE_PRESETS = [
  { label: 'Today',       from: () => todayStr(),       to: () => todayStr(),       tf: '00:00', tt: '23:59' },
  { label: 'Yesterday',   from: () => offsetDay(-1),    to: () => offsetDay(-1),    tf: '00:00', tt: '23:59' },
  { label: 'Last 7 days', from: () => offsetDay(-6),    to: () => todayStr(),       tf: '00:00', tt: '23:59' },
  { label: 'This week',   from: () => weekStart(),      to: () => todayStr(),       tf: '00:00', tt: '23:59' },
  { label: 'This month',  from: () => monthStart(),     to: () => todayStr(),       tf: '00:00', tt: '23:59' },
  { label: 'Last month',  from: () => lastMonthStart(), to: () => lastMonthEnd(),   tf: '00:00', tt: '23:59' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return !payload || typeof payload !== 'object' || !('exp' in payload) ||
      typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now();
  } catch { return true; }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDateTime(d: string) { return `${fmtDate(d)} · ${fmtTime(d)}`; }

function cashierLabel(u?: { firstName: string; lastName: string; posName?: string } | null) {
  return u ? (u.posName || `${u.firstName} ${u.lastName}`.trim()) : '—';
}
function customerLabel(c?: { firstName?: string; lastName?: string } | null) {
  return c?.firstName && c.firstName !== 'Walk-in' ? `${c.firstName} ${c.lastName || ''}`.trim() : null;
}
function sessionLabel(s?: { _id: string; terminalType?: string; openedAt?: string } | null) {
  if (!s) return '—';
  const term = (s.terminalType || 'retail').charAt(0).toUpperCase() + (s.terminalType || 'retail').slice(1);
  const date = s.openedAt ? new Date(s.openedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
  return date ? `${term} · ${date}` : term;
}

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  voided:       { label: 'Voided',         cls: 'bg-gray-100 text-gray-500' },
  returned:     { label: 'Returned',       cls: 'bg-red-50 text-red-600' },
  'part-returned': { label: 'Part. Returned', cls: 'bg-amber-50 text-amber-600' },
  paid:         { label: 'Paid',           cls: 'bg-emerald-50 text-emerald-600' },
};

function statusBadge(o: PosOrder) {
  return STATUS_META[orderStatus(o)];
}

const paymentLabel = (o: PosOrder): string => {
  const { method, split, shares } = paymentAttribution(o);
  const name = METHOD_LABEL[method] ?? method;
  if (!split) return name;
  return `${name} +${shares.length - 1} more (${shares
    .map((s) => `${METHOD_LABEL[s.method] ?? s.method} ${s.amount.toFixed(2)}`)
    .join(' + ')})`;
};

function startOfWeek(d = new Date()) { const r = new Date(d); r.setHours(0,0,0,0); r.setDate(r.getDate()-r.getDay()); return r; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function quarterLabel(d: Date) { return `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`; }
function weekLabel(d: Date) {
  const s = startOfWeek(d); const e = new Date(s); e.setDate(e.getDate()+6);
  return `${s.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}–${e.toLocaleDateString('en-GB',{month:'short',day:'2-digit',year:'numeric'})}`;
}

// Build an ISO-style datetime string for comparison
function toTs(date: string, time: string): number {
  if (!date) return 0;
  const t = time || '00:00';
  return new Date(`${date}T${t}:00`).getTime();
}

function loadSaved(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as SavedSearch[]; } catch { return []; }
}
function persistSaved(list: SavedSearch[]) { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); }

function printOrders(orders: PosOrder[], tenant?: POSTenant | null) {
  printInvoices(orders, posStore(tenant));
}

function exportCsv(rows: PosOrder[]) {
  const headers = ['Date', 'Time', 'Receipt #', 'Order #', 'Customer', 'Cashier', 'Session', 'Payment', 'Subtotal', 'Discount', 'Original Total', 'Money Refunded', 'Returns and Refunds Deduction', 'Net Sales', 'Status'];
  const lines = rows.map(o => {
    // Cash only. Summing every refund row counted goods restocked through Sales
    // as money handed back, so the column overstated payouts and disagreed with
    // the "Returns and Refunds Deduction" beside it.
    const refunded = cashRefunded(o);
    const { label } = statusBadge(o);
    return [
      fmtDate(o.placedAt || o.createdAt),
      fmtTime(o.placedAt || o.createdAt),
      o.receiptNumber ?? '', o.orderNumber ?? '',
      `"${customerLabel(o.customer) ?? 'Walk-in'}"`,
      `"${cashierLabel(o.posStaff)}"`,
      `"${sessionLabel(o.session)}"`,
      // A split-tender receipt is not one method. Reading `paymentMethod` alone
      // reported the first leg only, so a cash+card sale looked like a pure
      // cash sale in the export.
      paymentLabel(o),
      (o.subtotal ?? o.total ?? 0).toFixed(2),
      (o.discountTotal ?? 0).toFixed(2),
      (o.total ?? 0).toFixed(2),
      refunded.toFixed(2),
      returnDeduction(o).toFixed(2),
      netSales(o).toFixed(2),
      label,
    ].join(',');
  });
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pos-orders-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Group-by panel ────────────────────────────────────────────────────────────

function GroupPanel({
  groupBy, savedSearches,
  onSetGroupBy, onSave, onLoadSaved, onDeleteSaved, onClose,
}: {
  groupBy: GroupKey | null; savedSearches: SavedSearch[];
  onSetGroupBy: (g: GroupKey | null) => void;
  onSave: (name: string) => void; onLoadSaved: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void; onClose: () => void;
}) {
  const [groupDateOpen, setGroupDateOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [onClose]);

  // Same viewport clamp as shared/nav-dropdown-panel: the panel is positioned
  // off its trigger, so on a narrow window it would spill past the right edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reposition = () => {
      el.style.transform = '';
      const { left, right } = el.getBoundingClientRect();
      const shift = left < 12 ? 12 - left : right > window.innerWidth - 12 ? window.innerWidth - 12 - right : 0;
      el.style.transform = `translateX(${shift}px)`;
    };
    reposition();
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [groupDateOpen, showSaveInput]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 max-h-[70dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/8"
      style={{
        minWidth: 'min(460px, calc(100vw - 1.5rem))',
      }}
    >
      <div className="flex flex-col divide-y divide-gray-100 sm:flex-row sm:divide-x sm:divide-y-0">

        {/* Group By */}
        <div className="flex-1 p-4">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </p>
          <div className="space-y-0.5">
            <GroupItem gkey="session"  label="Session"       active={groupBy==='session'}  onToggle={onSetGroupBy} />
            <GroupItem gkey="cashier"  label="Cashier"       active={groupBy==='cashier'}  onToggle={onSetGroupBy} />
            <GroupItem gkey="terminal" label="Point of Sale" active={groupBy==='terminal'} onToggle={onSetGroupBy} />
            <GroupItem gkey="customer" label="Customer"      active={groupBy==='customer'} onToggle={onSetGroupBy} />
            <GroupItem gkey="status"   label="Status"        active={groupBy==='status'}   onToggle={onSetGroupBy} />
            <div>
              <button type="button" onClick={() => setGroupDateOpen(v => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <span className="flex items-center gap-2 text-xs"><PiCalendar className="h-3.5 w-3.5 text-gray-400" />Order Date</span>
                {groupDateOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
              </button>
              {groupDateOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <GroupItem gkey="order_day"     label="Day"     active={groupBy==='order_day'}     onToggle={onSetGroupBy} />
                  <GroupItem gkey="order_week"    label="Week"    active={groupBy==='order_week'}    onToggle={onSetGroupBy} />
                  <GroupItem gkey="order_month"   label="Month"   active={groupBy==='order_month'}   onToggle={onSetGroupBy} />
                  <GroupItem gkey="order_quarter" label="Quarter" active={groupBy==='order_quarter'} onToggle={onSetGroupBy} />
                  <GroupItem gkey="order_year"    label="Year"    active={groupBy==='order_year'}    onToggle={onSetGroupBy} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Saved searches */}
        <div className="flex-1 p-4">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <PiStar className="h-3.5 w-3.5" /> Saved Searches
          </p>
          <div className="space-y-1">
            {!showSaveInput ? (
              <button type="button" onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                <PiFloppyDisk className="h-3.5 w-3.5 text-gray-400" /> Save current search
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <input autoFocus type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key==='Enter' && saveName.trim()) { onSave(saveName.trim()); setSaveName(''); setShowSaveInput(false); }
                    if (e.key==='Escape') setShowSaveInput(false);
                  }}
                  placeholder="Name this search…"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#b20202]" />
                <div className="flex gap-1.5">
                  <button type="button"
                    onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setSaveName(''); setShowSaveInput(false); } }}
                    disabled={!saveName.trim()}
                    className="flex-1 rounded-lg bg-[#b20202] py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save</button>
                  <button type="button" onClick={() => { setSaveName(''); setShowSaveInput(false); }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}
            {savedSearches.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
                {savedSearches.map(s => (
                  <div key={s.id} className="flex items-center gap-1 group">
                    <button type="button" onClick={() => { onLoadSaved(s); onClose(); }}
                      className="flex flex-1 items-center gap-2 truncate rounded-lg px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                      <PiStar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <button type="button" onClick={() => onDeleteSaved(s.id)}
                      className="hidden shrink-0 group-hover:flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:text-red-500">
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Order detail panel ────────────────────────────────────────────────────────

function OrderDetail({ order, tenant, onClose }: { order: PosOrder; tenant?: POSTenant | null; onClose: () => void }) {
  const [tab, setTab] = useState<'details' | 'invoice' | 'returns'>('details');
  const amount   = order.total ?? 0;
  const refunded = (order.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);
  const subtotal = order.subtotal ?? amount;
  const discount = order.discountTotal ?? 0;
  // A gratuity or a rounding kobo is cash that left the till without buying
  // goods. Without these rows the total simply didn't add up, which is how staff
  // gratuities came to be read as unexplained shortfalls.
  const tip      = tipAmount(order);
  const rounding = roundingAmount(order);
  const netAfterReturns = netSales(order);
  const splits   = order.paymentDetails?.splitPayments ?? [];
  const change   = order.paymentDetails?.change ?? 0;
  const ng       = (v: number) => `₦${v.toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const { label: stLabel, cls: stCls } = statusBadge(order);
  const rawLogo  = tenant?.logo;
  const logoSrc  = ((typeof rawLogo==='string'?rawLogo:(rawLogo as any)?.url)?.trim())||'/logo.png';
  const store    = (tenant?.name||'DRINKS HARBOUR').toUpperCase();
  const payLabel = splits.length > 0
    ? splits.map(s=>`${s.method.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} ${ng(s.amount)}`).join(' + ')
    : (order.paymentMethod||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 break-words">
            <span className="text-sm font-bold text-gray-900">{order.receiptNumber || order.orderNumber || '—'}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stCls}`}>{stLabel}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{fmtDateTime(order.placedAt || order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => printOrders([order], tenant)} title="Print invoice"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202]">
            <PiPrinter className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700">
            <PiX className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id:'details', label:'Details',  icon:<PiInfo className="h-3.5 w-3.5" /> },
          { id:'invoice', label:'Invoice',  icon:<PiReceipt className="h-3.5 w-3.5" /> },
          { id:'returns', label:`Returns${(order.refunds?.length??0)>0?` (${order.refunds!.length})`:''}`, icon:<PiArrowCounterClockwise className="h-3.5 w-3.5" /> },
        ] as const).map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${tab===t.id?'border-b-2 border-[#b20202] text-[#b20202]':'border-b-2 border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label:'Total',    value:formatCurrency(amount),  red:true },
              { label:'Items',    value:String((order.items||[]).length) },
              { label:'Returned', value:refunded>0?formatCurrency(refunded):'—', amber:refunded>0 },
            ].map(({label,value,red,amber})=>(
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${red?'text-[#b20202]':amber?'text-amber-600':'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="border-b border-gray-100 px-5 py-3 space-y-1.5 text-xs">
            {[
              { label:'Cashier',  value:cashierLabel(order.posStaff) },
              { label:'Customer', value:customerLabel(order.customer)||'Walk-in Customer' },
              { label:'Session',  value:sessionLabel(order.session) },
              ...(getOrderWarehouse(order) ? [{ label:'Warehouse', value:getOrderWarehouse(order)!.name }] : []),
              { label:'Payment',  value:payLabel },
              ...(change>0?[{label:'Change', value:formatCurrency(change)}]:[]),
              { label:'Receipt #', value:order.receiptNumber||'—' },
              { label:'Order #',   value:order.orderNumber||'—' },
            ].map(({label,value})=>(
              <div key={label} className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 font-semibold text-gray-500">{label}</span>
                {/* A split receipt renders every tender leg into one value
                    ("Cash ₦2,000.00 + Card ₦8,000.00"); without a wrap floor it
                    pushed the row past the narrow detail overlay's edge. */}
                <span className="min-w-0 break-words text-right font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          {(order.items||[]).length > 0 && (
            <div className="border-b border-gray-100">
              <div className="bg-gray-50 px-5 py-2 border-b border-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[300px] text-xs">
                  <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-5 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-5 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(order.items||[]).map((item,i)=>(
                      <tr key={i}>
                        <td className="px-5 py-2.5 font-medium text-gray-800">
                          {item.name}
                          {item.variant && <span className="font-normal text-gray-400"> · {item.variant}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{item.quantity}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(item.itemSubtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-5 py-3 space-y-1 text-xs">
                {order.taxAmount != null && <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(order.taxAmount)}</span></div>}
                {discount>0 && <div className="flex justify-between text-red-500"><span>Discount</span><span className="font-semibold">−{formatCurrency(discount)}</span></div>}
                <div className="flex justify-between text-gray-700"><span>Goods sold</span><span className="tabular-nums">{formatCurrency(netAfterReturns)}</span></div>
                {tip>0 && <div className="flex justify-between text-gray-500"><span>Gratuity</span><span className="tabular-nums">{formatCurrency(tip)}</span></div>}
                {rounding!==0 && <div className="flex justify-between text-gray-500"><span>Rounding</span><span className="tabular-nums">{formatCurrency(rounding)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>Total received</span><span className="tabular-nums">{formatCurrency(amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'invoice' && (
        <InvoicePreview
          order={order}
          store={{ name: store, logoSrc, address: ['Nigeria','39 Gana St, Maitama, Abuja'], bankAccounts: tenant?.bankAccounts ?? [] }}
          onPrint={() => printOrders([order], tenant)}
          className="flex-1"
        />
      )}

      {tab === 'returns' && (
        <div className="flex-1 overflow-y-auto">
          {(order.refunds||[]).length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <PiArrowCounterClockwise className="h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">No returns for this order</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(order.refunds||[]).map((r,i)=>(
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800">{r.receiptNumber||`Return ${i+1}`}</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">{r.source === 'sales' ? 'No refund recorded' : `−${formatCurrency(r.totalRefunded)}`}</span>
                  </div>
                  {r.source === 'sales' && <p className="text-xs text-gray-500">{(r.items || []).reduce((sum, item) => sum + item.quantity, 0)} units returned through Sales · stock already restored</p>}
                  {r.refundedAt&&<p className="text-[11px] text-gray-400">{fmtDateTime(r.refundedAt)}</p>}
                  {r.paymentMethod&&<p className="text-[11px] text-gray-400 capitalize mt-0.5">via {r.paymentMethod.replace(/_/g,' ')}</p>}
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-gray-200 px-5 py-3 text-sm font-bold">
                <span className="text-gray-600">Total Refunded</span>
                <span className="text-red-600 tabular-nums">−{formatCurrency(refunded)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function POSOrders() {
  const { token: posToken, tenant } = usePOSAuth();
  const { data: session, status: sessionStatus } = useSession();
  const sessionToken = (session?.user as { token?: string })?.token ?? null;
  const { shopId } = usePOSShopScope();
  const { token, defaultShop } = historyAccess(sessionToken, isTokenExpired(posToken) ? null : posToken, shopId);
  const [selectedHistoryShop, setHistoryShop] = useState<string | null>(null);
  const historyShop = selectedHistoryShop || defaultShop;
  const [loadError, setLoadError] = useState('');
  const requestVersion = useRef(0);
  useEffect(() => { setHistoryShop(null); }, [token, defaultShop]);

  const [orders,         setOrders]         = useState<PosOrder[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [truncated,      setTruncated]      = useState(false);
  const [pageMeta,       setPageMeta]       = useState<PageMeta | null>(null);
  const [search,         setSearch]         = useState('');
  const [showPanel,      setShowPanel]      = useState(false);
  const [groupBy,        setGroupBy]        = useState<GroupKey | null>(null);
  const [savedSearches,  setSavedSearches]  = useState<SavedSearch[]>(() => loadSaved());
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');
  const [sortCol,        setSortCol]        = useState<SortCol>('date');
  const [sortDir,        setSortDir]        = useState<SortDir>('desc');
  const [page,           setPage]           = useState(1);
  const [selected,       setSelected]       = useState<PosOrder | null>(null);
  const [checked,        setChecked]        = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Date + time range
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [timeFrom,  setTimeFrom]  = useState('00:00');
  const [timeTo,    setTimeTo]    = useState('23:59');
  const [activePreset, setActivePreset] = useState('');

  // Dropdown filters
  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter,  setMethodFilter]  = useState('');

  const fetchOrders = useCallback((all = false) => {
    const version = ++requestVersion.current;
    if (sessionStatus === 'loading') return;
    if (!token) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(''); setOrders([]); setSelected(null); setChecked(new Set()); setPage(1);
    posApi.getAllOrders(token, { limit: all ? 2000 : 500, shopId: historyShop })
      .then(({ data, meta }) => {
        if (version !== requestVersion.current) return;
        const rows = (data || []) as PosOrder[];
        setOrders(rows);
        // The server says whether this is the whole set. The old code guessed
        // with `rows.length === 500` and then *cleared* the warning on "Load all"
        // — but the server clamped 2000 to 500, so the button reported a partial
        // day as complete. A missing `meta` is treated as unknown, not complete.
        setTruncated(meta ? meta.truncated : rows.length >= 500);
        setPageMeta(meta);
      })
      .catch(error => { if (version === requestVersion.current) setLoadError(error instanceof Error ? error.message : 'Could not load orders'); })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
  }, [token, sessionStatus, historyShop]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => () => { requestVersion.current++; }, []);
  useEffect(() => { setExpandedGroups(new Set()); }, [groupBy]);
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, sortCol, sortDir]);
  // Below lg the receipt is a sheet over the table, so Escape has to be the
  // way back out — there is no visible desktop layout to fall back to.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelected(null); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  const cashiers = useMemo(() =>
    Array.from(new Set(orders.map(o => cashierLabel(o.posStaff)).filter(c => c !== '—'))).sort()
  , [orders]);

  function saveSearch(name: string) {
    const entry: SavedSearch = { id: Date.now().toString(), name, query: search, groupBy };
    const updated = [...savedSearches, entry];
    setSavedSearches(updated); persistSaved(updated);
  }
  function loadSavedSearch(s: SavedSearch) { setSearch(s.query); setGroupBy(s.groupBy); setPage(1); }
  function deleteSaved(id: string) {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated); persistSaved(updated);
  }

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setDateFrom(preset.from()); setDateTo(preset.to());
    setTimeFrom(preset.tf); setTimeTo(preset.tt);
    setActivePreset(preset.label);
  }
  function clearDateRange() { setDateFrom(''); setDateTo(''); setTimeFrom('00:00'); setTimeTo('23:59'); setActivePreset(''); }

  function clearAllFilters() {
    setSearch(''); setGroupBy(null);
    setStatusFilter('all'); clearDateRange();
    setCashierFilter(''); setMethodFilter('');
  }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...orders];

    if (statusFilter === 'paid')     list = list.filter(o => !o.isVoided && returnDeduction(o)===0);
    if (statusFilter === 'refunded') list = list.filter(o => { const r=returnDeduction(o); return r>0||o.paymentStatus==='refunded'||o.paymentStatus==='partially_refunded'; });
    if (statusFilter === 'voided')   list = list.filter(o => o.isVoided);

    // Date + time range — full timestamp comparison
    if (dateFrom) {
      const fromTs = toTs(dateFrom, timeFrom);
      list = list.filter(o => new Date(o.placedAt||o.createdAt).getTime() >= fromTs);
    }
    if (dateTo) {
      // add :59 seconds to make "to" inclusive of the chosen minute
      const toTs_ = toTs(dateTo, timeTo) + 59_000;
      list = list.filter(o => new Date(o.placedAt||o.createdAt).getTime() <= toTs_);
    }

    if (cashierFilter) list = list.filter(o => cashierLabel(o.posStaff) === cashierFilter);
    if (methodFilter)  list = list.filter(o => o.paymentMethod === methodFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        (o.receiptNumber||'').toLowerCase().includes(q) ||
        (o.orderNumber||'').toLowerCase().includes(q) ||
        cashierLabel(o.posStaff).toLowerCase().includes(q) ||
        (customerLabel(o.customer)||'').toLowerCase().includes(q) ||
        (o.paymentMethod||'').toLowerCase().replace(/_/g,' ').includes(q) ||
        (o.session?._id||'').toLowerCase().includes(q) ||
        sessionLabel(o.session).toLowerCase().includes(q) ||
        fmtDate(o.placedAt||o.createdAt).toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      const aDate = new Date(a.placedAt||a.createdAt).getTime();
      const bDate = new Date(b.placedAt||b.createdAt).getTime();
      switch (sortCol) {
        case 'date':     cmp = aDate - bDate; break;
        case 'receipt':  cmp = (a.receiptNumber||'').localeCompare(b.receiptNumber||''); break;
        case 'customer': cmp = (customerLabel(a.customer)||'zzz').localeCompare(customerLabel(b.customer)||'zzz'); break;
        case 'cashier':  cmp = cashierLabel(a.posStaff).localeCompare(cashierLabel(b.posStaff)); break;
        case 'session':  cmp = sessionLabel(a.session).localeCompare(sessionLabel(b.session)); break;
        case 'method':   cmp = (a.paymentMethod||'').localeCompare(b.paymentMethod||''); break;
        case 'total':    cmp = netSales(a) - netSales(b); break;
        case 'status':   cmp = statusBadge(a).label.localeCompare(statusBadge(b).label); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [orders, search, statusFilter, dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, sortCol, sortDir]);

  // Summary stats (filtered). Every figure comes from one place so the cards
  // beside each other always reconcile: gross sales − returns === net revenue.
  const stats = useMemo(() => summariseOrders(filtered), [filtered]);

  // Group by
  const groupedOrders = useMemo((): [string, PosOrder[]][] | null => {
    if (!groupBy) return null;
    const map = new Map<string, PosOrder[]>();
    filtered.forEach(o => {
      let key: string;
      const d = new Date(o.placedAt || o.createdAt);
      switch (groupBy) {
        case 'session':       key = sessionLabel(o.session); break;
        case 'cashier':       key = cashierLabel(o.posStaff); break;
        case 'terminal':      key = (o.session?.terminalType||'retail').charAt(0).toUpperCase()+(o.session?.terminalType||'retail').slice(1); break;
        case 'customer':      key = customerLabel(o.customer) || 'Walk-in'; break;
        case 'status':        key = statusBadge(o).label; break;
        case 'order_day':     key = fmtDate(o.placedAt||o.createdAt); break;
        case 'order_week':    key = weekLabel(d); break;
        case 'order_month':   key = d.toLocaleDateString('en-GB',{month:'long',year:'numeric'}); break;
        case 'order_quarter': key = quarterLabel(d); break;
        case 'order_year':    key = String(d.getFullYear()); break;
        default:              key = '—';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  const totalPages      = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated       = groupedOrders ? [] : filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const displayList     = groupedOrders ? filtered : paginated;
  const filteredTotalRev = filtered.reduce((s,o) => s+netSales(o), 0);

  const allChecked    = displayList.length > 0 && displayList.every(o => checked.has(o._id));
  const someChecked   = checked.size > 0 && !allChecked;
  const checkedOrders = orders.filter(o => checked.has(o._id));
  const checkedTotal  = checkedOrders.reduce((s,o) => s+netSales(o), 0);

  function toggleAll()           { setChecked(allChecked ? new Set() : new Set(displayList.map(o=>o._id))); }
  function toggleOne(id: string) { setChecked(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function handleSort(col: SortCol) {
    if (sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir(col==='date'?'desc':'asc'); }
  }
  function toggleGroup(name: string) {
    setExpandedGroups(prev => { const n=new Set(prev); n.has(name)?n.delete(name):n.add(name); return n; });
  }

  const hasDateRange     = dateFrom || dateTo;
  const hasAnyFilter     = search || hasDateRange || cashierFilter || methodFilter || statusFilter !== 'all' || !!groupBy;

  const HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
    { col:'date',     label:'Date & Time' },
    { col:'receipt',  label:'Receipt' },
    { col:'customer', label:'Customer' },
    { col:'cashier',  label:'Cashier' },
    { col:'session',  label:'Session' },
    { col:'method',   label:'Method' },
    { col:'total',    label:'Amount', right:true },
    { col:'status',   label:'Status' },
  ];

  function renderRow(order: PosOrder, isSel: boolean) {
    const isChk  = checked.has(order._id);
    const amount = netSales(order);
    const { label: stLabel, cls: stCls } = statusBadge(order);
    const cust   = customerLabel(order.customer);
    const method = order.paymentMethod;

    return (
      <tr key={order._id} className={`border-b border-gray-100/80 transition-colors cursor-pointer ${
        isSel  ? 'bg-[#b20202] text-white' :
        isChk  ? 'bg-[#b20202]/5 border-l-2 border-l-[#b20202]' :
                 'hover:bg-gray-50/80 border-l-2 border-l-transparent'
      }`}>
        <td className="w-8 px-2 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
          <button type="button" onClick={()=>toggleOne(order._id)} className="text-gray-300 hover:text-[#b20202] transition-colors">
            {isChk ? <PiCheckSquare className="h-4 w-4 text-[#b20202]" /> : <PiSquare className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-3 py-2.5" onClick={()=>setSelected(isSel?null:order)}>
          <div className={`text-xs font-medium leading-tight ${isSel?'text-white':'text-gray-800'}`}>{fmtDate(order.placedAt||order.createdAt)}</div>
          <div className={`text-[10px] font-mono mt-0.5 ${isSel?'text-red-200':'text-gray-400'}`}>{fmtTime(order.placedAt||order.createdAt)}</div>
        </td>
        <td className={`px-3 py-2.5 text-xs font-semibold ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.receiptNumber || order.orderNumber || '—'}
          {(() => {
            const wh = getOrderWarehouse(order);
            return wh ? (
              <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isSel ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'}`}>
                {wh.name}
              </span>
            ) : null;
          })()}
        </td>
        <td className={`px-3 py-2.5 text-xs max-w-[88px] truncate ${isSel?'text-red-100':'text-gray-600'}`} onClick={()=>setSelected(isSel?null:order)}>
          {cust || <span className={isSel?'text-red-300 italic':'text-gray-300 italic'}>Walk-in</span>}
        </td>
        <td className={`px-3 py-2.5 text-xs ${isSel?'text-red-100':'text-gray-600'}`} onClick={()=>setSelected(isSel?null:order)}>
          {cashierLabel(order.posStaff)}
        </td>
        <td className={`px-3 py-2.5 text-xs ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.session ? (
            <>
              <div className={`font-mono text-[10px] font-semibold ${isSel?'text-white':'text-gray-700'}`}>#{order.session._id.slice(-8)}</div>
              <div className={`text-[10px] capitalize ${isSel?'text-red-200':'text-gray-400'}`}>{order.session.terminalType||'retail'}</div>
            </>
          ) : <span className={isSel?'text-red-300':'text-gray-300'}>—</span>}
        </td>
        <td className="px-3 py-2.5" onClick={()=>setSelected(isSel?null:order)}>
          {isSel
            ? <span className="text-[11px] text-red-100 capitalize">{(method||'').replace(/_/g,' ')}</span>
            : <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${METHOD_COLOR[method]??'bg-gray-100 text-gray-600'}`}>{METHOD_LABEL[method]??method}</span>
          }
        </td>
        <td className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel?'text-white':order.isVoided?'text-gray-400 line-through':'text-gray-900'}`} onClick={()=>setSelected(isSel?null:order)}>
          {formatCurrency(amount)}
        </td>
        <td className="px-3 py-2.5 text-center" onClick={()=>setSelected(isSel?null:order)}>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isSel?'bg-white/20 text-white':stCls}`}>{stLabel}</span>
        </td>
        <td className="w-8 px-2 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
          <button type="button" onClick={()=>printOrders([order],tenant)}
            className={`transition-colors ${isSel?'text-white/50 hover:text-white':'text-gray-300 hover:text-[#b20202]'}`}>
            <PiPrinter className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-gray-50 lg:h-dvh lg:overflow-hidden">
      <POSNavHeader />
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-white p-3">
        <ShopHistorySelector token={token} value={historyShop} onChange={value => { requestVersion.current++; setHistoryShop(value); setOrders([]); setSelected(null); setPage(1); }} />
        {loadError && <p role="alert" className="text-red-600">{loadError}</p>}
      </div>

      {/* ── Control bar ── */}
      <div className="shrink-0 bg-white border-b border-gray-200">

        {/* ── Row 1: title + meta + actions ── */}
        <div className="flex flex-wrap items-center gap-3 px-3 pt-4 pb-3 sm:px-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Orders</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              <span className="font-medium text-gray-600">{filtered.length.toLocaleString()}</span> shown
              {filtered.length !== orders.length && <span> of {orders.length.toLocaleString()} loaded</span>}
              {truncated && (
                <>
                  <span className="ml-1.5 text-amber-700">
                    ({pageMeta?.matched.toLocaleString() ?? 'more'} in total — totals below are partial)
                  </span>
                  <button type="button" onClick={() => fetchOrders(true)} className="ml-2 text-[#b20202] underline-offset-2 hover:underline">
                    Load more →
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Status tabs */}
          <div className="flex max-w-full flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {(['all','paid','refunded','voided'] as StatusFilter[]).map(f => (
              <button key={f} type="button" onClick={() => { setStatusFilter(f); setSelected(null); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  statusFilter===f ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}>
                {f}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setShowPanel(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showPanel || groupBy
                    ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                <PiStack className="h-3.5 w-3.5" />
                {groupBy ? `Group: ${GROUP_LABELS[groupBy]}` : 'Group By'}
                {showPanel ? <PiCaretUp className="h-3 w-3"/> : <PiCaretDown className="h-3 w-3"/>}
              </button>
              {showPanel && (
                <GroupPanel
                  groupBy={groupBy} savedSearches={savedSearches}
                  onSetGroupBy={g => { setGroupBy(g); }}
                  onSave={saveSearch} onLoadSaved={loadSavedSearch} onDeleteSaved={deleteSaved}
                  onClose={() => setShowPanel(false)}
                />
              )}
            </div>
            <button type="button" onClick={() => fetchOrders()} disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <PiArrowsClockwise className={`h-4 w-4 ${loading?'animate-spin':''}`} />
            </button>
            <button type="button" onClick={() => exportCsv(filtered)} disabled={filtered.length===0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50 transition-colors">
              <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* ── Row 2: filters ── */}
        <div className="px-3 py-3 space-y-2.5 sm:px-5">

          {/* Quick date presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">Quick range</span>
            {DATE_PRESETS.map(preset => (
              <button key={preset.label} type="button" onClick={() => applyPreset(preset)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  activePreset === preset.label
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {preset.label}
              </button>
            ))}
          </div>

          {/* Filter controls row */}
          <div className="flex flex-wrap items-end gap-3">

            {/* Date + time range */}
            <DateTimeRange
              dateFrom={dateFrom} dateTo={dateTo}
              timeFrom={timeFrom} timeTo={timeTo}
              onDateFrom={v => { setDateFrom(v); setActivePreset(''); }}
              onDateTo={v   => { setDateTo(v);   setActivePreset(''); }}
              onTimeFrom={v => { setTimeFrom(v); setActivePreset(''); }}
              onTimeTo={v   => { setTimeTo(v);   setActivePreset(''); }}
              onClear={clearDateRange}
            />

            {/* Divider */}
            <div className="hidden self-stretch w-px bg-gray-100 mx-1 mt-5 xl:block" />

            {/* Cashier */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-none sm:max-w-[220px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cashier</span>
              <select value={cashierFilter} onChange={e => setCashierFilter(e.target.value)}
                className="h-[34px] w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20">
                <option value="">All cashiers</option>
                {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Payment */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-none sm:max-w-[220px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Payment</span>
              <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
                className="h-[34px] w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20">
                <option value="">All methods</option>
                {Object.entries(METHOD_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Divider */}
            <div className="hidden self-stretch w-px bg-gray-100 mx-1 mt-5 xl:block" />

            {/* Search */}
            <div className="flex w-full min-w-0 flex-col gap-0.5 sm:w-auto sm:min-w-[200px] sm:flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Search</span>
              <div className="relative">
                <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search}
                  onChange={e => { setSearch(e.target.value); setSelected(null); }}
                  placeholder="Receipt, cashier, customer, session…"
                  className="h-[34px] w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20" />
                {search && (
                  <button type="button" onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <PiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Clear all */}
            {hasAnyFilter && (
              <div className="flex flex-col justify-end">
                <button type="button" onClick={clearAllFilters}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 h-[34px] text-xs font-semibold text-[#b20202] hover:bg-red-100 transition-colors">
                  <PiX className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
            )}

            {/* Pagination (pushed right) */}
            {!groupBy && totalPages > 1 && (
              <div className="ml-auto flex items-end gap-1">
                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-1 h-[34px]">
                    <span className="text-[11px] text-gray-400 px-1">{page}/{totalPages}</span>
                    <button type="button" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page<=1}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                      <PiCaretLeft className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    <button type="button" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                      <PiCaretRight className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {/* Gross Sales − Returns === Net Revenue, by construction. Gratuities sit
          beside them rather than inside them: a tip is staff earnings, not
          product income, and folding it in overstated the day's sales. */}
      <div className="shrink-0 grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 bg-white sm:grid-cols-3 2xl:grid-cols-6">
        {[
          { label:'Orders',      value:stats.count.toLocaleString(),    icon:<PiShoppingCart className="h-4 w-4"/>,           color:'text-blue-600',    sub:`${stats.voided} voided` },
          { label:'Gross Sales', value:formatCurrency(stats.grossSales), icon:<PiCurrencyNgn className="h-4 w-4"/>,          color:'text-[#b20202]',   sub:'goods, before returns', red:true },
          { label:'Returns',     value:formatCurrency(stats.returns),    icon:<PiArrowCounterClockwise className="h-4 w-4"/>, color:'text-amber-500',   sub:stats.returns>0
              ? `${formatCurrency(stats.cashRefunded)} paid back in cash`
              : 'nothing returned', amber:true },
          { label:'Net Revenue', value:formatCurrency(stats.netRevenue), icon:<PiTrendUp className="h-4 w-4"/>,             color:'text-emerald-600', sub:'after returns' },
          { label:'Gratuities',  value:formatCurrency(stats.tips),       icon:<PiHandHeart className="h-4 w-4"/>,          color:'text-gray-500',   sub:stats.tips>0?'paid to staff, not sales':'none' },
          { label:'Avg Order',   value:formatCurrency(stats.avgOrder),   icon:<PiReceipt className="h-4 w-4"/>,             color:'text-purple-600',  sub:'per non-voided order' },
        ].map(({label,value,icon,color,sub,red,amber})=>(
          <div key={label} className="min-w-0 px-3 py-3 flex items-start gap-2 sm:px-4 sm:gap-3">
            <span className={`mt-0.5 ${red?'text-[#b20202]':amber&&stats.returns>0?'text-amber-500':color}`}>{icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">{label}</p>
              <p className={`break-words text-sm font-bold tabular-nums mt-0.5 ${red?'text-[#b20202]':amber&&stats.returns>0?'text-amber-500':'text-gray-900'}`}>{value}</p>
              {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Body (table + detail) ── */}
      <div className="relative flex min-h-[28rem] flex-1 overflow-hidden lg:min-h-0">

        {/* Table column */}
        <div className={`flex min-w-0 flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected?'w-full lg:w-[56%]':'flex-1'}`}>

          {/* Selection bar */}
          {checked.size > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-[#b20202] bg-white px-4 py-2.5">
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="text-[#b20202] font-bold">{checked.size}</span> selected ·{' '}
                <span className="font-bold text-gray-900">{formatCurrency(checkedTotal)}</span>
              </div>
              <button type="button" onClick={()=>setChecked(new Set())}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                Clear
              </button>
              <button type="button" onClick={()=>printOrders(checkedOrders,tenant)}
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#9a0101]">
                <PiPrinter className="h-3.5 w-3.5"/>
                Print {checked.size>1?`${checked.size} Invoices`:'Invoice'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex-1 overflow-hidden pt-2">
              {Array.from({length:12}).map((_,i)=>(
                <div key={i} className="flex items-center gap-3 border-b border-gray-50 px-4 py-2.5">
                  <div className="h-3 w-3 rounded bg-gray-100 animate-pulse shrink-0" />
                  {[90,70,80,60,70,55,50,40].map((w,j)=>(
                    <div key={j} className="h-3.5 animate-pulse rounded-md bg-gray-100" style={{width:w}} />
                  ))}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <PiReceipt className="h-8 w-8 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">{search?`No orders matching "${search}"`:'No orders match the filters'}</p>
                <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or clearing filters</p>
              </div>
              {hasAnyFilter && (
                <button type="button" onClick={clearAllFilters}
                  className="text-xs font-semibold text-[#b20202] hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[70dvh] min-h-0 flex-1 overflow-auto lg:max-h-none">
              <table className="w-full min-w-[1060px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button type="button" onClick={toggleAll} className="text-gray-300 hover:text-[#b20202] transition-colors">
                        {allChecked ? <PiCheckSquare className="h-4 w-4 text-[#b20202]"/> : someChecked ? <PiCheckSquare className="h-4 w-4 text-gray-400"/> : <PiSquare className="h-4 w-4"/>}
                      </button>
                    </th>
                    {HEADERS.map(({col,label,right})=>(
                      <th key={col} onClick={()=>handleSort(col)}
                        className={`cursor-pointer select-none px-3 py-3 hover:text-gray-600 transition-colors ${right?'text-right':''}`}>
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <SortIcon col={col} sortCol={sortCol} sortDir={sortDir}/>
                        </span>
                      </th>
                    ))}
                    <th className="w-8 px-2 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {groupedOrders ? (
                    groupedOrders.map(([groupName, groupOrders]) => {
                      const isCollapsed = !expandedGroups.has(groupName);
                      const groupTotal  = groupOrders.reduce((s,o) => s+netSales(o), 0);
                      const share       = filteredTotalRev > 0 ? (groupTotal / filteredTotalRev) * 100 : 0;
                      return (
                        <React.Fragment key={`group-${groupName}`}>
                          <tr className="cursor-pointer select-none border-b border-gray-200 bg-gray-50/80 hover:bg-gray-100 transition-colors"
                            onClick={() => toggleGroup(groupName)}>
                            <td colSpan={10} className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <PiCaretRight className={`h-3 w-3 text-gray-400 shrink-0 transition-transform duration-150 ${isCollapsed?'':'rotate-90'}`} />
                                <span className="text-xs font-semibold text-gray-700">{groupName}</span>
                                <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 tabular-nums">{groupOrders.length}</span>
                                <div className="ml-1 flex flex-1 max-w-[180px] items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                    <div className="h-full rounded-full bg-[#b20202] transition-all" style={{width:`${Math.min(100,share)}%`}} />
                                  </div>
                                  <span className="text-[10px] text-gray-400 tabular-nums w-9 text-right">{share.toFixed(1)}%</span>
                                </div>
                                <span className="ml-auto text-xs font-bold text-gray-800 tabular-nums">{formatCurrency(groupTotal)}</span>
                              </div>
                            </td>
                          </tr>
                          {!isCollapsed && groupOrders.map(order => renderRow(order, selected?._id===order._id))}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    paginated.map(order => renderRow(order, selected?._id===order._id))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {!groupBy && totalPages > 1 && !loading && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-white px-4 py-2.5">
              <span className="text-[11px] text-gray-400">
                {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length.toLocaleString()}
              </span>
              <div className="flex gap-1">
                {Array.from({length:Math.min(totalPages,7)},(_,i) => {
                  let p: number;
                  if (totalPages<=7)           p = i+1;
                  else if (page<=4)            p = i+1;
                  else if (page>=totalPages-3) p = totalPages-6+i;
                  else                         p = page-3+i;
                  return (
                    <button key={p} type="button" onClick={()=>setPage(p)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors ${
                        p===page ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Truncation notice */}
          {truncated && !loading && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs text-amber-700">
                <PiWarningCircle className="h-3.5 w-3.5 shrink-0"/>
                {pageMeta
                  ? `Showing ${pageMeta.included.toLocaleString()} of ${pageMeta.matched.toLocaleString()} orders — the totals above are partial.`
                  : 'Showing a partial list of orders — the totals above may be incomplete.'}
              </span>
              <button type="button" onClick={() => fetchOrders(true)}
                className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline">
                {pageMeta && pageMeta.missing > (pageMeta.limit ?? 0)
                  ? 'Load up to 2,000'
                  : 'Load all orders'}
              </button>
            </div>
          )}
        </div>

        {/* Scrim: on small screens the receipt floats over the table, so the
            list underneath must not look clickable, and tapping it is the
            natural way out. Hidden at lg where the split is side by side. */}
        {selected && (
          <button
            type="button"
            aria-label="Close order details"
            onClick={() => setSelected(null)}
            className="absolute inset-0 z-10 bg-gray-900/20 lg:hidden"
          />
        )}

        {/* Detail panel */}
        <div className={`flex min-w-0 flex-col bg-white transition-all duration-200 ${
          selected
            // On small screens the receipt overlays the table instead of
            // squeezing it into half the window; on lg+ it returns to the
            // in-row split.
            ? 'absolute inset-y-0 right-0 z-20 w-full shadow-2xl sm:w-[440px] lg:static lg:z-auto lg:w-auto lg:flex-1 lg:shadow-none'
            // The empty "Select an order" prompt is room the table needs on
            // small screens.
            : 'hidden w-72 shrink-0 xl:flex xl:flex-col'
        }`}>
          {selected ? (
            <OrderDetail order={selected} tenant={tenant} onClose={()=>setSelected(null)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner">
                <PiReceipt className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Select an order</p>
                <p className="text-xs text-gray-400 mt-1">Click any row to view details,<br/>invoice and return history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
