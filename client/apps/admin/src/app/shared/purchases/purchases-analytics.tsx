'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  PiShoppingCart,
  PiChartBar,
  PiClock,
  PiPackage,
  PiFunnel,
  PiStack,
  PiX,
  PiMagnifyingGlass,
  PiTable,
  PiStorefront,
  PiChartLine,
  PiChartPieSlice,
  PiStar,
  PiArrowUp,
  PiArrowDown,
  PiSlidersHorizontal,
  PiCaretDown,
  PiArrowCounterClockwise,
  PiTag,
  PiFloppyDisk,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  purchaseOrderService,
  type PurchaseOrder,
} from '@/services/purchaseOrder.service';
import {
  purchaseAnalyticsService,
  type PurchaseAnalyticsSummary,
} from '@/services/purchaseAnalytics.service';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { BASE_CURRENCY } from './types';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  SAVED_KEY,
  FILTER_STATIC,
  GROUP_BY_ITEMS,
  GROUP_BY_DATE_ITEMS,
  ALL_GROUP_ITEMS,
  MEASURES,
  fmtMeasureVal,
  buildDateFilterItems,
  applyFilters,
  computeGroupData,
  computeMultiSeries,
  computeHierarchicalPivot,
  buildGroupedViewCSV,
  type GroupByKey,
  type ViewMode,
  type HierPivotResult,
  type Measure,
  type ChartType,
  type SortField,
  type SortCriterion,
  type SavedSearch,
  type CatItem,
  type BrandItem,
  type ProdMeta,
} from './purchases-analytics-helpers';
import {
  Dropdown,
  DropItem,
  DropSection,
  FilterListSection,
  MainChart,
  StackedChart,
  PivotView,
  downloadCSV,
} from './purchases-analytics-charts';
import { PODrillDrawer } from './po-drill-drawer';
import { AnalyticsWidgetsGrid, TopVendorsTable } from './purchases-analytics-widgets';
import { AnalyticsHeader } from './purchases-analytics-header';
import { AnalyticsFilterPanel } from './purchases-analytics-filter-panel';

const SORT_FIELD_LABELS: {
  field: SortField;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    field: 'value',
    label: 'Value',
    icon: <PiChartBar className="h-3.5 w-3.5 text-gray-400" />,
  },
  {
    field: 'label',
    label: 'Label',
    icon: <PiTag className="h-3.5 w-3.5 text-gray-400" />,
  },
  {
    field: 'orders',
    label: 'Orders',
    icon: <PiShoppingCart className="h-3.5 w-3.5 text-gray-400" />,
  },
];

