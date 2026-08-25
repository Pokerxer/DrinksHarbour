'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiCaretLeft, PiCaretRight, PiPlus } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { arApService, type PaymentDoc, type PaymentSide } from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import PaymentFormModal from './payment-form-modal';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

/** /accounting/payments — Customer | Vendor tabs + record/cancel payments. */
export default function PaymentsView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const initialSide = (searchParams.get('side') as PaymentSide) || 'customer';
  const [side, setSide] = useState<PaymentSide>(
    initialSide === 'vendor' ? 'vendor' : 'customer'
  );
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const switchSide = (next: PaymentSide) => {
    setSide(next);
    setPage(1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('side', next);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await arApService.payments(token, side, {
        page,
        limit: 25,
        status: statusFilter || undefined,
      });
      setPayments(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, side, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await arApService.cancelPayment(token, side, id);
      toast.success('Payment cancelled — journal reversed, allocations rolled back');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const partyOf = (p: PaymentDoc) =>
    side === 'customer'
      ? p.customer
        ? `${p.customer.firstName} ${p.customer.lastName}`.trim()
        : p.customerName || '—'
      : p.vendor?.name || p.vendorName || '—';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
          {(['customer', 'vendor'] as PaymentSide[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => switchSide(s)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                side === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'customer' ? 'Customer Receipts' : 'Vendor Payments'}
            </button>
          ))}
        </div>
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
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
        >
          <PiPlus size={14} /> {side === 'customer' ? 'Record Receipt' : 'New Payment'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">{side === 'customer' ? 'Customer' : 'Vendor'}</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Allocations</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!loading && payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No payments yet.</td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p._id} className={p.status === 'cancelled' ? 'opacity-50' : ''}>
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(p.date)}</td>
                <td className="px-4 py-3 font-medium">{p.number}</td>
                <td className="px-4 py-3">{partyOf(p)}</td>
                <td className="px-4 py-3 capitalize">{p.method.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {p.allocations.length ? `${p.allocations.length} doc(s)` : 'On account'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                  {fmtMoney(p.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? ''}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.status === 'active' && !p.batch && (
                    <button
                      type="button"
                      disabled={busyId === p._id}
                      onClick={() => cancel(p._id)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  )}
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

      {showForm && (
        <PaymentFormModal side={side} onClose={() => setShowForm(false)} onSaved={() => load()} />
      )}
    </div>
  );
}
