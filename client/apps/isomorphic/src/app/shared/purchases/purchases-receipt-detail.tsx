'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCheck,
  PiPackage,
  PiUser,
  PiCalendar,
  PiCurrencyDollar,
  PiWarning,
  PiTruck,
  PiMinus,
  PiPlus,
  PiClock,
  PiCheckCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import type { PurchaseOrder } from './types';

type RowStatus = 'done' | 'receiving-all' | 'partial' | 'pending';

function getRowStatus(remaining: number, receiving: number): RowStatus {
  if (remaining === 0) return 'done';
  if (receiving === remaining) return 'receiving-all';
  if (receiving !== 0) return 'partial';
  return 'pending';
}

export default function PurchasesReceiptDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrder(id, token);
      const data = res.data;
      setPO(data);
      const init: Record<string, number> = {};
      data.items.forEach((item, idx) => {
        const key = (item as any)._id?.toString() ?? String(idx);
        init[key] = Math.max(0, item.quantity - item.receivedQty);
      });
      setReceivedQtys(init);
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
        // Only seed the default when the user hasn't already chosen one,
        // so a token refresh re-running this effect won't clobber their pick.
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

  const totals = useMemo(() => {
    if (!po)
      return {
        unitsReceiving: 0,
        estimatedCost: 0,
        totalOrdered: 0,
        totalAlreadyReceived: 0,
        backorderUnits: 0,
        backorderLines: 0,
      };
    let unitsReceiving = 0;
    let estimatedCost = 0;
    let totalOrdered = 0;
    let totalAlreadyReceived = 0;
    let backorderUnits = 0;
    let backorderLines = 0;
    po.items.forEach((item, idx) => {
      const key = (item as any)._id?.toString() ?? String(idx);
      const qty = receivedQtys[key] ?? 0;
      const unitCost = (item as any).unitCost ?? item.unitPrice ?? 0;
      const remaining = item.quantity - item.receivedQty;
      const shortfall = remaining - qty;
      unitsReceiving += qty;
      estimatedCost += qty * unitCost;
      totalOrdered += item.quantity;
      totalAlreadyReceived += item.receivedQty;
      if (shortfall > 0) {
        backorderUnits += shortfall;
        backorderLines += 1;
      }
    });
    return {
      unitsReceiving,
      estimatedCost,
      totalOrdered,
      totalAlreadyReceived,
      backorderUnits,
      backorderLines,
    };
  }, [po, receivedQtys]);

  const overallProgress =
    totals.totalOrdered > 0
      ? Math.round(
          ((totals.totalAlreadyReceived + totals.unitsReceiving) /
            totals.totalOrdered) *
            100
        )
      : 0;

  const allAlreadyReceived = po
    ? po.items.every((item) => item.quantity - item.receivedQty === 0)
    : false;

  function receiveAll() {
    if (!po) return;
    const next: Record<string, number> = {};
    po.items.forEach((item, idx) => {
      const key = (item as any)._id?.toString() ?? String(idx);
      next[key] = Math.max(0, item.quantity - item.receivedQty);
    });
    setReceivedQtys(next);
  }

  function resetAll() {
    if (!po) return;
    const next: Record<string, number> = {};
    po.items.forEach((item, idx) => {
      const key = (item as any)._id?.toString() ?? String(idx);
      next[key] = 0;
    });
    setReceivedQtys(next);
    setConfirming(false);
  }

  function adjustQty(key: string, remaining: number, delta: number) {
    setReceivedQtys((prev) => {
      const next = (prev[key] ?? 0) + delta;
      const [lo, hi] = remaining >= 0 ? [0, remaining] : [remaining, 0];
      return { ...prev, [key]: Math.min(Math.max(lo, next), hi) };
    });
  }

  function handleValidateClick() {
    const hasChanges = Object.values(receivedQtys).some((v) => v !== 0);
    if (!hasChanges) {
      toast.error('Enter at least one unit to process');
      return;
    }
    setConfirming(true);
    setTimeout(() => {
      document
        .getElementById('confirm-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  async function handleValidate() {
    if (!po) return;
    setValidating(true);
    try {
      const receivedItems = po.items.map((item, idx) => {
        const key = (item as any)._id?.toString() ?? String(idx);
        return { itemId: key, receivedQty: receivedQtys[key] ?? 0 };
      });
      await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        'received',
        token,
        receivedItems
      );
      await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        'validated',
        token,
        undefined,
        warehouseId
      );
      const destName =
        warehouses.find((w) => w._id === warehouseId)?.name ?? 'inventory';
      toast.success(`Receipt validated — stock added to ${destName}`);
      router.push(routes.eCommerce.purchaseDetails(id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
      setConfirming(false);
    } finally {
      setValidating(false);
    }
  }

  if (loading) return <ReceiptSkeleton />;

  if (!po)
    return (
      <div className="py-20 text-center text-sm text-gray-500">Not found</div>
    );

  const isOverdue =
    po.expectedArrival && new Date(po.expectedArrival) < new Date();
  const orderValue = po.items.reduce((sum, item) => {
    const unitCost = (item as any).unitCost ?? item.unitPrice ?? 0;
    return sum + unitCost * item.quantity;
  }, 0);

  return (
    <div className="pb-28">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.receivePurchase}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Receive Goods
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{po.poNumber}</span>
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">
              Receive: {po.poNumber}
            </h1>
            {isOverdue && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                <PiWarning className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            Record the quantities you are receiving now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={receiveAll}
            disabled={allAlreadyReceived}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Receive All
          </button>
          <Link
            href={routes.eCommerce.purchaseDetails(id)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View PO
          </Link>
        </div>
      </div>

      {/* Already fully received banner */}
      {allAlreadyReceived && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700">
          <PiCheckCircle className="h-5 w-5 shrink-0" />
          All items on this order have already been fully received.
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={<PiUser className="h-4 w-4 text-gray-500" />}
          label="Vendor"
          value={po.vendorName || '—'}
        />
        <SummaryCard
          icon={<PiCalendar className="h-4 w-4 text-gray-500" />}
          label="Expected"
          value={
            po.expectedArrival
              ? new Date(po.expectedArrival).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'
          }
          highlight={isOverdue ? 'red' : undefined}
        />
        <SummaryCard
          icon={<PiCurrencyDollar className="h-4 w-4 text-gray-500" />}
          label="Order Value"
          value={`${po.currency ?? ''} ${orderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <SummaryCard
          icon={<PiPackage className="h-4 w-4 text-gray-500" />}
          label="Line Items"
          value={`${po.items.length} product${po.items.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Overall progress */}
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            Overall Receipt Progress
          </span>
          <span className="font-semibold text-gray-900">
            {overallProgress}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              overallProgress >= 100
                ? 'bg-green-500'
                : isOverdue
                  ? 'bg-red-500'
                  : 'bg-[#b20202]'
            }`}
            style={{ width: `${Math.min(overallProgress, 100)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
          <span>
            Ordered: <b className="text-gray-700">{totals.totalOrdered}</b>
          </span>
          <span>
            Prior:{' '}
            <b className="text-gray-700">{totals.totalAlreadyReceived}</b>
          </span>
          <span>
            Now: <b className="text-[#b20202]">{totals.unitsReceiving}</b>
          </span>
          {totals.backorderUnits > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <PiClock className="h-3.5 w-3.5" />
              Backorder:{' '}
              <b>
                {totals.backorderUnits} unit
                {totals.backorderUnits !== 1 ? 's' : ''}
              </b>{' '}
              across <b>{totals.backorderLines}</b> line
              {totals.backorderLines !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Line items table */}
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-500">
            Enter quantities actually received. Any shortfall creates a
            backorder.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  SKU
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Ordered
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Prior
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  Receiving Now
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Line Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {po.items.map((item, idx) => {
                const key = (item as any)._id?.toString() ?? String(idx);
                const remaining = item.quantity - item.receivedQty;
                const receiving = receivedQtys[key] ?? 0;
                const unitCost = (item as any).unitCost ?? item.unitPrice ?? 0;
                const lineCost = receiving * unitCost;
                const rowStatus = getRowStatus(remaining, receiving);

                const baseName =
                  (item as any).subProductName ?? item.productName ?? '';
                const sizeName = (item as any).sizeName;
                const displayName =
                  sizeName && !baseName.includes(sizeName)
                    ? `${baseName} – ${sizeName}`
                    : baseName;

                const lineProgress =
                  item.quantity > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((item.receivedQty + receiving) / item.quantity) * 100
                        )
                      )
                    : 100;

                const rowBg =
                  rowStatus === 'done'
                    ? 'bg-green-50'
                    : rowStatus === 'receiving-all'
                      ? 'bg-emerald-50/60'
                      : rowStatus === 'partial'
                        ? 'bg-amber-50/40'
                        : '';

                return (
                  <tr key={key} className={rowBg}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {displayName}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              lineProgress >= 100
                                ? 'bg-green-500'
                                : 'bg-[#b20202]'
                            }`}
                            style={{ width: `${lineProgress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {lineProgress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {unitCost > 0
                        ? unitCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.receivedQty}
                    </td>
                    <td className="px-4 py-3">
                      {rowStatus === 'done' ? (
                        <div className="flex justify-center">
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            <PiCheck className="h-3 w-3" /> Done
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustQty(key, remaining, -1)}
                              disabled={receiving === 0}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            >
                              <PiMinus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={receiving}
                              onChange={(e) =>
                                setReceivedQtys((prev) => ({
                                  ...prev,
                                  [key]: Math.min(
                                    Math.max(0, Number(e.target.value)),
                                    remaining
                                  ),
                                }))
                              }
                              className={`w-16 rounded-lg border px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#b20202]/20 ${
                                rowStatus === 'receiving-all'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : rowStatus === 'partial'
                                    ? 'border-amber-200'
                                    : 'border-gray-200 focus:border-[#b20202]'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => adjustQty(key, remaining, 1)}
                              disabled={receiving >= remaining}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            >
                              <PiPlus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setReceivedQtys((prev) => ({
                                ...prev,
                                [key]: remaining,
                              }))
                            }
                            className="text-[11px] text-[#b20202] hover:underline"
                          >
                            Max ({remaining})
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RowStatusBadge status={rowStatus} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {lineCost > 0
                        ? lineCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white px-5 py-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Receipt Notes (optional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Condition of goods, driver name, any discrepancies…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
        />
      </div>

      {/* Confirm panel */}
      {confirming && (
        <div
          id="confirm-panel"
          className="mb-5 overflow-hidden rounded-xl border border-[#b20202]/30 bg-red-50 px-5 py-4"
        >
          <h3 className="mb-1 font-semibold text-gray-900">
            Confirm Receipt Validation
          </h3>
          <p className="mb-3 text-sm text-gray-600">
            This will add{' '}
            <b className="text-gray-900">
              {totals.unitsReceiving} unit
              {totals.unitsReceiving !== 1 ? 's' : ''}
            </b>{' '}
            to inventory and cannot be undone.
            {totals.backorderUnits > 0 && (
              <>
                {' '}
                A backorder will be created for{' '}
                <b className="text-amber-700">
                  {totals.backorderUnits} unit
                  {totals.backorderUnits !== 1 ? 's' : ''}
                </b>{' '}
                across {totals.backorderLines} line
                {totals.backorderLines !== 1 ? 's' : ''}.
              </>
            )}
          </p>
          {warehouses.length === 0 ? (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              No warehouses exist yet. You must{' '}
              <Link
                href={routes.warehouses.list}
                className="font-semibold underline hover:text-amber-900"
              >
                create a warehouse
              </Link>{' '}
              before you can receive stock.
            </div>
          ) : (
            <div className="mb-3">
              <label
                htmlFor="destination-warehouse"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Destination warehouse
              </label>
              <select
                id="destination-warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              >
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                    {w.code ? ` (${w.code})` : ''}
                    {w.isDefault ? ' — default' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={validating}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating || warehouses.length === 0 || !warehouseId}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {validating ? 'Validating…' : 'Yes, Add to Stock'}
            </button>
          </div>
        </div>
      )}

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-5 text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <PiTruck className="h-4 w-4" />
              <span>
                Receiving{' '}
                <span className="font-semibold text-gray-900">
                  {totals.unitsReceiving}
                </span>{' '}
                unit{totals.unitsReceiving !== 1 ? 's' : ''}
              </span>
            </div>
            {totals.estimatedCost > 0 && (
              <div className="hidden text-gray-500 md:block">
                Cost:{' '}
                <span className="font-semibold text-gray-900">
                  {po.currency ?? ''}{' '}
                  {totals.estimatedCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {totals.backorderUnits > 0 && (
              <div className="hidden items-center gap-1 text-amber-600 sm:flex">
                <PiClock className="h-4 w-4" />
                <span className="font-medium">
                  {totals.backorderUnits} backordered
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={routes.eCommerce.receivePurchase}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleValidateClick}
              disabled={validating || allAlreadyReceived}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {validating ? 'Validating…' : 'Validate & Add Stock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ROW_STATUS_CONFIG: Record<RowStatus, { label: string; cls: string }> = {
  done: { label: 'Done', cls: 'bg-green-100 text-green-700' },
  'receiving-all': {
    label: 'Receiving',
    cls: 'bg-emerald-100 text-emerald-700',
  },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  pending: { label: 'Pending', cls: 'bg-gray-100 text-gray-500' },
};

function RowStatusBadge({ status }: { status: RowStatus }) {
  const { label, cls } = ROW_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'red';
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p
        className={`truncate text-sm font-semibold ${
          highlight === 'red' ? 'text-red-600' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ReceiptSkeleton() {
  return (
    <div className="animate-pulse space-y-5 pb-28">
      <div className="h-4 w-48 rounded bg-gray-200" />
      <div className="h-7 w-64 rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-20 rounded-xl bg-gray-200" />
      <div className="h-64 rounded-xl bg-gray-200" />
    </div>
  );
}
