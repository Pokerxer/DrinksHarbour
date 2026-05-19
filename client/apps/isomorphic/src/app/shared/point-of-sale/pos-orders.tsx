'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { POSTenant } from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import {
  PiArrowLeft, PiMagnifyingGlass, PiX, PiArrowsClockwise,
  PiCaretLeft, PiCaretRight, PiCaretDown, PiCaretUp,
  PiShoppingCart, PiCurrencyNgn, PiReceipt, PiUserCircle,
  PiArrowUp, PiArrowDown, PiArrowsDownUp,
  PiPrinter, PiArrowCounterClockwise, PiWarningCircle,
  PiCheckSquare, PiSquare, PiInfo, PiFunnel, PiList,
  PiStack, PiStar, PiFloppyDisk, PiTrash, PiCalendar,
  PiStorefront,
} from 'react-icons/pi';
import { buildInvoice, printInvoices } from '@/utils/invoice';
import InvoicePreview from '@/components/InvoicePreview';
import { FilterItem, GroupItem, SortIcon } from '@/components/list-controls';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number; discountAmount?: number;
}
interface OrderRefund {
  receiptNumber?: string; totalRefunded: number; paymentMethod?: string;
  refundedAt?: string;
  items?: { orderItemIndex: number; quantity: number; amount: number; unitPrice?: number }[];
}
interface PosOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number; totalAmount?: number; subtotal?: number; discountTotal?: number;
  paymentMethod: string; paymentStatus?: string; status?: string; isVoided?: boolean;
  placedAt: string; createdAt: string;
  posStaff?: { _id: string; firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  session?: { _id: string; terminalType?: string; openedAt?: string } | null;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[]; change?: number; amount?: number };
  items?: OrderItem[];
  refunds?: OrderRefund[];
}

type SortCol = 'date' | 'receipt' | 'customer' | 'cashier' | 'session' | 'method' | 'total' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'paid' | 'refunded' | 'voided';

type FilterKey = 'invoiced' | 'posted' | 'cancelled' | 'order_today' | 'order_yesterday' | 'order_this_week' | 'order_this_month';
type GroupKey  = 'session' | 'cashier' | 'terminal' | 'customer' | 'status' | 'order_day' | 'order_week' | 'order_month' | 'order_quarter' | 'order_year';

interface SavedSearch { id: string; name: string; query: string; filters: FilterKey[]; groupBy: GroupKey | null; }

