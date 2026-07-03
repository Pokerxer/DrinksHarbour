'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  PiX,
  PiMagnifyingGlass,
  PiSpinner,
  PiArrowDownLeft,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiWarehouse,
  PiUser,
  PiCube,
  PiFileText,
  PiShoppingCart,
  PiSealCheck,
  PiXCircle,
  PiClockCountdown,
  PiWarningCircle,
} from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SOLine {
  _id: string;
  subproduct?: string;
  product?: string;
  name: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  lineType?: string;
}

interface SalesOrderRow {
  _id: string;
  soNumber: string;
  docType: 'quotation' | 'order';
  quoteStatus?: string;
  orderStatus?: string;
  customerSnapshot?: { name?: string; phone?: string; email?: string };
  total: number;
  createdAt: string;
  items: SOLine[];
  warehouseId?: { _id: string; name: string; code?: string } | null;
  salesperson?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Props {
  token: string;
  onLoad: (order: SalesOrderRow) => void;
  onClose: () => void;
}

// ── Constants ───────────────────────────────────────────────────────────────────

type DocTypeFilter = 'all' | 'quotation' | 'order';

const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const;
const ORDER_STATUSES = ['draft', 'confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled'] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
  confirmed: 'Confirmed',
  partially_fulfilled: 'Part Fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

function statusConfig(status: string): { dot: string; bg: string; text: string } {
  switch (status) {
    case 'draft':
      return { dot: 'bg-yellow-400', bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'sent':
      return { dot: 'bg-blue-400', bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'accepted':
    case 'confirmed':
      return { dot: 'bg-indigo-400', bg: 'bg-indigo-100', text: 'text-indigo-700' };
    case 'partially_fulfilled':
      return { dot: 'bg-cyan-400', bg: 'bg-cyan-100', text: 'text-cyan-700' };
    case 'fulfilled':
    case 'converted':
      return { dot: 'bg-emerald-400', bg: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'rejected':
    case 'cancelled':
      return { dot: 'bg-red-400', bg: 'bg-red-100', text: 'text-red-600' };
    case 'expired':
      return { dot: 'bg-orange-400', bg: 'bg-orange-100', text: 'text-orange-700' };
    default:
      return { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function statusLabel(so: SalesOrderRow): string {
  const s = so.docType === 'quotation' ? (so.quoteStatus ?? 'draft') : (so.orderStatus ?? 'draft');
  return STATUS_LABELS[s] ?? s;
}

function rawStatus(so: SalesOrderRow): string {
  return so.docType === 'quotation' ? (so.quoteStatus ?? 'draft') : (so.orderStatus ?? 'draft');
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function itemCount(so: SalesOrderRow): number {
  return (so.items ?? []).filter((i) => i.lineType !== 'section' && i.lineType !== 'note').length;
}

type SortCol = 'soNumber' | 'date' | 'customer' | 'total' | 'status' | 'items';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 15;

// ── Status filter dropdown ─────────────────────────────────────────────────────

function StatusFilterDropdown({
  options,
  value,
  onChange,
  onClose,
}: {
  options: readonly string[];
  value: string;
  onChange: (s: string) => void;
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

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5"
    >
      <button
        type="button"
        onClick={() => { onChange(''); onClose(); }}
        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${!value ? 'bg-red-50 font-semibold text-[#b20202]' : 'text-gray-700'}`}
      >
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        All Statuses
        {!value && <span className="ml-auto text-[#b20202]">✓</span>}
      </button>
      {options.map((s) => {
        const cfg = statusConfig(s);
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => { onChange(s); onClose(); }}
            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-red-50 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            {STATUS_LABELS[s] ?? s}
            {active && <span className="ml-auto text-[#b20202]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Sort header ────────────────────────────────────────────────────────────────

function SortTh({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  className?: string;
}) {
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

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ so }: { so: SalesOrderRow }) {
  const s = rawStatus(so);
  const cfg = statusConfig(s);
  const label = statusLabel(so);
  const icon = {
    draft: <PiFileText className="h-3 w-3" />,
    sent: <PiClockCountdown className="h-3 w-3" />,
    accepted: <PiSealCheck className="h-3 w-3" />,
    confirmed: <PiSealCheck className="h-3 w-3" />,
    partially_fulfilled: <PiCube className="h-3 w-3" />,
    fulfilled: <PiShoppingCart className="h-3 w-3" />,
    converted: <PiShoppingCart className="h-3 w-3" />,
    rejected: <PiXCircle className="h-3 w-3" />,
    cancelled: <PiXCircle className="h-3 w-3" />,
    expired: <PiWarningCircle className="h-3 w-3" />,
  }[s] ?? null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase leading-tight ${cfg.bg} ${cfg.text}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function POSOrderPickerModal({ token, onLoad, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams = useMemo(() => {
    const p: Record<string, string | number | undefined> = {
      search: search || undefined,
      limit: PAGE_SIZE,
      page,
    };
    if (docTypeFilter !== 'all') p.docType = docTypeFilter;
    if (statusFilter) p.status = statusFilter;
    return p;
  }, [search, docTypeFilter, statusFilter, page]);

  const fetch = useCallback(
    async (q: typeof queryParams) => {
      setLoading(true);
      try {
        const data = await posApi.getSalesOrdersForPOS(token, q);
        setOrders((data as any)?.salesOrders ?? []);
        setPagination((data as any)?.pagination ?? null);
      } catch {
        setOrders([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  // Fetch on mount and when query changes
  useEffect(() => {
    fetch(queryParams);
  }, [fetch, queryParams]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, docTypeFilter, statusFilter]);

  // Status options scoped to current doc type
  const statusOptions = useMemo(() => {
    if (docTypeFilter === 'quotation') return QUOTATION_STATUSES;
    if (docTypeFilter === 'order') return ORDER_STATUSES;
    return [...new Set([...QUOTATION_STATUSES, ...ORDER_STATUSES])] as readonly string[];
  }, [docTypeFilter]);

  // Client-side sort
  const sorted = useMemo(() => {
    if (!orders.length) return [];
    const list = [...orders];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'soNumber':
          cmp = (a.soNumber ?? '').localeCompare(b.soNumber ?? '');
          break;
        case 'date':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'customer':
          cmp = (a.customerSnapshot?.name ?? '').localeCompare(b.customerSnapshot?.name ?? '');
          break;
        case 'total':
          cmp = (a.total ?? 0) - (b.total ?? 0);
          break;
        case 'status':
          cmp = rawStatus(a).localeCompare(rawStatus(b));
          break;
        case 'items':
          cmp = itemCount(a) - itemCount(b);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [orders, sortCol, sortDir]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  }

  const docTypeTabs: { key: DocTypeFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: null },
    { key: 'quotation', label: 'Quotations', icon: <PiFileText className="h-3.5 w-3.5" /> },
    { key: 'order', label: 'Orders', icon: <PiShoppingCart className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <PiFileText className="h-5 w-5 text-[#b20202]" />
            <h2 className="text-base font-semibold text-gray-900">
              Quotations &amp; Orders
            </h2>
            {pagination && (
              <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-500">
                {pagination.total} total
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          {/* Doc-type tabs */}
          <div className="flex shrink-0 items-center rounded-lg bg-gray-100 p-0.5">
            {docTypeTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setDocTypeFilter(tab.key); setStatusFilter(''); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  docTypeFilter === tab.key
                    ? 'bg-white text-[#b20202] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowStatusMenu((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {statusFilter ? STATUS_LABELS[statusFilter] ?? statusFilter : 'All Statuses'}
              <PiCaretDown className="h-3 w-3 text-gray-400" />
            </button>
            {showStatusMenu && (
              <StatusFilterDropdown
                options={statusOptions}
                value={statusFilter}
                onChange={(s) => { setStatusFilter(s); setShowStatusMenu(false); }}
                onClose={() => setShowStatusMenu(false)}
              />
            )}
          </div>

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order number or customer…"
              className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-xs outline-none focus:border-[#b20202] focus:bg-white"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <span className="px-1 text-xs text-gray-500">
                p{page}/{pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            // Skeleton loader
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
                  <div className="h-3 w-24 rounded bg-gray-100" />
                  <div className="h-3 w-16 rounded bg-gray-100" />
                  <div className="h-3 w-28 flex-1 rounded bg-gray-100" />
                  <div className="h-3 w-14 rounded bg-gray-100" />
                  <div className="h-3 w-8 rounded bg-gray-100" />
                  <div className="h-5 w-16 rounded-full bg-gray-100" />
                  <div className="h-7 w-14 rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <PiFileText className="mb-3 h-12 w-12 text-gray-200" />
              <p className="text-sm font-medium">
                {search || statusFilter
                  ? 'No matching orders found'
                  : docTypeFilter === 'all'
                    ? 'No quotations or orders yet'
                    : `No ${docTypeFilter}s found`}
              </p>
              {(search || statusFilter) && (
                <p className="mt-1 text-xs">Try adjusting your search or filters</p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 border-b border-gray-100 bg-gray-50">
                  <SortTh
                    col="soNumber"
                    label="Number"
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    col="date"
                    label="Date"
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
                    col="total"
                    label="Total"
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    col="items"
                    label="Items"
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    col="status"
                    label="Status"
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Info
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((so) => (
                  <tr key={so._id} className="transition-colors hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            so.docType === 'quotation'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {so.docType === 'quotation' ? 'QO' : 'OR'}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-800">
                          {so.soNumber}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {fmtDate(so.createdAt)}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-xs text-gray-700">
                      {so.customerSnapshot?.name || (
                        <span className="text-gray-300">Walk-in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-gray-900">
                      {formatCurrency(so.total ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs tabular-nums text-gray-500">
                      {itemCount(so)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge so={so} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {so.warehouseId && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <PiWarehouse className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[80px]">{so.warehouseId.name}</span>
                          </span>
                        )}
                        {so.salesperson && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <PiUser className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[80px]">{so.salesperson}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onLoad(so)}
                        className="flex items-center gap-1 rounded-lg bg-[#b20202] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101]"
                      >
                        <PiArrowDownLeft className="h-3.5 w-3.5" /> Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
          <span className="text-xs text-gray-400">
            {pagination
              ? `${pagination.total} order${pagination.total !== 1 ? 's' : ''}${pagination.pages > 1 ? ` · Page ${page} of ${pagination.pages}` : ''}`
              : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
