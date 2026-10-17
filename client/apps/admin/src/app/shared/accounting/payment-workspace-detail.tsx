'use client';
import Link from 'next/link';
import type { PaymentDoc, PaymentSide } from '@/services/arAp.service';
import { useAccountingDialog } from './use-accounting-dialog';
import { PaymentState } from './payments-workspace-results';
import PaymentPurchaseContext from './payment-purchase-context';
import {
  paymentAmounts,
  paymentMethod,
  paymentParty,
} from './payment-workspace-helpers';
import { fmtDate, fmtMoney } from './accounting-helpers';
export default function PaymentWorkspaceDetail({
  payment,
  side,
  cancel,
  busy,
  close,
  confirm,
}: {
  payment: PaymentDoc;
  side: PaymentSide;
  cancel?: boolean;
  busy: boolean;
  close: () => void;
  confirm: () => void;
}) {
  const ref = useAccountingDialog(close, busy);
  const ar = side === 'customer';
  const title = cancel
    ? `Review ${ar ? 'receipt' : 'payment'} cancellation`
    : `${ar ? 'Receipt' : 'Payment'} details`;
  const amounts = paymentAmounts(payment);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) close();
      }}
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
              {payment.number} · {paymentParty(payment, side)}
            </p>
          </div>
          <PaymentState payment={payment} />
        </div>
        <dl className="my-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
          {[
            ['Date', fmtDate(payment.date)],
            ['Recorded amount', fmtMoney(payment.amount)],
            ['Method', paymentMethod(payment.method)],
            ['Reference', payment.reference || 'Not provided'],
            [
              'Allocated at recording',
              payment.readOnly
                ? 'Tracked in source record'
                : fmtMoney(amounts.allocated),
            ],
            [
              'Unallocated at recording',
              payment.readOnly ? '—' : fmtMoney(amounts.unallocated),
            ],
            ...(payment.readOnly
              ? [['Verified refund', fmtMoney(payment.refundedAmount || 0)]]
              : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-gray-500">{label}</dt>
              <dd className="break-all text-right font-medium tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {payment.readOnly && (
          <div className="mb-4 space-y-2 text-sm">
            <p>
              Received through {payment.source === 'pos' ? 'POS' : 'Sales'}.
              Adjust or refund this receipt in its original record.
            </p>
            {payment.invoice && (
              <Link
                href={payment.invoice.href}
                className="block font-medium underline"
              >
                Invoice · {payment.invoice.label}
              </Link>
            )}
            <Link
              href={payment.sourceHref || '/accounting/invoices'}
              className="block underline"
            >
              Open original {payment.source === 'pos' ? 'POS receipt' : 'sale'}
            </Link>
            {payment.refundIssue && (
              <p role="alert" className="text-amber-800">
                {payment.refundIssue}
              </p>
            )}
          </div>
        )}
        <h3 className="text-sm font-semibold">
          {payment.status === 'cancelled'
            ? 'Reversed allocations'
            : 'Document allocations'}
        </h3>
        {payment.allocations.length ? (
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {payment.allocations.map((a, index) => (
              <li key={index} className="flex justify-between gap-3 py-3">
                <div>
                  {a.document ? (
                    <Link
                      href={a.document.href}
                      className="font-medium underline"
                    >
                      {a.document.label}
                    </Link>
                  ) : (
                    <span>
                      Document unavailable ·{' '}
                      {(a.salesOrder || a.vendorBill || '').slice(-6)}
                    </span>
                  )}
                  {side === 'vendor' && (
                    <div className="mt-1">
                      <PaymentPurchaseContext allocation={a} />
                    </div>
                  )}
                </div>
                <span className="tabular-nums">{fmtMoney(a.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No document allocations recorded.
          </p>
        )}
        {amounts.unallocated > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {payment.status === 'cancelled'
              ? 'This record has been reversed.'
              : 'The unallocated amount does not settle an individual invoice or bill. Review the account before recording another payment.'}
          </p>
        )}
        {payment.batch && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            This payment belongs to a batch.{' '}
            <Link
              href="/accounting/batch-payments"
              className="font-medium underline"
            >
              Review the batch
            </Link>{' '}
            before changing it.
          </p>
        )}
        {cancel && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">
            Cancel {fmtMoney(payment.amount)} and reverse its accounting entry.
            Its document allocations will be rolled back and balances may
            reopen. No money is sent or refunded by this action.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50"
          >
            {cancel ? 'Go back' : 'Close'}
          </button>
          {cancel && (
            <button
              type="button"
              disabled={
                busy ||
                payment.readOnly ||
                !!payment.batch ||
                payment.status !== 'active'
              }
              onClick={confirm}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Reversing…' : 'Cancel and reverse'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
