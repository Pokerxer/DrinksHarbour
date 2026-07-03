'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PiCalendar,
  PiCaretDown,
  PiCaretUp,
  PiClock,
  PiFloppyDisk,
  PiStack,
  PiStar,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import { GroupItem } from '@/components/list-controls';
import type { InventoryMovement } from '@/services/inventory.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortCol =
  | 'date'
  | 'product'
  | 'type'
  | 'warehouse'
  | 'reference'
  | 'qty'
  | 'cost'
  | 'by';
export type SortDir = 'asc' | 'desc';
export type TypeFilter = 'all' | 'received' | 'purchase' | 'return' | 'other';
export type GroupKey =
  | 'warehouse'
  | 'type'
  | 'product'
  | 'supplier'
  | 'source'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  groupBy: GroupKey | null;
}

export const PAGE_SIZE = 50;
export const SAVED_KEY = 'dh-inventory-receipt-searches';

// ── Constants ─────────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<string, string> = {
  received: 'Received',
  purchase: 'Purchase',
  return: 'Return',
  adjustment_in: 'Adjustment (in)',
  transfer_in: 'Transfer in',
  released: 'Released',
  sold: 'Sold',
  shipped: 'Shipped',
  adjustment_out: 'Adjustment (out)',
  transfer_out: 'Transfer out',
  damaged: 'Damaged',
  expired: 'Expired',
  theft: 'Theft',
  written_off: 'Written off',
  reserved: 'Reserved',
};
export const TYPE_COLOR: Record<string, string> = {
  received: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  purchase: 'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  return: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  adjustment_in: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  transfer_in: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  released: 'bg-gray-100  text-gray-600',
  sold: 'bg-red-50    text-red-700    ring-1 ring-red-200',
  shipped: 'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  adjustment_out: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  transfer_out: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  damaged: 'bg-red-50    text-red-700    ring-1 ring-red-200',
  expired: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  theft: 'bg-rose-50   text-rose-700   ring-1 ring-rose-200',
  written_off: 'bg-gray-100  text-gray-600  ring-1 ring-gray-200',
  reserved: 'bg-sky-50    text-sky-700    ring-1 ring-sky-200',
};

/** Display sign for a movement's quantity: in → +, out → −, neutral → ''. */
export function qtySign(m: InventoryMovement): '+' | '−' | '' {
  if (m.category === 'in') return '+';
  if (m.category === 'out') return '−';
  if (m.category === 'adjustment') return m.type.endsWith('_in') ? '+' : '−';
  return '';
}
export function qtyCls(m: InventoryMovement): string {
  const s = qtySign(m);
  return s === '+'
    ? 'text-emerald-600'
    : s === '−'
      ? 'text-red-600'
      : 'text-gray-700';
}

export const GROUP_LABELS: Record<GroupKey, string> = {
  warehouse: 'Warehouse',
  type: 'Receipt Type',
  product: 'Product',
  supplier: 'Supplier',
  source: 'Source',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

// ── Quick date presets ────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function lastMonthStart() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}
function lastMonthEnd() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  return d.toISOString().slice(0, 10);
}

