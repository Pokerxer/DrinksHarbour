'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ProductType } from '@/type/ProductType';

interface SearchFilters {
  category?: string;
  type?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

interface SearchResult {
  products: ProductType[];
  total: number;
  page: number;
  totalPages: number;
}

interface RecentSearch {
  query: string;
  filters?: SearchFilters;
  timestamp: number;
}

interface ModalSearchContextValue {
  // Modal state
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
  
  // Filters
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  clearFilters: () => void;
  
  // Search actions
  performSearch: (query?: string) => Promise<void>;
  loadMoreResults: () => Promise<void>;
  
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
  fetchSuggestions: (query: string) => Promise<void>;
}

const ModalSearchContext = createContext<ModalSearchContextValue | undefined>(undefined);

const MAX_RECENT_SEARCHES = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const useModalSearchContext = (): ModalSearchContextValue => {
  const context = useContext(ModalSearchContext);
  if (!context) {
    throw new Error(
      'useModalSearchContext must be used within a ModalSearchProvider',
    );
  }
  return context;
};

interface ModalSearchProviderProps {
  children: ReactNode;
}

export const ModalSearchProvider: React.FC<ModalSearchProviderProps> = ({
  children,
}) => {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState<SearchFilters>({});
  
  // Recent searches (load from localStorage on mount)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recentSearches');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  
  // Popular searches (static for now, could be fetched from API)
  const [popularSearches] = useState<string[]>([
    'Whiskey',
    'Red Wine',
    'Beer',
    'Vodka',
    'Champagne',
    'Gin',
    'Rum',
    'Brandy',
  ]);
  
  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Modal actions
  const openModalSearch = useCallback(() => {
    setIsModalOpen(true);
    // Prevent body scroll when modal is open
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const closeModalSearch = useCallback(() => {
    setIsModalOpen(false);
    // Restore body scroll
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'unset';
    }
  }, []);

  const toggleModalSearch = useCallback(() => {
    if (isModalOpen) {
      closeModalSearch();
    } else {
      openModalSearch();
    }
  }, [isModalOpen, openModalSearch, closeModalSearch]);

  // Save recent searches to localStorage
  const saveRecentSearches = useCallback((searches: RecentSearch[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('recentSearches', JSON.stringify(searches));
    }
  }, []);

  // Add recent search
  const addRecentSearch = useCallback((query: string, searchFilters?: SearchFilters) => {
    if (!query.trim()) return;
    
    setRecentSearches((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((s) => s.query.toLowerCase() !== query.toLowerCase());
      
      // Add new search at the beginning
      const newSearch: RecentSearch = {
        query,
        filters: searchFilters,
        timestamp: Date.now(),
      };
      
      const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(updated);
      return updated;
    });
  }, [saveRecentSearches]);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    saveRecentSearches([]);
  }, [saveRecentSearches]);

  // Remove single recent search
  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s.query !== query);
      saveRecentSearches(updated);
      return updated;
    });
  }, [saveRecentSearches]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Perform search
  const performSearch = useCallback(async (query?: string) => {
    const searchTerm = query ?? searchQuery;
    
    if (!searchTerm.trim() && Object.keys(filters).length === 0) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCurrentPage(1);

    try {
      const params = new URLSearchParams();
      params.append('q', searchTerm);
      params.append('page', '1');
      params.append('limit', '12');
      
      // Add filters
      if (filters.category) params.append('category', filters.category);
      if (filters.type) params.append('type', filters.type);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.inStock) params.append('inStock', 'true');

      const searchUrl = `${API_URL}/api/products/search?${params.toString()}`;
      console.log('Fetching search:', searchUrl);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      console.log('Search response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Search response data:', data);

      if (data.success) {
        // Handle different response structures
        const responseData = data.data || data;
        const products = responseData.products || [];
        
        // Handle both flat and nested pagination structures
        let total, page, totalPages;
        if (responseData.pagination) {
          total = responseData.pagination.totalResults || products.length;
          page = responseData.pagination.currentPage || 1;
          totalPages = responseData.pagination.totalPages || 1;
        } else {
          total = responseData.total || products.length;
          page = responseData.page || 1;
          totalPages = responseData.totalPages || 1;
        }
        
        console.log('Setting search results:', { products: products.length, total, page, totalPages });
        
        setSearchResults({
          products,
          total,
          page,
          totalPages,
        });
        
        // Add to recent searches
        addRecentSearch(searchTerm, filters);
      } else {
        setSearchError(data.message || 'Search failed');
        setSearchResults({ products: [], total: 0, page: 1, totalPages: 0 });
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to perform search. Please try again.');
      setSearchResults({ products: [], total: 0, page: 1, totalPages: 0 });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filters, addRecentSearch]);

  // Load more results (pagination)
  const loadMoreResults = useCallback(async () => {
    if (!searchResults || currentPage >= searchResults.totalPages || isSearching) {
      return;
    }

    const nextPage = currentPage + 1;
    setIsSearching(true);

    try {
      const params = new URLSearchParams();
      params.append('q', searchQuery);
      params.append('page', nextPage.toString());
      params.append('limit', '12');
      
      if (filters.category) params.append('category', filters.category);
      if (filters.type) params.append('type', filters.type);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.inStock) params.append('inStock', 'true');

      const response = await fetch(`${API_URL}/api/products/search?${params.toString()}`);
      const data = await response.json();

      if (data.success && searchResults) {
        setSearchResults({
          ...searchResults,
          products: [...searchResults.products, ...(data.data.products || [])],
          page: nextPage,
        });
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filters, searchResults, currentPage, isSearching]);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);

    try {
      // Try to fetch suggestions from API
      const response = await fetch(`${API_URL}/api/products/suggestions?q=${encodeURIComponent(query)}&limit=8`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setSuggestions(data.data);
          return;
        }
      }
      
      // Fallback: Use recent searches and popular searches
      const fallbackSuggestions = [
        ...recentSearches.filter(s => 
          s.query.toLowerCase().includes(query.toLowerCase())
        ).map(s => s.query),
        ...popularSearches.filter(p => 
          p.toLowerCase().includes(query.toLowerCase())
        ),
      ].slice(0, 8);
      
      setSuggestions(fallbackSuggestions);
    } catch (error) {
      // On error, use fallback
      const fallbackSuggestions = [
        ...recentSearches.filter(s => 
          s.query.toLowerCase().includes(query.toLowerCase())
        ).map(s => s.query),
        ...popularSearches.filter(p => 
          p.toLowerCase().includes(query.toLowerCase())
        ),
      ].slice(0, 8);
      
      setSuggestions(fallbackSuggestions);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [recentSearches, popularSearches]);

  const contextValue: ModalSearchContextValue = {
    // Modal state
    isModalOpen,
    openModalSearch,
    closeModalSearch,
    toggleModalSearch,
    
    // Search state
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchError,
    
    // Filters
    filters,
    setFilters,
    clearFilters,
    
    // Search actions
    performSearch,
    loadMoreResults,
    
    // Recent searches
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
    
    // Popular searches
    popularSearches,
    
    // Suggestions
    suggestions,
    isLoadingSuggestions,
    fetchSuggestions,
  };

  return (
    <ModalSearchContext.Provider value={contextValue}>
      {children}
    </ModalSearchContext.Provider>
  );
};
