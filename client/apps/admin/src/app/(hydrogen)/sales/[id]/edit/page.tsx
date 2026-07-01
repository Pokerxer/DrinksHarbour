'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesCreate from '@/app/shared/sales/sales-create';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';

function EditSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-gray-100" />
      <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

export default function SalesEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full px-4 py-6 xl:px-6">
        {loading ? (
          <EditSkeleton />
        ) : !so ? (
          <div className="py-20 text-center text-sm text-gray-500">
            Not found
          </div>
        ) : (
          <SalesCreate mode="edit" initial={so} />
        )}
      </main>
    </div>
  );
}