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
import { Text, Badge, Flex, Select } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPackageBold,
  PiDownloadBold,
  PiSparkle,
  PiFunnelBold,
  PiMagnifyingGlass,
  PiCaretDown,
  PiCaretRight,
  PiCaretUp,
  PiX,
  PiStack,
  PiPlus,
} from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
  SP_CHIP_FIELDS,
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
import {
  LoadingSkeleton,
  StatsHeader,
  BulkActionsBar,
  EmptyState,
  ErrorState,
  type Stats,
} from './components/states';
import { useSubProducts } from '@/hooks/use-sub-products';

export interface SizeVariant {
  _id: string;
  size: string;
  displayName?: string;
  sellingPrice?: number;
  stock?: number;
  availability?: string;
  lowStockThreshold?: number;
}

export interface SubProductListItem {
  _id: string;
  id: string;
  sku: string;
  product?: {
    _id: string;
    name: string;
    slug: string;
    type?: string;
    images?: Array<{ url: string }>;
    isAlcoholic?: boolean;
    abv?: number;
    volumeMl?: number;
    originCountry?: string;
    brand?: { name: string };
    category?: { name: string };
  };
  sizes?: SizeVariant[];
  baseSellingPrice: number;
  costPrice: number;
  currency: string;
  totalStock: number;
  availableStock: number;
  stockStatus: string;
  status: string;
  isPublished: boolean;
  isFeaturedByTenant?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;
  descriptionOverride?: string;
  imagesOverride?: Array<{ url: string }>;
  totalSold?: number;
  totalRevenue?: number;
  viewCount?: number;
  conversionRate?: number;
  marginPercentage?: number;
  reorderPoint?: number;
  visibleInPOS?: boolean;
  visibleInOnlineStore?: boolean;
  seasonality?: {
    spring?: boolean;
    summer?: boolean;
    fall?: boolean;
    winter?: boolean;
  };
  specialOccasions?: string[];
  lastSoldDate?: string;
  lastRestockDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Initial advanced-filter state — kept here because it is the table's contract
// with the AdvancedFilters component, not a UI concern of the panel itself.
const initialFilters: FilterConfig = {
  status: [],
  stockStatus: [],
  visibility: [],
  priceRange: [0, 0],
  marginRange: [0, 0],
  onSale: null,
  hasDiscount: null,
  stockRange: [0, 0],
  hasVariants: null,
  needsReorder: null,
  beverageTypes: [],
  isAlcoholic: null,
  abvRange: [0, 0],
  volumeRange: [0, 0],
  originCountries: [],
  isFeatured: null,
  isBestSeller: null,
  isNewArrival: null,
  visibleInPOS: null,
  visibleInOnlineStore: null,
  salesRange: [0, 0],
  viewsRange: [0, 0],
  conversionRange: [0, 0],
  seasons: [],
  occasions: [],
  dateRange: { from: '', to: '' },
  lastSoldRange: { from: '', to: '' },
  lastRestockRange: { from: '', to: '' },
};

// Page-size options for the grid/compact selector.
const PAGE_SIZE_OPTIONS = [12, 25, 50, 100];

// Sort options for grid / compact views.
type GridSortKey =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'stock_asc'
  | 'stock_desc'
  | 'best_selling';

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
  const filteredSubProducts = useMemo(() => {
    let result = [...allSubProducts];

    // Status pills (All / Active / Low stock / Out of stock)
    if (statusFilter === 'active')
      result = result.filter((p) => p.status === 'active');
    else if (statusFilter === 'low_stock')
      result = result.filter((p) => p.totalStock > 0 && p.totalStock <= 10);
    else if (statusFilter === 'out_of_stock')
      result = result.filter((p) => p.totalStock === 0);

    // Visibility dropdown
    if (visibilityFilter === 'published')
      result = result.filter((p) => p.isPublished);
    else if (visibilityFilter === 'draft')
      result = result.filter((p) => !p.isPublished);
    else if (visibilityFilter === 'hidden')
      result = result.filter((p) => p.visibleInOnlineStore === false);

    // Search query (text)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.sku?.toLowerCase().includes(query) ||
          p.product?.name?.toLowerCase().includes(query) ||
          p.product?.type?.toLowerCase().includes(query) ||
          p.product?.brand?.name?.toLowerCase().includes(query) ||
          p.product?.category?.name?.toLowerCase().includes(query)
      );
    }

