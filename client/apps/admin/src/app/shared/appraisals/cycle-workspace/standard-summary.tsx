import type { CycleProgress } from '@/services/appraisal.service';
import { cycleStats } from '../cycle-detail-utils';
import { CycleMetric } from './workspace';
export default function StandardSummary({
  progress,
}: {
  progress: CycleProgress | null;
}) {
  const s = cycleStats(progress);
  return (
    <>
      <CycleMetric
        label="Appraisals"
        value={String(s.total)}
        detail={
          s.cancelled > 0
            ? `${s.cancelled} cancelled · ${s.inFlight} in flight`
            : `${s.inFlight} in flight`
        }
      />
      <CycleMetric
        label="Released"
        value={s.completionPct === null ? '—' : `${s.completionPct}%`}
        detail={`${s.done} of ${s.total - s.cancelled} appraisals`}
        accent
      />
      <CycleMetric
        label="Feedback in"
        value={s.feedbackPct === null ? '—' : `${s.feedbackPct}%`}
        detail={`${s.feedbackSubmitted} of ${s.feedbackTotal} forms`}
      />
      <CycleMetric
        label="Stalled"
        value={String(s.stalledCount)}
        detail={s.stalledCount === 0 ? 'Nothing blocked' : 'Needs HR attention'}
        accent={s.stalledCount > 0}
      />
    </>
  );
}
