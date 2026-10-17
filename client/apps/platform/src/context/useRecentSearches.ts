'use client';
import {useState,useCallback} from 'react';
import type {SearchFilters,RecentSearch} from './search-types';
import {readLocalRecents,writeLocalRecents} from './search-data-support';
const MAX_RECENT=10;
export function useRecentSearches(){
  const [recentSearches,setRecentSearches]=useState<RecentSearch[]>(readLocalRecents);
  // ── Recent searches ──────────────────────────────────────────────────────
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

  return {recentSearches,addRecentSearch,clearRecentSearches,removeRecentSearch};
}
