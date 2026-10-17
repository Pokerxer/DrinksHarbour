'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { arApService, type OpenInvoice } from '@/services/arAp.service';
export function useCreditInvoices(token: string, customer?: string) {
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(
    async (next = 1) => {
      const id = ++generation.current;
      setLoading(true);
      setError('');
      if (next === 1) {
        setInvoices([]);
        setPage(0);
      }
      try {
        const res = await arApService.invoices(token, {
          scope: customer ? 'open' : 'credit',
          customer,
          page: next,
          limit: 100,
        });
        if (id !== generation.current) return;
        const eligible = (res.data || []).filter(
          (inv) =>
            inv.source === 'sales' &&
            inv.state === 'posted' &&
            !inv.reconciliationIssue &&
            (!inv.currency || inv.currency === 'NGN') &&
            (!customer || inv.customer?._id === customer)
        );
        setInvoices((old) =>
          next === 1
            ? eligible
            : [
                ...old,
                ...eligible.filter(
                  (inv) => !old.some((item) => item._id === inv._id)
                ),
              ]
        );
        setPage(next);
        setPages(res.pagination?.pages || 1);
      } catch (e) {
        if (id === generation.current)
          setError(
            e instanceof Error ? e.message : 'Invoice choices could not load'
          );
      } finally {
        if (id === generation.current) setLoading(false);
      }
    },
    [token, customer]
  );
  useEffect(() => {
    const counter = generation;
    if (token) void load();
    return () => {
      counter.current++;
    };
  }, [token, load]);
  return {
    invoices,
    loading,
    error,
    hasMore: page < pages,
    retry: () => {
      void load(page || 1);
    },
    more: () => {
      void load(page + 1);
    },
  };
}
export type CreditInvoiceChoices = ReturnType<typeof useCreditInvoices>;
