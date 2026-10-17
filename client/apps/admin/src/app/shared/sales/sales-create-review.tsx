import { PiCheckCircle, PiWarningCircle } from 'react-icons/pi';
import { fmtCur } from '@/app/shared/purchases/purchases-analytics-helpers';
import { fmtDate } from '@/app/shared/accounting/accounting-helpers';

export default function SalesCreateReview({
  customer,
  validUntil,
  productCount,
  subtotal,
  discounts,
  tax,
  shipping,
  total,
  currency,
  confirmError,
}: {
  customer: string;
  validUntil: string;
  productCount: number;
  subtotal: number;
  discounts: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  confirmError: string;
}) {
  const money = (value: number) => fmtCur(value, currency);
  const effectiveDiscount = Math.min(
    Math.max(0, subtotal + tax),
    Math.max(0, discounts)
  );
  const validDue = validUntil && !Number.isNaN(new Date(validUntil).getTime());
  return (
    <section
      aria-label="Quotation review"
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="font-lexend text-sm font-semibold text-gray-900">
          Quotation review
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Check the details before you confirm
        </p>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs text-gray-500">Quotation total · {currency}</p>
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
            <dt className="text-gray-500">Customer</dt>
            <dd className="mt-1 break-words font-medium text-gray-800">
              {customer}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Product lines</dt>
            <dd className="font-medium text-gray-800">{productCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Quotation expires</dt>
            <dd className="font-medium text-gray-800">
              {validDue ? fmtDate(validUntil) : 'Not set'}
            </dd>
          </div>
        </dl>
        <div
          className={`flex gap-2 rounded-lg p-3 text-xs leading-5 ${confirmError ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            {confirmError ? (
              <PiWarningCircle className="h-4 w-4" />
            ) : (
              <PiCheckCircle className="h-4 w-4" />
            )}
          </span>
          <p>
            {confirmError ||
              'Ready to confirm. The final amount is checked when the quotation is saved.'}
          </p>
        </div>
        <p className="text-[11px] leading-5 text-gray-500">
          Confirmation creates a sales order from this quotation. Payment is
          recorded separately.
        </p>
      </div>
    </section>
  );
}
