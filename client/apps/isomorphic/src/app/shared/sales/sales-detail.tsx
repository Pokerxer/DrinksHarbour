'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import SalesQuotationDetail from './sales-quotation-detail';

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

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DetailSkeleton />;
  if (!so) return <div className="py-20 text-center text-sm text-gray-500">Not found</div>;

  if (so.docType === 'quotation') {
    return <SalesQuotationDetail so={so} onChanged={load} />;
  }
  // docType === 'order' — replaced with the real SalesOrderDetail import in Task 5.
  return <div className="py-20 text-center text-sm text-gray-500">Order detail view not yet available</div>;
}
