'use client';
import { useEffect, useRef } from 'react';
/** Inventory links reuse the authorized POS order history and return actions. */
export function usePOSReceiptLink<
  T extends { _id: string; receiptNumber?: string },
>(
  orders: T[],
  context: string,
  setScope: (scope: 'session' | 'all') => void,
  setSearch: (search: string) => void,
  setSelected: (order: T | null) => void
) {
  const requested = useRef<{
    receipt: string;
    order: string;
    opened: boolean;
    staleOrders: T[] | null;
  } | null>(null);
  const previousContext = useRef(context);
  const currentOrders = useRef(orders);
  currentOrders.current = orders;
  useEffect(() => {
    const changed = previousContext.current !== context;
    previousContext.current = context;
    if (changed) setSelected(null);
    const query = new URLSearchParams(window.location.search);
    const receipt = query.get('receipt') || '';
    const order = query.get('order') || '';
    requested.current =
      receipt && order
        ? {
            receipt,
            order,
            opened: false,
            staleOrders: changed ? currentOrders.current : null,
          }
        : null;
    if (requested.current) {
      setScope('all');
      setSearch(receipt);
    }
  }, [context, setScope, setSearch, setSelected]);
  useEffect(() => {
    const target = requested.current;
    if (!target || target.opened || target.staleOrders === orders) return;
    const original = orders.find(
      (order) =>
        order._id === target.order && order.receiptNumber === target.receipt
    );
    if (original) {
      target.opened = true;
      setSelected(original);
    }
  }, [orders, context, setSelected]);
}
