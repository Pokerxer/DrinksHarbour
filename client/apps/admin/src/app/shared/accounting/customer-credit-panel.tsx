'use client';

import { useCallback, useEffect, useState } from 'react';
import { PiX } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  arApService,
  type AccountingCustomer,
  type OpenInvoice,
} from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import CreditApplyModal from './credit-apply-modal';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  applied: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

interface Props {
  token: string;
  customer: AccountingCustomer;
  onClose: () => void;
}

/**
 * One customer's credit account: the balance they hold, the notes behind it, and
 * a way to spend it.
 *
 * The credit balance is not stored on the customer — it is summed from the
 * notes — so this panel reads the same source the ledger does and cannot
 * disagree with it.
 */
export default function CustomerCreditPanel({ token, customer, onClose }: Props) {
  const [notes, setNotes] = useState<Awaited<ReturnType<typeof arApService.customerCredits>>['data']>([]);
  const [balance, setBalance] = useState(0);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [loading, setLoading] = useState(true);

  const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.email || customer._id;

  const load = useCallback(async () => {
    try {
      const [credit, open] = await Promise.all([
        arApService.customerCredits(token, customer._id, { limit: 25 }),
        arApService.invoices(token, { limit: 100, scope: 'open' }),
      ]);
      setNotes(credit.data?.data ?? []);
      setBalance(credit.data?.balance ?? 0);
      setInvoices(
        (open.data ?? []).filter(
          (inv) => inv.customer?._id === customer._id && inv.outstanding > 0
        )
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, customer._id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Credit account for ${name}`}
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
    >
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Customer credit</h2>
            <p className="text-xs text-gray-500">{name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <PiX size={15} />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Unapplied credit
            </p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-700">
              {fmtMoney(balance)}
            </p>
          </div>
          <button
            type="button"
            disabled={balance <= 0 || invoices.length === 0}
            onClick={() => setShowApply(true)}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
            title={
              invoices.length === 0
                ? 'This customer has no open invoice to apply credit to.'
                : undefined
            }
          >
            Apply to invoice
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">
            Credit notes
          </p>
          {loading ? (
            <p className="py-6 text-center text-xs text-gray-400">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">
              No credit notes for this customer.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2">Note</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-right">Unapplied</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notes.map((n) => (
                  <tr
                    key={n._id}
                    className={n.status === 'cancelled' ? 'opacity-50' : ''}
                  >
                    <td className="px-2 py-2 font-medium">{n.number || 'Draft'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-500">
                      {fmtDate(n.date)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {fmtMoney(n.amount + n.taxAmount)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {n.unappliedAmount > 0 ? (
                        fmtMoney(n.unappliedAmount)
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          STATUS_STYLES[n.status] ?? ''
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showApply && (
          <CreditApplyModal
            token={token}
            customer={customer._id}
            available={balance}
            invoices={invoices}
            caption={name}
            onClose={() => setShowApply(false)}
            onApplied={load}
          />
        )}
      </div>
    </div>
  );
}
