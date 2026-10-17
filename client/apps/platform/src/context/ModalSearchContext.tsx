'use client';

import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { gtagEvent } from '@/lib/gtag';
import {POPULAR_SEARCHES} from './search-data-support';
import {useSearchSuggestions} from './useSearchSuggestions';
import {useRecentSearches} from './useRecentSearches';
import {useSearchPage} from './useSearchPage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type {SearchFilters,SearchResult,RecentSearch} from './search-types';
import type {SearchFilters,SearchResult,RecentSearch} from './search-types';
export { ModalSearchUIProvider, useModalSearchUIContext } from './ModalSearchUIContext';

// ─── Data Context (search state, results, suggestions — changes frequently) ──

export interface ModalSearchDataValue {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult | null;
  isSearching: boolean;
  searchError: string | null;
  hasMore: boolean;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;
  performSearch: (query?: string, page?: number) => Promise<void>;
  loadMoreResults: () => Promise<void>;
  clearSearch: () => void;
  recentSearches: RecentSearch[];
  addRecentSearch: (query: string, filters?: SearchFilters) => void;
  clearRecentSearches: () => void;
  removeRecentSearch: (query: string) => void;
  popularSearches: string[];
  suggestions: string[];
  isLoadingSuggestions: boolean;
  fetchSuggestions: (query: string) => void;
}

const ModalSearchDataContext = createContext<ModalSearchDataValue | undefined>(undefined);

export const useModalSearchContext = (): ModalSearchDataValue => {
  const ctx = useContext(ModalSearchDataContext);
  if (!ctx) throw new Error('useModalSearchContext must be used within a ModalSearchProvider');
  return ctx;
};

// ─── Helpers & constants ──────────────────────────────────────────────────────

// ─── Data Provider ────────────────────────────────────────────────────────────

