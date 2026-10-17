'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { salesOrderService } from '@/services/salesOrder.service';
import {
  mergeRecentDocs,
  monthToDateRange,
  tallyGroups,
  type GroupTallies,
} from './sales-overview-helpers';

interface OverviewData {
  orderTallies: GroupTallies;
  monthTallies: GroupTallies;
  payTallies: GroupTallies;
  quoteTallies: GroupTallies;
  recentDocs: Parameters<typeof mergeRecentDocs>[0];
  currency: string;
  truncated: boolean;
}
interface OverviewState {
  token: string;
  data: OverviewData | null;
  loading: boolean;
  error: string | null;
}
const activeOrderFilter = JSON.stringify([
  {
    field: 'orderStatus',
    operator: 'in',
    value: ['confirmed', 'partially_fulfilled', 'fulfilled'],
  },
]);

export function useSalesOverview(token: string) {
  const request = useRef({ id: 0 });
  const [state, setState] = useState<OverviewState>({
    token: '',
    data: null,
    loading: false,
    error: null,
  });
  const load = useCallback(async () => {
    if (!token) return;
    const id = ++request.current.id;
    setState({ token, data: null, loading: true, error: null });
    try {
      const range = monthToDateRange();
      const grouped = { currency: 'NGN', page: 1, limit: 1 };
      const [
        ordersAll,
        ordersMonth,
        payments,
        quotes,
        recentOrders,
        recentQuotes,
      ] = await Promise.all([
        salesOrderService.list(token, {
          ...grouped,
          docType: 'order',
          groupBy: 'orderStatus',
        }),
        salesOrderService.list(token, {
          ...grouped,
          docType: 'order',
          groupBy: 'orderStatus',
          ...range,
        }),
        salesOrderService.list(token, {
          ...grouped,
          docType: 'order',
          groupBy: 'paymentStatus',
          filters: activeOrderFilter,
        }),
        salesOrderService.list(token, {
          ...grouped,
          docType: 'quotation',
          groupBy: 'quoteStatus',
        }),
        salesOrderService.list(token, { docType: 'order', limit: 8 }),
        salesOrderService.list(token, { docType: 'quotation', limit: 8 }),
      ]);
      if (request.current.id !== id) return;
      setState({
        token,
        loading: false,
        error: null,
        data: {
          orderTallies: tallyGroups(ordersAll.groups),
          monthTallies: tallyGroups(ordersMonth.groups),
          payTallies: tallyGroups(payments.groups),
          quoteTallies: tallyGroups(quotes.groups),
          recentDocs: mergeRecentDocs(
            recentOrders.data ?? [],
            recentQuotes.data ?? [],
            8
          ),
          currency: 'NGN',
          truncated: [ordersAll, ordersMonth, payments, quotes].some(
            (r) => r.truncated === true
          ),
        },
      });
    } catch (err: unknown) {
      if (request.current.id === id)
        setState({
          token,
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load overview',
        });
    }
  }, [token]);
  useEffect(() => {
    const activeRequest = request.current;
    void load();
    return () => {
      activeRequest.id++;
    };
  }, [load]);
  const current = state.token === token;
  return {
    load,
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !!token && (!current || state.loading),
  };
}
