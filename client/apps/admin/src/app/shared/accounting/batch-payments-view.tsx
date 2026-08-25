'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiPlus } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  arApService,
  type BatchPayment,
  type PaymentDoc,
  type PaymentSide,
} from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import BatchFormModal from './batch-form-modal';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  deposited: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

/** /accounting/batch-payments — deposit runs for customer/vendor payments. */
export default function BatchPaymentsView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const initialSide = (searchParams.get('side') as PaymentSide) || 'customer';
  const [side, setSide] = useState<PaymentSide>(initialSide === 'vendor' ? 'vendor' : 'customer');
  const [batches, setBatches] = useState<BatchPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await arApService.batches(token, { side, limit: 50 });
      setBatches(res.data ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, side]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: 'deposit' | 'cancel') => {
    setBusyId(id);
    try {
      if (action === 'deposit') {
        await arApService.depositBatch(token, id);
        toast.success('Batch marked deposited');
      } else {
        await arApService.cancelBatch(token, id);
        toast.success('Batch cancelled — payments unlinked');
      }
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
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
          {(['customer', 'vendor'] as PaymentSide[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                side === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'customer' ? 'Customer Receipts' : 'Vendor Payments'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
        >
          <PiPlus size={14} /> New Batch
        </button>
      </div>

      {loading && <p className="py-8 text-center text-sm text-gray-400">Loading batches…</p>}
      {!loading && batches.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No batches yet — group payments into a deposit run.
        </p>
      )}

      <div className="space-y-4">
        {batches.map((b) => (
          <div key={b._id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {b.number}
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                    {b.direction}
                  </span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[b.status] ?? ''}`}>
                    {b.status}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  {fmtDate(b.date)} · account {b.account} · {b.payments?.length ?? 0} payment(s)
                  {b.depositedAt ? ` · deposited ${fmtDate(b.depositedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tabular-nums text-gray-900">{fmtMoney(b.total)}</span>
                {b.status === 'open' && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === b._id}
                      onClick={() => act(b._id, 'deposit')}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
                    >
                      Mark Deposited
                    </button>
                    <button
                      type="button"
                      disabled={busyId === b._id}
                      onClick={() => act(b._id, 'cancel')}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            {(b.payments ?? []).length > 0 && (
              <div className="divide-y divide-gray-50 rounded-lg bg-gray-50 px-4">
                {b.payments!.map((p) => (
                  <div key={p._id} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-medium text-gray-700">
                      {p.number}
                      <span className="ml-2 text-gray-400">{p.customerName || p.vendorName || ''}</span>
                    </span>
                    <span className="font-bold tabular-nums text-gray-900">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <BatchFormModal
          side={side}
          onClose={() => setShowForm(false)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}

// Keep PaymentDoc import used for the modal contract.
export type { PaymentDoc };
