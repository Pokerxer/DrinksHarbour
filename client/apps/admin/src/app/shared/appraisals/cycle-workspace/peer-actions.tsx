import type { AppraisalCycle } from '@/services/appraisal.service';
import type { PeerProgress } from '@/services/peerAppraisal.service';
import { CycleActionPanel } from './workspace';
type Action = 'launch' | 'close' | 'cancel';
const button =
  'w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40';
export default function PeerActions({
  cycle,
  progress,
  dirty,
  busy,
  confirm,
  onConfirm,
  onAction,
}: {
  cycle: AppraisalCycle;
  progress: PeerProgress | null;
  dirty: boolean;
  busy: boolean;
  confirm: Action | null;
  onConfirm: (value: Action | null) => void;
  onAction: (value: Action) => void;
}) {
  const appraiserTotal = progress?.appraiserTotal ?? progress?.total ?? 0;
  const examination = progress?.examination;
  const examIncomplete =
    examination &&
    (!(examination.periodComplete ?? examination.monthComplete) ||
      examination.submitted !== examination.assigned);
  const incomplete =
    !progress ||
    appraiserTotal < 2 ||
    progress.submitted !== appraiserTotal ||
    Boolean(examIncomplete);
  const title =
    cycle.status === 'draft'
      ? 'Prepare your roster'
      : cycle.status === 'collecting'
        ? incomplete
          ? examination
            ? 'Complete the remaining assessments'
            : 'Collect the remaining ratings'
          : 'Ready to calculate bonuses'
        : cycle.status === 'closed'
          ? 'Results are available'
          : 'Cycle cancelled';
  const description =
    cycle.status === 'draft'
      ? 'Choose the participants and at least two appraisers, then save before launching.'
      : cycle.status === 'collecting'
        ? examination
          ? 'Finish colleague ratings and assigned examinations. Finalize after the attendance period ends and all participants have rated attendance.'
          : 'Selected appraisers rate every other participant. Close the cycle once all appraisers have submitted.'
        : cycle.status === 'closed'
          ? 'Employees can now view their own score and calculated bonus in My appraisals.'
          : 'This cycle no longer accepts ratings or changes.';
  return (
    <CycleActionPanel
      title={title}
      description={description}
      settings={
        <>
          <p className="text-xs font-semibold text-gray-900">
            How bonuses are calculated
          </p>
          <p className="text-xs leading-5 text-gray-500">
            {examination
              ? 'Bonus = combined percentage × allocation. Selected exam recipients average exam, appraisal and attendance equally; other employees average appraisal and attendance equally.'
              : 'Average rating ÷ 5 × individual allocation. Ratings use a 1–5 scale; no self-rating.'}
          </p>
          <p className="text-xs leading-5 text-gray-500">
            Individual incoming ratings remain private. Calculated amounts do
            not confirm a payment.
          </p>
        </>
      }
    >
      {progress && (
        <>
          {cycle.status === 'draft' && (
            <button
              className={`${button} bg-[#b20202] text-white hover:bg-[#960202]`}
              disabled={busy || dirty || appraiserTotal < 2}
              onClick={() => onConfirm('launch')}
            >
              Launch cycle
            </button>
          )}
          {cycle.status === 'collecting' && (
            <button
              className={`${button} bg-[#b20202] text-white hover:bg-[#960202]`}
              disabled={busy || incomplete}
              onClick={() => onConfirm('close')}
            >
              Close and calculate bonuses
            </button>
          )}
          {dirty && (
            <p className="text-xs leading-5 text-amber-700">
              Save your roster changes before launching.
            </p>
          )}
          {cycle.status === 'collecting' &&
            progress.submitted !== appraiserTotal && (
              <p className="text-xs leading-5 text-gray-500">
                {Math.max(0, appraiserTotal - progress.submitted)} appraisers
                still need to submit. Missing ratings are never counted as zero.
              </p>
            )}
          {cycle.status === 'collecting' && examIncomplete && (
            <p className="text-xs leading-5 text-gray-500">
              Complete all assigned examinations and wait until the attendance
              period ends before closing.
            </p>
          )}
          {['draft', 'collecting'].includes(cycle.status) && (
            <button
              className={`${button} border border-gray-200 text-gray-500 hover:bg-gray-50`}
              disabled={busy}
              onClick={() => onConfirm('cancel')}
            >
              Cancel cycle
            </button>
          )}
        </>
      )}
      {confirm && (
        <section
          aria-label="Confirm cycle action"
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
        >
          <p className="text-xs leading-5 text-amber-900">
            {confirm === 'launch'
              ? 'Launch with this roster, selected appraisers and allocations? They cannot be changed after launch.'
              : confirm === 'close'
                ? 'Close and release each employee’s score and calculated bonus?'
                : 'Cancel this cycle? It will stop collecting ratings and will not release bonuses.'}
          </p>
          <button
            className={`${button} bg-[#b20202] text-white`}
            disabled={busy || (confirm === 'launch' && dirty)}
            onClick={() => onAction(confirm)}
          >
            {busy ? 'Working…' : `Confirm ${confirm}`}
          </button>
          <button
            className={`${button} border border-amber-200 bg-white`}
            disabled={busy}
            onClick={() => onConfirm(null)}
          >
            Go back
          </button>
        </section>
      )}
    </CycleActionPanel>
  );
}
