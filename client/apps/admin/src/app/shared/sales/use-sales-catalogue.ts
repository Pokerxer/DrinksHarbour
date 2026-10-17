'use client';
import { useEffect, useRef, useState } from 'react';
import {
  loadCataloguePage,
  emptyFilters,
  type CatalogueFilters,
  type CataloguePage,
} from './sales-catalog-data';

const noFacets = { categories: [], brands: [], types: [] };

export function useSalesCatalogue(
  open: boolean,
  token: string,
  warehouseId?: string,
  pricelistId?: string,
  quantities: Record<string, number> = {}
) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CatalogueFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    pageKey: string;
    readyKey?: string;
    blocking?: boolean;
    data?: CataloguePage;
    error: string;
    loading: boolean;
  }>({ key: '', pageKey: '', error: '', loading: false });
  const settledQuote = useRef({ context: '' });
  const lastRequestKey = useRef('');
  const cache = useRef(new Map<string, CataloguePage>());
  const facets = useRef<{
    scope: string;
    data: NonNullable<CataloguePage['facets']>;
  }>({ scope: '', data: noFacets });
  const quantitiesKey = JSON.stringify(
    Object.entries(quantities)
      .filter(([, qty]) => qty > 1)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const priceKey = `${pricelistId || ''}|${quantitiesKey}`;
  const scope = `${token}|${warehouseId || ''}`;
  const previousScope = useRef(scope);
  const requestPage = previousScope.current === scope ? page : 1;
  const pageKey = JSON.stringify([scope, search, filters, requestPage]);
  const key = JSON.stringify([pageKey, priceKey]);
  const contextKey = JSON.stringify([pageKey, pricelistId || '', revision]);

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        setSearch(query.trim());
        setPage(1);
      },
      query.trim() ? 220 : 0
    );
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    cache.current.clear();
    facets.current = { scope: '', data: noFacets };
    setPage(1);
  }, [scope]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const cached = cache.current.get(key);
    const quantityOnly =
      settledQuote.current.context === contextKey &&
      lastRequestKey.current !== key;
    lastRequestKey.current = key;
    setState((previous) => ({
      key,
      pageKey,
      readyKey: previous.readyKey,
      blocking: !quantityOnly,
      data:
        cached ?? (previous.pageKey === pageKey ? previous.data : undefined),
      error: '',
      loading: true,
    }));
    if (!token) {
      setState({
        key,
        pageKey,
        error: 'Please sign in again to browse your catalogue.',
        loading: false,
      });
      return;
    }
    const load = () =>
      loadCataloguePage({
        token,
        warehouseId,
        query: search,
        filters,
        page: requestPage,
        facets: facets.current.scope !== scope,
        signal: controller.signal,
        pricelistId,
        quantities: Object.fromEntries(
          JSON.parse(quantitiesKey) as [string, number][]
        ),
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (data.facets) facets.current = { scope, data: data.facets };
          cache.current.set(key, data);
          if (cache.current.size > 8)
            cache.current.delete(cache.current.keys().next().value!);
          settledQuote.current = { context: contextKey };
          setState({
            key,
            pageKey,
            readyKey: contextKey,
            data,
            error: '',
            loading: false,
          });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setState({
              key,
              pageKey,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to load the catalogue.',
              loading: false,
            });
        });
    const timeout = quantityOnly ? setTimeout(load, 250) : undefined;
    if (!quantityOnly) load();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    open,
    token,
    warehouseId,
    search,
    filters,
    requestPage,
    revision,
    key,
    scope,
    pricelistId,
    quantitiesKey,
    pageKey,
    contextKey,
  ]);

  const current = state.key === key;
  const pendingSearch = query.trim() !== search;
  return {
    query,
    setQuery,
    filters,
    page: requestPage,
    data: current || state.pageKey === pageKey ? state.data : undefined,
    error: current ? state.error : '',
    loading: open && (!current || state.loading || pendingSearch),
    busy: state.readyKey !== contextKey || !!state.blocking || pendingSearch,
    pricesUpdating:
      open &&
      state.readyKey === contextKey &&
      (!current || state.loading) &&
      !state.blocking,
    facets: facets.current.scope === scope ? facets.current.data : noFacets,
    setFilters: (next: CatalogueFilters) => {
      setFilters(next);
      setPage(1);
    },
    setPage,
    retry: () => {
      facets.current = { scope: '', data: noFacets };
      cache.current.clear();
      setRevision((n) => n + 1);
    },
  };
}
