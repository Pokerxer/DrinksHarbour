import type { CompositeScore } from '@/services/examination.service';
export default function ScoreBreakdown({
  result,
  compact = false,
}: {
  result: CompositeScore;
  compact?: boolean;
}) {
  const hasExam = result.examScore !== undefined;
  return (
    <section
      aria-label="Combined performance score"
      className={
        compact
          ? 'space-y-2 whitespace-normal text-left'
          : 'space-y-3 rounded-xl bg-gray-50 p-4'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Combined score ·{' '}
        {result.attendanceFrom && result.attendanceTo
          ? `${result.attendanceFrom} – ${result.attendanceTo}`
          : result.attendanceMonth}
      </p>
      <p
        className={`${compact ? 'text-base' : 'text-2xl'} font-semibold tabular-nums text-[#b20202]`}
      >
        {result.combinedScore.toFixed(2)} / 100
      </p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
        <div>
          <dt>Appraisal</dt>
          <dd>{result.appraisalScore.toFixed(2)}%</dd>
        </div>
        {hasExam && (
          <div>
            <dt>Examination</dt>
            <dd>{result.examScore!.toFixed(2)}%</dd>
          </div>
        )}
        <div>
          <dt>Attendance</dt>
          <dd>{result.attendanceScore.toFixed(2)}%</dd>
        </div>
      </dl>
      <p className="text-xs leading-5 text-gray-500">
        {hasExam
          ? 'Examination, appraisal and attendance carry equal weight. Bonuses use the unrounded score.'
          : 'Appraisal and attendance carry equal weight; no examination was assigned. Bonuses use the unrounded score.'}
      </p>
    </section>
  );
}
