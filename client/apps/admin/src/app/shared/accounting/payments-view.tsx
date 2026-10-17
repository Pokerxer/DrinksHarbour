'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { PaymentDoc, PaymentSide } from '@/services/arAp.service';
import PaymentFormModal from './payment-form-modal';
import PaymentsWorkspaceToolbar from './payments-workspace-toolbar';
import PaymentsWorkspaceResults from './payments-workspace-results';
import PaymentWorkspaceDetail from './payment-workspace-detail';
import { usePaymentsWorkspace } from './use-payments-workspace';
function Workspace({ token, side }: { token: string; side: PaymentSide }) {
  const state = usePaymentsWorkspace(token, side);
  const [form, setForm] = useState(false);
  const [detail, setDetail] = useState<{
    payment: PaymentDoc;
    cancel?: boolean;
  } | null>(null);
  return (
    <div className="space-y-4">
      <PaymentsWorkspaceToolbar
        token={token}
        side={side}
        filters={state.filters}
        filter={state.filter}
        summary={state.summary}
        loading={state.loading}
        unavailable={!!state.error || !token}
        refresh={() => {
          void state.load();
        }}
        create={() => setForm(true)}
      />
      {!token ? (
        <p
          role="status"
          className="rounded-xl border p-6 text-sm text-gray-500"
        >
          Sign in to view accounting payments.
        </p>
      ) : state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          <p>Payments could not load: {state.error}</p>
          <button
            type="button"
            aria-label="Retry payments"
            onClick={() => {
              void state.load();
            }}
            className="mt-3 font-medium underline"
          >
            Retry
          </button>
        </div>
      ) : state.loading ? (
        <p
          role="status"
          className="rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500"
        >
          Loading {side === 'customer' ? 'receipts' : 'payments'}…
        </p>
      ) : (
        <PaymentsWorkspaceResults
          side={side}
          payments={state.payments}
          busy={state.busy}
          details={(payment, cancel) => setDetail({ payment, cancel })}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <span>
          {state.loading || state.error
            ? '—'
            : `${state.total} matching records`}
        </span>
        <nav aria-label="Payment pages" className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous page"
            disabled={state.loading || !!state.error || state.page <= 1}
            onClick={() => state.setPage((p) => p - 1)}
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
            onClick={() => state.setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      </div>
      {form && (
        <PaymentFormModal
          side={side}
          onClose={() => setForm(false)}
          onSaved={() => {
            void state.load();
          }}
        />
      )}
      {detail && (
        <PaymentWorkspaceDetail
          payment={detail.payment}
          side={side}
          cancel={detail.cancel}
          busy={state.busy}
          close={() => setDetail(null)}
          confirm={async () => {
            if (await state.cancel(detail.payment)) setDetail(null);
          }}
        />
      )}
    </div>
  );
}
export default function PaymentsView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const params = useSearchParams();
  const urlSide = params.get('side') === 'vendor' ? 'vendor' : 'customer';
  const [side, setSide] = useState<PaymentSide>(urlSide);
  useEffect(() => {
    setSide(urlSide);
  }, [urlSide]);
  const switchSide = (next: PaymentSide) => {
    setSide(next);
    const url = new URL(window.location.href);
    url.searchParams.set('side', next);
    window.history.replaceState(null, '', url.toString());
  };
  return (
    <div className="min-w-0 space-y-4">
      <div
        role="group"
        aria-label="Payment direction"
        className="inline-flex gap-1 rounded-lg border border-gray-200 bg-white p-1"
      >
        {(['customer', 'vendor'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={side === value}
            onClick={() => switchSide(value)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${side === value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {value === 'customer' ? 'Customer receipts' : 'Vendor payments'}
          </button>
        ))}
      </div>
      <Workspace key={`${token}:${side}`} token={token} side={side} />
    </div>
  );
}
