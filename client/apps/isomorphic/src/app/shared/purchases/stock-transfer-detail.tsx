'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import {
  PiArrowLeft,
  PiCheck,
  PiCheckCircle,
  PiPencilSimple,
  PiPrinter,
  PiTrash,
  PiX,
  PiArrowsLeftRight,
  PiSpinner,
  PiWarningCircle,
  PiClock,
  PiCalendarCheck,
  PiNotePencil,
  PiWarehouse,
  PiCaretRight,
} from 'react-icons/pi';
import { printTransferInvoice } from '@/utils/purchaseInvoice';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  stockTransferService,
  type StockTransfer,
} from '@/services/stockTransfer.service';
import { CURRENCY_SYMBOLS } from './types';
import { fmtCur } from './purchases-analytics-helpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const STATUS_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  draft: {
    badge: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-300',
    dot: 'bg-gray-400',
    label: 'Draft',
  },
  confirmed: {
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-300',
    dot: 'bg-blue-500',
    label: 'Confirmed',
  },
  completed: {
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Completed',
  },
  cancelled: {
    badge: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-300',
    dot: 'bg-red-500',
    label: 'Cancelled',
  },
};

function whName(w: string | { _id: string; name: string; code: string }) {
  if (typeof w === 'string') return w;
  return `${w.name} (${w.code})`;
}

function fmtDateTime(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + ` ${time}`;
}

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function SkeletonBlock() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-4 w-48 rounded bg-gray-100" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 flex-1 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-gray-100" />
      <div className="h-24 rounded-xl bg-gray-100" />
    </div>
  );
}

