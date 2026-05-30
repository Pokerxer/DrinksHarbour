'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { PiPackage, PiArrowRight } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';

export default function PurchasesReceive() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const poId = searchParams.get('po');

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrders(token, { status: 'confirmed' });
      setOrders(res.data ?? res.purchaseOrders ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const displayOrders = poId ? orders.filter((o) => o._id === poId) : orders;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Receive Goods</h1>
        <p className="text-sm text-gray-500">Select a purchase order to record received items</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
      ) : displayOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-20 text-center">
          <PiPackage className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No confirmed orders pending receipt</p>
          <Link href={routes.eCommerce.purchases} className="text-sm font-medium text-[#b20202] hover:underline">
            View all orders
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayOrders.map((order) => {
            const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
            const receivedQty = order.items.reduce((s, i) => s + i.receivedQty, 0);
            const pct = totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;
            return (
              <div key={order._id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-gray-900">{order.poNumber}</span>
                    {order.vendorName && <span className="text-sm text-gray-500">{order.vendorName}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-[#b20202] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{receivedQty}/{totalQty} units ({pct}%)</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {order.items.length} line{order.items.length !== 1 ? 's' : ''}
                    {order.expectedArrival && ` · Expected ${new Date(order.expectedArrival).toLocaleDateString()}`}
                  </p>
                </div>
                <Link href={routes.eCommerce.purchaseReceipt(order._id)}
                  className="ml-4 flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
                  Receive <PiArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
