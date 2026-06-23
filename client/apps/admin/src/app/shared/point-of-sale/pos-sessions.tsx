'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { useSession } from 'next-auth/react';
import { POSSession, POSTenant } from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import {
  PiArrowLeft, PiCaretLeft, PiCaretRight, PiArrowsClockwise,
  PiCurrencyNgn, PiCreditCard, PiBank, PiDeviceMobile,
  PiShoppingCart, PiTimer, PiUserCircle, PiWarningCircle,
  PiCheckCircle, PiArrowDown, PiArrowUp, PiX, PiReceipt,
  PiStorefront, PiLockKey, PiNote,
  PiInfo, PiList, PiPrinter, PiCheckSquare, PiSquare,
  PiMagnifyingGlass, PiFunnel, PiStack, PiStar, PiCaretDown,
  PiCaretUp, PiFloppyDisk, PiTrash,
} from 'react-icons/pi';

// ── Search / filter types ─────────────────────────────────────────────────────
type FilterKey =
  | 'my_sessions'
  | 'in_progress'
  | 'opening_today'
  | 'opening_yesterday'
  | 'opening_this_week'
  | 'opening_this_month';

type GroupKey =
  | 'opened_by'
  | 'terminal'
  | 'status'
  | 'opening_day'
  | 'opening_week'
  | 'opening_month'
  | 'opening_quarter'
  | 'opening_year'
  | 'closing_day'
  | 'closing_week'
  | 'closing_month'
  | 'closing_quarter'
  | 'closing_year';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: FilterKey[];
  groupBy: GroupKey | null;
}

const SAVED_SEARCHES_KEY = 'dh-pos-session-searches';

