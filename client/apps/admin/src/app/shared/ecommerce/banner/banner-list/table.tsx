// @ts-nocheck
'use client';

/**
 * Banners list — data container.
 *
 * Server-backed behaviour (GET /api/banners):
 * - status stat cards double as server filters (?status=)
 * - search is debounced and executed server-side (?search=) — the old version
 *   fired a request per keystroke AND re-filtered the same page client-side
 * - pagination is server-driven via ServerPagination (?page=&limit=)
 * - below `md` the TanStack table is replaced by BannerMobileCards
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { bannersListColumns } from './columns';
import type { BannerListItem } from './columns';
import type { TableClassNameProps } from '@core/components/table/table-types';
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
import StatsHeader from './stats-header';
import ServerPagination from './server-pagination';
import BannerMobileCards from './mobile-cards';

const SEARCH_DEBOUNCE_MS = 400;

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
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="h-12 w-16 flex-shrink-0 animate-pulse rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-100" />
        </motion.div>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-3xl border border-red-200 bg-white p-12 text-center"
    >
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
        <PiWarningBold className="h-12 w-12 text-red-500" />
      </div>
      <Text className="mb-2 text-xl font-bold text-red-600">
        Something went wrong
      </Text>
      <Text className="mb-8 text-gray-500">{message}</Text>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-3 font-semibold text-white shadow-lg"
      >
        <PiArrowsClockwiseBold className="h-5 w-5" />
        Try Again
      </motion.button>
    </motion.div>
  );
}

export default function BannersTable({
  pageSize = 20,
  className,
}: BannersTableProps) {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [banners, setBanners] = useState<BannerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Debounced mirror of searchInput — only this triggers a refetch.
  const [searchQuery, setSearchQuery] = useState('');
  const [serverStats, setServerStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(pageSize);
  const [totalResults, setTotalResults] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the raw search input.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const fetchBanners = useCallback(
    async (
      opts: {
        page?: number;
        limit?: number;
        filter?: string;
        search?: string;
      } = {}
    ) => {
      if (sessionStatus !== 'authenticated' || !token) return;

      const targetPage = opts.page ?? page;
      const targetLimit = opts.limit ?? pageSizeState;
      const targetFilter = opts.filter ?? statusFilter;
      const targetSearch = opts.search ?? searchQuery;

      setIsLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {
          page: targetPage,
          limit: targetLimit,
        };
        if (targetFilter) params.status = targetFilter;
        if (targetSearch) params.search = targetSearch;

        const response = await bannerService.getBanners(token, params);

        if (response && response.success) {
          const responseData = response.data || {};
          setBanners(
            Array.isArray(responseData.banners) ? responseData.banners : []
          );
          setServerStats(responseData.stats || null);
          setTotalResults(
            responseData.pagination?.totalResults ??
              responseData.pagination?.total ??
              0
          );
          // Clamp the page if the dataset shrank under us.
          const totalPages =
            responseData.pagination?.totalPages ||
            Math.ceil(
              (responseData.pagination?.totalResults ??
                responseData.pagination?.total ??
                0) / targetLimit
            ) ||
            1;
          if (targetPage > totalPages && totalPages > 0) {
            setPage(totalPages);
          }
        } else {
          setBanners([]);
        }
      } catch (err: any) {
        console.error('Error fetching banners:', err);
        setError(err.message || 'Failed to fetch banners');
        setBanners([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token, sessionStatus, page, pageSizeState, statusFilter, searchQuery]
  );

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchBanners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, statusFilter, searchQuery]);

  const handleStatusFilterChange = useCallback((filter: string) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      fetchBanners({ page: nextPage });
    },
    [fetchBanners]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSizeState(size);
      setPage(1);
      fetchBanners({ page: 1, limit: size });
    },
    [fetchBanners]
  );

  // Server-side aggregate stats; fall back to current-page counts.
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.total || totalResults || banners.length,
        active: serverStats.active || 0,
        scheduled: serverStats.scheduled || 0,
        paused: serverStats.paused || 0,
        archived: serverStats.archived || 0,
      };
    }
    return {
      total: totalResults || banners.length,
      active: banners.filter((b) => b.status === 'active').length,
      scheduled: banners.filter((b) => b.status === 'scheduled').length,
      paused: banners.filter((b) => b.status === 'paused').length,
      archived: banners.filter((b) => b.status === 'archived').length,
    };
  }, [serverStats, banners, totalResults]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this banner? This cannot be undone.')) return;
      try {
        await bannerService.deleteBanner(id, token);
        toast.success('Banner deleted');
        fetchBanners();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete banner');
      }
    },
    [token, fetchBanners]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: string) => {
      try {
        await bannerService.updateBannerStatus(id, status, token);
        toast.success(`Banner ${status}`);
        fetchBanners();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update status');
      }
    },
    [token, fetchBanners]
  );

  const handleClone = useCallback(
    async (id: string) => {
      try {
        await bannerService.cloneBanner(id, token);
        toast.success('Banner cloned');
        fetchBanners();
      } catch (err: any) {
        toast.error(err.message || 'Failed to clone banner');
      }
    },
    [token, fetchBanners]
  );

  const { table, setData } = useTanStackTable<BannerListItem>({
    tableData: banners,
    columnConfig: bannersListColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: pageSizeState },
      },
      enableColumnResizing: false,
      meta: {
        onDelete: handleDelete,
        onStatusChange: handleStatusChange,
        onClone: handleClone,
      },
    },
  });

  useEffect(() => {
    setData(banners);
  }, [banners, setData]);

  useEffect(() => {
    table.setPageSize(pageSizeState);
  }, [pageSizeState, table]);

  const selectedCount = table.getSelectedRowModel().rows.length;

  const handleBulkStatusChange = useCallback(
    async (status: string) => {
      const selectedIds = table
        .getSelectedRowModel()
        .rows.map((r) => r.original._id)
        .filter(Boolean);
      if (!selectedIds.length) return;
      try {
        await bannerService.bulkUpdateStatus(selectedIds, status, token);
        toast.success(`${selectedIds.length} banner(s) set to ${status}`);
        table.resetRowSelection();
        fetchBanners();
      } catch (err: any) {
        toast.error(err.message || 'Bulk update failed');
      }
    },
    [table, token, fetchBanners]
  );

  const refresh = useCallback(() => {
    fetchBanners();
  }, [fetchBanners]);

  if (sessionStatus === 'loading') return <LoadingSkeleton />;
  if (sessionStatus !== 'authenticated') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Text className="text-gray-500">Please sign in to view banners</Text>
      </div>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      <StatsHeader
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={handleStatusFilterChange}
      />

      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[200px] max-w-md flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, subtitle or CTA…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm transition-all focus:border-blue-400 focus:bg-white focus:outline-none"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Text className="whitespace-nowrap text-sm text-gray-500">
              {totalResults.toLocaleString()} banner
              {totalResults !== 1 ? 's' : ''}
            </Text>
            <Button variant="outline" onClick={refresh} className="h-10">
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
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"
        >
          <Text className="text-sm font-semibold text-blue-800">
            {selectedCount} selected
          </Text>
          <Button size="sm" onClick={() => handleBulkStatusChange('active')}>
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkStatusChange('paused')}
          >
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkStatusChange('archived')}
          >
            Archive
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.resetRowSelection()}
          >
            Clear
          </Button>
        </motion.div>
      )}

      {/* Data — desktop table / mobile cards */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <PiPlusBold className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="mb-2 text-lg font-semibold text-gray-900">
            No banners found
          </Text>
          <Text className="mb-6 text-gray-500">
            {searchQuery || statusFilter
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first banner'}
          </Text>
          {!searchQuery && !statusFilter && (
            <Link href={routes.eCommerce.createBanner}>
              <Button>
                <PiPlusBold className="mr-2 h-4 w-4" />
                Create Banner
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <Table table={table} variants="modern" />
          </div>
          <BannerMobileCards
            banners={banners}
            onStatusChange={handleStatusChange}
            onClone={handleClone}
            onDelete={handleDelete}
          />
          <ServerPagination
            page={page}
            pageSize={pageSizeState}
            total={totalResults}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}
