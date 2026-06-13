'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
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
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from './types';
import { STATUS_BADGE, statusLabel } from './types';

type StatusFilter = 'all' | 'draft' | 'confirmed' | 'refunded' | 'cancelled';
type ViewMode = 'list' | 'grid';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'cancelled', label: 'Cancelled' },
];

function ReturnCard({ ret }: { ret: VendorReturn }) {
  const total =
    ret.totalAmount ?? ret.items?.reduce((s, i) => s + i.amount, 0) ?? 0;

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
          {statusLabel(ret.status)}
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
            {ret.currency ?? ''} {total.toFixed(2)}
          </p>
        </div>
        {ret.refundAmount > 0 ? (
          <div className="text-right">
            <p className="text-xs text-gray-400">Refund</p>
            <p className="text-sm font-semibold text-green-600">
              {ret.currency ?? ''} {ret.refundAmount.toFixed(2)}
            </p>
          </div>
        ) : ret.status === 'confirmed' ? (
          <span className="text-xs text-amber-600">Pending refund</span>
        ) : null}
      </div>
    </Link>
  );
}

export default function PurchasesReturns() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [returns, setReturns] = useState<VendorReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('list');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorReturnService.getVendorReturns(token);
      setReturns(res.data ?? (res as any).returns ?? []);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load returns'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const tabCounts = useMemo(
    () => ({
      all: returns.length,
      draft: returns.filter((r) => r.status === 'draft').length,
      confirmed: returns.filter((r) => r.status === 'confirmed').length,
      refunded: returns.filter((r) => r.status === 'refunded').length,
      cancelled: returns.filter((r) => r.status === 'cancelled').length,
    }),
    [returns]
  );

  const totalRefunded = useMemo(
    () => returns.reduce((s, r) => s + (r.refundAmount ?? 0), 0),
    [returns]
  );

  const filtered = useMemo(() => {
    let list = returns;
    if (statusFilter !== 'all')
      list = list.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.returnNumber?.toLowerCase().includes(q) ||
          r.vendorName?.toLowerCase().includes(q) ||
          r.poNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [returns, statusFilter, search]);

  const currency = returns[0]?.currency ?? 'NGN';

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Vendor Returns
          </h1>
          <p className="text-sm text-gray-500">
            Manage returned goods and refunds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
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
          {
            icon: <PiArrowUUpLeft className="h-4 w-4 text-gray-600" />,
            bg: 'bg-gray-100',
            label: 'Total Returns',
            value: returns.length,
          },
          {
            icon: <PiArrowUUpLeft className="h-4 w-4 text-blue-600" />,
            bg: 'bg-blue-50',
            label: 'Draft',
            value: tabCounts.draft,
          },
          {
            icon: <PiArrowUUpLeft className="h-4 w-4 text-amber-600" />,
            bg: 'bg-amber-50',
            label: 'Awaiting Refund',
            value: tabCounts.confirmed,
          },
          {
            icon: <PiCurrencyDollar className="h-4 w-4 text-green-600" />,
            bg: 'bg-green-50',
            label: 'Total Refunded',
            value: `${currency} ${totalRefunded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        ].map(({ icon, bg, label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div
              className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}
            >
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
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    statusFilter === tab.key
                      ? 'bg-[#b20202]/10 text-[#b20202]'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tabCounts[tab.key]}
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
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setView('list')}
            title="List view"
            className={`p-2 transition-colors ${
              view === 'list'
                ? 'bg-[#b20202] text-white'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <PiList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            title="Grid view"
            className={`p-2 transition-colors ${
              view === 'grid'
                ? 'bg-[#b20202] text-white'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
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
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
                >
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-20 text-center">
              <PiArrowUUpLeft className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">No vendor returns found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ret) => (
                <ReturnCard key={ret._id} ret={ret} />
              ))}
            </div>
          )}
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-gray-400">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <PiArrowUUpLeft className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">No vendor returns found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Return #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    PO
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Return Value
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Refund
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((ret) => {
                  const total =
                    ret.totalAmount ??
                    ret.items?.reduce((s, i) => s + i.amount, 0) ??
                    0;
                  return (
                    <tr
                      key={ret._id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        (window.location.href =
                          routes.eCommerce.vendorReturnDetails(ret._id))
                      }
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">
                        {ret.returnNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {ret.vendorName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ret.poNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ret.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {statusLabel(ret.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {ret.currency} {total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {ret.refundAmount > 0 ? (
                          <span className="text-green-600">
                            {ret.currency} {ret.refundAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {ret.createdAt
                          ? new Date(ret.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={routes.eCommerce.vendorReturnDetails(ret._id)}
                          className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <PiEye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
