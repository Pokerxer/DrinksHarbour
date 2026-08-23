// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';
import { subProductListColumns } from './columns';
import { TableClassNameProps } from '@core/components/table/table-types';
import cn from '@core/utils/class-names';
import { exportToCSV } from '@core/utils/export-to-csv';
import { subproductService } from '@/services/subproduct.service';
import toast from 'react-hot-toast';
import {
  PiArrowsClockwiseBold,
  PiPackageBold,
  PiDownloadBold,
  PiX,
  PiStack,
  PiPlus,
} from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

// Extracted components & types
import {
  AdvancedFilters,
  ColumnToggle,
  ProductGridCard,
  ProductGridCardCompact,
  ViewToggle,
} from './components';
import type { FilterConfig, ViewMode } from './components';
import CustomFilterModal, {
  applyRule,
  type ActiveCustomRules,
  type CustomRule,
} from './components/CustomFilterModal';
import OdooSearchPanel, {
  SP_FILTER_LABELS,
  SP_GROUP_LABELS,
  spLoadSaved,
  spPersistSaved,
  type SPChipField,
  type SPSearchChip,
  type SPSavedSearch,
  type SPFilterKey,
  type SPGroupKey,
} from './components/OdooSearchPanel';
import GridPagination, { PAGE_SIZE_OPTIONS } from './components/GridPagination';
import ExpandedSubProductRow from './components/ExpandedSubProductRow';
import SubProductSearchField from './components/SubProductSearchField';
import {
  LoadingSkeleton,
  StatsHeader,
  BulkActionsBar,
  EmptyState,
  ErrorState,
} from './components/states';
import { useSubProducts } from '@/hooks/use-sub-products';
import {
  saveSubProductSearchContext,
  loadSubProductSearchContext,
} from './search-context';
import {
  activeFilterCount,
  computeStats,
  filterSubProducts,
  groupSubProducts,
  sortSubProducts,
  initialFilters,
  type SubProductListItem,
  type GridSortKey,
} from './filtering';

// Types moved to filtering.ts; re-exported here for existing consumers that
// import them from this module (columns.tsx, ProductGridCard.tsx, …).
export type { SubProductListItem, SizeVariant } from './filtering';

// Sort options for grid / compact views (list view sorts via column headers).
const GRID_SORT_OPTIONS: { value: GridSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'price_asc', label: 'Price: low → high' },
  { value: 'price_desc', label: 'Price: high → low' },
  { value: 'stock_asc', label: 'Stock: low → high' },
  { value: 'stock_desc', label: 'Stock: high → low' },
  { value: 'best_selling', label: 'Best selling' },
];

/**
 * Runs an async task over a list with bounded concurrency. Bulk operations
 * used to be sequential awaits — 50 deletes meant 50 round-trips; now they
 * overlap (default 4 in flight) while staying gentle on the API.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const item = items[index++];
        try {
          await task(item);
          ok++;
        } catch {
          failed++;
        }
      }
    }
  );
  await Promise.all(workers);
  return { ok, failed };
}

/** Max in-flight requests for bulk operations (keeps API load bounded). */
const BULK_CONCURRENCY = 4;

/** Entry animation delay capped so the last card never waits seconds. */
const staggerDelay = (index: number) => ({
  transition: { delay: Math.min(index * 0.02, 0.3) },
});

