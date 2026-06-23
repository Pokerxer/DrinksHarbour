// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';
import { productsListColumns } from './columns';
import type { ProductListItem } from './columns';
import TableFooter from '@core/components/table/footer';
import { TableClassNameProps } from '@core/components/table/table-types';
import cn from '@core/utils/class-names';
import { exportToCSV } from '@core/utils/export-to-csv';
import { productService } from '@/services/product.service';
import { Text, Badge, Flex } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPackageBold,
  PiWarningBold,
  PiTrashBold,
  PiDownloadBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiTrendUpBold,
  PiTrendDownBold,
  PiMagnifyingGlassBold,
  PiGridFourBold,
  PiListBold,
  PiFunnelBold,
} from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ProductGridCard } from './components';

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-1/4 animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-8 w-8 bg-gray-100 rounded-xl animate-pulse" />
        </motion.div>
      ))}
    </div>
  );
}

function GridLoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        >
          <div className="h-44 bg-gray-200 animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Stats Header ─────────────────────────────────────────────────────────────
function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: { total: number; published: number; draft: number; discontinued: number };
  activeFilter: string;
  onFilterChange: (f: string) => void;
}) {
  const cards = [
    { id: '', label: 'Total', value: stats.total, icon: PiPackageBold, color: 'blue' },
    { id: 'published', label: 'Published', value: stats.published, icon: PiCheckCircleBold, color: 'green' },
    { id: 'draft', label: 'Draft', value: stats.draft, icon: PiWarningBold, color: 'amber' },
    { id: 'discontinued', label: 'Discontinued', value: stats.discontinued, icon: PiXCircleBold, color: 'red' },
  ];

  const colorMap: Record<string, { bg: string; text: string; iconBg: string; ring: string }> = {
    blue:  { bg: 'from-blue-500/10 to-blue-500/5',   text: 'text-blue-600',  iconBg: 'bg-blue-500',  ring: 'ring-blue-500/30' },
    green: { bg: 'from-green-500/10 to-green-500/5',  text: 'text-green-600', iconBg: 'bg-green-500', ring: 'ring-green-500/30' },
    amber: { bg: 'from-amber-500/10 to-amber-500/5',  text: 'text-amber-600', iconBg: 'bg-amber-500', ring: 'ring-amber-500/30' },
    red:   { bg: 'from-red-500/10 to-red-500/5',     text: 'text-red-600',   iconBg: 'bg-red-500',   ring: 'ring-red-500/30' },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const colors = colorMap[card.color];
        const isActive = activeFilter === card.id;
        const Icon = card.icon;
        return (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilterChange(card.id)}
            className={cn(
              'relative p-5 rounded-2xl bg-gradient-to-br text-left transition-all overflow-hidden',
              colors.bg,
              isActive && `ring-4 ${colors.ring}`
            )}
          >
            <Flex justify="between" align="start">
              <div>
                <Text className={cn('text-xs font-bold uppercase tracking-wider opacity-70', colors.text)}>
                  {card.label}
                </Text>
                <motion.div key={card.value} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1">
                  <Text className="text-3xl font-black">{card.value}</Text>
                </motion.div>
              </div>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg', colors.iconBg)}
              >
                <Icon className="w-6 h-6" />
              </motion.div>
            </Flex>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Bulk Actions Bar ─────────────────────────────────────────────────────────
function BulkActionsBar({
  selectedCount,
  onDelete,
  onExport,
  onClear,
}: {
  selectedCount: number;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border border-gray-700/50"
    >
      <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
        <Text className="text-lg font-bold">{selectedCount}</Text>
      </div>
      <Text className="font-semibold">selected</Text>
      <div className="h-8 w-px bg-gray-700" />
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onExport} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors">
        <PiDownloadBold className="w-5 h-5" />
        <span className="font-medium">Export</span>
      </motion.button>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors">
        <PiTrashBold className="w-5 h-5" />
        <span className="font-medium">Delete</span>
      </motion.button>
      <div className="h-8 w-px bg-gray-700" />
      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClear} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
        <PiXCircleBold className="w-5 h-5 text-gray-400" />
      </motion.button>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-gray-200 p-16 text-center">
      <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
        <PiPackageBold className="w-12 h-12 text-gray-400" />
      </div>
      <Text className="text-gray-700 font-bold text-2xl mb-2">No products found</Text>
      <Text className="text-gray-500 mb-8">
        {query ? `No products match "${query}". Try different search terms.` : "No products match your filters."}
      </Text>
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClear} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all">
        <PiArrowsClockwiseBold className="w-5 h-5" />
        Clear Filters
      </motion.button>
    </motion.div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-red-200 p-12 text-center">
      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <PiWarningBold className="w-12 h-12 text-red-500" />
      </div>
      <Text className="text-red-600 font-bold text-xl mb-2">Something went wrong</Text>
      <Text className="text-gray-500 mb-8">{message}</Text>
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onRetry} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg transition-all">
        <PiArrowsClockwiseBold className="w-5 h-5" />
        Try Again
      </motion.button>
    </motion.div>
  );
}

