// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { subproductService } from '@/services/subproduct.service';

export interface SubProductsStats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
}

export interface SubProductsPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UseSubProductsOptions {
  /** Initial page size (default 25) */
  initialPageSize?: number;
  /** Debounce delay for search input (default 350ms) */
  searchDebounceMs?: number;
  /** When true, fetch all (limit=500) and do client-side pagination/filtering.
   *  When false, fetch one page from the server. */
  clientSideMode?: boolean;
}

export interface UseSubProductsResult {
  items: any[];
  pagination: SubProductsPagination | null;
  stats: SubProductsStats;
  isLoading: boolean;
  isFetching: boolean;
  isRefreshing: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  search: string;
  sort: string;
  order: 'asc' | 'desc';
  status: string | undefined;
  setPage: (p: number) => void;
  setPageSize: (ps: number) => void;
  setSearch: (s: string) => void;
  setSort: (s: string) => void;
  setOrder: (o: 'asc' | 'desc') => void;
  setStatus: (s?: string) => void;
  refresh: () => void;
}

/**
 * Fetches the current tenant's SubProducts with server-side pagination, search,
 * and sorting. Falls back to client-side mode (fetch-all) for advanced filters
 * that the API doesn't yet support (beverage type, flags, date ranges, etc.).
 *
 * The server-side endpoint is GET /api/subproducts?page=&limit=&search=&status=&sort=&order=
 * Response shape: { success: true, data: { subProducts, pagination, stats } }
 */
export function useSubProducts(
  token: string | undefined,
  options: UseSubProductsOptions = {}
): UseSubProductsResult {
  const {
    initialPageSize = 25,
    searchDebounceMs = 350,
    clientSideMode = false,
  } = options;

  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState<SubProductsPagination | null>(
    null
  );
  const [stats, setStats] = useState<SubProductsStats>({
    total: 0,
    active: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [search, setSearchState] = useState('');
  const [sort, setSortState] = useState('createdAt');
  const [order, setOrderState] = useState<'asc' | 'desc'>('desc');
  const [status, setStatusState] = useState<string | undefined>(undefined);

  // Debounced search value — only triggers a fetch once the user stops typing.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPageState(1); // reset to first page on new search
    }, searchDebounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchDebounceMs]);

  const fetchRef = useRef(0);

  const fetchPage = useCallback(
    async (showRefresh = false) => {
      if (!token) {
        setIsLoading(false);
        setError('Please sign in to view sub-products');
        return;
      }
      const callId = ++fetchRef.current;
      if (showRefresh) setIsRefreshing(true);
      else if (items.length === 0) setIsLoading(true);
      else setIsFetching(true);
      setError(null);

      try {
        const params: Record<string, any> = clientSideMode
          ? { limit: 5000 } // fetch entire catalog for client-side filtering
          : {
              page,
              limit: pageSize,
              sort,
              order,
            };
        if (!clientSideMode && debouncedSearch.trim())
          params.search = debouncedSearch.trim();
        if (!clientSideMode && status) params.status = status;

        const response = await subproductService.getSubProducts(token, params);

        // Stale-call guard: ignore out-of-order responses.
        if (callId !== fetchRef.current) return;

        if (response.success) {
          const data = response.data || response;
          const list = data.subProducts || response.subProducts || [];
          setItems(list);
          if (data.pagination) setPagination(data.pagination);
          else if (clientSideMode) {
            const total = list.length;
            setPagination({
              page: 1,
              limit: total,
              total,
              pages: 1,
              hasNext: false,
              hasPrev: false,
            });
          }
          if (data.stats) setStats(data.stats);
          else {
            // Fallback: compute basic stats from the current page list
            setStats({
              total: data.pagination?.total ?? list.length,
              active: list.filter((p) => p.status === 'active').length,
              lowStock: list.filter(
                (p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 10
              ).length,
              outOfStock: list.filter((p) => (p.totalStock ?? 0) === 0).length,
            });
          }
        } else {
          setError(response.message || 'Failed to load sub-products');
        }
      } catch (err: any) {
        if (callId !== fetchRef.current) return;
        console.error('Failed to fetch subproducts:', err);
        setError(err.message || 'Failed to load sub-products');
      } finally {
        if (callId === fetchRef.current) {
          setIsLoading(false);
          setIsFetching(false);
          setIsRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      token,
      page,
      pageSize,
      sort,
      order,
      debouncedSearch,
      status,
      clientSideMode,
    ]
  );

  // Refetch on any server-side control change (skip in client-side mode where
  // pagination/search are handled by the parent component).
  useEffect(() => {
    if (clientSideMode) {
      // Fetch once on mount (token ready) — no dependency on page/search.
      if (token && items.length === 0) fetchPage(false);
      return;
    }
    fetchPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    page,
    pageSize,
    sort,
    order,
    debouncedSearch,
    status,
    clientSideMode,
  ]);

  const setPage = useCallback((p: number) => setPageState(Math.max(1, p)), []);
  const setPageSize = useCallback((ps: number) => {
    setPageSizeState(ps);
    setPageState(1);
  }, []);
  const setSearch = useCallback((s: string) => setSearchState(s), []);
  const setSort = useCallback((s: string) => {
    setSortState(s);
    setPageState(1);
  }, []);
  const setOrder = useCallback((o: 'asc' | 'desc') => {
    setOrderState(o);
    setPageState(1);
  }, []);
  const setStatus = useCallback((s?: string) => {
    setStatusState(s);
    setPageState(1);
  }, []);
  const refresh = useCallback(() => fetchPage(true), [fetchPage]);

  return {
    items,
    pagination,
    stats,
    isLoading,
    isFetching,
    isRefreshing,
    error,
    page,
    pageSize,
    search,
    sort,
    order,
    status,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setOrder,
    setStatus,
    refresh,
  };
}
