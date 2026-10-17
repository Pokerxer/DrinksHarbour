import { PiCheckCircle, PiWarningCircle } from 'react-icons/pi';
import { fmtCur } from '@/app/shared/purchases/purchases-analytics-helpers';
import { fmtDate } from './accounting-helpers';

export default function InvoiceCreateReview({
  customer,
  dueDate,
  productCount,
  subtotal,
  discounts,
  tax,
  shipping,
  total,
  currency,
  issueError,
}: {
  customer: string;
  dueDate: string;
  productCount: number;
  subtotal: number;
  discounts: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  issueError: string;
}) {
  const money = (value: number) => fmtCur(value, currency);
  const effectiveDiscount = Math.min(
    Math.max(0, subtotal + tax),
    Math.max(0, discounts)
  );
  const validDue = dueDate && !Number.isNaN(new Date(dueDate).getTime());
  return (
    <section
      aria-label="Invoice review"
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="font-lexend text-sm font-semibold text-gray-900">
          Invoice review
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Check the details before you issue
        </p>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs text-gray-500">Total due · {currency}</p>
          <p className="mt-2 break-words font-lexend text-3xl font-semibold tabular-nums tracking-tight text-gray-900">
            {money(total)}
          </p>
        </div>
        <dl className="space-y-2 border-b border-gray-100 pb-4 text-xs text-gray-600">
          {[
            ['Subtotal', subtotal],
            ['Discounts', -effectiveDiscount],
            ['Tax', tax],
            ['Shipping', Math.max(0, shipping)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt>{label}</dt>
              <dd className="font-medium tabular-nums">
                {money(Number(value))}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-gray-500">Bill to</dt>
            <dd className="mt-1 break-words font-medium text-gray-800">
              {customer}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Product lines</dt>
            <dd className="font-medium text-gray-800">{productCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Payment due</dt>
            <dd className="font-medium text-gray-800">
              {validDue ? fmtDate(dueDate) : 'Not set'}
            </dd>
          </div>
        </dl>
        <div
          className={`flex gap-2 rounded-lg p-3 text-xs leading-5 ${issueError ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            {issueError ? (
              <PiWarningCircle className="h-4 w-4" />
            ) : (
              <PiCheckCircle className="h-4 w-4" />
            )}
          </span>
          <p>
            {issueError ||
              'Ready to issue. The final amount is confirmed when the invoice is saved.'}
          </p>
        </div>
        <p className="text-[11px] leading-5 text-gray-500">
          No payment is collected when you issue an invoice. Record a receipt
          after money arrives.
        </p>
      </div>
    </section>
  );
}