export default function SubProductsTable({
  pageSize = 25,
  hideFilters = false,
  hidePagination = false,
  hideFooter = false,
  classNames = {
    container: 'border-0 shadow-none rounded-2xl overflow-auto',
    rowClassName: 'group hover:!bg-gray-50/80 transition-all duration-200',
    headerClassName: '!bg-gradient-to-r from-gray-50 to-gray-100',
    cellClassName: 'py-3 px-2',
  },
  paginationClassName,
}: {
  pageSize?: number;
  hideFilters?: boolean;
  hidePagination?: boolean;
  hideFooter?: boolean;
  classNames?: TableClassNameProps;
  paginationClassName?: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // ── View & selection state ──────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('grid');
  const [gridSelection, setGridSelection] = useState<Record<string, boolean>>(
    {}
  );
  const [gridPageSize, setGridPageSize] = useState<number>(
    PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 25
  );
  const [gridPageIndex, setGridPageIndex] = useState(0);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<
    'all' | 'published' | 'draft' | 'hidden'
  >('all');
  const [advancedFilters, setAdvancedFilters] =
    useState<FilterConfig>(initialFilters);

  // Grid/compact sort (list view sorts via its own column headers).
  const [gridSort, setGridSort] = useState<GridSortKey>('newest');

  // Odoo-style search panel state
  const [spActiveFilters, setSpActiveFilters] = useState<Set<SPFilterKey>>(
    new Set()
  );
  const [spGroupBy, setSpGroupBy] = useState<SPGroupKey | null>(null);
  const [spSavedSearches, setSpSavedSearches] = useState<SPSavedSearch[]>(() =>
    spLoadSaved()
  );
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchChips, setSearchChips] = useState<SPSearchChip[]>([]);
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false);
  const [activeCustomRules, setActiveCustomRules] =
    useState<ActiveCustomRules | null>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Restore saved search context (when navigating back from edit page) ──
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const ctx = loadSubProductSearchContext();
    if (!ctx) return;
    const s = ctx.state;
    setSearchQuery(s.searchQuery);
    setSearchChips(s.searchChips);
    setSpActiveFilters(new Set(s.spActiveFilters));
    setSpGroupBy(s.spGroupBy as any);
    setActiveCustomRules(s.activeCustomRules);
    setAdvancedFilters(s.advancedFilters);
    setStatusFilter(s.statusFilter);
    setVisibilityFilter(s.visibilityFilter as any);
    setGridSort(s.gridSort as any);
    setViewMode(s.viewMode as any);
    setGridPageIndex(s.gridPageIndex);
    setGridPageSize(s.gridPageSize);
  }, []);

  // ── Data hook ──────────────────────────────────────────────────────────────
  // The catalog is fetched in full once (server caps at 1000), then every
  // control — free-text search, status pills, visibility, advanced filters,
  // SP quick-filters, search chips, custom rules, sort and pagination — is
  // applied in-memory. This keeps a single, consistent code path so a filter
  // can never silently no-op the way a half-wired server/client hybrid did.
  const {
    items: allSubProducts,
    isLoading,
    isFetching,
    isRefreshing,
    error,
    refresh,
    stats: serverStats,
  } = useSubProducts(session?.user?.token, {
    initialPageSize: pageSize,
    clientSideMode: true,
  });

  // ── Outside-click handlers ─────────────────────────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        searchPanelRef.current &&
        !searchPanelRef.current.contains(e.target as Node)
      ) {
        setShowSearchPanel(false);
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Search chip handlers ───────────────────────────────────────────────────
  function addSearchChip(field: SPChipField, label: string) {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    setSearchChips((prev) => {
      const existing = prev.find((c) => c.field === field);
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id ? { ...c, query: `${c.query} or ${q}` } : c
        );
      }
      return [...prev, { id: Date.now().toString(), field, label, query: q }];
    });
    setSearchQuery('');
    setShowSearchDropdown(false);
    setShowSearchPanel(false);
    searchInputRef.current?.focus();
  }

  function removeSearchChip(id: string) {
    setSearchChips((prev) => prev.filter((c) => c.id !== id));
  }

  function clearAll() {
    setSearchQuery('');
    setSearchChips([]);
    setSpActiveFilters(new Set());
    setSpGroupBy(null);
    setActiveCustomRules(null);
  }

  // ── View-mode change resets selection & grid page ──────────────────────────
  const handleViewModeChange = useCallback(
    (newMode: 'list' | 'grid' | 'compact') => {
      setViewMode(newMode);
      setGridSelection({});
      setGridPageIndex(0);
    },
    []
  );

  // ── Client-side filtering ───────────────────────────────────────────────────
  // All filtering logic lives in ./filtering.ts as a pure, unit-tested
  // pipeline. Custom rules are compiled into a predicate here because the
  // rule engine (applyRule) belongs to CustomFilterModal.
  const customMatch = useMemo(() => {
    if (!activeCustomRules || activeCustomRules.rules.length === 0) return null;
    const { matchMode, includeArchived } = activeCustomRules;
    return (p: SubProductListItem) => {
      if (
        !includeArchived &&
        (p.status === 'archived' || p.status === 'discontinued')
      )
        return false;
      return matchMode === 'any'
        ? activeCustomRules.rules.some((r: CustomRule) => applyRule(p, r))
        : activeCustomRules.rules.every((r: CustomRule) => applyRule(p, r));
    };
  }, [activeCustomRules]);

  const filteredSubProducts = useMemo(
    () =>
      filterSubProducts(allSubProducts, {
        statusFilter,
        visibilityFilter,
        searchQuery,
        searchChips,
        quickFilters: spActiveFilters,
        customMatch,
        advancedFilters,
      }),
    [
      allSubProducts,
      statusFilter,
      visibilityFilter,
      searchQuery,
      searchChips,
      spActiveFilters,
      customMatch,
      advancedFilters,
    ]
  );

  // Prune grid selection keys that fell out of the filtered result set so the
  // "N selected" count always matches what bulk actions will operate on.
  useEffect(() => {
    setGridSelection((prev) => {
      const visible = new Set(
        filteredSubProducts.map((p) => String(p._id || p.id))
      );
      const staleKeys = Object.keys(prev).filter(
        (k) => prev[k] && !visible.has(k)
      );
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      for (const k of staleKeys) delete next[k];
      return next;
    });
  }, [filteredSubProducts]);

  // ── Sort (grid / compact views; list view sorts via column headers) ─────────
  const sortedForGrid = useMemo(
    () => sortSubProducts(filteredSubProducts, gridSort),
    [filteredSubProducts, gridSort]
  );

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => computeStats(allSubProducts, serverStats),
    [allSubProducts, serverStats]
  );

  // ── Grid page window & grouped products for Odoo group-by ───────────────────
  const gridTotalPages = Math.max(
    1,
    Math.ceil(sortedForGrid.length / gridPageSize)
  );
  const gridStart = gridPageIndex * gridPageSize;
  const gridEnd = gridStart + gridPageSize;
  const gridPageItems = useMemo(
    () => sortedForGrid.slice(gridStart, gridEnd),
    [sortedForGrid, gridStart, gridEnd]
  );
  // The page window is applied to the flat sorted list first, then that slice
  // is grouped — so grouped view honours pagination instead of rendering the
  // entire catalog at once.
  const spGroupedProducts = useMemo<[string, SubProductListItem[]][] | null>(
    () => (spGroupBy ? groupSubProducts(gridPageItems, spGroupBy) : null),
    [gridPageItems, spGroupBy]
  );

  // ── Active filter count ─────────────────────────────────────────────────────
  const activeFilterCountValue = useMemo(
    () => activeFilterCount(advancedFilters),
    [advancedFilters]
  );

  // ── Persist search context (debounced) ─────────────────────────────────────
  // Saves the ordered filtered product ids + current filter state so the edit
  // page can walk the same result set and the list restores on return.
  const searchContextState = useMemo(
    () => ({
      ids: sortedForGrid.map((p) => String(p._id || p.id)).filter(Boolean),
      state: {
        searchQuery,
        searchChips,
        spActiveFilters: Array.from(spActiveFilters),
        spGroupBy,
        activeCustomRules,
        advancedFilters,
        statusFilter,
        visibilityFilter,
        gridSort,
        viewMode,
        gridPageIndex,
        gridPageSize,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sortedForGrid,
      searchQuery,
      searchChips,
      spActiveFilters,
      spGroupBy,
      activeCustomRules,
      advancedFilters,
      statusFilter,
      visibilityFilter,
      gridSort,
      viewMode,
      gridPageIndex,
      gridPageSize,
    ]
  );

  useEffect(() => {
    if (!session?.user?.token) return;
    const t = setTimeout(() => saveSubProductSearchContext(searchContextState), 400);
    return () => clearTimeout(t);
  }, [searchContextState, session?.user?.token]);

  // ── Table setup (list view) ─────────────────────────────────────────────────
  const { table, setData } = useTanStackTable<SubProductListItem>({
    tableData: [],
    columnConfig: subProductListColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize },
      },
      getRowCanExpand: () => true,
      meta: {
        handleDeleteRow: async (row: SubProductListItem) => {
          if (!session?.user?.token) return;
          try {
            await subproductService.deleteSubProduct(
              row._id || row.id,
              session.user.token
            );
            refresh();
            toast.success('Deleted successfully');
          } catch (err: any) {
            toast.error(err.message || 'Failed to delete');
          }
        },
        handleMultipleDelete: async (rows: SubProductListItem[]) => {
          if (!session?.user?.token) return;
          const token = session.user.token;
          const ids = rows.map((r) => r._id || r.id);
          const { ok, failed } = await runWithConcurrency(
            ids,
            BULK_CONCURRENCY,
            (id) => subproductService.deleteSubProduct(id, token)
          );
          table.resetRowSelection();
          refresh();
          if (failed) toast.error(`Deleted ${ok}, failed ${failed}`);
          else toast.success(`Deleted ${ok} item${ok !== 1 ? 's' : ''}`);
        },
        handleArchiveRow: async (row: SubProductListItem) => {
          if (!session?.user?.token) return;
          try {
            await subproductService.archiveSubProduct(
              row._id || row.id,
              session.user.token
            );
            refresh();
            toast.success('Product archived');
          } catch (err: any) {
            toast.error(err.message || 'Failed to archive');
          }
        },
        handleRestoreRow: async (row: SubProductListItem) => {
          if (!session?.user?.token) return;
          try {
            await subproductService.restoreSubProduct(
              row._id || row.id,
              session.user.token
            );
            refresh();
            toast.success('Product restored');
          } catch (err: any) {
            toast.error(err.message || 'Failed to restore');
          }
        },
      },
      enableColumnResizing: false,
    },
  });

  // Sync filtered data to table (list view)
  useEffect(() => {
    setData(filteredSubProducts);
  }, [filteredSubProducts, setData]);

  // Reset pagination (grid + list) when the filtered/sorted result set changes
  useEffect(() => {
    setGridPageIndex(0);
    table.setPageIndex(0);
  }, [filteredSubProducts, gridSort, viewMode, gridPageSize, table]);

  // ── Selection helpers ───────────────────────────────────────────────────────
  // selectedData is intersected with the current result set in both modes, so
  // the count shown always equals what bulk actions will operate on.
  const selectedData =
    viewMode === 'list'
      ? table.getSelectedRowModel().rows.map((row) => row.original)
      : filteredSubProducts.filter((sp) => gridSelection[sp._id || sp.id]);

  const selectedCount = selectedData.length;

  // ── Bulk handlers ───────────────────────────────────────────────────────────
  const handleBulkExport = useCallback(() => {
    const dataToExport =
      selectedData.length > 0 ? selectedData : filteredSubProducts;
    const exportFields = dataToExport.map((sp) => ({
      ID: sp._id || sp.id,
      SKU: sp.sku,
      Product: sp.product?.name || 'N/A',
      Price: sp.baseSellingPrice,
      Cost: sp.costPrice,
      Currency: sp.currency,
      Stock: sp.totalStock,
      Available: sp.availableStock,
      Status: sp.status,
      Visibility: sp.isPublished ? 'Published' : 'Draft',
      Created: sp.createdAt,
    }));
    exportToCSV(
      exportFields,
      'ID,SKU,Product,Price,Cost,Currency,Stock,Available,Status,Visibility,Created',
      `subproduct_data_${dataToExport.length}`
    );
    toast.success(`Exported ${dataToExport.length} items`, {
      icon: <PiDownloadBold className="h-5 w-5" />,
    });
    if (viewMode === 'list') table.resetRowSelection();
    else setGridSelection({});
  }, [selectedData, filteredSubProducts, table, viewMode]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedData.length === 0) return;
    await table.options.meta?.handleMultipleDelete?.(selectedData);
    setGridSelection({});
  }, [selectedData, table]);

  const handleBulkUpdate = useCallback(
    async (fields: Record<string, any>) => {
      if (selectedData.length === 0 || !session?.user?.token) return;
      const token = session.user.token;
      const ids = selectedData.map((r) => r._id || r.id);
      const { ok, failed } = await runWithConcurrency(
        ids,
        BULK_CONCURRENCY,
        (id) => subproductService.updateSubProduct(id, fields, token)
      );
      refresh();
      if (viewMode === 'list') table.resetRowSelection();
      else setGridSelection({});
      if (failed) toast.error(`Updated ${ok}, failed ${failed}`);
      else toast.success(`Updated ${ok} product${ok !== 1 ? 's' : ''}`);
    },
    [selectedData, session?.user?.token, table, viewMode, refresh]
  );

  const handleSelectAll = useCallback(() => {
    if (viewMode === 'list') {
      table.toggleAllRowsSelected(true);
    } else {
      const all: Record<string, boolean> = {};
      filteredSubProducts.forEach((p) => {
        all[p._id || p.id] = true;
      });
      setGridSelection(all);
    }
  }, [viewMode, table, filteredSubProducts]);

  const handleBulkAction = useCallback(
    async (action: 'duplicate' | 'archive' | 'unarchive') => {
      if (selectedData.length === 0 || !session?.user?.token) return;
      const token = session.user.token;
      const ids = selectedData.map((r) => r._id || r.id);
      const service =
        action === 'duplicate'
          ? (id: string) => subproductService.duplicateSubProduct(id, token)
          : action === 'archive'
            ? (id: string) => subproductService.archiveSubProduct(id, token)
            : (id: string) => subproductService.restoreSubProduct(id, token);
      const { ok, failed } = await runWithConcurrency(ids, BULK_CONCURRENCY, service);
      if (viewMode === 'list') table.resetRowSelection();
      else setGridSelection({});
      if (failed) toast.error(`${ok} done, ${failed} failed`);
      else
        toast.success(
          `${ok} product${ok !== 1 ? 's' : ''} ${action === 'duplicate' ? 'duplicated' : `${action}d`}`
        );
      refresh();
    },
    [selectedData, session?.user?.token, table, viewMode, refresh]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  // '/' focuses search · 'r' refreshes · Escape de-escalates (close panels
  // first, then clear selection). Never fires while typing, and never
  // hijacks modifier combos (Cmd+R etc.). Filters are NOT reset by Escape —
  // that remains an explicit action.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      );
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refresh();
      } else if (e.key === 'Escape') {
        if (showSearchPanel || showSearchDropdown || showCustomFilterModal) {
          setShowSearchPanel(false);
          setShowSearchDropdown(false);
          setShowCustomFilterModal(false);
        } else if (viewMode === 'list') {
          table.resetRowSelection();
        } else {
          setGridSelection({});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    refresh,
    table,
    viewMode,
    showSearchPanel,
    showSearchDropdown,
    showCustomFilterModal,
  ]);

  // ── Filter handlers ─────────────────────────────────────────────────────────
  const handleStatusFilter = useCallback((filter: string) => {
    setStatusFilter((prev) => (prev === filter ? '' : filter));
  }, []);

  const handleAdvancedFilterChange = useCallback(
    (newFilters: FilterConfig) => setAdvancedFilters(newFilters),
    []
  );

  const handleResetFilters = useCallback(() => {
    setAdvancedFilters(initialFilters);
    setStatusFilter('');
    setVisibilityFilter('all');
    setSearchQuery('');
    setSearchChips([]);
    setSpActiveFilters(new Set());
    setSpGroupBy(null);
    setActiveCustomRules(null);
  }, []);

  // ── Loading / error / empty states ─────────────────────────────────────────
  if (
    sessionStatus === 'loading' ||
    (isLoading && allSubProducts.length === 0)
  ) {
    return (
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="h-10 w-64 animate-pulse rounded-xl bg-gray-200" />
            <div className="h-10 w-40 animate-pulse rounded-xl bg-gray-200" />
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && allSubProducts.length === 0) {
    return (
      <div className="space-y-6 pb-24">
        <StatsHeader
          stats={stats}
          activeFilter={statusFilter}
          onFilterChange={handleStatusFilter}
        />
        <ErrorState onRetry={refresh} message={error} />
      </div>
    );
  }

  if (allSubProducts.length === 0 && !isLoading) {
    return (
      <div className="space-y-6 pb-24">
        <StatsHeader
          stats={stats}
          activeFilter={statusFilter}
          onFilterChange={handleStatusFilter}
        />
        <EmptyState onClear={handleResetFilters} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">
      {/* ── Toolbar ── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        {/* Row 1: new | search | actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2.5 sm:gap-3 sm:px-4">
          {/* ── Create actions ──
              "New" creates a sub-product (this page's record); "Add Product"
              opens the catalog Product form for when the parent product the
              sub-product needs doesn't exist yet. Kept in one shrink-0 group
              so they wrap together rather than splitting across rows. */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(routes.eCommerce.createSubProduct)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#b20202] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#7f1d1d]"
            >
              <PiPlus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={() => router.push(routes.eCommerce.createProduct)}
              title="Create a catalog product"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
            >
              <PiPackageBold className="h-3.5 w-3.5" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="hidden h-5 w-px shrink-0 bg-gray-200 lg:block" />

          {/* Odoo search bar */}
          <div
            className="relative order-last w-full min-w-0 lg:order-none lg:w-auto lg:max-w-[44rem] lg:flex-1"
            ref={searchPanelRef}
          >
            <SubProductSearchField
              query={searchQuery}
              onQueryChange={(value) => {
                setSearchQuery(value);
                setShowSearchDropdown(value.trim().length > 0);
                if (value.trim()) setShowSearchPanel(false);
              }}
              showSuggestions={showSearchDropdown && Boolean(searchQuery.trim())}
              panelOpen={showSearchPanel || showSearchDropdown}
              inputRef={searchInputRef}
              activeFilters={spActiveFilters}
              onRemoveFilter={(f) =>
                setSpActiveFilters((prev) => {
                  const n = new Set(prev);
                  n.delete(f);
                  return n;
                })
              }
              groupByLabel={spGroupBy ? SP_GROUP_LABELS[spGroupBy] : null}
              onRemoveGroupBy={() => setSpGroupBy(null)}
              customRules={activeCustomRules}
              onRemoveCustomRules={() => setActiveCustomRules(null)}
              chips={searchChips}
              onRemoveChip={removeSearchChip}
              onRemoveLastChip={() =>
                removeSearchChip(searchChips[searchChips.length - 1].id)
              }
              onAddTermAsChip={(field, label) =>
                addSearchChip(field || 'product', label || 'Product')
              }
              onClearAll={clearAll}
              onTogglePanel={() => {
                setShowSearchPanel((v) => !v);
                setShowSearchDropdown(false);
              }}
              onCloseOverlays={() => {
                setShowSearchPanel(false);
                setShowSearchDropdown(false);
              }}
              onFocusInput={(hasText) => {
                if (!hasText) setShowSearchPanel(true);
                else setShowSearchDropdown(true);
              }}
              onOpenCustomFilterModal={() => {
                setShowSearchDropdown(false);
                setShowSearchPanel(false);
                setShowCustomFilterModal(true);
              }}
            />


            {showSearchPanel && (
              <OdooSearchPanel
                activeFilters={spActiveFilters}
                groupBy={spGroupBy}
                savedSearches={spSavedSearches}
                onToggleFilter={(f) =>
                  setSpActiveFilters((prev) => {
                    const n = new Set(prev);
                    n.has(f) ? n.delete(f) : n.add(f);
                    return n;
                  })
                }
                onSetGroupBy={(g) => setSpGroupBy(g)}
                onSave={(name) => {
                  const entry: SPSavedSearch = {
                    id: Date.now().toString(),
                    name,
                    query: searchQuery,
                    filters: Array.from(spActiveFilters),
                    groupBy: spGroupBy,
                    chips: searchChips,
                  };
                  const updated = [...spSavedSearches, entry];
                  setSpSavedSearches(updated);
                  spPersistSaved(updated);
                }}
                onLoadSaved={(s) => {
                  setSearchQuery(s.query);
                  setSpActiveFilters(new Set(s.filters));
                  setSpGroupBy(s.groupBy);
                  setSearchChips(s.chips || []);
                  setShowSearchPanel(false);
                }}
                onDeleteSaved={(id) => {
                  const updated = spSavedSearches.filter((s) => s.id !== id);
                  setSpSavedSearches(updated);
                  spPersistSaved(updated);
                }}
                onClose={() => setShowSearchPanel(false)}
                advancedFilters={advancedFilters}
                onAdvancedFilterChange={handleAdvancedFilterChange}
                onReset={handleResetFilters}
                activeFilterCount={activeFilterCountValue}
                onAddCustomFilter={() => {
                  setShowSearchPanel(false);
                  setShowCustomFilterModal(true);
                }}
              />
            )}
          </div>

          {/* ── Right controls ── */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {/* Visibility */}
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-600 outline-none transition-colors hover:border-gray-300 focus:border-gray-400"
            >
              <option value="all">All visibility</option>
              <option value="published">
                Published ({stats.published || 0})
              </option>
              <option value="draft">Draft ({stats.draft || 0})</option>
            </select>

            <div className="hidden h-5 w-px shrink-0 bg-gray-200 sm:block" />

            {/* Column toggle (list only) */}
            {viewMode === 'list' && <ColumnToggle table={table} />}

            {/* Sort (grid / compact only — list sorts via column headers) */}
            {viewMode !== 'list' && (
              <select
                value={gridSort}
                onChange={(e) => setGridSort(e.target.value as GridSortKey)}
                title="Sort products"
                className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-600 outline-none transition-colors hover:border-gray-300 focus:border-gray-400"
              >
                {GRID_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

            {/* View toggle */}
            <ViewToggle
              currentView={viewMode}
              onViewChange={handleViewModeChange}
            />

            <div className="hidden h-5 w-px shrink-0 bg-gray-200 sm:block" />

            {/* Refresh */}
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              title="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
            >
              <PiArrowsClockwiseBold
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              />
            </button>
          </div>
        </div>

        {/* Row 2: status filter pills + result count */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          {[
            { id: '', label: 'All', count: stats.total },
            { id: 'active', label: 'Active', count: stats.active },
            { id: 'low_stock', label: 'Low Stock', count: stats.lowStock },
            {
              id: 'out_of_stock',
              label: 'Out of Stock',
              count: stats.outOfStock,
            },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleStatusFilter(f.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                statusFilter === f.id
                  ? 'bg-[#b20202] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                  statusFilter === f.id
                    ? 'bg-white/20'
                    : 'bg-white text-gray-500'
                )}
              >
                {f.count}
              </span>
            </button>
          ))}

          {activeFilterCountValue > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-1 flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-[11px] text-gray-500 transition-colors hover:border-red-300 hover:text-red-500"
            >
              <PiX className="h-3 w-3" />
              {activeFilterCountValue} filter
              {activeFilterCountValue > 1 ? 's' : ''} active
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">
            {filteredSubProducts.length} of {allSubProducts.length} products
            {isFetching && ' · fetching…'}
          </span>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedData.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedData.length}
            totalCount={filteredSubProducts.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            onDuplicate={() => handleBulkAction('duplicate')}
            onArchive={() => handleBulkAction('archive')}
            onUnarchive={() => handleBulkAction('unarchive')}
            onSetStatus={(s) => handleBulkUpdate({ status: s })}
            onSetChannel={(f, v) => handleBulkUpdate({ [f]: v })}
            onClear={() => {
              if (viewMode === 'list') table.resetRowSelection();
              else setGridSelection({});
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      {filteredSubProducts.length === 0 && allSubProducts.length > 0 ? (
        <EmptyState onClear={handleResetFilters} />
      ) : viewMode === 'grid' || viewMode === 'compact' ? (
        /* ═══════════════ Grid View ═══════════════ */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl"
        >
          {spGroupedProducts ? (
            /* Grouped view — selection now wired to gridSelection (was hardcoded false) */
            <div className="space-y-6 p-3 sm:p-6">
              {spGroupedProducts.map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <div className="mb-3 flex items-center gap-2">
                    <PiStack className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-bold capitalize text-gray-700">
                      {groupName}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                      {groupItems.length}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'grid gap-3 sm:gap-4',
                      viewMode === 'grid'
                        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                        : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
                    )}
                  >
                    {groupItems.map((subProduct, index) => {
                      const productId = subProduct._id || subProduct.id;
                      const isSel = !!gridSelection[productId];
                      const onSel = () =>
                        setGridSelection((prev) => ({
                          ...prev,
                          [productId]: !prev[productId],
                        }));
                      return (
                        <motion.div
                          key={productId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          {...staggerDelay(index)}
                        >
                          {viewMode === 'grid' ? (
                            <ProductGridCard
                              product={subProduct}
                              isSelected={isSel}
                              onSelect={onSel}
                              onView={(p) =>
                                window.open(
                                  routes.eCommerce.editSubProduct(
                                    p._id || p.id
                                  ),
                                  '_blank'
                                )
                              }
                            />
                          ) : (
                            <ProductGridCardCompact
                              product={subProduct}
                              isSelected={isSel}
                              onSelect={onSel}
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'grid gap-3 p-3 sm:gap-4 sm:p-6',
                  viewMode === 'grid'
                    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                    : 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
                )}
              >
                {gridPageItems.map((subProduct, index) => {
                  const productId = subProduct._id || subProduct.id;
                  return (
                    <motion.div
                      key={productId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      {...staggerDelay(index)}
                    >
                      {viewMode === 'grid' ? (
                        <ProductGridCard
                          product={subProduct}
                          isSelected={!!gridSelection[productId]}
                          onSelect={() =>
                            setGridSelection((prev) => ({
                              ...prev,
                              [productId]: !prev[productId],
                            }))
                          }
                          onView={(p) =>
                            window.open(
                              routes.eCommerce.editSubProduct(p._id || p.id),
                              '_blank'
                            )
                          }
                        />
                      ) : (
                        <ProductGridCardCompact
                          product={subProduct}
                          isSelected={!!gridSelection[productId]}
                          onSelect={() =>
                            setGridSelection((prev) => ({
                              ...prev,
                              [productId]: !prev[productId],
                            }))
                          }
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Grid pagination: consistent page-size selector + page nav ── */}
              {!hidePagination && (
                <GridPagination
                  pageIndex={gridPageIndex}
                  pageSize={gridPageSize}
                  total={filteredSubProducts.length}
                  totalPages={gridTotalPages}
                  onPageChange={setGridPageIndex}
                  onPageSizeChange={(ps) => {
                    setGridPageSize(ps);
                    setGridPageIndex(0);
                  }}
                />
              )}
            </>
          )}
        </motion.div>
      ) : (
        /* ═══════════════ List View ═══════════════ */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <Table
            table={table}
            variant="modern"
            classNames={{
              container: 'rounded-none border-0',
              ...classNames,
            }}
            components={{
              expandedComponent: (row) => (
                <ExpandedSubProductRow subProduct={row.original as SubProductListItem} />
              ),
            }}
          />

          {!hidePagination && (
            <TablePagination
              table={table}
              className={cn(
                'border-t border-gray-100 bg-gray-50/50 p-4',
                paginationClassName
              )}
            />
          )}
        </motion.div>
      )}

      {/* Custom Filter Modal */}
      {showCustomFilterModal && (
        <CustomFilterModal
          onAdd={(rules, matchMode, includeArchived) => {
            setActiveCustomRules({ rules, matchMode, includeArchived });
            setShowCustomFilterModal(false);
          }}
          onCancel={() => setShowCustomFilterModal(false)}
        />
      )}
    </div>
  );
}

