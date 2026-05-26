'use client';

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import {
  PiArrowsClockwise, PiCurrencyNgn, PiShoppingCart, PiTag,
  PiArrowUp, PiArrowDown, PiArrowsDownUp, PiDownloadSimple, PiX,
  PiMagnifyingGlass, PiCaretLeft, PiCaretRight, PiCaretDown, PiPercent,
  PiTrendUp, PiList, PiRows, PiClock,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number;
  discountAmount?: number; sizeCostPrice?: number;
}

interface PosOrder {
  _id: string; orderNumber?: string; receiptNumber?: string;
  total: number; subtotal?: number; discountTotal?: number;
  paymentMethod: string; paymentStatus?: string; status?: string;
  isVoided?: boolean; placedAt: string; createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  items?: OrderItem[];
}

interface LineRow {
  orderId: string; orderNumber: string; receiptNumber: string;
  date: string; cashier: string; product: string; variant: string;
  qty: number; unitPrice: number; discount: number;
  subtotal: number; gross: number; costPrice: number; profit: number;
  paymentMethod: string; isVoided: boolean;
}

type LineSortField = keyof Pick<
  LineRow,
  'date' | 'orderNumber' | 'cashier' | 'product' | 'variant' |
  'qty' | 'unitPrice' | 'discount' | 'subtotal' | 'gross' | 'profit' | 'paymentMethod'
>;

interface GroupRow {
  key: string; qty: number; gross: number; discount: number;
  revenue: number; profit: number; lineCount: number;
  orderCount: number; share: number;
}

type GroupSortField = 'key' | 'qty' | 'revenue' | 'gross' | 'discount' | 'profit' | 'lineCount' | 'orderCount' | 'share';
type GroupByKey   = 'product' | 'cashier' | 'payment_method' | 'date' | 'variant';
type ViewMode     = 'lines' | 'grouped';
type StatusFilter = 'all' | 'active' | 'voided';
type ToggleableCol = 'orderNumber' | 'cashier' | 'variant' | 'unitPrice' | 'gross' | 'discount' | 'payment';

const PAGE_SIZE       = 50;
const GROUP_PAGE_SIZE = 30;

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card/POS', bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money', split: 'Split', other: 'Other',
};

const METHOD_COLOR: Record<string, string> = {
  cash:          'bg-emerald-50 text-emerald-700 border border-emerald-100',
  card:          'bg-blue-50 text-blue-700 border border-blue-100',
  bank_transfer: 'bg-violet-50 text-violet-700 border border-violet-100',
  mobile_money:  'bg-amber-50 text-amber-700 border border-amber-100',
  split:         'bg-orange-50 text-orange-700 border border-orange-100',
  other:         'bg-gray-100 text-gray-600 border border-gray-200',
};

const METHOD_DOT: Record<string, string> = {
  cash:          'bg-emerald-500',
  card:          'bg-blue-500',
  bank_transfer: 'bg-violet-500',
  mobile_money:  'bg-amber-500',
  split:         'bg-orange-500',
  other:         'bg-gray-400',
};

const TOGGLEABLE_COLS: { key: ToggleableCol; label: string }[] = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'cashier',     label: 'Cashier' },
  { key: 'variant',     label: 'Variant' },
  { key: 'unitPrice',   label: 'Unit Price' },
  { key: 'gross',       label: 'Gross Rev.' },
  { key: 'discount',    label: 'Discount' },
  { key: 'payment',     label: 'Payment' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch { return true; }
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function toTs(date: string, time: string): number {
  if (!date) return 0;
  return new Date(`${date}T${time || '00:00'}:00`).getTime();
}

function todayStr()     { return new Date().toISOString().slice(0, 10); }
function offsetDay(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function startOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10);
}
function endOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: 'Today',       from: () => todayStr(),         to: () => todayStr(),         tf: '00:00', tt: '23:59' },
  { label: 'Yesterday',   from: () => offsetDay(-1),      to: () => offsetDay(-1),      tf: '00:00', tt: '23:59' },
  { label: 'Last 7 days', from: () => offsetDay(-6),      to: () => todayStr(),         tf: '00:00', tt: '23:59' },
  { label: 'This week',   from: () => startOfWeek(),      to: () => todayStr(),         tf: '00:00', tt: '23:59' },
  { label: 'This month',  from: () => startOfMonth(),     to: () => todayStr(),         tf: '00:00', tt: '23:59' },
  { label: 'Last month',  from: () => startOfLastMonth(), to: () => endOfLastMonth(),   tf: '00:00', tt: '23:59' },
];

// ── CSV ────────────────────────────────────────────────────────────────────────

