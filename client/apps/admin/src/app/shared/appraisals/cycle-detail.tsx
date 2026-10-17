'use client';
import { useSession } from 'next-auth/react';
import { Button } from 'rizzui';
import { PiRocketLaunch } from 'react-icons/pi';
import { canReadStandingFeedback } from '@/types/authorization';
import CycleRoster from './cycle-roster';
import CycleReport from './cycle-report';
import CycleStandingFeedback from './cycle-standing-feedback';
import {
  CycleHeader,
  CycleWorkspace,
  CycleActionPanel,
} from './cycle-workspace/workspace';
import StandardSummary from './cycle-workspace/standard-summary';
import StandardProgress from './cycle-workspace/standard-progress';
import StalledList from './cycle-workspace/stalled-list';
import LaunchResultPanel from './cycle-workspace/launch-result';
import StandardDialogs from './cycle-workspace/standard-dialogs';
import useStandardCycle from './cycle-workspace/use-standard-cycle';
export default function CycleDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const state = useStandardCycle(id);
  const { cycle, progress, launchResult, skippingId, launching, closing } =
    state;
  if (state.loading)
    return (
      <div role="status" className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="h-52 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        <p className="text-sm text-gray-500">Loading cycle…</p>
      </div>
    );
  if (state.error || !cycle)
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded-xl border border-gray-200 p-6"
      >
        {state.error || 'This cycle could not be found.'}
      </div>
    );
  const inactive = cycle.status === 'closed' || cycle.status === 'cancelled';
  return (
    <>
      <CycleWorkspace
        header={
          <CycleHeader
            cycle={cycle}
            modeLabel="Performance review"
            description="Follow assessments, peer feedback and the work that needs HR attention."
          />
        }
        metrics={<StandardSummary progress={progress} />}
        sidebar={
          <CycleActionPanel
            title={
              inactive
                ? cycle.status === 'cancelled'
                  ? 'Cycle cancelled'
                  : 'Cycle complete'
                : cycle.status === 'draft'
                  ? 'Launch the review cycle'
                  : 'Manage this review cycle'
            }
            description={
              inactive
                ? `This cycle is ${cycle.status} and no longer accepts changes.`
                : 'Launch for eligible employees, or close the cycle when the review period is finished.'
            }
            settings={
              <>
                <p className="text-xs font-semibold text-gray-900">
                  Review settings
                </p>
                <p className="text-xs text-gray-500">
                  Peer review {cycle.peerReviewEnabled ? 'enabled' : 'disabled'}
                </p>
                <p className="text-xs leading-5 text-gray-500">
                  Closing expires any feedback that has not been submitted.
                  Re-launching adds eligible employees who do not already have
                  an appraisal.
                </p>
              </>
            }
          >
            <Button
              onClick={() => state.setShowLaunchModal(true)}
              disabled={launching || inactive}
              className="w-full rounded-xl bg-[#b20202] hover:bg-[#960202]"
            >
              <PiRocketLaunch className="me-2 h-4 w-4" />
              {launching ? 'Launching…' : 'Launch'}
            </Button>
            <Button
              variant="outline"
              onClick={() => state.setShowCloseModal(true)}
              disabled={closing || inactive}
              className="w-full rounded-xl"
            >
              {closing ? 'Closing…' : 'Close cycle'}
            </Button>
            {inactive && (
              <p className="text-xs leading-5 text-gray-500">
                This cycle is already {cycle.status}. Launch and close are
                unavailable.
              </p>
            )}
          </CycleActionPanel>
        }
      >
        {launchResult && <LaunchResultPanel result={launchResult} />}
        <StandardProgress progress={progress} />
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">
            Stalled peer review
          </h2>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            Appraisals waiting for nomination or manager approval. Act on a row
            to move it forward.
          </p>
          {progress && (
            <StalledList
              rows={progress.stalled}
              skippingId={skippingId}
              onSkipPeers={state.handleSkipPeers}
            />
          )}
        </section>
        <CycleRoster cycleId={id} />
        <CycleReport cycleId={id} />
        {canReadStandingFeedback(session?.user?.role) ? (
          <CycleStandingFeedback cycleId={id} />
        ) : null}
      </CycleWorkspace>
      <StandardDialogs cycle={cycle} state={state} />
    </>
  );
}
