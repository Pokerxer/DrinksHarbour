'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiArrowClockwise,
  PiEye,
  PiTrash,
  PiArrowsLeftRight,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  stockTransferService,
  type StockTransfer,
  type TransferStatus,
} from '@/services/stockTransfer.service';

// ─── constants ────────────────────────────────────────────────

type TabKey = 'all' | TransferStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

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
) {
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

export default function StockTransfersList() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [tab, setTab] = useState<TabKey>('all');
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await stockTransferService.list(token, {
        status: tab === 'all' ? undefined : tab,
        limit: 50,
      });
      setTransfers(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft transfer?')) return;
    setDeleting(id);
    try {
      await stockTransferService.remove(id, token);
      toast.success('Transfer deleted');
      setTransfers((prev) => prev.filter((t) => t._id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Stock Transfers
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Move inventory between warehouses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiArrowClockwise
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <Link
            href={routes.eCommerce.createStockTransfer}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" />
            New Transfer
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm transition-colors ${
              tab === t.key
                ? 'font-semibold text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          Loading…
        </div>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <PiArrowsLeftRight className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No transfers found.</p>
          <Link
            href={routes.eCommerce.createStockTransfer}
            className="mt-3 text-sm font-medium text-[#b20202] hover:underline"
          >
            Create your first transfer
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  From
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  To
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Lines
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transfers.map((t) => (
                <tr
                  key={t._id}
                  className="group transition-colors hover:bg-gray-50/60"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                    {t.transferNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {warehouseName(t.sourceWarehouse)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {warehouseName(t.destinationWarehouse)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {t.items.length}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {fmtDate(t.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        href={routes.eCommerce.stockTransferDetails(t._id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="View"
                      >
                        <PiEye className="h-4 w-4" />
                      </Link>
                      {t.status === 'draft' && (
                        <button
                          type="button"
                          disabled={deleting === t._id}
                          onClick={() => handleDelete(t._id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          title="Delete"
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
