'use client';
import { useState } from 'react';
import { PiDownloadSimple } from 'react-icons/pi';
import type { PaymentSide } from '@/services/arAp.service';
import {
  documentCsv,
  documentPageLabel,
  type AccountingDocument,
} from './accounting-documents';
import { useAccountingDocuments } from './use-accounting-documents';
import AccountingDocumentResults from './accounting-document-results';
import AccountingDocumentSummary from './accounting-document-summary';
import AccountingDocumentFilters from './accounting-document-filters';
import PaymentFormModal from './payment-form-modal';

const button =
  'min-h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40';
export default function ArApDocsView({ side }: { side: PaymentSide }) {
  const state = useAccountingDocuments(side);
  const [paymentDoc, setPaymentDoc] = useState<AccountingDocument | null>(null);
  const ar = side === 'customer';
  const pending = state.loading || state.searchPending;
  const exportPage = () => {
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', documentCsv(state.docs, side)], {
        type: 'text/csv;charset=utf-8;',
      })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${ar ? 'invoices' : 'open-bills'}-page-${state.page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  if (state.authLoading)
    return (
      <p role="status" className="py-10 text-sm text-gray-500">
        Loading your accounting workspace…
      </p>
    );
  if (!state.authenticated)
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        Sign in to view {ar ? 'customer invoices' : 'vendor bills'}.
      </p>
    );
  return (
    <div className="min-w-0 space-y-5">
      <AccountingDocumentSummary
        summary={state.summary}
        side={side}
        loading={state.summaryLoading}
        error={state.summaryError}
        onRetry={state.reloadSummary}
        onReview={() => {
          state.clearFilters();
          state.updateFilter('status', 'draft');
        }}
      />
      <section
        aria-label={ar ? 'Open invoices' : 'Open bills'}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-lexend text-sm font-semibold text-gray-900">
              {ar ? 'Invoice ledger' : 'Bill ledger'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {ar
                ? 'Sales and POS invoices · paid, partially paid and unpaid'
                : 'Open bills only'}{' '}
              · balances above cover {ar ? 'open receivables' : 'open payables'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportPage}
            disabled={pending || !!state.error || !state.docs.length}
            className={`${button} flex items-center gap-2`}
            title="Export the displayed page only"
          >
            <PiDownloadSimple aria-hidden />
            Export page
          </button>
        </div>
        <AccountingDocumentFilters
          side={side}
          filters={state.filters}
          update={state.updateFilter}
          onClear={state.clearFilters}
          onRefresh={state.refresh}
          refreshing={state.loading || state.summaryLoading}
        />
        {ar && (
          <p className="px-5 text-xs text-gray-500">
            POS account repayments settle the oldest outstanding receipt first.
          </p>
        )}
        {state.error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 p-4 text-xs text-red-800"
          >
            <p>
              {state.docs.length
                ? 'Documents could not refresh. Previous results are shown. '
                : 'Could not load documents. '}
              {state.error}
            </p>
            <button
              type="button"
              disabled={state.loading}
              onClick={state.reloadList}
              className={button}
            >
              Try again
            </button>
          </div>
        )}
        {pending && state.docs.length > 0 && (
          <p role="status" className="border-b px-5 py-2 text-xs text-gray-500">
            Updating results…
          </p>
        )}
        {(!state.error || state.docs.length > 0) && (
          <AccountingDocumentResults
            docs={state.docs}
            side={side}
            loading={pending}
            onPay={setPaymentDoc}
            filtered={state.filtered}
            onClear={state.clearFilters}
            disabled={!!state.error}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-xs sm:px-5">
          <span className="text-gray-500">
            {state.error
              ? 'Results unavailable'
              : documentPageLabel(
                  state.page,
                  25,
                  state.docs.length,
                  state.total,
                  side
                )}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-gray-500">
              Page {state.page} of {state.pages}
            </span>
            <button
              type="button"
              className={button}
              disabled={pending || !!state.error || state.page <= 1}
              onClick={() => state.setPage(state.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={button}
              disabled={pending || !!state.error || state.page >= state.pages}
              onClick={() => state.setPage(state.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {paymentDoc && (
        <PaymentFormModal
          side={side}
          initialDocument={paymentDoc}
          onClose={() => setPaymentDoc(null)}
          onSaved={state.refresh}
        />
      )}
    </div>
  );
}
