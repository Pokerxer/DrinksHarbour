// /sales/analytics — the Reporting → Sales analysis.
//
// Architecture mirrors the purchases analysis (whole-ledger load, client-side
// group-by engine, drill-down) but is redesigned around the question a sales
// operator asks first: where does revenue come from and what is owed. The
// grouping engine lives in sales-analytics-helpers and is unit-tested; this
// file fetches, filters and composes.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiChartBar,
  PiChartLine,
  PiChartPieSlice,
  PiCaretDown,
  PiFloppyDisk,
  PiFunnel,
  PiMagnifyingGlass,
  PiSlidersHorizontal,
  PiStack,
  PiStar,
  PiTable,
  PiX,
  PiArrowUp,
  PiArrowDown,
  PiArrowCounterClockwise,
} from 'react-icons/pi';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { posApi } from '@/app/shared/point-of-sale/api';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import {
  Dropdown,
  DropItem,
  downloadCSV,
} from '../../purchases/purchases-analytics-charts';
import { collectAllPages } from '../sales-list-helpers';
import SalesAnalyticsHeader from './sales-analytics-header';
import SalesAnalyticsFilterPanel from './sales-analytics-filter-panel';
import {
  SalesMainChart,
  SalesStackedChart,
  SalesDrillDrawer,
} from './sales-analytics-charts';
import SalesAnalyticsPivot from './sales-analytics-pivot';
import SalesWidgetsGrid from './sales-analytics-widgets';
import {
  SAVED_KEY,
  SALES_GROUP_DATE_ITEMS,
  ALL_SALES_GROUP_ITEMS,
  SALES_MEASURES,
  IS_CURRENCY,
  STATUS_FILTER_ITEMS,
  PAYMENT_FILTER_ITEMS,
  buildDateFilterItems,
  applySalesFilters,
  savedSearchMatches,
  computeSalesGroupData,
  computeSalesMultiSeries,
  computeSalesHierarchicalPivot,
  type ChartType,
  type ProdMeta,
  type SavedSearch,
  type SalesGroupByKey,
  type SalesMeasure,
  type SortCriterion,
  type SortField,
} from './sales-analytics-helpers';

const FETCH_PAGE = 100; // server caps `limit` at 100

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'value', label: 'Value' },
  { field: 'orders', label: 'Documents' },
  { field: 'label', label: 'Label' },
];

