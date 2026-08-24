'use client';
import { useCallback, useEffect, useState } from 'react';
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { taxService, type TaxRecord, type LedgerSourceType } from '@/services/tax.service';
import { DIRECTION_LABELS, SOURCE_LABELS, fmtDate, fmtMoney } from './tax-helpers';

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

const DIRECTION_STYLES: Record<string, string> = {
  collected: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-blue-100 text-blue-700',
  internal: 'bg-gray-100 text-gray-600',
};

// Read-only ledger — records are written by the posting flows (and the
// backfill script), never by hand, so the ledger always mirrors the documents.
export default function TaxLedgerTable({ token }: { token: string }) {
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await taxService.records(token, {
        sourceType: filterType || undefined,
        status: filterStatus || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 25,
      });
      setRecords(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
      setTotal(res.pagination?.total ?? 0);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, filterType, filterStatus, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className={SELECT_CLS}
          value={filterType}
          onChange={(e) => {
            setPage(1);
            setFilterType(e.target.value as LedgerSourceType | '');
          }}
          aria-label="Filter by document type"
        >
          <option value="">All documents</option>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLS}
          value={filterStatus}
          onChange={(e) => {
            setPage(1);
            setFilterStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="posted">Posted</option>
          <option value="reversed">Reversed</option>
        </select>
        <input
          type="date"
          className={SELECT_CLS}
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
          aria-label="From date"
        />
        <input
          type="date"
          className={SELECT_CLS}
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
          aria-label="To date"
        />
        <span className="ml-auto text-xs text-gray-500">{total} record(s)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No tax records for this filter.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r._id} className={r.status === 'reversed' ? 'opacity-50 line-through' : ''}>
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(r.postedAt)}</td>
                <td className="px-4 py-3">
                  <span className="font-medium">{SOURCE_LABELS[r.sourceType] ?? r.sourceType}</span>
                  <span className="block text-xs text-gray-500">{r.sourceNumber || r.sourceId}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.taxName} @ {r.taxRate}%
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{fmtMoney(r.taxableBase, r.currency)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  {fmtMoney(r.taxAmount, r.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      DIRECTION_STYLES[r.direction] ?? DIRECTION_STYLES.internal
                    }`}
                  >
                    {DIRECTION_LABELS[r.direction] ?? r.direction}
                  </span>
                </td>
                <td className="px-4 py-3 capitalize">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border border-gray-300 p-1.5 disabled:opacity-40"
          aria-label="Previous page"
        >
          <PiCaretLeft size={14} />
        </button>
        <span className="text-gray-600">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-gray-300 p-1.5 disabled:opacity-40"
          aria-label="Next page"
        >
          <PiCaretRight size={14} />
        </button>
      </div>
    </div>
  );
}
