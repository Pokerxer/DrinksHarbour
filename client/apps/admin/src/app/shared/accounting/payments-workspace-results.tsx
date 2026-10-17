import Link from 'next/link';
import type { PaymentDoc, PaymentSide } from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import PaymentPurchaseContext from './payment-purchase-context';
import {
  paymentAmounts,
  paymentMethod,
  paymentParty,
} from './payment-workspace-helpers';
interface Props {
  payments: PaymentDoc[];
  side: PaymentSide;
  busy: boolean;
  details: (payment: PaymentDoc, cancel?: boolean) => void;
}
export function PaymentState({ payment }: { payment: PaymentDoc }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${payment.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}
    >
      {payment.status === 'cancelled'
        ? 'Cancelled'
        : payment.refundIssue
          ? 'Refund review'
          : (payment.refundedAmount || 0) >= payment.amount &&
              payment.amount > 0
            ? 'Fully refunded'
            : payment.refundedAmount
              ? 'Partially refunded'
              : 'Recorded'}
    </span>
  );
}
function Actions({
  payment,
  busy,
  details,
}: { payment: PaymentDoc } & Pick<Props, 'busy' | 'details'>) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => details(payment)}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
      >
        Details
      </button>
      {payment.readOnly ? (
        <Link
          href={payment.sourceHref || '/accounting/invoices'}
          className="text-xs underline"
        >
          Open {payment.source === 'pos' ? 'POS receipt' : 'sale'}
        </Link>
      ) : payment.batch ? (
        <Link href="/accounting/batch-payments" className="text-xs underline">
          Managed in batch
        </Link>
      ) : (
        payment.status === 'active' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => details(payment, true)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Review cancellation
          </button>
        )
      )}
    </div>
  );
}
function PurchaseLinks({ payment }: { payment: PaymentDoc }) {
  return (
    <div className="mt-2 space-y-2">
      {payment.allocations.slice(0, 2).map((allocation, index) => (
        <PaymentPurchaseContext key={index} allocation={allocation} showBill />
      ))}
      {payment.allocations.length > 2 && (
        <p className="text-xs text-gray-500">
          {payment.allocations.length - 2} more bill allocations · View details
        </p>
      )}
    </div>
  );
}
export default function PaymentsWorkspaceResults(props: Props) {
  if (!props.payments.length)
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm font-medium">
          No matching {props.side === 'customer' ? 'receipts' : 'payments'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {props.side === 'vendor'
            ? 'Purchase orders do not record money paid. Record vendor bill payments in Purchases or Accounting, or adjust your filters.'
            : 'Record a payment or adjust your filters.'}
        </p>
        {props.side === 'vendor' && (
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm font-medium">
            <Link href="/purchases" className="underline">
              Open purchase orders
            </Link>
            <Link href="/purchases/bills" className="underline">
              View vendor bills
            </Link>
          </div>
        )}
      </div>
    );
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              {[
                'Record / date',
                props.side === 'customer' ? 'Customer' : 'Vendor',
                'Method / reference',
                'Amount',
                'Unallocated',
                'Status',
                'Actions',
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {props.payments.map((payment) => (
              <tr key={payment._id}>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => props.details(payment)}
                    className="font-semibold hover:underline"
                  >
                    {payment.number}
                  </button>
                  <p className="mt-1 text-xs text-gray-500">
                    {payment.source === 'pos'
                      ? 'POS'
                      : payment.source === 'sales'
                        ? 'Sales'
                        : 'Accounting'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {fmtDate(payment.date)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  {props.side === 'vendor' && payment.vendor?._id ? (
                    <Link
                      href={`/purchases/vendors/${payment.vendor._id}`}
                      className="font-medium hover:underline"
                    >
                      {paymentParty(payment, props.side)}
                    </Link>
                  ) : (
                    paymentParty(payment, props.side)
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {payment.readOnly ? (
                      payment.invoice ? (
                        <Link href={payment.invoice.href} className="underline">
                          {payment.invoice.label}
                        </Link>
                      ) : (
                        'Source receipt'
                      )
                    ) : (
                      `${payment.allocations.length} ${props.side === 'customer' ? 'invoice' : 'bill'} allocations`
                    )}
                  </p>
                  {props.side === 'vendor' && (
                    <PurchaseLinks payment={payment} />
                  )}
                </td>
                <td className="px-4 py-4">
                  <p className="capitalize">{paymentMethod(payment.method)}</p>
                  <p
                    className="mt-1 max-w-40 truncate text-xs text-gray-500"
                    title={payment.reference}
                  >
                    {payment.reference || 'No reference'}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums">
                  {fmtMoney(payment.amount)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                  {payment.status === 'active' && !payment.readOnly
                    ? fmtMoney(paymentAmounts(payment).unallocated)
                    : '—'}
                </td>
                <td className="px-4 py-4">
                  <PaymentState payment={payment} />
                </td>
                <td className="px-4 py-4">
                  <Actions {...props} payment={payment} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {props.payments.map((payment) => (
          <article
            key={payment._id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{payment.number}</p>
                <p className="text-xs text-gray-500">
                  {payment.source === 'pos'
                    ? 'POS'
                    : payment.source === 'sales'
                      ? 'Sales'
                      : 'Accounting'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {fmtDate(payment.date)} · {paymentParty(payment, props.side)}
                </p>
              </div>
              <PaymentState payment={payment} />
            </div>
            {props.side === 'vendor' && <PurchaseLinks payment={payment} />}
            <p className="my-3 text-xs capitalize text-gray-500">
              {paymentMethod(payment.method)} ·{' '}
              {payment.reference || 'No reference'}
            </p>
            <dl className="mb-4 grid grid-cols-2 border-y border-gray-100 py-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Recorded amount</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {fmtMoney(payment.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Unallocated</dt>
                <dd className="mt-1 tabular-nums">
                  {payment.status === 'active' && !payment.readOnly
                    ? fmtMoney(paymentAmounts(payment).unallocated)
                    : '—'}
                </dd>
              </div>
            </dl>
            <Actions {...props} payment={payment} />
          </article>
        ))}
      </div>
    </>
  );
}
