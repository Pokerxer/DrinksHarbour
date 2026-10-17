import type { SavedInvoice } from '@/services/arAp.service';
import { fmtDate } from './accounting-helpers';
import InvoicePaymentBadge from './invoice-payment-badge';
import {
  invoiceActions,
  invoiceMoney,
  invoiceTotals,
} from './invoice-detail-helpers';
import SavedInvoiceItems from './saved-invoice-items';
import InvoicePaymentInstructions from './invoice-payment-instructions';
export default function SavedInvoiceDocument({
  invoice,
}: {
  invoice: SavedInvoice;
}) {
  const issuer = invoice.detailContext?.issuer;
  return (
    <article
      id="saved-invoice-document"
      className="order-2 min-w-0 rounded-xl border border-gray-200 bg-white p-5 sm:p-7 xl:order-1 print:border-0 print:p-0"
    >
      <header className="flex flex-wrap justify-between gap-5 border-b border-gray-200 pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {invoice.state === 'draft'
              ? 'Draft customer invoice'
              : invoice.state === 'cancelled'
                ? 'Cancelled customer invoice'
                : 'Customer invoice'}
          </p>
          <h1 className="mt-2 break-all font-lexend text-2xl font-semibold text-gray-900">
            {invoice.number}
          </h1>
          {issuer?.name && (
            <p className="mt-3 text-sm font-semibold text-gray-700">
              {issuer.name}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {invoice.source === 'pos' ? 'POS receipt' : 'Sales order'} ·{' '}
            {invoice.sourceNumber}
          </p>
        </div>
        <div className="text-sm sm:text-right">
          <span className="inline-block rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
            {invoiceActions(invoice).state}
          </span>
          <div className="mt-2">
            <InvoicePaymentBadge invoice={invoice} />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Date {fmtDate(invoice.date)}
          </p>
          {invoice.dueDate && (
            <p className="mt-1 text-xs text-gray-500">
              Due {fmtDate(invoice.dueDate)}
            </p>
          )}
        </div>
      </header>
      <section className="py-6">
        <p className="text-[11px] font-medium text-gray-500">Bill to</p>
        <p className="mt-2 text-sm font-semibold text-gray-900">
          {invoice.customerSnapshot?.name || 'Walk-in customer'}
        </p>
        {invoice.customerSnapshot?.email && (
          <p className="mt-1 break-all text-xs text-gray-500">
            {invoice.customerSnapshot.email}
          </p>
        )}
        {invoice.customerSnapshot?.phone && (
          <p className="mt-1 text-xs text-gray-500">
            {invoice.customerSnapshot.phone}
          </p>
        )}
        {invoice.invoiceAddress && (
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {[
              invoice.invoiceAddress.street,
              invoice.invoiceAddress.city,
              invoice.invoiceAddress.state,
              invoice.invoiceAddress.country,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
      </section>
      <SavedInvoiceItems invoice={invoice} />
      <dl className="ml-auto mt-6 max-w-sm space-y-3 text-sm">
        {invoiceTotals(invoice).map(([label, amount]) => (
          <div
            key={label}
            className={`flex justify-between gap-5 ${['Total', 'Outstanding'].includes(label) ? 'border-t border-gray-200 pt-3 font-semibold text-gray-900' : 'text-gray-600'}`}
          >
            <dt>{label}</dt>
            <dd className="tabular-nums">{invoiceMoney(invoice, amount)}</dd>
          </div>
        ))}
      </dl>
      <InvoicePaymentInstructions invoice={invoice} />
      {(invoice.notes || invoice.terms) && (
        <footer className="mt-6 space-y-3 border-t border-gray-200 pt-5 text-xs leading-6 text-gray-600">
          {invoice.notes && (
            <div>
              <h2 className="font-semibold text-gray-900">Notes</h2>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <h2 className="font-semibold text-gray-900">Terms</h2>
              <p className="whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
