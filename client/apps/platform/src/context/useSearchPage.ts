'use client';
import {useCallback} from 'react';
import {shoppingHeaders} from '@/lib/shoppingRequest';
import type {ShoppingLocation} from './shopping-location';
import type {SearchFilters,SearchResult} from './search-types';
import {API_URL,buildSearchParams} from './search-data-support';
export function useSearchPage(location: ShoppingLocation | null, revision: string) {
  // ── Core fetch helper (no deps — always stable) ─────────────────────────
  const fetchSearchPage = useCallback(async (
    query: string,
    activeFilters: SearchFilters,
    page: number,
    signal: AbortSignal,
  ): Promise<SearchResult> => {
    const params = buildSearchParams(query, activeFilters, page);
    const res    = await fetch(`${API_URL}/api/products/search?${params}`, { signal, headers: shoppingHeaders(location), cache: 'no-store' });

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Search failed');

    const rd         = data.data ?? data;
    const products   = rd.products ?? [];
    const pagination = rd.pagination ?? {};

    return {
      products,
      total:      pagination.totalResults  ?? rd.total      ?? products.length,
      page:       pagination.currentPage   ?? rd.page       ?? page,
      totalPages: pagination.totalPages    ?? rd.totalPages ?? 1,
    };
  }, [revision]);

  return fetchSearchPage;
}
