// @ts-nocheck
'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PiX, PiShoppingCart, PiTrendDown,
  PiCaretDown, PiCaretUp, PiCaretLeft, PiCaretRight, PiCaretRight as PiCaretRightSmall,
  PiPackage, PiMagnifyingGlass, PiFunnel, PiStack, PiStar,
  PiFloppyDisk, PiTrash, PiCalendar, PiArrowsClockwise,
  PiWarningCircle, PiCheckSquare, PiSquare, PiReceipt, PiCurrencyNgn,
  PiArrowLeft, PiInfo, PiPrinter, PiArrowCounterClockwise,
} from 'react-icons/pi';
import { FilterItem, GroupItem, SortIcon } from '@/components/list-controls';
import InvoicePreview from '@/components/InvoicePreview';
import { printInvoice, DEFAULT_STORE } from '@/utils/invoice';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function apiFetch(url: string, token: string) {
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message || 'Request failed');
  return body;
}

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';
const fmtTime = (iso: string) => iso
  ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  : '';
const fmtDateTime = (iso: string) => iso ? `${fmtDate(iso)} · ${fmtTime(iso)}` : '—';

// ── Date helpers ──────────────────────────────────────────────────────────────
function startOfDay(d = new Date()) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function startOfWeek(d = new Date()) { const r = startOfDay(d); r.setDate(r.getDate()-r.getDay()); return r; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function weekLabel(d: Date) {
  const s = startOfWeek(d); const e = new Date(s); e.setDate(e.getDate()+6);
  return `W${Math.ceil(d.getDate()/7)} · ${s.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}–${e.toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}`;
}
function quarterLabel(d: Date) { return `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`; }

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadSaved<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch { return []; } }
function persistSaved<T>(key: string, list: T[]) { localStorage.setItem(key, JSON.stringify(list)); }

// ── Filter / Group types ──────────────────────────────────────────────────────
type SoldFilterKey = 'sales_orders'|'quotations'|'to_invoice'|'fully_invoiced'
  |'date_today'|'date_yesterday'|'date_this_week'|'date_this_month';
type SoldGroupKey  = 'month'|'week'|'quarter'|'year'|'customer'|'status'|'payment';
type POFilterKey   = 'confirmed'|'received'|'draft'
  |'date_today'|'date_yesterday'|'date_this_week'|'date_this_month';
type POGroupKey    = 'vendor'|'month'|'week'|'quarter'|'year'|'status';

interface SavedSearch<FK extends string, GK extends string> {
  id: string; name: string; query: string; filters: FK[]; groupBy: GK|null;
}

const SOLD_FILTER_LABELS: Record<SoldFilterKey,string> = {
  sales_orders:'Sales Orders', quotations:'Quotations',
  to_invoice:'To Invoice', fully_invoiced:'Fully Invoiced',
  date_today:'Order: Today', date_yesterday:'Order: Yesterday',
  date_this_week:'Order: This Week', date_this_month:'Order: This Month',
};
const SOLD_GROUP_LABELS: Record<SoldGroupKey,string> = {
  month:'Month', week:'Week', quarter:'Quarter', year:'Year',
  customer:'Customer', status:'Status', payment:'Payment Method',
};
const PO_FILTER_LABELS: Record<POFilterKey,string> = {
  confirmed:'Confirmed', received:'Received', draft:'Draft / RFQ',
  date_today:'Order: Today', date_yesterday:'Order: Yesterday',
  date_this_week:'Order: This Week', date_this_month:'Order: This Month',
};
const PO_GROUP_LABELS: Record<POGroupKey,string> = {
  vendor:'Vendor', month:'Month', week:'Week', quarter:'Quarter', year:'Year', status:'Status',
};