const SAVED_KEY = 'dh-pos-order-searches';
function loadSaved(): SavedSearch[] { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as SavedSearch[]; } catch { return []; } }
function persistSaved(list: SavedSearch[]) { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function fmtDateTime(d: string) { return `${fmtDate(d)} · ${fmtTime(d)}`; }
function cashierLabel(u?: { firstName: string; lastName: string; posName?: string } | null) { return u ? (u.posName || `${u.firstName} ${u.lastName}`.trim()) : '—'; }
function customerLabel(c?: { firstName?: string; lastName?: string } | null) { return c?.firstName && c.firstName !== 'Walk-in' ? `${c.firstName} ${c.lastName || ''}`.trim() : null; }
function sessionLabel(s?: { _id: string; terminalType?: string; openedAt?: string } | null) {
  if (!s) return '—';
  const term = (s.terminalType || 'retail').charAt(0).toUpperCase() + (s.terminalType || 'retail').slice(1);
  const date = s.openedAt ? new Date(s.openedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
  return date ? `${term} · ${date}` : term;
}

function statusBadge(o: PosOrder) {
  const ref = (o.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);
  const amt = o.total ?? 0;
  if (o.isVoided)                     return { label: 'Voided',        cls: 'bg-gray-100 text-gray-500' };
  if (ref >= amt && ref > 0)          return { label: 'Refunded',      cls: 'bg-red-50 text-red-600' };
  if (ref > 0)                        return { label: 'Part. Returned', cls: 'bg-amber-50 text-amber-600' };
  return                                     { label: 'Paid',           cls: 'bg-emerald-50 text-emerald-600' };
}

// Date helpers
function startOfDay(d = new Date()) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function startOfWeek(d = new Date()) { const r = startOfDay(d); r.setDate(r.getDate()-r.getDay()); return r; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function quarterLabel(d: Date) { return `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`; }
function weekLabel(d: Date) {
  const s = startOfWeek(d); const e = new Date(s); e.setDate(e.getDate()+6);
  return `W${Math.ceil(d.getDate()/7)} · ${s.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}–${e.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}`;
}

// ── Invoice builder (kept for tenant-aware variant; shared util used elsewhere) ─

function buildInvoiceWithTenant(order: PosOrder, tenant?: POSTenant | null): string {
  const ng = (v: number) => `₦${v.toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const amt = order.total ?? 0; const sub = order.subtotal ?? amt; const disc = order.discountTotal ?? 0;
  const ref = (order.refunds||[]).reduce((s,r)=>s+r.totalRefunded,0);
  const splits = order.paymentDetails?.splitPayments ?? []; const change = order.paymentDetails?.change ?? 0;
  const rawLogo = tenant?.logo; const logoSrc = ((typeof rawLogo==='string'?rawLogo:(rawLogo as any)?.url)?.trim())||'/logo.png';
  const store = (tenant?.name||'DRINKS HARBOUR').toUpperCase();
  const cashier = cashierLabel(order.posStaff); const cust = customerLabel(order.customer)||'Walk-in Customer';
  const dateStr = new Date(order.placedAt||order.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const payLabel = splits.length>0 ? splits.map(s=>`${s.method.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} ${ng(s.amount)}`).join(' + ') : (order.paymentMethod||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const rows = (order.items||[]).map(it=>`<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:9px 14px;font-size:13px">${it.name}${it.variant?` - ${it.variant}`:''}</td><td style="padding:9px 14px;text-align:right;font-size:13px">${it.quantity}.00 Units</td><td style="padding:9px 14px;text-align:right;font-size:13px">${ng(it.priceAtPurchase)}</td><td style="padding:9px 14px;text-align:right;font-size:13px;color:#ccc">—</td><td style="padding:9px 14px;text-align:right;font-size:13px;font-weight:600">${ng(it.itemSubtotal)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order · ${order.receiptNumber||''}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;background:#fff;padding:44px 52px 80px}table{width:100%;border-collapse:collapse}.th{background:#f5f5f5;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:10px 14px;text-align:right;border:1px solid #ddd;color:#444}.th:first-child{text-align:left}@media print{body{padding:24px 32px}@page{size:A4;margin:12mm}}</style></head><body>
  <div style="height:5px;background:linear-gradient(90deg,#b20202,#7f1d1d);border-radius:3px;margin-bottom:32px"></div>
  <table style="margin-bottom:28px"><tr><td style="vertical-align:top;width:180px"><img src="${logoSrc}" alt="${store}" style="height:52px;object-fit:contain;object-position:left"></td><td style="vertical-align:top;text-align:right;font-size:12px;line-height:1.9;color:#4b5563"><div style="font-size:14px;font-weight:800;color:#111">${store}</div><div>Nigeria</div><div>39 Gana Street, Maitama, Abuja</div></td></tr></table>
  <div style="text-align:center;font-size:13px;font-weight:600;color:#555;margin-bottom:16px;letter-spacing:.04em">${cust.toUpperCase()}</div>
  <div style="font-size:28px;font-weight:900;color:#b20202;margin-bottom:14px">Order # ${order.receiptNumber||order.orderNumber||'—'}</div>
  <table style="margin-bottom:18px;border-bottom:1px solid #e5e7eb;padding-bottom:12px"><tr><td style="font-size:11px;font-weight:700;color:#b20202;text-transform:uppercase;letter-spacing:.05em;padding-bottom:2px">Order Date</td><td style="width:45%"></td><td style="font-size:11px;font-weight:700;color:#b20202;text-transform:uppercase;letter-spacing:.05em;padding-bottom:2px">Cashier</td></tr><tr><td style="font-size:14px">${dateStr}</td><td></td><td style="font-size:14px">${cashier}</td></tr></table>
  <table><thead><tr><th class="th" style="text-align:left">Description</th><th class="th">Quantity</th><th class="th">Unit Price</th><th class="th">Taxes</th><th class="th">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table style="border-top:2px solid #e5e7eb"><tbody>${disc>0?`<tr><td colspan="4" style="padding:8px 14px"></td><td style="padding:8px 14px;text-align:right;font-size:13px;color:#b20202;font-weight:600">Discount −${ng(disc)}</td></tr>`:''}<tr style="border-bottom:1px solid #e5e7eb"><td colspan="4" style="padding:9px 14px"></td><td style="padding:9px 14px;text-align:right;font-size:13px;color:#555">Untaxed Amount <strong style="color:#111">${ng(sub)}</strong></td></tr><tr style="background:#b20202"><td colspan="4" style="padding:11px 14px"></td><td style="padding:11px 14px;text-align:right;font-size:14px;font-weight:700;color:#fff">Total &nbsp; ${ng(amt)}</td></tr>${ref>0?`<tr><td colspan="4" style="padding:7px 14px"></td><td style="padding:7px 14px;text-align:right;font-size:12px;color:#b20202;font-weight:600">Returned −${ng(ref)}</td></tr>`:''}<tr><td colspan="4" style="padding:6px 14px"></td><td style="padding:6px 14px;text-align:right;font-size:11px;color:#555">${payLabel}${change>0?` · Change ${ng(change)}`:''}</td></tr></tbody></table>
  <div style="margin-top:24px;font-size:12px;color:#333"><span style="font-weight:600">Terms &amp; Conditions:</span> <span style="color:#b20202">https://www.drinksharbour.com/terms</span></div>
  <div style="margin-top:36px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between;font-size:11px;color:#555"><span>No Return Of Drinks</span><span>Page 1 / 1</span></div></body></html>`;
}

function printOrders(orders: PosOrder[], tenant?: POSTenant | null) {
  const rawLogo = tenant?.logo;
  const store = {
    name: tenant?.name || 'DRINKS HARBOUR',
    logoSrc: ((typeof rawLogo === 'string' ? rawLogo : (rawLogo as any)?.url)?.trim()) || '/logo.png',
    address: ['Nigeria', '39 Gana Street, Maitama, Abuja'],
    bankAccounts: tenant?.bankAccounts ?? [],
  };
  printInvoices(orders, store);
}

// ── Search panel ──────────────────────────────────────────────────────────────

function OrderSearchPanel({
  activeFilters, groupBy, savedSearches,
  onToggleFilter, onSetGroupBy, onSave, onLoadSaved, onDeleteSaved, onClose,
}: {
  activeFilters: Set<FilterKey>; groupBy: GroupKey | null; savedSearches: SavedSearch[];
  onToggleFilter: (f: FilterKey) => void; onSetGroupBy: (g: GroupKey | null) => void;
  onSave: (name: string) => void; onLoadSaved: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void; onClose: () => void;
}) {
  const [orderDateOpen, setOrderDateOpen] = useState(false);
  const [groupDateOpen, setGroupDateOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/8" style={{ minWidth: 660 }}>
      <div className="flex divide-x divide-gray-100">

        {/* Filters */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiFunnel className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="space-y-0.5">
            <FilterItem fkey="invoiced"  label="Invoiced"   active={activeFilters.has('invoiced')}  onToggle={onToggleFilter} />
            <FilterItem fkey="posted"    label="Posted"     active={activeFilters.has('posted')}    onToggle={onToggleFilter} />
            <FilterItem fkey="cancelled" label="Cancelled"  active={activeFilters.has('cancelled')} onToggle={onToggleFilter} />
            <div>
              <button type="button" onClick={() => setOrderDateOpen(v => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <span className="flex items-center gap-2"><PiCalendar className="h-4 w-4 text-gray-400" />Order Date</span>
                {orderDateOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
              </button>
              {orderDateOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <FilterItem fkey="order_today"      label="Today"      active={activeFilters.has('order_today')}      onToggle={onToggleFilter} />
                  <FilterItem fkey="order_yesterday"  label="Yesterday"  active={activeFilters.has('order_yesterday')}  onToggle={onToggleFilter} />
                  <FilterItem fkey="order_this_week"  label="This Week"  active={activeFilters.has('order_this_week')}  onToggle={onToggleFilter} />
                  <FilterItem fkey="order_this_month" label="This Month" active={activeFilters.has('order_this_month')} onToggle={onToggleFilter} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Group By */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </div>
          <div className="space-y-0.5">
            <GroupItem gkey="session"  label="Session"       active={groupBy==='session'}  onToggle={onSetGroupBy} />
            <GroupItem gkey="cashier"  label="Cashier"       active={groupBy==='cashier'}  onToggle={onSetGroupBy} />
            <GroupItem gkey="terminal" label="Point of Sale" active={groupBy==='terminal'} onToggle={onSetGroupBy} />
            <GroupItem gkey="customer" label="Customer"      active={groupBy==='customer'} onToggle={onSetGroupBy} />
            <GroupItem gkey="status"   label="Status"        active={groupBy==='status'}   onToggle={onSetGroupBy} />
            <div>
              <button type="button" onClick={() => setGroupDateOpen(v => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <span className="flex items-center gap-2"><PiCalendar className="h-4 w-4 text-gray-400" />Order Date</span>
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

        {/* Favorites */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStar className="h-3.5 w-3.5" /> Favorites
          </div>
          <div className="space-y-1">
            {!showSaveInput ? (
              <button type="button" onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <PiFloppyDisk className="h-4 w-4 text-gray-400" /> Save current search
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <input autoFocus type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter'&&saveName.trim()) { onSave(saveName.trim()); setSaveName(''); setShowSaveInput(false); } if (e.key==='Escape') setShowSaveInput(false); }}
                  placeholder="Search name…"
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#b20202]" />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setSaveName(''); setShowSaveInput(false); } }}
                    disabled={!saveName.trim()} className="flex-1 rounded-lg bg-[#b20202] py-1.5 text-xs font-bold text-white disabled:opacity-40">Save</button>
                  <button type="button" onClick={() => { setSaveName(''); setShowSaveInput(false); }}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}
            {savedSearches.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
                {savedSearches.map(s => (
                  <div key={s.id} className="flex items-center gap-1 group">
                    <button type="button" onClick={() => { onLoadSaved(s); onClose(); }}
                      className="flex flex-1 items-center gap-2 truncate rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
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
  const splits   = order.paymentDetails?.splitPayments ?? [];
  const change   = order.paymentDetails?.change ?? 0;
  const ng       = (v: number) => `₦${v.toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const { label: stLabel, cls: stCls } = statusBadge(order);
  const rawLogo = tenant?.logo;
  const logoSrc = ((typeof rawLogo==='string'?rawLogo:(rawLogo as any)?.url)?.trim())||'/logo.png';
  const store = (tenant?.name||'DRINKS HARBOUR').toUpperCase();
  const payLabel = splits.length>0 ? splits.map(s=>`${s.method.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} ${ng(s.amount)}`).join(' + ') : (order.paymentMethod||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
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
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><PiX className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Details */}
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
              { label:'Payment',  value:payLabel },
              ...(change>0?[{label:'Change',value:formatCurrency(change)}]:[]),
              { label:'Receipt #',value:order.receiptNumber||'—' },
              { label:'Order #',  value:order.orderNumber||'—' },
            ].map(({label,value})=>(
              <div key={label} className="flex justify-between">
                <span className="font-semibold text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          {(order.items||[]).length > 0 && (
            <div className="border-b border-gray-100">
              <div className="border-b border-gray-50 bg-gray-50 px-5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <tr><th className="px-5 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-5 py-2 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(order.items||[]).map((item,i)=>(
                    <tr key={i}>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{item.name}{item.variant&&<span className="font-normal text-gray-400"> · {item.variant}</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{item.quantity}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(item.itemSubtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-5 py-3 space-y-1 text-xs">
                {discount>0&&<div className="flex justify-between text-red-500"><span>Discount</span><span className="font-semibold">−{formatCurrency(discount)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900"><span>Total</span><span className="tabular-nums">{formatCurrency(amount)}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice */}
      {tab === 'invoice' && (
        <InvoicePreview
          order={order}
          store={{
            name: store,
            logoSrc,
            address: ['Nigeria', '39 Gana St, Maitama, Abuja'],
            bankAccounts: tenant?.bankAccounts ?? [],
          }}
          onPrint={() => printOrders([order], tenant)}
          className="flex-1"
        />
      )}

      {/* Returns */}
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
                    <span className="text-sm font-bold text-red-600 tabular-nums">−{formatCurrency(r.totalRefunded)}</span>
                  </div>
                  {r.refundedAt&&<p className="text-[11px] text-gray-400">{fmtDateTime(r.refundedAt)}</p>}
                  {r.paymentMethod&&<p className="text-[11px] text-gray-400 capitalize mt-0.5">via {r.paymentMethod.replace(/_/g,' ')}</p>}
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-gray-200 px-5 py-3 text-sm font-bold">
                <span className="text-gray-600">Total Returned</span>
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

const PAGE_SIZE = 50;

const FILTER_LABELS: Record<FilterKey, string> = {
  invoiced:'Invoiced', posted:'Posted', cancelled:'Cancelled',
  order_today:'Order: Today', order_yesterday:'Order: Yesterday',
  order_this_week:'Order: This Week', order_this_month:'Order: This Month',
};
const GROUP_LABELS: Record<GroupKey, string> = {
  session:'Session', cashier:'Cashier', terminal:'Point of Sale', customer:'Customer', status:'Status',
  order_day:'Order: Day', order_week:'Order: Week', order_month:'Order: Month',
  order_quarter:'Order: Quarter', order_year:'Order: Year',
};

export default function POSOrders() {
  const router = useRouter();
  const { token, tenant } = usePOSAuth();

  const [orders,        setOrders]        = useState<PosOrder[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [showPanel,     setShowPanel]     = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [groupBy,       setGroupBy]       = useState<GroupKey | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => loadSaved());
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [sortCol,       setSortCol]       = useState<SortCol>('date');
  const [sortDir,       setSortDir]       = useState<SortDir>('desc');
  const [page,          setPage]          = useState(1);
  const [selected,      setSelected]      = useState<PosOrder | null>(null);
  const [checked,       setChecked]       = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(() => {
    if (!token) return;
    setLoading(true);
    posApi.getAllOrders(token, { limit: 500 })
      .then(data => setOrders((data || []) as PosOrder[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setExpandedGroups(new Set()); }, [groupBy]);

  // Saved searches helpers
  function saveSearch(name: string) {
    const entry: SavedSearch = { id: Date.now().toString(), name, query: search, filters: Array.from(activeFilters), groupBy };
    const updated = [...savedSearches, entry];
    setSavedSearches(updated); persistSaved(updated);
  }
  function loadSavedSearch(s: SavedSearch) {
    setSearch(s.query); setActiveFilters(new Set(s.filters)); setGroupBy(s.groupBy); setPage(1);
  }
  function deleteSaved(id: string) {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated); persistSaved(updated);
  }
  function toggleFilter(f: FilterKey) {
    setActiveFilters(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });
    setPage(1);
  }
  function removeFilter(f: FilterKey) { setActiveFilters(prev => { const n = new Set(prev); n.delete(f); return n; }); }

  // ── Filter + search + sort ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...orders];

    // Status pills
    if (statusFilter === 'paid')     list = list.filter(o => !o.isVoided && (o.refunds||[]).reduce((s,r)=>s+r.totalRefunded,0) === 0);
    if (statusFilter === 'refunded') list = list.filter(o => { const r=(o.refunds||[]).reduce((s,r)=>s+r.totalRefunded,0); return r>0||o.paymentStatus==='refunded'||o.paymentStatus==='partially_refunded'; });
    if (statusFilter === 'voided')   list = list.filter(o => o.isVoided);

    // Panel filters
    if (activeFilters.has('invoiced'))  list = list.filter(o => !o.isVoided && o.paymentStatus !== 'refunded' && o.paymentStatus !== 'partially_refunded');
    if (activeFilters.has('posted'))    list = list.filter(o => o.status === 'confirmed' && !o.isVoided);
    if (activeFilters.has('cancelled')) list = list.filter(o => o.isVoided || o.status === 'cancelled');

    // Date filters
    const now = new Date();
    if (activeFilters.has('order_today'))      list = list.filter(o => isSameDay(new Date(o.placedAt||o.createdAt), now));
    else if (activeFilters.has('order_yesterday')) { const y=new Date(now); y.setDate(y.getDate()-1); list=list.filter(o=>isSameDay(new Date(o.placedAt||o.createdAt),y)); }
    else if (activeFilters.has('order_this_week'))  list = list.filter(o => new Date(o.placedAt||o.createdAt) >= startOfWeek(now));
    else if (activeFilters.has('order_this_month')) list = list.filter(o => new Date(o.placedAt||o.createdAt) >= startOfMonth(now));

    // Text search — receipt, order#, cashier, customer, method, session id/label
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        (o.receiptNumber||'').toLowerCase().includes(q)  ||
        (o.orderNumber||'').toLowerCase().includes(q)    ||
        cashierLabel(o.posStaff).toLowerCase().includes(q) ||
        (customerLabel(o.customer)||'').toLowerCase().includes(q) ||
        (o.paymentMethod||'').toLowerCase().replace(/_/g,' ').includes(q) ||
        (o.session?._id||'').toLowerCase().includes(q)  ||
        sessionLabel(o.session).toLowerCase().includes(q) ||
        fmtDate(o.placedAt||o.createdAt).toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'date':     cmp = new Date(a.createdAt||a.placedAt).getTime() - new Date(b.createdAt||b.placedAt).getTime(); break;
        case 'receipt':  cmp = (a.receiptNumber||'').localeCompare(b.receiptNumber||''); break;
        case 'customer': cmp = (customerLabel(a.customer)||'zzz').localeCompare(customerLabel(b.customer)||'zzz'); break;
        case 'cashier':  cmp = cashierLabel(a.posStaff).localeCompare(cashierLabel(b.posStaff)); break;
        case 'session':  cmp = sessionLabel(a.session).localeCompare(sessionLabel(b.session)); break;
        case 'method':   cmp = (a.paymentMethod||'').localeCompare(b.paymentMethod||''); break;
        case 'total':    cmp = (a.total??0) - (b.total??0); break;
        case 'status':   cmp = statusBadge(a).label.localeCompare(statusBadge(b).label); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [orders, search, statusFilter, activeFilters, sortCol, sortDir]);

  // Group By
  const groupedOrders = useMemo((): [string, PosOrder[]][] | null => {
    if (!groupBy) return null;
    const map = new Map<string, PosOrder[]>();
    filtered.forEach(o => {
      let key: string;
      const d = new Date(o.placedAt || o.createdAt);
      switch (groupBy) {
        case 'session':       key = sessionLabel(o.session); break;
        case 'cashier':       key = cashierLabel(o.posStaff); break;
        case 'terminal':      key = (o.session?.terminalType || 'retail').charAt(0).toUpperCase() + (o.session?.terminalType || 'retail').slice(1); break;
        case 'customer':      key = customerLabel(o.customer) || 'Walk-in'; break;
        case 'status':        key = statusBadge(o).label; break;
        case 'order_day':     key = fmtDate(o.placedAt || o.createdAt); break;
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

  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated    = groupedOrders ? [] : filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // Selection
  const displayList  = groupedOrders ? filtered : paginated;
  const allChecked   = displayList.length > 0 && displayList.every(o => checked.has(o._id));
  const someChecked  = checked.size > 0 && !allChecked;
  const checkedOrders = orders.filter(o => checked.has(o._id));
  const checkedTotal  = checkedOrders.reduce((s,o) => s+(o.total??0), 0);

  function toggleAll()         { setChecked(allChecked ? new Set() : new Set(displayList.map(o=>o._id))); }
  function toggleOne(id: string) { setChecked(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir(col==='date'?'desc':'asc'); }
    setPage(1);
  }

  function toggleGroup(name: string) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  // Active chips
  const chips: { key: string; label: string; type: 'filter'|'group' }[] = [
    ...Array.from(activeFilters).map(f => ({ key: f, label: FILTER_LABELS[f]||f, type: 'filter' as const })),
    ...(groupBy ? [{ key: groupBy, label: `Group: ${GROUP_LABELS[groupBy]}`, type: 'group' as const }] : []),
  ];
  const hasOptions = chips.length > 0;

  // Stats
  const paidOrders = orders.filter(o => !o.isVoided);
  const totalSales = paidOrders.reduce((s,o) => s+(o.total??0), 0);
  const totalRefunds = orders.reduce((s,o) => s+(o.refunds||[]).reduce((r,ref)=>r+ref.totalRefunded,0), 0);
  const avgOrder = paidOrders.length ? totalSales / paidOrders.length : 0;

  // Table row renderer
  function renderRow(order: PosOrder, isSel: boolean) {
    const isChk = checked.has(order._id);
    const amount = order.total ?? 0;
    const { label: stLabel, cls: stCls } = statusBadge(order);
    const cust = customerLabel(order.customer);

    return (
      <tr key={order._id} className={`border-b border-gray-100 transition-colors ${
        isSel ? 'bg-[#b20202] text-white' : isChk ? 'bg-[#b20202]/5 border-l-2 border-l-[#b20202]' : 'bg-white hover:bg-gray-50 border-l-2 border-l-transparent'
      }`}>
        <td className="w-8 px-2 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
          <button type="button" onClick={()=>toggleOne(order._id)} className="text-gray-400 hover:text-[#b20202]">
            {isChk ? <PiCheckSquare className="h-4 w-4 text-[#b20202]" /> : <PiSquare className="h-4 w-4" />}
          </button>
        </td>
        <td className={`px-3 py-2.5 cursor-pointer`} onClick={()=>setSelected(isSel?null:order)}>
          <div className={`font-medium text-xs ${isSel?'text-white':'text-gray-800'}`}>{fmtDate(order.placedAt||order.createdAt)}</div>
          <div className={`text-[10px] font-mono ${isSel?'text-red-100':'text-gray-500'}`}>{fmtTime(order.placedAt||order.createdAt)}</div>
        </td>
        <td className={`px-3 py-2.5 text-xs font-semibold cursor-pointer ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.receiptNumber || order.orderNumber || '—'}
        </td>
        <td className={`px-3 py-2.5 text-xs cursor-pointer max-w-[90px] truncate ${isSel?'text-red-100':'text-gray-600'}`} onClick={()=>setSelected(isSel?null:order)}>
          {cust || <span className={isSel?'text-red-200':'text-gray-300'}>Walk-in</span>}
        </td>
        <td className={`px-3 py-2.5 text-xs cursor-pointer ${isSel?'text-red-100':'text-gray-600'}`} onClick={()=>setSelected(isSel?null:order)}>
          {cashierLabel(order.posStaff)}
        </td>
        <td className={`px-3 py-2.5 text-xs cursor-pointer ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.session ? (
            <div>
              <div className={`font-mono text-[10px] font-semibold ${isSel?'text-white':'text-gray-700'}`}>#{order.session._id.slice(-8)}</div>
              <div className={`text-[10px] capitalize ${isSel?'text-red-200':'text-gray-400'}`}>{order.session.terminalType||'retail'}</div>
            </div>
          ) : <span className={isSel?'text-red-200':'text-gray-300'}>—</span>}
        </td>
        <td className={`px-3 py-2.5 text-xs capitalize cursor-pointer ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:order)}>
          {(order.paymentMethod||'').replace(/_/g,' ')}
        </td>
        <td className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums cursor-pointer ${isSel?'text-white':order.isVoided?'text-gray-400 line-through':'text-gray-900'}`} onClick={()=>setSelected(isSel?null:order)}>
          {formatCurrency(amount)}
        </td>
        <td className="px-3 py-2.5 text-center cursor-pointer" onClick={()=>setSelected(isSel?null:order)}>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isSel?'bg-white/20 text-white':stCls}`}>{stLabel}</span>
        </td>
        <td className="w-8 px-2 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
          <button type="button" onClick={()=>printOrders([order],tenant)} title="Print"
            className={`transition-colors ${isSel?'text-white/60 hover:text-white':'text-gray-300 hover:text-[#b20202]'}`}>
            <PiPrinter className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  const TABLE_HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
    { col:'date',     label:'Date & Time' },
    { col:'receipt',  label:'Receipt' },
    { col:'customer', label:'Customer' },
    { col:'cashier',  label:'Cashier' },
    { col:'session',  label:'Session' },
    { col:'method',   label:'Method' },
    { col:'total',    label:'Amount', right: true },
    { col:'status',   label:'Status' },
  ];

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <POSNavHeader />

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button type="button" onClick={()=>router.push(routes.pos.index)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <PiArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">Orders</h1>
          <p className="text-[11px] text-gray-400">{orders.length} total · {filtered.length} shown</p>
        </div>

        {/* Search with panel */}
        <div className="relative flex-1 max-w-md">
          <div className={`flex overflow-hidden rounded-xl border transition-all ${showPanel?'border-[#b20202] ring-1 ring-[#b20202]/10':'border-gray-200'} bg-white`}>
            <div className="relative flex-1">
              <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);setSelected(null);}}
                onFocus={()=>setShowPanel(true)}
                placeholder="Receipt, customer, cashier, session…"
                className="h-9 w-full bg-transparent pl-9 pr-2 text-sm outline-none" />
            </div>
            {(search||hasOptions) && (
              <button type="button" onClick={()=>{setSearch('');setActiveFilters(new Set());setGroupBy(null);setStatusFilter('all');}}
                className="flex items-center px-2 text-gray-400 hover:text-gray-600"><PiX className="h-3.5 w-3.5" /></button>
            )}
            <button type="button" onClick={()=>setShowPanel(v=>!v)}
              className={`flex items-center gap-1 border-l border-gray-200 px-3 text-xs font-semibold transition-colors ${showPanel?'bg-[#b20202]/5 text-[#b20202]':'text-gray-500 hover:bg-gray-50'}`}>
              {showPanel?<PiCaretUp className="h-3.5 w-3.5"/>:<PiCaretDown className="h-3.5 w-3.5"/>}
            </button>
          </div>
          {showPanel && (
            <OrderSearchPanel
              activeFilters={activeFilters} groupBy={groupBy} savedSearches={savedSearches}
              onToggleFilter={toggleFilter} onSetGroupBy={setGroupBy}
              onSave={saveSearch} onLoadSaved={loadSavedSearch} onDeleteSaved={deleteSaved}
              onClose={()=>setShowPanel(false)}
            />
          )}
        </div>

        {/* Status pills */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
          {(['all','paid','refunded','voided'] as StatusFilter[]).map(f=>(
            <button key={f} type="button" onClick={()=>{setStatusFilter(f);setPage(1);setSelected(null);}}
              className={`rounded-lg px-3 py-1.5 capitalize transition-all ${statusFilter===f?'bg-[#b20202] text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Pagination */}
        {!groupBy && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
            <span className="px-1">{page}/{totalPages}</span>
            <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <PiCaretLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <PiCaretRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button type="button" onClick={fetchOrders} disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40">
          <PiArrowsClockwise className={`h-4 w-4 ${loading?'animate-spin':''}`} />
        </button>
      </div>

      {/* Active filter chips */}
      {hasOptions && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-2">
          {chips.map(c=>(
            <span key={c.key} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.type==='group'?'bg-blue-50 text-blue-700 ring-1 ring-blue-200':'bg-[#b20202]/10 text-[#b20202] ring-1 ring-[#b20202]/20'}`}>
              {c.type==='group'?<PiStack className="h-3 w-3"/>:<PiFunnel className="h-3 w-3"/>}
              {c.label}
              <button type="button" onClick={()=>c.type==='filter'?removeFilter(c.key as FilterKey):setGroupBy(null)} className="ml-0.5 opacity-60 hover:opacity-100"><PiX className="h-3 w-3"/></button>
            </span>
          ))}
          <button type="button" onClick={()=>{setActiveFilters(new Set());setGroupBy(null);}} className="ml-1 text-[11px] text-gray-400 hover:text-gray-600 underline">Clear all</button>
        </div>
      )}

      {/* ── Stats strip ── */}
      <div className="flex shrink-0 divide-x divide-gray-100 border-b border-gray-200 bg-white">
        {[
          { label:'Total Orders',  value:String(paidOrders.length), icon:<PiShoppingCart className="h-4 w-4"/> },
          { label:'Total Sales',   value:formatCurrency(totalSales), icon:<PiCurrencyNgn className="h-4 w-4"/>, red:true },
          { label:'Total Refunds', value:formatCurrency(totalRefunds), icon:<PiArrowCounterClockwise className="h-4 w-4"/>, amber:totalRefunds>0 },
          { label:'Avg. Order',    value:formatCurrency(avgOrder), icon:<PiReceipt className="h-4 w-4"/> },
        ].map(({label,value,icon,red,amber})=>(
          <div key={label} className="flex flex-1 items-center gap-3 px-5 py-3">
            <span className={`${red?'text-[#b20202]':amber&&totalRefunds>0?'text-amber-600':'text-gray-400'}`}>{icon}</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className={`text-sm font-bold tabular-nums ${red?'text-[#b20202]':amber&&totalRefunds>0?'text-amber-600':'text-gray-900'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table */}
        <div className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected?'w-[55%]':'flex-1'}`}>

          {/* Selection bar */}
          {checked.size > 0 && (
            <div className="shrink-0 flex items-center gap-3 border-b-2 border-[#b20202] bg-white px-4 py-2.5">
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="text-[#b20202] font-bold">{checked.size}</span> selected · <span className="font-bold text-gray-900">{formatCurrency(checkedTotal)}</span>
              </div>
              <button type="button" onClick={()=>setChecked(new Set())} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">Clear</button>
              <button type="button" onClick={()=>printOrders(checkedOrders,tenant)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white hover:opacity-90" style={{backgroundColor:'#b20202'}}>
                <PiPrinter className="h-3.5 w-3.5"/> Print {checked.size>1?`${checked.size} Invoices`:'Invoice'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <PiReceipt className="h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-400">{search?`No orders matching "${search}"`:hasOptions?'No orders match the active filters':'No orders found'}</p>
              {(search||hasOptions) && <button type="button" onClick={()=>{setSearch('');setActiveFilters(new Set());setGroupBy(null);}} className="text-xs text-[#b20202] hover:underline">Clear filters</button>}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button type="button" onClick={toggleAll} className="text-gray-400 hover:text-[#b20202]">
                        {allChecked?<PiCheckSquare className="h-4 w-4 text-[#b20202]"/>:someChecked?<PiCheckSquare className="h-4 w-4 text-gray-400"/>:<PiSquare className="h-4 w-4"/>}
                      </button>
                    </th>
                    {TABLE_HEADERS.map(({col,label,right})=>(
                      <th key={col} onClick={()=>handleSort(col)}
                        className={`cursor-pointer select-none px-3 py-3 hover:text-gray-600 ${right?'text-right':''}`}>
                        <span className="flex items-center gap-1">{label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir}/></span>
                      </th>
                    ))}
                    <th className="w-8 px-2 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {groupedOrders ? (
                    groupedOrders.map(([groupName, groupOrders]) => {
                      const isCollapsed = !expandedGroups.has(groupName);
                      return (
                        <React.Fragment key={`group-${groupName}`}>
                          <tr
                            className="cursor-pointer select-none border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                            onClick={() => toggleGroup(groupName)}
                          >
                            <td colSpan={10} className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                                  <PiCaretRight className="h-3 w-3" />
                                </span>
                                <span className="text-xs font-semibold text-gray-700">{groupName}</span>
                                <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">{groupOrders.length}</span>
                                <span className="ml-auto text-[10px] font-semibold text-gray-400 tabular-nums">{formatCurrency(groupOrders.reduce((s,o)=>s+(o.total??0),0))}</span>
                              </div>
                            </td>
                          </tr>
                          {!isCollapsed && groupOrders.map(order => renderRow(order, selected?._id === order._id))}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    paginated.map(order => renderRow(order, selected?._id === order._id))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {!groupBy && totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-500">
              <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
              <div className="flex gap-1">
                {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
                  const p=totalPages<=7?i+1:i===0?1:i===6?totalPages:page-2+i;
                  return <button key={p} type="button" onClick={()=>setPage(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${p===page?'border-[#b20202] bg-[#b20202] text-white':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className={`flex flex-col bg-white transition-all duration-200 ${selected?'flex-1 overflow-hidden':'w-72 shrink-0'}`}>
          {selected ? (
            <OrderDetail order={selected} tenant={tenant} onClose={()=>setSelected(null)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <PiReceipt className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">Select an order</p>
              <p className="text-xs text-gray-400">Click a row to view details and invoice</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
