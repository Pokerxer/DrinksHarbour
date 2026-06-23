'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  initialPage?: number;
  enabled?: boolean;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  isLoadingMore: boolean;
}

export function useInfiniteScroll<T>(
  fetchFn: (page: number) => Promise<{ items: T[]; hasMore: boolean; total: number }>,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn<T> {
  const { threshold = 200, initialPage = 1, enabled = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async (pageNum: number, isRefresh = false) => {
    if (!enabled) return;

    try {
      if (isRefresh) {
        setLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      const result = await fetchFn(pageNum);

      if (isRefresh) {
        setItems(result.items);
      } else {
        setItems(prev => [...prev, ...result.items]);
      }

      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [fetchFn, enabled]);

  const loadMore = useCallback(() => {
    if (!loading && !isLoadingMore && hasMore) {
      loadData(page + 1);
    }
  }, [loading, isLoadingMore, hasMore, page, loadData]);

  const refresh = useCallback(() => {
    setPage(initialPage);
    loadData(initialPage, true);
  }, [initialPage, loadData]);

  useEffect(() => {
    if (!enabled) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading && !isLoadingMore) {
          loadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enabled, threshold, hasMore, loading, isLoadingMore, loadMore]);

  useEffect(() => {
    if (enabled) {
      loadData(initialPage, true);
    }
  }, [enabled]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    isLoadingMore,
  };
}

export default useInfiniteScroll;
