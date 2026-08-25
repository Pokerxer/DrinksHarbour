'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiCaretLeft, PiCaretRight, PiPlus } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { arApService, type CreditNote, type OpenInvoice } from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import CreditNoteFormModal from './credit-note-form-modal';

const STATUS_STYLES: Record<string, string> = {
  applied: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500 line-through',
  draft: 'bg-amber-100 text-amber-700',
};

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

/** /accounting/credit-notes — list + issue + cancel. */
export default function CreditNotesView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await arApService.creditNotes(token, {
        page,
        limit: 25,
        status: statusFilter || undefined,
      });
      setNotes(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    arApService
      .invoices(token, { limit: 100 })
      .then((r) => setInvoices(r.data ?? []))
      .catch(() => {});
  }, [token]);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await arApService.cancelCreditNote(token, id);
      toast.success('Credit note cancelled — reversal posted');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <option value="applied">Applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
        >
          <PiPlus size={14} /> New Credit Note
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Tax</th>
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
            {!loading && notes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No credit notes yet.
                </td>
              </tr>
            )}
            {notes.map((n) => {
              const name = n.customer
                ? `${n.customer.firstName} ${n.customer.lastName}`.trim()
                : n.customerName || '—';
              return (
                <tr key={n._id} className={n.status === 'cancelled' ? 'opacity-50' : ''}>
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(n.date)}</td>
                  <td className="px-4 py-3 font-medium">{n.number}</td>
                  <td className="px-4 py-3">{name}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-500">{n.reason || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(n.amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(n.taxAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[n.status] ?? ''}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {n.status === 'applied' && (
                      <button
                        type="button"
                        disabled={busyId === n._id}
                        onClick={() => cancel(n._id)}
                        className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
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
        <CreditNoteFormModal
          invoices={invoices}
          onClose={() => setShowForm(false)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
