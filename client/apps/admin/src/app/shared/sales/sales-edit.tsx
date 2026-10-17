'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import SalesCreate from './sales-create';
import SalesNavHeader from './sales-nav-header';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';

export default function SalesEdit({ id }: { id: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const owner = `${id}:${token}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const request = useRef(0);
  const [record, setRecord] = useState<{
    owner: string;
    doc: SalesOrder;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const sequence = ++request.current;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await salesOrderService.get(id, token);
      if (sequence === request.current && ownerRef.current === owner)
        setRecord({ owner, doc: result.data });
    } catch (err) {
      if (sequence === request.current && ownerRef.current === owner)
        setError(
          err instanceof Error ? err.message : 'Could not load this order.',
        );
    } finally {
      if (sequence === request.current && ownerRef.current === owner)
        setLoading(false);
    }
  }, [id, token, owner]);
  const invalidateRead = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    void load();
    return invalidateRead;
  }, [load, invalidateRead]);
  const so = record?.owner === owner ? record.doc : null;
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full px-3 py-3 xl:px-4">
        {status === 'loading' ? (
          <p role="status">Loading session…</p>
        ) : !token ? (
          <p>Sign in to edit sales orders.</p>
        ) : loading ? (
          <div
            role="status"
            className="h-48 animate-pulse rounded-xl border bg-white"
            aria-label="Loading order"
          />
        ) : error ? (
          <div role="alert" className="space-y-3 py-8">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-brand underline"
            >
              Retry
            </button>
          </div>
        ) : so ? (
          <SalesCreate
            key={`${so._id}:${so.locked}:${so.orderStatus}:${so.quoteStatus}`}
            mode="edit"
            initial={so}
            onUpdated={(doc) => {
              if (ownerRef.current === owner && doc._id === id)
                setRecord({ owner, doc });
            }}
          />
        ) : (
          <p>Order not found.</p>
        )}
      </main>
    </div>
  );
}
