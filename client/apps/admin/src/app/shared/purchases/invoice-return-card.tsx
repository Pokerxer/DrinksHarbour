'use client';
import { fmtCur } from './purchases-analytics-helpers';
export default function InvoiceReturnCard({
  fullyReturned,
  originalTotal,
  credit,
  total,
  currency,
  refunds,
  refundRemaining,
}: {
  fullyReturned: boolean;
  originalTotal?: number;
  credit?: number;
  total: number;
  currency: string;
  refunds?: number;
  refundRemaining?: number;
}) {
  const rows: [string, number][] = [
    ...(originalTotal != null ? [['Original invoice', originalTotal] as [string, number]] : []),
    ...(credit != null ? [['Return credit', credit] as [string, number]] : []),
    ['Remaining invoice value', total],
    ...(refunds != null ? [['Refund recorded', refunds] as [string, number]] : []),
    ...(refundRemaining != null && refundRemaining > 0
      ? [['Supplier refund remaining', refundRemaining] as [string, number]]
      : []),
  ];
  return (
    <section className="my-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
      <h2 className="text-sm font-semibold text-orange-800">
        {fullyReturned ? 'Fully returned' : 'Adjusted after returns'}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-600">{label}</dt>
            <dd className="mt-1 text-sm font-semibold">{fmtCur(value, currency)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
