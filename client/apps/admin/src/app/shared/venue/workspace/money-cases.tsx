'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, Save } from 'lucide-react';
import { experienceRequest } from '@/services/venue/experience';
import {
  buttonClass,
  Chip,
  dangerButtonClass,
  fieldClass,
  hintClass,
  panelClass,
  primaryButtonClass,
  EmptyState,
  Notice,
} from './controls';

type Refund = {
  id: string;
  state: string;
  version: number;
  amountMinor: number;
  currency: string;
  reason: string;
  providerFeeResolution: string;
};
type Receipt = {
  receiptId: string;
  amountMinor: number;
  currency: string;
  appliedMinor: number;
  unappliedMinor: number;
  refundedMinor: number;
  resolution: string;
  refunds: Refund[];
};
type Queue = {
  items: Receipt[];
  next: string | null;
  providerExecutionEnabled: boolean;
};

const money = (n: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(n / 100);

const refundStateLabels: Record<string, string> = {
  pending: 'Pending provider confirmation',
  needs_review: 'Submission outcome unknown — needs review',
  review_required: 'Venue review required',
  submitting: 'Provider submission in progress',
  approved: 'Approved — awaiting execution',
  executed: 'Completed by provider',
  rejected: 'Rejected',
};

export default function MoneyCases({
  token,
  locationId,
}: {
  token: string;
  locationId: string;
}) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [amount, setAmount] = useState('');
  const [providerRefundId, setProviderRefundId] = useState('');
  const load = useCallback(
    async () =>
      setQueue(await experienceRequest<Queue>(token, `/locations/${locationId}/money-cases`)),
    [token, locationId],
  );
  useEffect(() => {
    let active = true;
    void experienceRequest<Queue>(token, `/locations/${locationId}/money-cases`)
      .then((data) => {
        if (active) setQueue(data);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Unable to load cases');
      });
    return () => {
      active = false;
    };
  }, [token, locationId]);
  async function command(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await experienceRequest(
        token,
        `/locations/${locationId}/refunds/${path}`,
        'POST',
        body,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update case');
    } finally {
      setBusy(false);
    }
  }
  const evidenceLines = evidence
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
  return (
    <section aria-label="Payment exceptions" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">
            Payment exceptions and refunds
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Provider initiation is not completed refund evidence. Verified
            receipts and served stock remain in the history.
          </p>
        </div>
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() =>
            void load().catch((e) =>
              setError(e instanceof Error ? e.message : 'Unable to refresh'),
            )
          }
        >
          <RefreshCcw aria-hidden="true" className="size-4" />
          Refresh payment cases
        </button>
      </div>
      {error && (
        <Notice
          tone="error"
          role="alert"
          action={
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() =>
                void load().catch((e) =>
                  setError(
                    e instanceof Error ? e.message : 'Unable to refresh',
                  ),
                )
              }
            >
              Retry
            </button>
          }
        >
          {error}
        </Notice>
      )}
      {!queue && !error && (
        <div className="space-y-3" role="status" aria-busy="true">
          <div className="h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-24 animate-pulse rounded-xl border border-muted bg-gray-100 dark:border-gray-700 dark:bg-gray-800" />
        </div>
      )}
      {queue && !queue.items.length && (
        <EmptyState message="No payment exceptions at this location." />
      )}
      {queue?.items.map((row) => (
        <article key={row.receiptId} className={`${panelClass} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold">Receipt {row.receiptId}</h3>
              <Chip tone="pending" label={row.resolution.replace(/_/g, ' ')} />
            </div>
          </div>
          <p className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
            Received {money(row.amountMinor, row.currency)} · Applied{' '}
            {money(row.appliedMinor)} · Unapplied {money(row.unappliedMinor)} ·
            Refunded {money(row.refundedMinor)}
          </p>
          {row.refunds.map((refund) => (
            <div
              key={refund.id}
              className="space-y-3 rounded-xl border border-muted bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  tone={
                    refund.state === 'executed'
                      ? 'ready'
                      : refund.state === 'rejected'
                        ? 'danger'
                        : 'pending'
                  }
                  label={
                    refundStateLabels[refund.state]
                      ? `${refundStateLabels[refund.state]} · ${refund.state}`
                      : refund.state
                  }
                />
              </div>
              <p className="text-sm tabular-nums">
                {refund.state} · {money(refund.amountMinor, refund.currency)} ·{' '}
                {refund.reason}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Provider fees: {refund.providerFeeResolution}
              </p>
              {refund.state === 'review_required' &&
                (approving === refund.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    Approval authorizes this refund to the guest. This cannot be
                    undone from this page.
                    <button
                      disabled={busy || !reason.trim()}
                      className={dangerButtonClass}
                      onClick={() => {
                        setApproving(null);
                        void command(`${refund.id}/approve`, {
                          expectedVersion: refund.version,
                          reason,
                        });
                      }}
                    >
                      Confirm approval
                    </button>
                    <button
                      className={buttonClass}
                      disabled={busy}
                      onClick={() => setApproving(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className={primaryButtonClass}
                    disabled={busy || !reason.trim()}
                    onClick={() => setApproving(refund.id)}
                  >
                    Approve reviewed refund
                  </button>
                ))}
              {refund.state === 'approved' &&
                queue.providerExecutionEnabled && (
                  <button
                    className={primaryButtonClass}
                    disabled={busy}
                    onClick={() => void command(`${refund.id}/execute`, {})}
                  >
                    Submit approved refund
                  </button>
                )}
              {['submitting', 'needs_review'].includes(refund.state) && (
                <button
                  disabled={
                    busy ||
                    !providerRefundId.trim() ||
                    !reason.trim() ||
                    !evidenceLines.length
                  }
                  className={buttonClass}
                  onClick={() =>
                    void command(`${refund.id}/link-evidence`, {
                      expectedVersion: refund.version,
                      providerRefundId: providerRefundId.trim(),
                      reason,
                      evidence: evidenceLines,
                    })
                  }
                >
                  Link verified provider evidence
                </button>
              )}
              {['pending', 'needs_review'].includes(refund.state) && (
                <button
                  disabled={busy}
                  className={buttonClass}
                  onClick={() => void command(`${refund.id}/reconcile`, {})}
                >
                  Check provider refund
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={busy || !amount || !reason.trim() || !evidenceLines.length}
              onClick={() =>
                void command(`receipts/${row.receiptId}`, {
                  amountMinor: Number(amount),
                  reason,
                  evidence: evidenceLines,
                })
              }
              className={buttonClass}
            >
              <Save aria-hidden="true" className="size-4" />
              Request refund review for this receipt
            </button>
            <span className={hintClass}>
              Needs an amount in kobo, a review reason and at least one evidence
              reference below.
            </span>
          </div>
        </article>
      ))}
      <fieldset className={`${panelClass} space-y-3`}>
        <legend className="px-1 text-base font-semibold">
          Review evidence
        </legend>
        <p className={hintClass}>
          These shared fields apply to every pending action on this page. Write
          the reason once; it is attached verbatim to the case.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Provider refund ID
            <input
              className={fieldClass}
              value={providerRefundId}
              onChange={(e) => setProviderRefundId(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Refund amount (kobo)
            <input
              type="number"
              min="1"
              className={fieldClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Review reason
            <textarea
              rows={2}
              className={fieldClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            ></textarea>
          </label>
          <label className="block text-sm font-medium">
            Evidence references (one per line)
            <textarea
              rows={2}
              className={fieldClass}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            ></textarea>
          </label>
        </div>
      </fieldset>
      {queue?.next && (
        <button
          disabled={busy}
          className={buttonClass}
          onClick={async () => {
            setBusy(true);
            try {
              const page = await experienceRequest<Queue>(
                token,
                `/locations/${locationId}/money-cases?after=${queue.next}`,
              );
              setQueue({ ...page, items: [...queue.items, ...page.items] });
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Unable to load more cases',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          More payment cases
        </button>
      )}
    </section>
  );
}
