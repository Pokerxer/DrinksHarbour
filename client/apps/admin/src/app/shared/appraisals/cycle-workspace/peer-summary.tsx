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
          total > 0
            ? `${Math.round((submitted / total) * 100)}% of participants finished`
            : 'No participants yet'
        }
        accent
      />
      <CycleMetric
        label="Awaiting submission"
        value={progress ? String(Math.max(0, total - submitted)) : '—'}
        detail={
          status === 'cancelled'
            ? 'This cycle is no longer collecting'
            : 'Everyone must submit before closure'
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
