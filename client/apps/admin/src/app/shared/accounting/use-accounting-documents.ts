'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  arApService,
  type ArApSummary,
  type PaymentSide,
} from '@/services/arAp.service';
import type { AccountingDocument } from './accounting-documents';

export type DocumentFilters = {
  search: string;
  status: string;
  returnStatus?: string;
  from: string;
  to: string;
};
const emptyFilters: DocumentFilters = {
  search: '',
  status: '',
  returnStatus: '',
  from: '',
  to: '',
};
const message = (err: unknown) =>
  err instanceof Error ? err.message : 'Could not load accounting data';

export function useAccountingDocuments(side: PaymentSide) {
  const { data: session, status: authStatus } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const identity = `${side}:${token}`;
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);
  const [summaryVersion, setSummaryVersion] = useState(0);
  const [list, setList] = useState({
    identity: '',
    docs: [] as AccountingDocument[],
    total: 0,
    pages: 1,
    loading: true,
    error: '',
  });
  const [balances, setBalances] = useState({
    identity: '',
    data: null as ArApSummary | null,
    loading: true,
    error: '',
  });
  const authenticated = Boolean(token);
  const authLoading = authStatus === 'loading';

  useEffect(() => {
    if (query === filters.search.trim()) return;
    const timer = setTimeout(() => {
      setQuery(filters.search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search, query]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setBalances((previous) => ({
      identity,
      data: previous.identity === identity ? previous.data : null,
      loading: true,
      error: '',
    }));
    const request =
      side === 'customer'
        ? arApService.receivablesSummary(token, true)
        : arApService.payablesSummary(token);
    request
      .then((result) => {
        if (!cancelled)
          setBalances({
            identity,
            data: result.data,
            loading: false,
            error: '',
          });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setBalances((previous) => ({
            ...previous,
            loading: false,
            error: message(err),
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [identity, token, side, summaryVersion]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const keep = (previous: typeof list) =>
      previous.identity === identity
        ? previous
        : { ...previous, docs: [], total: 0, pages: 1 };
    setList((previous) => ({
      ...keep(previous),
      identity,
      loading: true,
      error: '',
    }));
    if (filters.from && filters.to && filters.from > filters.to) {
      setList((previous) => ({
        ...previous,
        loading: false,
        error: 'The start date must be on or before the end date.',
      }));
      return;
    }
    const params = {
      page,
      limit: 25,
      status: filters.status || undefined,
      ...(side === 'customer'
        ? { returnStatus: filters.returnStatus || undefined }
        : {}),
      search: query || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    };
    const load = async () => {
      try {
        const result =
          side === 'customer'
            ? await arApService.invoices(token, params)
            : await arApService.bills(token, params);
        if (cancelled) return;
        const pages = Math.max(1, result.pagination?.pages || 1);
        if (page > pages) {
          setPage(pages);
          return;
        }
        setList({
          identity,
          docs: result.data,
          total: result.pagination?.total ?? result.data.length,
          pages,
          loading: false,
          error: '',
        });
      } catch (err: unknown) {
        if (!cancelled)
          setList((previous) => ({
            ...previous,
            loading: false,
            error: message(err),
          }));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    identity,
    token,
    side,
    page,
    filters.status,
    filters.returnStatus,
    filters.from,
    filters.to,
    query,
    listVersion,
  ]);

  const currentList =
    list.identity === identity && authenticated
      ? list
      : {
          docs: [],
          total: 0,
          pages: 1,
          loading: authLoading || authenticated,
          error: '',
        };
  const currentBalances =
    balances.identity === identity && authenticated
      ? balances
      : { data: null, loading: authLoading || authenticated, error: '' };
  const searchPending = query !== filters.search.trim();
  const updateFilter = (key: keyof DocumentFilters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value }));
    if (key !== 'search') setPage(1);
  };
  const clearFilters = () => {
    setFilters(emptyFilters);
    setQuery('');
    setPage(1);
  };
  const reloadList = () => setListVersion((value) => value + 1);
  const reloadSummary = () => setSummaryVersion((value) => value + 1);
  const refresh = () => {
    reloadList();
    reloadSummary();
  };
  return {
    ...currentList,
    summary: currentBalances.data,
    summaryLoading: currentBalances.loading,
    summaryError: currentBalances.error,
    authenticated,
    authLoading,
    page,
    setPage,
    filters,
    updateFilter,
    clearFilters,
    filtered: Object.values(filters).some(Boolean),
    searchPending,
    reloadList,
    reloadSummary,
    refresh,
  };
}