export const DATE_PRESETS = [
  {
    label: 'Today',
    from: () => todayStr(),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'Yesterday',
    from: () => offsetDay(-1),
    to: () => offsetDay(-1),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'Last 7 days',
    from: () => offsetDay(-6),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'This week',
    from: () => weekStartStr(),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'This month',
    from: () => monthStartStr(),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'Last month',
    from: () => lastMonthStart(),
    to: () => lastMonthEnd(),
    tf: '00:00',
    tt: '23:59',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
export function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
export function fmtDateTime(d: string) {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}

export function fmtNgn(v: number) {
  return `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moveDate(m: InventoryMovement) {
  return m.performedAt ?? m.createdAt;
}

export function productLabel(m: InventoryMovement): string {
  const p = m.product as { name?: string } | undefined;
  return p?.name ?? m.reference ?? '—';
}
export function sizeLabel(m: InventoryMovement): string | null {
  return (
    m.sizeName ??
    (typeof m.size === 'object'
      ? (m.size?.displayName ?? m.size?.size ?? null)
      : null)
  );
}
export function warehouseLabel(
  w?: { name?: string; code?: string } | string | null
): string {
  if (!w) return '—';
  if (typeof w === 'string') return w;
  return w.name ?? w.code ?? '—';
}
export function byLabel(m: InventoryMovement): string {
  const u = m.performedBy;
  return u
    ? u.posName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—'
    : '—';
}
export function referenceLabel(m: InventoryMovement): string {
  const po = m.relatedPurchaseOrder as { poNumber?: string } | undefined;
  return po?.poNumber ?? m.reference ?? m.batchNumber ?? '—';
}
export function typeFamily(m: InventoryMovement): TypeFilter {
  if (m.type === 'received') return 'received';
  if (m.type === 'purchase') return 'purchase';
  if (m.type === 'return') return 'return';
  return 'other';
}

export function startOfWeek(d = new Date()) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}
export function quarterLabel(d: Date) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
export function weekLabel(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return `${s.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' })}–${e.toLocaleDateString('en-GB', { month: 'short', day: '2-digit', year: 'numeric' })}`;
}

export function toTs(date: string, time: string): number {
  if (!date) return 0;
  return new Date(`${date}T${time || '00:00'}:00`).getTime();
}

export function loadSaved(key: string = SAVED_KEY): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as SavedSearch[];
  } catch {
    return [];
  }
}
export function persistSaved(list: SavedSearch[], key: string = SAVED_KEY) {
  localStorage.setItem(key, JSON.stringify(list));
}

// ── Print (Goods Receipt Note) ────────────────────────────────────────────────

export function printMoves(
  moves: InventoryMovement[],
  docTitle = 'Goods Receipt Note'
) {
  if (moves.length === 0) return;
  const totalQty = moves.reduce((s, m) => s + Math.abs(m.quantity), 0);
  const totalCost = moves.reduce(
    (s, m) => s + (m.totalCost ?? (m.unitCost ?? 0) * Math.abs(m.quantity)),
    0
  );
  const rows = moves
    .map((m) => {
      const size = sizeLabel(m);
      return `<tr>
        <td>${fmtDateTime(moveDate(m))}</td>
        <td><strong>${productLabel(m)}</strong>${size ? ` <span class="muted">· ${size}</span>` : ''}</td>
        <td>${TYPE_LABEL[m.type] ?? m.type}</td>
        <td>${warehouseLabel(m.warehouse)}</td>
        <td>${referenceLabel(m)}</td>
        <td class="num">${qtySign(m)}${Math.abs(m.quantity)}</td>
        <td class="num">${m.unitCost != null ? fmtNgn(m.unitCost) : '—'}</td>
        <td class="num">${fmtNgn(m.totalCost ?? (m.unitCost ?? 0) * Math.abs(m.quantity))}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><title>${docTitle}</title><style>
    * { box-sizing: border-box; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
    body { margin: 32px; color: #111827; }
    h1 { font-size: 18px; margin: 0; } .sub { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b20202; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-weight: 800; color: #b20202; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; text-transform: uppercase; letter-spacing: .04em; font-size: 9px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }
    td { border-bottom: 1px solid #f3f4f6; padding: 7px 8px; vertical-align: top; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #9ca3af; }
    tfoot td { font-weight: 700; border-top: 2px solid #e5e7eb; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${docTitle}</h1>
        <p class="sub">${moves.length} line${moves.length === 1 ? '' : 's'} · printed ${fmtDateTime(new Date().toISOString())}</p>
      </div>
      <div class="brand">DRINKSHARBOUR · INVENTORY</div>
    </div>
    <table>
      <thead><tr>
        <th>Date</th><th>Product</th><th>Type</th><th>Warehouse</th><th>Reference</th>
        <th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="5">Totals</td>
        <td class="num">${totalQty}</td><td></td>
        <td class="num">${fmtNgn(totalCost)}</td>
      </tr></tfoot>
    </table>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function exportCsv(
  rows: InventoryMovement[],
  prefix = 'inventory-receipts'
) {
  const headers = [
    'Date',
    'Time',
    'Product',
    'Size',
    'SKU/Ref',
    'Type',
    'Warehouse',
    'Supplier',
    'Batch',
    'Qty',
    'Unit Cost',
    'Total Cost',
    'By',
    'Status',
  ];
  const lines = rows.map((m) =>
    [
      fmtDate(moveDate(m)),
      fmtTime(moveDate(m)),
      `"${productLabel(m)}"`,
      `"${sizeLabel(m) ?? ''}"`,
      `"${referenceLabel(m)}"`,
      TYPE_LABEL[m.type] ?? m.type,
      `"${warehouseLabel(m.warehouse)}"`,
      `"${m.supplierName ?? ''}"`,
      `"${m.batchNumber ?? ''}"`,
      Math.abs(m.quantity),
      (m.unitCost ?? 0).toFixed(2),
      (m.totalCost ?? (m.unitCost ?? 0) * Math.abs(m.quantity)).toFixed(2),
      `"${byLabel(m)}"`,
      m.status,
    ].join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── DateTimeRange (same control as POS orders) ────────────────────────────────

export function DateTimeRange({
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
  onDateFrom,
  onDateTo,
  onTimeFrom,
  onTimeTo,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onTimeFrom: (v: string) => void;
  onTimeTo: (v: string) => void;
  onClear: () => void;
}) {
  const hasRange = dateFrom || dateTo;
  const box = (
    dv: string,
    tv: string,
    onD: (v: string) => void,
    onT: (v: string) => void,
    label: string
  ) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-[#b20202] focus-within:ring-1 focus-within:ring-[#b20202]/20">
        <div className="flex items-center gap-1 border-r border-gray-100 px-2.5 py-1.5">
          <PiCalendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="date"
            value={dv}
            onChange={(e) => onD(e.target.value)}
            className="w-[116px] bg-transparent text-xs text-gray-800 outline-none"
          />
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1.5">
          <PiClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="time"
            value={tv}
            onChange={(e) => onT(e.target.value)}
            className="w-[72px] bg-transparent text-xs text-gray-800 outline-none"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {box(dateFrom, timeFrom, onDateFrom, onTimeFrom, 'From')}
      <span className="mt-5 text-sm text-gray-300">→</span>
      {box(dateTo, timeTo, onDateTo, onTimeTo, 'To')}
      {hasRange && (
        <button
          type="button"
          onClick={onClear}
          title="Clear date range"
          className="mt-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <PiX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Group-by panel (same layout as POS orders) ────────────────────────────────

export function GroupPanel({
  groupBy,
  savedSearches,
  onSetGroupBy,
  onSave,
  onLoadSaved,
  onDeleteSaved,
  onClose,
}: {
  groupBy: GroupKey | null;
  savedSearches: SavedSearch[];
  onSetGroupBy: (g: GroupKey | null) => void;
  onSave: (name: string) => void;
  onLoadSaved: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
}) {
  const [groupDateOpen, setGroupDateOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
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
      className="ring-gray-900/8 absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1"
      style={{ minWidth: 460 }}
    >
      <div className="flex divide-x divide-gray-100">
        {/* Group By */}
        <div className="flex-1 p-4">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </p>
          <div className="space-y-0.5">
            <GroupItem
              gkey="warehouse"
              label="Warehouse"
              active={groupBy === 'warehouse'}
              onToggle={onSetGroupBy}
            />
            <GroupItem
              gkey="type"
              label="Receipt Type"
              active={groupBy === 'type'}
              onToggle={onSetGroupBy}
            />
            <GroupItem
              gkey="product"
              label="Product"
              active={groupBy === 'product'}
              onToggle={onSetGroupBy}
            />
            <GroupItem
              gkey="supplier"
              label="Supplier"
              active={groupBy === 'supplier'}
              onToggle={onSetGroupBy}
            />
            <GroupItem
              gkey="source"
              label="Source"
              active={groupBy === 'source'}
              onToggle={onSetGroupBy}
            />
            <div>
              <button
                type="button"
                onClick={() => setGroupDateOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 text-xs">
                  <PiCalendar className="h-3.5 w-3.5 text-gray-400" />
                  Receipt Date
                </span>
                {groupDateOpen ? (
                  <PiCaretUp className="h-3 w-3 text-gray-400" />
                ) : (
                  <PiCaretDown className="h-3 w-3 text-gray-400" />
                )}
              </button>
              {groupDateOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  <GroupItem
                    gkey="day"
                    label="Day"
                    active={groupBy === 'day'}
                    onToggle={onSetGroupBy}
                  />
                  <GroupItem
                    gkey="week"
                    label="Week"
                    active={groupBy === 'week'}
                    onToggle={onSetGroupBy}
                  />
                  <GroupItem
                    gkey="month"
                    label="Month"
                    active={groupBy === 'month'}
                    onToggle={onSetGroupBy}
                  />
                  <GroupItem
                    gkey="quarter"
                    label="Quarter"
                    active={groupBy === 'quarter'}
                    onToggle={onSetGroupBy}
                  />
                  <GroupItem
                    gkey="year"
                    label="Year"
                    active={groupBy === 'year'}
                    onToggle={onSetGroupBy}
                  />
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
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
              >
                <PiFloppyDisk className="h-3.5 w-3.5 text-gray-400" /> Save
                current search
              </button>
            ) : (
              <div className="space-y-2 px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveName.trim()) {
                      onSave(saveName.trim());
                      setSaveName('');
                      setShowSaveInput(false);
                    }
                    if (e.key === 'Escape') setShowSaveInput(false);
                  }}
                  placeholder="Name this search…"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#b20202]"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (saveName.trim()) {
                        onSave(saveName.trim());
                        setSaveName('');
                        setShowSaveInput(false);
                      }
                    }}
                    disabled={!saveName.trim()}
                    className="flex-1 rounded-lg bg-[#b20202] py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveName('');
                      setShowSaveInput(false);
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {savedSearches.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2">
                {savedSearches.map((s) => (
                  <div key={s.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadSaved(s);
                        onClose();
                      }}
                      className="flex flex-1 items-center gap-2 truncate rounded-lg px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <PiStar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSaved(s.id)}
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 hover:text-red-500 group-hover:flex"
                    >
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