// ─── Main Table Component ─────────────────────────────────────────────────────
export default function ProductsTable({
  pageSize = 10,
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

  const [allProducts, setAllProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [gridSelection, setGridSelection] = useState<Record<string, boolean>>({});

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (sessionStatus !== 'authenticated' || !session?.user?.token) return;
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      const res = await productService.getProducts(session.user.token, { limit: 500 });
      // API returns { success: true, data: { products: [...], pagination: {...} } }
      const raw = res?.data?.products ?? res?.products ?? [];
      const list = Array.isArray(raw) ? raw : [];
      setAllProducts(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.token, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchProducts();
  }, [sessionStatus, fetchProducts]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: allProducts.length,
    published: allProducts.filter(p => p.status === 'approved').length,
    draft: allProducts.filter(p => p.status === 'draft' || p.status === 'pending').length,
    discontinued: allProducts.filter(p => p.status === 'discontinued' || p.status === 'archived' || p.status === 'rejected').length,
  }), [allProducts]);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...allProducts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q) ||
        p.brand?.name?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q) ||
        p.originCountry?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'published') result = result.filter(p => p.status === 'approved');
    else if (statusFilter === 'draft') result = result.filter(p => p.status === 'draft' || p.status === 'pending');
    else if (statusFilter === 'discontinued') result = result.filter(p => p.status === 'discontinued' || p.status === 'archived' || p.status === 'rejected');
    return result;
  }, [allProducts, searchQuery, statusFilter]);

  // ── TanStack Table ───────────────────────────────────────────────────────────
  const { table, setData } = useTanStackTable<ProductListItem>({
    tableData: filtered,
    columnConfig: productsListColumns,
    options: {
      initialState: { pagination: { pageIndex: 0, pageSize: pageSize ?? 80 } },
      meta: {
        handleDeleteRow: async (row) => {
          if (!session?.user?.token) return;
          try {
            await productService.deleteProduct(row._id, session.user.token);
            setAllProducts(prev => prev.filter(p => p._id !== row._id));
            toast.success('Product deleted');
          } catch {
            toast.error('Failed to delete product');
          }
        },
        handleMultipleDelete: (rows) => {
          setData(prev => prev.filter(r => !rows.includes(r)));
        },
      },
      enableColumnResizing: false,
    },
  });

  // Sync filtered data into the table whenever it changes (useTanStackTable only
  // initialises from the prop — it doesn't watch for updates)
  useEffect(() => {
    setData(filtered);
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original);

  const handleExport = useCallback(() => {
    const data = selectedRows.length > 0 ? selectedRows : filtered;
    exportToCSV(data, 'ID,Name,Type,Category,Brand,Status,Published', `products_${data.length}`);
    toast.success(`Exported ${data.length} products`);
  }, [selectedRows, filtered]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const handleGridSelect = (id: string) => {
    setGridSelection(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const gridSelectedCount = Object.values(gridSelection).filter(Boolean).length;

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (sessionStatus === 'loading') return viewMode === 'grid' ? <GridLoadingSkeleton /> : <LoadingSkeleton />;

  if (isLoading) return viewMode === 'grid' ? <GridLoadingSkeleton /> : <LoadingSkeleton />;

  if (error) return <ErrorState message={error} onRetry={() => fetchProducts()} />;

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <StatsHeader stats={stats} activeFilter={statusFilter} onFilterChange={setStatusFilter} />

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <Flex align="center" justify="between" gap="3" className="flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <PiMagnifyingGlassBold className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products by name, type, brand…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>

          <Flex align="center" gap="3">
            {/* Results count */}
            <Text className="text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''}
              {(searchQuery || statusFilter) && ` (filtered from ${allProducts.length})`}
            </Text>

            {/* Refresh */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchProducts(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm font-medium"
            >
              <motion.div animate={isRefreshing ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: isRefreshing ? Infinity : 0 }}>
                <PiArrowsClockwiseBold className="w-4 h-4" />
              </motion.div>
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </motion.button>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {([['list', PiListBold], ['grid', PiGridFourBold]] as const).map(([mode, Icon]) => (
                <motion.button
                  key={mode}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setViewMode(mode); setGridSelection({}); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="capitalize">{mode}</span>
                </motion.button>
              ))}
            </div>
          </Flex>
        </Flex>

        {/* Active filters */}
        {(searchQuery || statusFilter) && (
          <Flex align="center" gap="2" className="mt-3 pt-3 border-t border-gray-100 flex-wrap">
            <PiFunnelBold className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <Text className="text-sm font-medium text-blue-700">Active filters:</Text>
            {searchQuery && (
              <Badge color="primary" variant="flat" className="text-xs gap-1">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-red-500 font-bold">×</button>
              </Badge>
            )}
            {statusFilter && (
              <Badge color="success" variant="flat" className="text-xs gap-1 capitalize">
                {statusFilter}
                <button onClick={() => setStatusFilter('')} className="ml-1 hover:text-red-500 font-bold">×</button>
              </Badge>
            )}
            <button onClick={handleClearFilters} className="ml-auto text-xs font-medium text-red-500 hover:text-red-700">
              Clear all
            </button>
          </Flex>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <EmptyState key="empty" query={searchQuery} onClear={handleClearFilters} />
        ) : viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {filtered.map((product, i) => (
              <motion.div key={product._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.5) }}>
                <ProductGridCard
                  product={product}
                  isSelected={!!gridSelection[product._id]}
                  onSelect={() => handleGridSelect(product._id)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <Table table={table} variant="modern" classNames={classNames} />
            {!hideFooter && <TableFooter table={table} onExport={handleExport} />}
            {!hidePagination && (
              <TablePagination table={table} className={cn('py-4', paginationClassName)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions (list mode) */}
      <AnimatePresence>
        {selectedRows.length > 0 && viewMode === 'list' && (
          <BulkActionsBar
            selectedCount={selectedRows.length}
            onExport={handleExport}
            onDelete={() => {
              selectedRows.forEach(r => table.options.meta?.handleDeleteRow?.(r));
              table.resetRowSelection();
            }}
            onClear={() => table.resetRowSelection()}
          />
        )}
        {gridSelectedCount > 0 && viewMode === 'grid' && (
          <BulkActionsBar
            selectedCount={gridSelectedCount}
            onExport={() => {
              const data = filtered.filter(p => gridSelection[p._id]);
              exportToCSV(data, 'ID,Name,Type,Category,Brand,Status', `products_selected_${data.length}`);
              toast.success(`Exported ${data.length} products`);
            }}
            onDelete={() => toast.error('Select products from list view to delete')}
            onClear={() => setGridSelection({})}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
