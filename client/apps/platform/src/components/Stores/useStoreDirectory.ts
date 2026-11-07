import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import type { Pagination, SortKey, Store } from './directory.types';

type Query = { search: string; location: string };
interface ResponseBody {
  success: boolean;
  message?: string;
  data: { stores: Store[]; pagination: Pagination };
}

export function useStoreDirectory(search: string, location: string, sort: SortKey) {
  const [query, setQuery] = useState<Query>({ search: '', location: '' });
  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const failed = useRef<{ page: number; append: boolean } | null>(null);
  const pending = search.trim() !== query.search || location.trim() !== query.location;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(previous => {
      const next = { search: search.trim(), location: location.trim() };
      return previous.search === next.search && previous.location === next.location ? previous : next;
    }), 400);
    return () => clearTimeout(timer);
  }, [search, location]);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++sequence.current;
    // Pending input hides the current query's results during debounce. Keep a
    // valid response if the shopper clears that input before debounce finishes.
    const isCurrent = () => id === sequence.current && !abort.signal.aborted;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadingMore(false);
      setStores([]);
      setPagination(null);
    }
    setError('');
    failed.current = null;
    try {
      const params = new URLSearchParams({ page: String(page), limit: '16', sort });
      if (query.search) params.set('search', query.search);
      if (query.location) params.set('location', query.location);
      const response = await fetch(`${API_URL}/api/stores?${params}`, { signal: abort.signal });
      const body: ResponseBody = await response.json();
      if (!response.ok || !body.success || !Array.isArray(body.data?.stores) || !body.data.pagination) {
        throw new Error(body.message || 'Could not load vendors. Please try again.');
      }
      if (!isCurrent()) return;
      setStores(previous => append ? [...previous, ...body.data.stores] : body.data.stores);
      setPagination(body.data.pagination);
    } catch (cause: unknown) {
      if (!isCurrent()) return;
      failed.current = { page, append };
      setError(cause instanceof Error ? cause.message : 'Could not load vendors. Please try again.');
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [query, sort]);

  useEffect(() => {
    void fetchPage(1, false);
    return () => { sequence.current++; controller.current?.abort(); };
  }, [fetchPage]);

  const hasMore = !!pagination && pagination.page < pagination.pages;
  const loadMore = () => {
    if (!pending && !loading && !loadingMore && hasMore) void fetchPage(pagination.page + 1, true);
  };
  const retry = () => {
    if (pending || loading || loadingMore) return;
    const request = failed.current ?? { page: 1, append: false };
    void fetchPage(request.page, request.append);
  };
  return { stores, pagination, loading: loading || pending, loadingMore, error, hasMore,
    query, loadMore, retry };
}
