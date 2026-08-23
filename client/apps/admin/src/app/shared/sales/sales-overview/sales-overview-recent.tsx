// The recent-documents feed on the /sales Overview page.
//
// One table interleaving orders and quotations, newest first — the fastest
// answer to "what just happened in sales?". Status and payment pills come from
// sales-list-status so a cancelled order cannot masquerade as a live one here
// either. Presentational only.

'use client';

import Link from 'next/link';
import { PiFileText } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '@/app/shared/purchases/purchases-analytics-helpers';
import {
  docStatusBadge,
  paymentBadge,
  TONE_CLASS,
} from '../sales-list-status';
import { relTime } from './sales-overview-helpers';

function DocTypePill({ doc }: { doc: SalesOrder }) {
  const isQuote = doc.docType === 'quotation';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isQuote ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
      }`}
    >
      {isQuote ? 'Quotation' : 'Order'}
    </span>
  );
}

export default function SalesOverviewRecent({
  docs,
  now = new Date(),
}: {
  docs: SalesOrder[];
  now?: Date;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-gray-900">
          Recent documents
        </h2>
        <Link
          href={routes.eCommerce.salesOrders}
          className="text-xs font-medium text-brand hover:text-brand-dark"
        >
          View all
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <PiFileText className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-600">
            No documents yet
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Create your first quotation or sale to see it here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((doc) => {
            const status = docStatusBadge(doc);
            const pay = paymentBadge(doc);
            return (
              <li key={doc._id}>
                <Link
                  href={routes.eCommerce.salesDetails(doc._id)}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <span className="w-40 shrink-0 truncate font-mono text-sm font-semibold text-brand">
                    {doc.soNumber}
                  </span>
                  <DocTypePill doc={doc} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                    {doc.customerSnapshot?.name || '—'}
                  </span>
                  <span
                    className={`hidden shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold sm:inline-flex ${TONE_CLASS[status.tone]}`}
                  >
                    {status.label}
                  </span>
                  <span
                    className={`hidden w-[68px] shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold md:inline-flex ${TONE_CLASS[pay.tone]}`}
                  >
                    {pay.label}
                  </span>
                  <span className="w-28 shrink-0 text-right text-sm font-semibold text-gray-900 tabular-nums">
                    {fmtCur(doc.total, doc.currency)}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-gray-400">
                    {relTime(doc.createdAt, now)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
