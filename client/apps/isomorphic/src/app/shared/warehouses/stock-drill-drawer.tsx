'use client';

import { useMemo, useState } from 'react';
import {
  PiX,
  PiMagnifyingGlass,
  PiArrowsDownUp,
  PiArrowUp,
  PiArrowDown,
  PiPackage,
} from 'react-icons/pi';
import type { StockRow } from '@/services/warehouseStock.service';
import {
  fmtNaira,
  fmtCount,
  availableQty,
  stockStatus,
  STOCK_STATUS_LABEL,
} from './warehouse-analysis-helpers';

const STATUS_BADGE: Record<string, string> = {
  in: 'bg-emerald-100 text-emerald-700',
  low: 'bg-amber-100 text-amber-700',
  out: 'bg-red-100 text-red-700',
};

type StatusFilter = 'all' | 'in' | 'low' | 'out';
const STATUS_TABS: Record<StatusFilter, string> = {
  all: 'All',
  in: 'In Stock',
  low: 'Low',
  out: 'Out',
};

type SortCol =
  | 'product'
  | 'warehouse'
  | 'size'
  | 'onHand'
  | 'available'
  | 'value'
  | 'status';

const HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
  { col: 'product', label: 'Product' },
  { col: 'warehouse', label: 'Warehouse' },
  { col: 'size', label: 'Size' },
  { col: 'onHand', label: 'On-hand', right: true },
  { col: 'available', label: 'Available', right: true },
  { col: 'value', label: 'Value', right: true },
  { col: 'status', label: 'Status' },
];

function SortIcon({
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

const rowValue = (r: StockRow) => (r.currentQuantity || 0) * (r.costPrice || 0);

export function StockDrillDrawer({
  rows,
  title,
  onClose,
}: {
  rows: StockRow[];
  title: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortCol, setSortCol] = useState<SortCol>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // KPIs over the full drilled-down set (independent of search/status filter)
  const totalValue = rows.reduce((s, r) => s + rowValue(r), 0);
  const totalOnHand = rows.reduce((s, r) => s + (r.currentQuantity || 0), 0);
  const totalAvailable = rows.reduce((s, r) => s + availableQty(r), 0);
  const skuCount = new Set(rows.map((r) => String(r.subProductId))).size;

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir(col === 'product' || col === 'warehouse' ? 'asc' : 'desc');
    }
  }

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== 'all')
      list = list.filter((r) => stockStatus(r) === statusFilter);

    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (r) =>
          (r.productName || '').toLowerCase().includes(q) ||
          (r.sku || '').toLowerCase().includes(q) ||
          (r.warehouseName || '').toLowerCase().includes(q)
      );

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'product':
          cmp = (a.productName || '').localeCompare(b.productName || '');
          break;
        case 'warehouse':
          cmp = (a.warehouseName || '').localeCompare(b.warehouseName || '');
          break;
        case 'size':
          cmp = (a.sizeName || '').localeCompare(b.sizeName || '');
          break;
        case 'onHand':
          cmp = (a.currentQuantity || 0) - (b.currentQuantity || 0);
          break;
        case 'available':
          cmp = availableQty(a) - availableQty(b);
          break;
        case 'value':
          cmp = rowValue(a) - rowValue(b);
          break;
        case 'status':
          cmp = stockStatus(a).localeCompare(stockStatus(b));
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [rows, search, statusFilter, sortCol, sortDir]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold leading-tight text-gray-900">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {rows.length} stock line{rows.length !== 1 ? 's' : ''}
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
            { label: 'Stock Value', value: fmtNaira(totalValue), accent: '#b20202' },
            {
              label: 'On-hand',
              value: fmtCount(totalOnHand),
              accent: '#4f46e5',
            },
            {
              label: 'Available',
              value: fmtCount(totalAvailable),
              accent: '#059669',
            },
            {
              label: 'SKUs',
              value: skuCount.toLocaleString(),
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
              placeholder="Search product, SKU, warehouse…"
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
            {(Object.keys(STATUS_TABS) as StatusFilter[]).map((f) => (
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
                {STATUS_TABS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Rows table */}
        <div className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <PiPackage className="h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">
                {search
                  ? `No stock lines matching "${search}"`
                  : 'No stock lines'}
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
                  {HEADERS.map(({ col, label, right }) => (
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
                        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const st = stockStatus(r);
                  return (
                    <tr
                      key={r._id}
                      className="border-b border-gray-50 bg-white transition-colors hover:bg-gray-50/80"
                    >
                      <td className="max-w-[200px] px-3 py-2.5">
                        <p className="truncate font-medium text-gray-800">
                          {r.productName}
                        </p>
                        {r.sku && (
                          <p className="truncate font-mono text-[10px] text-gray-400">
                            {r.sku}
                          </p>
                        )}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2.5 text-gray-700">
                        {r.warehouseName}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{r.sizeName}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {(r.currentQuantity || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                        {availableQty(r).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-gray-900">
                        {fmtNaira(rowValue(r))}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_BADGE[st]}`}
                        >
                          {STOCK_STATUS_LABEL[st]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
