import InvoiceReturnBadge from './invoice-return-badge';
import Link from 'next/link';
import type { OpenInvoice, PaymentSide } from '@/services/arAp.service';
import {
  documentDue,
  documentStatus,
  documentView,
  type AccountingDocument,
} from './accounting-documents';
import { fmtDate, fmtMoney } from './accounting-helpers';
import { routes } from '@/config/routes';
import InvoicePaymentBadge from './invoice-payment-badge';
import PaymentStatusBadge from './payment-status-badge';

export function DocumentStatus({ status }: { status: string }) {
  if (['paid', 'partial', 'unpaid'].includes(status))
    return <PaymentStatusBadge status={status} />;
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${status === 'paid' ? 'bg-emerald-50 text-emerald-800' : status === 'partial' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}
    >
      {documentStatus(status)}
    </span>
  );
}
export function DocumentDue({ doc }: { doc: AccountingDocument }) {
  if ((doc as OpenInvoice).state === 'cancelled')
    return <p className="text-xs font-medium text-gray-500">No payment due</p>;
  const due = documentDue(doc);
  if (due.label === 'Settled')
    return <p className="text-xs font-medium text-emerald-700">Settled</p>;
  return (
    <div className={`text-xs ${due.overdue ? 'text-brand' : 'text-gray-600'}`}>
      <p className="whitespace-nowrap font-medium">
        {due.label === 'Not set' ? 'Not set' : fmtDate(doc.dueDate)}
      </p>
      {due.label !== 'Not set' && (
        <p className="mt-1 whitespace-nowrap text-[11px]">{due.label}</p>
      )}
    </div>
  );
}
export function ReceiptButton({
  side,
  doc,
  onPay,
  disabled = false,
}: {
  side: PaymentSide;
  doc: AccountingDocument;
  onPay: (doc: AccountingDocument) => void;
  disabled?: boolean;
}) {
  const invoice = doc as OpenInvoice;
  if (
    side === 'customer' &&
    invoice.persisted &&
    (invoice.state !== 'posted' || invoice.reconciliationIssue)
  )
    return (
      <Link
        href={`/accounting/invoices/${doc._id}`}
        className="text-xs font-semibold text-brand hover:underline"
      >
        Review invoice
      </Link>
    );
  if (
    side === 'customer' &&
    (doc as OpenInvoice).source === 'pos' &&
    doc.outstanding > 0
  )
    return (
      <div className="text-xs text-gray-500">
        <p>Outstanding POS balance</p>
        <Link
          href={routes.pos.sell}
          className="mt-1 inline-block font-semibold text-brand hover:underline"
        >
          Manage account in POS
        </Link>
      </div>
    );
  return (
    <button
      type="button"
      disabled={disabled || doc.outstanding <= 0}
      onClick={() => onPay(doc)}
      className="min-h-10 whitespace-nowrap rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-brand hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
    >
      {side === 'customer' ? 'Record receipt' : 'Record payment'}
    </button>
  );
}
export default function AccountingDocumentRow({
  doc,
  side,
  onPay,
  disabled,
}: {
  doc: AccountingDocument;
  side: PaymentSide;
  onPay: (doc: AccountingDocument) => void;
  disabled?: boolean;
}) {
  const view = documentView(doc, side);
  return (
    <tr className="hover:bg-gray-50/70">
      <td className="px-5 py-4">
        <Link
          href={view.href}
          className="font-semibold text-gray-900 hover:text-brand hover:underline"
        >
          {view.label}
        </Link>
        <p className="mt-1 text-[11px] text-gray-500">
          {view.sourceLabel && `${view.sourceLabel} · `}
          {(doc as OpenInvoice).state === 'draft' ? 'Draft' : 'Issued'}{' '}
          {fmtDate(doc.date)}
        </p>
        {side === 'customer' && (
          <div className="mt-2">
            <InvoiceReturnBadge invoice={doc as OpenInvoice} />
          </div>
        )}
        {(doc as OpenInvoice).reconciliationIssue && (
          <p className="mt-1 max-w-60 text-[11px] text-amber-700">
            Needs reconciliation
          </p>
        )}
      </td>
      <td className="max-w-52 break-words px-4 py-4 text-sm text-gray-700">
        {view.name}
      </td>
      <td className="px-4 py-4">
        <DocumentDue doc={doc} />
      </td>
      <td className="px-4 py-4">
        {side === 'customer' ? (
          <InvoicePaymentBadge invoice={doc as OpenInvoice} />
        ) : (
          <DocumentStatus status={view.status} />
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
        <p className="text-sm font-semibold text-gray-900">
          {fmtMoney(doc.outstanding)}
        </p>
        <p className="mt-1 text-[11px] text-gray-500">
          of {fmtMoney(view.total)}
        </p>
        {(view.paid > 0 || view.credited > 0) && (
          <p className="mt-1 text-[11px] text-gray-500">
            Paid {fmtMoney(view.paid)}
            {view.credited > 0 ? ` · Credit ${fmtMoney(view.credited)}` : ''}
          </p>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <ReceiptButton {...{ side, doc, onPay, disabled }} />
      </td>
    </tr>
  );
}
