'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiArrowsClockwise,
  PiBuildings,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiCaretUp,
  PiCheck,
  PiCheckSquare,
  PiCube,
  PiCurrencyNgn,
  PiDownloadSimple,
  PiInfo,
  PiMagnifyingGlass,
  PiPrinter,
  PiSquare,
  PiStack,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import { GroupItem, SortIcon } from '@/components/list-controls';
import {
  warehouseStockService,
  type StockRow,
} from '@/services/warehouseStock.service';
import {
  PAGE_SIZE,
  fmtDate,
  fmtDateTime,
  fmtNgn,
} from './inventory-receipts-support';

// ── Modes / presets ───────────────────────────────────────────────────────────

export type StockBrowserMode = 'stock' | 'valuation' | 'count';

const MODE_META: Record<
  StockBrowserMode,
  {
    title: string;
    sub: string;
    csvPrefix: string;
    savedKey: string;
    docTitle: string;
  }
> = {
  stock: {
    title: 'Stock',
    sub: 'Stock on hand per warehouse, product and size',
    csvPrefix: 'inventory-stock',
    savedKey: 'dh-inventory-stock-searches',
    docTitle: 'Stock Report',
  },
  valuation: {
    title: 'Valuation',
    sub: 'What your inventory is worth, line by line at cost basis',
    csvPrefix: 'inventory-valuation',
    savedKey: 'dh-inventory-valuation-searches',
    docTitle: 'Inventory Valuation Report',
  },
  count: {
    title: 'Physical Inventory',
    sub: 'Count stock line by line — applied counts are recorded as adjustments',
    csvPrefix: 'inventory-count',
    savedKey: 'dh-inventory-count-searches',
    docTitle: 'Count Sheet',
  },
};

type StatusKey = 'all' | 'ok' | 'low' | 'out' | 'expiry' | 'over';
const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ok', label: 'In stock' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out' },
  { key: 'expiry', label: 'Near expiry' },
  { key: 'over', label: 'Overstocked' },
];

function statusOf(r: StockRow): Exclude<StatusKey, 'all'> {
  const f = r.flags;
  if (f?.outOfStock || r.currentQuantity <= 0) return 'out';
  if (f?.lowStock) return 'low';
  if (f?.nearExpiry) return 'expiry';
  if (f?.overstocked) return 'over';
  return 'ok';
}
const STATUS_BADGE: Record<
  Exclude<StatusKey, 'all'>,
  { label: string; cls: string }
> = {
  ok: { label: 'In stock', cls: 'bg-emerald-50 text-emerald-600' },
  low: { label: 'Low stock', cls: 'bg-amber-50 text-amber-600' },
  out: { label: 'Out of stock', cls: 'bg-red-50 text-red-600' },
  expiry: { label: 'Near expiry', cls: 'bg-orange-50 text-orange-600' },
  over: { label: 'Overstocked', cls: 'bg-blue-50 text-blue-600' },
};

type SortCol =
  | 'product'
  | 'size'
  | 'warehouse'
  | 'onhand'
  | 'reserved'
  | 'available'
  | 'cost'
  | 'value'
  | 'status';
type SortDir = 'asc' | 'desc';
type GroupKey = 'warehouse' | 'product' | 'status';
interface SavedSearch {
  id: string;
  name: string;
  query: string;
  groupBy: GroupKey | null;
}

const GROUP_LABELS: Record<GroupKey, string> = {
  warehouse: 'Warehouse',
  product: 'Product',
  status: 'Status',
};

function lineValue(r: StockRow) {
  return r.currentQuantity * (r.costPrice || 0);
}
function lineRetail(r: StockRow) {
  return r.currentQuantity * (r.sellingPrice || 0);
}

function loadSavedFor(key: string): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as SavedSearch[];
  } catch {
    return [];
  }
}

// ── Print (stock report) ──────────────────────────────────────────────────────

