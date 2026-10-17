'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import {API_URL,POPULAR_SEARCHES} from './search-data-support';
import type {RecentSearch} from './search-types';
const SUGGESTION_DEBOUNCE_MS = 250;
export function useSearchSuggestions(recentSearches: RecentSearch[]) {
  const [suggestions,setSuggestions]=useState<string[]>([]);
  const [isLoadingSuggestions,setIsLoadingSuggestions]=useState(false);
  const suggestionAbortRef=useRef<AbortController|null>(null);
  const suggestionTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const suggestionRequestIdRef=useRef(0);
  const recentSearchesRef=useRef(recentSearches);
  recentSearchesRef.current=recentSearches;
  const clearSuggestions=useCallback(()=>{
    suggestionRequestIdRef.current++;
    if(suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    suggestionAbortRef.current?.abort();
    setSuggestions([]);setIsLoadingSuggestions(false);
  },[]);
  const fetchSuggestions = useCallback((query: string) => {
    const requestId = ++suggestionRequestIdRef.current;
    setIsLoadingSuggestions(false); setSuggestions([]);
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
          if (controller.signal.aborted || requestId !== suggestionRequestIdRef.current) return;
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setSuggestions(data.data);
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted || requestId !== suggestionRequestIdRef.current) return;
      } finally {
        if (requestId === suggestionRequestIdRef.current) setIsLoadingSuggestions(false);
      }

      if (controller.signal.aborted || requestId !== suggestionRequestIdRef.current) return;
      // Fallback: read from ref — no closure dep on recentSearches state
      const q    = query.toLowerCase();
      const seen = new Set<string>();
      const fb: string[] = [];

      for (const s of [...recentSearchesRef.current.map((r) => r.query), ...POPULAR_SEARCHES]) {
        const lower = s.toLowerCase();
        if (lower.includes(q) && !seen.has(lower)) {
          seen.add(lower);
          fb.push(s);
          if (fb.length >= 8) break;
        }
      }

      setSuggestions(fb);
    }, SUGGESTION_DEBOUNCE_MS);
  }, []);

  useEffect(()=>()=>{
    suggestionRequestIdRef.current++;
    if(suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    suggestionAbortRef.current?.abort();
  },[]);
  return {suggestions,isLoadingSuggestions,fetchSuggestions,clearSuggestions};
}
