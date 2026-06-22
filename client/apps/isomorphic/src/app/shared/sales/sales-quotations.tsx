// client/apps/isomorphic/src/app/shared/sales/sales-quotations.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise, PiEye, PiPlus, PiMagnifyingGlass, PiFileText } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder, type QuoteStatus } from '@/services/salesOrder.service';
import { QUOTE_STATUS_BADGE, quoteStatusLabel } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

type StatusFilter = 'all' | QuoteStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'converted', label: 'Converted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
];

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-8 rounded bg-gray-100" /></td>
    </tr>
  );
}

export default function SalesQuotations() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [quotations, setQuotations] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.list(token, { docType: 'quotation' });
      setQuotations(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== 'all' && q.quoteStatus !== statusFilter) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = `${q.soNumber} ${q.customerSnapshot?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [quotations, statusFilter, search]);

  const tabsWithCounts = useMemo(
    () =>
      STATUS_TABS.map((tab) => ({
        ...tab,
        count:
          tab.key === 'all'
            ? quotations.length
            : quotations.filter((q) => q.quoteStatus === tab.key).length,
      })),
    [quotations]
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500">Draft, send, and convert customer quotes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createSale}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Sale
          </Link>
        </div>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabsWithCounts.map((tab) => (
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
                    statusFilter === tab.key ? 'bg-[#b20202]/10 text-[#b20202]' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote# or customer…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
          />
        </div>
        {!loading && (
          <p className="shrink-0 text-sm text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Quote #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-sm text-gray-400">
                  <PiFileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  No quotations found
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr
                  key={q._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(routes.eCommerce.salesDetails(q._id))}
                >
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{q.soNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{q.customerSnapshot?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_BADGE[q.quoteStatus as QuoteStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {quoteStatusLabel(q.quoteStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(q.total, q.currency)}</td>
                  <td className="px-4 py-3 text-gray-600">{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={routes.eCommerce.salesDetails(q._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <PiEye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
