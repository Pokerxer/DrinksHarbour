'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiArrowClockwise,
  PiEye,
  PiTrash,
  PiCaretLeft,
  PiCaretRight,
  PiFileText,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';
import type { PurchaseAgreement } from './types';
import {
  STATUS_BADGE,
  AGREEMENT_STATUS_LABEL,
  AGREEMENT_TYPE_LABEL,
  CURRENCY_SYMBOLS,
} from './types';

const PAGE_SIZE = 25;

const SELECT_CLS =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

function fmtMoney(amount: number, currency: string) {
  return `${CURRENCY_SYMBOLS[currency] ?? ''}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

export default function PurchasesAgreements() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [agreements, setAgreements] = useState<PurchaseAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseAgreementService.getAgreements(token, {
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setAgreements((res.data as unknown as PurchaseAgreement[]) ?? []);
      setTotal(res.pagination?.total ?? 0);
      setPages(res.pagination?.pages ?? 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, typeFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(a: PurchaseAgreement) {
    if (
      !confirm(`Delete agreement ${a.agreementNumber}? This cannot be undone.`)
    )
      return;
    try {
      const res = await purchaseAgreementService.deleteAgreement(a._id, token);
      if (!res.success) throw new Error(res.message || 'Failed to delete');
      toast.success('Agreement deleted');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const hasFilters = Boolean(statusFilter || typeFilter);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Purchase Agreements
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Blanket orders and calls for tender with negotiated prices and
            quantities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createPurchaseAgreement}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Agreement
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="">All statuses</option>
          {Object.entries(AGREEMENT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="">All types</option>
          <option value="blanket_order">Blanket Order</option>
          <option value="call_for_tender">Call for Tender</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setTypeFilter('');
              setPage(1);
            }}
            className="text-sm font-medium text-[#b20202] hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">
          {total} agreement{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            Loading…
          </div>
        ) : agreements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <PiFileText className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              {hasFilters
                ? 'No agreements match the current filters'
                : 'No agreements yet — create one to lock in vendor prices'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Agreement
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Period
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Consumed
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agreements.map((a) => {
                  const totalAmount = a.totalAmount ?? 0;
                  const consumedAmount = a.consumedAmount ?? 0;
                  const pct =
                    totalAmount > 0
                      ? Math.min(100, (consumedAmount / totalAmount) * 100)
                      : 0;
                  return (
                    <tr key={a._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={routes.eCommerce.purchaseAgreementDetails(
                            a._id
                          )}
                          className="font-mono font-medium text-gray-900 hover:text-[#b20202]"
                        >
                          {a.agreementNumber}
                        </Link>
                        <p className="mt-0.5 max-w-[200px] truncate text-xs text-gray-500">
                          {a.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {a.vendorName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {AGREEMENT_TYPE_LABEL[a.agreementType] ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {totalAmount > 0
                          ? fmtMoney(totalAmount, a.currency)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {totalAmount > 0 ? (
                          <div className="w-24">
                            <div className="h-1.5 w-full rounded-full bg-gray-100">
                              <div
                                className="h-1.5 rounded-full bg-[#b20202]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-gray-500">
                              {pct.toFixed(0)}% ·{' '}
                              {fmtMoney(consumedAmount, a.currency)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {AGREEMENT_STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={routes.eCommerce.purchaseAgreementDetails(
                              a._id
                            )}
                            title="View"
                            className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiEye className="h-4 w-4" />
                          </Link>
                          {a.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(a)}
                              title="Delete"
                              className="inline-flex rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <span className="text-xs text-gray-500">
              Page {page} of {pages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
