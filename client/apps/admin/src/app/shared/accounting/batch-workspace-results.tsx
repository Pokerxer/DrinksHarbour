import type { BatchPayment } from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import { batchAccountName } from './batch-workspace-toolbar';
export default function BatchWorkspaceResults({
  batches,
  busy,
  blocked,
  open,
}: {
  batches: BatchPayment[];
  busy: boolean;
  blocked: boolean;
  open: (batch: BatchPayment, action?: 'deposit' | 'cancel') => void;
}) {
  if (!batches.length)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No matching batches</p>
        <p className="mt-2 text-sm text-gray-500">
          Create a batch from eligible recorded payments or adjust your filters.
        </p>
      </div>
    );
  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <article key={batch._id} className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="break-all text-sm font-semibold">
                {batch.number}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {fmtDate(batch.date)} · {batchAccountName(batch.account)} ·{' '}
                {batch.historyAvailable === false
                  ? 'Member history unavailable'
                  : `${batch.members?.length ?? batch.payments?.length ?? 0} members`}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${batch.status === 'open' ? 'bg-amber-50 text-amber-800' : batch.status === 'deposited' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}
              >
                {batch.status === 'deposited'
                  ? 'Completed'
                  : batch.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Open'}
              </span>
              <p className="mt-3 text-lg font-semibold tabular-nums">
                {fmtMoney(batch.total)}
              </p>
            </div>
          </div>
          {batch.needsReview && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {batch.reviewReason ||
                'Source records changed; review before completion.'}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => open(batch)}
              className="rounded-lg border px-3 py-2 text-xs font-medium"
            >
              Details
            </button>
            {batch.status === 'open' && (
              <>
                <button
                  type="button"
                  disabled={busy || blocked || batch.needsReview}
                  onClick={() => open(batch, 'deposit')}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  Review completion
                </button>
                <button
                  type="button"
                  disabled={busy || blocked}
                  onClick={() => open(batch, 'cancel')}
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
                >
                  Review cancellation
                </button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
