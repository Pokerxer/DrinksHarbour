'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { BatchPayment, PaymentSide } from '@/services/arAp.service';
import { useBatchWorkspace } from './use-batch-workspace';
import BatchWorkspaceToolbar from './batch-workspace-toolbar';
import BatchWorkspaceResults from './batch-workspace-results';
import BatchDetailModal from './batch-detail-modal';
import BatchReviewModal from './batch-review-modal';
import BatchFormModal from './batch-form-modal';
function Workspace({ token, side }: { token: string; side: PaymentSide }) {
  const state = useBatchWorkspace(token, side);
  const [form, setForm] = useState(false),
    [focus, setFocus] = useState<{
      batch: BatchPayment;
      action?: 'deposit' | 'cancel';
    } | null>(null);
  return (
    <div className="space-y-4">
      <BatchWorkspaceToolbar
        filters={state.filters}
        update={state.update}
        summary={state.summary}
        loading={state.loading}
        busy={state.busy}
        refresh={() => {
          void state.load();
        }}
        create={() => setForm(true)}
      />
      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Batches could not load: {state.error}
          <button
            type="button"
            aria-label="Retry batches"
            onClick={() => {
              void state.load();
            }}
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      ) : state.loading ? (
        <p
          role="status"
          className="rounded-xl border p-10 text-center text-sm text-gray-500"
        >
          Loading batches…
        </p>
      ) : (
        <BatchWorkspaceResults
          batches={state.batches}
          busy={state.busy}
          blocked={state.mustRefresh}
          open={(batch, action) => setFocus({ batch, action })}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <span>
          {state.loading || state.error
            ? '—'
            : `${state.total} matching batches`}
        </span>
        <nav aria-label="Batch pages" className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous page"
            disabled={state.loading || !!state.error || state.page <= 1}
            onClick={() => state.setPage(state.page - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {state.page} of {state.pages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={
              state.loading || !!state.error || state.page >= state.pages
            }
            onClick={() => state.setPage(state.page + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      </div>
      {form && (
        <BatchFormModal
          side={side}
          onClose={() => setForm(false)}
          onSaved={() => {
            void state.load();
          }}
        />
      )}
      {focus?.action ? (
        <BatchReviewModal
          batch={focus.batch}
          action={focus.action}
          busy={state.busy}
          blocked={state.mustRefresh || !!state.error || state.loading}
          close={() => setFocus(null)}
          refresh={() => {
            void state.load();
            setFocus(null);
          }}
          confirm={async () => {
            if (await state.act(focus.batch, focus.action!)) setFocus(null);
          }}
        />
      ) : (
        focus && (
          <BatchDetailModal batch={focus.batch} close={() => setFocus(null)} />
        )
      )}
    </div>
  );
}
export default function BatchPaymentsView() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const params = useSearchParams(),
    urlSide = params.get('side') === 'vendor' ? 'vendor' : 'customer';
  const [side, setSide] = useState<PaymentSide>(urlSide);
  useEffect(() => {
    setSide(urlSide);
  }, [urlSide]);
  if (status === 'loading')
    return <p role="status">Loading your accounting workspace…</p>;
  if (!token)
    return (
      <p role="alert" className="rounded-xl border p-5 text-sm">
        Sign in to view payment batches.
      </p>
    );
  return (
    <div className="min-w-0 space-y-4">
      <div
        role="group"
        aria-label="Batch direction"
        className="inline-flex gap-1 rounded-lg border bg-white p-1"
      >
        {(['customer', 'vendor'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={side === value}
            onClick={() => {
              setSide(value);
              const url = new URL(window.location.href);
              url.searchParams.set('side', value);
              window.history.replaceState(null, '', url.toString());
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium ${side === value ? 'bg-gray-900 text-white' : 'text-gray-600'}`}
          >
            {value === 'customer' ? 'Customer receipts' : 'Vendor payments'}
          </button>
        ))}
      </div>
      <Workspace key={`${token}:${side}`} token={token} side={side} />
    </div>
  );
}
