'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
} from 'react-icons/pi';
import { printTransferInvoice } from '@/utils/purchaseInvoice';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  stockTransferService,
  type StockTransfer,
} from '@/services/stockTransfer.service';

// ─── constants ────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  confirmed: 'bg-blue-200 text-blue-800',
  completed: 'bg-emerald-200 text-emerald-800',
  cancelled: 'bg-red-200 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// ─── helpers ─────────────────────────────────────────────────

function warehouseName(
  w: string | { _id: string; name: string; code: string }
): string {
  if (typeof w === 'string') return w;
  return `${w.name} (${w.code})`;
}

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── component ───────────────────────────────────────────────

export default function StockTransferDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, msg: string) {
    setActing(true);
    try {
      await fn();
      toast.success(msg);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );

  if (!transfer)
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-gray-500">Transfer not found</p>
        <Link
          href={routes.eCommerce.stockTransfers}
          className="text-sm text-[#b20202] underline"
        >
          Back to list
        </Link>
      </div>
    );

  const canEdit = transfer.status === 'draft';
  const canConfirm = transfer.status === 'draft';
  const canComplete = transfer.status === 'confirmed';
  const canCancel =
    transfer.status === 'draft' || transfer.status === 'confirmed';
  const totalUnits = transfer.items.reduce((s, it) => s + it.quantity, 0);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.stockTransfers}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Stock Transfers
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">
          {transfer.transferNumber}
        </span>
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {transfer.transferNumber}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[transfer.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {STATUS_LABEL[transfer.status] ?? transfer.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {warehouseName(transfer.sourceWarehouse)}{' '}
            <PiArrowsLeftRight className="inline h-3.5 w-3.5 text-gray-400" />{' '}
            {warehouseName(transfer.destinationWarehouse)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => printTransferInvoice(transfer, tenant?.name || 'DrinksHarbour')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiPrinter className="h-4 w-4" /> Print / Download
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
              onClick={() =>
                act(
                  () =>
                    stockTransferService.updateStatus(id, 'confirmed', token),
                  'Transfer confirmed'
                )
              }
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" /> Confirm Transfer
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                if (
                  window.confirm(
                    `Complete this transfer? Stock will be moved from ${warehouseName(transfer.sourceWarehouse)} to ${warehouseName(transfer.destinationWarehouse)}.`
                  )
                )
                  act(
                    () =>
                      stockTransferService.updateStatus(id, 'completed', token),
                    'Transfer completed — stock moved'
                  );
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheckCircle className="h-4 w-4" /> Complete Transfer
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                if (window.confirm('Cancel this transfer?'))
                  act(
                    () =>
                      stockTransferService.updateStatus(id, 'cancelled', token),
                    'Transfer cancelled'
                  );
              }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <PiX className="h-4 w-4" /> Cancel
            </button>
          )}
          {transfer.status === 'draft' && (
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                if (window.confirm('Delete this draft transfer?'))
                  act(async () => {
                    await stockTransferService.remove(id, token);
                    window.location.href = routes.eCommerce.stockTransfers;
                  }, 'Transfer deleted');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <PiTrash className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'From',
            value: warehouseName(transfer.sourceWarehouse),
          },
          {
            label: 'To',
            value: warehouseName(transfer.destinationWarehouse),
          },
          {
            label: 'Total Units',
            value: totalUnits.toString(),
          },
          {
            label: transfer.completedDate ? 'Completed' : 'Scheduled',
            value: fmtDate(transfer.completedDate ?? transfer.scheduledDate),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 break-words font-medium text-gray-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Transfer Lines
          </h2>
        </div>
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
                Qty Requested
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Qty Transferred
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transfer.items.map((item, i) => {
              const done = item.transferredQty >= item.quantity;
              const name = item.sizeName
                ? `${item.subProductName} – ${item.sizeName}`
                : item.subProductName;
              return (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {item.sku || '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        done ? 'font-medium text-emerald-600' : 'text-gray-400'
                      }
                    >
                      {item.transferredQty}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td
                colSpan={2}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-500"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900">
                {totalUnits}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                <span
                  className={
                    transfer.status === 'completed'
                      ? 'text-emerald-600'
                      : 'text-gray-400'
                  }
                >
                  {transfer.items.reduce((s, it) => s + it.transferredQty, 0)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {transfer.notes && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-1 text-sm text-gray-700">{transfer.notes}</p>
        </div>
      )}

      {/* Status trail */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium text-gray-500">Timeline</p>
        <div className="space-y-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Created {fmtDate(transfer.createdAt)}
          </div>
          {transfer.status !== 'draft' && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Confirmed
            </div>
          )}
          {transfer.status === 'completed' && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Completed {fmtDate(transfer.completedDate)}
            </div>
          )}
          {transfer.status === 'cancelled' && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Cancelled
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