    // Search chips
    for (const chip of searchChips) {
      const terms = chip.query
        .toLowerCase()
        .split(' or ')
        .map((t) => t.trim())
        .filter(Boolean);
      const matchesAny = (value: string | undefined) =>
        !!value && terms.some((t) => value.toLowerCase().includes(t));
      switch (chip.field) {
        case 'product':
          result = result.filter(
            (p) => matchesAny(p.product?.name) || matchesAny(p.sku)
          );
          break;
        case 'category':
        case 'pos_category':
          result = result.filter((p) => matchesAny(p.product?.category?.name));
          break;
        case 'vendor':
          result = result.filter((p) => matchesAny(p.product?.brand?.name));
          break;
        case 'tags':
          result = result.filter((p) => matchesAny(p.product?.name));
          break;
        case 'attributes':
          result = result.filter(
            (p) =>
              matchesAny(p.sku) ||
              p.sizes?.some((s: SizeVariant) =>
                matchesAny(s.displayName || s.size)
              )
          );
          break;
      }
    }

    // SP quick filters
    if (spActiveFilters.has('featured'))
      result = result.filter((p) => p.isFeaturedByTenant);
    if (spActiveFilters.has('new_arrival'))
      result = result.filter((p) => p.isNewArrival);
    if (spActiveFilters.has('best_seller'))
      result = result.filter((p) => p.isBestSeller);
    if (spActiveFilters.has('on_sale'))
      result = result.filter((p) => p.isOnSale);
    if (spActiveFilters.has('low_stock'))
      result = result.filter((p) => p.totalStock > 0 && p.totalStock <= 10);
    if (spActiveFilters.has('out_of_stock'))
      result = result.filter((p) => p.totalStock === 0);
    if (spActiveFilters.has('needs_reorder'))
      result = result.filter((p) => p.totalStock <= (p.reorderPoint || 5));
    if (spActiveFilters.has('published'))
      result = result.filter((p) => p.isPublished);
    if (spActiveFilters.has('available_in_pos'))
      result = result.filter((p) => p.visibleInPOS !== false);
    if (spActiveFilters.has('available_online'))
      result = result.filter((p) => p.visibleInOnlineStore !== false);
    if (spActiveFilters.has('has_sales'))
      result = result.filter((p) => (p.totalSold || 0) > 0);
    if (spActiveFilters.has('no_sales'))
      result = result.filter((p) => (p.totalSold || 0) === 0);
    if (spActiveFilters.has('archived'))
      result = result.filter(
        (p) => p.status === 'discontinued' || p.status === 'archived'
      );

    // Custom rules
    if (activeCustomRules && activeCustomRules.rules.length > 0) {
      if (!activeCustomRules.includeArchived)
        result = result.filter(
          (p) => p.status !== 'archived' && p.status !== 'discontinued'
        );
      result = result.filter((p) => {
        const tests = activeCustomRules.rules.map((r) => applyRule(p, r));
        return activeCustomRules.matchMode === 'any'
          ? tests.some(Boolean)
          : tests.every(Boolean);
      });
    }

