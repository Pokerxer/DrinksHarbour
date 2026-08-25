'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import {
  arApService,
  type PaymentDoc,
  type PaymentSide,
} from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400';

/** Create a batch from active, unbatched payments of one direction. */
export default function BatchFormModal({
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
  const [available, setAvailable] = useState<PaymentDoc[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<'1000' | '1100'>('1100');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    arApService
      .unbatched(token, side)
      .then((r) => setAvailable(r.data ?? []))
      .catch((e) => toast.error((e as Error).message));
  }, [token, side]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = Math.round(
    available.filter((p) => selected.has(p._id)).reduce((s, p) => s + p.amount, 0) * 100
  ) / 100;

  const submit = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await arApService.createBatch(token, {
        direction: side,
        paymentIds: Array.from(selected),
        account,
      });
      toast.success('Batch created');
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
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New batch"
      >
        <h3 className="text-base font-semibold text-gray-900">New Payment Batch</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Group unbatched {side} payments into a deposit run.
        </p>

        {available.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No unbatched payments available.
          </p>
        ) : (
          <div className="mt-4 max-h-72 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-200">
            {available.map((p) => (
              <label
                key={p._id}
                className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(p._id)}
                    onChange={() => toggle(p._id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>
                    <span className="font-medium text-gray-800">{p.number}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {p.customerName || p.vendorName || ''} · {fmtDateShort(p.date)}
                    </span>
                  </span>
                </span>
                <span className="font-bold tabular-nums text-gray-900">{fmtMoney(p.amount)}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">
            Account
            <select
              className={`${INPUT_CLS} mt-1`}
              value={account}
              onChange={(e) => setAccount(e.target.value as '1000' | '1100')}
            >
              <option value="1100">Bank (1100)</option>
              <option value="1000">Cash (1000)</option>
            </select>
          </label>
          <p className="text-sm font-bold tabular-nums text-gray-900">
            {selected.size} selected · {fmtMoney(total)}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={submit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            Create Batch
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
