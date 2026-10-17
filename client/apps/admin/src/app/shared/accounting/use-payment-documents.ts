'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { arApService, type PaymentSide } from '@/services/arAp.service';
import { documentView, type AccountingDocument } from './accounting-documents';
export function usePaymentDocuments(
  token: string,
  side: PaymentSide,
  initialDocument?: AccountingDocument,
  party?: string
) {
  const [docs, setDocs] = useState<AccountingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const sequence = useRef(0);
  const retryPage = useRef(1);
  const load = useCallback(
    async (next = 1) => {
      const id = ++sequence.current;
      retryPage.current = next;
      setError('');
      setLoading(true);
      if (next === 1) {
        setDocs([]);
        setPage(0);
      }
      if (!token) {
        setError('Sign in to record a payment.');
        setLoading(false);
        return;
      }
      try {
        const fetchDocs = (search?: string) =>
          side === 'customer'
            ? arApService.invoices(token, {
                page: next,
                limit: 100,
                search,
                scope: 'open',
                customer: party,
              })
            : arApService.bills(token, {
                page: next,
                limit: 100,
                search,
                vendor: party,
              });
        const result = await fetchDocs();
        let rows: AccountingDocument[] = result.data || [];
        if (
          next === 1 &&
          initialDocument &&
          !rows.some((doc) => doc._id === initialDocument._id)
        ) {
          const lookup = await fetchDocs(
            documentView(initialDocument, side).label
          );
          const selected = lookup.data?.find(
            (doc) => doc._id === initialDocument._id
          );
          if (!selected)
            throw new Error(
              'This document is no longer open. Close the dialog and refresh the list.'
            );
          rows = [selected, ...rows];
        }
        if (id !== sequence.current) return;
        setDocs((old) =>
          next === 1
            ? rows
            : [
                ...old,
                ...rows.filter(
                  (doc) => !old.some((item) => item._id === doc._id)
                ),
              ]
        );
        setPage(next);
        setPages(result.pagination?.pages || 1);
      } catch (e) {
        if (id === sequence.current)
          setError(
            e instanceof Error ? e.message : 'Could not load allocations'
          );
      } finally {
        if (id === sequence.current) setLoading(false);
      }
    },
    [token, side, initialDocument, party]
  );
  useEffect(() => {
    const counter = sequence;
    void load();
    return () => {
      counter.current++;
    };
  }, [load]);
  return {
    docs,
    loading,
    error,
    hasMore: page < pages,
    loadMore: () => {
      void load(page + 1);
    },
    reload: () => {
      void load(retryPage.current);
    },
    refresh: () => {
      void load(1);
    },
  };
}