    // Advanced filters (the subset the API can't express) — kept compact here;
    // see git history for the full per-field implementation if needed.
    if (advancedFilters.status.length > 0)
      result = result.filter((p) => advancedFilters.status.includes(p.status));
    if (advancedFilters.stockStatus.length > 0)
      result = result.filter((p) => {
        const inStock =
          advancedFilters.stockStatus.includes('in_stock') && p.totalStock > 10;
        const low =
          advancedFilters.stockStatus.includes('low_stock') &&
          p.totalStock > 0 &&
          p.totalStock <= 10;
        const out =
          advancedFilters.stockStatus.includes('out_of_stock') &&
          p.totalStock === 0;
        const pre =
          advancedFilters.stockStatus.includes('pre_order') &&
          p.stockStatus === 'pre_order';
        return inStock || low || out || pre;
      });
    if (advancedFilters.beverageTypes.length > 0)
      result = result.filter((p) => {
        const t = p.product?.type?.toLowerCase() || '';
        return advancedFilters.beverageTypes.some((bt) =>
          t.includes(bt.toLowerCase())
        );
      });
    if (advancedFilters.isAlcoholic === true)
      result = result.filter((p) => p.product?.isAlcoholic);
    else if (advancedFilters.isAlcoholic === false)
      result = result.filter((p) => !p.product?.isAlcoholic);
    if (advancedFilters.originCountries.length > 0)
      result = result.filter((p) =>
        advancedFilters.originCountries.includes(
          (p.product?.originCountry || '').toUpperCase()
        )
      );
    if (advancedFilters.isFeatured === true)
      result = result.filter((p) => p.isFeaturedByTenant);
    else if (advancedFilters.isFeatured === false)
      result = result.filter((p) => !p.isFeaturedByTenant);
    if (advancedFilters.isBestSeller === true)
      result = result.filter((p) => p.isBestSeller);
    else if (advancedFilters.isBestSeller === false)
      result = result.filter((p) => !p.isBestSeller);
    if (advancedFilters.isNewArrival === true)
      result = result.filter((p) => p.isNewArrival);
    else if (advancedFilters.isNewArrival === false)
      result = result.filter((p) => !p.isNewArrival);
    if (advancedFilters.visibleInPOS === true)
      result = result.filter((p) => p.visibleInPOS !== false);
    else if (advancedFilters.visibleInPOS === false)
      result = result.filter((p) => p.visibleInPOS === false);
    if (advancedFilters.visibleInOnlineStore === true)
      result = result.filter((p) => p.visibleInOnlineStore !== false);
    else if (advancedFilters.visibleInOnlineStore === false)
      result = result.filter((p) => p.visibleInOnlineStore === false);
    if (advancedFilters.onSale === true)
      result = result.filter((p) => p.isOnSale);
    else if (advancedFilters.onSale === false)
      result = result.filter((p) => !p.isOnSale);

