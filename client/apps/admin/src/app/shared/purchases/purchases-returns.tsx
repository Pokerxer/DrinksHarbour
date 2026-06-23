'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiEye,
  PiPlus,
  PiMagnifyingGlass,
  PiArrowUUpLeft,
  PiCurrencyDollar,
  PiList,
  PiSquaresFour,
  PiTrash,
  PiWarning,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from './types';
import { STATUS_BADGE, returnStatusLabel } from './types';
import { fmtCur } from './purchases-analytics-helpers';

type StatusFilter = 'all' | 'draft' | 'confirmed' | 'refunded' | 'requested' | 'shipped' | 'in_transit' | 'received' | 'rejected' | 'cancelled';
type ViewMode = 'list' | 'grid';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'requested', label: 'Requested' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'received', label: 'Received' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TAB_COUNT_KEYS: Record<string, keyof Stats> = {
  all: 'totalCount',
  draft: 'draftCount',
  confirmed: 'confirmedCount',
  refunded: 'refundedCount',
  cancelled: 'cancelledCount',
};

interface Stats {
  totalCount: number;
  totalValue: number;
  totalRefunded: number;
  draftCount: number;
  confirmedCount: number;
  refundedCount: number;
  cancelledCount: number;
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-12 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-8 rounded bg-gray-100" /></td>
    </tr>
  );
}

