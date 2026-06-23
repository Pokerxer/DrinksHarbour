'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  PiArrowsClockwise,
  PiCurrencyNgn,
  PiShoppingCart,
  PiReceipt,
  PiChartBar,
  PiClock,
  PiPackage,
  PiTrendUp,
  PiFunnel,
  PiStack,
  PiX,
  PiMagnifyingGlass,
  PiTable,
  PiStorefront,
  PiChartLine,
  PiChartPieSlice,
  PiStar,
  PiTrash,
  PiArrowUp,
  PiArrowDown,
  PiSlidersHorizontal,
  PiCaretDown,
  PiArrowCounterClockwise,
  PiCheck,
  PiTag,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
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
  fmtNaira,
  fmtCompact,
  fmtMeasureVal,
  buildDateFilterItems,
  applyFilters,
  computeGroupData,
  computeMultiSeries,
  computeHierarchicalPivot,
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
} from './purchases-analytics-charts';
import { PODrillDrawer } from './po-drill-drawer';
import { AnalyticsWidgetsGrid } from './purchases-analytics-widgets';
import { fraunces } from './purchases-fonts';

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
      const [poRes, sumRes] = await Promise.all([
        purchaseOrderService.getPurchaseOrders(token, { limit: 1000 }),
        purchaseAnalyticsService.getSummary(token).catch(() => null),
      ]);
      setOrders((poRes?.data as PurchaseOrder[]) ?? []);
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

  // Categories & brands (public endpoints)
  useEffect(() => {
    if (!token) return;
    posApi
      .getCategories(token)
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
    posApi
      .getBrands(token, { limit: 200 })
      .then((d) => setBrands(Array.isArray(d) ? d : []))
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
        const rows = (res as any)?.data?.meta || (res as any)?.meta || [];
        const map: Record<string, ProdMeta> = {};
        for (const r of rows as any[]) {
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
    };
    const list = [...savedSearches, s];
    setSavedSearches(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    setSavingSearch(false);
    setSaveSearchName('');
  }, [saveSearchName, filters, groupByStack, measure, savedSearches]);

  const applySavedSearch = useCallback((s: SavedSearch) => {
    setFilters(s.filters);
    const stack: GroupByKey[] = [];
    if (s.groupBy) stack.push(s.groupBy);
    if (s.groupBy2) stack.push(s.groupBy2);
    setGroupByStack(stack);
    setMeasure(s.measure);
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
      return (
        JSON.stringify(sortArr(s.filters)) ===
          JSON.stringify(sortArr(filters)) &&
        (s.groupBy ?? null) === (groupByStack[0] ?? null) &&
        (s.groupBy2 ?? null) === (groupByStack[1] ?? null) &&
        s.measure === measure
      );
    },
    [filters, groupByStack, measure]
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
      {/* ── Header ── */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
              Reporting
            </p>
            <h1
              className={`${fraunces.className} mt-1 text-[28px] font-semibold leading-tight text-[#2a2420] sm:text-[32px]`}
            >
              Purchase Analysis
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Spend, volumes, and vendor performance across purchase orders
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className="group flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202]"
          >
            <PiArrowsClockwise className="h-3.5 w-3.5 transition-transform duration-500 group-active:-rotate-180" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {/* Hero: Total Spend */}
        <div
          title={fmtNaira(kpis.totalSpend)}
          className="relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-[#8a0202] via-[#b20202] to-[#6b0101] p-5 text-white shadow-md lg:col-span-2"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-14 -right-6 h-28 w-28 rounded-full border border-white/10" />
          <div className="relative flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">
              Total Spend
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <PiCurrencyNgn className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`${fraunces.className} relative mt-3 text-[34px] font-semibold tabular-nums leading-none`}
          >
            {fmtCompact(kpis.totalSpend)}
          </p>
          <p className="relative mt-1.5 text-[11px] text-white/55">
            {fmtNaira(kpis.totalSpend)}
          </p>
        </div>

        {[
          {
            label: 'Purchase Orders',
            value: String(kpis.orderCount),
            icon: <PiShoppingCart className="h-4 w-4" />,
            color: 'text-blue-600 bg-blue-50',
          },
          {
            label: 'Avg Order Value',
            value: fmtCompact(kpis.avgOrder),
            full: fmtNaira(kpis.avgOrder),
            icon: <PiTrendUp className="h-4 w-4" />,
            color: 'text-emerald-600 bg-emerald-50',
          },
          {
            label: 'Receipt Rate',
            value: `${kpis.receiptPct.toFixed(0)}%`,
            icon: <PiPackage className="h-4 w-4" />,
            color: 'text-violet-600 bg-violet-50',
          },
          {
            label: 'Pending Approvals',
            value: String(summary?.pendingApprovals ?? 0),
            icon: <PiReceipt className="h-4 w-4" />,
            color:
              (summary?.pendingApprovals ?? 0) > 0
                ? 'text-amber-600 bg-amber-50'
                : 'text-gray-500 bg-gray-100',
          },
        ].map(({ label, value, full, icon, color }) => (
          <div
            key={label}
            title={full}
            className="rounded-2xl border border-[#ece4d6] bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}
              >
                {icon}
              </span>
            </div>
            <p
              className={`${fraunces.className} mt-2 text-2xl font-semibold tabular-nums text-[#2a2420]`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

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
        <div className="mb-4 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-3">
          {/* Filters column */}
          <div className="flex flex-col border-b border-gray-100 md:border-b-0 md:border-r">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
              <PiFunnel className="h-3.5 w-3.5 text-[#b20202]" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Filters
              </span>
            </div>
            <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
              <div className="relative mb-2">
                <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                <input
                  value={panelSearch}
                  onChange={(e) => setPanelSearch(e.target.value)}
                  placeholder="Filter categories / brands…"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#b20202] focus:bg-white"
                />
              </div>
              <DropSection title="Status" />
              {FILTER_STATIC.map((f) => (
                <DropItem
                  key={f.key}
                  label={f.label}
                  selected={filters.includes(f.key)}
                  onClick={() => toggleFilter(f.key)}
                />
              ))}
              <DropSection title="Date" />
              <DropItem
                label="Today"
                selected={filters.includes('date_today')}
                onClick={() => toggleFilter('date_today')}
              />
              <DropItem
                label="This Week"
                selected={filters.includes('date_week')}
                onClick={() => toggleFilter('date_week')}
              />
              <DropSection title="Months" />
              {dateItems.months.map((m) => (
                <DropItem
                  key={m.key}
                  label={m.label}
                  selected={filters.includes(m.key)}
                  onClick={() => toggleFilter(m.key)}
                />
              ))}
              <DropSection title="Quarters" />
              {dateItems.quarters.map((q) => (
                <DropItem
                  key={q.key}
                  label={q.label}
                  selected={filters.includes(q.key)}
                  onClick={() => toggleFilter(q.key)}
                />
              ))}
              <DropSection title="Years" />
              {dateItems.years.map((y) => (
                <DropItem
                  key={y.key}
                  label={y.label}
                  selected={filters.includes(y.key)}
                  onClick={() => toggleFilter(y.key)}
                />
              ))}
              {topCategories.length > 0 && (
                <>
                  <DropSection title="Product Category" />
                  <FilterListSection
                    label="Product Category"
                    items={topCategories}
                    activeFilters={filters}
                    prefix="category_"
                    onToggle={toggleFilter}
                    filter={panelSearch}
                  />
                </>
              )}
              {subCategories.length > 0 && (
                <>
                  <DropSection title="Subcategory" />
                  <FilterListSection
                    label="Subcategory"
                    items={subCategories}
                    activeFilters={filters}
                    prefix="subcategory_"
                    onToggle={toggleFilter}
                    filter={panelSearch}
                  />
                </>
              )}
              {brands.length > 0 && (
                <>
                  <DropSection title="Brand" />
                  <FilterListSection
                    label="Brand"
                    items={brands}
                    activeFilters={filters}
                    prefix="brand_"
                    onToggle={toggleFilter}
                    filter={panelSearch}
                  />
                </>
              )}
            </div>
          </div>

          {/* Group By column */}
          <div className="flex flex-col border-b border-gray-100 md:border-b-0 md:border-r">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
              <PiStack className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Group By
              </span>
              {groupByStack.length > 0 && (
                <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">
                  {groupByStack.length}
                </span>
              )}
            </div>
            <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
              <p className="mb-2 px-1 text-[11px] text-gray-400">
                Select up to 2 dimensions. Click a selected dimension again to
                remove it.
              </p>
              <DropSection title="Dimensions" />
              {GROUP_BY_ITEMS.map((g) => {
                const idx = groupByStack.indexOf(g.key);
                return (
                  <DropItem
                    key={g.key}
                    label={g.label}
                    selected={idx >= 0}
                    onClick={() => toggleGroupBy(g.key)}
                    badge={
                      idx >= 0 ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                          {idx + 1}
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
              <DropSection title="Order Date" />
              {GROUP_BY_DATE_ITEMS.map((g) => {
                const idx = groupByStack.indexOf(g.key);
                return (
                  <DropItem
                    key={g.key}
                    label={g.label}
                    selected={idx >= 0}
                    onClick={() => toggleGroupBy(g.key)}
                    badge={
                      idx >= 0 ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                          {idx + 1}
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Favorites column */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
              <PiStar className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Favorites
              </span>
              {savedSearches.length > 0 && (
                <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-600">
                  {savedSearches.length}
                </span>
              )}
            </div>
            <div className="max-h-[420px] flex-1 space-y-1.5 overflow-y-auto p-3">
              {savedSearches.length === 0 && !savingSearch && (
                <div className="py-6 text-center">
                  <PiStar className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                  <p className="text-xs text-gray-400">No saved searches yet</p>
                  <p className="mt-0.5 text-[11px] text-gray-300">
                    Save your current filters for quick access
                  </p>
                </div>
              )}
              {savedSearches.map((s) => {
                const active = isSearchMatch(s);
                return (
                  <div
                    key={s.id}
                    className={`group rounded-xl border p-2.5 transition-colors ${
                      active
                        ? 'border-teal-200 bg-teal-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => applySavedSearch(s)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {active && (
                          <PiCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                        )}
                        <span
                          className={`truncate text-sm font-medium ${
                            active ? 'text-teal-700' : 'text-gray-800'
                          }`}
                        >
                          {s.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedSearch(s.id)}
                        className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:text-red-400"
                      >
                        <PiTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-gray-400">
                      {s.filters.length} filter
                      {s.filters.length === 1 ? '' : 's'}
                      {s.groupBy
                        ? ` · ${[s.groupBy, s.groupBy2]
                            .filter(Boolean)
                            .map(
                              (k) =>
                                ALL_GROUP_ITEMS.find((g) => g.key === k)
                                  ?.label ?? k
                            )
                            .join(' > ')}`
                        : ''}
                    </p>
                  </div>
                );
              })}

              {savingSearch ? (
                <div className="rounded-xl border border-gray-200 p-2.5">
                  <input
                    autoFocus
                    value={saveSearchName}
                    onChange={(e) => setSaveSearchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveSearch();
                      if (e.key === 'Escape') {
                        setSavingSearch(false);
                        setSaveSearchName('');
                      }
                    }}
                    placeholder="Search name…"
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#b20202]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={saveSearch}
                      className="flex-1 rounded-lg bg-[#b20202] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#7a0101]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSavingSearch(false);
                        setSaveSearchName('');
                      }}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSavingSearch(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-2.5 py-2 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
                >
                  <PiStar className="h-3.5 w-3.5" />
                  Save current view
                </button>
              )}
            </div>
          </div>
        </div>
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
          <div className="flex items-center justify-between border-b border-[#ece4d6] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#2a2420]">
              {measureLabel} by {groupLabel}
              {groupLabel2 ? ` & ${groupLabel2}` : ''}
            </h2>
            <span className="bg-[#b20202]/8 rounded-full px-2.5 py-1 text-xs font-semibold text-[#b20202]">
              {measure === 'avg_order'
                ? `${totalOrders} orders`
                : `Total: ${fmtMeasureVal(totalValue, measure)}`}
            </span>
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

      {/* Top vendors quick table (from server summary) */}
      {summary?.topVendors && summary.topVendors.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
          <div className="border-b border-[#ece4d6] px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
              Leaderboard
            </p>
            <h2
              className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
            >
              Top Vendors by Spend
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-xs">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Vendor
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Orders
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Total Spend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1ece2]">
              {summary.topVendors.map((v, i) => (
                <tr key={i} className="transition-colors hover:bg-[#FAF8F3]">
                  <td className="px-4 py-2.5 font-medium text-[#2a2420]">
                    {v.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">
                    {v.count}
                  </td>
                  <td
                    className={`${fraunces.className} px-4 py-2.5 text-right font-semibold tabular-nums text-[#2a2420]`}
                  >
                    {fmtNaira(v.amount ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
