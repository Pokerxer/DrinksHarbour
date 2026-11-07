'use client';

/**
 * Data + action hook for the super-admin pending-products approval queue.
 *
 * Server truth is authoritative: no optimistic writes, every action ends with
 * an after refetch so the queue reflects what the API actually recorded
 * (approve promotes tenant-private rows to canonical; reject requires a
 * reason but the length rule is enforced in the UI, not here).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  productService,
  type PendingProductDTO,
  type PendingProductPagination,
} from '@/services/product.service';
import {
  getApproveCopy,
} from '../product-list/components';

const SEARCH_DEBOUNCE_MS = 350;

export interface UsePendingProductsOptions {
  token?: string;
  pageSize?: number;
}

export interface UsePendingProductsResult {
  rows: PendingProductDTO[];
  pagination: PendingProductPagination | null;
  loading: boolean;
  /** Load-fetch error — the retry banner. */
  error: string | null;
  /** Per-row action error surfaced next to that row's controls. */
  actionError: string | null;
  approvingId: string | null;
  rejectingId: string | null;
  page: number;
  limit: number;
  search: string;
  /** Uncommitted search text (what the input shows). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refresh: () => void;
  approve: (product: PendingProductDTO) => Promise<void>;
  /** Resolves `true` on success, `false` when nothing was sent or the server refused. */
  reject: (product: PendingProductDTO, reason: string) => Promise<boolean>;
  /** Rejection error, shown inside the reason modal (kept separate from load/approve errors). */
  rejectError: string | null;
  clearRejectError: () => void;
}

export function usePendingProducts({
  token,
  pageSize = 20,
}: UsePendingProductsOptions): UsePendingProductsResult {
  const [rows, setRows] = useState<PendingProductDTO[]>([]);
  const [pagination, setPagination] = useState<PendingProductPagination | null>(
    null
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const [searchInput, setSearchInputState] = useState('');
  const [search, setSearch] = useState('');
  const requestSeq = useRef(0);
  const loadRef = useRef<(() => void) | undefined>(undefined);

  // Debounced search commit — the queue refetches restfully instead of on
  // every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    if (!token) return;
    const seq = ++requestSeq.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    productService
      .getPendingProducts(
        token,
        { page, limit, search, sort: 'createdAt', order: 'desc' },
        controller.signal
      )
      .then((result) => {
        if (seq !== requestSeq.current) return;
        setRows(result.products);
        setPagination(result.pagination);
      })
      .catch((err: unknown) => {
        if (seq !== requestSeq.current) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load pending products'
        );
      })
      .finally(() => {
        if (seq !== requestSeq.current) return;
        setLoading(false);
      });
  }, [token, page, limit, search]);

  // Stale closures: keep the latest load reachable for actions' refetch.
  loadRef.current = load;

  const refresh = useCallback(() => loadRef.current?.(), []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = useCallback(
    async (product: PendingProductDTO) => {
      if (!token || approvingId) return;
      setActionError(null);
      setApprovingId(product._id);
      try {
        await productService.approveProduct(product._id, token);
        toast.success(
          getApproveCopy(product.publicationScope).label ===
            'Approve & publish to marketplace'
            ? 'Approved and published to the marketplace'
            : 'Product approved'
        );
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Approval failed. Please retry.'
        );
        toast.error(
          err instanceof Error ? err.message : 'Approval failed. Please retry.'
        );
      } finally {
        setApprovingId(null);
        // After-action refetch — never optimistic removal.
        loadRef.current?.();
      }
    },
    [token, approvingId]
  );

  const reject = useCallback(
    async (product: PendingProductDTO, reason: string): Promise<boolean> => {
      if (!token || rejectingId) return false;
      setActionError(null);
      setRejectError(null);
      setRejectingId(product._id);
      try {
        await productService.rejectProduct(product._id, token, reason.trim());
        toast.success('Product rejected — the submitting tenant is notified');
        return true;
      } catch (err) {
        // The typed reason stays in the open modal, so the failure surfaces
        // there first (rejectError) alongside the queue banner + toast.
        const message =
          err instanceof Error
            ? err.message
            : 'Rejection failed. Please retry.';
        setActionError(message);
        setRejectError(message);
        toast.error(message);
        return false;
      } finally {
        setRejectingId(null);
        loadRef.current?.();
      }
    },
    [token, rejectingId]
  );

  const clearRejectError = useCallback(() => setRejectError(null), []);

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
  }, []);

  // Changing the page size re-queries from page 1 server-side.
  const changeLimit = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  return useMemo(
    () => ({
      rows,
      pagination,
      loading,
      error,
      actionError,
      approvingId,
      rejectingId,
      page,
      limit,
      search,
      searchInput,
      setSearchInput,
      setPage,
      setLimit: changeLimit,
      refresh,
      approve,
      reject,
      rejectError,
      clearRejectError,
    }),
    [
      rows,
      pagination,
      loading,
      error,
      actionError,
      rejectError,
      approvingId,
      rejectingId,
      page,
      limit,
      search,
      searchInput,
      setSearchInput,
      changeLimit,
      refresh,
      approve,
      reject,
      clearRejectError,
    ]
  );
}