function triggerCsvDownload(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportLineCsv(rows: LineRow[], hasCost: boolean) {
  const h = [
    'Date/Time', 'Order #', 'Receipt', 'Cashier', 'Product', 'Variant',
    'Qty', 'Unit Price', 'Gross', 'Discount', 'Net Total',
    ...(hasCost ? ['Cost', 'Profit', 'Margin %'] : []),
    'Payment Method', 'Voided',
  ];
  const lines = rows.map(r => {
    const margin = r.profit > 0 && r.subtotal > 0 ? ((r.profit / r.subtotal) * 100).toFixed(1) + '%' : '—';
    return [
      fmtDateTime(r.date), r.orderNumber, r.receiptNumber,
      `"${r.cashier}"`, `"${r.product}"`, `"${r.variant}"`,
      r.qty, r.unitPrice.toFixed(2), r.gross.toFixed(2),
      r.discount.toFixed(2), r.subtotal.toFixed(2),
      ...(hasCost ? [r.costPrice.toFixed(2), r.profit.toFixed(2), margin] : []),
      METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod, r.isVoided ? 'Yes' : 'No',
    ].join(',');
  });
  triggerCsvDownload([h.join(','), ...lines].join('\n'), 'sales-details');
}

function exportGroupedCsv(rows: GroupRow[], groupLabel: string, hasCost: boolean) {
  const h = [
    groupLabel, 'Qty Sold', 'Gross Revenue', 'Discount', 'Net Revenue',
    ...(hasCost ? ['Profit', 'Margin %'] : []),
    'Line Count', 'Distinct Orders', 'Revenue Share %',
  ];
  const lines = rows.map(r => {
    const margin = r.profit > 0 && r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) + '%' : '—';
    return [
      `"${r.key}"`, r.qty,
      r.gross.toFixed(2), r.discount.toFixed(2), r.revenue.toFixed(2),
      ...(hasCost ? [r.profit.toFixed(2), margin] : []),
      r.lineCount, r.orderCount, r.share.toFixed(1) + '%',
    ].join(',');
  });
  triggerCsvDownload([h.join(','), ...lines].join('\n'), 'sales-grouped');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SortChevron({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <PiArrowsDownUp className="h-3 w-3 text-gray-300" />;
  return dir === 'asc'
    ? <PiArrowUp className="h-3 w-3 text-[#b20202]" />
    : <PiArrowDown className="h-3 w-3 text-[#b20202]" />;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#b20202]/20 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[#b20202]">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-red-100">
        <PiX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function DateTimeRange({
  dateFrom, dateTo, timeFrom, timeTo,
  onDateFrom, onDateTo, onTimeFrom, onTimeTo, onClear,
}: {
  dateFrom: string; dateTo: string; timeFrom: string; timeTo: string;
  onDateFrom: (v: string) => void; onDateTo: (v: string) => void;
  onTimeFrom: (v: string) => void; onTimeTo:  (v: string) => void;
  onClear: () => void;
}) {
  const hasRange = dateFrom || dateTo;
  return (
    <div className="flex items-center gap-2">
      {(['from', 'to'] as const).map(side => {
        const dateVal  = side === 'from' ? dateFrom  : dateTo;
        const timeVal  = side === 'from' ? timeFrom  : timeTo;
        const setDate  = side === 'from' ? onDateFrom : onDateTo;
        const setTime  = side === 'from' ? onTimeFrom : onTimeTo;
        return (
          <div key={side} className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-medium capitalize text-gray-400">{side}</span>
            <div className="flex items-center overflow-hidden rounded-md border border-gray-200 bg-white transition-shadow focus-within:border-[#b20202] focus-within:ring-1 focus-within:ring-[#b20202]/20">
              <input
                type="date" value={dateVal} onChange={e => setDate(e.target.value)}
                className="w-[128px] border-0 bg-transparent px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none"
              />
              <div className="w-px self-stretch bg-gray-100" />
              <div className="flex items-center gap-1 px-2">
                <PiClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  type="time" value={timeVal} onChange={e => setTime(e.target.value)}
                  className="w-[68px] border-0 bg-transparent py-1.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>
            </div>
            {side === 'from' && <span className="text-gray-300 text-xs">→</span>}
          </div>
        );
      })}
      {hasRange && (
        <button
          type="button" onClick={onClear}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Clear date range"
        >
          <PiX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Highlight matching text ────────────────────────────────────────────────────

function highlight(text: string, q: string): ReactNode {
  if (!q || !text) return text;
  const lower  = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let last = 0;
  let idx  = lower.indexOf(lowerQ);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark key={idx} className="rounded-[2px] bg-yellow-100 px-px text-yellow-900 not-italic">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    last = idx + q.length;
    idx  = lower.indexOf(lowerQ, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ── Select option data ─────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; dot?: string; }

const GROUP_BY_OPTIONS: SelectOption[] = [
  { value: 'product',        label: 'By Product' },
  { value: 'variant',        label: 'By Variant' },
  { value: 'cashier',        label: 'By Cashier' },
  { value: 'payment_method', label: 'By Payment' },
  { value: 'date',           label: 'By Date' },
];

const PAYMENT_OPTIONS: SelectOption[] = Object.entries(METHOD_LABEL).map(([k, v]) => ({
  value: k, label: v, dot: METHOD_DOT[k],
}));

// ── CustomSelect ───────────────────────────────────────────────────────────────

function CustomSelect({
  value, onChange, options, placeholder, minWidth = 130, required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  minWidth?: number;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = options.find(o => o.value === value) ?? null;
  const isActive = !required && value !== '';

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
          isActive
            ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
            : open
              ? 'border-gray-300 bg-white text-gray-700 shadow-sm'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        {selected?.dot && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        )}
        <span className="flex-1 truncate text-left font-medium">
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {isActive && (
            <span
              role="button"
              aria-label="Clear"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="rounded-full p-0.5 hover:bg-[#b20202]/10 transition-colors"
            >
              <PiX className="h-2.5 w-2.5" />
            </span>
          )}
          <PiCaretDown
            className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="max-h-56 overflow-y-auto py-1">
            {!required && (
              <>
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    !isActive
                      ? 'bg-gray-50 font-semibold text-gray-800'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span>{placeholder}</span>
                  {!isActive && <span className="text-[10px] font-bold text-[#b20202]">✓</span>}
                </button>
                <div className="mx-3 my-1 border-t border-gray-100" />
              </>
            )}
            {options.map(opt => {
              const isSel = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    isSel
                      ? 'bg-red-50 font-semibold text-[#b20202]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.dot && (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`} />
                  )}
                  <span className="flex-1">{opt.label}</span>
                  {isSel && <span className="text-[10px] font-bold text-[#b20202]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PageBar({
  page, totalPages, totalItems, pageSize,
  onPrev, onNext, onPage,
}: {
  page: number; totalPages: number; totalItems: number; pageSize: number;
  onPrev: () => void; onNext: () => void; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end   = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
    if (totalPages <= 7)             return i + 1;
    if (page <= 4)                   return i + 1;
    if (page >= totalPages - 3)      return totalPages - 6 + i;
    return page - 3 + i;
  });
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
      <p className="text-xs text-gray-500">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrev} disabled={page === 1}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <PiCaretLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map(p => (
          <button key={p} type="button" onClick={() => onPage(p)}
            className={`min-w-[30px] rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              page === p
                ? 'border-[#b20202] bg-[#b20202] text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {p}
          </button>
        ))}
        <button type="button" onClick={onNext} disabled={page === totalPages}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <PiCaretRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function POSSalesDetails() {
  const { data: session, status: sessionStatus } = useSession();
  const token = useMemo(() => {
    const t = (session?.user as { token?: string })?.token ?? null;
    return isTokenExpired(t) ? null : t;
  }, [session]);

  const [orders, setOrders]       = useState<PosOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [truncated, setTruncated] = useState(false);

  // Filters
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [timeFrom, setTimeFrom]           = useState('00:00');
  const [timeTo, setTimeTo]               = useState('23:59');
  const [activePreset, setActivePreset]   = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter, setMethodFilter]   = useState('');
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('active');
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused,   setSearchFocused]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sort
  const [lineSortField,  setLineSortField]  = useState<LineSortField>('date');
  const [lineSortDir,    setLineSortDir]    = useState<'asc' | 'desc'>('desc');
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('revenue');
  const [groupSortDir,   setGroupSortDir]   = useState<'asc' | 'desc'>('desc');

  // View
  const [viewMode,    setViewMode]    = useState<ViewMode>('lines');
  const [groupBy,     setGroupBy]     = useState<GroupByKey>('product');
  const [showProfit,  setShowProfit]  = useState(false);
  const [hiddenCols,  setHiddenCols]  = useState<Set<ToggleableCol>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Pagination (separate for each view)
  const [page,      setPage]      = useState(1);
  const [groupPage, setGroupPage] = useState(1);

  // Close column menu on outside click
  useEffect(() => {
    if (!showColMenu) return;
    function handler(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColMenu]);

  const fetchOrders = useCallback((all = false) => {
    if (sessionStatus === 'loading') return;
    if (!token) { setLoading(false); return; }
    setLoading(true); setError('');
    posApi.getAllOrders(token, { limit: all ? 2000 : 500 })
      .then(data => {
        const rows = (data || []) as PosOrder[];
        setOrders(rows);
        setTruncated(!all && rows.length === 500);
      })
      .catch(() => setError('Failed to load orders. Please try again.'))
      .finally(() => setLoading(false));
  }, [token, sessionStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Debounce search input → debouncedSearch drives filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);

  // ⌘K / Ctrl+K focuses the search; Escape clears + blurs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reset page on filter/sort change (keyed to debouncedSearch so pages reset after filter applies)
  useEffect(() => { setPage(1); },
    [dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, statusFilter, debouncedSearch, lineSortField, lineSortDir]);
  useEffect(() => { setGroupPage(1); },
    [dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, statusFilter, debouncedSearch, groupSortField, groupSortDir, groupBy]);

  // ── Data ───────────────────────────────────────────────────────────────────

  const allRows = useMemo<LineRow[]>(() => {
    const rows: LineRow[] = [];
    for (const o of orders) {
      if (!o.items?.length) continue;
      const cashier = o.posStaff
        ? (o.posStaff.posName || `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim())
        : 'Unknown';
      for (const item of o.items) {
        const gross     = item.priceAtPurchase * item.quantity;
        const discount  = item.discountAmount ?? 0;
        const subtotal  = item.itemSubtotal;
        const costPrice = (item.sizeCostPrice ?? 0) * item.quantity;
        const profit    = costPrice > 0 ? subtotal - costPrice : 0;
        rows.push({
          orderId: o._id, orderNumber: o.orderNumber ?? o._id.slice(-6).toUpperCase(),
          receiptNumber: o.receiptNumber ?? '', date: o.placedAt || o.createdAt,
          cashier, product: item.name, variant: item.variant ?? '',
          qty: item.quantity, unitPrice: item.priceAtPurchase,
          discount, subtotal, gross, costPrice, profit,
          paymentMethod: o.paymentMethod,
          isVoided: !!(o.isVoided || o.status === 'voided'),
        });
      }
    }
    return rows;
  }, [orders]);

  const hasCostData     = useMemo(() => allRows.some(r => r.costPrice > 0), [allRows]);
  const cashiers        = useMemo(() => Array.from(new Set(allRows.map(r => r.cashier))).sort(), [allRows]);
  const cashierOptions  = useMemo<SelectOption[]>(() => cashiers.map(c => ({ value: c, label: c })), [cashiers]);

  // Status tab counts (distinct orders)
  const statusCounts = useMemo(() => {
    const seen = new Map<string, boolean>();
    for (const r of allRows) { if (!seen.has(r.orderId)) seen.set(r.orderId, r.isVoided); }
    let active = 0, voided = 0;
    seen.forEach(v => { if (v) voided++; else active++; });
    return { all: seen.size, active, voided };
  }, [allRows]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allRows.filter(r => {
      if (statusFilter === 'active' && r.isVoided)  return false;
      if (statusFilter === 'voided' && !r.isVoided) return false;
      if (cashierFilter && r.cashier !== cashierFilter) return false;
      if (methodFilter  && r.paymentMethod !== methodFilter) return false;
      if (dateFrom) {
        const startTs = toTs(dateFrom, timeFrom);
        if (new Date(r.date).getTime() < startTs) return false;
      }
      if (dateTo) {
        const endTs = toTs(dateTo, timeTo) + 59_000;
        if (new Date(r.date).getTime() > endTs) return false;
      }
      if (q) {
        const hit =
          r.product.toLowerCase().includes(q)      ||
          r.variant.toLowerCase().includes(q)       ||
          r.cashier.toLowerCase().includes(q)       ||
          r.orderNumber.toLowerCase().includes(q)   ||
          r.receiptNumber.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allRows, statusFilter, cashierFilter, methodFilter, dateFrom, dateTo, timeFrom, timeTo, debouncedSearch]);

  // ── Sort (line view) ───────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[lineSortField] as string | number;
      const bv = b[lineSortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number')
        return lineSortDir === 'asc' ? av - bv : bv - av;
      return lineSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, lineSortField, lineSortDir]);

  // ── Grouped ────────────────────────────────────────────────────────────────

  const grouped = useMemo<GroupRow[]>(() => {
    const totalRev = filtered.reduce((s, r) => s + r.subtotal, 0);
    const map = new Map<string, { row: GroupRow; orderIds: Set<string> }>();

    for (const r of filtered) {
      const key =
        groupBy === 'product'        ? (r.product + (r.variant ? ` (${r.variant})` : '')) :
        groupBy === 'variant'        ? (r.variant || '(no variant)') :
        groupBy === 'cashier'        ? r.cashier :
        groupBy === 'payment_method' ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) :
        fmtDate(r.date);

      const entry = map.get(key);
      if (entry) {
        entry.row.qty      += r.qty;      entry.row.gross    += r.gross;
        entry.row.discount += r.discount; entry.row.revenue  += r.subtotal;
        entry.row.profit   += r.profit;   entry.row.lineCount += 1;
        entry.orderIds.add(r.orderId);
      } else {
        map.set(key, {
          row: { key, qty: r.qty, gross: r.gross, discount: r.discount,
                 revenue: r.subtotal, profit: r.profit, lineCount: 1, orderCount: 0, share: 0 },
          orderIds: new Set([r.orderId]),
        });
      }
    }

    return Array.from(map.values())
      .map(({ row, orderIds }) => ({
        ...row, orderCount: orderIds.size,
        share: totalRev > 0 ? (row.revenue / totalRev) * 100 : 0,
      }))
      .sort((a, b) => {
        const av = a[groupSortField] as number | string;
        const bv = b[groupSortField] as number | string;
        if (typeof av === 'number' && typeof bv === 'number')
          return groupSortDir === 'asc' ? av - bv : bv - av;
        return groupSortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
  }, [filtered, groupBy, groupSortField, groupSortDir]);

  // ── Summary ────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const revenue  = filtered.reduce((s, r) => s + r.subtotal, 0);
    const items    = filtered.reduce((s, r) => s + r.qty, 0);
    const discount = filtered.reduce((s, r) => s + r.discount, 0);
    const gross    = filtered.reduce((s, r) => s + r.gross, 0);
    const profit   = filtered.reduce((s, r) => s + r.profit, 0);
    const orderIds = new Set(filtered.map(r => r.orderId));
    const cnt      = orderIds.size;
    return { revenue, items, discount, gross, profit, orders: cnt, avgOrder: cnt > 0 ? revenue / cnt : 0 };
  }, [filtered]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const lineTotalPages  = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated       = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groupTotalPages = Math.max(1, Math.ceil(grouped.length / GROUP_PAGE_SIZE));
  const paginatedGroup  = grouped.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleLineSort(field: LineSortField) {
    if (lineSortField === field) setLineSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setLineSortField(field); setLineSortDir(field === 'date' ? 'desc' : 'asc'); }
  }
  function toggleGroupSort(field: GroupSortField) {
    if (groupSortField === field) setGroupSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setGroupSortField(field); setGroupSortDir('desc'); }
  }
  function toggleCol(key: ToggleableCol) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  const vis = (key: ToggleableCol) => !hiddenCols.has(key);

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setDateFrom(preset.from()); setDateTo(preset.to());
    setTimeFrom(preset.tf); setTimeTo(preset.tt);
    setActivePreset(preset.label);
  }
  function clearDateRange() {
    setDateFrom(''); setDateTo('');
    setTimeFrom('00:00'); setTimeTo('23:59');
    setActivePreset('');
  }
  function clearAll() {
    clearDateRange();
    setCashierFilter(''); setMethodFilter('');
    setStatusFilter('active'); setSearch('');
  }

  // Active filter chips
  const filterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (dateFrom || dateTo) chips.push({
      label: `${dateFrom || '…'}${timeFrom !== '00:00' ? ` ${timeFrom}` : ''} → ${dateTo || '…'}${timeTo !== '23:59' ? ` ${timeTo}` : ''}`,
      onRemove: clearDateRange,
    });
    if (cashierFilter) chips.push({ label: cashierFilter, onRemove: () => setCashierFilter('') });
    if (methodFilter)  chips.push({ label: METHOD_LABEL[methodFilter] ?? methodFilter, onRemove: () => setMethodFilter('') });
    if (search)        chips.push({ label: `"${search.slice(0, 24)}${search.length > 24 ? '…' : ''}"`, onRemove: () => setSearch('') });
    return chips;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, search]);

  const groupLabel =
    groupBy === 'product'        ? 'Product / Variant' :
    groupBy === 'variant'        ? 'Variant' :
    groupBy === 'cashier'        ? 'Cashier' :
    groupBy === 'payment_method' ? 'Payment Method' :
    'Date';

  function handleExport() {
    if (viewMode === 'grouped') exportGroupedCsv(grouped, groupLabel, hasCostData && showProfit);
    else exportLineCsv(sorted, hasCostData && showProfit);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <POSNavHeader />

      {/* ── Sticky control bar ── */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white shadow-sm">

        {/* Row 1 — title · status tabs · actions */}
        <div className="flex h-14 items-center gap-4 px-5">

          {/* Left: title + context */}
          <div className="flex min-w-0 shrink-0 flex-col justify-center">
            <h1 className="text-[15px] font-bold tracking-tight text-gray-900">Sales Details</h1>
            <p className="text-[11px] leading-none text-gray-400">
              {loading
                ? 'Loading…'
                : <>
                    {orders.length.toLocaleString()} orders
                    {truncated && <> · <button type="button" onClick={() => fetchOrders(true)} className="text-[#b20202] underline hover:no-underline">Load all</button></>}
                    {filtered.length !== allRows.length && <> · <span className="font-medium text-gray-600">{filtered.length.toLocaleString()} shown</span></>}
                  </>
              }
            </p>
          </div>

          {/* Centre: status tabs */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
              {(['all', 'active', 'voided'] as StatusFilter[]).map(s => {
                const active = statusFilter === s;
                return (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={`flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-xs font-semibold transition-all ${
                      active ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Voided'}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none transition-colors ${
                      active
                        ? s === 'voided' ? 'bg-red-100 text-red-600' : 'bg-[#b20202]/10 text-[#b20202]'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {statusCounts[s]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: view controls + actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(['lines', 'grouped'] as ViewMode[]).map(m => (
                <button key={m} type="button" onClick={() => setViewMode(m)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                    viewMode === m ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  {m === 'lines' ? <><PiList className="h-3.5 w-3.5" />Lines</> : <><PiRows className="h-3.5 w-3.5" />Grouped</>}
                </button>
              ))}
            </div>

            {viewMode === 'grouped' && (
              <CustomSelect
                value={groupBy}
                onChange={v => setGroupBy((v || 'product') as GroupByKey)}
                options={GROUP_BY_OPTIONS}
                placeholder="Group by…"
                minWidth={120}
                required
              />
            )}

            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Column picker */}
            <div className="relative" ref={colMenuRef}>
              <button type="button" onClick={() => setShowColMenu(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-xs font-medium transition-colors ${
                  showColMenu || hiddenCols.size > 0
                    ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                Columns
                {hiddenCols.size > 0 && (
                  <span className="rounded-full bg-[#b20202] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {TOGGLEABLE_COLS.length - hiddenCols.size}/{TOGGLEABLE_COLS.length}
                  </span>
                )}
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                  <div className="border-b border-gray-100 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Show / Hide columns</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {TOGGLEABLE_COLS.map(col => (
                      <button key={col.key} type="button" onClick={() => toggleCol(col.key)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50 transition-colors">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all ${
                          vis(col.key) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-300'
                        }`}>{vis(col.key) ? '✓' : ''}</span>
                        <span className={`text-xs ${vis(col.key) ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{col.label}</span>
                      </button>
                    ))}
                  </div>
                  {hiddenCols.size > 0 && (
                    <div className="border-t border-gray-100 p-1.5">
                      <button type="button" onClick={() => setHiddenCols(new Set())}
                        className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-[#b20202] hover:bg-red-50 transition-colors">
                        Show all columns
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            <button type="button" onClick={() => fetchOrders()} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-[7px] text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <PiArrowsClockwise className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button type="button" onClick={handleExport}
              disabled={(viewMode === 'lines' ? sorted.length : grouped.length) === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-[7px] text-xs font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50 transition-colors shadow-sm">
              <PiDownloadSimple className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Row 2 — date presets + datetime range */}
        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-2">
          {DATE_PRESETS.map(preset => (
            <button key={preset.label} type="button" onClick={() => applyPreset(preset)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activePreset === preset.label
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-[#b20202] hover:text-[#b20202]'
              }`}>
              {preset.label}
            </button>
          ))}

          <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" />

          <DateTimeRange
            dateFrom={dateFrom} dateTo={dateTo} timeFrom={timeFrom} timeTo={timeTo}
            onDateFrom={v => { setDateFrom(v); setActivePreset(''); }}
            onDateTo={v => { setDateTo(v); setActivePreset(''); }}
            onTimeFrom={setTimeFrom} onTimeTo={setTimeTo}
            onClear={clearDateRange}
          />
        </div>

        {/* Row 3 — field filters + search */}
        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2">
          <CustomSelect
            value={cashierFilter}
            onChange={setCashierFilter}
            options={cashierOptions}
            placeholder="All cashiers"
            minWidth={140}
          />

          <CustomSelect
            value={methodFilter}
            onChange={setMethodFilter}
            options={PAYMENT_OPTIONS}
            placeholder="All payments"
            minWidth={140}
          />

          {hasCostData && (
            <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={showProfit} onChange={e => setShowProfit(e.target.checked)} className="accent-[#b20202]" />
              Show profit
            </label>
          )}

          {/* Active filter chips (inline) */}
          {filterChips.length > 0 && (
            <div className="flex items-center gap-1.5 ml-1">
              {filterChips.map(chip => (
                <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
              ))}
            </div>
          )}

          {/* Search + clear (right-aligned) */}
          <div className="ml-auto flex items-center gap-2">
            <div className={`relative transition-all duration-200 ${searchFocused || search ? 'w-72' : 'w-56'}`}>
              <PiMagnifyingGlass className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-150 ${
                searchFocused ? 'text-[#b20202]' : 'text-gray-400'
              }`} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search product, cashier, order #…"
                className={`w-full rounded-lg border py-1.5 pl-8 text-sm outline-none transition-all duration-150 ${
                  search
                    ? 'border-[#b20202]/50 bg-red-50/40 pr-14 text-gray-800 ring-2 ring-[#b20202]/10'
                    : searchFocused
                      ? 'border-[#b20202] bg-white pr-8 ring-2 ring-[#b20202]/10'
                      : 'border-gray-200 bg-white pr-16 hover:border-gray-300'
                }`}
              />
              {/* Result count — shown while debounced search is active */}
              {debouncedSearch && (
                <span className="absolute right-7 top-1/2 -translate-y-1/2 rounded-full bg-[#b20202]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#b20202]">
                  {filtered.length}
                </span>
              )}
              {/* Clear */}
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <PiX className="h-3.5 w-3.5" />
                </button>
              ) : !searchFocused ? (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[9px] leading-none text-gray-300">
                  ⌘K
                </kbd>
              ) : null}
            </div>

            {(filterChips.length > 0 || cashierFilter || methodFilter || statusFilter !== 'active') && (
              <button type="button" onClick={clearAll}
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-[#b20202] hover:bg-red-100 transition-colors">
                <PiX className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="grid divide-x divide-gray-100"
          style={{ gridTemplateColumns: `repeat(${hasCostData ? 6 : 5}, minmax(0, 1fr))` }}>
          {[
            { icon: PiCurrencyNgn,  label: 'Gross Revenue',   value: formatCurrency(summary.gross),    sub: `−${formatCurrency(summary.discount)} disc.`, color: 'text-gray-400',   bg: 'bg-gray-50' },
            { icon: PiTrendUp,      label: 'Net Revenue',     value: formatCurrency(summary.revenue),  sub: 'after discounts',                             color: 'text-green-500',  bg: 'bg-green-50' },
            { icon: PiTag,          label: 'Total Discount',  value: formatCurrency(summary.discount), sub: summary.gross > 0 ? `${((summary.discount / summary.gross) * 100).toFixed(1)}% of gross` : '', color: 'text-orange-400', bg: 'bg-orange-50' },
            { icon: PiShoppingCart, label: 'Items Sold',      value: summary.items.toLocaleString(),   sub: `across ${filtered.length.toLocaleString()} lines`, color: 'text-blue-500', bg: 'bg-blue-50' },
            { icon: PiRows,         label: 'Distinct Orders', value: summary.orders.toLocaleString(),  sub: `avg ${formatCurrency(summary.avgOrder)} / order`, color: 'text-purple-500', bg: 'bg-purple-50' },
            ...(hasCostData ? [{ icon: PiPercent, label: 'Est. Profit', value: formatCurrency(summary.profit), sub: summary.revenue > 0 ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% margin` : '', color: 'text-teal-500', bg: 'bg-teal-50' }] : []),
          ].map(({ icon: Icon, label, value, sub, color, bg }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 tabular-nums">{sub}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-5 py-4 space-y-3">

        {loading ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3">
              {[100, 60, 80, 160, 70, 40, 70, 70, 70, 80, 70].map((w, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-gray-200" style={{ width: w, flexShrink: 0 }} />
              ))}
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`flex gap-4 border-b border-gray-50 px-4 py-3 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                {[90, 60, 80, 150, 70, 32, 70, 70, 70, 80, 70].map((w, j) => (
                  <div key={j} className="h-3.5 animate-pulse rounded bg-gray-100" style={{ width: w, flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#b20202]">
              <PiX className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
            <button onClick={() => fetchOrders()}
              className="mt-2 rounded-md bg-[#b20202] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#9a0101]">
              Retry
            </button>
          </div>
        ) : viewMode === 'lines' ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th onClick={() => toggleLineSort('date')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700">
                      <span className="inline-flex items-center gap-1">Date/Time<SortChevron active={lineSortField === 'date'} dir={lineSortDir} /></span>
                    </th>
                    {vis('orderNumber') && (
                      <th onClick={() => toggleLineSort('orderNumber')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Order #<SortChevron active={lineSortField === 'orderNumber'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    {vis('cashier') && (
                      <th onClick={() => toggleLineSort('cashier')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Cashier<SortChevron active={lineSortField === 'cashier'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    <th onClick={() => toggleLineSort('product')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700">
                      <span className="inline-flex items-center gap-1">Product<SortChevron active={lineSortField === 'product'} dir={lineSortDir} /></span>
                    </th>
                    {vis('variant') && (
                      <th onClick={() => toggleLineSort('variant')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Variant<SortChevron active={lineSortField === 'variant'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    <th onClick={() => toggleLineSort('qty')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-center hover:text-gray-700">
                      <span className="inline-flex items-center justify-center gap-1">Qty<SortChevron active={lineSortField === 'qty'} dir={lineSortDir} /></span>
                    </th>
                    {vis('unitPrice') && (
                      <th onClick={() => toggleLineSort('unitPrice')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Unit Price<SortChevron active={lineSortField === 'unitPrice'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    {vis('gross') && (
                      <th onClick={() => toggleLineSort('gross')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Gross<SortChevron active={lineSortField === 'gross'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    {vis('discount') && (
                      <th onClick={() => toggleLineSort('discount')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Discount<SortChevron active={lineSortField === 'discount'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    <th onClick={() => toggleLineSort('subtotal')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700">
                      <span className="inline-flex items-center gap-1">Net Total<SortChevron active={lineSortField === 'subtotal'} dir={lineSortDir} /></span>
                    </th>
                    {showProfit && hasCostData && (
                      <th onClick={() => toggleLineSort('profit')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Profit<SortChevron active={lineSortField === 'profit'} dir={lineSortDir} /></span>
                      </th>
                    )}
                    {vis('payment') && (
                      <th onClick={() => toggleLineSort('paymentMethod')} className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700">
                        <span className="inline-flex items-center gap-1">Payment<SortChevron active={lineSortField === 'paymentMethod'} dir={lineSortDir} /></span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-20 text-center">
                        <p className="text-sm font-medium text-gray-400">
                          {allRows.length === 0 ? 'No sales data found.' : 'No line items match the current filters.'}
                        </p>
                        {allRows.length > 0 && (
                          <button type="button" onClick={clearAll} className="mt-2 text-xs text-[#b20202] underline">Clear filters</button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, i) => (
                      <tr key={`${row.orderId}-${i}`}
                        className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${
                          i % 2 === 1 ? 'bg-gray-50/30' : ''
                        } ${row.isVoided ? 'opacity-40' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{fmtDateTime(row.date)}</td>
                        {vis('orderNumber') && (
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className="font-mono text-xs font-semibold text-gray-800">
                              {highlight(row.orderNumber, debouncedSearch)}
                            </span>
                            {row.isVoided && <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">VOID</span>}
                          </td>
                        )}
                        {vis('cashier') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                            {highlight(row.cashier, debouncedSearch)}
                          </td>
                        )}
                        <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-gray-900">
                          {highlight(row.product, debouncedSearch)}
                        </td>
                        {vis('variant') && (
                          <td className="px-4 py-2.5 text-sm text-gray-500">
                            {row.variant
                              ? highlight(row.variant, debouncedSearch)
                              : <span className="text-gray-300">—</span>}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-center text-sm font-medium text-gray-700 tabular-nums">{row.qty}</td>
                        {vis('unitPrice') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-600 tabular-nums">{formatCurrency(row.unitPrice)}</td>
                        )}
                        {vis('gross') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500 tabular-nums">{formatCurrency(row.gross)}</td>
                        )}
                        {vis('discount') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                            {row.discount > 0
                              ? <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(row.subtotal)}</td>
                        {showProfit && hasCostData && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                            {row.profit > 0
                              ? <span className="font-medium text-teal-600">{formatCurrency(row.profit)}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                        )}
                        {vis('payment') && (
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLOR[row.paymentMethod] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                              {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {sorted.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                      <td colSpan={
                        1
                        + (vis('orderNumber') ? 1 : 0)
                        + (vis('cashier') ? 1 : 0)
                        + 1
                        + (vis('variant') ? 1 : 0)
                      } className="px-4 py-3 text-gray-400">
                        {sorted.length.toLocaleString()} line{sorted.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{sorted.reduce((s, r) => s + r.qty, 0).toLocaleString()}</td>
                      {vis('unitPrice') && <td className="px-4 py-3" />}
                      {vis('gross') && (
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{formatCurrency(sorted.reduce((s, r) => s + r.gross, 0))}</td>
                      )}
                      {vis('discount') && (
                        <td className="px-4 py-3 text-right text-orange-500 tabular-nums">−{formatCurrency(sorted.reduce((s, r) => s + r.discount, 0))}</td>
                      )}
                      <td className="px-4 py-3 text-right text-[#b20202] tabular-nums">{formatCurrency(sorted.reduce((s, r) => s + r.subtotal, 0))}</td>
                      {showProfit && hasCostData && (
                        <td className="px-4 py-3 text-right text-teal-600 tabular-nums">{formatCurrency(sorted.reduce((s, r) => s + r.profit, 0))}</td>
                      )}
                      {vis('payment') && <td className="px-4 py-3" />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <PageBar
              page={page} totalPages={lineTotalPages} totalItems={sorted.length} pageSize={PAGE_SIZE}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(lineTotalPages, p + 1))}
              onPage={setPage}
            />
          </div>

        ) : (
          /* ── Grouped view ── */
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {([
                      { field: 'key'        as GroupSortField, label: groupLabel,       align: 'text-left'   },
                      { field: 'qty'        as GroupSortField, label: 'Qty Sold',       align: 'text-center' },
                      { field: 'gross'      as GroupSortField, label: 'Gross Revenue',  align: 'text-right'  },
                      { field: 'discount'   as GroupSortField, label: 'Discount',       align: 'text-right'  },
                      { field: 'revenue'    as GroupSortField, label: 'Net Revenue',    align: 'text-right'  },
                      ...(showProfit && hasCostData ? [{ field: 'profit' as GroupSortField, label: 'Profit', align: 'text-right' }] : []),
                      { field: 'share'      as GroupSortField, label: 'Revenue Share',  align: 'text-left'   },
                      { field: 'lineCount'  as GroupSortField, label: 'Lines',          align: 'text-center' },
                      { field: 'orderCount' as GroupSortField, label: 'Orders',         align: 'text-center' },
                    ]).map(({ field, label, align }) => (
                      <th key={field} onClick={() => toggleGroupSort(field)}
                        className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 ${align} hover:text-gray-700`}>
                        <span className="inline-flex items-center gap-1">
                          {label}<SortChevron active={groupSortField === field} dir={groupSortDir} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedGroup.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center text-sm text-gray-400">
                        {allRows.length === 0 ? 'No sales data found.' : 'No data matches the current filters.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedGroup.map((row, i) => (
                      <tr key={row.key}
                        className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-gray-900">
                          {highlight(row.key, debouncedSearch)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-700 tabular-nums">{row.qty.toLocaleString()}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-500 tabular-nums">{formatCurrency(row.gross)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                          {row.discount > 0
                            ? <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(row.revenue)}</td>
                        {showProfit && hasCostData && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                            {row.profit > 0 ? <span className="font-medium text-teal-600">{formatCurrency(row.profit)}</span> : <span className="text-gray-200">—</span>}
                          </td>
                        )}
                        <td className="min-w-[160px] px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-[#b20202] transition-all" style={{ width: `${Math.min(100, row.share)}%` }} />
                            </div>
                            <span className="w-10 shrink-0 text-right text-xs text-gray-500 tabular-nums">{row.share.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500 tabular-nums">{row.lineCount}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500 tabular-nums">{row.orderCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {grouped.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                      <td className="px-4 py-3 text-gray-400">{grouped.length} group{grouped.length !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{grouped.reduce((s, r) => s + r.qty, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{formatCurrency(grouped.reduce((s, r) => s + r.gross, 0))}</td>
                      <td className="px-4 py-3 text-right text-orange-500 tabular-nums">−{formatCurrency(grouped.reduce((s, r) => s + r.discount, 0))}</td>
                      <td className="px-4 py-3 text-right text-[#b20202] tabular-nums">{formatCurrency(grouped.reduce((s, r) => s + r.revenue, 0))}</td>
                      {showProfit && hasCostData && (
                        <td className="px-4 py-3 text-right text-teal-600 tabular-nums">{formatCurrency(grouped.reduce((s, r) => s + r.profit, 0))}</td>
                      )}
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{grouped.reduce((s, r) => s + r.lineCount, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{new Set(filtered.map(r => r.orderId)).size.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <PageBar
              page={groupPage} totalPages={groupTotalPages} totalItems={grouped.length} pageSize={GROUP_PAGE_SIZE}
              onPrev={() => setGroupPage(p => Math.max(1, p - 1))}
              onNext={() => setGroupPage(p => Math.min(groupTotalPages, p + 1))}
              onPage={setGroupPage}
            />
          </div>
        )}

        {/* Truncation notice */}
        {truncated && !loading && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <span>Showing first 500 orders only — older data may be missing.</span>
            <button type="button" onClick={() => fetchOrders(true)} className="ml-4 font-medium underline hover:no-underline">
              Load all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
