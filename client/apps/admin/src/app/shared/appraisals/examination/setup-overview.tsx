import { CheckCircle2, ClipboardList, Clock3, CircleAlert } from 'lucide-react';
import type { ExamConfiguration } from '@/services/examination.service';
export default function SetupOverview({
  config,
  issues,
}: {
  config: ExamConfiguration;
  issues: string[];
}) {
  const marks = config.questions.map(
    (q) => q.marks ?? config.marksPerQuestion ?? 2
  );
  const uniform = new Set(marks).size === 1;
  return (
    <aside
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
      aria-label="Examination overview"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <ClipboardList className="h-4 w-4" aria-hidden="true" />
        Employee paper
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-2xl font-semibold tabular-nums">10</p>
          <p className="mt-1 text-xs text-gray-500">Questions per person</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
            <Clock3 className="h-4 w-4 text-gray-400" aria-hidden="true" />
            {config.durationMinutes || '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Minutes to answer</p>
        </div>
      </div>
      <p className="rounded-xl bg-red-50 p-3 text-xs font-medium leading-5 text-[#790505]">
        10 questions per employee ·{' '}
        {uniform
          ? `${10 * (marks[0] ?? 2)} marks`
          : 'marks vary with assigned questions'}
      </p>
      <p className="text-xs leading-5 text-gray-500">
        {config.questions.length} bank questions · {config.departments.length}{' '}
        selected departments. Each paper is shuffled and stays fixed after
        launch.
      </p>
      <div
        className={`rounded-xl border p-3 ${issues.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-900'}`}
      >
        <p className="flex items-center gap-2 text-sm font-semibold">
          {issues.length ? (
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {issues.length ? 'Finish setup before saving' : 'Ready to save'}
        </p>
        {issues.length ? (
          <ul className="mt-2 space-y-2 text-xs leading-5">
            {issues.slice(0, 4).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs leading-5">
            Dates, departments and questions are complete. Save these settings
            before launching the cycle.
          </p>
        )}
        {issues.length > 4 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer font-medium">
              Show {issues.length - 4} more checks
            </summary>
            <ul className="mt-2 space-y-2 leading-5">
              {issues.slice(4).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </aside>
  );
}
