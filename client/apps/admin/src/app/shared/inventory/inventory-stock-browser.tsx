'use client';

import React, {
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
  PiCheckSquare,
  PiCube,
  PiCurrencyNgn,
  PiDownloadSimple,
  PiMagnifyingGlass,
  PiPrinter,
  PiSquare,
  PiStack,
  PiTag,
  PiUploadSimple,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import { SortIcon } from '@/components/list-controls';
import ValuationNote from './inventory-valuation-note';
import {
  warehouseStockService,
  type StockRow,
} from '@/services/warehouseStock.service';
import type {
  CustomGroup,
  FilterValue,
  SavedSearch as AdvSavedSearch,
} from '../advanced-search/advanced-search-types';
import StockProductFilter from './inventory-stock-product-filter';
import StockProductLink from './inventory-stock-product-link';
import {
  stockViewTotals, stockViewCSV, toggleStockPage, visibleStockSelection,
} from './inventory-stock-view';
import { finite } from './inventory-dashboard-analysis';
import { restoreStockView, type StockViewSettings } from './inventory-stock-saved-view';
import StockDetail from './inventory-stock-detail-panel';
import { useInventoryStockData } from './use-inventory-stock-data';
import InventoryStockImport from './inventory-stock-import';
import InventoryStockFilterPanel from './inventory-stock-filter-panel';
import { buildStockDoc } from '@/utils/print/stock-print';
import { requestDocumentExport } from '@/utils/print/document-export';
import PricelistPrintModal from './inventory-pricelist-print-modal';
import {
  PAGE_SIZE,
  fmtNgn,
} from './inventory-receipts-support';
// Every search / filter / sort / group decision lives in this module, as pure
// functions with tests. It used to live inline here, where the admin's
// `environment: 'node'` vitest could not reach it — and four wrong answers were
// hiding in that blind spot.
import {
  STATUS_BADGE,
  STOCK_GROUP_OPTIONS,
  applyStockFilters,
  availableOf,
  categoryOf,
  expiryRange,
  groupStockRows,
  lineValue,
  carryingCostOf,
  matchesExpiryRange,
  matchesStatusSet,
  parseStockQuerySet,
  resolveStockFilters,
  searchStockRowSet,
  sortStockRows,
  statusOf,
  type SortCol,
  type SortDir,
  type StatusKey,
} from './inventory-stock-search';

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

/**
 * The exclusive tab row. `null` is "All".
 *
 * Status is held in ONE `Set<StatusKey>` shared with the advanced-search
 * panel's checkboxes, so the two controls cannot disagree: empty set = All,
 * exactly one member = that tab is lit, two or more = All is lit and the
 * selection shows as chips in the search bar.
 */
const STATUS_TABS: { key: StatusKey | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'ok', label: 'In stock' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out' },
  { key: 'expiry', label: 'Near expiry' },
  { key: 'over', label: 'Overstocked' },
];

/**
 * A saved search restores the whole view, not just the text. The previous
 * version stored only the query and the grouping, so loading one left the
 * status tab, warehouse and category wherever the user happened to have them —
 * a "saved search" that returned different rows each time it was applied.
 */
interface StockSavedSearch extends AdvSavedSearch, StockViewSettings {
  /** Committed search chips — the multi-item part of the query. */
  searchTerms?: string[];
  statuses?: StatusKey[];
  warehouseId?: string;
  category?: string;
  expiryPreset?: string | null;
}

function loadSavedFor(key: string): StockSavedSearch[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(key) || '[]'
    ) as StockSavedSearch[];
    if (!Array.isArray(parsed)) return [];
    // Entries written before this shape existed carry `query` instead of
    // `search` and no filters; normalise rather than dropping the user's work.
    return parsed.map((s) => ({
      ...s,
      search: s.search ?? (s as unknown as { query?: string }).query ?? '',
      filters: Array.isArray(s.filters) ? s.filters : [],
      groupBy: typeof s.groupBy === 'string' ? s.groupBy : '',
    }));
  } catch {
    return [];
  }
}

const CUSTOM_GROUP_KEY = 'dh-inventory-stock-custom-groups';
const UNASSIGNED_WAREHOUSE = '__unassigned__';

