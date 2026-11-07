import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import type { BrandCardData } from '@/app/brands/brand-results';
import { loadBrands } from './loadBrands';

interface Options {
  initialBrands?: BrandCardData[];
  initialError?: string;
  search: string;
  country: string;
}

export function useBrandsDirectory({ initialBrands, initialError = '', search, country }: Options) {
  const [brands, setBrands] = useState(initialBrands ?? []);
  const [catalog, setCatalog] = useState(initialBrands);
  const [loading, setLoading] = useState(initialBrands === undefined && !initialError);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const fullCatalog = useRef(initialBrands);
  const sequence = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++sequence.current;
    const current = () => id === sequence.current && !controller.signal.aborted;
    if (!query && !country && fullCatalog.current !== undefined && attempt === 0) {
      setBrands(fullCatalog.current);
      setLoading(false);
      setError('');
    } else {
      setLoading(true);
      setError('');
      void loadBrands({ apiUrl: API_URL, search: query, country, signal: controller.signal })
        .then(list => {
          if (!current()) return;
          setBrands(list);
          if (!query && !country) {
            fullCatalog.current = list;
            setCatalog(list);
          }
        })
        .catch((cause: unknown) => {
          if (current()) setError(cause instanceof Error ? cause.message : 'Could not load brands. Please try again.');
        })
        .finally(() => { if (current()) setLoading(false); });
    }
    return () => { sequence.current++; controller.abort(); };
  }, [query, country, attempt]);

  return { brands, catalog: catalog ?? [], hasCatalog: catalog !== undefined,
    loading: loading || query !== search.trim(), error,
    retry: () => setAttempt(value => value + 1) };
}