function TimelineDot({ color, isLast }: { color: string; isLast: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`h-3 w-3 rounded-full ring-2 ring-white ${color}`} />
      {!isLast && <div className="mt-0.5 h-full w-px bg-gray-200" />}
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  acting,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  acting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={acting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            No, go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={acting}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white ${confirmColor} disabled:opacity-50`}
          >
            {acting && <PiSpinner className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StockTransferDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    action: () => Promise<void>;
  } | null>(null);
  const [sourceStock, setSourceStock] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await stockTransferService.get(id, token);
      setTransfer(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const fetchSourceStock = useCallback(async (warehouseId: string, items: StockTransfer['items']) => {
    if (!token) return;
    setStockLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouses/${warehouseId}/stock`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const list: any[] = json?.data ?? [];
      const map: Record<string, number> = {};
      for (const row of list) {
        const spId = typeof row.subProduct === 'string' ? row.subProduct : row.subProduct?._id;
        const szId = typeof row.size === 'string' ? row.size : row.size?._id;
        if (spId) {
          const k = `${spId}::${szId || ''}`;
          map[k] = (map[k] || 0) + (row.currentQuantity || 0);
        }
      }
      const stockMap: Record<string, number> = {};
      for (const item of items) {
        const k = `${item.subProductId}::${item.sizeId || ''}`;
        stockMap[item.subProductId] = map[k] ?? 0;
      }
      setSourceStock(stockMap);
    } catch {
      // silent
    } finally {
      setStockLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (transfer && (transfer.status === 'draft' || transfer.status === 'confirmed')) {
      const whId = typeof transfer.sourceWarehouse === 'string'
        ? transfer.sourceWarehouse
        : transfer.sourceWarehouse?._id;
      if (whId) fetchSourceStock(whId, transfer.items);
    }
  }, [transfer, fetchSourceStock]);

  async function handleConfirm() {
    if (!confirmAction) return;
    setActing(true);
    try {
      await confirmAction.action();
      setConfirmAction(null);
      await load();
      toast.success('Transfer updated');
    } catch (e) {
      await load();
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }

  if (loading)
    return (
      <div className="pb-10">
        <div className="mb-6 h-4 w-48 rounded bg-gray-100" />
        <SkeletonBlock />
      </div>
    );

  if (!transfer)
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <PiWarningCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-base font-semibold text-gray-900">Transfer not found</p>
        <p className="mt-1 text-sm text-gray-500">
          This transfer may have been deleted or you don&apos;t have access.
        </p>
        <Link
          href={routes.eCommerce.stockTransfers}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to list
        </Link>
      </div>
    );

  const style = STATUS_STYLE[transfer.status] ?? STATUS_STYLE.draft;
  const canEdit = transfer.status === 'draft';
  const canConfirm = transfer.status === 'draft';
  const canComplete = transfer.status === 'confirmed';
  const canCancel = transfer.status === 'draft' || transfer.status === 'confirmed';
  const totalUnits = transfer.items.reduce((s, it) => s + it.quantity, 0);
  const totalTransferred = transfer.items.reduce((s, it) => s + it.transferredQty, 0);
  const totalCost = transfer.items.reduce((s, it) => s + (it.costPrice ?? 0) * it.quantity, 0);
  const hasPartial = totalTransferred > 0 && totalTransferred < totalUnits;

  return (
    <div>
      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmLabel={confirmAction?.confirmLabel ?? ''}
        confirmColor={confirmAction?.confirmColor ?? ''}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
        acting={acting}
      />

      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.stockTransfers}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <PiArrowLeft className="h-3.5 w-3.5" /> Stock Transfers
        </Link>
        <PiCaretRight className="h-3 w-3 text-gray-300" />
        <span className="font-medium text-gray-900">{transfer.transferNumber}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {transfer.transferNumber}
            </h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {style.label}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <PiWarehouse className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="font-medium text-gray-700">
              {whName(transfer.sourceWarehouse)}
            </span>
            <PiArrowsLeftRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="font-medium text-gray-700">
              {whName(transfer.destinationWarehouse)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => printTransferInvoice(transfer, tenant?.name || 'DrinksHarbour')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiPrinter className="h-4 w-4" /> Print
          </button>
          {canEdit && (
            <Link
              href={`${routes.eCommerce.stockTransferDetails(transfer._id)}/edit`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiPencilSimple className="h-4 w-4" /> Edit
            </Link>
          )}
          {canConfirm && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setConfirmAction({
                title: 'Confirm Transfer',
                message: `Move ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} from ${whName(transfer.sourceWarehouse)} to ${whName(transfer.destinationWarehouse)}? Stock availability will be validated.`,
                confirmLabel: 'Confirm',
                confirmColor: 'bg-blue-600 hover:bg-blue-700',
                action: () => stockTransferService.updateStatus(id, 'confirmed', token),
              })}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {acting ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiCheck className="h-4 w-4" />}
              Confirm Transfer
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setConfirmAction({
                title: 'Complete Transfer',
                message: `This will move ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} from ${whName(transfer.sourceWarehouse)} to ${whName(transfer.destinationWarehouse)}. Stock quantities will be updated in both warehouses.`,
                confirmLabel: 'Complete',
                confirmColor: 'bg-[#b20202] hover:bg-[#9a0101]',
                action: () => stockTransferService.updateStatus(id, 'completed', token),
              })}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              {acting ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiCheckCircle className="h-4 w-4" />}
              Complete Transfer
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setConfirmAction({
                title: 'Cancel Transfer',
                message: `Cancel transfer ${transfer.transferNumber}? This cannot be undone.`,
                confirmLabel: 'Cancel Transfer',
                confirmColor: 'bg-red-600 hover:bg-red-700',
                action: () => stockTransferService.updateStatus(id, 'cancelled', token),
              })}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {acting ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiX className="h-4 w-4" />}
              Cancel
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              disabled={acting}
              onClick={() => setConfirmAction({
                title: 'Delete Draft',
                message: `Delete draft transfer ${transfer.transferNumber}? This cannot be undone.`,
                confirmLabel: 'Delete',
                confirmColor: 'bg-gray-700 hover:bg-gray-800',
                action: async () => {
                  await stockTransferService.remove(id, token);
                  router.push(routes.eCommerce.stockTransfers);
                },
              })}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {acting ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiTrash className="h-4 w-4" />}
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'From', value: whName(transfer.sourceWarehouse), icon: <PiWarehouse className="h-4 w-4" />, color: 'bg-blue-100 text-blue-600' },
          { label: 'To', value: whName(transfer.destinationWarehouse), icon: <PiWarehouse className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Total Units', value: `${totalTransferred}/${totalUnits}`, icon: <PiCheckCircle className="h-4 w-4" />, color: totalTransferred === totalUnits && transfer.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600' },
          { label: transfer.status === 'completed' ? 'Completed' : transfer.confirmedAt ? 'Confirmed' : 'Scheduled', value: fmtDateTime(transfer.completedDate ?? transfer.confirmedAt ?? transfer.scheduledDate) ?? '—', icon: transfer.status === 'completed' ? <PiCalendarCheck className="h-4 w-4" /> : <PiClock className="h-4 w-4" />, color: transfer.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-gray-500">{label}</p>
              <p className="truncate text-sm font-semibold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Transfer Lines</h2>
            {stockLoading && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <PiSpinner className="h-3 w-3 animate-spin" /> Checking stock…
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty Requested</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Cost Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty Transferred</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Progress</th>
                {transfer.status !== 'completed' && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Source Stock</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transfer.items.map((item, i) => {
                const done = item.transferredQty >= item.quantity;
                const pct = Math.min(100, Math.round((item.transferredQty / item.quantity) * 100));
                const name = item.sizeName && !item.subProductName.includes(item.sizeName)
                  ? `${item.subProductName} – ${item.sizeName}`
                  : item.subProductName;
                const srcStock = sourceStock[item.subProductId];
                const stockOk = srcStock !== undefined && srcStock >= item.quantity;
                return (
                  <tr key={i} className="transition-colors hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="truncate">{name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {item.sku || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {item.costPrice != null && item.costPrice > 0
                        ? fmtCur(Number(item.costPrice), transfer.currency ?? 'NGN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={done ? 'font-semibold text-emerald-600' : 'text-gray-400'}>
                        {item.transferredQty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              done
                                ? 'bg-emerald-500'
                                : hasPartial
                                  ? 'bg-amber-400'
                                  : 'bg-gray-300'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-[11px] tabular-nums ${done ? 'font-medium text-emerald-600' : 'text-gray-400'}`}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    {transfer.status !== 'completed' && (
                      <td className="px-4 py-3 text-right tabular-nums">
                        {stockLoading ? (
                          <PiSpinner className="ml-auto h-3.5 w-3.5 animate-spin text-gray-300" />
                        ) : srcStock === undefined ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={stockOk ? 'text-emerald-600' : 'text-amber-600'}>
                            {srcStock}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={2} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900">
                  {totalUnits}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900">
                  {totalCost > 0 ? fmtCur(totalCost, transfer.currency ?? 'NGN') : '—'}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                  <span className={transfer.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}>
                    {totalTransferred}
                  </span>
                </td>
                <td colSpan={transfer.status !== 'completed' ? 2 : 1} className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <PiNotePencil className="h-4 w-4 text-gray-400" />
          <p className="text-xs font-medium text-gray-500">Notes</p>
        </div>
        <p className="mt-2 text-sm text-gray-700">
          {transfer.notes || <span className="italic text-gray-400">No notes</span>}
        </p>
      </div>

      {/* Timeline */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-medium text-gray-500">Timeline</h3>
        <div className="space-y-0">
          {[
            { label: 'Draft created', date: transfer.createdAt, user: transfer.createdBy, dotColor: 'bg-gray-400' },
            ...(transfer.confirmedAt
              ? [{ label: 'Confirmed', date: transfer.confirmedAt, user: transfer.confirmedBy, dotColor: 'bg-blue-500' }]
              : []),
            ...(transfer.completedDate
              ? [{ label: 'Completed', date: transfer.completedDate, user: transfer.completedBy, dotColor: 'bg-emerald-500' }]
              : []),
            ...(transfer.cancelledAt
              ? [{ label: 'Cancelled', date: transfer.cancelledAt, user: transfer.cancelledBy, dotColor: 'bg-red-500' }]
              : []),
          ].map((entry, idx, arr) => (
            <div key={entry.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${entry.dotColor}`} />
                {idx < arr.length - 1 && <div className="mt-0.5 h-full w-px bg-gray-200" />}
              </div>
              <div className={`pb-5 ${idx < arr.length - 1 ? '' : ''}`}>
                <p className="text-sm font-medium text-gray-700">{entry.label}</p>
                <p className="text-xs text-gray-500">
                  {fmtDateTime(entry.date)}
                  {entry.user && (
                    <span className="ml-1 text-gray-400">by {entry.user.name}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