export const ModalSearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { location, revision } = useShoppingLocation();
  const fetchSearchPage = useSearchPage(location, revision);
  const [searchQuery, updateSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching]       = useState(false);
  const [searchError, setSearchError]       = useState<string | null>(null);
  const [currentPage, setCurrentPage]       = useState(1);

  const lastSearchRef = useRef<{ query: string; filters: SearchFilters }>({ query: '', filters: {} });

  const [filters, setFilters]               = useState<SearchFilters>({});

  const {recentSearches,addRecentSearch,clearRecentSearches,removeRecentSearch}=useRecentSearches();

  const {suggestions,isLoadingSuggestions,fetchSuggestions,clearSuggestions}=useSearchSuggestions(recentSearches);

  const searchAbortRef = useRef<AbortController | null>(null);
  // Each request gets a sequence number so an older aborted request cannot
  // clear loading state or overwrite results for a newer query.
  const searchRequestIdRef = useRef(0);
  const setSearchQuery = useCallback((query: string) => {
    if (query === searchQueryRef.current) return;
    searchRequestIdRef.current++;
    searchAbortRef.current?.abort();
    searchQueryRef.current = query;
    updateSearchQuery(query);
    setSearchResults(null); setSearchError(null); setIsSearching(false); setCurrentPage(1);
  }, []);
  useEffect(() => {
    searchRequestIdRef.current++;
    searchAbortRef.current?.abort();
    searchCacheRef.current.clear();
    setSearchResults(null); setSearchError(null); setIsSearching(false); setCurrentPage(1);
  }, [revision]);

  // ── Refs for transient values (keep callbacks stable) ────────────────────
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const recentSearchesRef = useRef(recentSearches);
  useEffect(() => { recentSearchesRef.current = recentSearches; }, [recentSearches]);

  const isSearchingRef = useRef(isSearching);
  useEffect(() => { isSearchingRef.current = isSearching; }, [isSearching]);

  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // ── In-memory search result cache ─────────────────────────────────────────
  const searchCacheRef = useRef<Map<string, SearchResult>>(new Map());
  const CACHE_MAX = 30;

  function getCacheKey(query: string, filters: SearchFilters, page: number): string {
    return `${query}:${JSON.stringify(filters)}:${page}`;
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const hasMore = useMemo(
    () => Boolean(searchResults && currentPage < searchResults.totalPages),
    [searchResults, currentPage],
  );

  const hasMoreRef = useRef(hasMore);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  // ── Filters ──────────────────────────────────────────────────────────────
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  // ── performSearch (reads transient values from refs — stable ref) ───────
  const performSearch = useCallback(async (query?: string, page = 1) => {
    const term = (query ?? searchQueryRef.current).trim();
    const activeFilters = filtersRef.current;

    if (term) {
      gtagEvent('search', { search_term: term });
    }

    // Fast path: return cached result instantly (no network, no loading state)
    const cacheKey = getCacheKey(term, activeFilters, page);
    const cached = location ? undefined : searchCacheRef.current.get(cacheKey);
    if (cached) {
      searchRequestIdRef.current += 1;
      searchAbortRef.current?.abort();
      setSearchResults(cached);
      setCurrentPage(page);
      setIsSearching(false);
      setSearchError(null);
      lastSearchRef.current = { query: term, filters: activeFilters };
      if (term) {
        const recent = recentSearchesRef.current;
        if (!recent.length || recent[0].query.toLowerCase() !== term.toLowerCase()) {
          addRecentSearch(term, activeFilters);
        }
      }
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);
    if (page === 1) setCurrentPage(1);

    try {
      const result = await fetchSearchPage(term, activeFilters, page, controller.signal);

      // The request may have completed after a newer query started.
      if (requestId !== searchRequestIdRef.current) return;

      // Cache the result (evict oldest if over limit)
      if (!location) searchCacheRef.current.set(cacheKey, result);
      if (searchCacheRef.current.size > CACHE_MAX) {
        const firstKey = searchCacheRef.current.keys().next().value;
        if (firstKey) searchCacheRef.current.delete(firstKey);
      }

      setSearchResults(result);
      setCurrentPage(page);
      lastSearchRef.current = { query: term, filters: activeFilters };

      if (term) {
        const recent = recentSearchesRef.current;
        if (!recent.length || recent[0].query.toLowerCase() !== term.toLowerCase()) {
          addRecentSearch(term, activeFilters);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || requestId !== searchRequestIdRef.current) return;
      setSearchError(err.message ?? 'Search failed');
      if (page === 1) setSearchResults({ products: [], total: 0, page: 1, totalPages: 0 });
    } finally {
      if (requestId === searchRequestIdRef.current) setIsSearching(false);
    }
  }, [fetchSearchPage, addRecentSearch]);

  // ── loadMoreResults (reads transient values from refs — stable ref) ─────
  const loadMoreResults = useCallback(async () => {
    if (!hasMoreRef.current || isSearchingRef.current) return;

    const nextPage = (currentPageRef.current ?? 1) + 1;
    const { query, filters: f } = lastSearchRef.current;

    const requestId = ++searchRequestIdRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await fetchSearchPage(query, f, nextPage, controller.signal);

      if (requestId !== searchRequestIdRef.current) return;

      setSearchResults((prev) =>
        prev
          ? { ...result, products: [...prev.products, ...result.products] }
          : result,
      );
      setCurrentPage(nextPage);
    } catch (err: any) {
      if (err.name === 'AbortError' || requestId !== searchRequestIdRef.current) return;
      setSearchError('More drinks could not be loaded. Please try again.');
    } finally {
      if (requestId === searchRequestIdRef.current) setIsSearching(false);
    }
  }, [fetchSearchPage]);

  // ── clearSearch ──────────────────────────────────────────────────────────
  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    searchAbortRef.current?.abort();
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
    setCurrentPage(1);
    setFilters({});
    clearSuggestions();
    lastSearchRef.current = { query: '', filters: {} };
  }, [clearSuggestions, setSearchQuery]);

  // ── Cleanup timers on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      searchRequestIdRef.current++;
    };
  }, []);

  // ── Memoized context value ────────────────────────────────────────────────
  const value = useMemo<ModalSearchDataValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      searchResults,
      isSearching,
      searchError,
      hasMore,
      filters,
      setFilters,
      updateFilter,
      clearFilters,
      performSearch,
      loadMoreResults,
      clearSearch,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      removeRecentSearch,
      popularSearches: POPULAR_SEARCHES,
      suggestions,
      isLoadingSuggestions,
      fetchSuggestions,
    }),
    [
      searchQuery, setSearchQuery,
      searchResults, isSearching, searchError, hasMore,
      filters, setFilters, updateFilter, clearFilters,
      performSearch, loadMoreResults, clearSearch,
      recentSearches, addRecentSearch, clearRecentSearches, removeRecentSearch,
      suggestions, isLoadingSuggestions, fetchSuggestions,
    ],
  );

  return (
    <ModalSearchDataContext.Provider value={value}>
      {children}
    </ModalSearchDataContext.Provider>
  );
};
