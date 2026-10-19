import type { AppraisalCycle } from '@/services/appraisal.service';
import type { PeerProgress } from '@/services/peerAppraisal.service';
import { formatMoney } from '../peer-rating/result-card';
import { CycleMetric } from './workspace';
export default function PeerSummary({
  progress,
  status,
}: {
  progress: PeerProgress | null;
  status: AppraisalCycle['status'];
}) {
  const total = progress?.total ?? 0;
  const appraisers = progress?.appraiserTotal ?? total;
  const submitted = progress?.submitted ?? 0;
  const pool = progress?.participants.reduce(
    (sum, p) => sum + p.allocationMinor,
    0
  );
  const bonus = progress?.participants.every((p) => p.result)
    ? progress.participants.reduce(
        (sum, p) => sum + (p.result?.bonusMinor ?? 0),
        0
      )
    : undefined;
  const money = status === 'closed' ? bonus : pool;
  return (
    <>
      <CycleMetric
        label="Participants"
        value={progress ? String(total) : '—'}
        detail={
          status === 'draft'
            ? 'Included in the saved roster'
            : 'Frozen when the cycle launched'
        }
      />
      <CycleMetric
        label="Submitted"
        value={progress ? String(submitted) : '—'}
        detail={
          appraisers > 0
            ? `${submitted} of ${appraisers} appraisers finished`
            : 'No appraisers yet'
        }
        accent
      />
      <CycleMetric
        label="Awaiting submission"
        value={progress ? String(Math.max(0, appraisers - submitted)) : '—'}
        detail={
          status === 'cancelled'
            ? 'This cycle is no longer collecting'
            : 'All selected appraisers must submit'
        }
      />
      <CycleMetric
        label={status === 'closed' ? 'Calculated bonuses' : 'Bonus allocation'}
        value={
          money !== undefined && Number.isSafeInteger(money)
            ? formatMoney(money)
            : '—'
        }
        detail={
          status === 'closed'
            ? 'Final amounts, ready for HR review'
            : 'Combined allocations for this cycle'
        }
      />
    </>
  );
}
