'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiMinus, PiPlus, PiTruck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { outstanding } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesFulfillDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
      // Default each line to its full outstanding qty.
      const init: Record<string, number> = {};
      res.data.items.forEach((it) => {
        init[it._id] = outstanding(it);
      });
      setQtys(init);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await warehouseService.getWarehouses(token, {
          isActive: true,
        });
        if (cancelled) return;
        const list: Warehouse[] = res.data ?? [];
        setWarehouses(list);
        const preferred = list.find((w) => w.isDefault) ?? list[0];
        if (preferred) setWarehouseId((cur) => cur || preferred._id);
      } catch {
        if (!cancelled) {
          setWarehouses([]);
          toast.error('Failed to load warehouses');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function adjustQty(lineId: string, max: number, delta: number) {
    setQtys((prev) => {
      const next = (prev[lineId] ?? 0) + delta;
      return { ...prev, [lineId]: Math.min(Math.max(0, next), max) };
    });
  }

  const totalShipping = useMemo(
    () => Object.values(qtys).reduce((s, q) => s + (q || 0), 0),
    [qtys]
  );

  async function handleFulfill() {
    if (!so) return;
    if (!warehouseId) {
      toast.error('Select a source warehouse');
      return;
    }
    const items = so.items
      .map((it) => ({ lineId: it._id, qty: qtys[it._id] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (items.length === 0) {
      toast.error('Enter at least one unit to fulfill');
      return;
    }
    setSubmitting(true);
    try {
      const res = await salesOrderService.fulfill(
        so._id,
        { warehouseId, items },
        token
      );
      const { failCount, failures, successCount } = res.posting;
      if (failCount > 0) {
        // Partial success: HTTP 200 but some lines failed to post stock.
        const names = failures.map((f) => f.name || f.lineId).join(', ');
        toast(
          `Fulfilled ${successCount} line(s); ${failCount} failed: ${names}`,
          { icon: '⚠️', duration: 6000 }
        );
      } else {
        toast.success(`Fulfilled ${successCount} line(s)`);
      }
      router.push(routes.eCommerce.salesDetails(so._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fulfillment failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />
    );
  if (!so)
    return (
      <div className="py-20 text-center text-sm text-gray-500">Not found</div>
    );

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesFulfillList}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Fulfillment
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          Fulfill {so.soNumber}
        </h1>
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Ship From
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={submitting || totalShipping === 0}
            onClick={handleFulfill}
            className="mt-5 flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiTruck className="h-4 w-4" />
            {submitting ? 'Fulfilling…' : `Fulfill ${totalShipping} unit(s)`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Ordered
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Outstanding
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                Fulfilling Now
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {so.items.map((item) => {
              const out = outstanding(item);
              const now = qtys[item._id] ?? 0;
              const rowCls =
                out === 0
                  ? 'bg-green-50'
                  : now === out && now > 0
                    ? 'bg-emerald-50/60'
                    : now > 0
                      ? 'bg-amber-50/40'
                      : '';
              return (
                <tr key={item._id} className={rowCls}>
                  <td className="px-4 py-3 text-gray-900">
                    {item.name}
                    {item.sku && (
                      <span className="ml-2 font-mono text-xs text-gray-400">
                        {item.sku}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {out}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        disabled={out === 0}
                        onClick={() => adjustQty(item._id, out, -1)}
                        className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <PiMinus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={out}
                        value={now}
                        disabled={out === 0}
                        onChange={(e) => {
                          const v = Math.min(
                            Math.max(0, Number(e.target.value) || 0),
                            out
                          );
                          setQtys((prev) => ({ ...prev, [item._id]: v }));
                        }}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm disabled:bg-gray-50"
                      />
                      <button
                        type="button"
                        disabled={out === 0}
                        onClick={() => adjustQty(item._id, out, 1)}
                        className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <PiPlus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmtCur(item.lineTotal, so.currency)}
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
