import InvoiceReturnBadge from './invoice-return-badge';
import Link from 'next/link';
import type { PaymentSide, OpenInvoice } from '@/services/arAp.service';
import InvoicePaymentBadge from './invoice-payment-badge';
import { documentView, type AccountingDocument } from './accounting-documents';
import { fmtDate, fmtMoney } from './accounting-helpers';
import {
  DocumentDue,
  DocumentStatus,
  ReceiptButton,
} from './accounting-document-row';

export default function AccountingDocumentCard({
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
    <article className="border-b border-gray-200 p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={view.href}
            className="break-words text-sm font-semibold text-gray-900 hover:text-brand"
          >
            {view.label}
          </Link>
          <p className="mt-1 break-words text-xs text-gray-500">{view.name}</p>
        </div>
        {side === 'customer' ? (
          <InvoicePaymentBadge invoice={doc as OpenInvoice} />
        ) : (
          <DocumentStatus status={view.status} />
        )}
      </div>
      {side === 'customer' && (
        <div className="mt-2">
          <InvoiceReturnBadge invoice={doc as OpenInvoice} />
        </div>
      )}
      <div className="my-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-gray-500">Outstanding</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
            {fmtMoney(doc.outstanding)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Total {fmtMoney(view.total)}
          </p>
        </div>
        <DocumentDue doc={doc} />
      </div>
      <p className="mb-3 text-[11px] text-gray-500">
        {view.sourceLabel && `${view.sourceLabel} · `}
        {(doc as OpenInvoice).state === 'draft' ? 'Draft' : 'Issued'}{' '}
        {fmtDate(doc.date)} · Paid {fmtMoney(view.paid)}
        {view.credited > 0 ? ` · Credit ${fmtMoney(view.credited)}` : ''}
      </p>
      <ReceiptButton {...{ side, doc, onPay, disabled }} />
    </article>
  );
}