export default function PurchasesAnalytics() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const { getRate } = useExchangeRates();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [summary, setSummary] = useState<PurchaseAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<CatItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [prodMeta, setProdMeta] = useState<Record<string, ProdMeta>>({});

  const [filters, setFilters] = useState<string[]>(['not_cancelled']);
  const [groupByStack, setGroupByStack] = useState<GroupByKey[]>(['vendor']);
  const [measure, setMeasure] = useState<Measure>('total_cost');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [sortStack, setSortStack] = useState<SortCriterion[]>([]);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [appliedSearchName, setAppliedSearchName] = useState<string | null>(
    null
  );

  const [drillData, setDrillData] = useState<{
    orders: PurchaseOrder[];
    title: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [pivotRowDims, setPivotRowDims] = useState<GroupByKey[]>(['vendor']);
  const [pivotColDims, setPivotColDims] = useState<GroupByKey[]>([]);
  const [pivotHeatMap, setPivotHeatMap] = useState(true);
  const [pivotShowOrders, setPivotShowOrders] = useState(false);
  const [pivotRowSearch, setPivotRowSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());

  const groupBy = groupByStack[0] ?? null;
  const groupBy2 = groupByStack[1] ?? null;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Walk every page of the ledger — a single capped request would skew
      // every total once the tenant outgrows one page size.
      const [poRes, sumRes] = await Promise.all([
        purchaseOrderService.getAllPurchaseOrders(token),
        purchaseAnalyticsService.getSummary(token).catch(() => null),
      ]);
      setOrders(poRes.orders);
      if (poRes.truncated)
        toast(
          `Showing the most recent ${poRes.orders.length} purchase orders; older history is excluded.`,
          { icon: '⚠️' }
        );
      if (sumRes?.data) setSummary(sumRes.data);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load purchase data'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Categories & brands (public endpoints). posApi.request unwraps the
  // envelope to body.data, so these resolve to {categories,total}/{brands}.
  useEffect(() => {
    if (!token) return;
    posApi
      .getCategories()
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
    posApi
      .getBrands({ limit: 200 })
      .then((d) => setBrands(d.brands ?? []))
      .catch(() => {});
  }, [token]);

  // SubProduct → category/subcategory/brand metadata map, keyed by SubProduct
  // _id. Uses the dedicated /product-meta endpoint which (unlike the POS grid)
  // is not gated by visibleInPOS/status/limit, so PO lines referencing
  // non-POS sub-products still attribute correctly.
  useEffect(() => {
    if (!token) return;
    posApi
      .getProductMeta(token)
      .then((res) => {
        const map: Record<string, ProdMeta> = {};
        for (const r of res.meta || []) {
          if (!r?._id) continue;
          map[String(r._id)] = {
            catId: r.categoryId || '',
            catName: r.categoryName || '',
            subCatId: r.subCategoryId || undefined,
            subCatName: r.subCategoryName || undefined,
            brandId: r.brandId || '',
            brandName: r.brandName || '',
          };
        }
        setProdMeta(map);
      })
      .catch(() => {});
  }, [token]);

  // Saved searches (localStorage)
  useEffect(() => {
    try {
      setSavedSearches(
        JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as SavedSearch[]
      );
    } catch {
      /* ignore malformed saved-search storage */
    }
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Convert any PO currency to the NGN base using live/manual exchange rates
  const toBase = useCallback(
    (amount: number, currency: string): number => {
      if (!currency || currency === BASE_CURRENCY) return amount;
      const rate = getRate(currency, BASE_CURRENCY);
      return rate ? amount * rate : amount;
    },
    [getRate]
  );

  const filtered = useMemo(
    () => applyFilters(orders, filters, prodMeta),
    [orders, filters, prodMeta]
  );

  const groupData = useMemo(() => {
    if (!groupBy) return [];
    return computeGroupData(
      filtered,
      groupBy,
      measure,
      prodMeta,
      toBase,
      sortStack
    );
  }, [filtered, groupBy, measure, prodMeta, toBase, sortStack]);

  const multiSeries = useMemo(() => {
    if (!groupBy || !groupBy2) return null;
    return computeMultiSeries(
      filtered,
      groupBy,
      groupBy2,
      measure,
      prodMeta,
      toBase,
      sortStack
    );
  }, [filtered, groupBy, groupBy2, measure, prodMeta, toBase, sortStack]);

  const pivotData: HierPivotResult | null = useMemo(() => {
    if (viewMode !== 'pivot' || pivotRowDims.length === 0) return null;
    return computeHierarchicalPivot(
      filtered,
      pivotRowDims,
      pivotColDims,
      measure,
      prodMeta,
      toBase
    );
  }, [
    viewMode,
    filtered,
    pivotRowDims,
    pivotColDims,
    measure,
    prodMeta,
    toBase,
  ]);

  // KPI totals (always in base currency)
  const kpis = useMemo(() => {
    const live = filtered.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'cancel'
    );
    const totalSpend = live.reduce(
      (s, o) =>
        s +
        toBase(
          (o.items || []).reduce(
            (a, i) =>
              a +
              (i.unitCost ?? i.unitPrice ?? 0) *
                (i.quantity ?? 0) *
                (1 + (i.taxRate ?? 0) / 100),
            0
          ),
          o.currency || BASE_CURRENCY
        ),
      0
    );
    let ordered = 0;
    let received = 0;
    live.forEach((o) =>
      (o.items || []).forEach((i) => {
        ordered += i.quantity ?? 0;
        received += Math.min(i.receivedQty ?? 0, i.quantity ?? 0);
      })
    );
    return {
      totalSpend,
      orderCount: live.length,
      avgOrder: live.length > 0 ? totalSpend / live.length : 0,
      receiptPct: ordered > 0 ? (received / ordered) * 100 : 0,
    };
  }, [filtered, toBase]);

  const dateItems = useMemo(() => buildDateFilterItems(new Date()), []);

  const topCategoryGroups = useMemo(
    () =>
      computeGroupData(
        filtered,
        'product_category',
        'product_qty',
        prodMeta,
        toBase,
        []
      ),
    [filtered, prodMeta, toBase]
  );

  const topCategories = useMemo(
    () => categories.filter((c) => !c.parent || c.level === 0),
    [categories]
  );
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent && c.level !== 0),
    [categories]
  );

  function toggleFilter(key: string) {
    setAppliedSearchName(null);
    setFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  function toggleGroupBy(key: GroupByKey) {
    setAppliedSearchName(null);
    setGroupByStack((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
  }

  const addSort = useCallback((field: SortField) => {
    setSortStack((prev) =>
      prev.some((s) => s.field === field)
        ? prev
        : [...prev, { field, dir: 'desc' }]
    );
    setSortPickerOpen(false);
  }, []);

  const removeSort = useCallback((field: SortField) => {
    setSortStack((prev) => prev.filter((s) => s.field !== field));
  }, []);

  const toggleSortDir = useCallback((field: SortField) => {
    setSortStack((prev) =>
      prev.map((s) =>
        s.field === field ? { ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' } : s
      )
    );
  }, []);

  function addSearchFilter(
    prefix: 'vendor_search:' | 'product_search:' | 'catname_search:'
  ) {
    const q = searchText.trim();
    if (!q) return;
    const key = `${prefix}${q}`;
    setAppliedSearchName(null);
    setFilters((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setSearchText('');
    setSearchOpen(false);
  }

  const saveSearch = useCallback(() => {
    if (!saveSearchName.trim()) return;
    const s: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName.trim(),
      filters,
      groupBy: groupByStack[0] ?? null,
      groupBy2: groupByStack[1] ?? null,
      measure,
      sort: [...sortStack],
    };
    const list = [...savedSearches, s];
    setSavedSearches(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    setSavingSearch(false);
    setSaveSearchName('');
  }, [saveSearchName, filters, groupByStack, measure, sortStack, savedSearches]);

  const applySavedSearch = useCallback((s: SavedSearch) => {
    setFilters(s.filters);
    const stack: GroupByKey[] = [];
    if (s.groupBy) stack.push(s.groupBy);
    if (s.groupBy2) stack.push(s.groupBy2);
    setGroupByStack(stack);
    setMeasure(s.measure);
    setSortStack(s.sort ?? []);
    setAppliedSearchName(s.name);
  }, []);

  const deleteSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => {
      const list = prev.filter((s) => s.id !== id);
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
      return list;
    });
  }, []);

  const isSearchMatch = useCallback(
    (s: SavedSearch) => {
      const sortArr = (a: string[]) => [...a].sort();
      const sameSort =
        JSON.stringify(s.sort ?? []) === JSON.stringify(sortStack);
      return (
        JSON.stringify(sortArr(s.filters)) ===
          JSON.stringify(sortArr(filters)) &&
        (s.groupBy ?? null) === (groupByStack[0] ?? null) &&
        (s.groupBy2 ?? null) === (groupByStack[1] ?? null) &&
        s.measure === measure &&
        sameSort
      );
    },
    [filters, groupByStack, measure, sortStack]
  );

  function getFilterLabel(key: string): string {
    if (key.startsWith('vendor_search:')) return `Vendor: ${key.slice(14)}`;
    if (key.startsWith('product_search:')) return `Product: ${key.slice(15)}`;
    if (key.startsWith('catname_search:')) return `Category: ${key.slice(16)}`;
    if (key.startsWith('category_')) {
      const id = key.slice(9);
      return categories.find((c) => c._id === id)?.name || 'Category';
    }
    if (key.startsWith('brand_')) {
      const id = key.slice(6);
      return brands.find((b) => b._id === id)?.name || 'Brand';
    }
    const stat = FILTER_STATIC.find((f) => f.key === key);
    if (stat) return stat.label;
    if (key === 'date_today') return 'Today';
    if (key === 'date_week') return 'This Week';
    if (key.startsWith('date_m_')) {
      const m = dateItems.months.find((x) => x.key === key);
      return m?.label ?? key;
    }
    if (key.startsWith('date_q_')) {
      const q = dateItems.quarters.find((x) => x.key === key);
      return q?.label ?? key;
    }
    if (key.startsWith('date_y_')) return key.replace('date_y_', '');
    return key;
  }

  const filterChips = filters.map((f) => ({
    key: f,
    label: getFilterLabel(f),
  }));

  const groupLabel = groupBy
    ? (ALL_GROUP_ITEMS.find((g) => g.key === groupBy)?.label ?? groupBy)
    : 'Vendor';
  const groupLabel2 = groupBy2
    ? (ALL_GROUP_ITEMS.find((g) => g.key === groupBy2)?.label ?? groupBy2)
    : null;
  const measureLabel =
    MEASURES.find((m) => m.key === measure)?.label ?? measure;

  const totalValue = multiSeries
    ? multiSeries.rows.reduce((s, r) => s + r.__total__, 0)
    : groupData.reduce((s, r) => s + r.value, 0);
  const totalOrders = filtered.length;

  const hasForeign = filtered.some(
    (o) => o.currency && o.currency !== BASE_CURRENCY
  );

  function openDrill(
    label: string,
    poList: PurchaseOrder[],
    seriesKey?: string
  ) {
    if (poList.length === 0) return;
    const title = seriesKey
      ? `${groupLabel}: ${label} · ${groupLabel2}: ${seriesKey || '—'}`
      : `${groupLabel}: ${label}`;
    setDrillData({ orders: poList, title });
  }

  /** Exports whatever the main chart/table is currently showing. */
  const exportCurrentView = useCallback(() => {
    const dateTag = new Date().toISOString().slice(0, 10);
    if (multiSeries) {
      const rowIdx = new Map(
        multiSeries.rows.map((r, i) => [r.label, i] as const)
      );
      const columnTotals = Object.fromEntries(
        multiSeries.series.map((s) => [
          s,
          multiSeries.rows.reduce(
            (sum, r) => sum + ((r[s] as number) ?? 0),
            0
          ),
        ])
      );
      downloadCSV(
        buildGroupedViewCSV({
          groupLabel: groupLabel,
          measureLabel,
          measure,
          rows: multiSeries.rows.map((r) => ({
            label: r.label,
            orders: r.orders,
          })),
          totalValue,
          totalOrders,
          series: multiSeries.series,
          cellValue: (row, s) => {
            const i = rowIdx.get(row.label);
            return i == null ? 0 : ((multiSeries.rows[i][s] as number) ?? 0);
          },
          rowTotals: Object.fromEntries(
            multiSeries.rows.map((r) => [r.label, r.__total__])
          ),
          columnTotals,
        }),
        `purchase-analysis-${dateTag}.csv`
      );
      return;
    }
    downloadCSV(
      buildGroupedViewCSV({
        groupLabel,
        measureLabel,
        measure,
        rows: groupData.map((r) => ({
          label: r.label,
          value: r.value,
          orders: r.orders,
        })),
        totalValue,
        totalOrders,
      }),
      `purchase-analysis-${dateTag}.csv`
    );
  }, [multiSeries, groupData, groupLabel, measureLabel, measure, totalValue, totalOrders]);

  if (loading) {
    return (
      <div>
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202] opacity-40" />
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-gray-100" />
          <div className="mt-3 h-7 w-60 animate-pulse rounded-full bg-gray-100" />
          <div className="mt-2 h-3 w-80 animate-pulse rounded-full bg-gray-50" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <div className="bg-[#b20202]/8 col-span-2 h-[118px] animate-pulse rounded-2xl lg:col-span-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[118px] animate-pulse rounded-2xl border border-[#ece4d6] bg-white"
            />
          ))}
        </div>
        <div className="mt-5 h-[440px] animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header + KPI cards ── */}
      <AnalyticsHeader kpis={kpis} summary={summary} onRefresh={load} />

      {/* ── Control bar ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            panelOpen || filters.length > 0 || groupByStack.length > 0
              ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <PiFunnel className="h-3.5 w-3.5" />
          Filters &amp; Group By
          {(filters.length > 0 || groupByStack.length > 0) && (
            <span className="rounded-full bg-[#b20202]/15 px-1.5 py-px text-[10px] font-bold">
              {filters.length + groupByStack.length}
            </span>
          )}
        </button>

        {groupByStack.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-teal-700 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
            <PiStack className="h-3 w-3 shrink-0" />
            {groupByStack
              .map((k) => ALL_GROUP_ITEMS.find((g) => g.key === k)?.label ?? k)
              .join(' > ')}
            <button
              type="button"
              onClick={() => setGroupByStack([])}
              className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100"
            >
              <PiX className="h-3 w-3" />
            </button>
          </span>
        )}

        <Dropdown
          label={`Measure: ${measureLabel}`}
          icon={<PiChartBar className="h-3.5 w-3.5" />}
        >
          {MEASURES.map((m) => (
            <DropItem
              key={m.key}
              label={m.label}
              selected={measure === m.key}
              onClick={() => setMeasure(m.key)}
            />
          ))}
        </Dropdown>

        {/* Sort stack */}
        <div className="relative flex items-center gap-1.5">
          {sortStack.map((s) => {
            const lbl =
              SORT_FIELD_LABELS.find((f) => f.field === s.field)?.label ??
              s.field;
            return (
              <span
                key={s.field}
                className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700"
              >
                <button
                  type="button"
                  onClick={() => toggleSortDir(s.field)}
                  className="flex items-center gap-0.5 transition-colors hover:text-sky-900"
                  title="Toggle direction"
                >
                  {s.dir === 'desc' ? (
                    <PiArrowDown className="h-3 w-3" />
                  ) : (
                    <PiArrowUp className="h-3 w-3" />
                  )}
                  {lbl}
                </button>
                <button
                  type="button"
                  onClick={() => removeSort(s.field)}
                  className="ml-0.5 rounded transition-colors hover:text-red-500"
                >
                  <PiX className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}

          {sortStack.length < 2 && (
            <button
              type="button"
              onClick={() => setSortPickerOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition-colors ${
                sortPickerOpen
                  ? 'border-gray-300 bg-gray-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              } text-gray-500`}
            >
              <PiSlidersHorizontal className="h-3 w-3 text-gray-400" />
              Sort
              <PiCaretDown
                className={`h-2.5 w-2.5 transition-transform ${sortPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}

          {sortPickerOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
              {SORT_FIELD_LABELS.filter(
                (f) => !sortStack.some((s) => s.field === f.field)
              ).map((f) => (
                <button
                  key={f.field}
                  type="button"
                  onClick={() => addSort(f.field)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
              {sortStack.length > 0 && (
                <div className="mt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSortStack([]);
                      setSortPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  >
                    <PiArrowCounterClockwise className="h-3.5 w-3.5" />
                    Reset sort
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Smart search */}
        <div ref={searchRef} className="relative min-w-[200px] flex-1">
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSearchFilter('vendor_search:');
              }}
              placeholder="Search vendor, product, or category…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            />
          </div>
          {searchOpen && searchText.trim() && (
            <div className="absolute left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
              <button
                type="button"
                onMouseDown={() => addSearchFilter('vendor_search:')}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <PiStorefront className="h-3.5 w-3.5 text-gray-400" />
                Search <strong>Vendor</strong> for "{searchText.trim()}"
              </button>
              <button
                type="button"
                onMouseDown={() => addSearchFilter('product_search:')}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <PiPackage className="h-3.5 w-3.5 text-gray-400" />
                Search <strong>Product</strong> for "{searchText.trim()}"
              </button>
              <button
                type="button"
                onMouseDown={() => addSearchFilter('catname_search:')}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <PiTag className="h-3.5 w-3.5 text-gray-400" />
                Search <strong>Category</strong> for "{searchText.trim()}"
              </button>
            </div>
          )}
        </div>

        {/* Chart-type switch */}
        {viewMode === 'graph' && (
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            {(
              [
                { t: 'bar', icon: <PiChartBar className="h-4 w-4" /> },
                { t: 'line', icon: <PiChartLine className="h-4 w-4" /> },
                { t: 'pie', icon: <PiChartPieSlice className="h-4 w-4" /> },
                { t: 'table', icon: <PiTable className="h-4 w-4" /> },
              ] as { t: ChartType; icon: React.ReactNode }[]
            ).map(({ t, icon }) => (
              <button
                key={t}
                type="button"
                title={t}
                onClick={() => setChartType(t)}
                className={`rounded-md p-1.5 transition-colors ${
                  chartType === t
                    ? 'bg-[#b20202] text-white'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        )}

        {/* View toggle: Graph / Pivot */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            title="Graph view"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'graph'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <PiChartBar className="h-3.5 w-3.5" />
            Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pivot')}
            title="Pivot table"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'pivot'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <PiTable className="h-3.5 w-3.5" />
            Pivot
          </button>
        </div>
      </div>

      {/* ── Filters / Group By / Favorites panel ── */}
      {panelOpen && (
        <AnalyticsFilterPanel
          filters={filters}
          toggleFilter={toggleFilter}
          dateItems={dateItems}
          topCategories={topCategories}
          subCategories={subCategories}
          brands={brands}
          panelSearch={panelSearch}
          setPanelSearch={setPanelSearch}
          groupByStack={groupByStack}
          toggleGroupBy={toggleGroupBy}
          savedSearches={savedSearches}
          applySavedSearch={applySavedSearch}
          deleteSavedSearch={deleteSavedSearch}
          isSearchMatch={isSearchMatch}
          savingSearch={savingSearch}
          setSavingSearch={setSavingSearch}
          saveSearchName={saveSearchName}
          setSaveSearchName={setSaveSearchName}
          saveSearch={saveSearch}
        />
      )}

      {/* Applied filter chips */}
      {(filterChips.length > 0 || appliedSearchName) && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {appliedSearchName && (
            <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
              <PiStar className="h-3 w-3" />
              {appliedSearchName}
            </span>
          )}
          {filterChips.map(({ key, label }) => (
            <span
              key={key}
              className="bg-[#b20202]/8 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-[#b20202]"
            >
              {label}
              <button
                type="button"
                onClick={() => toggleFilter(key)}
                className="hover:text-[#7a0101]"
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filterChips.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters([]);
                setAppliedSearchName(null);
              }}
              className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {hasForeign && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] text-gray-400">
          <PiClock className="h-3 w-3" />
          Foreign-currency orders are converted to ₦ using current exchange
          rates.
        </p>
      )}

      {/* ── Chart / table / pivot ── */}
      {viewMode === 'pivot' ? (
        <PivotView
          pivotData={pivotData}
          pivotRowDims={pivotRowDims}
          pivotColDims={pivotColDims}
          measure={measure}
          pivotHeatMap={pivotHeatMap}
          pivotShowOrders={pivotShowOrders}
          pivotRowSearch={pivotRowSearch}
          expandedRows={expandedRows}
          expandedCols={expandedCols}
          setPivotRowDims={setPivotRowDims}
          setPivotColDims={setPivotColDims}
          setPivotHeatMap={setPivotHeatMap}
          setPivotShowOrders={setPivotShowOrders}
          setPivotRowSearch={setPivotRowSearch}
          setExpandedRows={setExpandedRows}
          setExpandedCols={setExpandedCols}
          onCellClick={(orders, title) => setDrillData({ orders, title })}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#ece4d6] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#2a2420]">
              {measureLabel} by {groupLabel}
              {groupLabel2 ? ` & ${groupLabel2}` : ''}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportCurrentView}
                title="Export current view as CSV"
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
              >
                <PiFloppyDisk className="h-3 w-3" />
                CSV
              </button>
              <span className="bg-[#b20202]/8 rounded-full px-2.5 py-1 text-xs font-semibold text-[#b20202]">
                {measure === 'avg_order'
                  ? `${totalOrders} orders`
                  : `Total: ${fmtMeasureVal(totalValue, measure)}`}
              </span>
            </div>
          </div>

          <div className="p-1">
            {multiSeries ? (
              <StackedChart
                rows={multiSeries.rows}
                series={multiSeries.series}
                chartType={chartType}
                measure={measure}
                groupLabel={groupLabel}
                measureLabel={measureLabel}
                orderMap={multiSeries.orderMap}
                onSegmentClick={(rowLabel, seriesKey, poList) =>
                  openDrill(rowLabel, poList, seriesKey)
                }
              />
            ) : (
              <MainChart
                data={groupData}
                chartType={chartType}
                measure={measure}
                groupLabel={groupLabel}
                measureLabel={measureLabel}
                totalValue={totalValue}
                totalOrders={totalOrders}
                onBarClick={(label, poList) => openDrill(label, poList)}
              />
            )}
          </div>
        </div>
      )}

      {/* Top vendors quick table (server-computed summary) */}
      <TopVendorsTable topVendors={summary?.topVendors} />

      {/* ── Additional ledger widgets ── */}
      <AnalyticsWidgetsGrid
        summary={summary}
        topCategories={topCategoryGroups}
      />

      {/* ── PO Drill-down drawer ── */}
      {drillData && (
        <PODrillDrawer
          orders={drillData.orders}
          title={drillData.title}
          toBase={toBase}
          onClose={() => setDrillData(null)}
        />
      )}
    </div>
  );
}
