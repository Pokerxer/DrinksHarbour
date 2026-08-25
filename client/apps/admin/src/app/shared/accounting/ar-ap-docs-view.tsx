'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  arApService,
  type ArApSummary,
  type OpenBill,
  type OpenInvoice,
  type PaymentSide,
} from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';

type Doc = OpenInvoice | OpenBill;

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

const STATUS_STYLES: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  confirmed: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
};

function docLabel(d: Doc) {
  return (d as OpenInvoice).orderNumber || (d as OpenBill).billNumber || '—';
}
function docName(d: Doc) {
  const inv = d as OpenInvoice;
  const bill = d as OpenBill;
  return inv.customer
    ? `${inv.customer.firstName} ${inv.customer.lastName}`.trim()
    : inv.customerSnapshot?.name || bill.vendor?.name || '—';
}
function docTotal(d: Doc) {
  return (d as OpenInvoice).total ?? (d as OpenBill).totalAmount ?? 0;
}
function docPaid(d: Doc) {
  return (d as OpenInvoice).amountPaid ?? (d as OpenBill).paidAmount ?? 0;
}
function docStatus(d: Doc) {
  return (d as OpenInvoice).paymentStatus ?? (d as OpenBill).status ?? '—';
}

/** Invoices (AR) / Bills (AP) — open documents browser with aging summary. */
export default function ArApDocsView({ side }: { side: PaymentSide }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const isAr = side === 'customer';

  const [summary, setSummary] = useState<ArApSummary | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        isAr ? arApService.receivablesSummary(token) : arApService.payablesSummary(token),
        isAr ? arApService.invoices(token, { page, limit: 25, status: statusFilter || undefined }) : arApService.bills(token, { page, limit: 25, status: statusFilter || undefined }),
      ]);
      setSummary(sumRes.data);
      setDocs(listRes.data ?? []);
      setPages(listRes.pagination?.pages ?? 1);
      setTotal(listRes.pagination?.total ?? 0);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, isAr, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* Summary strip */}
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {isAr ? 'Receivable' : 'Payable'}
            </p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-[#b20202]">
              {fmtMoney(summary.totalOutstanding)}
            </p>
            <p className="text-[10px] text-gray-400">{summary.count} open</p>
          </div>
          {Object.entries(summary.buckets).map(([bucket, amount]) => (
            <div key={bucket} className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{bucket}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-800">{fmtMoney(amount)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <select
          className={SELECT_CLS}
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {isAr ? (
            <>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
            </>
          ) : (
            <>
              <option value="confirmed">Confirmed</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </>
          )}
        </select>
        <span className="ml-auto text-xs text-gray-500">{total} document(s)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">{isAr ? 'Invoice' : 'Bill'}</th>
              <th className="px-4 py-3">{isAr ? 'Customer' : 'Vendor'}</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!loading && docs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nothing open — all settled.
                </td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d._id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(d.date)}</td>
                <td className="px-4 py-3 font-medium">{docLabel(d)}</td>
                <td className="px-4 py-3">{docName(d)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(docTotal(d))}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(docPaid(d))}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-[#b20202]">
                  {fmtMoney(d.outstanding)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[docStatus(d)] ?? 'bg-gray-100 text-gray-600'}`}>
                    {String(docStatus(d)).replace(/_/g, ' ')}
                  </span>
                </td>
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
        <span className="text-gray-600">Page {page} of {pages}</span>
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