// ── Search panel (3-col: Filters | Group By | Favorites) — exact POS style ───
function SearchPanel<FK extends string, GK extends string>({
  filterSections, groupSections,
  activeFilters, groupBy, savedSearches,
  onToggleFilter, onSetGroupBy, onSave, onLoadSaved, onDeleteSaved, onClose,
}: {
  filterSections: any[]; groupSections: any[];
  activeFilters: Set<FK>; groupBy: GK|null;
  savedSearches: SavedSearch<FK,GK>[];
  onToggleFilter: (f: FK)=>void; onSetGroupBy: (g: GK|null)=>void;
  onSave: (n: string)=>void; onLoadSaved: (s: SavedSearch<FK,GK>)=>void;
  onDeleteSaved: (id: string)=>void; onClose: ()=>void;
}) {
  const [filterDateOpen, setFilterDateOpen] = useState(false);
  const [groupDateOpen,  setGroupDateOpen]  = useState(false);
  const [showSave,       setShowSave]       = useState(false);
  const [saveName,       setSaveName]       = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/8"
      style={{ minWidth: 660 }}
    >
      <div className="flex divide-x divide-gray-100">
        {/* Filters */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiFunnel className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="space-y-0.5">
            {filterSections.map((s: any, i: number) => {
              if ('key' in s) return <FilterItem key={s.key} fkey={s.key} label={s.label} active={activeFilters.has(s.key)} onToggle={onToggleFilter} />;
              return (
                <div key={i}>
                  <button type="button" onClick={() => setFilterDateOpen(v=>!v)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <span className="flex items-center gap-2"><PiCalendar className="h-4 w-4 text-gray-400" />{s.header}</span>
                    {filterDateOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
                  </button>
                  {filterDateOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                      {s.children.map((c: any) => <FilterItem key={c.key} fkey={c.key} label={c.label} active={activeFilters.has(c.key)} onToggle={onToggleFilter} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Group By */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </div>
          <div className="space-y-0.5">
            {groupSections.map((s: any, i: number) => {
              if ('key' in s) return <GroupItem key={s.key} gkey={s.key} label={s.label} active={groupBy===s.key} onToggle={onSetGroupBy} />;
              return (
                <div key={i}>
                  <button type="button" onClick={() => setGroupDateOpen(v=>!v)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <span className="flex items-center gap-2"><PiCalendar className="h-4 w-4 text-gray-400" />{s.header}</span>
                    {groupDateOpen ? <PiCaretUp className="h-3 w-3 text-gray-400" /> : <PiCaretDown className="h-3 w-3 text-gray-400" />}
                  </button>
                  {groupDateOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                      {s.children.map((c: any) => <GroupItem key={c.key} gkey={c.key} label={c.label} active={groupBy===c.key} onToggle={onSetGroupBy} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Favorites */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStar className="h-3.5 w-3.5" /> Favorites
          </div>
          <div className="space-y-1">
            {!showSave ? (
              <button type="button" onClick={() => setShowSave(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <PiFloppyDisk className="h-4 w-4 text-gray-400" /> Save current search
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <input autoFocus type="text" value={saveName} onChange={e=>setSaveName(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&saveName.trim()){onSave(saveName.trim());setSaveName('');setShowSave(false);}if(e.key==='Escape')setShowSave(false);}}
                  placeholder="Search name…"
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#b20202]" />
                <div className="flex gap-1.5">
                  <button type="button"
                    onClick={()=>{if(saveName.trim()){onSave(saveName.trim());setSaveName('');setShowSave(false);}}}
                    disabled={!saveName.trim()}
                    className="flex-1 rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    style={{backgroundColor:'#b20202'}}>
                    Save
                  </button>
                  <button type="button" onClick={()=>{setSaveName('');setShowSave(false);}}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {savedSearches.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
                {savedSearches.map(s => (
                  <div key={s.id} className="flex items-center gap-1 group">
                    <button type="button" onClick={()=>{onLoadSaved(s);onClose();}}
                      className="flex flex-1 items-center gap-2 truncate rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      <PiStar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <button type="button" onClick={()=>onDeleteSaved(s.id)}
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


// ── ────────────────────────────────────────────────────────────────────────────
// SOLD PANEL
// ── ────────────────────────────────────────────────────────────────────────────
const SOLD_KEY = 'dh-sold-history-v2';
const PAGE_SIZE = 50;

const SOLD_FILTER_SECTIONS = [
  { key:'sales_orders',   label:'Sales Orders' },
  { key:'quotations',     label:'Quotations' },
  { key:'to_invoice',     label:'To Invoice' },
  { key:'fully_invoiced', label:'Fully Invoiced' },
  { header:'Order Date', children:[
    { key:'date_today',      label:'Today' },
    { key:'date_yesterday',  label:'Yesterday' },
    { key:'date_this_week',  label:'This Week' },
    { key:'date_this_month', label:'This Month' },
  ]},
];
const SOLD_GROUP_SECTIONS = [
  { header:'Order Date', children:[
    { key:'month',   label:'Month' },
    { key:'week',    label:'Week' },
    { key:'quarter', label:'Quarter' },
    { key:'year',    label:'Year' },
  ]},
  { key:'customer', label:'Customer' },
  { key:'status',   label:'Status' },
  { key:'payment',  label:'Payment Method' },
];

type SoldStatusPill = 'all'|'paid'|'refunded'|'voided';

// ── Sold Detail panel — exact POS OrderDetail style ───────────────────────────

// ── Sold Detail panel ─────────────────────────────────────────────────────────
function SoldDetail({ order, productId, onClose }: { order: any; productId: string; onClose: ()=>void }) {
  const [tab, setTab] = useState<'details'|'invoice'|'returns'>('details');

  const line     = (order.items||[]).find((i: any) => String(i.subproduct?._id||i.subproduct)===productId);
  const qty      = line?.quantity || 0;
  const lineTotal = line ? (line.itemSubtotal ?? (line.priceAtPurchase||0)*qty) : 0;
  const amount   = order.totalAmount ?? order.total ?? 0;
  const subtotal = order.subtotal ?? amount;
  const discount = order.discountTotal ?? 0;
  const refunded = (order.refunds||[]).reduce((s: number, r: any)=>s+(r.totalRefunded||0), 0);
  const splits   = order.paymentDetails?.splitPayments ?? [];
  const change   = order.paymentDetails?.change ?? 0;
  const custName = order.customer ? `${order.customer.firstName||''} ${order.customer.lastName||''}`.trim()||null : null;
  const cashier  = order.posStaff ? (order.posStaff.posName||`${order.posStaff.firstName||''} ${order.posStaff.lastName||''}`.trim()) : null;
  const payLabel = splits.length>0
    ? splits.map((s: any)=>`${(s.method||'').replace(/_/g,' ').replace(/\b\w/g,(c: string)=>c.toUpperCase())} ${fmt(s.amount)}`).join(' + ')
    : (order.paymentMethod||'').replace(/_/g,' ').replace(/\b\w/g,(c: string)=>c.toUpperCase());

  // Status badge — mirrors POS statusBadge()
  const stLabel = order.isVoided ? 'Voided'
    : refunded >= amount && refunded > 0 ? 'Refunded'
    : refunded > 0 ? 'Part. Returned'
    : 'Paid';
  const stCls = order.isVoided ? 'bg-gray-100 text-gray-500'
    : refunded >= amount && refunded > 0 ? 'bg-red-50 text-red-600'
    : refunded > 0 ? 'bg-amber-50 text-amber-600'
    : 'bg-emerald-50 text-emerald-600';

  const ng = (v: number) => `₦${Number(v||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{order.receiptNumber || order.orderNumber || '—'}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stCls}`}>{stLabel}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{fmtDateTime(order.placedAt||order.createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={()=>printInvoice(order)} title="Print invoice"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202]">
            <PiPrinter className="h-4 w-4"/>
          </button>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5"/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id:'details', label:'Details',  icon:<PiInfo className="h-3.5 w-3.5"/> },
          { id:'invoice', label:'Invoice',  icon:<PiReceipt className="h-3.5 w-3.5"/> },
          { id:'returns', label:`Returns${(order.refunds?.length??0)>0?` (${order.refunds.length})`:''}`, icon:<PiArrowCounterClockwise className="h-3.5 w-3.5"/> },
        ] as const).map(t=>(
          <button key={t.id} type="button" onClick={()=>setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${tab===t.id?'border-b-2 border-[#b20202] text-[#b20202]':'border-b-2 border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div className="flex-1 overflow-y-auto">
          {/* 3-stat row */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label:'Total',     value:fmt(amount),              red:true },
              { label:'This Item', value:fmt(lineTotal) },
              { label:'Returned',  value:refunded>0?fmt(refunded):'—', amber:refunded>0 },
            ].map(({label,value,red,amber})=>(
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${red?'text-[#b20202]':amber?'text-amber-600':'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Fields */}
          <div className="border-b border-gray-100 px-5 py-3 space-y-1.5 text-xs">
            {([
              cashier                    && { label:'Cashier',    value: cashier },
              { label:'Customer',          value: custName || 'Walk-in Customer' },
              order.session              && { label:'Session',    value: `#${(order.session._id||'').slice(-8)}${order.session.terminalType?' · '+order.session.terminalType:''}` },
              { label:'Payment',           value: payLabel || '—' },
              change > 0                 && { label:'Change',     value: fmt(change) },
              { label:'Receipt #',         value: order.receiptNumber || '—' },
              { label:'Order #',           value: order.orderNumber || '—' },
              { label:'Status',            value: order.status || '—' },
              { label:'Qty (this item)',    value: String(qty) },
              line && { label:'Unit Price', value: fmt(line.priceAtPurchase||0) },
              line && line.discountAmount>0 && { label:'Item Discount', value:`−${fmt(line.discountAmount)}` },
            ] as any[]).filter(Boolean).map(({label,value}: any)=>(
              <div key={label} className="flex justify-between gap-4">
                <span className="font-semibold text-gray-500 shrink-0">{label}</span>
                <span className="font-medium text-gray-800 text-right capitalize truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* Items table */}
          {(order.items||[]).length > 0 && (
            <div>
              <div className="border-b border-gray-50 bg-gray-50 px-5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items ({(order.items||[]).length})</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-5 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(order.items||[]).map((item: any, i: number)=>{
                    const isThis = String(item.subproduct?._id||item.subproduct)===productId;
                    return (
                      <tr key={i} className={isThis?'bg-[#b20202]/4':''}>
                        <td className="px-5 py-2.5">
                          <span className={`font-medium ${isThis?'text-[#b20202]':'text-gray-800'}`}>{item.product?.name||item.name||'—'}</span>
                          {item.variant && <span className="text-gray-400"> · {item.variant}</span>}
                          {isThis && <span className="ml-1.5 rounded bg-[#b20202]/10 px-1 py-0.5 text-[9px] font-bold text-[#b20202]">this</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{ng(item.priceAtPurchase||0)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900">{ng(item.itemSubtotal||(item.priceAtPurchase||0)*(item.quantity||0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-5 py-3 space-y-1 text-xs">
                {discount>0 && <div className="flex justify-between" style={{color:'#b20202'}}><span>Discount</span><span className="font-semibold tabular-nums">−{ng(discount)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>Total</span><span className="tabular-nums">{ng(amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice tab */}
      {tab === 'invoice' && (
        <InvoicePreview order={order} store={DEFAULT_STORE} className="flex-1" />
      )}

      {/* Returns tab */}
      {tab === 'returns' && (
        <div className="flex-1 overflow-y-auto">
          {(order.refunds||[]).length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <PiArrowCounterClockwise className="h-8 w-8 text-gray-200"/>
              <p className="text-sm text-gray-400">No returns for this order</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(order.refunds||[]).map((r: any, i: number)=>(
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800">{r.receiptNumber||`Return ${i+1}`}</span>
                    <span className="text-sm font-bold tabular-nums" style={{color:'#b20202'}}>−{fmt(r.totalRefunded)}</span>
                  </div>
                  {r.refundedAt && <p className="text-[11px] text-gray-400">{fmtDateTime(r.refundedAt)}</p>}
                  {r.paymentMethod && <p className="text-[11px] text-gray-400 capitalize mt-0.5">via {r.paymentMethod.replace(/_/g,' ')}</p>}
                  {(r.items||[]).length>0 && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 space-y-1">
                      {r.items.map((ri: any, j: number)=>(
                        <div key={j} className="flex justify-between text-[11px]">
                          <span className="text-gray-600">Item #{ri.orderItemIndex+1} × {ri.quantity}</span>
                          <span className="font-semibold text-gray-800 tabular-nums">−{fmt(ri.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-gray-200 px-5 py-3 text-sm font-bold">
                <span className="text-gray-600">Total Returned</span>
                <span className="tabular-nums" style={{color:'#b20202'}}>−{fmt(refunded)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SoldPanel({ subProductId, productName, token, onClose }: {
  subProductId: string; productName: string; token: string; onClose: ()=>void;
}) {
  const [rows,           setRows]          = useState<any[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState('');
  const [search,         setSearch]        = useState('');
  const [showPanel,      setShowPanel]     = useState(false);
  const [activeFilters,  setActiveFilters] = useState<Set<SoldFilterKey>>(new Set(['sales_orders']));
  const [groupBy,        setGroupBy]       = useState<SoldGroupKey|null>('month');
  const [savedSearches,  setSavedSearches] = useState<SavedSearch<SoldFilterKey,SoldGroupKey>[]>(()=>loadSaved(SOLD_KEY));
  const [statusPill,     setStatusPill]    = useState<SoldStatusPill>('all');
  const [sortCol,        setSortCol]       = useState('date');
  const [sortDir,        setSortDir]       = useState<'asc'|'desc'>('desc');
  const [page,           setPage]          = useState(1);
  const [selected,       setSelected]      = useState<any>(null);
  const [checked,        setChecked]       = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups]= useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    setLoading(true);
    apiFetch(`${API_URL}/api/orders?subProductId=${subProductId}&limit=500`, token)
      .then(body => setRows(body.data?.orders||[]))
      .catch(e   => setError(e.message))
      .finally(()=>setLoading(false));
  }, [subProductId, token]);

  useEffect(()=>{ fetchData(); }, [fetchData]);
  useEffect(()=>{ setExpandedGroups(new Set()); }, [groupBy]);

  function toggleFilter(f: SoldFilterKey) {
    setActiveFilters(p=>{ const n=new Set(p); n.has(f)?n.delete(f):n.add(f); return n; }); setPage(1);
  }
  function removeFilter(f: SoldFilterKey) {
    setActiveFilters(p=>{ const n=new Set(p); n.delete(f); return n; });
  }
  function saveSearch(name: string) {
    const e={id:Date.now().toString(),name,query:search,filters:Array.from(activeFilters),groupBy};
    const nx=[...savedSearches,e]; setSavedSearches(nx); persistSaved(SOLD_KEY,nx);
  }
  function handleSort(col: string) {
    if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir(col==='date'?'desc':'asc'); }
    setPage(1);
  }
  function toggleGroup(name: string) {
    setExpandedGroups(p=>{ const n=new Set(p); n.has(name)?n.delete(name):n.add(name); return n; });
  }

  function getLine(order: any) {
    return (order.items||[]).find((i: any)=>String(i.subproduct?._id||i.subproduct)===subProductId);
  }

  const filtered = useMemo(()=>{
    let list=[...rows];
    const now=new Date();

    // Status pill
    if(statusPill==='paid')     list=list.filter(o=>!o.isVoided&&(o.refunds||[]).reduce((s: number,r: any)=>s+(r.totalRefunded||0),0)===0);
    if(statusPill==='refunded') list=list.filter(o=>{const r=(o.refunds||[]).reduce((s: number,r: any)=>s+(r.totalRefunded||0),0);return r>0||o.paymentStatus==='refunded'||o.paymentStatus==='partially_refunded';});
    if(statusPill==='voided')   list=list.filter(o=>o.isVoided);

    // Panel filters
    if(activeFilters.has('sales_orders'))   list=list.filter(o=>['confirmed','delivered','shipped','processing','paid'].includes(o.status));
    if(activeFilters.has('quotations'))     list=list.filter(o=>['pending','draft'].includes(o.status));
    if(activeFilters.has('to_invoice'))     list=list.filter(o=>o.paymentStatus==='pending'||o.paymentStatus==='unpaid');
    if(activeFilters.has('fully_invoiced')) list=list.filter(o=>o.paymentStatus==='paid');
    if(activeFilters.has('date_today'))     list=list.filter(o=>isSameDay(new Date(o.placedAt||o.createdAt),now));
    else if(activeFilters.has('date_yesterday')){ const y=new Date(now); y.setDate(y.getDate()-1); list=list.filter(o=>isSameDay(new Date(o.placedAt||o.createdAt),y)); }
    else if(activeFilters.has('date_this_week'))  list=list.filter(o=>new Date(o.placedAt||o.createdAt)>=startOfWeek(now));
    else if(activeFilters.has('date_this_month')) list=list.filter(o=>new Date(o.placedAt||o.createdAt)>=startOfMonth(now));

    const q=search.trim().toLowerCase();
    if(q) list=list.filter(o=>(o.orderNumber||'').toLowerCase().includes(q)||(o.receiptNumber||'').toLowerCase().includes(q)||(o.customer?.firstName||'').toLowerCase().includes(q)||(o.customer?.lastName||'').toLowerCase().includes(q)||(o.paymentMethod||'').toLowerCase().replace(/_/g,' ').includes(q));

    list.sort((a,b)=>{
      let cmp=0;
      switch(sortCol){
        case 'date':    cmp=new Date(a.placedAt||a.createdAt).getTime()-new Date(b.placedAt||b.createdAt).getTime(); break;
        case 'order':   cmp=(a.receiptNumber||'').localeCompare(b.receiptNumber||''); break;
        case 'customer':{ const ca=a.customer?`${a.customer.firstName||''} ${a.customer.lastName||''}`.trim():'zzz'; const cb=b.customer?`${b.customer.firstName||''} ${b.customer.lastName||''}`.trim():'zzz'; cmp=ca.localeCompare(cb); break; }
        case 'qty':     cmp=(getLine(a)?.quantity||0)-(getLine(b)?.quantity||0); break;
        case 'total':   { const la=getLine(a),lb=getLine(b); cmp=(la?(la.itemSubtotal??(la.priceAtPurchase||0)*(la.quantity||0)):0)-(lb?(lb.itemSubtotal??(lb.priceAtPurchase||0)*(lb.quantity||0)):0); break; }
      }
      return sortDir==='asc'?cmp:-cmp;
    });
    return list;
  },[rows,statusPill,activeFilters,search,sortCol,sortDir]);

  const grouped = useMemo(():([string,any[]][])|null=>{
    if(!groupBy) return null;
    const map=new Map<string,any[]>();
    filtered.forEach(o=>{
      const d=new Date(o.placedAt||o.createdAt); let key='—';
      switch(groupBy){
        case 'month':    key=d.toLocaleDateString('en-GB',{month:'long',year:'numeric'}); break;
        case 'week':     key=weekLabel(d); break;
        case 'quarter':  key=quarterLabel(d); break;
        case 'year':     key=String(d.getFullYear()); break;
        case 'customer': { const c=o.customer; key=c?`${c.firstName||''} ${c.lastName||''}`.trim()||'Walk-in':'Walk-in'; break; }
        case 'status':   key=o.status||'Unknown'; break;
        case 'payment':  key=(o.paymentMethod||'unknown').replace(/_/g,' '); break;
      }
      if(!map.has(key)) map.set(key,[]);
      map.get(key)!.push(o);
    });
    return Array.from(map.entries());
  },[filtered,groupBy]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const paginated   = grouped ? [] : filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const displayList = grouped ? filtered : paginated;
  const allChecked  = displayList.length>0 && displayList.every(o=>checked.has(o._id));
  const someChecked = checked.size>0 && !allChecked;
  const checkedRows = rows.filter(o=>checked.has(o._id));
  const checkedTotal = checkedRows.reduce((s,o)=>s+(o.totalAmount??o.total??0),0);
  function toggleAll()           { setChecked(allChecked?new Set():new Set(displayList.map(o=>o._id))); }
  function toggleOne(id: string) { setChecked(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;}); }

  const totalQty   = filtered.reduce((s,o)=>s+(getLine(o)?.quantity||0),0);
  const totalValue = filtered.reduce((s,o)=>{const l=getLine(o);return s+(l?(l.itemSubtotal??(l.priceAtPurchase||0)*(l.quantity||0)):0);},0);
  const totalRefunds = rows.reduce((s,o)=>s+(o.refunds||[]).reduce((r: number,ref: any)=>r+(ref.totalRefunded||0),0),0);
  const avgOrder   = filtered.length ? totalValue/filtered.length : 0;

  const hasOptions = activeFilters.size>0||!!groupBy;
  const chips = [
    ...Array.from(activeFilters).map(f=>({key:f, label:SOLD_FILTER_LABELS[f]||f, type:'filter' as const})),
    ...(groupBy?[{key:groupBy, label:`Group: ${SOLD_GROUP_LABELS[groupBy]}`, type:'group' as const}]:[]),
  ];

  const COLS = [
    {col:'date', label:'Date & Time'},
    {col:'order', label:'Receipt'},
    {col:'customer', label:'Customer'},
    {col:'payment', label:'Method'},
    {col:'qty', label:'Qty', right:true},
    {col:'price', label:'Unit Price', right:true},
    {col:'total', label:'Amount', right:true},
    {col:'status', label:'Status'},
  ];

  function renderRow(order: any, isSel: boolean) {
    const isChk = checked.has(order._id);
    const line  = getLine(order);
    const qty   = line?.quantity || 0;
    const total = line ? (line.itemSubtotal ?? (line.priceAtPurchase||0)*qty) : 0;
    const cust  = order.customer ? `${order.customer.firstName||''} ${order.customer.lastName||''}`.trim()||null : null;
    const refunded = (order.refunds||[]).reduce((s: number,r: any)=>s+(r.totalRefunded||0),0);
    const stLabel = order.isVoided?'Voided':refunded>=(order.totalAmount??order.total??0)&&refunded>0?'Refunded':refunded>0?'Part. Returned':'Paid';
    const stCls   = order.isVoided?'bg-gray-100 text-gray-500':refunded>=(order.totalAmount??order.total??0)&&refunded>0?'bg-red-50 text-red-600':refunded>0?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600';

    return (
      <tr key={order._id} className={`border-b border-gray-100 transition-colors ${
        isSel?'text-white':''+isChk?' border-l-2':'border-l-2 border-l-transparent'
      }`}
        style={isSel?{backgroundColor:'#b20202'}:isChk?{backgroundColor:'rgba(178,2,2,0.05)',borderLeftColor:'#b20202',borderLeftWidth:2}:{}}>
        <td className="w-8 px-2 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
          <button type="button" onClick={()=>toggleOne(order._id)} className="text-gray-400 hover:text-[#b20202]">
            {isChk
              ? <PiCheckSquare className="h-4 w-4" style={{color:'#b20202'}}/>
              : <PiSquare className="h-4 w-4"/>}
          </button>
        </td>
        <td className="cursor-pointer px-3 py-2.5" onClick={()=>setSelected(isSel?null:order)}>
          <div className={`text-xs font-medium ${isSel?'text-white':'text-gray-800'}`}>{fmtDate(order.placedAt||order.createdAt)}</div>
          <div className={`text-[10px] font-mono ${isSel?'text-red-100':'text-gray-500'}`}>{fmtTime(order.placedAt||order.createdAt)}</div>
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-xs font-semibold ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.receiptNumber||order.orderNumber||'—'}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-xs max-w-[100px] truncate ${isSel?'text-red-100':'text-gray-600'}`} onClick={()=>setSelected(isSel?null:order)}>
          {cust || <span className={isSel?'text-red-200':'text-gray-300'}>Walk-in</span>}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-xs capitalize ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:order)}>
          {(order.paymentMethod||'—').replace(/_/g,' ')}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:order)}>
          {qty}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-right text-xs tabular-nums ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:order)}>
          {line?fmt(line.priceAtPurchase||0):'—'}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel?'text-white':order.isVoided?'text-gray-400 line-through':'text-gray-900'}`} onClick={()=>setSelected(isSel?null:order)}>
          {fmt(total)}
        </td>
        <td className="cursor-pointer px-3 py-2.5 text-center" onClick={()=>setSelected(isSel?null:order)}>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isSel?'bg-white/20 text-white':stCls}`}>{stLabel}</span>
        </td>
      </tr>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button type="button" onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <PiArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">Sales History</h1>
          <p className="text-[11px] text-gray-400">{productName} · {rows.length} total · {filtered.length} shown</p>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className={`flex overflow-hidden rounded-xl border transition-all bg-white ${showPanel?'ring-1':'border-gray-200'}`}
            style={showPanel?{borderColor:'#b20202',boxShadow:'0 0 0 1px rgba(178,2,2,0.1)'}:{}}>
            <div className="relative flex-1">
              <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);setSelected(null);}}
                onFocus={()=>setShowPanel(true)}
                placeholder="Receipt, customer, method…"
                className="h-9 w-full bg-transparent pl-9 pr-2 text-sm outline-none" />
            </div>
            {(search||hasOptions) && (
              <button type="button" onClick={()=>{setSearch('');setActiveFilters(new Set());setGroupBy(null);setStatusPill('all');}}
                className="flex items-center px-2 text-gray-400 hover:text-gray-600"><PiX className="h-3.5 w-3.5"/></button>
            )}
            <button type="button" onClick={()=>setShowPanel(v=>!v)}
              className={`flex items-center border-l border-gray-200 px-3 text-xs font-semibold transition-colors`}
              style={showPanel?{backgroundColor:'rgba(178,2,2,0.05)',color:'#b20202'}:{}}>
              {!showPanel && <span className="text-gray-500">{showPanel?'':'  '}</span>}
              {showPanel ? <PiCaretUp className="h-3.5 w-3.5"/> : <PiCaretDown className="h-3.5 w-3.5 text-gray-500"/>}
            </button>
          </div>
          {showPanel && (
            <SearchPanel
              filterSections={SOLD_FILTER_SECTIONS} groupSections={SOLD_GROUP_SECTIONS}
              activeFilters={activeFilters} groupBy={groupBy} savedSearches={savedSearches}
              onToggleFilter={toggleFilter} onSetGroupBy={setGroupBy}
              onSave={saveSearch}
              onLoadSaved={s=>{setSearch(s.query);setActiveFilters(new Set(s.filters));setGroupBy(s.groupBy);}}
              onDeleteSaved={id=>{const nx=savedSearches.filter(s=>s.id!==id);setSavedSearches(nx);persistSaved(SOLD_KEY,nx);}}
              onClose={()=>setShowPanel(false)}
            />
          )}
        </div>

        {/* Status pills — exact POS style */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
          {(['all','paid','refunded','voided'] as SoldStatusPill[]).map(f=>(
            <button key={f} type="button" onClick={()=>{setStatusPill(f);setPage(1);setSelected(null);}}
              className={`rounded-lg px-3 py-1.5 capitalize transition-all ${statusPill===f?'text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}
              style={statusPill===f?{backgroundColor:'#b20202'}:{}}>
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
              <PiCaretLeft className="h-3.5 w-3.5"/>
            </button>
            <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <PiCaretRight className="h-3.5 w-3.5"/>
            </button>
          </div>
        )}
        <button type="button" onClick={fetchData} disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40">
          <PiArrowsClockwise className={`h-4 w-4 ${loading?'animate-spin':''}`}/>
        </button>
      </div>

      {/* Chips bar */}
      {chips.length>0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-2">
          {chips.map(c=>(
            <span key={c.key} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.type==='group'?'bg-blue-50 text-blue-700 ring-1 ring-blue-200':''}`}
              style={c.type==='filter'?{backgroundColor:'rgba(178,2,2,0.1)',color:'#b20202',boxShadow:'0 0 0 1px rgba(178,2,2,0.2)'}:{}}>
              {c.type==='group'?<PiStack className="h-3 w-3"/>:<PiFunnel className="h-3 w-3"/>}
              {c.label}
              <button type="button" onClick={()=>c.type==='filter'?removeFilter(c.key as SoldFilterKey):setGroupBy(null)} className="ml-0.5 opacity-60 hover:opacity-100"><PiX className="h-3 w-3"/></button>
            </span>
          ))}
          <button type="button" onClick={()=>{setActiveFilters(new Set());setGroupBy(null);}} className="ml-1 text-[11px] text-gray-400 hover:text-gray-600 underline">Clear all</button>
        </div>
      )}

      {/* Stats strip */}
      <div className="flex shrink-0 divide-x divide-gray-100 border-b border-gray-200 bg-white">
        {[
          {label:'Total Orders', value:String(rows.filter(o=>!o.isVoided).length), icon:<PiShoppingCart className="h-4 w-4"/>},
          {label:'Total Sales',  value:fmt(totalValue), icon:<PiCurrencyNgn className="h-4 w-4"/>, red:true},
          {label:'Total Refunds', value:fmt(totalRefunds), icon:<PiArrowCounterClockwise className="h-4 w-4"/>, amber:totalRefunds>0},
          {label:'Avg. Order',   value:fmt(avgOrder), icon:<PiReceipt className="h-4 w-4"/>},
        ].map(({label,value,icon,red,amber})=>(
          <div key={label} className="flex flex-1 items-center gap-3 px-5 py-3">
            <span style={red?{color:'#b20202'}:amber&&totalRefunds>0?{color:'#d97706'}:{color:'#9ca3af'}}>{icon}</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className={`text-sm font-bold tabular-nums`} style={red?{color:'#b20202'}:amber&&totalRefunds>0?{color:'#d97706'}:{color:'#111827'}}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected?'w-[55%]':'flex-1'}`}>
          {/* Selection bar */}
          {checked.size>0 && (
            <div className="shrink-0 flex items-center gap-3 bg-white px-4 py-2.5" style={{borderBottom:'2px solid #b20202'}}>
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="font-bold" style={{color:'#b20202'}}>{checked.size}</span> selected · <span className="font-bold text-gray-900">{fmt(checkedTotal)}</span>
              </div>
              <button type="button" onClick={()=>setChecked(new Set())} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">Clear</button>
            </div>
          )}
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200" style={{borderTopColor:'#b20202'}}/>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-red-500">
              <PiWarningCircle className="h-5 w-5 shrink-0"/> {error}
            </div>
          ) : filtered.length===0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <PiReceipt className="h-10 w-10 text-gray-200"/>
              <p className="text-sm text-gray-400">{search?`No orders matching "${search}"`:hasOptions||statusPill!=='all'?'No orders match the active filters':'No sales found'}</p>
              {(search||hasOptions||statusPill!=='all') && <button type="button" onClick={()=>{setSearch('');setActiveFilters(new Set());setGroupBy(null);setStatusPill('all');}} className="text-xs hover:underline" style={{color:'#b20202'}}>Clear filters</button>}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button type="button" onClick={toggleAll} className="text-gray-400 hover:text-[#b20202]"
                        onMouseOver={e=>(e.currentTarget.style.color='#b20202')} onMouseOut={e=>(e.currentTarget.style.color='')}>
                        {allChecked
                          ? <PiCheckSquare className="h-4 w-4" style={{color:'#b20202'}}/>
                          : someChecked
                          ? <PiCheckSquare className="h-4 w-4 text-gray-400"/>
                          : <PiSquare className="h-4 w-4"/>}
                      </button>
                    </th>
                    {COLS.map(({col,label,right})=>(
                      <th key={col} onClick={()=>handleSort(col)}
                        className={`cursor-pointer select-none px-3 py-3 hover:text-gray-600 ${right?'text-right':''}`}>
                        <span className="flex items-center gap-1">{label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir}/></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped ? grouped.map(([gName, gOrders])=>{
                    const isCollapsed = !expandedGroups.has(gName);
                    const gTotal = gOrders.reduce((s,o)=>{const l=getLine(o);return s+(l?(l.itemSubtotal??(l.priceAtPurchase||0)*(l.quantity||0)):0);},0);
                    return (
                      <React.Fragment key={gName}>
                        <tr className="cursor-pointer select-none border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={()=>toggleGroup(gName)}>
                          <td colSpan={9} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-gray-400 transition-transform ${isCollapsed?'':'rotate-90'}`}><PiCaretRightSmall className="h-3 w-3"/></span>
                              <span className="text-xs font-semibold text-gray-700">{gName}</span>
                              <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">{gOrders.length}</span>
                              <span className="ml-auto text-[10px] font-semibold text-gray-400 tabular-nums">{fmt(gTotal)}</span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && gOrders.map(o=>renderRow(o, selected?._id===o._id))}
                      </React.Fragment>
                    );
                  }) : paginated.map(o=>renderRow(o, selected?._id===o._id))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination footer */}
          {!groupBy && totalPages>1 && (
            <div className="shrink-0 flex items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-500">
              <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
              <div className="flex gap-1">
                {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
                  const p=totalPages<=7?i+1:i===0?1:i===6?totalPages:page-2+i;
                  return <button key={p} type="button" onClick={()=>setPage(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${p===page?'text-white':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={p===page?{backgroundColor:'#b20202',borderColor:'#b20202'}:{}}>{p}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className={`flex flex-col bg-white transition-all duration-200 ${selected?'flex-1 overflow-hidden':'w-72 shrink-0'}`}>
          {selected ? (
            <SoldDetail order={selected} productId={subProductId} onClose={()=>setSelected(null)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <PiReceipt className="h-7 w-7 text-gray-300"/>
              </div>
              <p className="text-sm font-semibold text-gray-500">Select an order</p>
              <p className="text-xs text-gray-400">Click a row to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ────────────────────────────────────────────────────────────────────────────
// PURCHASED PANEL
// ── ────────────────────────────────────────────────────────────────────────────
const PO_KEY = 'dh-po-history-v2';

const PO_FILTER_SECTIONS = [
  { key:'confirmed', label:'Confirmed' },
  { key:'received',  label:'Received' },
  { key:'draft',     label:'Draft / RFQ' },
  { header:'Order Date', children:[
    { key:'date_today',      label:'Today' },
    { key:'date_yesterday',  label:'Yesterday' },
    { key:'date_this_week',  label:'This Week' },
    { key:'date_this_month', label:'This Month' },
  ]},
];
const PO_GROUP_SECTIONS = [
  { key:'vendor', label:'Vendor' },
  { header:'Order Date', children:[
    { key:'month',   label:'Month' },
    { key:'week',    label:'Week' },
    { key:'quarter', label:'Quarter' },
    { key:'year',    label:'Year' },
  ]},
  { key:'status', label:'Status' },
];

type POStatusPill = 'all'|'confirmed'|'received'|'draft';

function PODetail({ po, productId, onClose }: { po: any; productId: string; onClose: ()=>void }) {
  const [tab, setTab] = useState<'details'|'items'>('details');

  const lines   = (po.items||[]).filter((i: any)=>String(i.subProductId?._id||i.subProductId)===productId);
  const qty     = lines.reduce((s: number,l: any)=>s+(l.quantity||l.packQty||0),0);
  const lineTotal = lines.reduce((s: number,l: any)=>s+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0);
  const unitP   = lines[0]?.unitPrice ?? 0;
  const poTotal = po.totalAmount ?? po.total ?? (po.items||[]).reduce((s: number,l: any)=>s+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0);
  const allQty  = (po.items||[]).reduce((s: number,l: any)=>s+(l.quantity||l.packQty||0),0);

  const stCls = po.status==='received'?'bg-green-50 text-green-600':po.status==='confirmed'||po.status==='approved'?'bg-blue-50 text-blue-600':'bg-gray-100 text-gray-500';

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-gray-900">{po.poNumber||po._id?.slice(-8)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stCls}`}>{po.status||'—'}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{fmtDate(po.confirmedAt||po.createdAt)}{po.vendor?.name?` · ${po.vendor.name}`:''}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><PiX className="h-5 w-5"/></button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id:'details', label:'Details', icon:<PiInfo className="h-3.5 w-3.5"/> },
          { id:'items',   label:`Items (${(po.items||[]).length})`, icon:<PiPackage className="h-3.5 w-3.5"/> },
        ] as const).map(t=>(
          <button key={t.id} type="button" onClick={()=>setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${tab===t.id?'border-b-2 border-[#b20202] text-[#b20202]':'border-b-2 border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div className="flex-1 overflow-y-auto">
          {/* 3-stat row */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label:'PO Total',  value:fmt(poTotal), red:true },
              { label:'This Item', value:fmt(lineTotal) },
              { label:'All Units', value:String(allQty) },
            ].map(({label,value,red})=>(
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums" style={red?{color:'#b20202'}:{color:'#111827'}}>{value}</p>
              </div>
            ))}
          </div>

          {/* Fields */}
          <div className="border-b border-gray-100 px-5 py-3 space-y-1.5 text-xs">
            {([
              { label:'Vendor',           value: po.vendor?.name || '—' },
              po.vendor?.contactPerson  && { label:'Contact',          value: po.vendor.contactPerson },
              po.vendor?.email          && { label:'Email',            value: po.vendor.email },
              po.vendor?.phone          && { label:'Phone',            value: po.vendor.phone },
              { label:'Status',           value: po.status || '—' },
              { label:'PO Number',        value: po.poNumber || '—' },
              { label:'Order Date',       value: fmtDate(po.confirmedAt||po.createdAt) },
              po.expectedDelivery       && { label:'Expected Delivery', value: fmtDate(po.expectedDelivery) },
              po.receivedAt             && { label:'Received',          value: fmtDate(po.receivedAt) },
              { label:'Qty (this item)',  value: String(qty) },
              unitP > 0                 && { label:'Unit Price',        value: fmt(unitP) },
              lineTotal > 0             && { label:'Item Total',        value: fmt(lineTotal) },
              po.notes                  && { label:'Notes',             value: po.notes },
            ] as any[]).filter(Boolean).map(({label,value}: any)=>(
              <div key={label} className="flex justify-between gap-4">
                <span className="font-semibold text-gray-500 shrink-0">{label}</span>
                <span className="font-medium text-gray-800 text-right capitalize truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* This-item highlight */}
          {qty > 0 && (
            <div className="mx-5 my-4 rounded-xl border border-[#b20202]/20 bg-[#b20202]/4 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{color:'#b20202'}}>This Product in PO</p>
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900">{qty} units</p>
                  {unitP > 0 && <p className="text-xs text-gray-500">@ {fmt(unitP)} / unit</p>}
                </div>
                <p className="text-base font-bold" style={{color:'#b20202'}}>{fmt(lineTotal)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items tab */}
      {tab === 'items' && (
        <div className="flex-1 overflow-y-auto">
          {(po.items||[]).length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <PiPackage className="h-8 w-8 text-gray-200"/>
              <p className="text-sm text-gray-400">No items on this PO</p>
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400 shadow-[0_1px_0_#e5e7eb]">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Product</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(po.items||[]).map((item: any, i: number)=>{
                    const isThis = String(item.subProductId?._id||item.subProductId)===productId;
                    const itemQty = item.quantity||item.packQty||0;
                    const itemTotal = item.totalCost||(item.unitPrice||0)*itemQty;
                    return (
                      <tr key={i} className={isThis?'bg-[#b20202]/4':''}>
                        <td className="px-5 py-2.5">
                          <span className={`font-medium ${isThis?'text-[#b20202]':'text-gray-800'}`}>{item.subProductName||item.name||item.subProductId?.name||'—'}</span>
                          {isThis && <span className="ml-1.5 rounded bg-[#b20202]/10 px-1 py-0.5 text-[9px] font-bold text-[#b20202]">this</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{itemQty}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{item.unitPrice>0?fmt(item.unitPrice):'—'}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(itemTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-5 py-3 text-xs">
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>PO Total</span>
                  <span className="tabular-nums" style={{color:'#b20202'}}>{fmt(poTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PurchasedPanel({ subProductId, productName, token, onClose }: {
  subProductId: string; productName: string; token: string; onClose: ()=>void;
}) {
  const [rows,           setRows]          = useState<any[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState('');
  const [search,         setSearch]        = useState('');
  const [showPanel,      setShowPanel]     = useState(false);
  const [activeFilters,  setActiveFilters] = useState<Set<POFilterKey>>(new Set());
  const [groupBy,        setGroupBy]       = useState<POGroupKey|null>('vendor');
  const [savedSearches,  setSavedSearches] = useState<SavedSearch<POFilterKey,POGroupKey>[]>(()=>loadSaved(PO_KEY));
  const [statusPill,     setStatusPill]    = useState<POStatusPill>('all');
  const [sortCol,        setSortCol]       = useState('date');
  const [sortDir,        setSortDir]       = useState<'asc'|'desc'>('desc');
  const [page,           setPage]          = useState(1);
  const [selected,       setSelected]      = useState<any>(null);
  const [checked,        setChecked]       = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups]= useState<Set<string>>(new Set());

  const fetchData = useCallback(()=>{
    setLoading(true);
    apiFetch(`${API_URL}/api/purchase-orders?subProductId=${subProductId}&limit=500`, token)
      .then(body=>setRows(body.data||[]))
      .catch(e=>setError(e.message))
      .finally(()=>setLoading(false));
  },[subProductId,token]);

  useEffect(()=>{ fetchData(); },[fetchData]);
  useEffect(()=>{ setExpandedGroups(new Set()); },[groupBy]);

  function toggleFilter(f: POFilterKey) {
    setActiveFilters(p=>{const n=new Set(p);n.has(f)?n.delete(f):n.add(f);return n;}); setPage(1);
  }
  function removeFilter(f: POFilterKey) {
    setActiveFilters(p=>{const n=new Set(p);n.delete(f);return n;});
  }
  function saveSearch(name: string) {
    const e={id:Date.now().toString(),name,query:search,filters:Array.from(activeFilters),groupBy};
    const nx=[...savedSearches,e]; setSavedSearches(nx); persistSaved(PO_KEY,nx);
  }
  function handleSort(col: string) {
    if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir(col==='date'?'desc':'asc'); }
    setPage(1);
  }
  function toggleGroup(name: string) {
    setExpandedGroups(p=>{const n=new Set(p);n.has(name)?n.delete(name):n.add(name);return n;});
  }

  function getLines(po: any) {
    return (po.items||[]).filter((i: any)=>String(i.subProductId?._id||i.subProductId)===subProductId);
  }

  const filtered = useMemo(()=>{
    let list=[...rows];
    const now=new Date();

    // Status pill
    if(statusPill==='confirmed') list=list.filter(po=>po.status==='confirmed'||po.status==='approved');
    if(statusPill==='received')  list=list.filter(po=>po.status==='received');
    if(statusPill==='draft')     list=list.filter(po=>po.status==='draft'||po.status==='rfq');

    // Panel filters
    if(activeFilters.has('confirmed')) list=list.filter(po=>po.status==='confirmed'||po.status==='approved');
    if(activeFilters.has('received'))  list=list.filter(po=>po.status==='received');
    if(activeFilters.has('draft'))     list=list.filter(po=>po.status==='draft'||po.status==='rfq');
    if(activeFilters.has('date_today'))     list=list.filter(po=>isSameDay(new Date(po.confirmedAt||po.createdAt),now));
    else if(activeFilters.has('date_yesterday')){ const y=new Date(now);y.setDate(y.getDate()-1);list=list.filter(po=>isSameDay(new Date(po.confirmedAt||po.createdAt),y)); }
    else if(activeFilters.has('date_this_week'))  list=list.filter(po=>new Date(po.confirmedAt||po.createdAt)>=startOfWeek(now));
    else if(activeFilters.has('date_this_month')) list=list.filter(po=>new Date(po.confirmedAt||po.createdAt)>=startOfMonth(now));

    const q=search.trim().toLowerCase();
    if(q) list=list.filter(po=>(po.poNumber||'').toLowerCase().includes(q)||(po.vendor?.name||'').toLowerCase().includes(q));

    list.sort((a,b)=>{
      let cmp=0;
      switch(sortCol){
        case 'date':   cmp=new Date(a.confirmedAt||a.createdAt).getTime()-new Date(b.confirmedAt||b.createdAt).getTime(); break;
        case 'order':  cmp=(a.poNumber||'').localeCompare(b.poNumber||''); break;
        case 'vendor': cmp=(a.vendor?.name||'').localeCompare(b.vendor?.name||''); break;
        case 'qty':    cmp=getLines(a).reduce((s: number,l: any)=>s+(l.quantity||l.packQty||0),0)-getLines(b).reduce((s: number,l: any)=>s+(l.quantity||l.packQty||0),0); break;
        case 'total':  cmp=getLines(a).reduce((s: number,l: any)=>s+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0)-getLines(b).reduce((s: number,l: any)=>s+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0); break;
      }
      return sortDir==='asc'?cmp:-cmp;
    });
    return list;
  },[rows,statusPill,activeFilters,search,sortCol,sortDir]);

  const grouped = useMemo(():([string,any[]][])|null=>{
    if(!groupBy) return null;
    const map=new Map<string,any[]>();
    filtered.forEach(po=>{
      const d=new Date(po.confirmedAt||po.createdAt); let key='—';
      switch(groupBy){
        case 'vendor':  key=po.vendor?.name||'Unknown Vendor'; break;
        case 'month':   key=d.toLocaleDateString('en-GB',{month:'long',year:'numeric'}); break;
        case 'week':    key=weekLabel(d); break;
        case 'quarter': key=quarterLabel(d); break;
        case 'year':    key=String(d.getFullYear()); break;
        case 'status':  key=po.status||'Unknown'; break;
      }
      if(!map.has(key)) map.set(key,[]);
      map.get(key)!.push(po);
    });
    return Array.from(map.entries());
  },[filtered,groupBy]);

  const totalPages  = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const paginated   = grouped?[]:filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const displayList = grouped?filtered:paginated;
  const allChecked  = displayList.length>0&&displayList.every(o=>checked.has(o._id));
  const someChecked = checked.size>0&&!allChecked;
  const checkedRows = rows.filter(o=>checked.has(o._id));
  const checkedTotal = checkedRows.reduce((s,po)=>s+getLines(po).reduce((ls: number,l: any)=>ls+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0),0);
  function toggleAll() { setChecked(allChecked?new Set():new Set(displayList.map(o=>o._id))); }
  function toggleOne(id: string) { setChecked(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;}); }

  const totalQty   = filtered.reduce((s,po)=>s+getLines(po).reduce((ls: number,l: any)=>ls+(l.quantity||l.packQty||0),0),0);
  const totalValue = filtered.reduce((s,po)=>s+getLines(po).reduce((ls: number,l: any)=>ls+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0),0);
  const avgPO      = filtered.length?totalValue/filtered.length:0;

  const hasOptions = activeFilters.size>0||!!groupBy;
  const chips = [
    ...Array.from(activeFilters).map(f=>({key:f,label:PO_FILTER_LABELS[f]||f,type:'filter' as const})),
    ...(groupBy?[{key:groupBy,label:`Group: ${PO_GROUP_LABELS[groupBy]}`,type:'group' as const}]:[]),
  ];

  const COLS = [
    {col:'order',  label:'Order Ref'},
    {col:'date',   label:'Date'},
    {col:'vendor', label:'Vendor'},
    {col:'status', label:'Status'},
    {col:'qty',    label:'Qty',        right:true},
    {col:'price',  label:'Unit Price', right:true},
    {col:'total',  label:'Amount',     right:true},
  ];

  function renderRow(po: any, isSel: boolean) {
    const isChk = checked.has(po._id);
    const lines = getLines(po);
    const qty   = lines.reduce((s: number,l: any)=>s+(l.quantity||l.packQty||0),0);
    const total = lines.reduce((s: number,l: any)=>s+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0);
    const unitP = lines[0]?.unitPrice??0;
    return (
      <tr key={po._id} className={`border-b border-gray-100 transition-colors`}
        style={isSel?{backgroundColor:'#b20202'}:isChk?{backgroundColor:'rgba(178,2,2,0.05)',borderLeft:'2px solid #b20202'}:{borderLeft:'2px solid transparent'}}>
        <td className="w-8 px-2 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
          <button type="button" onClick={()=>toggleOne(po._id)} className="text-gray-400">
            {isChk
              ? <PiCheckSquare className="h-4 w-4" style={{color:'#b20202'}}/>
              : <PiSquare className="h-4 w-4"/>}
          </button>
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-xs font-semibold font-mono ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:po)}>
          {po.poNumber||po._id?.slice(-8)}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-[11px] tabular-nums ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:po)}>
          {fmtDate(po.confirmedAt||po.createdAt)}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-xs ${isSel?'text-red-100':'text-gray-600'}`} onClick={()=>setSelected(isSel?null:po)}>
          {po.vendor?.name||'—'}
        </td>
        <td className="cursor-pointer px-3 py-2.5" onClick={()=>setSelected(isSel?null:po)}>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
            isSel?'bg-white/20 text-white':
            po.status==='received'?'bg-green-50 text-green-600':
            po.status==='confirmed'?'bg-blue-50 text-blue-600':
            'bg-gray-100 text-gray-500'
          }`}>{po.status||'—'}</span>
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:po)}>
          {qty}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-right text-xs tabular-nums ${isSel?'text-red-100':'text-gray-500'}`} onClick={()=>setSelected(isSel?null:po)}>
          {unitP>0?fmt(unitP):'—'}
        </td>
        <td className={`cursor-pointer px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel?'text-white':'text-gray-900'}`} onClick={()=>setSelected(isSel?null:po)}>
          {fmt(total)}
        </td>
      </tr>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button type="button" onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <PiArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">Purchase History</h1>
          <p className="text-[11px] text-gray-400">{productName} · {rows.length} total · {filtered.length} shown</p>
        </div>

        <div className="relative flex-1 max-w-md">
          <div className={`flex overflow-hidden rounded-xl border transition-all bg-white`}
            style={showPanel?{borderColor:'#b20202',boxShadow:'0 0 0 1px rgba(178,2,2,0.1)'}:{borderColor:'#e5e7eb'}}>
            <div className="relative flex-1">
              <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);setSelected(null);}}
                onFocus={()=>setShowPanel(true)}
                placeholder="PO number, vendor…"
                className="h-9 w-full bg-transparent pl-9 pr-2 text-sm outline-none" />
            </div>
            {(search||hasOptions) && (
              <button type="button" onClick={()=>{setSearch('');setActiveFilters(new Set());setGroupBy(null);setStatusPill('all');}}
                className="flex items-center px-2 text-gray-400 hover:text-gray-600"><PiX className="h-3.5 w-3.5"/></button>
            )}
            <button type="button" onClick={()=>setShowPanel(v=>!v)}
              className="flex items-center border-l border-gray-200 px-3 text-xs font-semibold transition-colors"
              style={showPanel?{backgroundColor:'rgba(178,2,2,0.05)',color:'#b20202'}:{color:'#6b7280'}}>
              {showPanel?<PiCaretUp className="h-3.5 w-3.5"/>:<PiCaretDown className="h-3.5 w-3.5"/>}
            </button>
          </div>
          {showPanel && (
            <SearchPanel
              filterSections={PO_FILTER_SECTIONS} groupSections={PO_GROUP_SECTIONS}
              activeFilters={activeFilters} groupBy={groupBy} savedSearches={savedSearches}
              onToggleFilter={toggleFilter} onSetGroupBy={setGroupBy}
              onSave={saveSearch}
              onLoadSaved={s=>{setSearch(s.query);setActiveFilters(new Set(s.filters));setGroupBy(s.groupBy);}}
              onDeleteSaved={id=>{const nx=savedSearches.filter(s=>s.id!==id);setSavedSearches(nx);persistSaved(PO_KEY,nx);}}
              onClose={()=>setShowPanel(false)}
            />
          )}
        </div>

        {/* Status pills */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
          {(['all','confirmed','received','draft'] as POStatusPill[]).map(f=>(
            <button key={f} type="button" onClick={()=>{setStatusPill(f);setPage(1);setSelected(null);}}
              className={`rounded-lg px-3 py-1.5 capitalize transition-all ${statusPill===f?'text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}
              style={statusPill===f?{backgroundColor:'#b20202'}:{}}>
              {f}
            </button>
          ))}
        </div>

        {!groupBy && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
            <span className="px-1">{page}/{totalPages}</span>
            <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <PiCaretLeft className="h-3.5 w-3.5"/>
            </button>
            <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <PiCaretRight className="h-3.5 w-3.5"/>
            </button>
          </div>
        )}
        <button type="button" onClick={fetchData} disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40">
          <PiArrowsClockwise className={`h-4 w-4 ${loading?'animate-spin':''}`}/>
        </button>
      </div>

      {/* Chips */}
      {chips.length>0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-2">
          {chips.map(c=>(
            <span key={c.key} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.type==='group'?'bg-blue-50 text-blue-700 ring-1 ring-blue-200':''}`}
              style={c.type==='filter'?{backgroundColor:'rgba(178,2,2,0.1)',color:'#b20202',boxShadow:'0 0 0 1px rgba(178,2,2,0.2)'}:{}}>
              {c.type==='group'?<PiStack className="h-3 w-3"/>:<PiFunnel className="h-3 w-3"/>}
              {c.label}
              <button type="button" onClick={()=>c.type==='filter'?removeFilter(c.key as POFilterKey):setGroupBy(null)} className="ml-0.5 opacity-60 hover:opacity-100"><PiX className="h-3 w-3"/></button>
            </span>
          ))}
          <button type="button" onClick={()=>{setActiveFilters(new Set());setGroupBy(null);}} className="ml-1 text-[11px] text-gray-400 hover:text-gray-600 underline">Clear all</button>
        </div>
      )}

      {/* Stats strip */}
      <div className="flex shrink-0 divide-x divide-gray-100 border-b border-gray-200 bg-white">
        {[
          {label:'PO Orders', value:String(filtered.length), icon:<PiShoppingCart className="h-4 w-4"/>},
          {label:'Total Value', value:fmt(totalValue), icon:<PiCurrencyNgn className="h-4 w-4"/>, red:true},
          {label:'Units',     value:String(totalQty), icon:<PiPackage className="h-4 w-4"/>},
          {label:'Avg. PO',   value:fmt(avgPO), icon:<PiReceipt className="h-4 w-4"/>},
        ].map(({label,value,icon,red})=>(
          <div key={label} className="flex flex-1 items-center gap-3 px-5 py-3">
            <span style={red?{color:'#b20202'}:{color:'#9ca3af'}}>{icon}</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="text-sm font-bold tabular-nums" style={red?{color:'#b20202'}:{color:'#111827'}}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected?'w-[55%]':'flex-1'}`}>
          {/* Selection bar */}
          {checked.size>0 && (
            <div className="shrink-0 flex items-center gap-3 bg-white px-4 py-2.5" style={{borderBottom:'2px solid #b20202'}}>
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="font-bold" style={{color:'#b20202'}}>{checked.size}</span> selected · <span className="font-bold text-gray-900">{fmt(checkedTotal)}</span>
              </div>
              <button type="button" onClick={()=>setChecked(new Set())} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">Clear</button>
            </div>
          )}
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200" style={{borderTopColor:'#b20202'}}/>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-red-500">
              <PiWarningCircle className="h-5 w-5 shrink-0"/> {error}
            </div>
          ) : filtered.length===0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <PiPackage className="h-10 w-10 text-gray-200"/>
              <p className="text-sm text-gray-400">{search?`No results for "${search}"`:hasOptions||statusPill!=='all'?'No orders match the active filters':'No purchase orders found'}</p>
              {(search||hasOptions||statusPill!=='all')&&<button type="button" onClick={()=>{setSearch('');setActiveFilters(new Set());setGroupBy(null);setStatusPill('all');}} className="text-xs hover:underline" style={{color:'#b20202'}}>Clear filters</button>}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button type="button" onClick={toggleAll} className="text-gray-400">
                        {allChecked?<PiCheckSquare className="h-4 w-4" style={{color:'#b20202'}}/>:someChecked?<PiCheckSquare className="h-4 w-4 text-gray-400"/>:<PiSquare className="h-4 w-4"/>}
                      </button>
                    </th>
                    {COLS.map(({col,label,right})=>(
                      <th key={col} onClick={()=>handleSort(col)}
                        className={`cursor-pointer select-none px-3 py-3 hover:text-gray-600 ${right?'text-right':''}`}>
                        <span className="flex items-center gap-1">{label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir}/></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped ? grouped.map(([gName,gOrders])=>{
                    const isCollapsed=!expandedGroups.has(gName);
                    const gTotal=gOrders.reduce((s,po)=>s+getLines(po).reduce((ls: number,l: any)=>ls+(l.totalCost||(l.unitPrice||0)*(l.quantity||l.packQty||0)),0),0);
                    return (
                      <React.Fragment key={gName}>
                        <tr className="cursor-pointer select-none border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={()=>toggleGroup(gName)}>
                          <td colSpan={9} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-gray-400 transition-transform ${isCollapsed?'':'rotate-90'}`}><PiCaretRightSmall className="h-3 w-3"/></span>
                              <span className="text-xs font-semibold text-gray-700">{gName}</span>
                              <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">{gOrders.length}</span>
                              <span className="ml-auto text-[10px] font-semibold text-gray-400 tabular-nums">{fmt(gTotal)}</span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && gOrders.map(po=>renderRow(po, selected?._id===po._id))}
                      </React.Fragment>
                    );
                  }) : paginated.map(po=>renderRow(po, selected?._id===po._id))}
                </tbody>
              </table>
            </div>
          )}
          {!groupBy && totalPages>1 && (
            <div className="shrink-0 flex items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-500">
              <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
              <div className="flex gap-1">
                {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
                  const p=totalPages<=7?i+1:i===0?1:i===6?totalPages:page-2+i;
                  return <button key={p} type="button" onClick={()=>setPage(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${p===page?'text-white':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={p===page?{backgroundColor:'#b20202',borderColor:'#b20202'}:{}}>{p}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        <div className={`flex flex-col bg-white transition-all duration-200 ${selected?'flex-1 overflow-hidden':'w-72 shrink-0'}`}>
          {selected ? (
            <PODetail po={selected} productId={subProductId} onClose={()=>setSelected(null)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <PiShoppingCart className="h-7 w-7 text-gray-300"/>
              </div>
              <p className="text-sm font-semibold text-gray-500">Select a purchase order</p>
              <p className="text-xs text-gray-400">Click a row to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vendor Returns Panel ───────────────────────────────────────────────────────
function VendorReturnsPanel({ subProductId, productName, token, onClose }: {
  subProductId: string; productName: string; token: string; onClose: ()=>void;
}) {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 50;

  const fetchData = useCallback(()=>{
    setLoading(true);
    apiFetch(`${API_URL}/api/vendor-returns?subProductId=${subProductId}&limit=500`, token)
      .then(body=>setRows(body.data||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[subProductId,token]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  const statusColor: Record<string,string> = {
    draft:'bg-gray-100 text-gray-600', confirmed:'bg-blue-100 text-blue-700',
    requested:'bg-amber-100 text-amber-700', shipped:'bg-indigo-100 text-indigo-700',
    in_transit:'bg-purple-100 text-purple-700', received:'bg-green-100 text-green-700',
    refunded:'bg-emerald-100 text-emerald-700', rejected:'bg-red-100 text-red-700',
    cancelled:'bg-gray-100 text-gray-500',
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
            <PiX className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Vendor Returns</h2>
            <p className="text-xs text-gray-500">{productName}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Results */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-gray-400">No returns found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Return #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vendor / PO</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Refund</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows
                  .slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
                  .map(r => {
                    const item = (r.items||[]).find((i:any)=>i.subProductId===subProductId);
                    return (
                      <tr key={r._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.returnNumber}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(r.returnDate)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <div>{r.vendorName||'—'}</div>
                          {r.poNumber && <div className="text-[11px] text-gray-400">{r.poNumber}</div>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {item ? item.quantity : r.items.reduce((s:number,i:any)=>s+i.quantity,0)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                          {fmt(r.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusColor[r.status]||'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.refundStatus && r.refundStatus !== 'none' ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                              r.refundStatus==='completed'?'bg-green-100 text-green-700':
                              r.refundStatus==='processing'?'bg-blue-100 text-blue-700':
                              r.refundStatus==='rejected'?'bg-red-100 text-red-700':
                              'bg-amber-100 text-amber-700'
                            }`}>{r.refundStatus}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a href={`/purchases/returns/${r._id}`}
                            className="text-xs font-medium text-[#b20202] hover:underline"
                            target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-500">
            <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,rows.length)} of {rows.length}</span>
            <div className="flex gap-1">
              {Array.from({length:Math.min(Math.ceil(rows.length/PAGE_SIZE),7)},(_,i)=>{
                const tp=Math.ceil(rows.length/PAGE_SIZE);
                const p=tp<=7?i+1:i===0?1:i===6?tp:page-2+i;
                return <button key={p} type="button" onClick={()=>setPage(p)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${p===page?'text-white':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  style={p===page?{backgroundColor:'#b20202',borderColor:'#b20202'}:{}}>{p}</button>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full-screen overlay ───────────────────────────────────────────────────────
interface ProductHistoryPanelProps {
  type: 'purchased'|'sold'|'returns';
  subProductId: string;
  productName: string;
  token: string;
  onClose: ()=>void;
}

export default function ProductHistoryPanel({
  type, subProductId, productName, token, onClose,
}: ProductHistoryPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(()=>{
    setMounted(true);
    function onKey(e: KeyboardEvent) { if(e.key==='Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return ()=>document.removeEventListener('keydown', onKey);
  },[onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{top:0,left:0,right:0,bottom:0,width:'100vw',height:'100vh'}}>
      {type === 'purchased'
        ? <PurchasedPanel subProductId={subProductId} productName={productName} token={token} onClose={onClose} />
        : type === 'returns'
          ? <VendorReturnsPanel subProductId={subProductId} productName={productName} token={token} onClose={onClose} />
          : <SoldPanel      subProductId={subProductId} productName={productName} token={token} onClose={onClose} />
      }
    </div>,
    document.body
  );
}
