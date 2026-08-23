'use client';

// app/shared/warehouses/warehouse-analysis/index.tsx
// Orchestrator for the analysis page: owns view state, derives groupings, and
// composes the header / KPI / control / panel / chart sections. Data loading
// lives in use-analysis-data; pure math lives in warehouse-analysis-helpers.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { BASE_CURRENCY } from '../../purchases/types';
import {
  SAVED_KEY,
  ALL_GROUP_ITEMS,
  MEASURES,
  fmtMeasureVal,
  applyFilters,
  computeGroupData,
  computeMultiSeries,
  computeKpis,
  buildGroupedTableCSV,
  type GroupByKey,
  type ViewMode,
  type Measure,
  type ChartType,
  type SortCriterion,
  type SortField,
  type SavedSearch,
  computeHierarchicalPivot,
} from '../warehouse-analysis-helpers';
import { MainChart, StackedChart } from '../warehouse-analysis-charts';
import { PivotView } from '../warehouse-analysis-pivot';
import { StockDrillDrawer } from '../stock-drill-drawer';
import { AnalyticsWidgetsGrid } from '../warehouse-analysis-widgets';
import type { StockRow } from '@/services/warehouseStock.service';
import { useAnalysisData } from './use-analysis-data';
import AnalysisHeader from './analysis-header';
import KpiCards from './kpi-cards';
import ControlBar from './control-bar';
import FilterPanel from './filter-panel';
import FilterChips from './filter-chips';
import { AnalysisSkeleton } from './skeletons';
import { AnalysisEmptyState, AnalysisErrorState } from './states';

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function WarehouseAnalysis() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const { getRate } = useExchangeRates();

  const {
    phase,
    errorMessage,
    stock,
    categories,
    brands,
    prodMeta,
    reload,
  } = useAnalysisData();

  // ── View state ──
  const [filters, setFilters] = useState<string[]>([]);
  const [groupByStack, setGroupByStack] = useState<GroupByKey[]>(['warehouse']);
  const [measure, setMeasure] = useState<Measure>('stock_value');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [sortStack, setSortStack] = useState<SortCriterion[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [appliedSearchId, setAppliedSearchId] = useState<string | null>(null);

  const [drillData, setDrillData] = useState<{
    rows: StockRow[];
    title: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [pivotRowDims, setPivotRowDims] = useState<GroupByKey[]>(['warehouse']);
  const [pivotColDims, setPivotColDims] = useState<GroupByKey[]>([]);
  const [pivotHeatMap, setPivotHeatMap] = useState(true);
  const [pivotShowOrders, setPivotShowOrders] = useState(false);
  const [pivotRowSearch, setPivotRowSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());

  const groupBy = groupByStack[0] ?? null;
  const groupBy2 = groupByStack[1] ?? null;

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

  const persistSearches = useCallback((list: SavedSearch[]) => {
    setSavedSearches(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }, []);

  // Stock costs are stored in the NGN base; kept for purchases-analytics
  // parity and future multi-currency cost support.
  const toBase = useCallback(
    (amount: number, currency: string): number => {
      if (!currency || currency === BASE_CURRENCY) return amount;
      const rate = getRate(currency, BASE_CURRENCY);
      return rate ? amount * rate : amount;
    },
    [getRate]
  );

  // ── Derived data ──
  const filtered = useMemo(
    () => applyFilters(stock, filters, prodMeta),
    [stock, filters, prodMeta]
  );

  const kpis = useMemo(() => computeKpis(filtered, toBase), [filtered, toBase]);

  const groupData = useMemo(() => {
    if (!groupBy) return [];
    return computeGroupData(filtered, groupBy, measure, prodMeta, toBase, sortStack);
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

  const pivotData = useMemo(() => {
    if (viewMode !== 'pivot' || pivotRowDims.length === 0) return null;
    return computeHierarchicalPivot(
      filtered,
      pivotRowDims,
      pivotColDims,
      measure,
      prodMeta,
      toBase
    );
  }, [viewMode, filtered, pivotRowDims, pivotColDims, measure, prodMeta, toBase]);

  // Widget rollups
  const widgetRollups = useMemo(
    () => ({
      topProducts: computeGroupData(filtered, 'product', 'stock_value', prodMeta, toBase, []),
      byWarehouse: computeGroupData(filtered, 'warehouse', 'stock_value', prodMeta, toBase, []),
      topCategories: computeGroupData(filtered, 'product_category', 'on_hand_qty', prodMeta, toBase, []),
      statusRows: computeGroupData(filtered, 'stock_status', 'stock_value', prodMeta, toBase, []),
      expiryRows: computeGroupData(filtered, 'expiry', 'stock_value', prodMeta, toBase, []),
    }),
    [filtered, prodMeta, toBase]
  );

  const groupLabel = groupBy
    ? (ALL_GROUP_ITEMS.find((g) => g.key === groupBy)?.label ?? groupBy)
    : 'Warehouse';
  const groupLabel2 = groupBy2
    ? (ALL_GROUP_ITEMS.find((g) => g.key === groupBy2)?.label ?? groupBy2)
    : null;
  const measureLabel =
    MEASURES.find((m) => m.key === measure)?.label ?? measure;

  const totalValue = multiSeries
    ? multiSeries.rows.reduce((s, r) => s + r.__total__, 0)
    : groupData.reduce((s, r) => s + r.value, 0);

  // ── Handlers ──
  function toggleFilter(key: string) {
    setAppliedSearchId(null);
    setFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  function toggleGroupBy(key: GroupByKey) {
    setAppliedSearchId(null);
    setGroupByStack((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
  }

  const addSort = useCallback((field: SortField) => {
    setSortStack((prev) =>
      prev.some((s) => s.field === field) ? prev : [...prev, { field, dir: 'desc' }]
    );
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

  const saveSearch = useCallback(
    (name: string) => {
      const s: SavedSearch = {
        id: Date.now().toString(),
        name,
        filters,
        groupBy: groupByStack[0] ?? null,
        groupBy2: groupByStack[1] ?? null,
        measure,
        sortStack,
        chartType,
        viewMode,
      };
      persistSearches([...savedSearches, s]);
    },
    [filters, groupByStack, measure, sortStack, chartType, viewMode, savedSearches, persistSearches]
  );

  const applySavedSearch = useCallback((s: SavedSearch) => {
    setFilters(s.filters);
    const stack: GroupByKey[] = [];
    if (s.groupBy) stack.push(s.groupBy);
    if (s.groupBy2) stack.push(s.groupBy2);
    setGroupByStack(stack.length > 0 ? stack : ['warehouse']);
    setMeasure(s.measure);
    // v2 fields restore the whole view; older saves fall back to defaults.
    setSortStack(s.sortStack ?? []);
    if (s.viewMode) setViewMode(s.viewMode);
    if (s.chartType) setChartType(s.chartType);
    setAppliedSearchId(s.id);
  }, []);

  const deleteSavedSearch = useCallback(
    (id: string) => {
      persistSearches(savedSearches.filter((s) => s.id !== id));
      if (appliedSearchId === id) setAppliedSearchId(null);
    },
    [savedSearches, appliedSearchId, persistSearches]
  );

  // A favorite is "active" when its core definition matches the current view.
  const activeSearchId = useMemo(() => {
    const norm = (a: string[]) => [...a].sort().join('|');
    return (
      savedSearches.find(
        (s) =>
          norm(s.filters) === norm(filters) &&
          (s.groupBy ?? null) === (groupByStack[0] ?? null) &&
          (s.groupBy2 ?? null) === (groupByStack[1] ?? null) &&
          s.measure === measure
      )?.id ?? null
    );
  }, [savedSearches, filters, groupByStack, measure]);

  const appliedSearchName = useMemo(
    () => savedSearches.find((s) => s.id === appliedSearchId)?.name ?? null,
    [savedSearches, appliedSearchId]
  );

  function getFilterLabel(key: string): string {
    if (key.startsWith('product_search:')) return `Product: ${key.slice(15)}`;
    if (key.startsWith('warehouse_search:'))
      return `Warehouse: ${key.slice(17)}`;
    if (key.startsWith('catname_search:')) return `Category: ${key.slice(15)}`;
    if (key.startsWith('category_')) {
      const id = key.slice(9);
      return categories.find((c) => c._id === id)?.name || 'Category';
    }
    if (key.startsWith('subcategory_')) {
      const id = key.slice(12);
      return categories.find((c) => c._id === id)?.name || 'Subcategory';
    }
    if (key.startsWith('brand_')) {
      const id = key.slice(6);
      return brands.find((b) => b._id === id)?.name || 'Brand';
    }
    return key;
  }

  function openDrill(label: string, list: StockRow[], seriesKey?: string) {
    if (list.length === 0) return;
    const title = seriesKey
      ? `${groupLabel}: ${label} · ${groupLabel2}: ${seriesKey || '—'}`
      : `${groupLabel}: ${label}`;
    setDrillData({ rows: list, title });
  }

  const handleExportTableCsv = useCallback(() => {
    if (groupData.length === 0) return;
    const csv = buildGroupedTableCSV(groupData, groupLabel, measureLabel, measure);
    downloadTextFile(csv, `warehouse-analysis-${measure}-${Date.now()}.csv`);
  }, [groupData, groupLabel, measureLabel, measure]);

  // ── Render ──
  if (phase === 'loading') return <AnalysisSkeleton />;

  if (phase === 'error') {
    return (
      <div>
        <AnalysisHeader loading={false} onRefresh={reload} />
        <AnalysisErrorState message={errorMessage} onRetry={reload} />
      </div>
    );
  }

  if (stock.length === 0) {
    return (
      <div>
        <AnalysisHeader loading={false} onRefresh={reload} />
        <AnalysisEmptyState />
      </div>
    );
  }

  return (
    <div>
      <AnalysisHeader loading={false} onRefresh={reload} />

      <KpiCards kpis={kpis} />

      <ControlBar
        active={panelOpen || filters.length > 0}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        filtersCount={filters.length}
        groupByStack={groupByStack}
        onClearGroupBy={() => setGroupByStack([])}
        measure={measure}
        onMeasureChange={(m) => {
          setAppliedSearchId(null);
          setMeasure(m);
        }}
        sortStack={sortStack}
        onAddSort={addSort}
        onRemoveSort={removeSort}
        onToggleSortDir={toggleSortDir}
        onResetSort={() => setSortStack([])}
        onSearchFilter={(prefix, term) => {
          if (!term.trim()) return;
          setAppliedSearchId(null);
          setFilters((prev) =>
            prev.includes(`${prefix}${term.trim()}`)
              ? prev
              : [...prev, `${prefix}${term.trim()}`]
          );
        }}
        chartType={chartType}
        onChartTypeChange={setChartType}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {panelOpen && (
        <FilterPanel
          filters={filters}
          onToggleFilter={toggleFilter}
          groupByStack={groupByStack}
          onToggleGroupBy={toggleGroupBy}
          categories={categories}
          brands={brands}
          savedSearches={savedSearches}
          activeSearchId={activeSearchId}
          onApplySearch={applySavedSearch}
          onDeleteSearch={deleteSavedSearch}
          onSaveSearch={saveSearch}
        />
      )}

      <FilterChips
        chips={filters.map((f) => ({ key: f, label: getFilterLabel(f) }))}
        appliedSearchName={appliedSearchName}
        onRemove={toggleFilter}
        onClearAll={() => {
          setFilters([]);
          setAppliedSearchId(null);
        }}
      />

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
          onCellClick={(rows, title) => setDrillData({ rows, title })}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#ece4d6] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#2a2420]">
              {measureLabel} by {groupLabel}
              {groupLabel2 ? ` & ${groupLabel2}` : ''}
            </h2>
            <span className="bg-[#b20202]/8 rounded-full px-2.5 py-1 text-xs font-semibold text-[#b20202]">
              Total: {fmtMeasureVal(totalValue, measure)}
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
                onSegmentClick={(rowLabel, seriesKey, list) =>
                  openDrill(rowLabel, list, seriesKey)
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
                totalOrders={filtered.length}
                onBarClick={(label, list) => openDrill(label, list)}
                onExportCsv={handleExportTableCsv}
              />
            )}
          </div>
        </div>
      )}

      <AnalyticsWidgetsGrid
        topProducts={widgetRollups.topProducts}
        byWarehouse={widgetRollups.byWarehouse}
        topCategories={widgetRollups.topCategories}
        statusRows={widgetRollups.statusRows}
        expiryRows={widgetRollups.expiryRows}
      />

      {drillData && (
        <StockDrillDrawer
          rows={drillData.rows}
          title={drillData.title}
          onClose={() => setDrillData(null)}
        />
      )}
    </div>
  );
}

