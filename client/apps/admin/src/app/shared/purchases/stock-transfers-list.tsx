'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiArrowClockwise,
  PiEye,
  PiTrash,
  PiArrowsLeftRight,
  PiMagnifyingGlass,
  PiCaretLeft,
  PiCaretRight,
  PiArrowsDownUp,
  PiCheckCircle,
  PiClock,
  PiXCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  stockTransferService,
  type StockTransfer,
  type TransferStatus,
  type TransferStats,
} from '@/services/stockTransfer.service';

const PAGE_SIZE = 15;

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-300',
  pending_approval:
    'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-300',
  confirmed:
    'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-300',
  completed:
    'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-300',
  cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-300',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-300',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

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

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-100" style={{ width: `${40 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

function StatsCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function StockTransfersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const initialTab = searchParams.get('status') || 'all';
  const initialSearch = searchParams.get('q') || '';

  const [tab, setTab] = useState<string>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [stats, setStats] = useState<TransferStats>({
    draft: 0,
    pending_approval: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    rejected: 0,
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await stockTransferService.list(token, {
        status: tab === 'all' ? undefined : tab,
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
      });
      setTransfers(res.data ?? []);
      setStats(
        res.stats ?? {
          draft: 0,
          pending_approval: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          rejected: 0,
        }
      );
      setTotal(res.pagination?.total ?? 0);
      setPages(res.pagination?.pages ?? 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, [token, tab, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const debouncedSearch = useCallback(() => {
    setSearch(searchInput);
  }, [searchInput]);
  useEffect(() => {
    const t = setTimeout(debouncedSearch, 400);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  function handleTabClick(status: string) {
    setTab(status);
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') params.delete('status');
    else params.set('status', status);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function goPage(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await stockTransferService.remove(id, token);
      toast.success('Transfer deleted');
      setTransfers((prev) => prev.filter((t) => t._id !== id));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  const totalUnits = transfers.reduce(
    (s, t) => s + t.items.reduce((si, it) => si + it.quantity, 0),
    0
  );

  return (
    <div>
      {/* Stats cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard
          label="Total Transfers"
          value={
            stats.draft +
            stats.pending_approval +
            stats.confirmed +
            stats.completed +
            stats.cancelled +
            stats.rejected
          }
          color="bg-gray-100 text-gray-600"
          icon={<PiArrowsDownUp className="h-4 w-4" />}
        />
        <StatsCard
          label="Completed"
          value={stats.completed}
          color="bg-emerald-100 text-emerald-600"
          icon={<PiCheckCircle className="h-4 w-4" />}
        />
        <StatsCard
          label="Pending Approval"
          value={stats.pending_approval}
          color="bg-amber-100 text-amber-600"
          icon={<PiClock className="h-4 w-4" />}
        />
        <StatsCard
          label="In Progress"
          value={stats.confirmed}
          color="bg-blue-100 text-blue-600"
          icon={<PiClock className="h-4 w-4" />}
        />
      </div>

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Stock Transfers
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} transfer{total !== 1 ? 's' : ''} · {totalUnits} total unit{totalUnits !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by reference…"
              className="w-48 rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiArrowClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href={routes.eCommerce.createStockTransfer}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" />
            New Transfer
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {[
          { key: 'all', label: 'All' },
          { key: 'draft', label: `Draft (${stats.draft})` },
          { key: 'pending_approval', label: `Pending (${stats.pending_approval})` },
          { key: 'confirmed', label: `Confirmed (${stats.confirmed})` },
          { key: 'completed', label: `Completed (${stats.completed})` },
          { key: 'cancelled', label: `Cancelled (${stats.cancelled})` },
          { key: 'rejected', label: `Rejected (${stats.rejected})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabClick(t.key)}
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Reference', 'From → To', 'Items', 'Total Qty', 'Status', 'Created', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <PiArrowsLeftRight className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-base font-medium text-gray-900">No transfers found</p>
          <p className="mt-1 text-sm text-gray-500">
            {search
              ? `No transfers matching "${search}"`
              : 'Create your first stock transfer between warehouses.'}
          </p>
          <Link
            href={routes.eCommerce.createStockTransfer}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" />
            New Transfer
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    From → To
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Total Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    By
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => {
                  const lineCount = t.items.length;
                  const qtyTotal = t.items.reduce((s, it) => s + it.quantity, 0);
                  return (
                    <tr
                      key={t._id}
                      className="group transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={routes.eCommerce.stockTransferDetails(t._id)}
                          className="font-mono text-xs font-semibold text-[#b20202] hover:underline"
                        >
                          {t.transferNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700">
                          <span className="max-w-[100px] truncate font-medium">
                            {warehouseName(t.sourceWarehouse)}
                          </span>
                          <PiArrowsLeftRight className="h-3 w-3 shrink-0 text-gray-400" />
                          <span className="max-w-[100px] truncate font-medium">
                            {warehouseName(t.destinationWarehouse)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {lineCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {qtyTotal}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {fmtDate(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {typeof t.createdBy === 'object' && t.createdBy
                          ? t.createdBy.name
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {page} of {pages} · {total} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  <PiCaretLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === pages ||
                      Math.abs(p - page) <= 2
                  )
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-gray-300">···</span>
                      )}
                      <button
                        type="button"
                        onClick={() => goPage(p)}
                        className={`min-w-[28px] rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                          p === page
                            ? 'bg-[#b20202] text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => goPage(page + 1)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  <PiCaretRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