export default function SalesAnalytics() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const { getRate } = useExchangeRates();

  const [docs, setDocs] = useState<SalesOrder[]>([]);
  const [truncated, setTruncated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<
    { _id: string; name: string; parent?: string; level?: number }[]
  >([]);
  const [brands, setBrands] = useState<{ _id: string; name: string }[]>([]);
  const [prodMeta, setProdMeta] = useState<Record<string, ProdMeta>>({});

  // Deep links from the Reporting menu pre-select the dimension:
  // /sales/analytics?groupBy=salesperson opens as "by Salesperson".
  const initialGroupBy = useMemo(() => {
    const g = searchParams.get('groupBy') as SalesGroupByKey | null;
    return g && ALL_SALES_GROUP_ITEMS.some((i) => i.key === g) ? g : 'customer';
  }, [searchParams]);

  const [filters, setFilters] = useState<string[]>(['not_cancelled']);
  const [groupByStack, setGroupByStack] = useState<SalesGroupByKey[]>(
    [initialGroupBy]
  );
  const [measure, setMeasure] = useState<SalesMeasure>('revenue');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [viewMode, setViewMode] = useState<'graph' | 'stacked' | 'pivot'>(
    'graph'
  );
  const [sortStack, setSortStack] = useState<SortCriterion[]>([]);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Pivot state — rows default to the deep-linked (or customer) dimension,
  // columns to time, which is the cross-tab an operator asks for first.
  const [pivotRowDims, setPivotRowDims] = useState<SalesGroupByKey[]>(
    [initialGroupBy]
  );
  const [pivotColDims, setPivotColDims] = useState<SalesGroupByKey[]>([
    'order_month',
  ]);
  const [pivotHeatMap, setPivotHeatMap] = useState(true);
  const [pivotShowDocs, setPivotShowDocs] = useState(false);
  const [pivotRowSearch, setPivotRowSearch] = useState('');
  const [pivotExpandedRows, setPivotExpandedRows] = useState<Set<string>>(
    new Set()
  );
  const [pivotExpandedCols, setPivotExpandedCols] = useState<Set<string>>(
    new Set()
  );

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [appliedSearchName, setAppliedSearchName] = useState<string | null>(
    null
  );

  const [drill, setDrill] = useState<{
    orders: SalesOrder[];
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!searchParams.get('groupBy')) return;
    setGroupByStack([initialGroupBy]);
  }, [initialGroupBy, searchParams]);

  const toBase = useCallback(
    (amount: number, currency: string): number => {
      if (!currency || currency === 'NGN') return amount;
      const rate = getRate(currency, 'NGN');
      return rate ? amount * rate : amount;
    },
    [getRate]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // The whole ledger — every figure on this page must describe all of it,
      // not one page. Walk pages until the server says stop.
      const { rows, complete } = await collectAllPages<SalesOrder>(
        async (pageNum) => {
          const res = await salesOrderService.list(token, {
            page: pageNum,
            limit: FETCH_PAGE,
          });
          return { rows: res.data ?? [], total: res.total ?? 0 };
        },
        { pageSize: FETCH_PAGE }
      );
      setDocs(rows);
      setTruncated(complete ? null : rows.length);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load sales data'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Catalog metadata — same public/meta endpoints the purchases analysis uses,
  // so category & brand attribution agree across both ledgers.
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

  useEffect(() => {
    try {
      setSavedSearches(
        JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as SavedSearch[]
      );
    } catch {
      /* malformed storage */
    }
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
        setSearchOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node))
        setSortPickerOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSortPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const filtered = useMemo(
    () => applySalesFilters(docs, filters, prodMeta),
    [docs, filters, prodMeta]
  );

  const groupBy = groupByStack[0] ?? null;
  // Second dimension powers the stacked Breakdown view; never let it mirror
  // the first — grouping revenue by Product & Product is noise.
  const groupBy2 =
    viewMode === 'stacked' && groupBy
      ? groupByStack[1] ?? (groupBy !== 'product' ? 'product' : 'customer')
      : null;

  const groupData = useMemo(() => {
    if (!groupBy) return [];
    return computeSalesGroupData(
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
    return computeSalesMultiSeries(
      filtered,
      groupBy,
      groupBy2,
      measure,
      prodMeta,
      toBase,
      sortStack
    );
  }, [filtered, groupBy, groupBy2, measure, prodMeta, toBase, sortStack]);

  const pivotData = useMemo(() => {
    if (viewMode !== 'pivot' || pivotRowDims.length === 0) return null;
    return computeSalesHierarchicalPivot(
      filtered,
      pivotRowDims,
      pivotColDims,
      measure,
      prodMeta,
      toBase
    );
  }, [viewMode, filtered, pivotRowDims, pivotColDims, measure, prodMeta, toBase]);

  const kpis = useMemo(() => {
    const live = filtered.filter(
      (o) =>
        o.orderStatus !== 'cancelled' &&
        !['rejected', 'expired'].includes(o.quoteStatus ?? '')
    );
    const ordersOnly = live.filter((o) => o.docType === 'order');
    const revenue = live.reduce((s, o) => s + (o.total ?? 0), 0);
    const outstanding = ordersOnly.reduce(
      (s, o) => s + Math.max(0, (o.total ?? 0) - (o.amountPaid ?? 0)),
      0
    );
    return {
      revenue,
      docCount: live.length,
      orderCount: ordersOnly.length,
      avgOrder: live.length > 0 ? revenue / live.length : 0,
      outstanding,
    };
  }, [filtered]);

  const dateItems = useMemo(() => buildDateFilterItems(new Date()), []);

  function toggleFilter(key: string) {
    setAppliedSearchName(null);
    setFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  function toggleGroupBy(key: SalesGroupByKey) {
    setAppliedSearchName(null);
    setGroupByStack((prev) =>
      prev.includes(key)
        ? prev.filter((g) => g !== key)
        : [...prev.slice(0, 1), key]
    );
  }

  function addSearchFilter(
    prefix:
      | 'customer_search:'
      | 'product_search:'
      | 'catname_search:'
      | 'salesperson_search:',
    query?: string
  ) {
    const q = (query ?? searchText).trim();
    if (!q) return;
    const key = `${prefix}${q}`;
    setAppliedSearchName(null);
    setFilters((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setSearchText('');
    setSearchOpen(false);
  }

  // The star in the saved-views list points at the view that IS the current
  // page state — no guessing which one is live.
  const matchesSavedId = useMemo(() => {
    const hit = savedSearches.find((s) =>
      savedSearchMatches(s, filters, groupByStack, measure)
    );
    return hit?.id ?? null;
  }, [savedSearches, filters, groupByStack, measure]);

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
    setGroupByStack([s.groupBy, s.groupBy2].filter(Boolean) as SalesGroupByKey[]);
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

  function getFilterLabel(key: string): string {
    if (key.startsWith('customer_search:'))
      return `Customer: ${key.slice(16)}`;
    if (key.startsWith('product_search:')) return `Product: ${key.slice(15)}`;
    if (key.startsWith('catname_search:')) return `Category: ${key.slice(16)}`;
    if (key.startsWith('salesperson_search:'))
      return `Salesperson: ${key.slice(19)}`;
    if (key.startsWith('category_'))
      return categories.find((c) => c._id === key.slice(9))?.name ?? 'Category';
    if (key.startsWith('brand_'))
      return brands.find((b) => b._id === key.slice(6))?.name ?? 'Brand';
    const stat = [...STATUS_FILTER_ITEMS, ...PAYMENT_FILTER_ITEMS].find(
      (f) => f.key === key
    );
    if (stat) return stat.label;
    if (key === 'not_cancelled') return 'Not Cancelled';
    if (key === 'type_order') return 'Orders only';
    if (key === 'type_quotation') return 'Quotations only';
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

  const filterChips = filters.map((f) => ({ key: f, label: getFilterLabel(f) }));

  const groupLabel = groupBy
    ? (ALL_SALES_GROUP_ITEMS.find((g) => g.key === groupBy)?.label ?? groupBy)
    : 'Customer';
  const groupLabel2 = groupBy2
    ? (ALL_SALES_GROUP_ITEMS.find((g) => g.key === groupBy2)?.label ?? groupBy2)
    : null;
  const measureLabel =
    SALES_MEASURES.find((m) => m.key === measure)?.label ?? measure;

  const totalValue = multiSeries
    ? multiSeries.rows.reduce((s, r) => s + r.__total__, 0)
    : groupData.reduce((s, r) => s + r.value, 0);
  const totalOrders = filtered.length;

  function openDrill(label: string, orders: SalesOrder[], seriesKey?: string) {
    if (orders.length === 0) return;
    const title = seriesKey
      ? `${groupLabel}: ${label} · ${groupLabel2}: ${seriesKey}`
      : `${groupLabel}: ${label}`;
    setDrill({ orders, title });
  }

  function exportCurrentView() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const num = (v: number) =>
      String(Math.round((Number.isFinite(v) ? v : 0) * 100) / 100);
    const lines: string[][] = [];
    if (multiSeries) {
      lines.push([esc(groupLabel), ...multiSeries.series.map(esc), esc('Total')]);
      multiSeries.rows.forEach((r) => {
        lines.push([
          esc(r.label),
          ...multiSeries.series.map((s) => num(Number(r[s] ?? 0))),
          num(r.__total__),
        ]);
      });
    } else {
      lines.push([esc(groupLabel), esc('Docs'), esc(measureLabel)]);
      groupData.forEach((r) => {
        lines.push([esc(r.label), String(r.orders), num(r.value)]);
      });
    }
    downloadCSV(lines.map((l) => l.join(',')).join('\n'), `sales-analysis-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6 h-[118px] animate-pulse rounded-2xl border border-gray-200 bg-white" />
        <div className="h-[440px] animate-pulse rounded-2xl border border-gray-200 bg-white" />
      </div>
    );
  }

  return (
    <div>
      <SalesAnalyticsHeader kpis={kpis} />

      {/* ── Control bar ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            panelOpen || filters.length > 0
              ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <PiFunnel className="h-3.5 w-3.5" />
          Filters &amp; Group By
          {filters.length > 0 && (
            <span className="rounded-full bg-[#b20202]/15 px-1.5 py-px text-[10px] font-bold">
              {filters.length}
            </span>
          )}
        </button>

        {groupByStack.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-teal-700 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
            <PiStack className="h-3 w-3 shrink-0" />
            {groupByStack
              .map(
                (k) =>
                  ALL_SALES_GROUP_ITEMS.find((g) => g.key === k)?.label ?? k
              )
              .join(' → ')}
            <button
              type="button"
              onClick={() => setGroupByStack([])}
              className="ml-0.5 rounded-full opacity-70 hover:opacity-100"
            >
              <PiX className="h-3 w-3" />
            </button>
          </span>
        )}

        <Dropdown
          label={`Measure: ${measureLabel}`}
          icon={<PiChartBar className="h-3.5 w-3.5" />}
        >
          {SALES_MEASURES.map((m) => (
            <DropItem
              key={m.key}
              label={m.label}
              selected={measure === m.key}
              onClick={() => setMeasure(m.key)}
            />
          ))}
        </Dropdown>

        {/* Sort stack */}
        <div ref={sortRef} className="relative flex items-center gap-1.5">
          {sortStack.map((s) => {
            const lbl =
              SORT_FIELDS.find((f) => f.field === s.field)?.label ?? s.field;
            return (
              <span
                key={s.field}
                className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700"
              >
                <button
                  type="button"
                  title="Toggle direction"
                  onClick={() =>
                    setSortStack((prev) =>
                      prev.map((x) =>
                        x.field === s.field
                          ? { ...x, dir: x.dir === 'desc' ? 'asc' : 'desc' }
                          : x
                      )
                    )
                  }
                  className="flex items-center gap-0.5 hover:text-sky-900"
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
                  className="hover:text-red-500"
                  onClick={() =>
                    setSortStack((prev) =>
                      prev.filter((x) => x.field !== s.field)
                    )
                  }
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
              {SORT_FIELDS.filter(
                (f) => !sortStack.some((s) => s.field === f.field)
              ).map((f) => (
                <button
                  key={f.field}
                  type="button"
                  onClick={() => {
                    setSortStack((prev) => [
                      ...prev,
                      { field: f.field, dir: 'desc' },
                    ]);
                    setSortPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
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
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  >
                    <PiArrowCounterClockwise className="h-3.5 w-3.5" />
                    Reset sort
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div ref={searchRef} className="relative min-w-[220px] flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSearchFilter('customer_search:');
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            placeholder="Search customer, product, category, or salesperson…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
          />
          {searchOpen && searchText.trim() && (
            <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
              {(
                [
                  {
                    prefix: 'customer_search:' as const,
                    icon: 'Customer',
                    hint: 'documents billed to this name',
                  },
                  {
                    prefix: 'product_search:' as const,
                    icon: 'Product',
                    hint: 'documents containing this line',
                  },
                  {
                    prefix: 'catname_search:' as const,
                    icon: 'Category',
                    hint: 'lines in a matching category',
                  },
                  {
                    prefix: 'salesperson_search:' as const,
                    icon: 'Salesperson',
                    hint: 'documents they sold',
                  },
                ]
              ).map(({ prefix, icon, hint }) => (
                <button
                  key={prefix}
                  type="button"
                  onMouseDown={(e) => {
                    // mousedown so the input keeps focus context; the click
                    // would otherwise blur before the filter lands.
                    e.preventDefault();
                    addSearchFilter(prefix);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  <span className="font-semibold text-gray-900">{icon}</span>
                  <span className="truncate">
                    for &ldquo;{searchText.trim()}&rdquo;
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-gray-300">
                    {hint}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'graph'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode('stacked')}
            disabled={!groupBy}
            title="Two-level breakdown"
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              viewMode === 'stacked'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Breakdown
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pivot')}
            title="Pivot table"
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'pivot'
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Pivot
          </button>
        </div>

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
      </div>

      {panelOpen && (
        <SalesAnalyticsFilterPanel
          filters={filters}
          toggleFilter={toggleFilter}
          onQuickFilter={addSearchFilter}
          onClearAll={() => {
            setFilters([]);
            setAppliedSearchName(null);
          }}
          matchesSavedId={matchesSavedId}
          dateItems={dateItems}
          statusItems={STATUS_FILTER_ITEMS}
          paymentItems={PAYMENT_FILTER_ITEMS}
          categories={categories}
          brands={brands}
          panelSearch={panelSearch}
          setPanelSearch={setPanelSearch}
          groupByStack={groupByStack}
          toggleGroupBy={toggleGroupBy}
          savedSearches={savedSearches}
          applySavedSearch={applySavedSearch}
          deleteSavedSearch={deleteSavedSearch}
          savingSearch={savingSearch}
          setSavingSearch={setSavingSearch}
          saveSearchName={saveSearchName}
          setSaveSearchName={setSaveSearchName}
          saveSearch={saveSearch}
        />
      )}

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
              className="flex items-center gap-1 rounded-full bg-[#b20202]/8 px-2.5 py-1 text-[11px] font-medium text-[#b20202]"
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

      {truncated !== null && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Showing the most recent {docs.length.toLocaleString()} documents —
          older history is excluded from every figure here.
        </div>
      )}

      {/* ── Chart / breakdown / pivot ── */}
      {viewMode === 'pivot' ? (
        <SalesAnalyticsPivot
          pivot={pivotData}
          rowDims={pivotRowDims}
          colDims={pivotColDims}
          measure={measure}
          heatMap={pivotHeatMap}
          showDocs={pivotShowDocs}
          rowSearch={pivotRowSearch}
          expandedRows={pivotExpandedRows}
          expandedCols={pivotExpandedCols}
          setRowDims={setPivotRowDims}
          setColDims={setPivotColDims}
          setHeatMap={setPivotHeatMap}
          setShowDocs={setPivotShowDocs}
          setRowSearch={setPivotRowSearch}
          setExpandedRows={setPivotExpandedRows}
          setExpandedCols={setPivotExpandedCols}
          onCellClick={(orders, title) => setDrill({ orders, title })}
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
              <span className="rounded-full bg-[#b20202]/8 px-2.5 py-1 text-xs font-semibold text-[#b20202]">
                {IS_CURRENCY[measure]
                  ? `₦${totalValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
                  : totalValue.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-1">
            {viewMode === 'stacked' && multiSeries ? (
              <SalesStackedChart
                rows={multiSeries.rows}
                series={multiSeries.series}
                measure={measure}
                groupBy={groupBy!}
                onCellClick={(rowLabel, seriesKey, orders) =>
                  openDrill(rowLabel, orders, seriesKey)
                }
              />
            ) : (
              <SalesMainChart
                data={groupData}
                chartType={chartType}
                measure={measure}
                groupBy={groupBy ?? 'customer'}
                measureLabel={measureLabel}
                totalValue={totalValue}
                totalOrders={totalOrders}
                onDrill={(label, orders) => openDrill(label, orders)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Insight widgets ── */}
      <SalesWidgetsGrid docs={filtered} prodMeta={prodMeta} toBase={toBase} />

      {drill && (
        <SalesDrillDrawer
          orders={drill.orders}
          title={drill.title}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
