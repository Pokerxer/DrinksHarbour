'use client';

import { useAccountingDialog } from './use-accounting-dialog';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import {
  arApService,
  type OpenBill,
  type OpenInvoice,
  type PaymentMethod,
  type PaymentSide,
} from '@/services/arAp.service';
import {
  allocationError,
  documentView,
  type AccountingDocument,
} from './accounting-documents';
import PaymentAllocations, { type AllocRow } from './payment-allocations';

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400';

const METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'card', 'pos'];

/** Record a customer/vendor payment and allocate it across open documents. */
export default function PaymentFormModal({
  side,
  initialDocument,
  onClose,
  onSaved,
}: {
  side: PaymentSide;
  initialDocument?: AccountingDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const isAr = side === 'customer';
  const [openDocs, setOpenDocs] = useState<OpenInvoice[] | OpenBill[]>([]);
  const [name, setName] = useState(
    initialDocument ? documentView(initialDocument, side).name : ''
  );
  const [amount, setAmount] = useState(
    initialDocument ? String(initialDocument.outstanding) : ''
  );
  const [method, setMethod] = useState<PaymentMethod>(
    isAr ? 'cash' : 'bank_transfer'
  );
  const [reference, setReference] = useState('');
  const [allocs, setAllocs] = useState<AllocRow[]>(
    initialDocument
      ? [
          {
            docId: initialDocument._id,
            amount: String(initialDocument.outstanding),
          },
        ]
      : []
  );
  const [busy, setBusy] = useState(false);
  const dialogRef = useAccountingDialog(onClose, busy);
  const saving = useRef(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = isAr
          ? await arApService.invoices(token, { limit: 100 })
          : await arApService.bills(token, { limit: 100 });
        if (!cancelled)
          setOpenDocs(
            initialDocument &&
              !res.data.some((doc) => doc._id === initialDocument._id)
              ? ([initialDocument, ...res.data] as OpenInvoice[] | OpenBill[])
              : res.data
          );
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, isAr, initialDocument]);

  const validationError = allocationError(Number(amount), allocs, openDocs);

  const submit = async () => {
    if (saving.current || validationError || !name.trim() || loadError) return;
    saving.current = true;
    setBusy(true);
    try {
      await arApService.createPayment(token, side, {
        amount: Number(amount),
        method,
        reference: reference || undefined,
        customerName: isAr ? name || undefined : undefined,
        vendorName: !isAr ? name || undefined : undefined,
        allocations: allocs
          .filter((a) => a.docId && Number(a.amount) > 0)
          .map((a) =>
            isAr
              ? { salesOrder: a.docId, amount: Number(a.amount) }
              : { vendorBill: a.docId, amount: Number(a.amount) }
          ),
      });
      toast.success('Payment recorded');
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      saving.current = false;
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
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New payment"
      >
        <h3 className="text-base font-semibold text-gray-900">
          {isAr ? 'Record Customer Payment' : 'Pay Vendor'}
        </h3>

        <p className="mt-1 text-xs text-gray-500">
          Record money already received or paid. This does not initiate a bank
          transfer.
        </p>
        {loadError && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            Could not load allocations: {loadError}. Close and retry.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600">
            {isAr ? 'Customer name' : 'Vendor name'}
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Amount
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
            Method
            <select
              className={`${INPUT_CLS} mt-1`}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Reference
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </div>

        <PaymentAllocations
          side={side}
          openDocs={openDocs}
          allocs={allocs}
          setAllocs={setAllocs}
          busy={busy}
          amount={amount}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!!validationError || !name.trim() || !!loadError || busy}
            onClick={submit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {busy ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
