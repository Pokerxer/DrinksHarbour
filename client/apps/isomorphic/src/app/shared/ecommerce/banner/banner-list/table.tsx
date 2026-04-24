// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';
import { bannersListColumns } from './columns';
import type { BannerListItem } from './columns';
import { TableClassNameProps } from '@core/components/table/table-types';
import cn from '@core/utils/class-names';
import { bannerService } from '@/services/banner.service';
import { Text, Button } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiWarningBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiPauseBold,
  PiArrowsClockwise,
  PiPlusBold,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/config/routes';

interface BannersTableProps extends TableClassNameProps {
  pageSize?: number;
}

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
          <div className="w-16 h-12 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-red-200 p-12 text-center">
      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <PiWarningBold className="w-12 h-12 text-red-500" />
      </div>
      <Text className="text-red-600 font-bold text-xl mb-2">Something went wrong</Text>
      <Text className="text-gray-500 mb-8">{message}</Text>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg"
      >
        <PiArrowsClockwiseBold className="w-5 h-5" />
        Try Again
      </motion.button>
    </motion.div>
  );
}

function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: { total: number; active: number; scheduled: number; paused: number; archived: number };
  activeFilter: string;
  onFilterChange: (f: string) => void;
}) {
  const cards = [
    { id: '', label: 'Total', value: stats.total, icon: PiArrowsClockwiseBold, color: 'blue' },
    { id: 'active', label: 'Active', value: stats.active, icon: PiCheckCircleBold, color: 'green' },
    { id: 'scheduled', label: 'Scheduled', value: stats.scheduled, icon: PiArrowsClockwise, color: 'amber' },
    { id: 'paused', label: 'Paused', value: stats.paused, icon: PiPauseBold, color: 'orange' },
    { id: 'archived', label: 'Archived', value: stats.archived, icon: PiXCircleBold, color: 'gray' },
  ];

  const colorMap: Record<string, { bg: string; text: string; iconBg: string; ring: string }> = {
    blue:   { bg: 'from-blue-500/10 to-blue-500/5',    text: 'text-blue-600',   iconBg: 'bg-blue-500',   ring: 'ring-blue-500/30' },
    green:  { bg: 'from-green-500/10 to-green-500/5',   text: 'text-green-600',  iconBg: 'bg-green-500',  ring: 'ring-green-500/30' },
    amber:  { bg: 'from-amber-500/10 to-amber-500/5',   text: 'text-amber-600',  iconBg: 'bg-amber-500',  ring: 'ring-amber-500/30' },
    orange: { bg: 'from-orange-500/10 to-orange-500/5', text: 'text-orange-600', iconBg: 'bg-orange-500', ring: 'ring-orange-500/30' },
    gray:   { bg: 'from-gray-500/10 to-gray-500/5',     text: 'text-gray-600',   iconBg: 'bg-gray-500',   ring: 'ring-gray-500/30' },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
            <div className="flex justify-between items-start">
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
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default function BannersTable({ pageSize = 20, className }: BannersTableProps) {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [banners, setBanners] = useState<BannerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [serverStats, setServerStats] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 0 });

  const fetchBanners = useCallback(async (page = 1, filter = '') => {
    if (sessionStatus !== 'authenticated' || !token) return;

    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: pageSize };
      if (filter) params.status = filter;
      if (searchQuery) params.search = searchQuery;

      const response = await bannerService.getBanners(token, params);

      if (response && response.success) {
        const responseData = response.data || {};
        const bannerList = Array.isArray(responseData.banners) ? responseData.banners : [];
        setBanners(bannerList);
        setServerStats(responseData.stats || null);
        setPagination({
          page: responseData.pagination?.currentPage || responseData.pagination?.page || 1,
          limit: responseData.pagination?.resultsPerPage || responseData.pagination?.limit || pageSize,
          total: responseData.pagination?.totalResults || responseData.pagination?.total || 0,
          totalPages: responseData.pagination?.totalPages || 0,
        });
      } else {
        setBanners([]);
      }
    } catch (err: any) {
      console.error('Error fetching banners:', err);
      setError(err.message || 'Failed to fetch banners');
      toast.error(err.message || 'Failed to fetch banners');
      setBanners([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, sessionStatus, pageSize, searchQuery]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchBanners(1, statusFilter);
    }
  }, [sessionStatus, fetchBanners, statusFilter]);

  // Use server-side aggregate stats; fall back to local counts
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.total || 0,
        active: serverStats.active || 0,
        scheduled: serverStats.scheduled || 0,
        paused: serverStats.paused || 0,
        archived: serverStats.archived || 0,
      };
    }
    return {
      total: banners.length,
      active: banners.filter(b => b.status === 'active').length,
      scheduled: banners.filter(b => b.status === 'scheduled').length,
      paused: banners.filter(b => b.status === 'paused').length,
      archived: banners.filter(b => b.status === 'archived').length,
    };
  }, [serverStats, banners]);

  // Client-side search only (server handles status filter)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return banners;
    const q = searchQuery.toLowerCase();
    return banners.filter(b =>
      b.title?.toLowerCase().includes(q) ||
      b.subtitle?.toLowerCase().includes(q) ||
      b.type?.toLowerCase().includes(q) ||
      b.placement?.toLowerCase().includes(q)
    );
  }, [banners, searchQuery]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this banner? This cannot be undone.')) return;
    try {
      await bannerService.deleteBanner(id, token);
      toast.success('Banner deleted');
      fetchBanners(pagination.page, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete banner');
    }
  }, [token, fetchBanners, pagination.page, statusFilter]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await bannerService.updateBannerStatus(id, status, token);
      toast.success(`Banner ${status}`);
      fetchBanners(pagination.page, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }, [token, fetchBanners, pagination.page, statusFilter]);

  const handleClone = useCallback(async (id: string) => {
    try {
      await bannerService.cloneBanner(id, token);
      toast.success('Banner cloned');
      fetchBanners(pagination.page, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone banner');
    }
  }, [token, fetchBanners, pagination.page, statusFilter]);

  const { table, setData } = useTanStackTable<BannerListItem>({
    tableData: filtered,
    columnConfig: bannersListColumns,
    options: {
      initialState: { pagination: { pageIndex: 0, pageSize } },
      enableColumnResizing: false,
      meta: { onDelete: handleDelete, onStatusChange: handleStatusChange, onClone: handleClone },
    },
  });

  useEffect(() => {
    setData(filtered);
  }, [filtered, setData]);

  const handleBulkStatusChange = useCallback(async (status: string) => {
    const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original._id).filter(Boolean);
    if (!selectedIds.length) return;
    try {
      await bannerService.bulkUpdateStatus(selectedIds, status, token);
      toast.success(`${selectedIds.length} banner(s) set to ${status}`);
      table.resetRowSelection();
      fetchBanners(pagination.page, statusFilter);
    } catch (err: any) {
      toast.error(err.message || 'Bulk update failed');
    }
  }, [table, token, fetchBanners, pagination.page, statusFilter]);

  if (sessionStatus === 'loading') return <LoadingSkeleton />;
  if (sessionStatus !== 'authenticated') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Text className="text-gray-500">Please sign in to view banners</Text>
      </div>
    );
  }
  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => fetchBanners(1, statusFilter)} />;

  return (
    <div className={cn('space-y-5', className)}>
      <StatsHeader stats={stats} activeFilter={statusFilter} onFilterChange={setStatusFilter} />

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search banners..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Text className="text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} banner{filtered.length !== 1 ? 's' : ''}
              {(searchQuery || statusFilter) && ` (of ${pagination.total})`}
            </Text>
            <Button variant="outline" onClick={() => fetchBanners(pagination.page, statusFilter)} className="h-10">
              <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link href={routes.eCommerce.createBanner}>
              <Button className="h-10">
                <PiPlusBold className="mr-2 h-4 w-4" />
                Add Banner
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {table.getSelectedRowModel().rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex-wrap"
        >
          <Text className="text-sm font-semibold text-blue-800">
            {table.getSelectedRowModel().rows.length} selected
          </Text>
          <Button size="sm" onClick={() => handleBulkStatusChange('active')}>
            Activate
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('paused')}>
            Pause
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('archived')}>
            Archive
          </Button>
          <Button size="sm" variant="outline" onClick={() => table.resetRowSelection()}>
            Clear
          </Button>
        </motion.div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <PiPlusBold className="w-8 h-8 text-gray-400" />
            </div>
            <Text className="text-lg font-semibold text-gray-900 mb-2">No banners found</Text>
            <Text className="text-gray-500 mb-6">
              {searchQuery ? 'Try adjusting your search' : 'Get started by creating your first banner'}
            </Text>
            <Link href={routes.eCommerce.createBanner}>
              <Button><PiPlusBold className="mr-2 h-4 w-4" />Create Banner</Button>
            </Link>
          </div>
        ) : (
          <Table table={table} className="hidden md:table" variants="modern" />
        )}
      </div>

      {pagination.total > 0 && (
        <TablePagination
          table={table}
          pageSize={pageSize}
          setPageSize={(size) => setPagination(prev => ({ ...prev, limit: size }))}
          total={pagination.total}
        />
      )}
    </div>
  );
}
