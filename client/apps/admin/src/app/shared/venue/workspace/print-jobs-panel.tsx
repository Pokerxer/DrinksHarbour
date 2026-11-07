'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCcw } from 'lucide-react';
import {
  listPrintJobs,
  reprintPrintJob,
  type DeliveryState,
  type PrintJobDTO,
} from '@/services/venue/ops';
import { buttonClass, Chip, EmptyState, fieldClass, Notice, panelClass } from './controls';

/**
 * S4 print-jobs panel (Task 3, minimal honest scope). Lists a visit's recent
 * print jobs through the staff read surface (GET /service-sessions/:id/
 * print-jobs — newest first) and offers reprint (POST .../:jobId/reprint —
 * an Idempotency-Key ledger operation, attached by the shared venueRequest
 * client like every venue command). Delivery states are rendered read-only:
 * only the bridge pull/ack moves them server-side. Reprints and amendments
 * are shown as the labelled duplicates they are (duplicateOf → original).
 */

const stateChip: Record<DeliveryState, { label: string; tone: 'ready' | 'pending' | 'danger' | 'info' }> = {
  queued: { label: 'Queued', tone: 'pending' },
  delivered: { label: 'Delivered', tone: 'info' },
  acknowledged: { label: 'Acknowledged', tone: 'ready' },
  failed: { label: 'Failed', tone: 'danger' },
};

const actionLabel: Record<PrintJobDTO['actionType'], string> = {
  print: 'Print',
  reprint: 'Reprint',
  amendment: 'Amendment',
  cancel: 'Cancel',
};

/** The action types whose whole point is pointing at an original job. */
const isDuplicate = (job: PrintJobDTO) => job.actionType === 'reprint' || job.actionType === 'amendment';

function JobRow({ job, busy, onReprint }: { job: PrintJobDTO; busy: boolean; onReprint: (job: PrintJobDTO) => void }) {
  const chip = stateChip[job.deliveryState];
  return (
    <li className={`${panelClass} flex flex-wrap items-start justify-between gap-3`}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={chip.tone} label={chip.label} />
          <span className="text-sm font-semibold">
            {actionLabel[job.actionType]}
            {job.payload.roundNo != null ? ` · round ${job.payload.roundNo}` : ''}
          </span>
          {isDuplicate(job) && job.duplicateOf && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              duplicate of {job.duplicateOf}
              {job.payload.label ? ` (${job.payload.label})` : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {job.jobId} · {job.lineIds.length} line{job.lineIds.length === 1 ? '' : 's'} · {job.attempts} delivery attempt{job.attempts === 1 ? '' : 's'}
          {job.deviceId ? ` · device ${job.deviceId}` : ' · no device bound'}
        </p>
        {job.deliveryState === 'failed' && (
          <p className="text-xs font-medium text-red-700 dark:text-red-300">
            {job.lastError || 'Delivery failed'} — reprint to send a fresh copy.
          </p>
        )}
      </div>
      <button type="button" className={buttonClass} disabled={busy} onClick={() => onReprint(job)}>
        <Printer aria-hidden="true" className="size-4" />
        Reprint
      </button>
    </li>
  );
}

export default function PrintJobsPanel({
  token,
  visits,
}: {
  token: string;
  /** Open visits from the workspace snapshot ({_id, state}) — print jobs are session-scoped. */
  visits: { _id: string; state: string }[];
}) {
  const open = useMemo(() => visits.filter((visit) => visit.state === 'open'), [visits]);
  const [sessionId, setSessionId] = useState('');
  const [jobs, setJobs] = useState<PrintJobDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (id: string) => {
    const data = await listPrintJobs(token, id);
    setJobs(data.jobs);
    return data;
  }, [token]);
  useEffect(() => {
    const first = sessionId && open.some((visit) => visit._id === sessionId) ? sessionId : (open[0]?._id || '');
    setSessionId(first);
    if (first) load(first).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load print jobs'));
    else setJobs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load(sessionId);
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Command failed');
    } finally {
      setBusy(false);
    }
  }
  const reprint = (job: PrintJobDTO) =>
    run(() => reprintPrintJob(token, sessionId, job.jobId), `Reprint of ${job.jobId} queued.`);
  if (!open.length) {
    return (
      <section aria-label="Print jobs" className="space-y-3">
        <Header />
        <EmptyState message="No open visits — print jobs appear once a visit is open and a round has been fired." />
      </section>
    );
  }
  return (
    <section aria-label="Print jobs" className="space-y-3">
      <Header />
      <div className="flex flex-wrap items-center gap-3">
        <label className="block text-sm font-medium">
          Visit
          <select
            className={fieldClass}
            value={sessionId}
            onChange={(e) => {
              const id = e.target.value;
              setSessionId(id);
              if (id) load(id).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load print jobs'));
            }}
          >
            {open.map((visit) => (
              <option key={visit._id} value={visit._id}>{visit._id}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !sessionId}
          onClick={() => run(() => load(sessionId), 'Print jobs refreshed.')}
        >
          <RefreshCcw aria-hidden="true" className="size-4" />
          Refresh
        </button>
      </div>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {message && <Notice tone="success" role="status">{message}</Notice>}
      {jobs && !jobs.length && (
        <EmptyState message="No print jobs for this visit yet — fire a round to print station tickets." />
      )}
      {!!jobs?.length && (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} busy={busy} onReprint={reprint} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Header() {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold">Print jobs</h2>
      <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        Kitchen tickets are delivered by the location&apos;s device bridge (pull-only,
        token-protected). Reprints are labelled duplicates of the original job —
        they never add a new fire or consumption event.
      </p>
    </div>
  );
}