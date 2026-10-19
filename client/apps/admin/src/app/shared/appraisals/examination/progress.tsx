import type { ExaminationSettings } from '@/services/examination.service';
export default function ExaminationProgress({
  examination: exam,
}: {
  examination: ExaminationSettings;
}) {
  return (
    <section
      className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5"
      aria-label="Examination progress"
    >
      <h2 className="text-base font-semibold">Examination and attendance</h2>
      <p className="text-sm text-gray-600">
        {exam.submitted} of {exam.assigned} assigned employees submitted the
        examination.
      </p>
      {exam.durationMinutes && (
        <p className="text-sm text-gray-600">
          {exam.durationMinutes} minutes per employee · starts when they begin
        </p>
      )}
      <p className="text-xs leading-5 text-gray-500">
        Attendance period:{' '}
        {exam.attendanceFrom && exam.attendanceTo
          ? `${exam.attendanceFrom} – ${exam.attendanceTo}`
          : exam.attendanceMonth}
        .{' '}
        {(exam.periodComplete ?? exam.monthComplete)
          ? 'The attendance period has ended.'
          : 'Final bonuses can be calculated after this period ends.'}
      </p>
      <p className="text-xs leading-5 text-gray-500">
        Exam recipients use three equal components. Other employees use
        appraisal and attendance equally. Final scores are fixed when the cycle
        closes.
      </p>
    </section>
  );
}
