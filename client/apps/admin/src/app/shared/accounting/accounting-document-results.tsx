'use client';
import Link from 'next/link';
import type { PaymentSide } from '@/services/arAp.service';
import { type AccountingDocument, documentView } from './accounting-documents';
import { fmtDate, fmtMoney } from './accounting-helpers';

export default function AccountingDocumentResults({
  docs,
  side,
  loading,
  onPay,
}: {
  docs: AccountingDocument[];
  side: PaymentSide;
  loading: boolean;
  onPay: (doc: AccountingDocument) => void;
}) {
  if (loading)
    return (
      <div role="status" className="space-y-3 rounded-2xl border bg-white p-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
        <span className="sr-only">Loading documents</span>
      </div>
    );
  if (!docs.length)
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <h2 className="font-semibold text-gray-800">
          No matching open documents
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Try clearing your filters or check the source sales and purchases.
        </p>
      </div>
    );
  return (
    <>
      <div className="space-y-3 md:hidden">
        {docs.map((doc) => {
          const view = documentView(doc, side);
          return (
            <article
              key={doc._id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={view.href}
                    className="break-words text-sm font-semibold text-brand underline-offset-4 hover:underline"
                  >
                    {view.label} ↗
                  </Link>
                  <p className="mt-1 break-words text-sm text-gray-600">
                    {view.name}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs capitalize text-amber-800">
                  {view.status}
                </span>
              </div>
              <dl className="my-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-gray-500">Outstanding</dt>
                  <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                    {fmtMoney(doc.outstanding)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Due date</dt>
                  <dd className="mt-1 font-medium">
                    {doc.dueDate ? fmtDate(doc.dueDate) : 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Paid / credited</dt>
                  <dd>
                    {fmtMoney(view.paid)} / {fmtMoney(view.credited)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Total</dt>
                  <dd>{fmtMoney(view.total)}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => onPay(doc)}
                className="min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white"
              >
                {side === 'customer' ? 'Record receipt' : 'Record payment'}
              </button>
            </article>
          );
        })}
      </div>
      <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">
            Open {side === 'customer' ? 'customer invoices' : 'vendor bills'}
          </caption>
          <thead className="border-b bg-gray-50 text-xs text-gray-500">
            <tr>
              {[
                'Document',
                side === 'customer' ? 'Customer' : 'Vendor',
                'Due',
                'Total',
                'Paid / credits',
                'Outstanding',
                '',
              ].map((label, index) => (
                <th
                  key={index}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.map((doc) => {
              const view = documentView(doc, side);
              return (
                <tr key={doc._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <Link
                      href={view.href}
                      className="font-semibold text-brand hover:underline"
                    >
                      {view.label} ↗
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">
                      {fmtDate(doc.date)}
                    </p>
                  </td>
                  <td className="max-w-52 break-words px-4 py-4">
                    {view.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs">
                    {doc.dueDate ? fmtDate(doc.dueDate) : 'Not set'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                    {fmtMoney(view.total)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums">
                    {fmtMoney(view.paid)}
                    <p className="text-gray-500">
                      {fmtMoney(view.credited)} credited
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">
                    {fmtMoney(doc.outstanding)}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onPay(doc)}
                      className="min-h-10 whitespace-nowrap rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-brand hover:bg-red-100"
                    >
                      {side === 'customer'
                        ? 'Record receipt'
                        : 'Record payment'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
