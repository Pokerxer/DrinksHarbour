'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { vendorReturnService, type VendorReturn } from '@/services/vendorReturn.service';
import { fmtCur } from './purchases-analytics-helpers';

const methods = ['bank_transfer', 'cash', 'credit_note', 'cheque', 'other'];
const inputClass = 'w-full rounded-lg border border-green-300 px-3 py-2 text-sm';

export default function PurchaseRefundPanel({
  ret,
  token,
  onComplete,
  onCancel,
}: {
  ret: VendorReturn;
  token: string;
  onComplete: (updated: VendorReturn) => void | Promise<void>;
  onCancel: () => void;
}) {
  const remaining = Math.max(
    0,
    Math.round((ret.totalAmount - (ret.refundAmount || 0)) * 100) / 100,
  );
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const retry = useRef<{ signature: string; id: string } | undefined>(undefined);
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    const value = Number(amount);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > remaining ||
      Math.abs(value - Math.round(value * 100) / 100) > 1e-8
    ) {
      toast.error(
        'Enter a positive amount within the remaining balance, with at most two decimal places',
      );
      return;
    }
    const body = { amount: value, method, reference, notes };
    const signature = JSON.stringify(body);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    submitting.current = true;
    setSaving(true);
    try {
      const saved = await vendorReturnService.recordRefund(
        ret._id,
        { ...body, requestId: retry.current.id },
        token,
      );
      toast.success('Refund recorded');
      await onComplete(saved.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record refund');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="text-sm font-semibold text-green-800">Record Refund</p>
      <p className="my-2 text-sm text-green-800">
        Remaining balance: <strong>{fmtCur(remaining, ret.currency)}</strong>
      </p>
      <p className="mb-3 text-xs text-green-700">
        Record money or credit already received from the supplier.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="purchase-refund-amount">Amount</label>
          <input
            id="purchase-refund-amount"
            type="number"
            min="0.01"
            max={remaining}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={saving}
            className={inputClass}
          />
          <div className="mt-1 flex gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                type="button"
                key={pct}
                disabled={saving}
                onClick={() => setAmount(((remaining * pct) / 100).toFixed(2))}
                className="rounded border px-2 text-xs"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="purchase-refund-method">Method</label>
          <select
            id="purchase-refund-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={saving}
            className={inputClass}
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="purchase-refund-reference">Reference</label>
          <input
            id="purchase-refund-reference"
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={saving}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="purchase-refund-notes">Notes</label>
          <input
            id="purchase-refund-notes"
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving || remaining <= 0}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Record received refund'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PurchaseRefundHistory({ ret }: { ret: VendorReturn }) {
  if (!(ret.refundAmount > 0)) return null;
  const entries = [...(ret.refunds || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const earlier = Math.max(
    0,
    Math.round((ret.refundAmount - entries.reduce((sum, r) => sum + r.amount, 0)) * 100) / 100,
  );
  return (
    <div className="mt-4 rounded-xl border border-gray-200 p-4">
      <h2 className="mb-2 font-semibold">Refund history</h2>
      <p className="mb-3 text-sm">
        Remaining: {fmtCur(Math.max(0, ret.totalAmount - (ret.refundAmount || 0)), ret.currency)}
      </p>
      <ul className="space-y-3">
        {earlier > 0 && (
          <li className="border-t pt-2 text-sm">
            Earlier refunds (summary): {fmtCur(earlier, ret.currency)}
          </li>
        )}
        {entries.map((r) => (
          <li key={r._id} className="border-t pt-2 text-sm">
            <strong>{fmtCur(r.amount, ret.currency)}</strong> · {r.method.replace(/_/g, ' ')} ·{' '}
            {new Date(r.date).toLocaleString()}
            <p>
              Recorded by:{' '}
              {r.recordedBy && typeof r.recordedBy === 'object'
                ? r.recordedBy.name || 'Unknown user'
                : 'Unknown user'}
            </p>
            {r.reference && <p>Reference: {r.reference}</p>}
            {r.notes && <p>{r.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
