import Link from 'next/link';
import type { SavedInvoice } from '@/services/arAp.service';
import { invoiceActions } from './invoice-detail-helpers';
export const invoiceButton =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50';
export default function InvoiceDetailHeader({
  invoice,
  busy,
  onRefresh,
  onReconcile,
  onPrint,
  onPay,
}: {
  invoice: SavedInvoice;
  busy: boolean;
  onRefresh: () => void;
  onReconcile: () => void;
  onPrint: () => void;
  onPay: () => void;
}) {
  const { canReceive, canEdit } = invoiceActions(invoice);
  return (
    <header className="space-y-4 print:hidden">
      <Link
        href="/accounting/invoices"
        className="text-xs font-medium text-gray-500 hover:text-brand"
      >
        ← Customer invoices
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-lexend text-xl font-semibold text-gray-900">
            Customer invoice
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Review the saved document and its payment activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link
              href={`/accounting/invoices/create?draft=${invoice.sourceId}`}
              className={invoiceButton}
            >
              Edit draft / Issue
            </Link>
          )}
          {canReceive &&
            (invoice.source === 'sales' ? (
              <button
                disabled={busy}
                onClick={onPay}
                className={`${invoiceButton} !border-brand !bg-brand !text-white`}
              >
                Record receipt
              </button>
            ) : (
              <Link href="/point-of-sale/sell" className={invoiceButton}>
                Manage account in POS
              </Link>
            ))}
          <button disabled={busy} onClick={onRefresh} className={invoiceButton}>
            Refresh
          </button>
          <button
            disabled={busy}
            onClick={onReconcile}
            className={invoiceButton}
          >
            {busy ? 'Reconciling…' : 'Reconcile'}
          </button>
          <button disabled={busy} onClick={onPrint} className={invoiceButton}>
            Print invoice
          </button>
        </div>
      </div>
    </header>
  );
}
