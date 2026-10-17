'use client';

import { useMemo, useState } from 'react';
import { PiCheckCircle } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { arApService, type OpenInvoice } from '@/services/arAp.service';
import { useAccountingDialog } from './use-accounting-dialog';
import CreditInvoiceLoading from './credit-invoice-loading';
import type { CreditInvoiceChoices } from './use-credit-invoices';
import { fmtMoney } from './accounting-helpers';

const SELECT_CLS =
  'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

interface Props {
  token: string;
  /** Account the credit is spent from. */
  customer: string;
  /** Credit available to spend. */
  available: number;
  /** Already scoped to this customer by the caller. */
  invoices: OpenInvoice[];
  /** Context line, e.g. a note number or the customer's name. */
  caption?: string;
  invoiceChoices?: CreditInvoiceChoices;
  onClose: () => void;
  onApplied: () => void;
}

/**
 * Applies available customer account credit using the existing oldest-note FIFO flow.
 *
 * Application is always explicit. The server will happily spend a note across
 * several notes oldest-first against the chosen invoice. A silent
 * sweep moves money where the operator did not ask, and undoing it means
 * cancelling a note whose invoices may since have been paid.
 */
export default function CreditApplyModal({
  token,
  customer,
  available,
  invoices,
  caption,
  invoiceChoices,
  onClose,
  onApplied,
}: Props) {
  const [salesOrder, setSalesOrder] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useAccountingDialog(onClose, busy);

  // Only invoices still owing something — the server refuses a settled invoice,
  // so hide it here rather than offering a choice that can only fail.
  const candidates = useMemo(
    () => invoices.filter((inv) => inv.outstanding && inv.outstanding > 0),
    [invoices]
  );

  const selected = candidates.find((inv) => inv._id === salesOrder);
  const ceiling = Math.min(available, selected?.outstanding || 0);

  // Default to the full ceiling: the common intent is "settle this invoice as far
  // as the credit allows".
  const effective = amount.trim() === '' ? ceiling : Number(amount);

  const valid =
    !!selected &&
    Number.isFinite(effective) &&
    effective > 0 &&
    effective <= ceiling &&
    !invoiceChoices?.loading &&
    !invoiceChoices?.error;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const res = await arApService.applyCredit(token, {
        salesOrder,
        customer,
        amount: effective > 0 ? effective : undefined,
      });
      toast.success(`${fmtMoney(res.data?.applied ?? 0)} credit applied`);
      onApplied();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Apply customer credit"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-sm font-semibold text-gray-900">Apply credit</h2>
        <p className="mt-1 text-xs text-gray-500">
          {caption ? `${caption} · ` : ''}
          {fmtMoney(available)} available on this customer account. Credit is
          used from the oldest posted notes first. No cash refund is sent.
        </p>

        {invoiceChoices && (
          <div className="mt-3">
            <CreditInvoiceLoading choices={invoiceChoices} />
          </div>
        )}
        {candidates.length === 0 ? (
          <p className="mt-4 rounded bg-amber-50 p-3 text-xs text-amber-800">
            No open invoice for this customer to apply credit to. The balance
            stays on the account until one exists.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-gray-600">
              Invoice
              <select
                className={`${SELECT_CLS} mt-1`}
                value={salesOrder}
                onChange={(e) => {
                  setSalesOrder(e.target.value);
                  setAmount(''); // ceiling changed; fall back to "the maximum"
                }}
              >
                <option value="">Select an invoice…</option>
                {candidates.map((inv) => (
                  <option key={inv._id} value={inv._id}>
                    {inv.orderNumber || inv._id.slice(-6)} —{' '}
                    {fmtMoney(inv.outstanding)} outstanding
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-gray-600">
              Amount
              <input
                className={`${SELECT_CLS} mt-1`}
                type="number"
                aria-label="Amount"
                min={0}
                max={ceiling}
                step="0.01"
                placeholder={ceiling ? fmtMoney(ceiling) : 'Select an invoice'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!salesOrder}
              />
              <span className="mt-1 block text-[11px] text-gray-400">
                Leave blank to apply up to {fmtMoney(ceiling)}. The amount
                cannot exceed available credit or the invoice balance.
              </span>
            </label>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !valid}
            className="flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
          >
            <PiCheckCircle size={13} /> Apply credit
          </button>
        </div>
      </div>
    </div>
  );
}