function ReturnCard({ ret, onDelete }: { ret: VendorReturn; onDelete: (id: string) => void }) {
  const total = ret.totalAmount ?? ret.items?.reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalQty = ret.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <Link
      href={routes.eCommerce.vendorReturnDetails(ret._id)}
      className="group block rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-gray-900 group-hover:text-[#b20202]">
          {ret.returnNumber}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_BADGE[ret.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {returnStatusLabel(ret.status)}
        </span>
      </div>

      <p className="mb-1 text-sm text-gray-600">
        {ret.vendorName ?? <span className="text-gray-400">No vendor</span>}
      </p>
      {ret.poNumber && (
        <p className="mb-2 text-xs text-gray-400">PO: {ret.poNumber}</p>
      )}
      {ret.createdAt && (
        <p className="mb-3 text-xs text-gray-400">
          {new Date(ret.createdAt).toLocaleDateString()}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div>
          <p className="text-xs text-gray-400">Return Value</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtCur(total, ret.currency)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">Qty</p>
          <p className="text-sm font-medium text-gray-700">{totalQty}</p>
        </div>
        {ret.refundAmount > 0 ? (
          <div className="text-right">
            <p className="text-xs text-gray-400">Refund</p>
            <p className="text-sm font-semibold text-green-600">
              {fmtCur(ret.refundAmount, ret.currency)}
            </p>
          </div>
        ) : ret.status === 'confirmed' || ret.status === 'received' ? (
          <span className="text-xs text-amber-600">Pending refund</span>
        ) : null}
      </div>
    </Link>
  );
}

function ConfirmDeleteModal({ open, onClose, onConfirm, loading }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <PiWarning className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Delete Return</p>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasesReturns() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [returns, setReturns] = useState<VendorReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<Stats>({
    totalCount: 0, totalValue: 0, totalRefunded: 0,
    draftCount: 0, confirmedCount: 0, refundedCount: 0, cancelledCount: 0,
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorReturnService.getVendorReturns(token, {
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: debouncedSearch || undefined,
      });
      setReturns(res.data ?? []);
      setTotalPages(res.pagination?.totalPages ?? 1);
      if (res.stats) setStats(res.stats);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load returns'
      );
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await vendorReturnService.deleteVendorReturn(id, token);
      toast.success('Return deleted');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  const tabsWithCounts = useMemo(() =>
    STATUS_TABS.map((tab) => ({
      ...tab,
      count: tab.key === 'all'
        ? stats.totalCount
        : TAB_COUNT_KEYS[tab.key]
          ? stats[TAB_COUNT_KEYS[tab.key] as keyof Stats] as number
          : returns.filter((r) => r.status === tab.key).length,
    })),
    [stats, returns]
  );

  const totalQty = useMemo(
    () => returns.reduce((s, r) => s + (r.items?.reduce((si, i) => si + i.quantity, 0) ?? 0), 0),
    [returns]
  );

  return (
    <div>
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        loading={deleting}
      />

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendor Returns</h1>
          <p className="text-sm text-gray-500">Manage returned goods and refunds</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setPage(1); load(); }}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createVendorReturn}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Return
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: <PiArrowUUpLeft className="h-4 w-4 text-gray-600" />, bg: 'bg-gray-100', label: 'Total Returns', value: stats.totalCount },
          { icon: <PiArrowUUpLeft className="h-4 w-4 text-blue-600" />, bg: 'bg-blue-50', label: 'Draft', value: stats.draftCount },
          { icon: <PiArrowUUpLeft className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-50', label: 'Awaiting Refund', value: stats.confirmedCount },
          { icon: <PiCurrencyDollar className="h-4 w-4 text-green-600" />, bg: 'bg-green-50', label: 'Total Refunded', value: fmtCur(stats.totalRefunded, 'NGN') },
        ].map(({ icon, bg, label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
              {icon}
            </div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 text-xl font-bold text-gray-900">
              {loading ? (
                <span className="inline-block h-7 w-16 animate-pulse rounded bg-gray-100" />
              ) : (
                value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabsWithCounts.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {!loading && (
                <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  statusFilter === tab.key
                    ? 'bg-[#b20202]/10 text-[#b20202]'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by return#, vendor, or PO…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
          />
        </div>
        {!loading && (
          <p className="shrink-0 text-sm text-gray-400">
            {returns.length} result{returns.length !== 1 ? 's' : ''}
          </p>
        )}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-gray-200 bg-white">
          <button type="button" onClick={() => setView('list')} title="List view"
            className={`p-2 transition-colors ${view === 'list' ? 'bg-[#b20202] text-white' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'}`}>
            <PiList className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setView('grid')} title="Grid view"
            className={`p-2 transition-colors ${view === 'grid' ? 'bg-[#b20202] text-white' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'}`}>
            <PiSquaresFour className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex justify-between">
                    <div className="h-4 w-24 rounded bg-gray-100" />
                    <div className="h-5 w-14 rounded-full bg-gray-100" />
                  </div>
                  <div className="mb-2 h-3.5 w-32 rounded bg-gray-100" />
                  <div className="mb-4 h-3 w-20 rounded bg-gray-100" />
                  <div className="flex justify-between border-t border-gray-100 pt-3">
                    <div className="h-4 w-16 rounded bg-gray-100" />
                    <div className="h-4 w-16 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-20 text-center">
              <PiArrowUUpLeft className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">No vendor returns found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {returns.map((ret) => (
                <ReturnCard key={ret._id} ret={ret} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Return #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">PO</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Return Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Refund</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-sm text-gray-400">
                    No vendor returns found
                  </td>
                </tr>
              ) : (
                returns.map((ret) => {
                  const total = ret.totalAmount ?? ret.items?.reduce((s, i) => s + i.amount, 0) ?? 0;
                  const qty = ret.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
                  return (
                    <tr
                      key={ret._id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(routes.eCommerce.vendorReturnDetails(ret._id))}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{ret.returnNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{ret.vendorName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{ret.poNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ret.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {returnStatusLabel(ret.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(total, ret.currency)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{qty}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {ret.refundAmount > 0 ? (
                          <span className="text-green-600">{fmtCur(ret.refundAmount, ret.currency)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={routes.eCommerce.vendorReturnDetails(ret._id)}
                            className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiEye className="h-4 w-4" />
                          </Link>
                          {ret.status === 'draft' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(ret._id); }}
                              className="inline-flex rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <PiTrash className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`min-w-[32px] rounded-lg px-2 py-1.5 text-sm font-medium ${
                        p === page
                          ? 'bg-[#b20202] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
