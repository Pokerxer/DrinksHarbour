'use client';
import { useEffect, useState } from 'react';
import { runSearchRequest } from './search-request';

export function useServerSearch<T>(
  query: string,
  fetchFn: (query: string) => Promise<T[]>,
  debounceMs = 300
) {
  const term = query.trim();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    term: string;
    fetchFn: typeof fetchFn;
    revision: number;
    items: T[];
    error?: string;
  }>();
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void runSearchRequest(
        () => fetchFn(term),
        controller.signal,
        (items, error) => {
          setResult({ term, fetchFn, revision, items, error });
        }
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, fetchFn, debounceMs, revision]);
  const current =
    result?.term === term &&
    result.fetchFn === fetchFn &&
    result.revision === revision
      ? result
      : undefined;
  return {
    items: term.length >= 2 ? (current?.items ?? []) : [],
    searching: term.length >= 2 && !current,
    error: term.length >= 2 ? current?.error : undefined,
    retry: () => setRevision((value) => value + 1),
  };
}
