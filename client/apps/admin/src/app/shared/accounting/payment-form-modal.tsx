'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import {
  arApService,
  type OpenBill,
  type OpenInvoice,
  type PaymentMethod,
  type PaymentSide,
} from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400';

interface AllocRow {
  docId: string;
  amount: string;
}

const METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'card', 'pos', 'wallet'];

/** Record a customer/vendor payment and allocate it across open documents. */
export default function PaymentFormModal({
  side,
  onClose,
  onSaved,
}: {
  side: PaymentSide;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const isAr = side === 'customer';
  const [openDocs, setOpenDocs] = useState<OpenInvoice[] | OpenBill[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(isAr ? 'cash' : 'bank_transfer');
  const [reference, setReference] = useState('');
  const [allocs, setAllocs] = useState<AllocRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = isAr
          ? await arApService.invoices(token, { limit: 100 })
          : await arApService.bills(token, { limit: 100 });
        setOpenDocs(res.data ?? []);
      } catch (e) {
        toast.error((e as Error).message);
      }
    };
    load();
  }, [token, isAr]);

  const outstandingOf = (d: OpenInvoice | OpenBill) => d.outstanding;
  const labelOf = (d: OpenInvoice | OpenBill) =>
    isAr
      ? `${(d as OpenInvoice).orderNumber} · ${(d as OpenInvoice).customer?.firstName ?? ''} ${fmtMoney(d.outstanding)}`
      : `${(d as OpenBill).billNumber} · ${(d as OpenBill).vendor?.name ?? ''} · ${fmtMoney(d.outstanding)}`;

  const allocated = useMemo(
    () => Math.round(allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0) * 100) / 100,
    [allocs]
  );
  const overAllocated = Number(amount) > 0 && allocated > Number(amount) + 0.001;

  const addAlloc = () => {
    const first = openDocs[0];
    if (!first) return;
    setAllocs((prev) => [...prev, { docId: first._id, amount: String(first.outstanding) }]);
  };

  const submit = async () => {
    if (!(Number(amount) > 0) || overAllocated) return;
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
            isAr ? { salesOrder: a.docId, amount: Number(a.amount) } : { vendorBill: a.docId, amount: Number(a.amount) }
          ),
      });
      toast.success('Payment recorded');
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
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New payment"
      >
        <h3 className="text-base font-semibold text-gray-900">
          {isAr ? 'Record Customer Payment' : 'Pay Vendor'}
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-600">
            {isAr ? 'Customer name' : 'Vendor name'}
            <input type="text" className={`${INPUT_CLS} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
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
            <select className={`${INPUT_CLS} mt-1`} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Reference
            <input type="text" className={`${INPUT_CLS} mt-1`} value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Allocation (optional)
            </p>
            <button
              type="button"
              onClick={addAlloc}
              disabled={openDocs.length === 0}
              className="rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-400 disabled:opacity-40"
            >
              + Allocate
            </button>
          </div>
          <div className="space-y-2">
            {allocs.map((a, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_auto] items-center gap-2">
                <select
                  className={INPUT_CLS}
                  value={a.docId}
                  onChange={(e) =>
                    setAllocs((prev) => prev.map((r, idx) => (idx === i ? { ...r, docId: e.target.value } : r)))
                  }
                  aria-label={`Document ${i + 1}`}
                >
                  {openDocs.map((d) => (
                    <option key={d._id} value={d._id}>{labelOf(d)}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${INPUT_CLS} text-right`}
                  value={a.amount}
                  onChange={(e) =>
                    setAllocs((prev) => prev.map((r, idx) => (idx === i ? { ...r, amount: e.target.value } : r)))
                  }
                  aria-label={`Amount ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setAllocs((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  aria-label={`Remove allocation ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {allocs.length === 0 && (
              <p className="text-xs text-gray-400">No allocation — recorded on account.</p>
            )}
          </div>
          <p className={`mt-2 text-xs font-medium ${overAllocated ? 'text-red-600' : 'text-gray-500'}`}>
            Allocated {fmtMoney(allocated)} of {fmtMoney(Number(amount) || 0)}
            {overAllocated ? ' — exceeds payment amount' : ''}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!(Number(amount) > 0) || overAllocated || busy}
            onClick={submit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
