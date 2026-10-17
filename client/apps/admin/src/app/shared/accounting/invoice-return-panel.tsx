import Link from 'next/link';
import type { SavedInvoice } from '@/services/arAp.service';
import InvoiceReturnBadge from './invoice-return-badge';
import { creditReviewPending } from './invoice-return-helpers';
import { invoiceMoney } from './invoice-detail-helpers';
export default function InvoiceReturnPanel({
  invoice,
  busy,
  onCredit,
}: {
  invoice: SavedInvoice;
  busy: boolean;
  onCredit: () => void;
}) {
  const returns = invoice.returnSummary;
  if (!returns || returns.status === 'none') return null;
  const canCredit =
    invoice.source === 'sales' &&
    invoice.state === 'posted' &&
    invoice.currency === 'NGN' &&
    !invoice.reconciliationIssue &&
    !returns.needsReview;
  return (
    <section className="rounded-xl border border-indigo-100 bg-white p-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-lexend text-sm font-semibold">Returned goods</h2>
        <InvoiceReturnBadge invoice={invoice} />
      </div>
      <p className="mt-3 text-sm text-gray-600">
        {returns.recordedUnits} units recorded returned · {returns.soldUnits}{' '}
        units on the original invoice.
      </p>
      {returns.needsReview && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          The returned quantities do not uniquely match the issued invoice.
          Review the source return records before creating a credit.
        </p>
      )}
      <ul className="mt-4 divide-y divide-gray-100">
        {returns.lines.map((line, index) => (
          <li
            key={`${line.sourceId}:${line.reference}:${index}`}
            className="flex flex-wrap justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{line.product}</p>
              <p className="mt-1 text-xs text-gray-500">
                {line.source.toUpperCase()} ·{' '}
                {line.reference || line.sourceNumber}
              </p>
            </div>
            <span className="tabular-nums">{line.returned} returned</span>
          </li>
        ))}
      </ul>
      {returns.truncated && (
        <p className="text-xs text-gray-500">
          Showing the first 50 return lines. Open Inventory for the complete
          history.
        </p>
      )}
      <div className="mt-4 rounded-lg bg-gray-50 p-4 text-xs leading-5 text-gray-600">
        {creditReviewPending(invoice) && (
          <p className="font-semibold text-amber-800">Credit review pending</p>
        )}
        <p>
          Returned goods, customer credit and money refunded are recorded
          separately. The issued invoice stays unchanged.
        </p>
        {(invoice.refundedAmount || 0) > 0 && (
          <p className="mt-2">
            Verified refunds: {invoiceMoney(invoice, invoice.refundedAmount)}
          </p>
        )}
        {(invoice.creditNoteAmount || 0) > 0 && (
          <p className="mt-2">
            Posted credit notes:{' '}
            {invoiceMoney(invoice, invoice.creditNoteAmount)} · Applied to this
            invoice: {invoiceMoney(invoice, invoice.creditedAmount)}
          </p>
        )}
        {returns.refundRecorded && !(invoice.refundedAmount || 0) && (
          <p className="mt-2 text-amber-800">
            A source refund is recorded. Reconcile to verify its accounting
            entries.
          </p>
        )}
        {invoice.source === 'sales' && (
          <p className="mt-2">
            Review the amount and VAT before posting a credit note. Credit on a
            paid invoice may remain on the customer account.
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/inventory/returns?invoice=${encodeURIComponent(invoice._id)}`}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-brand"
        >
          Open Inventory returns
        </Link>
        {invoice.source === 'sales' && invoice.state === 'posted' && (
          <button
            type="button"
            disabled={busy || !canCredit}
            onClick={onCredit}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Review credit note
          </button>
        )}
      </div>
    </section>
  );
}