function loadSavedSearches(): SavedSearch[] {
  try { return (JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || '[]') as SavedSearch[]); } catch { return []; }
}
function persistSavedSearches(list: SavedSearch[]) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list));
}

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch { return true; }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function startOfDay(d = new Date()) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function startOfWeek(d = new Date()) {
  const r = startOfDay(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function weekLabel(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  return `W${Math.ceil(d.getDate() / 7)} · ${s.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})} – ${e.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}`;
}
function quarterLabel(d: Date) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}
function yearLabel(d: Date) {
  return String(d.getFullYear());
}

// ── Search panel component ────────────────────────────────────────────────────
function SearchPanel({
  staffId,
  activeFilters,
  groupBy,
  savedSearches,
  onToggleFilter,
  onSetGroupBy,
  onSave,
  onLoadSaved,
  onDeleteSaved,
  onClose,
}: {
  staffId?: string;
  activeFilters: Set<FilterKey>;
  groupBy: GroupKey | null;
  savedSearches: SavedSearch[];
  onToggleFilter: (f: FilterKey) => void;
  onSetGroupBy: (g: GroupKey | null) => void;
  onSave: (name: string) => void;
  onLoadSaved: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
}) {
  const [openingDateOpen, setOpeningDateOpen] = useState(false);
  const [groupOpeningOpen, setGroupOpeningOpen] = useState(false);
  const [groupClosingOpen, setGroupClosingOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [onClose]);

  function FilterItem({ fkey, label }: { fkey: FilterKey; label: string }) {
    const active = activeFilters.has(fkey);
    return (
      <button type="button" onClick={() => onToggleFilter(fkey)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors rounded-lg
          ${active ? 'bg-[#b20202]/8 text-[#b20202] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
          ${active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}>
          {active && <span className="h-2 w-2 rounded-sm bg-white" />}
        </span>
        {label}
      </button>
    );
  }

  function GroupItem({ gkey, label }: { gkey: GroupKey; label: string }) {
    const active = groupBy === gkey;
    return (
      <button type="button" onClick={() => onSetGroupBy(active ? null : gkey)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors rounded-lg
          ${active ? 'bg-[#b20202]/8 text-[#b20202] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors
          ${active ? 'border-[#b20202]' : 'border-gray-300'}`}>
          {active && <span className="h-2 w-2 rounded-full bg-[#b20202]" />}
        </span>
        {label}
      </button>
    );
  }

  return (
    <div ref={ref}
      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/8"
      style={{ minWidth: 640 }}>
      <div className="flex divide-x divide-gray-100">

        {/* ── Filters ── */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiFunnel className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="space-y-0.5">
            {staffId && <FilterItem fkey="my_sessions" label="My Sessions" />}
            <FilterItem fkey="in_progress" label="In Progress" />
            <div>
              <button type="button" onClick={() => setOpeningDateOpen(v => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                <span>Opening Date</span>
                {openingDateOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
              </button>
              {openingDateOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <FilterItem fkey="opening_today"      label="Today" />
                  <FilterItem fkey="opening_yesterday"  label="Yesterday" />
                  <FilterItem fkey="opening_this_week"  label="This Week" />
                  <FilterItem fkey="opening_this_month" label="This Month" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Group By ── */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </div>
          <div className="space-y-0.5">
            <GroupItem gkey="opened_by" label="Opened By" />
            <GroupItem gkey="terminal"  label="Point of Sale" />
            <GroupItem gkey="status"    label="Status" />
            <div>
              <button type="button" onClick={() => setGroupOpeningOpen(v => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                <span>Opening Date</span>
                {groupOpeningOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
              </button>
              {groupOpeningOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <GroupItem gkey="opening_day"     label="Day" />
                  <GroupItem gkey="opening_week"    label="Week" />
                  <GroupItem gkey="opening_month"   label="Month" />
                  <GroupItem gkey="opening_quarter" label="Quarter" />
                  <GroupItem gkey="opening_year"    label="Year" />
                </div>
              )}
            </div>
            <div>
              <button type="button" onClick={() => setGroupClosingOpen(v => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                <span>Closing Date</span>
                {groupClosingOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
              </button>
              {groupClosingOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <GroupItem gkey="closing_day"     label="Day" />
                  <GroupItem gkey="closing_week"    label="Week" />
                  <GroupItem gkey="closing_month"   label="Month" />
                  <GroupItem gkey="closing_quarter" label="Quarter" />
                  <GroupItem gkey="closing_year"    label="Year" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Favorites ── */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStar className="h-3.5 w-3.5" /> Favorites
          </div>
          <div className="space-y-1">
            {/* Save current search */}
            {!showSaveInput ? (
              <button type="button" onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                <PiFloppyDisk className="h-4 w-4 text-gray-400" />
                Save current search
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <input autoFocus type="text" value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && saveName.trim()) { onSave(saveName.trim()); setSaveName(''); setShowSaveInput(false); } if (e.key === 'Escape') setShowSaveInput(false); }}
                  placeholder="Search name…"
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#b20202]" />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setSaveName(''); setShowSaveInput(false); } }}
                    className="flex-1 rounded-lg bg-[#b20202] py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
                    disabled={!saveName.trim()}>Save</button>
                  <button type="button" onClick={() => { setSaveName(''); setShowSaveInput(false); }}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            {/* Saved searches list */}
            {savedSearches.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
                {savedSearches.map(s => (
                  <div key={s.id} className="flex items-center gap-1 group">
                    <button type="button" onClick={() => { onLoadSaved(s); onClose(); }}
                      className="flex flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg truncate">
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

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDateTime(d: string) {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}

function duration(openedAt: string, closedAt?: string) {
  const ms  = new Date(closedAt || Date.now()).getTime() - new Date(openedAt).getTime();
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function cashierLabel(u?: { firstName: string; lastName: string; posName?: string } | null) {
  if (!u) return '—';
  return u.posName || `${u.firstName} ${u.lastName}`.trim();
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash:          <PiCurrencyNgn className="h-4 w-4" />,
  card:          <PiCreditCard   className="h-4 w-4" />,
  bank_transfer: <PiBank         className="h-4 w-4" />,
  mobile_money:  <PiDeviceMobile className="h-4 w-4" />,
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card / POS',
  bank_transfer: 'Bank Transfer', mobile_money: 'Mobile Money',
};

type FilterStatus = 'all' | 'open' | 'closed';

// ── Types for session orders ──────────────────────────────────────────────────
interface SessionOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  totalAmount?: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  isVoided?: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[]; change?: number };
  items?: { name: string; variant?: string; quantity: number; priceAtPurchase: number; itemSubtotal: number }[];
  refunds?: { totalRefunded: number; receiptNumber?: string }[];
}

// ── Invoice HTML generator for session orders ─────────────────────────────────
function buildOrderInvoice(order: SessionOrder, tenant?: POSTenant | null): string {
  const ng = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const amount      = order.total ?? order.totalAmount ?? 0;
  const subtotal    = order.subtotal    ?? amount;
  const discount    = order.discountTotal ?? 0;
  const refunded    = (order.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);
  const splits      = order.paymentDetails?.splitPayments ?? [];
  const change      = order.paymentDetails?.change ?? 0;
  const orderDate   = new Date(order.placedAt || order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const storeName   = (tenant?.name || 'DRINKS HARBOUR').toUpperCase();
  const logoSrc     = (() => { const raw = tenant?.logo; if (!raw) return '/logo.png'; return (typeof raw === 'string' ? raw : (raw as any)?.url)?.trim() || '/logo.png'; })();
  const cashierName = order.posStaff ? cashierLabel(order.posStaff) : '—';
  const customerName = order.customer?.firstName && order.customer.firstName !== 'Walk-in'
    ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
    : 'Walk-in Customer';

  const paymentLabel = splits.length > 0
    ? splits.map(s => `${s.method.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} ${ng(s.amount)}`).join(' + ')
    : (order.paymentMethod || '').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  const itemRows = (order.items || []).map(it => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:9px 14px;font-size:13px;color:#111">${it.name}${it.variant ? ` - ${it.variant}` : ''}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:#111">${it.quantity}.00 Units</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:#111">${ng(it.priceAtPurchase)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:#ccc">—</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;font-weight:600;color:#111">${ng(it.itemSubtotal)}</td>
    </tr>`).join('');

  const returnsRows = refunded > 0 ? (order.refunds || []).map(r =>
    `<tr><td colspan="4" style="padding:7px 14px;text-align:right;font-size:12px;color:#b20202">${r.receiptNumber || 'Return'}</td>
     <td style="padding:7px 14px;text-align:right;font-size:12px;color:#b20202;font-weight:600">−${ng(r.totalRefunded)}</td></tr>`
  ).join('') : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice · ${order.receiptNumber || order.orderNumber || ''}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:44px 52px 80px}table{width:100%;border-collapse:collapse}
  .tbl-head th{background:#f5f5f5;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:10px 14px;text-align:right;border-top:1px solid #ddd;border-bottom:1px solid #ddd;color:#444}
  .tbl-head th:first-child{text-align:left}@media print{body{padding:24px 32px}@page{size:A4;margin:12mm}}</style>
  </head><body>
  <div style="height:5px;background:linear-gradient(90deg,#b20202,#7f1d1d);border-radius:3px;margin-bottom:32px"></div>
  <table style="margin-bottom:28px"><tr>
    <td style="vertical-align:top;width:180px"><img src="${logoSrc}" alt="${storeName}" style="height:52px;object-fit:contain;object-position:left center"></td>
    <td style="vertical-align:top;text-align:right;font-size:12px;line-height:1.9;color:#4b5563">
      <div style="font-size:14px;font-weight:800;color:#111;margin-bottom:2px">${storeName}</div>
      <div>Nigeria</div><div>39 Gana Street, Maitama, Abuja</div>
    </td>
  </tr></table>
  <div style="text-align:center;font-size:13px;font-weight:600;color:#555;margin-bottom:18px;letter-spacing:0.04em">${customerName.toUpperCase()}</div>
  <div style="font-size:28px;font-weight:900;color:#b20202;margin-bottom:16px;line-height:1">Order # ${order.receiptNumber || order.orderNumber || '—'}</div>
  <table style="margin-bottom:20px;border-bottom:1px solid #e5e7eb;padding-bottom:14px">
    <tr>
      <td style="padding-bottom:3px;font-size:11px;font-weight:700;color:#b20202;text-transform:uppercase;letter-spacing:0.05em">Order Date</td>
      <td style="width:45%"></td>
      <td style="padding-bottom:3px;font-size:11px;font-weight:700;color:#b20202;text-transform:uppercase;letter-spacing:0.05em">Cashier</td>
    </tr>
    <tr><td style="font-size:14px;color:#111">${orderDate}</td><td></td><td style="font-size:14px;color:#111">${cashierName}</td></tr>
  </table>
  <table><thead class="tbl-head"><tr>
    <th style="text-align:left">Description</th><th>Quantity</th><th>Unit Price</th><th>Taxes</th><th>Amount</th>
  </tr></thead><tbody>${itemRows}</tbody></table>
  <table style="border-top:2px solid #e5e7eb">
    ${discount > 0 ? `<tr style="border-bottom:1px solid #e5e7eb"><td colspan="4" style="padding:8px 14px"></td><td style="padding:8px 14px;text-align:right;font-size:13px;color:#b20202;font-weight:600">Discount −${ng(discount)}</td></tr>` : ''}
    <tr style="border-bottom:1px solid #e5e7eb"><td colspan="4" style="padding:9px 14px"></td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:#555">Untaxed Amount <strong style="color:#111">${ng(subtotal)}</strong></td></tr>
    <tr style="background:#b20202"><td colspan="4" style="padding:11px 14px"></td>
      <td style="padding:11px 14px;text-align:right;font-size:14px;font-weight:700;color:#fff">Total &nbsp; ${ng(amount)}</td></tr>
    ${returnsRows}
    ${change > 0 ? `<tr><td colspan="4" style="padding:7px 14px"></td><td style="padding:7px 14px;text-align:right;font-size:12px;color:#555">Payment: ${paymentLabel} · Change ${ng(change)}</td></tr>` : `<tr><td colspan="4" style="padding:7px 14px"></td><td style="padding:7px 14px;text-align:right;font-size:12px;color:#555">${paymentLabel}</td></tr>`}
  </table>
  <div style="margin-top:28px;font-size:12px;color:#333"><span style="font-weight:600">Terms &amp; Conditions:</span> <span style="color:#b20202">https://www.drinksharbour.com/terms</span></div>
  <div style="margin-top:40px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between;font-size:11px;color:#555">
    <span>No Return Of Drinks</span><span>Page 1 / 1</span>
  </div>
  </body></html>`;
}

function printOrders(orders: SessionOrder[], tenant?: POSTenant | null) {
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) return;
  if (orders.length === 1) {
    win.document.write(buildOrderInvoice(orders[0], tenant));
  } else {
    // Multi-page: each invoice on its own page
    const pages = orders.map((o, i) => {
      const body = buildOrderInvoice(o, tenant);
      // Extract just the <body> content and wrap with page-break
      const bodyMatch = body.match(/<body>([\s\S]*)<\/body>/);
      const content = bodyMatch ? bodyMatch[1] : body;
      return `<div style="page-break-after:${i < orders.length - 1 ? 'always' : 'avoid'}">${content}</div>`;
    });
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoices (${orders.length})</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
    table{width:100%;border-collapse:collapse}.tbl-head th{background:#f5f5f5;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:10px 14px;text-align:right;border-top:1px solid #ddd;border-bottom:1px solid #ddd;color:#444}.tbl-head th:first-child{text-align:left}
    @media print{@page{size:A4;margin:12mm}}</style>
    </head><body>${pages.join('')}</body></html>`);
  }
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

// ── Order detail drawer (slides in from right inside the panel) ───────────────
function OrderDrawer({ order, tenant, onClose }: { order: SessionOrder; tenant?: POSTenant | null; onClose: () => void }) {
  const amount   = order.total ?? order.totalAmount ?? 0;
  const refunded = (order.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);

  return (
    <div className="flex h-full flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{order.receiptNumber || order.orderNumber || '—'}</p>
          <p className="text-[11px] text-gray-400">{fmtDateTime(order.placedAt || order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => printOrders([order], tenant)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202]"
            title="Print invoice"
          >
            <PiPrinter className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
          {[
            { label: 'Cashier',  value: order.posStaff ? cashierLabel(order.posStaff) : '—' },
            { label: 'Customer', value: order.customer?.firstName && order.customer.firstName !== 'Walk-in' ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim() : 'Walk-in' },
            { label: 'Payment',  value: (order.paymentMethod || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
            { label: 'Status',   value: order.isVoided ? 'Voided' : refunded >= amount ? 'Refunded' : refunded > 0 ? 'Part. Returned' : 'Paid' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Items */}
        {(order.items || []).length > 0 && (
          <div className="border-b border-gray-100">
            <div className="border-b border-gray-50 bg-gray-50 px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(order.items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">
                      {item.name}
                      {item.variant && <span className="text-gray-400 font-normal"> · {item.variant}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(item.itemSubtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Refunds */}
        {(order.refunds || []).length > 0 && (
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-400">Returns</p>
            <div className="space-y-1.5">
              {(order.refunds || []).map((r, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="font-mono text-gray-500">{r.receiptNumber || `Return ${i + 1}`}</span>
                  <span className="font-bold text-red-500 tabular-nums">−{formatCurrency(r.totalRefunded)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer total */}
      <div className="shrink-0 border-t border-gray-200 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-gray-900">Total</span>
          <span className={`text-lg font-extrabold tabular-nums ${order.isVoided ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {formatCurrency(amount)}
          </span>
        </div>
        {refunded > 0 && (
          <div className="flex justify-between text-xs text-red-500 mt-0.5">
            <span>Returned</span>
            <span className="font-semibold tabular-nums">−{formatCurrency(refunded)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab({ sessionId, token, tenant }: { sessionId: string; token: string; tenant?: POSTenant | null }) {
  const [orders,      setOrders]      = useState<SessionOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [drawerOrder, setDrawerOrder] = useState<SessionOrder | null>(null);
  const [checkedIds,  setCheckedIds]  = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setDrawerOrder(null);
    setCheckedIds(new Set());
    posApi.getSessionOrders(token, sessionId)
      .then((data) => setOrders((data || []) as SessionOrder[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, sessionId]);

  // Selection helpers
  const allChecked  = orders.length > 0 && checkedIds.size === orders.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(orders.map(o => o._id)));
  }
  function toggleOne(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Selection totals
  const selectedOrders    = orders.filter(o => checkedIds.has(o._id));
  const selectedTotal     = selectedOrders.reduce((s, o) => s + (o.total ?? o.totalAmount ?? 0), 0);
  const selectedRefunded  = selectedOrders.reduce((s, o) => s + (o.refunds || []).reduce((r, ref) => r + ref.totalRefunded, 0), 0);

  const totalSales   = orders.filter(o => !o.isVoided).reduce((s, o) => s + (o.total ?? o.totalAmount ?? 0), 0);
  const totalRefunds = orders.reduce((s, o) => s + (o.refunds || []).reduce((r, ref) => r + ref.totalRefunded, 0), 0);

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
    </div>
  );

  if (orders.length === 0) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <PiShoppingCart className="h-8 w-8 text-gray-200" />
      <p className="text-sm text-gray-400">No orders in this session</p>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Table ── */}
      <div className={`flex flex-col overflow-hidden transition-all ${drawerOrder ? 'w-[55%]' : 'w-full'}`}>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 shrink-0 bg-gray-50/60">
          <div className="px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Orders</p>
            <p className="text-sm font-bold text-gray-900">{orders.length}</p>
          </div>
          <div className="px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Sales</p>
            <p className="text-sm font-bold text-[#b20202] tabular-nums">{formatCurrency(totalSales)}</p>
          </div>
          <div className="px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Refunds</p>
            <p className="text-sm font-bold text-amber-600 tabular-nums">{formatCurrency(totalRefunds)}</p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {/* Select-all checkbox */}
                <th className="w-8 px-2 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-gray-400 hover:text-[#b20202] transition-colors"
                  >
                    {allChecked
                      ? <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                      : someChecked
                      ? <PiCheckSquare className="h-4 w-4 text-gray-400" />
                      : <PiSquare className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-2 py-2.5 text-left">Time</th>
                <th className="px-2 py-2.5 text-left">Receipt</th>
                <th className="px-2 py-2.5 text-left">Customer</th>
                <th className="px-2 py-2.5 text-left">Method</th>
                <th className="px-2 py-2.5 text-right">Amount</th>
                <th className="px-2 py-2.5 text-center">Status</th>
                <th className="w-8 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const amount   = order.total ?? order.totalAmount ?? 0;
                const isVoided = order.isVoided;
                const refunded = (order.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);
                const isOpen   = drawerOrder?._id === order._id;
                const isChecked = checkedIds.has(order._id);
                const customer = order.customer?.firstName && order.customer.firstName !== 'Walk-in'
                  ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
                  : '—';

                return (
                  <tr
                    key={order._id}
                    className={`border-b border-gray-100 transition-colors ${
                      isOpen    ? 'bg-[#b20202]/8 border-l-2 border-l-[#b20202]'
                      : isChecked ? 'bg-[#b20202]/5 border-l-2 border-l-[#b20202]'
                      : 'bg-white hover:bg-gray-50 border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Checkbox — stops row click propagation */}
                    <td className="w-8 px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleOne(order._id)}
                        className="text-gray-400 hover:text-[#b20202] transition-colors"
                      >
                        {isChecked
                          ? <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                          : <PiSquare className="h-4 w-4" />}
                      </button>
                    </td>

                    {/* Clickable cells → open drawer */}
                    <td className="px-2 py-2.5 font-mono text-[10px] text-gray-500 cursor-pointer" onClick={() => setDrawerOrder(isOpen ? null : order)}>
                      {fmtTime(order.placedAt || order.createdAt)}
                    </td>
                    <td className="px-2 py-2.5 font-semibold text-gray-800 cursor-pointer" onClick={() => setDrawerOrder(isOpen ? null : order)}>
                      {order.receiptNumber || order.orderNumber || '—'}
                    </td>
                    <td className="px-2 py-2.5 max-w-[90px] truncate text-gray-600 cursor-pointer" onClick={() => setDrawerOrder(isOpen ? null : order)}>
                      {customer}
                    </td>
                    <td className="px-2 py-2.5 capitalize text-gray-500 cursor-pointer" onClick={() => setDrawerOrder(isOpen ? null : order)}>
                      {(order.paymentMethod || '').replace(/_/g, ' ')}
                    </td>
                    <td className={`px-2 py-2.5 text-right font-bold tabular-nums cursor-pointer ${isVoided ? 'text-gray-400 line-through' : 'text-gray-900'}`} onClick={() => setDrawerOrder(isOpen ? null : order)}>
                      {formatCurrency(amount)}
                    </td>
                    <td className="px-2 py-2.5 text-center cursor-pointer" onClick={() => setDrawerOrder(isOpen ? null : order)}>
                      {isVoided ? (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">VOID</span>
                      ) : refunded >= amount ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">RTN</span>
                      ) : refunded > 0 ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">P.RTN</span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">PAID</span>
                      )}
                    </td>

                    {/* Per-row print button */}
                    <td className="w-8 px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => printOrders([order], tenant)}
                        className="text-gray-300 hover:text-[#b20202] transition-colors"
                        title="Print invoice"
                      >
                        <PiPrinter className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Selection footer ── */}
        {checkedIds.size > 0 && (
          <div className="shrink-0 border-t-2 border-[#b20202] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Count + total */}
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700">
                  <span className="text-[#b20202] font-bold">{checkedIds.size}</span> order{checkedIds.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-lg font-extrabold tabular-nums text-gray-900 leading-tight">
                  {formatCurrency(selectedTotal)}
                </p>
                {selectedRefunded > 0 && (
                  <p className="text-[10px] text-red-500 tabular-nums">
                    −{formatCurrency(selectedRefunded)} returned · Net {formatCurrency(Math.max(0, selectedTotal - selectedRefunded))}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckedIds(new Set())}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => printOrders(selectedOrders, tenant)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                  style={{ backgroundColor: '#b20202' }}
                >
                  <PiPrinter className="h-3.5 w-3.5" />
                  Print {checkedIds.size > 1 ? `${checkedIds.size} Invoices` : 'Invoice'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Order detail drawer ── */}
      {drawerOrder && (
        <div className="w-[45%] shrink-0 overflow-hidden">
          <OrderDrawer order={drawerOrder} tenant={tenant} onClose={() => setDrawerOrder(null)} />
        </div>
      )}
    </div>
  );
}

// ── Session detail panel ──────────────────────────────────────────────────────

function SessionDetail({ session, token, tenant, onClose, onTabChange }: { session: POSSession; token: string; tenant?: POSTenant | null; onClose: () => void; onTabChange?: (tab: 'overview' | 'orders') => void }) {
  const [tab, setTab] = useState<'overview' | 'orders'>('overview');

  function switchTab(t: 'overview' | 'orders') { setTab(t); onTabChange?.(t); }

  const dur    = duration(session.openedAt, session.closedAt);
  const moves  = (session as any).cashMovements as Array<{ type: string; amount: number; reason?: string; performedAt: string; performedBy?: { firstName: string; lastName: string; posName?: string } }> || [];
  const totalIn  = moves.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalOut = moves.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);

  const methods = (session.methodBalances || []).filter(m => m.theoretical > 0 || (m.counted ?? 0) > 0);
  const cashierLogs = (session as any).cashierLog as Array<{ cashier: any; startedAt: string; endedAt?: string }> || [];

  return (
    <div className="flex h-full flex-col bg-white">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold
              ${session.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
              {session.status === 'open'
                ? <><span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />Open</>
                : 'Closed'}
            </span>
            <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {session.terminalType || 'retail'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{fmtDateTime(session.openedAt)}</p>
          <p className="mt-0.5 font-mono text-[10px] text-gray-300 select-all">{session._id}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <PiX className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id: 'overview', label: 'Overview', icon: <PiInfo   className="h-3.5 w-3.5" /> },
          { id: 'orders',   label: `Orders${session.orderCount > 0 ? ` (${session.orderCount})` : ''}`, icon: <PiList className="h-3.5 w-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
              tab === t.id
                ? 'border-b-2 border-[#b20202] text-[#b20202]'
                : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="flex-1 overflow-y-auto">
          {/* Key metrics */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Orders',      value: String(session.orderCount),         icon: <PiShoppingCart className="h-4 w-4" /> },
              { label: 'Total Sales', value: formatCurrency(session.totalSales), icon: <PiCurrencyNgn  className="h-4 w-4" />, highlight: true },
              { label: 'Duration',    value: dur,                                icon: <PiTimer        className="h-4 w-4" /> },
            ].map(({ label, value, icon, highlight }) => (
              <div key={label} className="px-4 py-3 text-center">
                <span className={`mb-1 inline-flex ${highlight ? 'text-[#b20202]' : 'text-gray-400'}`}>{icon}</span>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${highlight ? 'text-[#b20202]' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Opening / closing info */}
          <div className="border-b border-gray-100 px-5 py-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-500 flex items-center gap-1.5"><PiStorefront className="h-3.5 w-3.5" />Opened</span>
              <span className="text-gray-800">{fmtDateTime(session.openedAt)} · <span className="font-medium">{cashierLabel(session.openedBy as any)}</span></span>
            </div>
            {session.closedAt && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-500 flex items-center gap-1.5"><PiLockKey className="h-3.5 w-3.5" />Closed</span>
                <span className="text-gray-800">{fmtDateTime(session.closedAt)} · <span className="font-medium">{cashierLabel(session.closedBy as any)}</span></span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-500">Opening Cash</span>
              <span className="font-medium text-gray-800 tabular-nums">{formatCurrency(session.openingCash)}</span>
            </div>
          </div>

          {/* Payment breakdown */}
          {methods.length > 0 && (
            <div className="border-b border-gray-100 px-5 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment Breakdown</p>
              <div className="space-y-2">
                {methods.map((m) => {
                  const counted = m.counted ?? m.theoretical;
                  const diff    = counted - m.theoretical;
                  const hasDiff = Math.abs(diff) > 0.01;
                  return (
                    <div key={m.method} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${hasDiff ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <span className={hasDiff ? 'text-red-400' : 'text-gray-400'}>{METHOD_ICONS[m.method]}</span>
                      <span className="flex-1 text-sm font-semibold text-gray-800">{METHOD_LABELS[m.method] || m.method}</span>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(m.theoretical)}</p>
                        {hasDiff && (
                          <p className={`text-[10px] font-semibold tabular-nums ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                          </p>
                        )}
                      </div>
                      {hasDiff
                        ? <PiWarningCircle className="h-4 w-4 shrink-0 text-red-400" />
                        : <PiCheckCircle   className="h-4 w-4 shrink-0 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cash movements */}
          {moves.length > 0 && (
            <div className="border-b border-gray-100 px-5 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cash Movements</p>
                <div className="flex gap-2 text-[10px] font-semibold">
                  <span className="text-emerald-600">+{formatCurrency(totalIn)}</span>
                  <span className="text-red-500">−{formatCurrency(totalOut)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {moves.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {m.type === 'in' ? <PiArrowDown className="h-3 w-3" /> : <PiArrowUp className="h-3 w-3" />}
                    </div>
                    <span className="flex-1 text-xs text-gray-600 truncate">{m.reason || (m.type === 'in' ? 'Cash In' : 'Cash Out')}</span>
                    <span className={`text-xs font-bold tabular-nums ${m.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.type === 'in' ? '+' : '−'}{formatCurrency(m.amount)}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(m.performedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cashier log */}
          {cashierLogs.length > 0 && (
            <div className="border-b border-gray-100 px-5 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Cashier Log</p>
              <div className="space-y-1.5">
                {cashierLogs.map((log, i) => {
                  const name = typeof log.cashier === 'object' ? cashierLabel(log.cashier) : 'Cashier';
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-xs">
                      <PiUserCircle className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="flex-1 font-medium text-gray-800">{name}</span>
                      <span className="text-gray-400">{fmtTime(log.startedAt)}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-gray-400">{log.endedAt ? fmtTime(log.endedAt) : 'now'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {(session.closingNotes || (session as any).notes) && (
            <div className="px-5 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <PiNote className="h-3.5 w-3.5" />Notes
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {session.closingNotes || (session as any).notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Orders tab ── */}
      {tab === 'orders' && (
        <OrdersTab sessionId={session._id} token={token} tenant={tenant} />
      )}
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  session,
  selected,
  compact,
  onClick,
}: {
  session: POSSession;
  selected: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const isOpen = session.status === 'open';
  const dur    = duration(session.openedAt, session.closedAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border-b border-gray-100 transition-colors
        ${compact ? 'px-3 py-3' : 'px-5 py-4'}
        ${selected ? 'bg-[#b20202] text-white' : 'bg-white hover:bg-gray-50'}`}
    >
      <div className="flex items-center gap-2.5">
        {/* Status dot */}
        <div className="shrink-0">
          {isOpen ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-xs font-bold ${selected ? 'text-white' : 'text-gray-900'}`}>
              {fmtDate(session.openedAt)}
            </span>
            {!compact && (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border
                ${selected ? 'border-white/30 bg-white/15 text-white/80' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                {session.terminalType || 'retail'}
              </span>
            )}
            {session.hasDifference && (
              <PiWarningCircle className={`h-3 w-3 shrink-0 ${selected ? 'text-yellow-300' : 'text-amber-500'}`} />
            )}
          </div>
          <div className={`flex items-center gap-1.5 text-[10px] ${selected ? 'text-white/70' : 'text-gray-400'}`}>
            <span>{fmtTime(session.openedAt)}{session.closedAt ? ` → ${fmtTime(session.closedAt)}` : ''}</span>
            {!compact && <><span>·</span><span className="truncate">{cashierLabel(session.openedBy as any)}</span></>}
          </div>
          {/* Session ID — shown in compact mode for searchability */}
          <div className={`mt-0.5 font-mono text-[9px] truncate ${selected ? 'text-white/40' : 'text-gray-300'}`}>
            {session._id}
          </div>
        </div>

        {/* Metrics — hide when compact */}
        {!compact && (
          <div className="shrink-0 text-right">
            <p className={`text-xs font-bold tabular-nums ${selected ? 'text-white' : 'text-gray-900'}`}>
              {formatCurrency(session.totalSales)}
            </p>
            <p className={`text-[10px] ${selected ? 'text-white/60' : 'text-gray-400'}`}>
              {session.orderCount} order{session.orderCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function POSSessions() {
  const { token: posToken, tenant, staff } = usePOSAuth();
  const { data: session, status: sessionStatus } = useSession();
  const sessionToken = (session?.user as { token?: string })?.token ?? null;
  const token = (!posToken || isTokenExpired(posToken)) ? sessionToken : posToken;
  const router = useRouter();

  const [sessions, setSessions]         = useState<POSSession[]>([]);
  const [loading,  setLoading]          = useState(true);
  const [page,     setPage]             = useState(1);
  const [total,    setTotal]            = useState(0);
  const [filter,   setFilter]           = useState<FilterStatus>('all');
  const [search,   setSearch]           = useState('');
  const [showPanel, setShowPanel]       = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [groupBy,  setGroupBy]          = useState<GroupKey | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => loadSavedSearches());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selected, setSelected]         = useState<POSSession | null>(null);
  const [detailTab, setDetailTab]       = useState<'overview' | 'orders'>('overview');
  const searchBarRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 20;

  // Derive status filter from activeFilters + filter pills
  const effectiveStatus: 'open' | 'closed' | undefined = useMemo(() => {
    if (filter === 'open'   || activeFilters.has('in_progress')) return 'open';
    if (filter === 'closed') return 'closed';
    return undefined;
  }, [filter, activeFilters]);

  const fetchSessions = useCallback(() => {
    if (sessionStatus === 'loading') return;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    posApi.getSessions(token, page, PAGE_SIZE, effectiveStatus)
      .then((d) => { setSessions(d.sessions || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, effectiveStatus, sessionStatus]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { setExpandedGroups(new Set()); }, [groupBy]);

  function toggleGroup(name: string) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  function changeFilter(f: FilterStatus) {
    setFilter(f);
    // Sync filter pill with panel 'in_progress' filter
    if (f === 'open') {
      setActiveFilters(prev => { const n = new Set(prev); n.add('in_progress'); return n; });
    } else {
      setActiveFilters(prev => { const n = new Set(prev); n.delete('in_progress'); return n; });
    }
    setPage(1);
    setSelected(null);
  }

  function toggleFilter(f: FilterKey) {
    setActiveFilters(prev => {
      const n = new Set(prev);
      n.has(f) ? n.delete(f) : n.add(f);
      // Sync 'in_progress' → status filter pill
      if (f === 'in_progress') setFilter(n.has('in_progress') ? 'open' : 'all');
      return n;
    });
    setPage(1);
    setSelected(null);
  }

  function removeFilter(f: FilterKey) {
    setActiveFilters(prev => { const n = new Set(prev); n.delete(f); return n; });
    if (f === 'in_progress' && filter === 'open') setFilter('all');
    setPage(1);
  }

  // Saved searches
  function saveSearch(name: string) {
    const entry: SavedSearch = { id: Date.now().toString(), name, query: search, filters: Array.from(activeFilters), groupBy };
    const updated = [...savedSearches, entry];
    setSavedSearches(updated);
    persistSavedSearches(updated);
  }
  function loadSaved(s: SavedSearch) {
    setSearch(s.query);
    setActiveFilters(new Set(s.filters));
    setGroupBy(s.groupBy);
    if (s.filters.includes('in_progress')) setFilter('open');
    else setFilter('all');
  }
  function deleteSaved(id: string) {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    persistSavedSearches(updated);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Client-side filter + search ────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let list = sessions;

    // Text search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const cashier = cashierLabel(s.openedBy as any).toLowerCase();
        const date    = fmtDate(s.openedAt).toLowerCase();
        const term    = (s.terminalType || 'retail').toLowerCase();
        const id      = s._id.toLowerCase();
        return id.includes(q) || cashier.includes(q) || date.includes(q) || term.includes(q);
      });
    }

    // My Sessions
    if (activeFilters.has('my_sessions') && staff) {
      list = list.filter(s => (s.openedBy as any)?._id === staff._id);
    }

    // Opening date filters
    const now = new Date();
    if (activeFilters.has('opening_today')) {
      list = list.filter(s => isSameDay(new Date(s.openedAt), now));
    } else if (activeFilters.has('opening_yesterday')) {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      list = list.filter(s => isSameDay(new Date(s.openedAt), yesterday));
    } else if (activeFilters.has('opening_this_week')) {
      const weekStart = startOfWeek(now);
      list = list.filter(s => new Date(s.openedAt) >= weekStart);
    } else if (activeFilters.has('opening_this_month')) {
      const monthStart = startOfMonth(now);
      list = list.filter(s => new Date(s.openedAt) >= monthStart);
    }

    return list;
  }, [sessions, search, activeFilters, staff]);

  // ── Group By ───────────────────────────────────────────────────────────────
  const groupedSessions = useMemo((): [string, POSSession[]][] | null => {
    if (!groupBy) return null;
    const map = new Map<string, POSSession[]>();
    filteredSessions.forEach(s => {
      let key: string;
      switch (groupBy) {
        case 'opened_by':    key = cashierLabel(s.openedBy as any); break;
        case 'terminal':     key = (s.terminalType || 'retail').charAt(0).toUpperCase() + (s.terminalType || 'retail').slice(1); break;
        case 'status':       key = s.status === 'open' ? 'Open' : 'Closed'; break;
        case 'opening_day':  key = fmtDate(s.openedAt); break;
        case 'opening_week': key = weekLabel(new Date(s.openedAt)); break;
        case 'opening_month':   key = new Date(s.openedAt).toLocaleDateString('en-GB',{month:'long',year:'numeric'}); break;
        case 'opening_quarter': key = quarterLabel(new Date(s.openedAt)); break;
        case 'opening_year':    key = yearLabel(new Date(s.openedAt)); break;
        case 'closing_day':     key = s.closedAt ? fmtDate(s.closedAt) : 'Not closed'; break;
        case 'closing_week':    key = s.closedAt ? weekLabel(new Date(s.closedAt)) : 'Not closed'; break;
        case 'closing_month':   key = s.closedAt ? new Date(s.closedAt).toLocaleDateString('en-GB',{month:'long',year:'numeric'}) : 'Not closed'; break;
        case 'closing_quarter': key = s.closedAt ? quarterLabel(new Date(s.closedAt)) : 'Not closed'; break;
        case 'closing_year':    key = s.closedAt ? yearLabel(new Date(s.closedAt)) : 'Not closed'; break;
        default: key = '—';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries());
  }, [filteredSessions, groupBy]);

  // ── Active chip labels ─────────────────────────────────────────────────────
  const filterLabels: Record<FilterKey, string> = {
    my_sessions: 'My Sessions', in_progress: 'In Progress',
    opening_today: 'Opening: Today', opening_yesterday: 'Opening: Yesterday',
    opening_this_week: 'Opening: This Week', opening_this_month: 'Opening: This Month',
  };
  const groupByLabels: Record<GroupKey, string> = {
    opened_by: 'Opened By', terminal: 'Point of Sale', status: 'Status',
    opening_day: 'Opening: Day', opening_week: 'Opening: Week', opening_month: 'Opening: Month',
    opening_quarter: 'Opening: Quarter', opening_year: 'Opening: Year',
    closing_day: 'Closing: Day', closing_week: 'Closing: Week', closing_month: 'Closing: Month',
    closing_quarter: 'Closing: Quarter', closing_year: 'Closing: Year',
  };
  const activeChips: { key: string; label: string; type: 'filter' | 'group' }[] = Array.from(activeFilters).map(f => ({ key: f, label: filterLabels[f] || f, type: 'filter' as const }));
  if (groupBy) activeChips.push({ key: groupBy, label: `Group: ${groupByLabels[groupBy]}`, type: 'group' as const });
  const hasActiveOptions = activeChips.length > 0;

  // Summary counts
  const openCount   = sessions.filter(s => s.status === 'open').length;
  const totalSales  = sessions.reduce((s, sess) => s + sess.totalSales, 0);
  const totalOrders = sessions.reduce((s, sess) => s + sess.orderCount, 0);

  return (
    <div className="flex h-dvh flex-col bg-gray-50">

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={() => router.push(routes.pos.index)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <PiArrowLeft className="h-4 w-4" /> Back
        </button>

        <div>
          <h1 className="text-base font-bold text-gray-900">Sessions</h1>
          <p className="text-[11px] text-gray-400">{total} total · {openCount} open</p>
        </div>

        {/* Search + panel */}
        <div ref={searchBarRef} className="relative flex-1 max-w-lg">
          <div className={`flex overflow-hidden rounded-xl border transition-all ${showPanel ? 'border-[#b20202] ring-1 ring-[#b20202]/10' : 'border-gray-200'} bg-white`}>
            <div className="relative flex-1">
              <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                onFocus={() => setShowPanel(true)}
                placeholder="Search sessions…"
                className="h-9 w-full bg-transparent pl-9 pr-2 text-sm outline-none"
              />
            </div>
            {(search || hasActiveOptions) && (
              <button type="button" onClick={() => { setSearch(''); setActiveFilters(new Set()); setGroupBy(null); setFilter('all'); }}
                className="flex items-center px-2 text-gray-400 hover:text-gray-600">
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={() => setShowPanel(v => !v)}
              className={`flex items-center gap-1 border-l border-gray-200 px-3 text-xs font-semibold transition-colors
                ${showPanel ? 'bg-[#b20202]/5 text-[#b20202]' : 'text-gray-500 hover:bg-gray-50'}`}>
              {showPanel ? <PiCaretUp className="h-3.5 w-3.5" /> : <PiCaretDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Panel dropdown */}
          {showPanel && (
            <SearchPanel
              staffId={staff?._id}
              activeFilters={activeFilters}
              groupBy={groupBy}
              savedSearches={savedSearches}
              onToggleFilter={toggleFilter}
              onSetGroupBy={setGroupBy}
              onSave={saveSearch}
              onLoadSaved={loadSaved}
              onDeleteSaved={deleteSaved}
              onClose={() => setShowPanel(false)}
            />
          )}
        </div>

        {/* Filter pills */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
          {(['all', 'open', 'closed'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => changeFilter(f)}
              className={`rounded-lg px-3 py-1.5 capitalize transition-all ${
                filter === f
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={fetchSessions}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Active filter chips ── */}
      {hasActiveOptions && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-2">
          {activeChips.map(chip => (
            <span key={chip.key}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold
                ${chip.type === 'group'
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                  : 'bg-[#b20202]/10 text-[#b20202] ring-1 ring-[#b20202]/20'}`}>
              {chip.type === 'group' ? <PiStack className="h-3 w-3" /> : <PiFunnel className="h-3 w-3" />}
              {chip.label}
              <button type="button"
                onClick={() => chip.type === 'filter' ? removeFilter(chip.key as FilterKey) : setGroupBy(null)}
                className="ml-0.5 opacity-60 hover:opacity-100">
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button"
            onClick={() => { setActiveFilters(new Set()); setGroupBy(null); setFilter('all'); }}
            className="ml-1 text-[11px] text-gray-400 hover:text-gray-600 underline">
            Clear all
          </button>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="flex shrink-0 border-b border-gray-200 bg-white">
        {[
          { label: 'Sessions',     value: String(total),                icon: <PiReceipt      className="h-4 w-4" /> },
          { label: 'Total Orders', value: String(totalOrders),          icon: <PiShoppingCart className="h-4 w-4" /> },
          { label: 'Total Sales',  value: formatCurrency(totalSales),   icon: <PiCurrencyNgn  className="h-4 w-4" />, highlight: true },
          { label: 'Open Now',     value: String(openCount),            icon: <PiStorefront   className="h-4 w-4" />, open: true },
        ].map(({ label, value, icon, highlight, open }, i) => (
          <div key={label} className={`flex-1 border-r border-gray-100 px-4 py-3 last:border-r-0 ${i === 0 ? '' : ''}`}>
            <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-semibold uppercase tracking-wider ${highlight ? 'text-[#b20202]' : open ? 'text-emerald-600' : 'text-gray-400'}`}>
              {icon}{label}
            </div>
            <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-[#b20202]' : open && openCount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Session list — narrows when detail is open ── */}
        <div className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected ? 'w-72 shrink-0' : 'flex-1'}`}>
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-6">
              <PiReceipt className="h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-400">
                {search
                  ? `No sessions matching "${search}"`
                  : filter !== 'all' ? `No ${filter} sessions` : 'No sessions yet'}
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs text-[#b20202] hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto] border-b border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span>
                  Session
                  {search && (
                    <span className="ml-1.5 font-normal text-gray-400">
                      — {filteredSessions.length} of {sessions.length}
                    </span>
                  )}
                </span>
                {!selected && <span className="text-right">Sales / Orders</span>}
              </div>

              <div className="flex-1 overflow-y-auto">
                {groupedSessions ? (
                  /* ── Grouped view ── */
                  groupedSessions.map(([groupName, groupItems]) => {
                    const isExpanded = expandedGroups.has(groupName);
                    return (
                      <div key={groupName}>
                        {/* Group header */}
                        <div
                          className="sticky top-0 z-10 flex cursor-pointer select-none items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 transition-colors hover:bg-gray-100"
                          onClick={() => toggleGroup(groupName)}
                        >
                          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            <PiCaretRight className="h-3 w-3" />
                          </span>
                          <span className="text-xs font-semibold text-gray-700">{groupName}</span>
                          <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">{groupItems.length}</span>
                          <span className="ml-auto text-[10px] font-semibold text-gray-400 tabular-nums">
                            {formatCurrency(groupItems.reduce((s, g) => s + g.totalSales, 0))}
                          </span>
                        </div>
                        {isExpanded && groupItems.map(session => (
                          <SessionRow
                            key={session._id}
                            session={session}
                            selected={selected?._id === session._id}
                            compact={!!selected}
                            onClick={() => { setSelected(prev => prev?._id === session._id ? null : session); setDetailTab('overview'); }}
                          />
                        ))}
                      </div>
                    );
                  })
                ) : (
                  /* ── Flat view ── */
                  filteredSessions.map((session) => (
                    <SessionRow
                      key={session._id}
                      session={session}
                      selected={selected?._id === session._id}
                      compact={!!selected}
                      onClick={() => {
                        setSelected((prev) => prev?._id === session._id ? null : session);
                        setDetailTab('overview');
                      }}
                    />
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-5 py-2.5">
                  <span className="text-xs text-gray-400">
                    Page {page} of {totalPages} · {total} sessions
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                    >
                      <PiCaretLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                    >
                      <PiCaretRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Detail panel — grows to fill remaining space ── */}
        <div className={`flex flex-col transition-all duration-200 ${selected ? 'flex-1 overflow-hidden' : 'w-72 shrink-0'}`}>
          {selected ? (
            <SessionDetail
              session={selected}
              token={token!}
              tenant={tenant}
              onClose={() => { setSelected(null); setDetailTab('overview'); }}
              onTabChange={setDetailTab}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <PiReceipt className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Select a session</p>
                <p className="mt-0.5 text-xs text-gray-400">Click any row to see full details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
