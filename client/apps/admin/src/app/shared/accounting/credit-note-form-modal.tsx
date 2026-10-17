'use client';

import { useAccountingDialog } from './use-accounting-dialog';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { arApService, type OpenInvoice } from '@/services/arAp.service';
import CreditCustomerSelect from './credit-customer-select';
import CreditInvoiceLoading from './credit-invoice-loading';
import type { CreditInvoiceChoices } from './use-credit-invoices';
import { fmtMoney } from './accounting-helpers';

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400';

/** Save a reviewed draft or explicitly post a customer credit. */
export default function CreditNoteFormModal({
  invoices,
  initialInvoice,
  defaultPostNow,
  invoiceChoices,
  onClose,
  onSaved,
}: {
  invoices: OpenInvoice[];
  initialInvoice?: OpenInvoice;
  defaultPostNow?: boolean;
  invoiceChoices?: CreditInvoiceChoices;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [salesOrderId, setSalesOrderId] = useState(initialInvoice?._id || '');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [reason, setReason] = useState(
    initialInvoice
      ? `Returned goods — ${initialInvoice.orderNumber || initialInvoice._id}`
      : ''
  );
  const [postNow, setPostNow] = useState(defaultPostNow ?? !initialInvoice);
  const [busy, setBusy] = useState(false);
  const dialogRef = useAccountingDialog(onClose, busy);

  const initializedInvoice = useRef('');
  useEffect(() => {
    if (!salesOrderId) {
      initializedInvoice.current = '';
      return;
    }
    if (initializedInvoice.current === salesOrderId) return;
    const inv = invoices.find((i) => i._id === salesOrderId);
    if (inv) {
      initializedInvoice.current = salesOrderId;
      setCustomerName(
        inv.customerSnapshot?.name ||
          (inv.customer
            ? `${inv.customer.firstName} ${inv.customer.lastName}`.trim()
            : inv.customerSnapshot?.name || '')
      );
      setAmount(
        initialInvoice?._id === salesOrderId
          ? ''
          : String(inv.outstanding ?? '')
      );
      setTaxAmount('');
    }
  }, [salesOrderId, invoices, initialInvoice]);

  const selectedInvoice = invoices.find(
    (invoice) => invoice._id === salesOrderId
  );
  const gross = Number(amount) + Number(taxAmount || 0);
  // A credit may legitimately exceed what the invoice owes — against a paid
  // invoice the entire amount becomes unapplied credit. So this is a preview of
  // the split, not a limit, which is what the old "exceeds outstanding" check
  // wrongly enforced.
  const appliedNow = selectedInvoice
    ? Math.min(gross, selectedInvoice.outstanding)
    : 0;
  const unapplied = Math.max(0, gross - appliedNow);
  const valid =
    Number.isFinite(gross) &&
    Number(amount) > 0 &&
    Number(taxAmount || 0) >= 0 &&
    (!!selectedInvoice || !!customerId) &&
    (!selectedInvoice || (!invoiceChoices?.loading && !invoiceChoices?.error));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await arApService.createCreditNote(token, {
        amount: Number(amount),
        taxAmount: Number(taxAmount) || 0,
        salesOrder: salesOrderId || undefined,
        customer: customerId || undefined,
        customerName: customerName || undefined,
        reason: reason || undefined,
        post: postNow,
      });
      toast.success(postNow ? 'Credit note posted' : 'Credit draft saved');
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
              onChange={(e) => {
                setSalesOrderId(e.target.value);
                setCustomerId('');
                setCustomerName('');
                setAmount('');
                setTaxAmount('');
              }}
            >
              <option value="">Standalone credit</option>
              {invoices.map((i) => (
                <option key={i._id} value={i._id}>
                  {i.orderNumber} · {fmtMoney(i.outstanding)} outstanding
                </option>
              ))}
            </select>
          </label>
          {invoiceChoices && <CreditInvoiceLoading choices={invoiceChoices} />}
          {!selectedInvoice && (
            <CreditCustomerSelect
              token={token}
              value={customerId}
              onChange={(id, name) => {
                setCustomerId(id);
                setCustomerName(name);
              }}
            />
          )}
          {selectedInvoice && (
            <label className="block text-xs font-medium text-gray-600">
              Customer name
              <input
                type="text"
                className={`${INPUT_CLS} mt-1`}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                readOnly
              />
            </label>
          )}
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

          {/* Where the money lands. Worth stating plainly: an operator who did
              not expect the excess to sit as account credit should be able to
              see it before it happens, not discover it in the ledger. */}
          {Number(amount) > 0 && (
            <div className="rounded bg-gray-50 p-2.5 text-[11px] text-gray-600">
              <div className="flex justify-between">
                <span>Total credit</span>
                <span className="tabular-nums">{fmtMoney(gross)}</span>
              </div>
              {selectedInvoice && (
                <div className="flex justify-between">
                  <span>
                    On posting, reduces{' '}
                    {selectedInvoice.orderNumber || 'the invoice'} by
                  </span>
                  <span className="tabular-nums">{fmtMoney(appliedNow)}</span>
                </div>
              )}
              {unapplied > 0 && (
                <div className="flex justify-between font-medium text-emerald-700">
                  <span>On posting, held as available credit</span>
                  <span className="tabular-nums">{fmtMoney(unapplied)}</span>
                </div>
              )}
            </div>
          )}

          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              className="mt-0.5"
              aria-label="Post immediately"
              checked={postNow}
              onChange={(e) => setPostNow(e.target.checked)}
            />
            <span>
              Post immediately
              <span className="block text-[11px] text-gray-400">
                {postNow
                  ? 'Moves the ledger now. Untick to save a draft you can review before posting.'
                  : 'Saves a draft. Nothing reaches the ledger until you post it.'}
              </span>
            </span>
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
            {postNow ? 'Post credit note' : 'Save draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
