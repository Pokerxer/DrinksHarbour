// client/apps/admin/src/app/shared/sales/sales-detail.tsx
// Loader for /sales/[id]: fetches the document and hands it to the right
// lifecycle view. The old failure state was four gray words — no retry, no
// way back, indistinguishable from a crash.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowCounterClockwise, PiFileText } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { routes } from '@/config/routes';
import SalesQuotationDetail from './sales-quotation-detail';
import SalesOrderDetail from './sales-order-detail';

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-gray-100" />
      <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

export default function SalesDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DetailSkeleton />;

  if (!so) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <PiFileText className="mx-auto mb-3 h-10 w-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-700">
          {error ?? 'Document not found'}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          It may have been deleted, or you may not have access to it.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiArrowCounterClockwise className="h-4 w-4" />
            Retry
          </button>
          <Link
            href={routes.eCommerce.salesOrders}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Back to Sales
          </Link>
        </div>
      </div>
    );
  }

  if (so.docType === 'quotation') {
    return <SalesQuotationDetail so={so} onChanged={load} />;
  }
  return <SalesOrderDetail so={so} onChanged={load} />;
}
