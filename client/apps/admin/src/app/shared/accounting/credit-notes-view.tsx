'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import type { CreditNote } from '@/services/arAp.service';
import { useCreditNotes } from './use-credit-notes';
import CreditNotesToolbar from './credit-notes-toolbar';
import CreditNotesResults from './credit-notes-results';
import CreditNoteDetail from './credit-note-detail';
import CreditWorkspaceForm from './credit-workspace-form';
import CreditWorkspaceApply from './credit-workspace-apply';
function Workspace({ token }: { token: string }) {
  const state = useCreditNotes(token);
  const [form, setForm] = useState(false);
  const [apply, setApply] = useState<CreditNote | null>(null);
  const [review, setReview] = useState<{
    note: CreditNote;
    action?: 'post' | 'cancel';
  } | null>(null);
  return (
    <div className="space-y-4">
      <CreditNotesToolbar
        filters={state.filters}
        filter={state.filter}
        summary={state.summary}
        loading={state.loading}
        onRefresh={() => {
          void state.load();
        }}
        onCreate={() => setForm(true)}
      />
      {!token ? (
        <p
          role="status"
          className="rounded-xl border p-6 text-sm text-gray-500"
        >
          Sign in to view customer credit notes.
        </p>
      ) : state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          <p>Credit notes could not load: {state.error}</p>
          <button
            type="button"
            aria-label="Retry credit notes"
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
          Loading credit notes…
        </p>
      ) : (
        <CreditNotesResults
          notes={state.notes}
          disabled={state.busy}
          onDetail={(note) => setReview({ note })}
          onReview={(note, action) => setReview({ note, action })}
          onApply={setApply}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <span>
          {state.loading || state.error
            ? '—'
            : `${state.total} matching credit notes`}
        </span>
        <nav aria-label="Credit note pages" className="flex items-center gap-3">
          <button
            type="button"
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
      {review && (
        <CreditNoteDetail
          note={review.note}
          action={review.action}
          busy={state.busy}
          onClose={() => setReview(null)}
          onConfirm={async () => {
            if (
              review.action &&
              (await state.mutate(review.note, review.action))
            )
              setReview(null);
          }}
        />
      )}
      {form && (
        <CreditWorkspaceForm
          token={token}
          onClose={() => setForm(false)}
          onSaved={() => {
            void state.load();
          }}
        />
      )}
      {apply && (
        <CreditWorkspaceApply
          token={token}
          note={apply}
          onClose={() => setApply(null)}
          onApplied={() => {
            void state.load();
          }}
        />
      )}
    </div>
  );
}
export default function CreditNotesView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  return <Workspace key={token} token={token} />;
}
