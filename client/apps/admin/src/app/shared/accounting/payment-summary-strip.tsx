import type { PaymentSide, PaymentSummary } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';
export default function PaymentSummaryStrip({
  side,
  summary,
  unavailable,
}: {
  side: PaymentSide;
  summary: PaymentSummary;
  unavailable: boolean;
}) {
  const ar = side === 'customer';
  const totals = [
    {
      label: ar ? 'Received' : 'Paid to vendors',
      amount: summary.activeAmount,
      note: 'Active matching records',
      primary: true,
    },
    ...(ar
      ? [
          {
            label: 'Verified refunds',
            amount: summary.refundedAmount || 0,
            note: 'Sales/POS payouts',
            primary: true,
          },
        ]
      : []),
    {
      label: 'Accounting allocated',
      amount: summary.allocated,
      note: ar ? 'Applied to invoices' : 'Applied to bills',
      primary: false,
    },
    {
      label: 'Accounting unallocated',
      amount: summary.unallocated,
      note: 'Not applied to a document',
      primary: false,
    },
    {
      label: 'Cancelled',
      amount: summary.cancelledAmount,
      note: 'Excluded from received or paid',
      primary: false,
    },
  ];
  return (
    <section
      aria-label="Payment totals"
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <dl
        className={`grid grid-cols-2 ${ar ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}
      >
        {totals.map((total) => (
          <div
            key={total.label}
            className={`min-w-0 border-b border-gray-100 p-4 xl:border-b-0 ${total.primary ? 'bg-gray-50' : ''}`}
          >
            <dt className="text-xs font-medium text-gray-600">{total.label}</dt>
            <dd
              className={`mt-2 break-words font-semibold tabular-nums tracking-tight ${total.primary ? 'text-xl text-gray-900' : 'text-lg text-gray-700'}`}
            >
              {unavailable ? '—' : fmtMoney(total.amount)}
            </dd>
            <p className="mt-1 text-xs text-gray-500">{total.note}</p>
          </div>
        ))}
      </dl>
      <p className="border-t border-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-500">
        Totals cover all matching records. Allocations include Accounting
        records only.
        {ar && (
          <>
            {' '}
            Sales/POS receipts are tracked in their original records
            {!unavailable && !!summary.sourceAmount
              ? ` (${fmtMoney(summary.sourceAmount)})`
              : ''}
            . Refunds are shown separately from received money.
          </>
        )}
      </p>
    </section>
  );
}