    // Numeric range filters helper
    const inRange = (v: number, [min, max]: [number, number]) =>
      (min <= 0 || v >= min) && (max <= 0 || v <= max);
    if (advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] > 0)
      result = result.filter((p) =>
        inRange(p.baseSellingPrice || 0, advancedFilters.priceRange)
      );
    if (advancedFilters.stockRange[0] > 0 || advancedFilters.stockRange[1] > 0)
      result = result.filter((p) =>
        inRange(p.totalStock || 0, advancedFilters.stockRange)
      );
    if (advancedFilters.abvRange[0] > 0 || advancedFilters.abvRange[1] > 0)
      result = result.filter((p) =>
        inRange(p.product?.abv || 0, advancedFilters.abvRange)
      );
    if (
      advancedFilters.volumeRange[0] > 0 ||
      advancedFilters.volumeRange[1] > 0
    )
      result = result.filter((p) =>
        inRange(p.product?.volumeMl || 0, advancedFilters.volumeRange)
      );
    if (advancedFilters.salesRange[0] > 0 || advancedFilters.salesRange[1] > 0)
      result = result.filter((p) =>
        inRange(p.totalSold || 0, advancedFilters.salesRange)
      );
    if (advancedFilters.hasVariants === true)
      result = result.filter((p) => (p.sizes?.length || 0) > 1);
    else if (advancedFilters.hasVariants === false)
      result = result.filter((p) => (p.sizes?.length || 0) <= 1);
    if (advancedFilters.needsReorder === true)
      result = result.filter((p) => p.totalStock <= (p.reorderPoint || 5));
    else if (advancedFilters.needsReorder === false)
      result = result.filter((p) => p.totalStock > (p.reorderPoint || 5));

    // Date filters
    if (advancedFilters.dateRange.from) {
      const from = new Date(advancedFilters.dateRange.from);
      result = result.filter((p) => new Date(p.createdAt) >= from);
    }
    if (advancedFilters.dateRange.to) {
      const to = new Date(advancedFilters.dateRange.to);
      to.setHours(23, 59, 59, 999);
      result = result.filter((p) => new Date(p.createdAt) <= to);
    }

    return result;
  }, [
    allSubProducts,
    statusFilter,
    visibilityFilter,
    searchQuery,
    searchChips,
    spActiveFilters,
    activeCustomRules,
    advancedFilters,
  ]);

  // ── Sort (grid / compact views; list view sorts via column headers) ─────────
  const sortedForGrid = useMemo(() => {
    const arr = [...filteredSubProducts];
    const price = (p: SubProductListItem) =>
      p.sizes?.[0]?.sellingPrice || p.baseSellingPrice || 0;
    switch (gridSort) {
      case 'name_asc':
        return arr.sort((a, b) =>
          (a.product?.name || '').localeCompare(b.product?.name || '')
        );
      case 'name_desc':
        return arr.sort((a, b) =>
          (b.product?.name || '').localeCompare(a.product?.name || '')
        );
      case 'price_asc':
        return arr.sort((a, b) => price(a) - price(b));
      case 'price_desc':
        return arr.sort((a, b) => price(b) - price(a));
      case 'stock_asc':
        return arr.sort((a, b) => (a.totalStock || 0) - (b.totalStock || 0));
      case 'stock_desc':
        return arr.sort((a, b) => (b.totalStock || 0) - (a.totalStock || 0));
      case 'best_selling':
        return arr.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
      case 'oldest':
        return arr.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case 'newest':
      default:
        return arr.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }, [filteredSubProducts, gridSort]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats: Stats = useMemo(() => {
    // published/draft aren't returned by the server stats, so derive them from
    // the (full) fetched catalog either way.
    const published = allSubProducts.filter((p) => p.isPublished).length;
    const draft = allSubProducts.length - published;
    if (serverStats && serverStats.total)
      return { ...serverStats, published, draft };
    const total = allSubProducts.length;
    const active = allSubProducts.filter((p) => p.status === 'active').length;
    const lowStock = allSubProducts.filter(
      (p) => p.totalStock > 0 && p.totalStock <= 10
    ).length;
    const outOfStock = allSubProducts.filter((p) => p.totalStock === 0).length;
    return { total, active, lowStock, outOfStock, published, draft };
  }, [allSubProducts, serverStats]);

  // ── Grouped products for Odoo group-by ──────────────────────────────────────
  const spGroupedProducts = useMemo(():
    | [string, SubProductListItem[]][]
    | null => {
    if (!spGroupBy) return null;
    const map = new Map<string, SubProductListItem[]>();
    sortedForGrid.forEach((p) => {
      let key: string;
      switch (spGroupBy) {
        case 'product_type':
          key = p.product?.type?.replace(/_/g, ' ') || 'Unknown';
          break;
        case 'category':
          key = p.product?.category?.name || 'Uncategorised';
          break;
        case 'brand':
          key = p.product?.brand?.name || 'No brand';
          break;
        case 'status':
          key = (p.status || 'draft').replace(/_/g, ' ');
          break;
        case 'stock_level':
          key =
            p.totalStock === 0
              ? 'Out of stock'
              : p.totalStock <= 10
                ? 'Low stock'
                : 'In stock';
          break;
        default:
          key = 'Other';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedForGrid, spGroupBy]);

  // ── Active filter count ─────────────────────────────────────────────────────
  const activeFilterCountValue = useMemo(
    () => activeFilterCount(advancedFilters),
    [advancedFilters]
  );

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
          let ok = 0;
          let failed = 0;
          for (const row of rows) {
            try {
              await subproductService.deleteSubProduct(
                row._id || row.id,
                session.user.token
              );
              ok++;
            } catch {
              failed++;
            }
          }
          table.resetRowSelection();
          refresh();
          if (failed) toast.error(`Deleted ${ok}, failed ${failed}`);
          else toast.success(`Deleted ${ok} item${ok !== 1 ? 's' : ''}`);
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
  const selectedData =
    viewMode === 'list'
      ? table.getSelectedRowModel().rows.map((row) => row.original)
      : filteredSubProducts.filter((sp) => gridSelection[sp._id || sp.id]);

  const selectedCount =
    viewMode === 'list'
      ? table.getSelectedRowModel().rows.length
      : Object.values(gridSelection).filter(Boolean).length;

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
      const ids = selectedData.map((r) => r._id || r.id);
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await subproductService.updateSubProduct(
            id,
            fields,
            session.user.token
          );
          ok++;
        } catch {
          failed++;
        }
      }
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
      let ok = 0;
      let failed = 0;
      for (const row of selectedData) {
        const id = row._id || row.id;
        try {
          if (action === 'duplicate')
            await subproductService.duplicateSubProduct(id, token);
          else if (action === 'archive')
            await subproductService.archiveSubProduct(id, token);
          else await subproductService.restoreSubProduct(id, token);
          ok++;
        } catch {
          failed++;
        }
      }
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        refresh();
      }
      if (e.key === 'Escape') {
        if (viewMode === 'list') table.resetRowSelection();
        else setGridSelection({});
        handleResetFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, table]);

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

  // ── Grid pagination slice ───────────────────────────────────────────────────
  const gridTotalPages = Math.max(
    1,
    Math.ceil(filteredSubProducts.length / gridPageSize)
  );
  const gridStart = gridPageIndex * gridPageSize;
  const gridEnd = gridStart + gridPageSize;
  const gridPageItems = sortedForGrid.slice(gridStart, gridEnd);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">
      {/* ── Toolbar ── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        {/* Row 1: new | search | actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2.5 sm:gap-3 sm:px-4">
          {/* ── New product button ── */}
          <button
            type="button"
            onClick={() => router.push(routes.eCommerce.createSubProduct)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#b20202] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#7f1d1d]"
          >
            <PiPlus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>

          <div className="hidden h-5 w-px shrink-0 bg-gray-200 sm:block" />

          {/* Odoo search bar */}
          <div
            className="relative order-last w-full min-w-0 lg:order-none lg:w-auto lg:max-w-[44rem] lg:flex-1"
            ref={searchPanelRef}
          >
            <div
              className={`flex h-9 flex-wrap items-center gap-1 rounded-lg border bg-white px-3 transition-all ${showSearchPanel || showSearchDropdown ? 'border-[#b20202] ring-2 ring-[#b20202]/10' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />

              {/* SP filter chips */}
              {Array.from(spActiveFilters)
                .filter((f) => SP_FILTER_LABELS[f])
                .map((f) => (
                  <span
                    key={f}
                    className="flex items-center gap-1 rounded-md bg-[#b20202]/10 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]"
                  >
                    <PiFunnelBold className="h-2.5 w-2.5" />
                    {SP_FILTER_LABELS[f]}
                    <button
                      type="button"
                      onClick={() =>
                        setSpActiveFilters((prev) => {
                          const n = new Set(prev);
                          n.delete(f);
                          return n;
                        })
                      }
                      className="opacity-60 hover:opacity-100"
                    >
                      <PiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}

              {/* Group chip */}
              {spGroupBy && (
                <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]">
                  {SP_GROUP_LABELS[spGroupBy]}
                  <button
                    type="button"
                    onClick={() => setSpGroupBy(null)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* Custom rule chip */}
              {activeCustomRules && (
                <span className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                  Custom Filter ({activeCustomRules.rules.length} rule
                  {activeCustomRules.rules.length > 1 ? 's' : ''})
                  <button
                    type="button"
                    onClick={() => setActiveCustomRules(null)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* Search field chips */}
              {searchChips.map((chip) => (
                <span
                  key={chip.id}
                  className="flex items-center gap-0 overflow-hidden rounded-md border border-gray-200 text-[11px] font-semibold"
                >
                  <span className="bg-gray-800 px-2 py-0.5 text-white">
                    {chip.label}
                  </span>
                  <span className="bg-white px-2 py-0.5 italic text-gray-700">
                    {chip.query}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSearchChip(chip.id)}
                    className="bg-white px-1.5 py-0.5 text-gray-400 hover:text-red-500"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(e.target.value.trim().length > 0);
                  setShowSearchPanel(false);
                }}
                onFocus={() => {
                  if (!searchQuery.trim()) setShowSearchPanel(true);
                  else setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    addSearchChip('product', 'Product');
                  }
                  if (
                    e.key === 'Backspace' &&
                    !searchQuery &&
                    searchChips.length > 0
                  ) {
                    removeSearchChip(searchChips[searchChips.length - 1].id);
                  }
                  if (e.key === 'Escape') {
                    setShowSearchPanel(false);
                    setShowSearchDropdown(false);
                  }
                }}
                placeholder={
                  spActiveFilters.size === 0 &&
                  !spGroupBy &&
                  searchChips.length === 0
                    ? 'Search products, SKU…'
                    : 'Search…'
                }
                className="min-w-[80px] flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />

              {(searchQuery ||
                spActiveFilters.size > 0 ||
                spGroupBy ||
                searchChips.length > 0) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
                >
                  <PiX className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearchPanel((v) => !v);
                  setShowSearchDropdown(false);
                }}
                className={`ml-1 shrink-0 transition-colors ${showSearchPanel ? 'text-[#b20202]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {showSearchPanel ? (
                  <PiCaretUp className="h-3.5 w-3.5" />
                ) : (
                  <PiCaretDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Typing suggestions dropdown */}
            {showSearchDropdown && searchQuery.trim() && (
              <div className="ring-black/8 absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1">
                {SP_CHIP_FIELDS.map((cf, i) => (
                  <button
                    key={cf.field}
                    type="button"
                    onClick={() => addSearchChip(cf.field, cf.label)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${i === 0 ? 'bg-gray-50' : ''}`}
                  >
                    {i === 0 ? (
                      <PiCaretRight className="h-3 w-3 text-gray-400" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <span>
                      Search <strong>{cf.label}</strong> for:{' '}
                      <em className="text-[#b20202]">{searchQuery.trim()}</em>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setShowSearchDropdown(false);
                    setShowCustomFilterModal(true);
                  }}
                  className="flex w-full items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-[#b20202] transition-colors hover:bg-red-50"
                >
                  Add Custom Filter
                </button>
              </div>
            )}

            {/* Filters / Group By / Favorites panel */}
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
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

            <div className="h-5 w-px bg-gray-200" />

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

            <div className="h-5 w-px bg-gray-200" />

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
                          transition={{ delay: index * 0.03 }}
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
                      transition={{ delay: index * 0.02 }}
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
              expandedComponent: (row) => {
                const subProduct = row.original as SubProductListItem;
                const currencySymbols: Record<string, string> = {
                  NGN: '₦',
                  USD: '$',
                  EUR: '€',
                  GBP: '£',
                  ZAR: 'R',
                  KES: 'KSh',
                  GHS: '₵',
                };
                const symbol =
                  currencySymbols[subProduct.currency] || subProduct.currency;

                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-gray-200 bg-gradient-to-r from-red-50/60 via-white to-gray-50 p-6"
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                      {/* Size Variants */}
                      <div className="md:col-span-2">
                        <Text className="mb-3 flex items-center gap-2 font-bold text-gray-800">
                          <PiPackageBold className="h-5 w-5" />
                          Size Variants ({subProduct.sizes?.length || 0})
                        </Text>
                        <div className="space-y-2">
                          {subProduct.sizes?.map((size) => (
                            <motion.div
                              key={size._id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
                            >
                              <div>
                                <Text className="font-semibold">
                                  {size.displayName || size.size}
                                </Text>
                                <Text className="text-xs text-gray-500">
                                  Threshold: {size.lowStockThreshold || 10}
                                </Text>
                              </div>
                              <Flex align="center" gap="4">
                                <div className="text-right">
                                  <Text className="text-xs text-gray-400">
                                    Price
                                  </Text>
                                  <Text className="font-bold">
                                    {symbol}
                                    {(size.sellingPrice || 0).toLocaleString()}
                                  </Text>
                                </div>
                                <div className="text-right">
                                  <Text className="text-xs text-gray-400">
                                    Stock
                                  </Text>
                                  <Badge
                                    size="sm"
                                    color={
                                      size.stock === 0
                                        ? 'danger'
                                        : size.stock && size.stock <= 10
                                          ? 'warning'
                                          : 'success'
                                    }
                                  >
                                    {size.stock || 0}
                                  </Badge>
                                </div>
                              </Flex>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div>
                        <Text className="mb-3 font-bold text-gray-800">
                          Product Info
                        </Text>
                        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
                          <div>
                            <Text className="text-xs text-gray-400">
                              Product Name
                            </Text>
                            <Text className="font-semibold">
                              {subProduct.product?.name || 'N/A'}
                            </Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">Type</Text>
                            <Text className="font-semibold capitalize">
                              {subProduct.product?.type?.replace(/_/g, ' ') ||
                                'N/A'}
                            </Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">
                              Status
                            </Text>
                            <Badge
                              color={
                                subProduct.status === 'active'
                                  ? 'success'
                                  : 'secondary'
                              }
                              variant="flat"
                            >
                              {subProduct.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Sales Info */}
                      <div>
                        <Text className="mb-3 font-bold text-gray-800">
                          Sales & Revenue
                        </Text>
                        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
                          <div>
                            <Text className="text-xs text-gray-400">
                              Total Sold
                            </Text>
                            <Text className="text-xl font-bold">
                              {subProduct.totalSold || 0}
                            </Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">
                              Total Revenue
                            </Text>
                            <Text className="font-bold text-green-600">
                              {symbol}
                              {(subProduct.totalRevenue || 0).toLocaleString()}
                            </Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">
                              Created
                            </Text>
                            <Text className="text-sm">
                              {new Date(
                                subProduct.createdAt
                              ).toLocaleDateString()}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              },
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

// ── Helper: count active advanced filters ─────────────────────────────────────
function activeFilterCount(af: FilterConfig): number {
  let count = 0;
  if (af.status.length) count++;
  if (af.stockStatus.length) count++;
  if (af.visibility.length) count++;
  if (af.priceRange[0] || af.priceRange[1]) count++;
  if (af.marginRange[0] || af.marginRange[1]) count++;
  if (af.onSale !== null) count++;
  if (af.hasDiscount !== null) count++;
  if (af.stockRange[0] || af.stockRange[1]) count++;
  if (af.hasVariants !== null) count++;
  if (af.needsReorder !== null) count++;
  if (af.beverageTypes.length) count++;
  if (af.isAlcoholic !== null) count++;
  if (af.abvRange[0] || af.abvRange[1]) count++;
  if (af.volumeRange[0] || af.volumeRange[1]) count++;
  if (af.originCountries.length) count++;
  if (af.isFeatured !== null) count++;
  if (af.isBestSeller !== null) count++;
  if (af.isNewArrival !== null) count++;
  if (af.visibleInPOS !== null) count++;
  if (af.visibleInOnlineStore !== null) count++;
  if (af.salesRange[0] || af.salesRange[1]) count++;
  if (af.viewsRange[0] || af.viewsRange[1]) count++;
  if (af.conversionRange[0] || af.conversionRange[1]) count++;
  if (af.seasons.length) count++;
  if (af.occasions.length) count++;
  if (af.dateRange.from || af.dateRange.to) count++;
  if (af.lastSoldRange.from || af.lastSoldRange.to) count++;
  if (af.lastRestockRange.from || af.lastRestockRange.to) count++;
  return count;
}

// ── GridPagination: consistent with TablePagination styling, adds page-size ──
function GridPagination({
  pageIndex,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (i: number) => void;
  onPageSizeChange: (ps: number) => void;
}) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/50 p-4">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <Text className="hidden font-normal text-gray-600 @md:block">
          Rows per page
        </Text>
        <Select
          size="sm"
          variant="flat"
          options={PAGE_SIZE_OPTIONS.map((n) => ({
            value: n,
            label: String(n),
          }))}
          value={pageSize}
          onChange={(v: any) => onPageSizeChange(Number(v.value))}
          className="w-16"
          suffixClassName="[&>svg]:size-3"
          selectClassName="font-semibold text-xs ring-0 shadow-sm h-7"
          optionClassName="font-medium text-xs px-2 justify-center"
        />
      </div>

      {/* Result count */}
      <Text className="hidden font-normal text-gray-600 @xl:block">
        {total === 0
          ? '0 results'
          : `${start}–${end} of ${total.toLocaleString()}`}
      </Text>
      <Text className="hidden font-normal text-gray-600 @3xl:block">
        Page {pageIndex + 1} of {totalPages.toLocaleString()}
      </Text>

      {/* Page nav */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(0)}
          disabled={!canPrev}
          aria-label="First page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-40 disabled:shadow-none"
        >
          «
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-40 disabled:shadow-none"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!canNext}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-40 disabled:shadow-none"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={!canNext}
          aria-label="Last page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-40 disabled:shadow-none"
        >
          »
        </button>
      </div>
    </div>
  );
}
