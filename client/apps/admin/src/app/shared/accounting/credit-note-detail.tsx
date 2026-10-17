'use client';
import Link from 'next/link';
import type { CreditNote } from '@/services/arAp.service';
import { useAccountingDialog } from './use-accounting-dialog';
import { creditCustomer, creditTotal } from './credit-note-helpers';
import { CreditBadge } from './credit-notes-results';
import { fmtDate, fmtMoney } from './accounting-helpers';
export default function CreditNoteDetail({
  note,
  onClose,
  action,
  busy = false,
  onConfirm,
}: {
  note: CreditNote;
  onClose: () => void;
  action?: 'post' | 'cancel';
  busy?: boolean;
  onConfirm?: () => void;
}) {
  const ref = useAccountingDialog(onClose, busy);
  const posting = action === 'post';
  const title = action
    ? posting
      ? 'Review credit posting'
      : 'Review credit cancellation'
    : 'Credit note details';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {note.number || 'Unnumbered draft'} · {creditCustomer(note)}
            </p>
          </div>
          <CreditBadge note={note} />
        </div>
        <p className="mt-4 text-sm text-gray-600">
          {note.reason || 'No reason recorded'}
        </p>
        <dl className="my-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
          {[
            ['Credit date', fmtDate(note.date)],
            ['Amount before VAT', fmtMoney(note.amount)],
            ['VAT adjustment', fmtMoney(note.taxAmount)],
            ['Total credit', fmtMoney(creditTotal(note))],
            [
              'Available credit',
              note.status === 'applied' ? fmtMoney(note.unappliedAmount) : '—',
            ],
            ['Posted', note.postedAt ? fmtDate(note.postedAt) : 'Not posted'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {note.invoice && (
          <Link
            className="text-sm font-medium underline"
            href={`/accounting/invoices/${note.invoice.id}`}
          >
            Original invoice · {note.invoice.number}
          </Link>
        )}
        <h3 className="mb-2 mt-5 text-sm font-semibold">Invoice allocations</h3>
        {note.allocations.length ? (
          <ul className="divide-y divide-gray-100 text-sm">
            {note.allocations.map((a, index) => (
              <li
                key={`${a.salesOrder}-${index}`}
                className="flex justify-between gap-3 py-2"
              >
                <div>
                  {a.invoice ? (
                    <Link
                      href={`/accounting/invoices/${a.invoice.id}`}
                      className="underline"
                    >
                      {a.invoice.number}
                    </Link>
                  ) : (
                    <span>Sales order · {a.salesOrder.slice(-6)}</span>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {fmtDate(a.appliedAt)}
                  </p>
                </div>
                <span className="tabular-nums">{fmtMoney(a.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No invoice allocations recorded.
          </p>
        )}
        {action && (
          <div
            className={`mt-5 rounded-xl p-4 text-sm ${posting ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-900'}`}
          >
            {posting ? (
              <p>
                Post {fmtMoney(creditTotal(note))} as a customer credit. Any
                amount not absorbed by the named invoice remains available on
                the customer account. No cash refund is sent.
              </p>
            ) : note.status === 'draft' ? (
              <p>
                Cancel this draft. It has not been posted, so no accounting
                reversal is needed.
              </p>
            ) : (
              <p>
                Reverse this posted credit and remove its invoice allocations.
                Available customer credit will decrease. Cancellation may be
                refused if an invoice can no longer safely release the credit.
              </p>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50"
          >
            {action ? 'Go back' : 'Close'}
          </button>
          {action && (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${posting ? 'bg-gray-900' : 'bg-red-700'}`}
            >
              {busy
                ? 'Saving…'
                : posting
                  ? 'Post credit note'
                  : note.status === 'draft'
                    ? 'Cancel draft'
                    : 'Cancel and reverse'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
