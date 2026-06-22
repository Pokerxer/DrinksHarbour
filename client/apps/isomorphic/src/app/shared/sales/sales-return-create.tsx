'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiArrowUUpLeft, PiMinus, PiPlus } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder, type SalesLineItem } from '@/services/salesOrder.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

/** Units still returnable on a line: shipped minus already-returned. */
function returnable(line: SalesLineItem): number {
  return Math.max(0, (line.fulfilledQty || 0) - (line.returnedQty || 0));
}

export default function SalesReturnCreate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId') ?? '';
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [orderId, setOrderId] = useState(orderIdParam);
  const [orderOptions, setOrderOptions] = useState<SalesOrder[]>([]);
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load selectable orders (fulfilled / partially_fulfilled) when no order is pre-selected.
  useEffect(() => {
    if (!token || orderIdParam) return;
    (async () => {
      try {
        const [fulfilled, partial] = await Promise.all([
          salesOrderService.list(token, { docType: 'order', status: 'fulfilled' }),
          salesOrderService.list(token, { docType: 'order', status: 'partially_fulfilled' }),
        ]);
        setOrderOptions([...(fulfilled.data ?? []), ...(partial.data ?? [])]);
      } catch {
        setOrderOptions([]);
      }
    })();
  }, [token, orderIdParam]);

  const loadOrder = useCallback(async (oid: string) => {
    if (!token || !oid) return;
    try {
      const res = await salesOrderService.get(oid, token);
      setSo(res.data);
      const init: Record<string, number> = {};
      res.data.items.forEach((it) => {
        init[it._id] = 0;
      });
      setQtys(init);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load order');
    }
  }, [token]);

  useEffect(() => {
    if (orderId) loadOrder(orderId);
  }, [orderId, loadOrder]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await warehouseService.getWarehouses(token, { isActive: true });
        if (cancelled) return;
        const list: Warehouse[] = res.data ?? [];
        setWarehouses(list);
        const preferred = list.find((w) => w.isDefault) ?? list[0];
        if (preferred) setWarehouseId((cur) => cur || preferred._id);
      } catch {
        if (!cancelled) setWarehouses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totalReturning = useMemo(
    () => Object.values(qtys).reduce((s, q) => s + (q || 0), 0),
    [qtys]
  );

  function adjustQty(lineId: string, max: number, delta: number) {
    setQtys((prev) => {
      const next = (prev[lineId] ?? 0) + delta;
      return { ...prev, [lineId]: Math.min(Math.max(0, next), max) };
    });
  }

  async function handleReturn() {
    if (!so) return;
    if (!warehouseId) {
      toast.error('Select a restock warehouse');
      return;
    }
    const items = so.items
      .map((it) => ({ lineId: it._id, qty: qtys[it._id] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (items.length === 0) {
      toast.error('Enter at least one unit to return');
      return;
    }
    setSubmitting(true);
    try {
      const res = await salesOrderService.return(so._id, { warehouseId, items }, token);
      const { failures, successCount } = res.restock;
      if (failures.length > 0) {
        toast(`Restocked ${successCount} line(s); ${failures.length} failed`, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`Returned ${successCount} line(s)`);
      }
      router.push(routes.eCommerce.salesReturnDetails(so._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Return failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesReturns} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Return</span>
      </div>

      <h1 className="mb-5 text-xl font-semibold text-gray-900">New Sales Return</h1>

      {!orderIdParam && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Order to return from</label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
          >
            <option value="">Select a fulfilled order…</option>
            {orderOptions.map((o) => (
              <option key={o._id} value={o._id}>
                {o.soNumber} — {o.customerSnapshot?.name ?? 'Walk-in'}
              </option>
            ))}
          </select>
        </div>
      )}

      {so && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Returning from <span className="font-mono font-medium text-gray-900">{so.soNumber}</span>
            </p>
            <div className="flex items-center gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Restock To</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
                >
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={submitting || totalReturning === 0}
                onClick={handleReturn}
                className="mt-5 flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                <PiArrowUUpLeft className="h-4 w-4" />
                {submitting ? 'Returning…' : `Return ${totalReturning} unit(s)`}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Fulfilled</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Already Returned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Returnable</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Returning Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {so.items.map((item) => {
                  const max = returnable(item);
                  const now = qtys[item._id] ?? 0;
                  return (
                    <tr key={item._id} className={now > 0 ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3 text-gray-900">
                        {item.name}
                        {item.sku && <span className="ml-2 font-mono text-xs text-gray-400">{item.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.fulfilledQty}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.returnedQty}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{max}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" disabled={max === 0} onClick={() => adjustQty(item._id, max, -1)} className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                            <PiMinus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={max}
                            value={now}
                            disabled={max === 0}
                            onChange={(e) => {
                              const v = Math.min(Math.max(0, Number(e.target.value) || 0), max);
                              setQtys((prev) => ({ ...prev, [item._id]: v }));
                            }}
                            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm disabled:bg-gray-50"
                          />
                          <button type="button" disabled={max === 0} onClick={() => adjustQty(item._id, max, 1)} className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                            <PiPlus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
