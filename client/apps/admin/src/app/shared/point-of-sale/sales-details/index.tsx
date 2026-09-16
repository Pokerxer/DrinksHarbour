'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import { ShopHistorySelector } from '../components/shop-history-selector';
import { historyAccess } from '../shop-entry';
import { usePOSAuth, usePOSShopScope } from '../store';
import { isTokenExpired } from './helpers';
import { useSalesFilters } from './hooks/use-sales-filters';
import { useSalesData } from './hooks/use-sales-data';
import { useSalesExport } from './hooks/use-sales-export';
import { ControlBar } from './components/control-bar';
import { SummaryStrip } from './components/summary-strip';
import { LinesTable } from './components/lines-table';
import { GroupedTable } from './components/grouped-table';
import { ExportColumnModal } from './components/export-column-modal';
import { TableSkeleton } from './components/table-skeleton';
import { PAGE_SIZE, GROUP_PAGE_SIZE, GROUP_LABEL } from './constants';

export default function POSSalesDetails() {
  const { token: posToken } = usePOSAuth();
  const { shopId } = usePOSShopScope();
  const { data: session } = useSession();
  const { tenant } = useTenant();

  const sessionToken = useMemo(() => {
    const t = (session?.user as { token?: string })?.token ?? null;
    return isTokenExpired(t) ? null : t;
  }, [session]);

  const access = historyAccess(
    sessionToken,
    isTokenExpired(posToken) ? null : posToken,
    shopId
  );
  const token = access.token;
  const [selectedHistoryShop, setHistoryShop] = useState<string | null>(null);
  const historyShop = selectedHistoryShop || access.defaultShop;

  const filters = useSalesFilters();

  const data = useSalesData({
    token,
    historyShop,
    statusFilter: filters.statusFilter,
    cashierFilter: filters.cashierFilter,
    methodFilter: filters.methodFilter,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    timeFrom: filters.timeFrom,
    timeTo: filters.timeTo,
    debouncedSearch: filters.debouncedSearch,
    lineSortField: filters.lineSortField,
    lineSortDir: filters.lineSortDir,
    groupSortField: filters.groupSortField,
    groupSortDir: filters.groupSortDir,
    viewMode: filters.viewMode,
    groupBy: filters.groupBy,
  });

  const groupLabel = useMemo(() => GROUP_LABEL[filters.groupBy], [filters.groupBy]);

  const exp = useSalesExport({
    sorted: data.sorted,
    grouped: data.grouped,
    groupLabel,
    hasCostData: data.hasCostData,
    showProfit: filters.showProfit,
    viewMode: filters.viewMode,
    summary: data.summary,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    timeFrom: filters.timeFrom,
    timeTo: filters.timeTo,
    cashierFilter: filters.cashierFilter,
    methodFilter: filters.methodFilter,
    statusFilter: filters.statusFilter,
    storeName: tenant?.name || 'DrinksHarbour',
  });

  // Reset page on filter change
  const [page, setPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [
    filters.dateFrom, filters.dateTo, filters.timeFrom, filters.timeTo,
    filters.cashierFilter, filters.methodFilter, filters.statusFilter,
    filters.debouncedSearch, filters.lineSortField, filters.lineSortDir,
  ]);

  useEffect(() => {
    setGroupPage(1);
  }, [
    filters.dateFrom, filters.dateTo, filters.timeFrom, filters.timeTo,
    filters.cashierFilter, filters.methodFilter, filters.statusFilter,
    filters.debouncedSearch, filters.groupSortField, filters.groupSortDir,
    filters.groupBy,
  ]);

  // Export dropdown outside click
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exp.showExport) return;
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        exp.setShowExport(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exp.showExport]);

  // Pagination
  const paginatedLines = useMemo(
    () => data.sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data.sorted, page]
  );
  const paginatedGroups = useMemo(
    () => data.grouped.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE),
    [data.grouped, groupPage]
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <POSNavHeader />
      <div className="flex items-center gap-3 border-b bg-white px-5 py-3">
        <ShopHistorySelector
          token={token}
          value={historyShop}
          onChange={(value) => {
            setHistoryShop(value);
            setPage(1);
            setGroupPage(1);
          }}
        />
        {data.error && (
          <p role="alert" className="text-sm text-red-600">{data.error}</p>
        )}
      </div>

      <ControlBar
        statusFilter={filters.statusFilter}
        setStatusFilter={filters.setStatusFilter}
        setAllHiddenCols={() => filters.setHiddenCols(new Set())}
        statusCounts={data.statusCounts}
        viewMode={filters.viewMode}
        setViewMode={filters.setViewMode}
        groupBy={filters.groupBy}
        setGroupBy={filters.setGroupBy}
        showProfit={filters.showProfit}
        setShowProfit={filters.setShowProfit}
        hiddenCols={filters.hiddenCols}
        toggleCol={filters.toggleCol}
        vis={filters.vis}
        dateFrom={filters.dateFrom}
        setDateFrom={(v) => { filters.setDateFrom(v); filters.setActivePreset(''); }}
        dateTo={filters.dateTo}
        setDateTo={(v) => { filters.setDateTo(v); filters.setActivePreset(''); }}
        timeFrom={filters.timeFrom}
        setTimeFrom={(v) => { filters.setTimeFrom(v); filters.setActivePreset(''); }}
        timeTo={filters.timeTo}
        setTimeTo={(v) => { filters.setTimeTo(v); filters.setActivePreset(''); }}
        activePreset={filters.activePreset}
        applyPreset={filters.applyPreset}
        clearDateRange={filters.clearDateRange}
        cashierFilter={filters.cashierFilter}
        setCashierFilter={filters.setCashierFilter}
        methodFilter={filters.methodFilter}
        setMethodFilter={(v) => {
          filters.setMethodFilter(v);
          filters.setActivePreset('');
        }}
        cashierOptions={data.cashierOptions}
        hasCostData={data.hasCostData}
        search={filters.search}
        setSearch={filters.setSearch}
        debouncedSearch={filters.debouncedSearch}
        searchFocused={filters.searchFocused}
        setSearchFocused={filters.setSearchFocused}
        searchRef={filters.searchRef}
        filterChips={filters.filterChips}
        clearAll={filters.clearAll}
        orderCount={data.orders.length}
        filteredCount={data.filteredBase.length}
        allRowCount={data.allRows.length}
        truncated={data.truncated}
        loading={data.loading}
        onRefresh={data.refetch}
        onFetchAll={data.refetchAll}
        showExport={exp.showExport}
        setShowExport={exp.setShowExport}
        exportRef={exportRef}
        onExport={exp.handleExport}
        hasData={
          filters.viewMode === 'lines'
            ? data.sorted.length > 0
            : data.grouped.length > 0
        }
      />

      <SummaryStrip
        summary={data.summary}
        voidSummary={data.voidSummary}
        hasCostData={data.hasCostData}
        filteredCount={
          filters.viewMode === 'lines' ? data.sorted.length : data.grouped.length
        }
        statusFilter={filters.statusFilter}
      />

      <div className="flex-1 space-y-3 px-5 py-4">
        {data.loading ? (
          <TableSkeleton />
        ) : data.error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16">
            <p className="mt-3 text-sm font-medium text-red-700">{data.error}</p>
            <button
              type="button"
              onClick={data.refetch}
              className="mt-2 rounded-md bg-[#b20202] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#9a0101]"
            >
              Retry
            </button>
          </div>
        ) : filters.viewMode === 'lines' ? (
          <LinesTable
            rows={paginatedLines}
            sorted={data.sorted}
            hasCostData={data.hasCostData}
            hiddenCols={filters.hiddenCols}
            lineSortField={filters.lineSortField}
            lineSortDir={filters.lineSortDir}
            toggleLineSort={filters.toggleLineSort}
            vis={filters.vis}
            debouncedSearch={filters.debouncedSearch}
            showProfit={filters.showProfit}
            page={page}
            setPage={setPage}
            allRowCount={data.allRows.length}
          />
        ) : (
          <GroupedTable
            rows={paginatedGroups}
            grouped={data.grouped}
            groupLabel={groupLabel}
            hasCostData={data.hasCostData}
            showProfit={filters.showProfit}
            groupSortField={filters.groupSortField}
            groupSortDir={filters.groupSortDir}
            toggleGroupSort={filters.toggleGroupSort}
            debouncedSearch={filters.debouncedSearch}
            groupPage={groupPage}
            setGroupPage={setGroupPage}
            distinctOrderCount={data.distinctOrderCount}
            allRowCount={data.allRows.length}
          />
        )}

        {data.truncated && !data.loading && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <span>Showing first 500 orders only — older data may be missing.</span>
            <button
              type="button"
              onClick={data.refetchAll}
              className="ml-4 font-medium underline hover:no-underline"
            >
              Load all
            </button>
          </div>
        )}
      </div>

      {exp.exportDialog.open && (
        <ExportColumnModal
          format={exp.exportDialog.format}
          isGrouped={filters.viewMode === 'grouped'}
          hasCost={data.hasCostData && filters.showProfit}
          lineCols={exp.exportDialog.lineCols}
          groupCols={exp.exportDialog.groupCols}
          onToggleLine={exp.toggleExportLineCol}
          onToggleGroup={exp.toggleExportGroupCol}
          onSelectAll={exp.selectAllExportCols}
          onDeselectAll={exp.deselectAllExportCols}
          onCancel={() =>
            exp.setExportDialog((prev) => ({ ...prev, open: false }))
          }
          onDownload={exp.confirmExport}
        />
      )}
    </div>
  );
}