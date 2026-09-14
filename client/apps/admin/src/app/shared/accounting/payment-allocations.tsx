'use client';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type {
  OpenInvoice,
  OpenBill,
  PaymentSide,
} from '@/services/arAp.service';
import { allocationError } from './accounting-documents';
import { fmtMoney } from './accounting-helpers';
export interface AllocRow {
  docId: string;
  amount: string;
}
const INPUT_CLS =
  'min-h-11 min-w-0 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand';
export default function PaymentAllocations({
  side,
  openDocs,
  allocs,
  setAllocs,
  busy,
  amount,
}: {
  side: PaymentSide;
  openDocs: OpenInvoice[] | OpenBill[];
  allocs: AllocRow[];
  setAllocs: Dispatch<SetStateAction<AllocRow[]>>;
  busy: boolean;
  amount: string;
}) {
  const isAr = side === 'customer';
  const labelOf = (d: OpenInvoice | OpenBill) =>
    isAr
      ? `${(d as OpenInvoice).orderNumber} · ${(d as OpenInvoice).customer?.firstName ?? ''} ${fmtMoney(d.outstanding)}`
      : `${(d as OpenBill).billNumber} · ${(d as OpenBill).vendor?.name ?? ''} · ${fmtMoney(d.outstanding)}`;

  const allocated = useMemo(
    () =>
      Math.round(
        allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0) * 100
      ) / 100,
    [allocs]
  );
  const overAllocated =
    Number(amount) > 0 && allocated > Number(amount) + 0.001;

  const validationError = allocationError(Number(amount), allocs, openDocs);
  const addAlloc = () => {
    const first = openDocs.find(
      (doc) => !allocs.some((allocation) => allocation.docId === doc._id)
    );
    if (!first) return;
    setAllocs((prev) => [
      ...prev,
      { docId: first._id, amount: String(first.outstanding) },
    ]);
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Allocation (optional)
        </p>
        <button
          type="button"
          onClick={addAlloc}
          disabled={openDocs.length <= allocs.length || busy}
          className="rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-400 disabled:opacity-40"
        >
          + Allocate
        </button>
      </div>
      <div className="space-y-2">
        {allocs.map((a, i) => (
          <div
            key={i}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_90px_auto] items-center gap-2"
          >
            <select
              className={INPUT_CLS}
              value={a.docId}
              onChange={(e) =>
                setAllocs((prev) =>
                  prev.map((r, idx) =>
                    idx === i
                      ? {
                          ...r,
                          docId: e.target.value,
                          amount: String(
                            openDocs.find((doc) => doc._id === e.target.value)
                              ?.outstanding || 0
                          ),
                        }
                      : r
                  )
                )
              }
              aria-label={`Document ${i + 1}`}
            >
              {openDocs
                .filter(
                  (doc) =>
                    doc._id === a.docId ||
                    !allocs.some((row) => row.docId === doc._id)
                )
                .map((d) => (
                  <option key={d._id} value={d._id}>
                    {labelOf(d)}
                  </option>
                ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`${INPUT_CLS} text-right`}
              value={a.amount}
              onChange={(e) =>
                setAllocs((prev) =>
                  prev.map((r, idx) =>
                    idx === i ? { ...r, amount: e.target.value } : r
                  )
                )
              }
              aria-label={`Amount ${i + 1}`}
            />
            <button
              type="button"
              onClick={() =>
                setAllocs((prev) => prev.filter((_, idx) => idx !== i))
              }
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label={`Remove allocation ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        {allocs.length === 0 && (
          <p className="text-xs text-gray-400">
            No allocation — recorded on account.
          </p>
        )}
      </div>
      <p
        className={`mt-2 text-xs font-medium ${overAllocated ? 'text-red-600' : 'text-gray-500'}`}
      >
        Allocated {fmtMoney(allocated)} of {fmtMoney(Number(amount) || 0)}
        {validationError ? ` — ${validationError}` : ''}
      </p>
    </div>
  );
}
