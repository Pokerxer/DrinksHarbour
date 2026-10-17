'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import InvoiceReturnPanel from './invoice-return-panel';
import CreditNoteFormModal from './credit-note-form-modal';
import SavedInvoiceDocument from './saved-invoice-document';
import PaymentFormModal from './payment-form-modal';
import AccountingNavHeader from './accounting-nav-header';
import InvoiceDetailHeader, { invoiceButton } from './invoice-detail-header';
import InvoiceDetailSummary from './invoice-detail-summary';
import InvoiceDetailHistory from './invoice-detail-history';
import { useSavedInvoice } from './use-saved-invoice';
import { printCustomerInvoice } from '@/utils/print/customer-invoice';
function InvoiceWorkspace({ token, id }: { token: string; id: string }) {
  const state = useSavedInvoice(token, id);
  const [credit, setCredit] = useState(false);
  const [payment, setPayment] = useState(false);
  const [printError, setPrintError] = useState('');
  const { invoice } = state;
  const print = () => {
    setPrintError('');
    try {
      if (invoice) printCustomerInvoice(invoice);
    } catch {
      setPrintError('Printing could not start. Try Print invoice again.');
    }
  };
  return (
    <div className="min-h-screen min-w-0 bg-gray-50">
      <div className="print:hidden">
        <AccountingNavHeader />
      </div>
      <main className="mx-auto max-w-screen-xl space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        {state.loading ? (
          <div role="status" className="space-y-4 p-6">
            <p className="text-sm text-gray-500">Loading invoice…</p>
            <div className="h-72 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none" />
          </div>
        ) : !invoice ? (
          <div
            role="alert"
            className="rounded-xl border border-red-100 bg-white p-6"
          >
            <h1 className="font-lexend text-lg font-semibold">
              Invoice could not load
            </h1>
            <p className="my-3 text-sm text-brand">{state.error}</p>
            <button className={invoiceButton} onClick={state.refresh}>
              Retry
            </button>
            <Link
              href="/accounting/invoices"
              className="ml-4 text-xs text-gray-600"
            >
              Customer invoices
            </Link>
          </div>
        ) : (
          <>
            <InvoiceDetailHeader
              invoice={invoice}
              busy={state.reconciling}
              onRefresh={state.refresh}
              onReconcile={state.reconcile}
              onPrint={print}
              onPay={() => setPayment(true)}
            />
            {invoice.reconciliationIssue && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden"
              >
                <p className="font-semibold">
                  {invoice.state === 'draft'
                    ? 'Draft — review before posting'
                    : 'Needs reconciliation'}
                </p>
                <p className="mt-1">{invoice.reconciliationIssue}</p>
                <p className="mt-2 text-xs">
                  Review the source accounting entries, then select Reconcile.
                  Refresh reloads the saved invoice.
                </p>
              </div>
            )}
            {(state.actionError || printError) && (
              <p
                role="alert"
                className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-brand print:hidden"
              >
                {state.actionError || printError}
              </p>
            )}
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px] print:block">
              <SavedInvoiceDocument invoice={invoice} />
              <InvoiceDetailSummary invoice={invoice} />
            </div>
            <InvoiceReturnPanel
              invoice={invoice}
              busy={state.reconciling}
              onCredit={() => setCredit(true)}
            />
            <InvoiceDetailHistory invoice={invoice} />
            {credit && (
              <CreditNoteFormModal
                invoices={[invoice]}
                initialInvoice={invoice}
                onClose={() => setCredit(false)}
                onSaved={() => {
                  setCredit(false);
                  state.refresh();
                }}
              />
            )}
            {payment && (
              <PaymentFormModal
                side="customer"
                initialDocument={invoice}
                onClose={() => setPayment(false)}
                onSaved={() => {
                  setPayment(false);
                  state.refresh();
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
export default function SavedInvoiceView({ id }: { id: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  if (status === 'loading')
    return (
      <p role="status" className="p-6 text-sm text-gray-500">
        Loading account…
      </p>
    );
  if (!token)
    return (
      <p className="p-6 text-sm text-gray-500">Sign in to view this invoice.</p>
    );
  return <InvoiceWorkspace key={`${token}:${id}`} token={token} id={id} />;
}
