'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PiX,
  PiArrowLeft,
  PiMagnifyingGlass,
  PiArrowsDownUp,
  PiArrowUp,
  PiArrowDown,
  PiLock,
  PiArrowSquareOut,
  PiPackage,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { PurchaseOrder, POItem } from '@/services/purchaseOrder.service';
import { STATUS_BADGE, statusLabel, CURRENCY_SYMBOLS } from './types';
import {
  fmtCur,
  fmtNaira,
  lineUntaxed,
  lineTax,
  itemName,
} from './purchases-analytics-helpers';

// ── Shared helpers ───────────────────────────────────────────────────────────

function poDate(po: PurchaseOrder): Date {
  return new Date(po.confirmationDate || po.createdAt || Date.now());
}

function poUntaxed(po: PurchaseOrder): number {
  return (po.items || []).reduce((s, i) => s + lineUntaxed(i), 0);
}

function poTax(po: PurchaseOrder): number {
  return (po.items || []).reduce((s, i) => s + lineTax(i), 0);
}

function poTotal(po: PurchaseOrder): number {
  return poUntaxed(po) + poTax(po);
}

function receivedFraction(items: POItem[]): { num: number; den: number } {
  return items.reduce(
    (acc, i) => ({
      num: acc.num + Math.min(i.receivedQty ?? 0, i.quantity ?? 0),
      den: acc.den + (i.quantity ?? 0),
    }),
    { num: 0, den: 0 }
  );
}

// ── Drill table sort/filter ────────────────────────────────────────────────────

type DrillStatusFilter =
  | 'all'
  | 'draft'
  | 'confirmed'
  | 'received'
  | 'validated'
  | 'cancelled';

const STATUS_TAB_LABELS: Record<DrillStatusFilter, string> = {
  all: 'All',
  draft: 'Draft',
  confirmed: 'Confirmed',
  received: 'Received',
  validated: 'Validated',
  cancelled: 'Cancelled',
};

type DrillSortCol =
  | 'date'
  | 'poNumber'
  | 'vendor'
  | 'currency'
  | 'total'
  | 'status';

const DRILL_HEADERS: { col: DrillSortCol; label: string; right?: boolean }[] = [
  { col: 'date', label: 'Date' },
  { col: 'poNumber', label: 'PO #' },
  { col: 'vendor', label: 'Vendor' },
  { col: 'currency', label: 'Currency' },
  { col: 'total', label: 'Total', right: true },
  { col: 'status', label: 'Status' },
];

function DrillSortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: string;
  sortCol: string;
  sortDir: 'asc' | 'desc';
}) {
  if (sortCol !== col) return <PiArrowsDownUp className="h-3 w-3 opacity-30" />;
  return sortDir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}

// ── PODrillDrawer ────────────────────────────────────────────────────────────