function printStock(rows: StockRow[], docTitle: string, valuation: boolean) {
  if (rows.length === 0) return;
  const totalUnits = rows.reduce((s, r) => s + r.currentQuantity, 0);
  const totalValue = rows.reduce((s, r) => s + lineValue(r), 0);
  const body = rows
    .map(
      (r) => `<tr>
      <td><strong>${r.productName}</strong> <span class="muted">${r.sku}</span></td>
      <td>${r.sizeName}</td>
      <td>${r.warehouseName}</td>
      <td class="num">${r.currentQuantity}</td>
      <td class="num">${r.reservedQuantity}</td>
      ${valuation ? `<td class="num">${fmtNgn(r.costPrice || 0)}</td><td class="num">${fmtNgn(lineValue(r))}</td>` : `<td>${STATUS_BADGE[statusOf(r)].label}</td>`}
    </tr>`
    )
    .join('');
  const html = `<!doctype html><html><head><title>${docTitle}</title><style>
    * { box-sizing: border-box; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
    body { margin: 32px; color: #111827; }
    h1 { font-size: 18px; margin: 0; } .sub { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b20202; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-weight: 800; color: #b20202; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; text-transform: uppercase; letter-spacing: .04em; font-size: 9px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }
    td { border-bottom: 1px solid #f3f4f6; padding: 7px 8px; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #9ca3af; }
    tfoot td { font-weight: 700; border-top: 2px solid #e5e7eb; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
    <div class="head">
      <div><h1>${docTitle}</h1>
      <p class="sub">${rows.length} line${rows.length === 1 ? '' : 's'} · printed ${fmtDateTime(new Date().toISOString())}</p></div>
      <div class="brand">DRINKSHARBOUR · INVENTORY</div>
    </div>
    <table>
      <thead><tr><th>Product</th><th>Size</th><th>Warehouse</th><th class="num">On hand</th><th class="num">Reserved</th>
        ${valuation ? '<th class="num">Unit Cost</th><th class="num">Value</th>' : '<th>Status</th>'}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="3">Totals</td><td class="num">${totalUnits}</td><td></td>
        ${valuation ? `<td></td><td class="num">${fmtNgn(totalValue)}</td>` : '<td></td>'}</tr></tfoot>
    </table>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function exportStockCsv(rows: StockRow[], prefix: string) {
  const headers = [
    'Product',
    'SKU',
    'Size',
    'Warehouse',
    'On hand',
    'Reserved',
    'Available',
    'Category',
    'Unit Cost',
    'Selling Price',
    'Value',
    'Method',
    'Status',
    'Earliest Expiry',
  ];
  const lines = rows.map((r) =>
    [
      `"${r.productName}"`,
      r.sku,
      `"${r.sizeName}"`,
      `"${r.warehouseName}"`,
      r.currentQuantity,
      r.reservedQuantity,
      r.currentQuantity - r.reservedQuantity,
      `"${r.categoryName ?? 'Uncategorized'}"`,
      (r.costPrice || 0).toFixed(2),
      (r.sellingPrice || 0).toFixed(2),
      lineValue(r).toFixed(2),
      r.valuationMethod ?? '',
      STATUS_BADGE[statusOf(r)].label,
      r.earliestExpiry ? fmtDate(r.earliestExpiry) : '',
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

// ── Group panel ───────────────────────────────────────────────────────────────

function StockGroupPanel({
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
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
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
      style={{ minWidth: 420 }}
    >
      <div className="flex divide-x divide-gray-100">
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
              gkey="product"
              label="Product"
              active={groupBy === 'product'}
              onToggle={onSetGroupBy}
            />
            <GroupItem
              gkey="status"
              label="Status"
              active={groupBy === 'status'}
              onToggle={onSetGroupBy}
            />
          </div>
        </div>
        <div className="flex-1 p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Saved Searches
          </p>
          {!showSaveInput ? (
            <button
              type="button"
              onClick={() => setShowSaveInput(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
            >
              Save current search
            </button>
          ) : (
            <div className="space-y-2 px-1 py-1">
              <input
                autoFocus
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
            </div>
          )}
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
                <span className="truncate">{s.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteSaved(s.id)}
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 hover:text-red-500 group-hover:flex"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function StockDetail({
  row,
  mode,
  onClose,
  onApplied,
}: {
  row: StockRow;
  mode: StockBrowserMode;
  onClose: () => void;
  onApplied: (rowId: string, counted: number) => Promise<void>;
}) {
  const status = STATUS_BADGE[statusOf(row)];
  const [counted, setCounted] = useState('');
  const [applying, setApplying] = useState(false);
  const diff =
    counted === '' || Number.isNaN(Number(counted))
      ? null
      : Number(counted) - row.currentQuantity;

  const infoRows: [string, string][] = [
    ['SKU', row.sku || '—'],
    ['Category', row.categoryName || 'Uncategorized'],
    ['Size', row.sizeName],
    ['Warehouse', row.warehouseName],
    ['Valuation method', (row.valuationMethod ?? '—').toUpperCase()],
    ['Unit cost', fmtNgn(row.costPrice || 0)],
    ['Selling price', fmtNgn(row.sellingPrice || 0)],
    ['Min stock level', String(row.minStockLevel ?? 0)],
    ...(row.earliestExpiry
      ? ([['Earliest expiry', fmtDate(row.earliestExpiry)]] as [
          string,
          string,
        ][])
      : []),
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {row.productName}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {row.sku} · {row.sizeName} · {row.warehouseName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
        >
          <PiX className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            {
              label: 'On hand',
              value: String(row.currentQuantity),
              cls: 'text-gray-900',
            },
            {
              label: 'Reserved',
              value: String(row.reservedQuantity),
              cls: 'text-amber-600',
            },
            {
              label: 'Value',
              value: fmtNgn(lineValue(row)),
              cls: 'text-[#b20202]',
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 border-b border-gray-100 px-5 py-3 text-xs">
          {infoRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <span className="shrink-0 font-semibold text-gray-500">
                {label}
              </span>
              <span className="truncate text-right font-medium text-gray-800">
                {value}
              </span>
            </div>
          ))}
        </div>

        {mode === 'count' && (
          <div className="px-5 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <PiInfo className="h-3.5 w-3.5" /> Apply physical count
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder={String(row.currentQuantity)}
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
              <span
                className={`w-14 text-center text-sm font-bold tabular-nums ${
                  diff === null || diff === 0
                    ? 'text-gray-300'
                    : diff > 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                }`}
              >
                {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
              </span>
              <button
                type="button"
                disabled={applying || diff === null || diff === 0}
                onClick={async () => {
                  setApplying(true);
                  try {
                    await onApplied(row._id, Number(counted));
                    setCounted('');
                  } finally {
                    setApplying(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#b20202] py-2 text-xs font-bold text-white hover:bg-[#9a0101] disabled:opacity-40"
              >
                <PiCheck className="h-3.5 w-3.5" />{' '}
                {applying ? 'Applying…' : 'Apply count'}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Applying sets on-hand to the counted quantity and records an
              adjustment for the audit trail.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main browser ──────────────────────────────────────────────────────────────

/**
 * Stock-line browser in the POS Orders style, shared by the Stock report,
 * Valuation report and Physical Inventory pages via `mode`.
 */
export default function InventoryStockBrowser({
  mode,
}: {
  mode: StockBrowserMode;
}) {
  const meta = MODE_META[mode];
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusKey>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPanel, setShowPanel] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupKey | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [sortCol, setSortCol] = useState<SortCol>('product');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    setSavedSearches(loadSavedFor(meta.savedKey));
  }, [meta.savedKey]);

  const load = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await warehouseStockService.getAllStock(token);
      setRows(res.data ?? []);
      setCounts({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [token, sessionStatus]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);
  useEffect(() => {
    setPage(1);
  }, [search, statusTab, warehouseFilter, categoryFilter, sortCol, sortDir]);

  const warehouses = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.warehouseId, r.warehouseName));
    return Array.from(map.entries(), ([id, name]) => ({ id, name }));
  }, [rows]);

  // Category sidebar entries with line counts and units, from the loaded rows
  // (before the category filter itself so counts stay stable while filtering).
  const categories = useMemo(() => {
    const map = new Map<string, { count: number; units: number }>();
    rows.forEach((r) => {
      const name = r.categoryName || 'Uncategorized';
      const cur = map.get(name) ?? { count: 0, units: 0 };
      cur.count += 1;
      cur.units += r.currentQuantity;
      map.set(name, cur);
    });
    return Array.from(map.entries(), ([name, v]) => ({ name, ...v })).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
  }, [rows]);

  function saveSearch(name: string) {
    const entry: SavedSearch = {
      id: Date.now().toString(),
      name,
      query: search,
      groupBy,
    };
    const updated = [...savedSearches, entry];
    setSavedSearches(updated);
    localStorage.setItem(meta.savedKey, JSON.stringify(updated));
  }
  function deleteSaved(id: string) {
    const updated = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem(meta.savedKey, JSON.stringify(updated));
  }

  async function applyCount(rowId: string, counted: number) {
    const row = rows.find((r) => r._id === rowId);
    if (!row) return;
    if (counted < 0 || Number.isNaN(counted)) {
      toast.error('Enter a valid counted quantity');
      return;
    }
    if (counted === row.currentQuantity) {
      toast('Counted quantity matches on-hand');
      return;
    }
    try {
      await warehouseStockService.adjustStock(
        row.warehouseId,
        {
          subProduct: row.subProductId,
          size: row.sizeId,
          quantity: counted,
          type: 'adjusted',
          notes: `Physical inventory count (was ${row.currentQuantity})`,
        },
        token
      );
      toast.success(`${row.productName}: on-hand set to ${counted}`);
      setRows((prev) =>
        prev.map((r) =>
          r._id === rowId ? { ...r, currentQuantity: counted } : r
        )
      );
      setCounts((prev) => {
        const n = { ...prev };
        delete n[rowId];
        return n;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply count');
      throw err;
    }
  }

  function clearAllFilters() {
    setSearch('');
    setStatusTab('all');
    setWarehouseFilter('');
    setCategoryFilter('all');
    setGroupBy(null);
  }

  const filtered = useMemo(() => {
    let list = [...rows];
    if (statusTab !== 'all')
      list = list.filter((r) => statusOf(r) === statusTab);
    if (warehouseFilter)
      list = list.filter((r) => r.warehouseId === warehouseFilter);
    if (categoryFilter !== 'all')
      list = list.filter(
        (r) => (r.categoryName || 'Uncategorized') === categoryFilter
      );
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [
          r.productName,
          r.sku,
          r.sizeName,
          r.warehouseName,
          r.categoryName,
        ].some((v) => v?.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'product':
          cmp = a.productName.localeCompare(b.productName);
          break;
        case 'size':
          cmp = a.sizeName.localeCompare(b.sizeName);
          break;
        case 'warehouse':
          cmp = a.warehouseName.localeCompare(b.warehouseName);
          break;
        case 'onhand':
          cmp = a.currentQuantity - b.currentQuantity;
          break;
        case 'reserved':
          cmp = a.reservedQuantity - b.reservedQuantity;
          break;
        case 'available':
          cmp =
            a.currentQuantity -
            a.reservedQuantity -
            (b.currentQuantity - b.reservedQuantity);
          break;
        case 'cost':
          cmp = (a.costPrice || 0) - (b.costPrice || 0);
          break;
        case 'value':
          cmp = lineValue(a) - lineValue(b);
          break;
        case 'status':
          cmp = statusOf(a).localeCompare(statusOf(b));
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [
    rows,
    statusTab,
    warehouseFilter,
    categoryFilter,
    search,
    sortCol,
    sortDir,
  ]);

  const stats = useMemo(() => {
    const units = filtered.reduce((s, r) => s + r.currentQuantity, 0);
    const reserved = filtered.reduce((s, r) => s + r.reservedQuantity, 0);
    const value = filtered.reduce((s, r) => s + lineValue(r), 0);
    const retail = filtered.reduce((s, r) => s + lineRetail(r), 0);
    const alerts = filtered.filter((r) =>
      ['low', 'out', 'expiry'].includes(statusOf(r))
    ).length;
    const whSet = new Set(filtered.map((r) => r.warehouseId));
    return {
      count: filtered.length,
      units,
      reserved,
      value,
      retail,
      alerts,
      warehouses: whSet.size,
    };
  }, [filtered]);

  const grouped = useMemo((): [string, StockRow[]][] | null => {
    if (!groupBy) return null;
    const map = new Map<string, StockRow[]>();
    filtered.forEach((r) => {
      const key =
        groupBy === 'warehouse'
          ? r.warehouseName
          : groupBy === 'product'
            ? r.productName
            : STATUS_BADGE[statusOf(r)].label;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = grouped
    ? []
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const displayList = grouped ? filtered : paginated;
  const totalFilteredValue = filtered.reduce((s, r) => s + lineValue(r), 0);

  const allChecked =
    displayList.length > 0 && displayList.every((r) => checked.has(r._id));
  const someChecked = checked.size > 0 && !allChecked;
  const checkedRows = rows.filter((r) => checked.has(r._id));
  const selected = rows.find((r) => r._id === selectedId) ?? null;

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(displayList.map((r) => r._id)));
  }
  function toggleOne(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir(['onhand', 'value', 'cost'].includes(col) ? 'desc' : 'asc');
    }
  }
  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  const hasAnyFilter =
    !!search ||
    !!warehouseFilter ||
    statusTab !== 'all' ||
    categoryFilter !== 'all' ||
    !!groupBy;

  const HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
    { col: 'product', label: 'Product' },
    { col: 'size', label: 'Size' },
    { col: 'warehouse', label: 'Warehouse' },
    { col: 'onhand', label: 'On hand', right: true },
    { col: 'reserved', label: 'Reserved', right: true },
    ...(mode === 'valuation'
      ? ([
          { col: 'cost', label: 'Unit cost', right: true },
          { col: 'value', label: 'Value', right: true },
        ] as const)
      : mode === 'stock'
        ? ([
            { col: 'available', label: 'Available', right: true },
            { col: 'cost', label: 'Unit cost', right: true },
            { col: 'value', label: 'Total value', right: true },
          ] as const)
        : ([{ col: 'available', label: 'Available', right: true }] as const)),
    { col: 'status', label: 'Status' },
  ];
  const colCount = HEADERS.length + (mode === 'count' ? 4 : 2);

  function renderRow(r: StockRow, isSel: boolean) {
    const isChk = checked.has(r._id);
    const st = STATUS_BADGE[statusOf(r)];
    const raw = counts[r._id];
    const counted = raw === undefined || raw === '' ? null : Number(raw);
    const diff =
      counted === null || Number.isNaN(counted)
        ? null
        : counted - r.currentQuantity;
    return (
      <tr
        key={r._id}
        className={`cursor-pointer border-b border-gray-100/80 transition-colors ${
          isSel
            ? 'bg-[#b20202] text-white'
            : isChk
              ? 'border-l-2 border-l-[#b20202] bg-[#b20202]/5'
              : 'border-l-2 border-l-transparent hover:bg-gray-50/80'
        }`}
      >
        <td
          className="w-8 px-2 py-2.5 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => toggleOne(r._id)}
            className="text-gray-300 transition-colors hover:text-[#b20202]"
          >
            {isChk ? (
              <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
            ) : (
              <PiSquare className="h-4 w-4" />
            )}
          </button>
        </td>
        <td
          className="max-w-[200px] px-3 py-2.5"
          onClick={() => setSelectedId(isSel ? null : r._id)}
        >
          <div
            className={`truncate text-xs font-semibold ${isSel ? 'text-white' : 'text-gray-800'}`}
          >
            {r.productName}
          </div>
          <div
            className={`truncate font-mono text-[10px] ${isSel ? 'text-red-200' : 'text-gray-400'}`}
          >
            {r.sku}
          </div>
        </td>
        <td
          className={`px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={() => setSelectedId(isSel ? null : r._id)}
        >
          {r.sizeName}
        </td>
        <td
          className={`px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={() => setSelectedId(isSel ? null : r._id)}
        >
          {r.warehouseName}
        </td>
        <td
          className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : 'text-gray-900'}`}
          onClick={() => setSelectedId(isSel ? null : r._id)}
        >
          {r.currentQuantity}
        </td>
        <td
          className={`px-3 py-2.5 text-right text-xs tabular-nums ${isSel ? 'text-red-100' : 'text-gray-500'}`}
          onClick={() => setSelectedId(isSel ? null : r._id)}
        >
          {r.reservedQuantity}
        </td>
        {mode === 'valuation' ? (
          <>
            <td
              className={`px-3 py-2.5 text-right text-xs tabular-nums ${isSel ? 'text-red-100' : 'text-gray-600'}`}
              onClick={() => setSelectedId(isSel ? null : r._id)}
            >
              {fmtNgn(r.costPrice || 0)}
            </td>
            <td
              className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : 'text-gray-900'}`}
              onClick={() => setSelectedId(isSel ? null : r._id)}
            >
              {fmtNgn(lineValue(r))}
            </td>
          </>
        ) : (
          <>
            <td
              className={`px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${isSel ? 'text-white' : 'text-gray-700'}`}
              onClick={() => setSelectedId(isSel ? null : r._id)}
            >
              {r.currentQuantity - r.reservedQuantity}
            </td>
            {mode === 'stock' && (
              <>
                <td
                  className={`px-3 py-2.5 text-right text-xs tabular-nums ${isSel ? 'text-red-100' : 'text-gray-600'}`}
                  onClick={() => setSelectedId(isSel ? null : r._id)}
                >
                  {fmtNgn(r.costPrice || 0)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : 'text-gray-900'}`}
                  onClick={() => setSelectedId(isSel ? null : r._id)}
                >
                  {fmtNgn(lineValue(r))}
                </td>
              </>
            )}
          </>
        )}
        <td
          className="px-3 py-2.5"
          onClick={() => setSelectedId(isSel ? null : r._id)}
        >
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isSel ? 'bg-white/20 text-white' : st.cls}`}
          >
            {st.label}
          </span>
        </td>
        {mode === 'count' && (
          <>
            <td
              className="px-3 py-2 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="number"
                min={0}
                value={raw ?? ''}
                placeholder={String(r.currentQuantity)}
                onChange={(e) =>
                  setCounts((prev) => ({ ...prev, [r._id]: e.target.value }))
                }
                className={`w-20 rounded-lg border px-2 py-1 text-right text-xs focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20 ${isSel ? 'border-white/40 bg-white/10 text-white placeholder-red-200' : 'border-gray-200 text-gray-900'}`}
              />
            </td>
            <td
              className={`px-2 py-2.5 text-right text-xs font-bold tabular-nums ${
                diff === null || diff === 0
                  ? isSel
                    ? 'text-red-200'
                    : 'text-gray-300'
                  : diff > 0
                    ? 'text-emerald-500'
                    : isSel
                      ? 'text-white'
                      : 'text-red-600'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {diff === null || Number.isNaN(diff)
                ? '—'
                : diff > 0
                  ? `+${diff}`
                  : diff}
            </td>
            <td
              className="w-16 px-2 py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={diff === null || Number.isNaN(diff) || diff === 0}
                onClick={() => applyCount(r._id, Number(raw))}
                className="rounded-lg bg-[#b20202] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#9a0101] disabled:opacity-30"
              >
                Apply
              </button>
            </td>
          </>
        )}
        {mode !== 'count' && (
          <td
            className="w-8 px-2 py-2.5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                printStock([r], meta.docTitle, mode === 'valuation')
              }
              className={`transition-colors ${isSel ? 'text-white/50 hover:text-white' : 'text-gray-300 hover:text-[#b20202]'}`}
            >
              <PiPrinter className="h-3.5 w-3.5" />
            </button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-47px)] flex-col overflow-hidden bg-gray-50">
      {/* ── Control bar ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4 border-b border-gray-100 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-gray-900">
              {meta.title}
            </h1>
            <p className="mt-0.5 text-[11px] text-gray-400">
              <span className="font-medium text-gray-600">
                {filtered.length.toLocaleString()}
              </span>{' '}
              shown
              {filtered.length !== rows.length && (
                <span> of {rows.length.toLocaleString()} lines</span>
              )}
              <span className="ml-1">· {meta.sub}</span>
            </p>
          </div>

          {/* Status tabs */}
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setStatusTab(t.key);
                  setSelectedId(null);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  statusTab === t.key
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPanel((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showPanel || groupBy
                    ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PiStack className="h-3.5 w-3.5" />
                {groupBy ? `Group: ${GROUP_LABELS[groupBy]}` : 'Group By'}
                {showPanel ? (
                  <PiCaretUp className="h-3 w-3" />
                ) : (
                  <PiCaretDown className="h-3 w-3" />
                )}
              </button>
              {showPanel && (
                <StockGroupPanel
                  groupBy={groupBy}
                  savedSearches={savedSearches}
                  onSetGroupBy={setGroupBy}
                  onSave={saveSearch}
                  onLoadSaved={(s) => {
                    setSearch(s.query);
                    setGroupBy(s.groupBy);
                    setPage(1);
                  }}
                  onDeleteSaved={deleteSaved}
                  onClose={() => setShowPanel(false)}
                />
              )}
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() =>
                printStock(filtered, meta.docTitle, mode === 'valuation')
              }
              disabled={filtered.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-[#b20202] disabled:opacity-40"
              title={`Print ${meta.docTitle.toLowerCase()}`}
            >
              <PiPrinter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => exportStockCsv(filtered, meta.csvPrefix)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-end gap-3 px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Warehouse
            </span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mx-1 mt-5 w-px self-stretch bg-gray-100" />

          <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Search
            </span>
            <div className="relative">
              <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedId(null);
                }}
                placeholder="Product, SKU, size, warehouse…"
                className="h-[34px] w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <PiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {hasAnyFilter && (
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex h-[34px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-100"
              >
                <PiX className="h-3.5 w-3.5" /> Clear all
              </button>
            </div>
          )}

          {!groupBy && totalPages > 1 && (
            <div className="ml-auto flex items-end gap-1">
              <div className="flex h-[34px] items-center gap-1">
                <span className="px-1 text-[11px] text-gray-400">
                  {page}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <PiCaretLeft className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <PiCaretRight className="h-3.5 w-3.5 text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid shrink-0 grid-cols-5 divide-x divide-gray-200 border-b border-gray-200 bg-white">
        {[
          {
            label: 'Stock Lines',
            value: stats.count.toLocaleString(),
            icon: <PiCube className="h-4 w-4" />,
            color: 'text-blue-600',
            sub: `${stats.warehouses} warehouses`,
          },
          {
            label: 'Units On Hand',
            value: stats.units.toLocaleString(),
            icon: <PiStack className="h-4 w-4" />,
            color: 'text-emerald-600',
            sub: `${stats.reserved.toLocaleString()} reserved`,
          },
          {
            label: 'Stock Value',
            value: fmtNgn(stats.value),
            icon: <PiCurrencyNgn className="h-4 w-4" />,
            color: 'text-[#b20202]',
            sub: 'at cost basis',
          },
          {
            label: 'Retail Value',
            value: fmtNgn(stats.retail),
            icon: <PiCurrencyNgn className="h-4 w-4" />,
            color: 'text-purple-600',
            sub: `${fmtNgn(Math.max(0, stats.retail - stats.value))} potential profit`,
          },
          {
            label: 'Alerts',
            value: stats.alerts.toLocaleString(),
            icon: <PiWarningCircle className="h-4 w-4" />,
            color: 'text-amber-500',
            sub: 'low / out / near expiry',
          },
        ].map(({ label, value, icon, color, sub }) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 ${color}`}>{icon}</span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
                {value}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category sidebar */}
        <aside className="hidden w-52 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white lg:flex">
          <p className="shrink-0 border-b border-gray-100 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Categories
          </p>
          <div className="flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-[#b20202] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>All Categories</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                  categoryFilter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {rows.length}
              </span>
            </button>
            {categories.map((c) => {
              const active = categoryFilter === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(active ? 'all' : c.name);
                    setSelectedId(null);
                  }}
                  className={`mt-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                    active
                      ? 'bg-[#b20202] font-semibold text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {c.name}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] tabular-nums ${active ? 'text-red-100' : 'text-gray-400'}`}
                  >
                    {c.units.toLocaleString()} u
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div
          className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected ? 'w-[58%]' : 'flex-1'}`}
        >
          {checked.size > 0 && (
            <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#b20202] bg-white px-4 py-2.5">
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="font-bold text-[#b20202]">{checked.size}</span>{' '}
                selected ·{' '}
                <span className="font-bold text-gray-900">
                  {fmtNgn(checkedRows.reduce((s, r) => s + lineValue(r), 0))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() =>
                  printStock(checkedRows, meta.docTitle, mode === 'valuation')
                }
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#9a0101]"
              >
                <PiPrinter className="h-3.5 w-3.5" />
                Print{' '}
                {checked.size > 1 ? `${checked.size} Lines` : meta.docTitle}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex-1 overflow-hidden pt-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-gray-50 px-4 py-2.5"
                >
                  <div className="h-3 w-3 shrink-0 animate-pulse rounded bg-gray-100" />
                  {[130, 60, 90, 50, 50, 50, 60].map((w, j) => (
                    <div
                      key={j}
                      className="h-3.5 animate-pulse rounded-md bg-gray-100"
                      style={{ width: w }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <PiCube className="h-8 w-8 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  {search
                    ? `No stock lines matching "${search}"`
                    : 'No stock lines match the filters'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Try another warehouse or clear the filters
                </p>
              </div>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-[#b20202] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-gray-300 transition-colors hover:text-[#b20202]"
                      >
                        {allChecked ? (
                          <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                        ) : someChecked ? (
                          <PiCheckSquare className="h-4 w-4 text-gray-400" />
                        ) : (
                          <PiSquare className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    {HEADERS.map(({ col, label, right }) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className={`cursor-pointer select-none px-3 py-3 transition-colors hover:text-gray-600 ${right ? 'text-right' : ''}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <SortIcon
                            col={col}
                            sortCol={sortCol}
                            sortDir={sortDir}
                          />
                        </span>
                      </th>
                    ))}
                    {mode === 'count' ? (
                      <>
                        <th className="px-3 py-3 text-right">Counted</th>
                        <th className="px-2 py-3 text-right">Diff</th>
                        <th className="w-16 px-2 py-3" />
                      </>
                    ) : (
                      <th className="w-8 px-2 py-3" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {grouped
                    ? grouped.map(([groupName, groupRows]) => {
                        const isCollapsed = !expandedGroups.has(groupName);
                        const groupValue = groupRows.reduce(
                          (s, r) => s + lineValue(r),
                          0
                        );
                        const groupUnits = groupRows.reduce(
                          (s, r) => s + r.currentQuantity,
                          0
                        );
                        const share =
                          totalFilteredValue > 0
                            ? (groupValue / totalFilteredValue) * 100
                            : 0;
                        return (
                          <React.Fragment key={`group-${groupName}`}>
                            <tr
                              className="cursor-pointer select-none border-b border-gray-200 bg-gray-50/80 transition-colors hover:bg-gray-100"
                              onClick={() => toggleGroup(groupName)}
                            >
                              <td colSpan={colCount} className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <PiCaretRight
                                    className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                                  />
                                  <span className="text-xs font-semibold text-gray-700">
                                    {groupName}
                                  </span>
                                  <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-gray-500">
                                    {groupRows.length}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-gray-500">
                                    {groupUnits.toLocaleString()} units
                                  </span>
                                  <div className="ml-1 flex max-w-[180px] flex-1 items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                                      <div
                                        className="h-full rounded-full bg-[#b20202] transition-all"
                                        style={{
                                          width: `${Math.min(100, share)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-9 text-right text-[10px] tabular-nums text-gray-400">
                                      {share.toFixed(1)}%
                                    </span>
                                  </div>
                                  <span className="ml-auto text-xs font-bold tabular-nums text-gray-800">
                                    {fmtNgn(groupValue)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed &&
                              groupRows.map((r) =>
                                renderRow(r, selectedId === r._id)
                              )}
                          </React.Fragment>
                        );
                      })
                    : paginated.map((r) => renderRow(r, selectedId === r._id))}
                </tbody>
              </table>
            </div>
          )}

          {!groupBy && totalPages > 1 && !loading && (
            <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5">
              <span className="text-[11px] text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length.toLocaleString()}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors ${
                        p === page
                          ? 'border-[#b20202] bg-[#b20202] text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div
          className={`flex flex-col bg-white transition-all duration-200 ${selected ? 'flex-1 overflow-hidden' : 'w-72 shrink-0'}`}
        >
          {selected ? (
            <StockDetail
              row={selected}
              mode={mode}
              onClose={() => setSelectedId(null)}
              onApplied={applyCount}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner">
                <PiBuildings className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Select a stock line
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Click any row to view its details
                  {mode === 'count' ? (
                    <>
                      <br />
                      and apply a physical count
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
