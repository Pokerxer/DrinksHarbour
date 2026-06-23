'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { ProductType } from '@/types/product.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  category?: string;
  type?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface SearchResult {
  products: ProductType[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RecentSearch {
  query: string;
  filters?: SearchFilters;
  timestamp: number;
}

interface ModalSearchContextValue {
  // Modal
  isModalOpen: boolean;
  openModalSearch: () => void;
  closeModalSearch: () => void;
  toggleModalSearch: () => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult | null;
  isSearching: boolean;
  searchError: string | null;
  hasMore: boolean;

  // Filters
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;

  // Actions
  performSearch: (query?: string, page?: number) => Promise<void>;
  loadMoreResults: () => Promise<void>;
  clearSearch: () => void;

  // Recent searches
  recentSearches: RecentSearch[];
  addRecentSearch: (query: string, filters?: SearchFilters) => void;
  clearRecentSearches: () => void;
  removeRecentSearch: (query: string) => void;

  // Popular searches
  popularSearches: string[];

  // Suggestions
  suggestions: string[];
  isLoadingSuggestions: boolean;
  fetchSuggestions: (query: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_KEY = 'dh_recentSearches';
const MAX_RECENT = 10;
const SUGGESTION_DEBOUNCE_MS = 250;
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const POPULAR_SEARCHES: string[] = [
  'Whiskey', 'Red Wine', 'Beer', 'Vodka',
  'Champagne', 'Gin', 'Rum', 'Brandy',
  'Tequila', 'Rosé',
];

function buildSearchParams(
  query: string,
  filters: SearchFilters,
  page: number,
  limit = 8,
): URLSearchParams {
  const p = new URLSearchParams();
  if (query.trim()) p.set('q', query.trim());
  p.set('page', String(page));
  p.set('limit', String(limit));
  if (filters.category)                 p.set('category',  filters.category);
  if (filters.type)                     p.set('type',       filters.type);
  if (filters.brand)                    p.set('brand',      filters.brand);
  if (filters.minPrice !== undefined)   p.set('minPrice',   String(filters.minPrice));
  if (filters.maxPrice !== undefined)   p.set('maxPrice',   String(filters.maxPrice));
  if (filters.inStock)                  p.set('inStock',    'true');
  return p;
}

function readLocalRecents(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRecents(searches: RecentSearch[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(searches));
  } catch { /* quota exceeded — ignore */ }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ModalSearchContext = createContext<ModalSearchContextValue | undefined>(undefined);

export const useModalSearchContext = (): ModalSearchContextValue => {
  const ctx = useContext(ModalSearchContext);
  if (!ctx) throw new Error('useModalSearchContext must be used within a ModalSearchProvider');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const ModalSearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Modal
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const originalOverflow                  = useRef<string>('');

  // Search
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching]     = useState(false);
  const [searchError, setSearchError]     = useState<string | null>(null);
  const [currentPage, setCurrentPage]     = useState(1);

  // Track the exact term + filters used for the current result set (for loadMore)
  const lastSearchRef = useRef<{ query: string; filters: SearchFilters }>({ query: '', filters: {} });

  // Filters
  const [filters, setFilters]             = useState<SearchFilters>({});

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(readLocalRecents);

  // Popular searches
  const [popularSearches] = useState<string[]>(POPULAR_SEARCHES);

  // Suggestions
  const [suggestions, setSuggestions]               = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionAbortRef                           = useRef<AbortController | null>(null);
  const suggestionTimerRef                           = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort controller for main search
  const searchAbortRef = useRef<AbortController | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasMore = Boolean(searchResults && currentPage < searchResults.totalPages);

  // ── Body scroll lock ───────────────────────────────────────────────────────
  const openModalSearch = useCallback(() => {
    if (typeof document !== 'undefined') {
      originalOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    setIsModalOpen(true);
  }, []);

  const closeModalSearch = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = originalOverflow.current;
    }
    setIsModalOpen(false);
  }, []);

  const toggleModalSearch = useCallback(() => {
    setIsModalOpen((open) => {
      if (open) {
        if (typeof document !== 'undefined')
          document.body.style.overflow = originalOverflow.current;
        return false;
      } else {
        if (typeof document !== 'undefined') {
          originalOverflow.current = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
        }
        return true;
      }
    });
  }, []);

  // Restore scroll on unmount (safety net)
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined')
        document.body.style.overflow = originalOverflow.current;
    };
  }, []);

  // ── Recent searches ────────────────────────────────────────────────────────
  const addRecentSearch = useCallback((query: string, searchFilters?: SearchFilters) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.query.toLowerCase() !== query.toLowerCase());
      const updated  = [{ query, filters: searchFilters, timestamp: Date.now() }, ...filtered]
        .slice(0, MAX_RECENT);
      writeLocalRecents(updated);
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    writeLocalRecents([]);
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s.query !== query);
      writeLocalRecents(updated);
      return updated;
    });
  }, []);

  // ── Filters ────────────────────────────────────────────────────────────────
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  // ── Core fetch helper ──────────────────────────────────────────────────────
  const fetchSearchPage = useCallback(async (
    query: string,
    activeFilters: SearchFilters,
    page: number,
    signal: AbortSignal,
  ): Promise<SearchResult> => {
    const params = buildSearchParams(query, activeFilters, page);
    const res    = await fetch(`${API_URL}/api/products/search?${params}`, { signal });

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
  }, []);

  // ── performSearch ──────────────────────────────────────────────────────────
  const performSearch = useCallback(async (query?: string, page = 1) => {
    const term = (query ?? searchQuery).trim();

    // Abort any in-flight search
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);
    if (page === 1) setCurrentPage(1);

    try {
      const result = await fetchSearchPage(term, filters, page, controller.signal);

      setSearchResults(result);
      setCurrentPage(page);
      lastSearchRef.current = { query: term, filters };

      // Only add non-empty queries to history
      if (term) addRecentSearch(term, filters);
    } catch (err: any) {
      if (err.name === 'AbortError') return;           // intentionally cancelled
      setSearchError(err.message ?? 'Search failed');
      if (page === 1) setSearchResults({ products: [], total: 0, page: 1, totalPages: 0 });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filters, fetchSearchPage, addRecentSearch]);

  // ── loadMoreResults ────────────────────────────────────────────────────────
  const loadMoreResults = useCallback(async () => {
    if (!hasMore || isSearching) return;

    const nextPage   = currentPage + 1;
    const { query, filters: f } = lastSearchRef.current;

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);

    try {
      const result = await fetchSearchPage(query, f, nextPage, controller.signal);

      setSearchResults((prev) =>
        prev
          ? { ...result, products: [...prev.products, ...result.products] }
          : result,
      );
      setCurrentPage(nextPage);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('loadMoreResults error:', err.message);
    } finally {
      setIsSearching(false);
    }
  }, [hasMore, isSearching, currentPage, fetchSearchPage]);

  // ── clearSearch ────────────────────────────────────────────────────────────
  const clearSearch = useCallback(() => {
    searchAbortRef.current?.abort();
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
    setCurrentPage(1);
    setFilters({});
    setSuggestions([]);
    lastSearchRef.current = { query: '', filters: {} };
  }, []);

  // ── fetchSuggestions (debounced + abortable) ───────────────────────────────
  const fetchSuggestions = useCallback((query: string) => {
    // Clear pending timer and in-flight request
    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    suggestionAbortRef.current?.abort();

    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    suggestionTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      suggestionAbortRef.current = controller;
      setIsLoadingSuggestions(true);

      try {
        const res = await fetch(
          `${API_URL}/api/products/suggestions?q=${encodeURIComponent(query)}&limit=8`,
          { signal: controller.signal },
        );

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setSuggestions(data.data);
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      } finally {
        setIsLoadingSuggestions(false);
      }

      // Fallback: merge recent + popular, deduplicated, matching prefix/substring
      const q    = query.toLowerCase();
      const seen = new Set<string>();
      const fb: string[] = [];

      for (const s of [...recentSearches.map((r) => r.query), ...popularSearches]) {
        const lower = s.toLowerCase();
        if (lower.includes(q) && !seen.has(lower)) {
          seen.add(lower);
          fb.push(s);
          if (fb.length >= 8) break;
        }
      }

      setSuggestions(fb);
    }, SUGGESTION_DEBOUNCE_MS);
  }, [recentSearches, popularSearches]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
      suggestionAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    };
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  const value: ModalSearchContextValue = {
    isModalOpen,
    openModalSearch,
    closeModalSearch,
    toggleModalSearch,

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

    popularSearches,

    suggestions,
    isLoadingSuggestions,
    fetchSuggestions,
  };

  return (
    <ModalSearchContext.Provider value={value}>
      {children}
    </ModalSearchContext.Provider>
  );
};
