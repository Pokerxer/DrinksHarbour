import type { BatchPayment } from '@/services/arAp.service';
import BatchDialog from './batch-dialog';
import { batchAccountName } from './batch-workspace-toolbar';
import { fmtMoney } from './accounting-helpers';
export default function BatchReviewModal({
  batch,
  action,
  busy,
  blocked,
  close,
  confirm,
  refresh,
}: {
  batch: BatchPayment;
  action: 'deposit' | 'cancel';
  busy: boolean;
  blocked: boolean;
  close: () => void;
  confirm: () => void;
  refresh: () => void;
}) {
  const completion = action === 'deposit';
  return (
    <BatchDialog
      title={
        completion ? 'Review batch completion' : 'Review batch cancellation'
      }
      busy={busy}
      close={close}
    >
      <p className="mt-3 text-sm font-medium">
        {batch.number} · {batchAccountName(batch.account)} ·{' '}
        {fmtMoney(batch.total)}
      </p>
      <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
        {completion
          ? 'Record this batch as reconciled. This does not transfer money, change wallet balances or post another payment journal. Current source evidence will be checked before completion.'
          : 'Release this batch’s payment portions for another batch. Original payments remain posted, and this batch retains its member history. No money is reversed or refunded.'}
      </p>
      {blocked && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          Refresh batches to check the result before trying again.
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="ml-2 underline"
          >
            Refresh batches
          </button>
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={close}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Go back
        </button>
        <button
          type="button"
          disabled={busy || blocked}
          onClick={confirm}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy
            ? 'Saving…'
            : completion
              ? 'Confirm completion'
              : 'Confirm cancellation'}
        </button>
      </div>
    </BatchDialog>
  );
}
