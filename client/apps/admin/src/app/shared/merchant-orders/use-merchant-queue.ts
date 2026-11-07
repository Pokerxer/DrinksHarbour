'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  merchantRequest,
  type MerchantOrder,
} from '@/services/merchant-order.service';
export type QueueState = 'open' | 'closed' | 'all';
export type QueuePage = {
  orders: MerchantOrder[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};
export function useMerchantQueue(token: string) {
  const [state, setFilter] = useState<QueueState>('open'),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [record, setRecord] = useState<{ scope: string; data: QueuePage }>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const scope = `?state=${state}&page=${page}&limit=25`;
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    void merchantRequest<Partial<QueuePage> & { orders: MerchantOrder[] }>(
      token,
      scope,
      'GET',
      undefined,
      abort.signal
    )
      .then((data) => {
        if (abort.signal.aborted) return;
        if (!Array.isArray(data.orders))
          throw new Error('The merchant queue response is incomplete.');
        setRecord({
          scope,
          data: {
            orders: data.orders,
            total: data.total ?? data.orders.length,
            page: data.page ?? page,
            pages: data.pages ?? 1,
            limit: data.limit ?? 25,
          },
        });
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setRecord(undefined);
          setError(
            failure instanceof Error
              ? failure.message
              : 'Unable to load merchant orders'
          );
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [token, scope, page, refresh]);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  const setState = (next: QueueState) => {
    setFilter(next);
    setPage(1);
  };
  const current = record?.scope === scope ? record.data : undefined;
  return {
    rows: current?.orders,
    pagination: current,
    loading,
    error,
    state,
    setState,
    page,
    setPage,
    reload,
  };
}
