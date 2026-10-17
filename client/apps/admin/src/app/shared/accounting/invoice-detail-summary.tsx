import Link from 'next/link';
import type { SavedInvoice } from '@/services/arAp.service';
import { invoiceMoney } from './invoice-detail-helpers';
import { documentDue } from './accounting-documents';
import InvoicePaymentBadge from './invoice-payment-badge';
import { fmtDate } from './accounting-helpers';
export default function InvoiceDetailSummary({
  invoice,
}: {
  invoice: SavedInvoice;
}) {
  const due = documentDue(invoice);
  return (
    <aside className="order-1 space-y-4 xl:order-2 print:hidden">
      <section className="rounded-xl border border-t-4 border-gray-200 border-t-brand bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-500">
          {invoice.state === 'cancelled'
            ? 'Cancelled invoice'
            : invoice.state === 'draft'
              ? 'Draft balance'
              : 'Amount due'}
        </h2>
        <p className="mt-3 break-words font-lexend text-2xl font-semibold tabular-nums text-gray-900">
          {invoiceMoney(invoice, invoice.outstanding)}
        </p>
        <p
          className={`mt-2 text-xs ${invoice.state === 'posted' && due.overdue ? 'text-brand' : 'text-gray-500'}`}
        >
          {invoice.state === 'posted'
            ? due.label
            : invoice.state === 'draft'
              ? 'Review before posting'
              : 'No payment is due on a cancelled invoice'}
        </p>
        <dl className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-xs">
          {[
            ['Total', invoice.total],
            ['Paid', invoice.amountPaid],
            ['Credit / refunds', invoice.creditedAmount || 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-2">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-semibold tabular-nums text-gray-900">
                {invoiceMoney(invoice, Number(value))}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <InvoicePaymentBadge invoice={invoice} />
        </div>
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-900">Source document</h2>
        <Link
          href={
            invoice.source === 'pos'
              ? `/ecommerce/orders/${invoice.sourceId}`
              : `/sales/${invoice.sourceId}`
          }
          className="mt-3 inline-block break-all text-sm font-semibold text-brand hover:underline"
        >
          Open {invoice.source === 'pos' ? 'POS receipt' : 'Sales order'}
        </Link>
        <p className="mt-1 text-xs text-gray-500">{invoice.sourceNumber}</p>
        {invoice.checkedAt && (
          <p className="mt-4 text-[11px] text-gray-500">
            Last reconciled {fmtDate(invoice.checkedAt)}
          </p>
        )}
      </section>
    </aside>
  );
}