// ── Print (stock report) ──────────────────────────────────────────────────────

function printStock(rows: StockRow[], docTitle: string, valuation: boolean) {
  if (rows.length)
    requestDocumentExport(buildStockDoc(rows, docTitle, valuation));
}

function exportStockCsv(rows: StockRow[], prefix: string) {
  const csv = stockViewCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Detail panel ──────────────────────────────────────────────────────────────

export default function InventoryStockBrowser({
  mode,
}: {
  mode: StockBrowserMode;
}) {
  const meta = MODE_META[mode];
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const { rows, loading, error, load } = useInventoryStockData(token, sessionStatus, mode);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // Filtering runs over every loaded row, so it keys off the debounced value —
  // the previous version re-filtered, re-scored and re-sorted on every
  // keystroke, and re-parsed the query a third time inside the JSX.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Committed search chips — one per Enter. They OR, so several products can be
  // looked up at once; terms inside one chip still AND, so a chip can narrow.
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<Set<StatusKey>>(new Set());
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPanel, setShowPanel] = useState(false);
  const [groupBy, setGroupBy] = useState<string>('');
  const [rawFilters, setRawFilters] = useState<FilterValue[]>([]);
  const [expiryPreset, setExpiryPreset] = useState<string | null>(null);
  const [expiryFrom, setExpiryFrom] = useState('');
  const [expiryTo, setExpiryTo] = useState('');
  const [savedSearches, setSavedSearches] = useState<StockSavedSearch[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const restoredSort = useRef<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>('product');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [showImport, setShowImport] = useState(false);
  const [showPricelist, setShowPricelist] = useState(false);
  // Rows captured when the pricelist modal is opened (selection or filtered view).
  const [pricelistRows, setPricelistRows] = useState<StockRow[]>([]);

  useEffect(() => {
    setSavedSearches(loadSavedFor(meta.savedKey));
    try {
      const raw = localStorage.getItem(CUSTOM_GROUP_KEY);
      setCustomGroups(raw ? (JSON.parse(raw) as CustomGroup[]) : []);
    } catch {
      setCustomGroups([]);
    }
  }, [meta.savedKey]);

  useEffect(() => {
    if (!loading) setCounts({});
  }, [rows, loading]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    searchTerms,
    productIds,
    statusSel,
    warehouseFilter,
    categoryFilter,
    rawFilters,
    expiryPreset,
    expiryFrom,
    expiryTo,
    sortCol,
    sortDir,
  ]);

  // Parsed exactly once per change and reused by the ranking, the sort and the
  // hint line. The half-typed input is included as a pending chip, so what the
  // table shows before Enter is exactly what committing it will keep.
  const querySet = useMemo(
    () => parseStockQuerySet([...searchTerms, debouncedSearch]),
    [searchTerms, debouncedSearch]
  );

  // A new query ranks by relevance ("best match"); the user can still pin a
  // column afterwards, because this only fires when the query itself changes.
  // Clearing the query MUST release the pin: `relevance` with nothing to rank
  // used to leave the comparator returning 0 for every pair, so the table went
  // silently unsorted.
  useEffect(() => {
    const restored = restoredSort.current === JSON.stringify(querySet);
    restoredSort.current = null;
    if (restored) return;
    if (querySet.hasQuery) setSortCol('relevance');
    else setSortCol((c) => (c === 'relevance' ? 'product' : c));
  }, [querySet]);

  const warehouses = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.warehouseId) map.set(r.warehouseId, r.warehouseName);
    });
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
      cur.units += finite(r.currentQuantity);
      map.set(name, cur);
    });
    return Array.from(map.entries(), ([name, v]) => ({ name, ...v })).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
  }, [rows]);

  function persistSaved(next: StockSavedSearch[]) {
    setSavedSearches(next);
    localStorage.setItem(meta.savedKey, JSON.stringify(next));
  }
  /** Saves the whole view — text, filters, grouping, status, warehouse, category. */
  function saveSearch(name: string) {
    persistSaved([
      ...savedSearches,
      {
        id: Date.now().toString(),
        name,
        search,
        searchTerms,
        filters: rawFilters,
        groupBy,
        statuses: Array.from(statusSel),
        warehouseId: warehouseFilter,
        category: categoryFilter,
        expiryPreset,
        productIds, expiryFrom, expiryTo, sortCol, sortDir,
      },
    ]);
  }
  function applySaved(s: AdvSavedSearch) {
    const saved = savedSearches.find((x) => x.id === s.id);
    restoredSort.current = JSON.stringify(parseStockQuerySet([...(saved?.searchTerms ?? []), s.search ?? '']));
    setSearch(s.search ?? '');
    setDebouncedSearch(s.search ?? '');
    setSearchTerms(saved?.searchTerms ?? []);
    setRawFilters(s.filters ?? []);
    setGroupBy(s.groupBy ?? '');
    setStatusSel(new Set(saved?.statuses ?? []));
    setWarehouseFilter(saved?.warehouseId ?? '');
    setCategoryFilter(saved?.category ?? 'all');
    setExpiryPreset(saved?.expiryPreset ?? null);
    const view = restoreStockView(saved ?? {});
    setProductIds(view.productIds);
    setExpiryFrom(view.expiryFrom);
    setExpiryTo(view.expiryTo);
    setSortCol(view.sortCol);
    setSortDir(view.sortDir);
    setPage(1);
    setShowPanel(false);
  }
  function deleteSaved(id: string) {
    persistSaved(savedSearches.filter((s) => s.id !== id));
  }

  function persistCustomGroups(next: CustomGroup[]) {
    setCustomGroups(next);
    localStorage.setItem(CUSTOM_GROUP_KEY, JSON.stringify(next));
  }

  /**
   * Enter commits what was typed as a chip. Committing is a no-op for blank
   * input or a duplicate — an "everything" chip would OR the whole table back
   * in, and a repeated chip would just widen the bar without widening the result.
   */
  function commitSearchTerm() {
    const t = search.trim();
    if (!t) return;
    if (!searchTerms.includes(t)) setSearchTerms((p) => [...p, t]);
    setSearch('');
    setDebouncedSearch('');
    setSelectedId(null);
  }

  function toggleStatus(key: StatusKey) {
    setStatusSel((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
    setSelectedId(null);
  }
  /** The tab row is exclusive: it replaces the selection rather than adding. */
  function pickStatusTab(key: StatusKey | null) {
    setStatusSel((prev) =>
      key === null || (prev.size === 1 && prev.has(key))
        ? new Set()
        : new Set([key])
    );
    setSelectedId(null);
  }

  async function applyCount(rowId: string, counted: number) {
    const row = rows.find((r) => r._id === rowId);
    if (!row) return;
    if (counted < 0 || !Number.isFinite(counted)) {
      toast.error('Enter a valid counted quantity');
      return;
    }
    if (!row.warehouseId || !row.sizeId) {
      toast.error('Choose a warehouse and size before counting stock');
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
      await load();
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
    setDebouncedSearch('');
    setSearchTerms([]);
    setProductIds([]);
    setStatusSel(new Set());
    setWarehouseFilter('');
    setCategoryFilter('all');
    setGroupBy('');
    setRawFilters([]);
    setExpiryPreset(null);
    setExpiryFrom('');
    setExpiryTo('');
  }

  // A filter naming a field this build no longer knows is dropped and named —
  // a saved search that silently returned zero rows would look like an honest
  // empty result.
  const { valid: activeFilters, dropped: droppedFilters } = useMemo(
    () => resolveStockFilters(rawFilters),
    [rawFilters]
  );

  /** The expiry window, from a preset or from an explicit custom range. */
  const expiryWindow = useMemo((): [Date, Date] | null => {
    if (expiryPreset && expiryPreset !== 'custom')
      return expiryRange(expiryPreset);
    if (!expiryFrom && !expiryTo) return null;
    return [
      expiryFrom ? new Date(`${expiryFrom}T00:00:00`) : new Date(0),
      expiryTo
        ? new Date(`${expiryTo}T23:59:59.999`)
        : new Date(8_640_000_000_000_000),
    ];
  }, [expiryPreset, expiryFrom, expiryTo]);

  // Narrow first, rank second: scoring is the expensive step, so it runs over
  // the smallest set the cheap predicates can produce.
  const searchResult = useMemo(() => {
    let list = productIds.length ? rows.filter(row => productIds.includes(row.subProductId)) : rows;
    if (statusSel.size > 0)
      list = list.filter((r) => matchesStatusSet(r, statusSel));
    if (warehouseFilter)
      list = list.filter((r) =>
        warehouseFilter === UNASSIGNED_WAREHOUSE
          ? !r.warehouseId
          : r.warehouseId === warehouseFilter
      );
    if (categoryFilter !== 'all')
      list = list.filter((r) => categoryOf(r) === categoryFilter);
    if (expiryWindow)
      list = list.filter((r) => matchesExpiryRange(r, expiryWindow));
    if (activeFilters.length > 0) list = applyStockFilters(list, activeFilters);
    return searchStockRowSet(list, querySet);
  }, [
    rows,
    productIds,
    statusSel,
    warehouseFilter,
    categoryFilter,
    expiryWindow,
    activeFilters,
    querySet,
  ]);

  const filtered = useMemo(
    () =>
      sortStockRows(searchResult.rows, sortCol, sortDir, searchResult.scores, mode === 'valuation'),
    [searchResult, sortCol, sortDir, mode]
  );

  const stats = useMemo(() => stockViewTotals(filtered), [filtered]);

  const grouped = useMemo((): [string, StockRow[]][] | null => {
    if (!groupBy) return null;
    return groupStockRows(filtered, groupBy);
  }, [filtered, groupBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(current => Math.min(current, totalPages)); }, [totalPages]);
  useEffect(() => {
    setChecked(current => {
      const visible = new Set(visibleStockSelection(filtered, current).map(row => row._id));
      return visible.size === current.size ? current : visible;
    });
  }, [filtered]);
  const paginated = grouped
    ? []
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const displayList = grouped ? filtered : paginated;
  const totalFilteredValue = filtered.reduce((s, r) => s + lineValue(r), 0);

  const allChecked =
    displayList.length > 0 && displayList.every((r) => checked.has(r._id));
  const someChecked = checked.size > 0 && !allChecked;
  const checkedRows = visibleStockSelection(filtered, checked);
  const selected = filtered.find((r) => r._id === selectedId) ?? null;

  function toggleAll() {
    setChecked(current => toggleStockPage(current, displayList));
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
    productIds.length > 0 ||
    !!search ||
    searchTerms.length > 0 ||
    !!warehouseFilter ||
    statusSel.size > 0 ||
    categoryFilter !== 'all' ||
    !!groupBy ||
    rawFilters.length > 0 ||
    !!expiryPreset ||
    !!expiryFrom ||
    !!expiryTo;

  const groupLabel = STOCK_GROUP_OPTIONS.find((g) => g.id === groupBy)?.label;

  const HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
    { col: 'product', label: 'Product' },
    { col: 'size', label: 'Size' },
    { col: 'warehouse', label: 'Warehouse' },
    { col: 'onhand', label: 'On hand', right: true },
    { col: 'reserved', label: 'Reserved', right: true },
    ...(mode === 'valuation'
      ? ([
          { col: 'available', label: 'Available', right: true },
          { col: 'method', label: 'Method' },
          { col: 'cost', label: 'Avg. carrying cost', right: true },
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
      counted === null || !Number.isFinite(counted)
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
            aria-label={`Select stock line ${r.productName} ${r.warehouseName} ${r.sizeName}`}
            aria-pressed={isChk}
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
            <StockProductLink id={r.subProductId} name={r.productName} />
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
            <td className={`px-3 py-2.5 text-right text-xs tabular-nums ${isSel ? 'text-red-100' : 'text-gray-600'}`} onClick={() => setSelectedId(isSel ? null : r._id)}>{availableOf(r)}</td>
            <td className={`px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`} onClick={() => setSelectedId(isSel ? null : r._id)}>
              <span className="font-semibold uppercase">{r.valuationMethod || 'standard'}</span>
              {r.valuationSource && <p className="mt-0.5 text-[10px]">{r.valuationSource === 'batches' ? 'Captured batches' : r.valuationSource === 'mixed' ? 'Includes estimates' : r.valuationSource === 'unpriced' ? 'No cost recorded' : 'Standard fallback'}</p>}
            </td>
            <td
              className={`px-3 py-2.5 text-right text-xs tabular-nums ${isSel ? 'text-red-100' : 'text-gray-600'}`}
              onClick={() => setSelectedId(isSel ? null : r._id)}
            >
              {fmtNgn(carryingCostOf(r))}
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
              {availableOf(r)}
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
              {diff === null || !Number.isFinite(diff)
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
                disabled={diff === null || !Number.isFinite(diff) || diff === 0}
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
    <div className="w-full">
    <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      {/* ── Control bar ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-100 px-4 pb-2.5 pt-3 sm:px-5 sm:gap-x-4 sm:gap-y-2 sm:pb-3 sm:pt-4">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
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
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-0.5 sm:flex-none">
            {STATUS_TABS.map((t) => {
              // "All" is lit whenever the selection is not exactly one status —
              // so a multi-status selection made in the panel reads as All here
              // and shows itself as chips, rather than lighting an arbitrary tab.
              const active =
                t.key === null
                  ? statusSel.size !== 1
                  : statusSel.size === 1 && statusSel.has(t.key);
              return (
                <button
                  key={t.key ?? 'all'}
                  type="button"
                  onClick={() => pickStatusTab(t.key)}
                  aria-pressed={active}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#b20202] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            {/* Group-by and saved searches now live in the advanced-search
                panel below, opened from the search bar itself. */}
            <button
              type="button"
              aria-label="Refresh stock"
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
              disabled={loading || !!error || filtered.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-[#b20202] disabled:opacity-40"
              title={`Print ${meta.docTitle.toLowerCase()}`}
              aria-label={`Print ${meta.docTitle.toLowerCase()}`}
            >
              <PiPrinter className="h-4 w-4" />
            </button>
            {mode === 'stock' && (
              <button
                type="button"
                onClick={() => {
                  setPricelistRows(filtered);
                  setShowPricelist(true);
                }}
                disabled={loading || !!error || filtered.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-[#b20202] disabled:opacity-40"
                title="Print customer pricelist for the current view"
                aria-label="Print customer pricelist for the current view"
              >
                <PiTag className="h-4 w-4" />
              </button>
            )}
            {mode === 'stock' && (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                <PiUploadSimple className="h-3.5 w-3.5" /> Import
              </button>
            )}
            <button
              type="button"
              onClick={() => exportStockCsv(filtered, meta.csvPrefix)}
              disabled={loading || !!error || filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters row */}
        <StockProductFilter rows={rows} selected={productIds} change={setProductIds}
          loading={loading} error={error} retry={load} />
        {error && <div role="alert" className="flex items-center gap-3 bg-red-50 px-5 py-3 text-sm text-red-700">{error}<button type="button" onClick={load} className="underline">Retry</button></div>}
        <div className="flex flex-wrap items-end gap-3 px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Warehouse
            </span>
            <select
              aria-label="Warehouse"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            >
              <option value="">All warehouses</option>
              <option value={UNASSIGNED_WAREHOUSE}>Unassigned warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mx-1 mt-5 w-px self-stretch bg-gray-100" />

          <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Search
            </span>
            <div ref={searchRef} className="relative">
              <div
                className={`flex items-center rounded-lg border bg-white ${
                  showPanel
                    ? 'border-[#b20202] ring-1 ring-[#b20202]/20'
                    : 'border-gray-200'
                }`}
              >
                <PiMagnifyingGlass className="ml-2.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="flex min-h-[32px] flex-1 flex-wrap items-center gap-1 px-2 py-1">
                  {/* One chip per Enter. Chips OR, so this is how you look up
                      several products at once. */}
                  {searchTerms.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() =>
                          setSearchTerms((p) => p.filter((_, j) => j !== i))
                        }
                        aria-label={`Remove search term ${t}`}
                      >
                        <PiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {activeFilters.map((f) => (
                    <span
                      key={f.fieldId}
                      className="inline-flex items-center gap-1 rounded-full bg-[#b20202]/10 px-2 py-0.5 text-[11px] font-medium text-[#b20202]"
                    >
                      {f.label}
                      <button
                        type="button"
                        onClick={() =>
                          setRawFilters((p) =>
                            p.filter((x) => x.fieldId !== f.fieldId)
                          )
                        }
                        aria-label={`Remove ${f.label} filter`}
                      >
                        <PiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {/* Only shown when the tab row cannot represent the selection. */}
                  {statusSel.size > 1 &&
                    Array.from(statusSel).map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                      >
                        {STATUS_BADGE[s].label}
                        <button
                          type="button"
                          onClick={() => toggleStatus(s)}
                          aria-label={`Remove ${STATUS_BADGE[s].label} filter`}
                        >
                          <PiX className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  {expiryWindow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      Expiry
                      <button
                        type="button"
                        onClick={() => {
                          setExpiryPreset(null);
                          setExpiryFrom('');
                          setExpiryTo('');
                        }}
                        aria-label="Clear expiry filter"
                      >
                        <PiX className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {groupBy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                      Group: {groupLabel}
                      <button
                        type="button"
                        onClick={() => setGroupBy('')}
                        aria-label="Clear grouping"
                      >
                        <PiX className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedId(null);
                    }}
                    onFocus={() => setShowPanel(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitSearchTerm();
                      } else if (
                        e.key === 'Backspace' &&
                        search === '' &&
                        searchTerms.length > 0
                      ) {
                        // The usual token-input affordance: backspace on an
                        // empty box takes back the last thing you committed.
                        setSearchTerms((p) => p.slice(0, -1));
                      }
                    }}
                    placeholder={
                      searchTerms.length > 0
                        ? 'Add another…'
                        : activeFilters.length || groupBy || statusSel.size > 1
                          ? ''
                          : 'Product, SKU, size…  Enter to add another item'
                    }
                    aria-label="Search stock lines"
                    className="min-w-[110px] flex-1 bg-transparent py-0.5 text-xs text-gray-800 outline-none placeholder:text-gray-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPanel((v) => !v)}
                  className="border-l border-gray-200 px-2 py-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  aria-label="Toggle filter panel"
                >
                  {showPanel ? (
                    <PiCaretUp className="h-3.5 w-3.5" />
                  ) : (
                    <PiCaretDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <InventoryStockFilterPanel
                open={showPanel}
                onClose={() => setShowPanel(false)}
                activeFilters={activeFilters}
                onAddFilter={(f) =>
                  setRawFilters((p) => [
                    ...p.filter((x) => x.fieldId !== f.fieldId),
                    f,
                  ])
                }
                onRemoveFilter={(fieldId) =>
                  setRawFilters((p) => p.filter((x) => x.fieldId !== fieldId))
                }
                onClearFilters={() => setRawFilters([])}
                groupBy={groupBy}
                onSetGroupBy={(id) => setGroupBy(id === 'none' ? '' : id)}
                statusSel={statusSel}
                onToggleStatus={toggleStatus}
                expiryPreset={expiryPreset}
                onSetExpiryPreset={(id) => {
                  setExpiryPreset(id);
                  if (id !== 'custom') {
                    setExpiryFrom('');
                    setExpiryTo('');
                  }
                }}
                expiryFrom={expiryFrom}
                expiryTo={expiryTo}
                onExpiryFrom={setExpiryFrom}
                onExpiryTo={setExpiryTo}
                favorites={savedSearches}
                onApplyFavorite={applySaved}
                onSaveFavorite={saveSearch}
                onDeleteFavorite={deleteSaved}
                customGroups={customGroups}
                onAddCustomGroup={(g) =>
                  persistCustomGroups([...customGroups, g])
                }
                onRemoveCustomGroup={(id) =>
                  persistCustomGroups(customGroups.filter((g) => g.id !== id))
                }
                triggerRef={searchRef as React.RefObject<HTMLDivElement | null>}
              />
            </div>
            {(search ||
              searchTerms.length > 0 ||
              searchResult.approximate ||
              droppedFilters.length > 0) && (
              <p className="flex min-h-[14px] flex-wrap items-center gap-1 text-[10px] text-gray-400">
                {searchResult.approximate ? (
                  <span className="font-semibold text-amber-600">
                    No exact match — showing closest
                  </span>
                ) : (
                  sortCol === 'relevance' && (
                    <span className="font-semibold text-[#b20202]">
                      Best match
                    </span>
                  )
                )}
                {querySet.queries.length > 1 ? (
                  <span>· any of {querySet.queries.length} items</span>
                ) : (
                  search && <span>· matching all terms</span>
                )}
                {querySet.hasFilters && (
                  <span className="text-gray-500">· field filters active</span>
                )}
                {/* Defect: an unrecognised prefix used to become a term that
                    could never match, so the query returned nothing in silence. */}
                {querySet.unknownFields.length > 0 && (
                  <span className="text-amber-600">
                    · unknown field
                    {querySet.unknownFields.length > 1 ? 's' : ''}{' '}
                    {querySet.unknownFields.map((f) => `${f}:`).join(' ')} —
                    searched as text (try sku:, wh:, cat:, size:)
                  </span>
                )}
                {droppedFilters.length > 0 && (
                  <span className="text-amber-600">
                    · ignored unknown filter
                    {droppedFilters.length > 1 ? 's' : ''}:{' '}
                    {droppedFilters.join(', ')}
                  </span>
                )}
              </p>
            )}
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
                  aria-label="Previous page"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <PiCaretLeft className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
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
      <div className="flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-gray-200 bg-gray-100 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
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
            sub: `${stats.reserved.toLocaleString()} reserved · ${stats.available.toLocaleString()} available`,
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
            sub: `${fmtNgn(stats.profit)} potential profit`,
          },
          {
            label: 'Alerts',
            value: stats.alerts.toLocaleString(),
            icon: <PiWarningCircle className="h-4 w-4" />,
            color: 'text-amber-500',
            sub: 'low / out / near expiry',
          },
        ].map(({ label, value, icon, color, sub }) => (
          <div key={label} className="flex min-w-[168px] shrink-0 items-start gap-3 bg-white px-4 py-3 sm:min-w-0">
            <span className={`mt-0.5 ${color}`}>{icon}</span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
                {error ? 'Unavailable' : loading ? 'Loading…' : value}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-gray-400">{error || loading ? '' : sub}</p>
            </div>
          </div>
        ))}
      </div>

      {mode === 'valuation' && !loading && !error && <ValuationNote rows={filtered} />}

      {/* ── Body ── */}
      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden lg:max-h-[70dvh] lg:flex-row">
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
          className={`flex flex-col overflow-hidden border-b border-gray-200 transition-all duration-200 lg:border-b-0 lg:border-r ${selected ? 'flex-1 lg:flex-none lg:w-[58%]' : 'flex-1'}`}
        >
          {checked.size > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-[#b20202] bg-white px-4 py-2.5">
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <button type="button" className="mr-3 underline" onClick={() => setChecked(new Set(filtered.map(row => row._id)))}>Select all {filtered.length} matching lines</button>
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
              {mode === 'stock' && (
                <button
                  type="button"
                  onClick={() => {
                    setPricelistRows(checkedRows);
                    setShowPricelist(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#b20202]/30 bg-[#b20202]/5 px-3 py-1.5 text-xs font-bold text-[#b20202] transition-colors hover:bg-[#b20202]/10"
                >
                  <PiTag className="h-3.5 w-3.5" /> Print pricelist
                </button>
              )}
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
          ) : error ? (
            <div className="p-6 text-sm text-gray-500">Stock data is unavailable. Use Retry above to reload it.</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <PiCube className="h-8 w-8 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  {searchTerms.length > 0 || search
                    ? `No stock lines matching ${[...searchTerms, search]
                        .filter(Boolean)
                        .map((t) => `"${t}"`)
                        .join(' or ')}`
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
                        aria-label="Select current page"
                        aria-pressed={allChecked}
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
          className={`flex flex-col bg-white transition-all duration-200 ${selected ? 'flex-1 overflow-hidden' : 'hidden lg:flex lg:w-72 lg:shrink-0'}`}
        >
          {selected ? (
            <StockDetail
              key={selected._id}
              row={selected}
              token={token}
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
      <InventoryStockImport
        open={showImport}
        token={token}
        warehouses={warehouses}
        onClose={() => setShowImport(false)}
        onDone={() => {
          setShowImport(false);
          load();
        }}
      />
      {mode === 'stock' && (
        <PricelistPrintModal
          open={showPricelist}
          rows={pricelistRows}
          onClose={() => setShowPricelist(false)}
        />
      )}
    </div>
    </div>
  );
}
