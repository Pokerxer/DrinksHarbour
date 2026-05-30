'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';

export default function PurchasesReceiptDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [validating, setValidating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrder(id, token);
      const data = res.data;
      setPO(data);
      const init: Record<string, number> = {};
      data.items.forEach((item) => { init[item.subProductId] = item.quantity - item.receivedQty; });
      setReceivedQtys(init);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  async function handleValidate() {
    if (!po) return;
    setValidating(true);
    try {
      const receivedItems = po.items.map((item) => ({
        itemId: item.subProductId,
        receivedQty: receivedQtys[item.subProductId] ?? 0,
      }));
      await purchaseOrderService.updatePurchaseOrderStatus(id, 'received', token, receivedItems);
      toast.success('Receipt validated — stock updated');
      router.push(routes.eCommerce.purchaseDetails(id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>;
  if (!po) return <div className="py-20 text-center text-sm text-gray-500">Not found</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.receivePurchase} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Receive Goods
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{po.poNumber}</span>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Receive: {po.poNumber}</h1>
          {po.vendorName && <p className="text-sm text-gray-500">From: {po.vendorName}</p>}
        </div>
        <button type="button" onClick={handleValidate} disabled={validating}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
          <PiCheck className="h-4 w-4" />
          {validating ? 'Validating…' : 'Validate Receipt'}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-500">Enter quantities actually received. Remainder becomes backorder.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Ordered</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Already Received</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Receiving Now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {po.items.map((item) => {
              const remaining = item.quantity - item.receivedQty;
              const receiving = receivedQtys[item.subProductId] ?? 0;
              return (
                <tr key={item.subProductId}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.receivedQty}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number" min="0" max={remaining} value={receiving}
                      onChange={(e) => setReceivedQtys((prev) => ({
                        ...prev,
                        [item.subProductId]: Math.min(Number(e.target.value), remaining),
                      }))}
                      className={`w-24 rounded-lg border px-3 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#b20202]/20 ${
                        receiving === remaining && remaining > 0
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-gray-200 focus:border-[#b20202]'
                      }`}
                    />
                    {remaining > 0 && (
                      <button type="button"
                        onClick={() => setReceivedQtys((prev) => ({ ...prev, [item.subProductId]: remaining }))}
                        className="ml-2 text-xs text-[#b20202] hover:underline">
                        All
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
