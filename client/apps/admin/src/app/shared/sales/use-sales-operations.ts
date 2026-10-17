'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { SalesOrder } from '@/services/salesOrder.service';
import { loadReturnOrders } from './load-return-orders';
import { loadFulfillmentOrders } from './load-fulfillment-orders';
import type { OperationsKind } from './sales-operations-helpers';

export function useSalesOperations(kind: OperationsKind) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string } | undefined)?.token || '';
  const owner = `${kind}:${token}`;
  const sequence = useRef({ id: 0 });
  const [state, setState] = useState({
    owner: '',
    orders: [] as SalesOrder[],
    loading: false,
    error: '',
  });
  const refresh = useCallback(async () => {
    if (!token) return;
    const id = ++sequence.current.id;
    setState({ owner, orders: [], loading: true, error: '' });
    try {
      const orders = await (kind === 'fulfill'
        ? loadFulfillmentOrders(token)
        : loadReturnOrders(token));
      if (sequence.current.id === id)
        setState({ owner, orders, loading: false, error: '' });
    } catch (error: unknown) {
      if (sequence.current.id === id)
        setState({
          owner,
          orders: [],
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Could not load sales operations.',
        });
    }
  }, [token, kind, owner]);
  useEffect(() => {
    const current = sequence.current;
    void refresh();
    return () => {
      current.id++;
    };
  }, [refresh]);
  const current = state.owner === owner;
  return {
    refresh,
    token,
    signedOut: status !== 'loading' && !token,
    loading: status === 'loading' || (!!token && (!current || state.loading)),
    orders: current ? state.orders : [],
    error: current ? state.error : '',
  };
}
