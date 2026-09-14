'use client';

import { useAccountingDialog } from './use-accounting-dialog';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { arApService, type OpenInvoice } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400';

/** Issue a customer credit note (posts a refund journal entry on save). */
export default function CreditNoteFormModal({
  invoices,
  onClose,
  onSaved,
}: {
  invoices: OpenInvoice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [salesOrderId, setSalesOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useAccountingDialog(onClose, busy);

  useEffect(() => {
    if (!salesOrderId) return;
    const inv = invoices.find((i) => i._id === salesOrderId);
    if (inv) {
      setCustomerName(
        inv.customer
          ? `${inv.customer.firstName} ${inv.customer.lastName}`.trim()
          : inv.customerSnapshot?.name || ''
      );
      setAmount(String(inv.outstanding ?? ''));
      setTaxAmount('');
    }
  }, [salesOrderId, invoices]);

  const selectedInvoice = invoices.find(
    (invoice) => invoice._id === salesOrderId
  );
  const gross = Number(amount) + Number(taxAmount || 0);
  const valid =
    Number.isFinite(gross) &&
    Number(amount) > 0 &&
    Number(taxAmount || 0) >= 0 &&
    !!customerName.trim() &&
    (!selectedInvoice ||
      Math.round(gross * 100) <= Math.round(selectedInvoice.outstanding * 100));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await arApService.createCreditNote(token, {
        amount: Number(amount),
        taxAmount: Number(taxAmount) || 0,
        salesOrder: salesOrderId || undefined,
        customerName: customerName || undefined,
        reason: reason || undefined,
      });
      toast.success('Credit note applied');
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="presentation"
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New credit note"
      >
        <h3 className="text-base font-semibold text-gray-900">
          New Credit Note
        </h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Reduce an invoice balance or record a customer credit. No cash refund
          is sent.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">
            Against invoice (optional)
            <select
              className={`${INPUT_CLS} mt-1`}
              value={salesOrderId}
              onChange={(e) => setSalesOrderId(e.target.value)}
            >
              <option value="">Standalone credit</option>
              {invoices.map((i) => (
                <option key={i._id} value={i._id}>
                  {i.orderNumber} · {fmtMoney(i.outstanding)} outstanding
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Customer name
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in customer"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-600">
              Amount (ex-tax)
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${INPUT_CLS} mt-1`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Tax amount
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${INPUT_CLS} mt-1`}
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-gray-600">
            Reason
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Damaged goods, pricing error…"
              maxLength={200}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose();
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={submit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            Apply Credit Note
          </button>
        </div>
      </div>
    </div>
  );
}
