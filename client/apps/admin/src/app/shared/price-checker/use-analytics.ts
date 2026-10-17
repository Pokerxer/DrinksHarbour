'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import { datePreset, reportDateError } from './workflow-utils';
import type { ReportFilters } from './report-filters';
import type { Kiosk, KioskAnalytics } from './types';

export function useAnalytics(token: string, kiosk: string) {
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    ...datePreset(30),
    kiosk,
  }));
  const [query, setQuery] = useState(() => ({ ...filters, page: '1' }));
  const [report, setReport] = useState<{
    data: KioskAnalytics;
    scope: ReportFilters;
  } | null>(null);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [validation, setValidation] = useState('');
  const pendingList = useRef<AbortController | null>(null);

  const loadKiosks = useCallback(async () => {
    if (!token) return;
    pendingList.current?.abort();
    const controller = new AbortController();
    pendingList.current = controller;
    setListLoading(true);
    setListError('');
    try {
      const rows = await api.list(token, controller.signal);
      if (!controller.signal.aborted) setKiosks(rows);
    } catch (error) {
      if (!controller.signal.aborted)
        setListError(
          error instanceof Error
            ? error.message
            : 'Unable to load kiosk choices.'
        );
    } finally {
      if (!controller.signal.aborted) setListLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void loadKiosks();
    return () => pendingList.current?.abort();
  }, [loadKiosks]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setReport(null);
    api
      .analytics(
        Object.fromEntries(Object.entries(query).filter(([, value]) => value)),
        token,
        controller.signal
      )
      .then((data) => {
        if (!controller.signal.aborted)
          setReport({
            data,
            scope: { from: query.from, to: query.to, kiosk: query.kiosk },
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : 'Unable to load report.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, token]);

  function edit(next: ReportFilters) {
    setFilters(next);
    setValidation('');
  }
  function apply(next = filters) {
    const problem = reportDateError(next.from, next.to);
    setValidation(problem);
    if (!problem) setQuery({ ...next, page: '1' });
  }
  function preset(days: number) {
    const next = { ...filters, ...datePreset(days) };
    edit(next);
    apply(next);
  }
  const dirty =
    filters.from !== query.from ||
    filters.to !== query.to ||
    filters.kiosk !== query.kiosk;
  return {
    filters,
    edit,
    report,
    kiosks,
    loading,
    error,
    validation,
    listError,
    listLoading,
    loadKiosks,
    apply,
    preset,
    dirty,
    refresh: () => setQuery((current) => ({ ...current })),
    paginate: (page: number) => {
      if (!loading && report && page >= 1 && page <= 10000)
        setQuery((current) => ({ ...current, page: String(page) }));
    },
  };
}
