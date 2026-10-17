import type { SavedInvoice } from '@/services/arAp.service';
import { invoiceMoney } from './invoice-detail-helpers';
import { fmtDate } from './accounting-helpers';
export default function InvoiceDetailHistory({
  invoice,
}: {
  invoice: SavedInvoice;
}) {
  const activity = invoice.detailContext?.activity || [];
  const labels = {
    receipt: 'Receipt',
    credit: 'Credit note',
    refund: 'Refund',
    pos_receipt: 'POS receipt',
  };
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 print:hidden">
      <div className="mb-5">
        <h2 className="font-lexend text-sm font-semibold text-gray-900">
          Payment and credit history
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Recorded activity linked to this invoice. Shared account and source
          amounts are labelled separately.
        </p>
      </div>
      {!activity.length ? (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          No linked payments or credits have been recorded.
        </p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {activity.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="break-words text-sm font-semibold text-gray-900">
                  {row.label}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {labels[row.kind]} · {fmtDate(row.date)}
                  {row.method ? ` · ${row.method.replaceAll('_', ' ')}` : ''}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {row.scope === 'customer_account'
                    ? 'Shared customer account repayment · allocated oldest first'
                    : row.scope === 'source_document'
                      ? 'Source document amount'
                      : 'Applied to this invoice'}
                </p>
                {row.reference && (
                  <p className="mt-1 break-words text-xs text-gray-500">
                    {row.reference}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold tabular-nums ${row.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                >
                  {invoiceMoney(invoice, row.amount)}
                </p>
                <span
                  className={`mt-1 inline-block rounded px-2 py-1 text-[10px] font-medium ${row.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-800'}`}
                >
                  {row.status === 'cancelled'
                    ? 'Cancelled'
                    : row.kind === 'credit'
                      ? 'Applied'
                      : 'Recorded'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