export function PODrillDrawer({
  orders,
  title,
  toBase,
  onClose,
}: {
  orders: PurchaseOrder[];
  title: string;
  toBase: (amount: number, currency: string) => number;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DrillStatusFilter>('all');
  const [sortCol, setSortCol] = useState<DrillSortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // KPIs over the full drilled-down set (independent of search/status filter)
  const totalSpend = orders.reduce(
    (s, o) => s + toBase(poTotal(o), o.currency || 'NGN'),
    0
  );
  const poCount = orders.length;
  const avgOrder = poCount > 0 ? totalSpend / poCount : 0;
  const allItems = orders.flatMap((o) => o.items || []);
  const { num: recvNum, den: recvDen } = receivedFraction(allItems);
  const receiptRate = recvDen > 0 ? (recvNum / recvDen) * 100 : 0;

  function handleSort(col: DrillSortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  }

  const filtered = useMemo(() => {
    let list = [...orders];

    if (statusFilter !== 'all')
      list = list.filter((o) =>
        statusFilter === 'cancelled'
          ? o.status === 'cancelled' || o.status === 'cancel'
          : o.status === statusFilter
      );

    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (o) =>
          (o.poNumber || '').toLowerCase().includes(q) ||
          (o.vendorName || '').toLowerCase().includes(q)
      );

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'date':
          cmp = poDate(a).getTime() - poDate(b).getTime();
          break;
        case 'poNumber':
          cmp = (a.poNumber || '').localeCompare(b.poNumber || '');
          break;
        case 'vendor':
          cmp = (a.vendorName || '').localeCompare(b.vendorName || '');
          break;
        case 'currency':
          cmp = (a.currency || '').localeCompare(b.currency || '');
          break;
        case 'total':
          cmp = poTotal(a) - poTotal(b);
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [orders, search, statusFilter, sortCol, sortDir]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {selected ? (
          <POSummaryPanel
            po={selected}
            onBack={() => setSelected(null)}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-bold leading-tight text-gray-900">
                  {title}
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {orders.length} purchase order{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
              >
                <PiX className="h-5 w-5" />
              </button>
            </div>

            {/* KPI strip */}
            <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50/40 px-6 py-4 sm:grid-cols-4">
              {[
                {
                  label: 'Total Spend',
                  value: fmtNaira(totalSpend),
                  accent: '#b20202',
                },
                {
                  label: 'PO Count',
                  value: poCount.toLocaleString(),
                  accent: '#4f46e5',
                },
                {
                  label: 'Avg Order',
                  value: fmtNaira(avgOrder),
                  accent: '#059669',
                },
                {
                  label: 'Receipt Rate',
                  value: `${receiptRate.toFixed(1)}%`,
                  accent: '#f97316',
                },
              ].map(({ label, value, accent }) => (
                <div
                  key={label}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: accent }}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Search bar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-6 py-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                <PiMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO #, vendor…"
                  className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <PiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                {filtered.length} shown
              </span>
            </div>

            {/* Status tabs */}
            <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-6 py-2.5">
              <div className="flex flex-wrap rounded-xl border border-gray-200 bg-gray-50/70 p-0.5 text-xs font-semibold">
                {(Object.keys(STATUS_TAB_LABELS) as DrillStatusFilter[]).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={`rounded-lg px-3 py-1.5 transition-all ${
                        statusFilter === f
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {STATUS_TAB_LABELS[f]}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Orders table */}
            <div className="min-h-0 flex-1 overflow-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <PiPackage className="h-8 w-8 text-gray-200" />
                  <p className="text-sm text-gray-400">
                    {search
                      ? `No purchase orders matching "${search}"`
                      : statusFilter !== 'all'
                        ? `No ${STATUS_TAB_LABELS[statusFilter].toLowerCase()} orders`
                        : 'No purchase orders'}
                  </p>
                  {(search || statusFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                      }}
                      className="text-xs font-medium text-[#b20202] hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {DRILL_HEADERS.map(({ col, label, right }) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className={`cursor-pointer select-none px-3 py-2.5 transition-colors hover:text-gray-600 ${
                            right ? 'text-right' : 'text-left'
                          }`}
                        >
                          <span
                            className={`flex items-center gap-1 ${right ? 'justify-end' : ''}`}
                          >
                            {label}
                            <DrillSortIcon
                              col={col}
                              sortCol={sortCol}
                              sortDir={sortDir}
                            />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => {
                      const dt = poDate(o);
                      return (
                        <tr
                          key={o._id}
                          className="cursor-pointer border-b border-gray-50 bg-white transition-colors hover:bg-gray-50/80"
                          onClick={() => setSelected(o)}
                        >
                          <td className="px-3 py-2.5 text-gray-500">
                            {dt.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-gray-800">
                            {o.poNumber}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2.5 text-gray-700">
                            {o.vendorName || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                              {o.currency || 'NGN'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-gray-900">
                            {fmtCur(poTotal(o), o.currency || 'NGN')}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_BADGE[o.status] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {statusLabel(o.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── POSummaryPanel ───────────────────────────────────────────────────────────

export function POSummaryPanel({
  po,
  onBack,
  onClose,
}: {
  po: PurchaseOrder;
  onBack: () => void;
  onClose: () => void;
}) {
  const untaxed = poUntaxed(po);
  const tax = poTax(po);
  const total = untaxed + tax;
  const { num: recvNum, den: recvDen } = receivedFraction(po.items || []);
  const receivedPct = recvDen > 0 ? (recvNum / recvDen) * 100 : 0;
  const currency = po.currency || 'NGN';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const dt = poDate(po);

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <PiArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold leading-tight text-gray-900">
              {po.poNumber}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {po.vendorName || 'Unknown vendor'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          <PiX className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Status / approval / lock badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[po.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {statusLabel(po.status)}
          </span>
          {po.isLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
              <PiLock className="h-3 w-3" /> Locked
            </span>
          )}
          {po.status === 'draft' &&
            (!po.approvalStatus || po.approvalStatus === 'pending') && (
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Awaiting Approval
              </span>
            )}
          {po.approvalStatus === 'approved' && (
            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Approved
            </span>
          )}
          {po.approvalStatus === 'rejected' && (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              Rejected{po.approvalNotes ? ` — ${po.approvalNotes}` : ''}
            </span>
          )}
        </div>

        {/* Dates / vendor / currency */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div>
            <p className="text-gray-400">Order Date</p>
            <p className="font-medium text-gray-900">
              {dt.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          {po.expectedArrival && (
            <div>
              <p className="text-gray-400">Expected Arrival</p>
              <p className="font-medium text-gray-900">
                {new Date(po.expectedArrival).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          {po.arrivalDate && (
            <div>
              <p className="text-gray-400">Arrival Date</p>
              <p className="font-medium text-gray-900">
                {new Date(po.arrivalDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          <div>
            <p className="text-gray-400">Currency</p>
            <p className="font-medium text-gray-900">{currency}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit Cost</th>
                <th className="px-3 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(po.items || []).map((item, i) => (
                <tr key={item.subProductId ? `${item.subProductId}-${i}` : i}>
                  <td className="max-w-[180px] truncate px-3 py-2 font-medium text-gray-800">
                    {itemName(item)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {symbol}
                    {(item.unitCost ?? item.unitPrice ?? 0).toLocaleString(
                      'en-NG',
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                    {fmtCur(lineUntaxed(item) + lineTax(item), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-1.5 rounded-lg bg-gray-50 px-4 py-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Untaxed Total</span>
            <span className="font-medium tabular-nums text-gray-900">
              {fmtCur(untaxed, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Tax</span>
            <span className="font-medium tabular-nums text-gray-900">
              {fmtCur(tax, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 font-semibold">
            <span className="text-gray-700">Total</span>
            <span className="tabular-nums text-gray-900">
              {fmtCur(total, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1.5">
            <span className="text-gray-500">Received</span>
            <span className="font-medium tabular-nums text-gray-900">
              {receivedPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* View full PO */}
        <Link
          href={routes.eCommerce.purchaseDetails(po._id)}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          View full PO
          <PiArrowSquareOut className="h-3.5 w-3.5" />
        </Link>
      </div>
    </>
  );
}
