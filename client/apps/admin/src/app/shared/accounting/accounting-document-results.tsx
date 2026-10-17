'use client';
import Link from 'next/link';
import { PiReceipt } from 'react-icons/pi';
import type { PaymentSide } from '@/services/arAp.service';
import type { AccountingDocument } from './accounting-documents';
import { routes } from '@/config/routes';
import { fmtMoney } from './accounting-helpers';
import AccountingDocumentRow from './accounting-document-row';
import AccountingDocumentCard from './accounting-document-card';

export default function AccountingDocumentResults({
  docs,
  side,
  loading,
  onPay,
  filtered = false,
  onClear,
  disabled = false,
}: {
  docs: AccountingDocument[];
  side: PaymentSide;
  loading: boolean;
  onPay: (doc: AccountingDocument) => void;
  filtered?: boolean;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const ar = side === 'customer';
  if (loading && !docs.length)
    return (
      <div role="status" className="space-y-3 p-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none"
          />
        ))}
        <span className="sr-only">Loading {ar ? 'invoices' : 'bills'}</span>
      </div>
    );
  if (!docs.length)
    return (
      <div className="px-6 py-14 text-center">
        <PiReceipt aria-hidden className="mx-auto mb-4 h-9 w-9 text-gray-300" />
        <h2 className="font-lexend text-base font-semibold text-gray-900">
          {filtered
            ? `No matching ${ar ? 'invoices' : 'bills'}`
            : ar
              ? 'Your Sales and POS invoices will appear here'
              : 'No open vendor bills'}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
          {filtered
            ? 'Try a different search or clear your filters.'
            : ar
              ? 'Saved invoices from fulfilled or paid Sales orders and completed POS receipts appear here. Paid invoices remain in your history.'
              : 'Confirmed bills with an outstanding balance appear here.'}
        </p>
        {filtered && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="mt-5 min-h-10 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-brand"
          >
            Clear filters
          </button>
        ) : ar ? (
          <Link
            href={routes.accounting.invoiceCreate}
            className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-xs font-semibold text-white"
          >
            Create invoice
          </Link>
        ) : (
          <Link
            href="/purchases"
            className="mt-5 inline-flex min-h-10 items-center text-xs font-semibold text-brand"
          >
            Review purchases
          </Link>
        )}
      </div>
    );
  const blocked = disabled || loading;
  return (
    <div aria-busy={loading} className={loading ? 'opacity-60' : ''}>
      <div className="md:hidden">
        {docs.map((doc) => (
          <AccountingDocumentCard
            key={doc._id}
            doc={doc}
            side={side}
            onPay={onPay}
            disabled={blocked}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">
            {ar ? 'Customer invoices' : 'Open vendor bills'}
          </caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500">
            <tr>
              {[
                ar ? 'Invoice' : 'Bill',
                ar ? 'Customer' : 'Vendor',
                'Due date',
                'Payment status',
                'Outstanding',
                'Actions',
              ].map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={`whitespace-nowrap px-5 py-3 font-medium ${index >= 4 ? 'text-right' : ''}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <AccountingDocumentRow
                key={doc._id}
                doc={doc}
                side={side}
                onPay={onPay}
                disabled={blocked}
              />
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={4} className="px-5 py-3 text-xs text-gray-500">
                Outstanding on this page
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                {fmtMoney(
                  docs.reduce(
                    (total, doc) => total + Math.round(doc.outstanding * 100),
                    0
                  ) / 100
                )}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
