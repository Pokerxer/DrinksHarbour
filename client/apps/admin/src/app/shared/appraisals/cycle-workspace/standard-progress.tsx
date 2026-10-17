import type {
  AppraisalState,
  CycleProgress,
} from '@/services/appraisal.service';
import { cycleStats } from '../cycle-detail-utils';
import AppraisalStateBadge from '../state-badge';
function ProgressBar({ pct, tone }: { pct: number | null; tone: string }) {
  if (pct === null) return null;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
function ProgressByState({ byState }: { byState: CycleProgress['byState'] }) {
  const entries = Object.entries(byState);
  if (entries.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-400">
        No appraisals have been launched for this cycle yet.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([state, count]) => (
        <div
          key={state}
          className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2"
        >
          <AppraisalStateBadge state={state as AppraisalState} />
          <span className="text-sm font-semibold text-gray-700">{count}</span>
        </div>
      ))}
    </div>
  );
}
export default function StandardProgress({
  progress,
}: {
  progress: CycleProgress | null;
}) {
  const stats = cycleStats(progress);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">
          Feedback progress
        </h2>
        <p className="text-xs tabular-nums text-gray-500">
          {stats.feedbackSubmitted} of {stats.feedbackTotal} forms submitted
        </p>
      </div>
      <ProgressBar pct={stats.feedbackPct} tone="bg-[#b20202]" />
      <p className="mt-5 text-xs font-semibold text-gray-500">
        Appraisals by state
      </p>
      {progress && <ProgressByState byState={progress.byState} />}
    </section>
  );
}
