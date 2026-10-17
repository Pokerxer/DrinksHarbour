import Link from 'next/link';
import type { BatchPayment } from '@/services/arAp.service';
import { fmtDate, fmtMoney } from './accounting-helpers';
import BatchDialog from './batch-dialog';
import { batchAccountName } from './batch-workspace-toolbar';
export default function BatchDetailModal({
  batch,
  close,
}: {
  batch: BatchPayment;
  close: () => void;
}) {
  return (
    <BatchDialog title="Batch details" busy={false} close={close}>
      <p className="mt-2 text-sm text-gray-500">
        {batch.number} · {batchAccountName(batch.account)} ·{' '}
        {fmtMoney(batch.total)}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {fmtDate(batch.date)}
        {batch.depositedAt ? ` · Completed ${fmtDate(batch.depositedAt)}` : ''}
      </p>
      <p className="my-4 text-xs text-gray-500">
        Amounts below are the retained batch selection. Original payment entries
        remain in their source records.
      </p>
      {batch.needsReview && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          {batch.reviewReason}
        </p>
      )}
      {!batch.members?.length ? (
        <p className="py-5 text-sm text-gray-500">
          Member history is unavailable for this legacy batch. The original
          stored total is retained.
        </p>
      ) : (
        <ul className="divide-y">
          {batch.members.map((member) => (
            <li key={member.key} className="space-y-2 py-4 text-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{member.number}</p>
                  <p className="text-xs text-gray-500">
                    {member.name} ·{' '}
                    {member.origin === 'pos'
                      ? 'POS'
                      : member.origin === 'sales'
                        ? 'Sales'
                        : 'Accounting'}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {fmtMoney(member.amount)}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Captured {fmtMoney(member.capturedAmount)} · Verified refunds{' '}
                {fmtMoney(member.refundedAmount)} ·{' '}
                {batchAccountName(member.account)}
              </p>
              {member.invoice && (
                <Link
                  href={member.invoice.href}
                  className="block text-xs underline"
                >
                  {member.invoice.label}
                </Link>
              )}
              {member.sourceHref && (
                <Link
                  href={member.sourceHref}
                  className="block text-xs underline"
                >
                  Open original receipt
                </Link>
              )}
              {member.allocations?.map(
                (allocation, index) =>
                  allocation.document && (
                    <Link
                      key={index}
                      href={allocation.document.href}
                      className="block text-xs underline"
                    >
                      {allocation.document.label} ·{' '}
                      {fmtMoney(allocation.amount)}
                    </Link>
                  )
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={close}
        className="mt-4 rounded-lg border px-4 py-2 text-sm"
      >
        Close
      </button>
    </BatchDialog>
  );
}
