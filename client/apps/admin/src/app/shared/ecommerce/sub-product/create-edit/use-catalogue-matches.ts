'use client';

import { useEffect, useRef, useState } from 'react';
import { searchCatalogueProducts } from '@/services/catalogue-search';
import type { Product } from './components/ProductSearchResults';
import { LatestRequest, isAbortError } from './latest-request';

export function useCatalogueMatches(name: string, token?: string) {
  const query = name.trim().slice(0, 160);
  const request = useRef(new LatestRequest());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    query: '',
    products: [] as Product[],
    loading: false,
    error: '',
  });

  useEffect(() => {
    const guard = request.current;
    guard.cancel();
    setState({
      query,
      products: [],
      loading: Boolean(token && query.length >= 2),
      error: '',
    });
    if (!token || query.length < 2) return;
    // Begin before the debounce so an earlier response cannot land during it.
    const { ticket, signal } = guard.begin();
    const timer = setTimeout(async () => {
      try {
        const products = await searchCatalogueProducts(query, {
          token,
          signal,
        });
        if (guard.isCurrent(ticket))
          setState({ query, products, loading: false, error: '' });
      } catch (error) {
        if (!isAbortError(error) && guard.isCurrent(ticket)) {
          setState({
            query,
            products: [],
            loading: false,
            error: 'Could not check the catalog. Please retry.',
          });
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      guard.cancel();
    };
  }, [query, token, attempt]);

  return {
    ...(state.query === query
      ? state
      : { query, products: [], loading: true, error: '' }),
    retry: () => setAttempt((value) => value + 1),
  };
}
